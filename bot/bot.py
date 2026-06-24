#!/usr/bin/env python3
"""
Telegram Bot для конкурса шагов.
Хранит данные в Yandex Object Storage (S3).
Управление через reply- и inline-кнопки.
"""

import asyncio
import logging
import re
from datetime import datetime, timedelta
from pathlib import Path

from aiogram import Bot, Dispatcher, F, types
from aiogram.enums import ParseMode
from aiogram.filters import Command, CommandStart
from aiogram.types import CallbackQuery, KeyboardButton, Message, ReplyKeyboardMarkup
from aiogram.utils.keyboard import InlineKeyboardBuilder
from dotenv import load_dotenv

import database as db
from config import BOT_TOKEN, LOCAL_SCREENSHOTS_DIR, API_BASE_URL
from storage import init_storage, upload_screenshot_for_record

load_dotenv()

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Инициализация бота
bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

# Event loop бота (main thread) — используется для рассылок из API
_bot_loop: asyncio.AbstractEventLoop | None = None


# ─── Константы кнопок ───────────────────────────────────────────────
BTN_MY_STATS = "📊 Моя статистика"
BTN_LEADERBOARD = "🏆 Рейтинг"
BTN_HELP = "❓ Помощь"
BTN_SEND_STEPS = "👣 Отправить шаги"
BTN_DASHBOARD = "🌐 Открыть дашборд"
BTN_REFRESH = "🔄 Обновить"

# Фото, ожидающие ввода шагов (user_id -> локальный путь к файлу)
pending_photos: dict[int, str] = {}

# Выбор даты после получения шагов (user_id -> {steps, photo_path, suggested_date})
pending_date_selections: dict[int, dict] = {}


# ─── Клавиатуры ─────────────────────────────────────────────────────
def main_menu_keyboard() -> ReplyKeyboardMarkup:
    """Главное reply-меню, доступное после каждого сообщения бота."""
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text=BTN_MY_STATS), KeyboardButton(text=BTN_LEADERBOARD)],
            [KeyboardButton(text=BTN_HELP), KeyboardButton(text=BTN_SEND_STEPS)],
        ],
        resize_keyboard=True,
        one_time_keyboard=False,
    )


def dashboard_inline_keyboard() -> types.InlineKeyboardMarkup:
    """Inline-кнопка для открытия дашборда."""
    builder = InlineKeyboardBuilder()
    builder.button(text=BTN_DASHBOARD, url=API_BASE_URL or "https://example.com")
    return builder.as_markup()


def refresh_inline_keyboard(action: str) -> types.InlineKeyboardMarkup:
    """Inline-кнопка обновления контекстной информации."""
    builder = InlineKeyboardBuilder()
    if action == "stats":
        builder.button(text=BTN_REFRESH, callback_data="refresh:stats")
    elif action == "leaderboard":
        builder.button(text=BTN_REFRESH, callback_data="refresh:leaderboard")
    builder.button(text=BTN_DASHBOARD, url=API_BASE_URL or "https://example.com")
    builder.adjust(2)
    return builder.as_markup()


def help_inline_keyboard() -> types.InlineKeyboardMarkup:
    """Inline-кнопки под справкой."""
    builder = InlineKeyboardBuilder()
    builder.button(text=BTN_SEND_STEPS, callback_data="help:send_steps")
    builder.button(text=BTN_DASHBOARD, url=API_BASE_URL or "https://example.com")
    builder.adjust(2)
    return builder.as_markup()


# ─── Helpers ────────────────────────────────────────────────────────
def _last_week_dates() -> list[str]:
    """Возвращает даты за последние 7 дней (от старой к новой)."""
    today = datetime.now().date()
    return [(today - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(6, -1, -1)]


def _format_date(date_str: str) -> str:
    """YYYY-MM-DD -> DD.MM.YYYY."""
    return datetime.strptime(date_str, "%Y-%m-%d").strftime("%d.%m.%Y")


async def send_menu(
    target: Message,
    text: str,
    inline_markup: types.InlineKeyboardMarkup | None = None,
    parse_mode: str = ParseMode.HTML,
):
    """Отправить сообщение с главным reply-меню."""
    await target.answer(
        text,
        reply_markup=inline_markup or main_menu_keyboard(),
        parse_mode=parse_mode,
        disable_web_page_preview=True,
    )


# ─── Парсинг сообщений ──────────────────────────────────────────────
def parse_steps_number(text: str) -> int | None:
    """Парсит только число шагов из текста."""
    text = text.strip().replace(" ", "").replace(",", "").replace(".", "")
    if text.isdigit():
        return int(text)
    return None


def normalize_date(date_str: str) -> str:
    """Нормализация даты в формат YYYY-MM-DD."""
    date_str = date_str.strip()
    now = datetime.now()

    # DD.MM.YYYY
    if re.match(r"^\d{2}\.\d{2}\.\d{4}$", date_str):
        return datetime.strptime(date_str, "%d.%m.%Y").strftime("%Y-%m-%d")

    # DD.MM (текущий год)
    if re.match(r"^\d{2}\.\d{2}$", date_str):
        dt = datetime.strptime(date_str, "%d.%m")
        return dt.replace(year=now.year).strftime("%Y-%m-%d")

    # YYYY-MM-DD
    if re.match(r"^\d{4}-\d{2}-\d{2}$", date_str):
        return date_str

    # DD-MM-YYYY
    if re.match(r"^\d{2}-\d{2}-\d{4}$", date_str):
        return datetime.strptime(date_str, "%d-%m-%Y").strftime("%Y-%m-%d")

    return date_str


async def ask_date_selection(
    user: types.User,
    steps: int,
    photo_path: str | None,
    reply_target: Message,
    suggested_date: str | None = None,
):
    """Показать inline-клавиатуру выбора даты."""
    logger.info(f"ask_date_selection: user={user.id}, steps={steps}, photo_path={photo_path}, suggested={suggested_date}")
    dates = _last_week_dates()
    user_steps = db.get_user_steps(user.id)
    existing_dates = {str(s.get("Date", "")) for s in user_steps}

    builder = InlineKeyboardBuilder()
    for date_str in dates:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        label = dt.strftime("%d.%m")
        if date_str == suggested_date:
            text = f"{label} ⭐"
        elif date_str in existing_dates:
            text = f"{label} ✅ (Перезаписать?)"
        else:
            text = f"{label} (Не заполнено)"
        builder.button(text=text, callback_data=f"date_select:{date_str}")

    builder.adjust(2)

    pending_date_selections[user.id] = {
        "steps": steps,
        "photo_path": photo_path,
    }

    photo_hint = "📸 Скриншот получен." if photo_path else ""
    try:
        await reply_target.answer(
            f"{photo_hint}\n\n📅 За какую дату <b>{steps:,}</b> шагов?",
            reply_markup=builder.as_markup(),
            parse_mode=ParseMode.HTML,
        )
        logger.info(f"Клавиатура выбора даты отправлена user={user.id}")
    except Exception as e:
        logger.exception(f"Ошибка отправки клавиатуры выбора даты: {e}")
        await reply_target.answer(
            "❌ Не удалось показать кнопки выбора даты. Попробуй ещё раз.",
            reply_markup=main_menu_keyboard(),
            parse_mode=ParseMode.HTML,
        )


# ─── Команды ────────────────────────────────────────────────────────
@dp.message(CommandStart())
async def cmd_start(message: Message):
    """Обработка /start — регистрация и приветствие."""
    user = message.from_user
    display_name = user.full_name or user.username or "Unknown"
    db.get_or_create_participant(user.id, user.username, display_name)

    welcome_text = (
        f"👋 Привет, {display_name}!\n\n"
        "Я бот для конкурса шагов. Все данные хранятся в облаке.\n\n"
        "👣 <b>Как отправить шаги:</b>\n"
        "1. Отправь число шагов сообщением.\n"
        "2. Выбери дату кнопкой.\n"
        "3. (Опционально) прикрепи скриншот.\n\n"
        "Используй меню ниже 👇"
    )
    await send_menu(message, welcome_text)


@dp.message(F.text == BTN_HELP)
@dp.message(Command("help"))
async def cmd_help(message: Message):
    """Справка."""
    help_text = (
        "📖 <b>Справка</b>\n\n"
        "<b>Как отправить шаги:</b>\n"
        "• Отправь число шагов, например <code>8500</code>.\n"
        "• Бот спросит дату — выбери кнопкой.\n"
        "• Можно прикрепить скриншот из шагомера.\n\n"
        "<b>Меню:</b>\n"
        "• 📊 Моя статистика\n"
        "• 🏆 Рейтинг\n"
        "• ❓ Помощь\n"
        "• 👣 Отправить шаги\n\n"
        "Скриншоты сохраняются в твоей личной папке в облаке."
    )
    await send_menu(message, help_text, inline_markup=help_inline_keyboard())


@dp.message(F.text == BTN_SEND_STEPS)
@dp.callback_query(F.data == "help:send_steps")
async def cmd_send_steps(message: Message | CallbackQuery):
    """Подсказка, как отправить шаги."""
    text = (
        "👣 <b>Отправка шагов</b>\n\n"
        "Просто отправь мне число шагов, например:\n"
        "<code>8500</code>\n\n"
        "Если хочешь приложить скриншот — отправь фото сразу после числа или с подписью.\n\n"
        "После этого я спрошу дату кнопками."
    )
    if isinstance(message, CallbackQuery):
        await message.answer(text, parse_mode=ParseMode.HTML)
        await message.message.answer("Главное меню 👇", reply_markup=main_menu_keyboard())
    else:
        await send_menu(message, text)


@dp.message(F.text == BTN_MY_STATS)
@dp.message(Command("my_stats"))
async def cmd_my_stats(message: Message):
    """Показать статистику пользователя."""
    user = message.from_user
    stats = db.get_user_stats(user.id)

    if not stats:
        await send_menu(
            message,
            "📊 У тебя пока нет записей. Отправь свои шаги через меню 👇",
        )
        return

    recent = stats["records"][:7]
    recent_text = "\n".join(
        f"  {r['Date']}: {int(r['Steps']):,} шагов" for r in recent
    )

    stats_text = (
        f"📊 <b>Твоя статистика</b>\n\n"
        f"👤 {stats['name']}\n"
        f"📅 Дней: <b>{stats['days']}</b>\n"
        f"👣 Всего: <b>{stats['total_steps']:,}</b>\n"
        f"📈 Среднее: <b>{stats['avg_steps']:,}</b>/день\n"
        f"🔥 Рекорд: <b>{stats['max_steps']:,}</b>\n\n"
        f"📋 <b>Последние записи:</b>\n{recent_text}"
    )
    await send_menu(message, stats_text, inline_markup=refresh_inline_keyboard("stats"))


@dp.message(F.text == BTN_LEADERBOARD)
@dp.message(Command("leaderboard"))
async def cmd_leaderboard(message: Message):
    """Показать рейтинг."""
    board = db.get_leaderboard()

    if not board:
        await send_menu(
            message,
            "📊 Пока нет данных. Стань первым — отправь шаги через меню 👇",
        )
        return

    medals = ["🥇", "🥈", "🥉"]
    text = "🏆 <b>Рейтинг участников</b>\n\n"

    for i, user in enumerate(board[:15], 1):
        medal = medals[i - 1] if i <= 3 else f"{i}."
        text += (
            f"{medal} <b>{user['name']}</b>\n"
            f"   👣 {user['total_steps']:,} | "
            f"ср. {user['avg_steps']:,}/день | "
            f"{user['days']} дней\n\n"
        )

    await send_menu(message, text, inline_markup=refresh_inline_keyboard("leaderboard"))


# ─── Inline-обновления ──────────────────────────────────────────────
@dp.callback_query(F.data == "refresh:stats")
async def refresh_stats(callback: CallbackQuery):
    """Обновить статистику inline-кнопкой."""
    await callback.answer("Обновляю...")
    # Удаляем старое сообщение и отправляем новое
    await callback.message.delete()
    await cmd_my_stats(callback.message)


@dp.callback_query(F.data == "refresh:leaderboard")
async def refresh_leaderboard(callback: CallbackQuery):
    """Обновить рейтинг inline-кнопкой."""
    await callback.answer("Обновляю...")
    await callback.message.delete()
    await cmd_leaderboard(callback.message)


# ─── Обработка фото ─────────────────────────────────────────────────
@dp.message(F.photo)
async def handle_photo(message: Message):
    """Обработка фото (скриншотов)."""
    user = message.from_user
    caption = message.caption or ""
    steps = parse_steps_number(caption)

    photo = message.photo[-1]
    file = await bot.get_file(photo.file_id)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"pending_{user.id}_{timestamp}.jpg"
    local_path = LOCAL_SCREENSHOTS_DIR / filename

    try:
        await bot.download_file(file.file_path, local_path)
    except Exception as e:
        logger.error(f"Ошибка сохранения скриншота: {e}")
        await send_menu(message, "❌ Ошибка сохранения скриншота. Попробуй ещё раз.")
        return

    # Удаляем предыдущее ожидающее фото
    old_path = pending_photos.get(user.id)
    if old_path:
        Path(old_path).unlink(missing_ok=True)

    pending_photos[user.id] = str(local_path)

    # Если шаги указаны в подписи — начинаем/перезапускаем выбор даты
    if steps is not None:
        pending_date_selections.pop(user.id, None)
        pending_photos.pop(user.id, None)
        await ask_date_selection(user, steps, str(local_path), message)
        return

    # Если пользователь уже ввёл шаги и сейчас выбирает дату — прикрепляем скрин к текущей сессии
    pending = pending_date_selections.get(user.id)
    if pending:
        pending["photo_path"] = str(local_path)
        pending_photos.pop(user.id, None)
        await send_menu(
            message,
            "📸 Скриншот получен! Теперь выбери дату кнопкой выше 👆",
        )
        return

    # Фото без шагов и без активного выбора даты — ждём число шагов
    await send_menu(
        message,
        "📸 Скриншот получен!\n\n"
        "Теперь отправь количество шагов сообщением, например <code>8500</code>.",
    )


# ─── Обработка текстовых сообщений ──────────────────────────────────
@dp.message(F.text)
async def handle_text(message: Message):
    """Обработка текстовых сообщений."""
    if not message.text:
        return

    user = message.from_user
    text = message.text.strip()

    # Игнорируем команды — они обрабатываются отдельными хэндлерами
    if text.startswith("/"):
        return

    # Игнорируем нажатия кнопок меню — они тоже отдельно
    if text in (BTN_MY_STATS, BTN_LEADERBOARD, BTN_HELP, BTN_SEND_STEPS):
        return

    steps = parse_steps_number(text)

    if steps is None:
        await send_menu(
            message,
            "❌ Не понял формат. Отправь только число шагов, например <code>8500</code>.\n\n"
            "Или выбери действие в меню 👇",
        )
        return

    pending_photo_path = pending_photos.pop(user.id, "")
    await ask_date_selection(user, steps, pending_photo_path or None, message)


# ─── Запись шагов ───────────────────────────────────────────────────
async def process_steps(
    reply_target: Message,
    user: types.User,
    date_str: str,
    steps: int,
    photo_path: str = "",
):
    """Обработка и запись (или обновление) шагов."""
    display_name = user.full_name or user.username or "Unknown"
    logger.info(f"process_steps: user={user.id}, date={date_str}, steps={steps}, has_photo={bool(photo_path)}")

    db.get_or_create_participant(user.id, user.username, display_name)

    screenshot_url = ""

    if photo_path:
        try:
            screenshot_url = upload_screenshot_for_record(
                user_id=user.id,
                display_name=display_name,
                date_str=date_str,
                steps=steps,
                local_path=photo_path,
            )
            logger.info(f"Скриншот загружен: {screenshot_url}")
        except Exception as e:
            logger.exception(f"Ошибка загрузки скриншота: {e}")
            screenshot_url = ""
        finally:
            Path(photo_path).unlink(missing_ok=True)

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    username = user.username or ""

    try:
        record, updated = db.add_or_update_step_record(
            timestamp=timestamp,
            username=username,
            user_id=user.id,
            display_name=display_name,
            date=date_str,
            steps=steps,
            screenshot_url=screenshot_url,
            verified="No",
            notes="",
        )
    except Exception as e:
        logger.exception(f"Ошибка записи в базу: {e}")
        await send_menu(
            reply_target,
            "❌ Не удалось сохранить шаги. Попробуй ещё раз через минуту.",
        )
        return

    date_display = _format_date(date_str)
    action = "Обновлено" if updated else "Записано"
    response = (
        f"✅ <b>{action} в облако!</b>\n\n"
        f"📅 Дата: <b>{date_display}</b>\n"
        f"👣 Шаги: <b>{steps:,}</b>\n"
    )

    if screenshot_url:
        response += f"📸 Скриншот: <a href='{screenshot_url}'>открыть</a>\n"

    response += "\n💪 Отличная работа! Продолжай в том же духе!"

    await send_menu(reply_target, response)


# ─── Выбор даты ─────────────────────────────────────────────────────
@dp.callback_query(F.data.startswith("date_select:"))
async def on_date_selected(callback: CallbackQuery):
    """Обработка выбора даты в inline-клавиатуре."""
    user = callback.from_user
    date_str = callback.data.split(":", 1)[1]
    logger.info(f"Выбор даты: user={user.id}, date={date_str}")

    pending = pending_date_selections.pop(user.id, None)
    if not pending:
        await callback.answer(
            "Сессия устарела. Отправь шаги заново.",
            show_alert=True,
        )
        return

    await callback.answer("Сохраняю...")

    try:
        if callback.message and hasattr(callback.message, "answer"):
            try:
                await callback.message.edit_reply_markup(reply_markup=None)
            except Exception as e:
                logger.warning(f"Не удалось убрать клавиатуру: {e}")

            await process_steps(
                callback.message,
                user,
                date_str,
                pending["steps"],
                photo_path=pending.get("photo_path") or "",
            )
        else:
            logger.error("callback.message недоступен для ответа")
            await callback.answer(
                "Ошибка: не удалось обработать выбор. Попробуй заново.",
                show_alert=True,
            )
    except Exception as e:
        logger.exception(f"Ошибка в on_date_selected: {e}")
        await callback.answer(
            "Произошла ошибка при сохранении. Попробуй ещё раз.",
            show_alert=True,
        )
        if callback.message and hasattr(callback.message, "answer"):
            await callback.message.answer(
                "❌ Не удалось сохранить шаги. Попробуй отправить шаги заново.",
                reply_markup=main_menu_keyboard(),
                parse_mode=ParseMode.HTML,
            )


# ─── Рассылка сообщений из других потоков ───────────────────────────
def set_bot_loop(loop: asyncio.AbstractEventLoop) -> None:
    """Сохранить event loop бота для отправки сообщений из API."""
    global _bot_loop
    _bot_loop = loop


def get_bot_loop() -> asyncio.AbstractEventLoop | None:
    """Вернуть event loop бота."""
    return _bot_loop


async def send_message_to_user(user_id: int, text: str, parse_mode: str | None = ParseMode.HTML) -> bool:
    """Отправить сообщение пользователю."""
    try:
        await bot.send_message(chat_id=user_id, text=text, parse_mode=parse_mode, disable_web_page_preview=True)
        return True
    except Exception as e:
        logger.warning(f"Не удалось отправить сообщение пользователю {user_id}: {e}")
        return False


async def send_broadcast_message(text: str, parse_mode: str | None = ParseMode.HTML, delay: float = 0.05) -> dict:
    """Отправить сообщение всем участникам."""
    participants = db.get_all_participants()
    sent = 0
    failed = 0

    for participant in participants:
        user_id = participant.get("UserID", "")
        if not user_id:
            continue
        try:
            success = await send_message_to_user(int(user_id), text, parse_mode)
            if success:
                sent += 1
            else:
                failed += 1
        except Exception as e:
            logger.warning(f"Ошибка рассылки для {user_id}: {e}")
            failed += 1
        if delay > 0:
            await asyncio.sleep(delay)

    return {"sent": sent, "failed": failed}


# ─── Главная функция ────────────────────────────────────────────────
async def main():
    """Запуск бота."""
    logger.info("Инициализация...")

    try:
        init_storage()
    except Exception as e:
        logger.error(f"Ошибка инициализации хранилища: {e}")
        return

    set_bot_loop(asyncio.get_running_loop())
    logger.info("Запуск бота...")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
