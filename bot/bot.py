#!/usr/bin/env python3
"""
Telegram Bot для конкурса шагов.
Хранит данные в Yandex Object Storage (S3).
Каждый пользователь имеет свою папку для скриншотов.
"""

import asyncio
import logging
import os
import re
import tempfile
from datetime import datetime, timedelta
from pathlib import Path

from aiogram import Bot, Dispatcher, F, types
from aiogram.enums import ParseMode
from aiogram.filters import Command, CommandStart
from aiogram.types import CallbackQuery, Message
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

# Фото, ожидающие ввода шагов (user_id -> локальный путь к файлу)
pending_photos: dict[int, str] = {}

# Выбор даты после получения скриншота + шагов (user_id -> {steps, photo_path})
pending_date_selections: dict[int, dict] = {}


def _last_week_dates() -> list[str]:
    """Возвращает даты за последние 7 дней (от старой к новой)."""
    today = datetime.now().date()
    return [(today - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(6, -1, -1)]


async def ask_date_selection(
    user: types.User,
    steps: int,
    photo_path: str | None,
    reply_target: Message,
):
    """Показать клавиатуру выбора даты."""
    dates = _last_week_dates()
    user_steps = db.get_user_steps(user.id)
    existing_dates = {str(s.get("Date", "")) for s in user_steps}

    builder = InlineKeyboardBuilder()
    for date_str in dates:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        label = dt.strftime("%d.%m")
        if date_str in existing_dates:
            text = f"{label} ✅ (Перезаписать?)"
        else:
            text = f"{label} (Не заполнено)"
        builder.button(text=text, callback_data=f"date_select:{date_str}")

    builder.adjust(2)

    pending_date_selections[user.id] = {
        "steps": steps,
        "photo_path": photo_path,
    }

    await reply_target.answer(
        f"📅 Скриншот получен. За какую дату <b>{steps:,}</b> шагов?",
        reply_markup=builder.as_markup(),
        parse_mode=ParseMode.HTML,
    )


# ─── Парсинг сообщений ──────────────────────────────────────────────
def parse_steps_message(text: str) -> tuple[str | None, int | None]:
    """
    Парсинг сообщения с шагами.
    
    Поддерживаемые форматы:
    - "8500" — просто число (дата = вчера)
    - "15.01 8500" — дата и шаги
    - "15.01: 8500" — дата и шаги
    - "Дата: 15.01, Шаги: 8500" — полный формат
    - "2024-01-15 8500" — ISO дата
    """
    text = text.strip()
    
    # Полный формат: "Дата: 15.01, Шаги: 8500"
    full_pattern = r"(?:[Дд]ата[:\s]+)?(\d{2}[.\-]\d{2}(?:[.\-]\d{4})?)\s*[,\s]+(?:[Шш]аги[:\s]+)?(\d+)"
    match = re.search(full_pattern, text)
    if match:
        date_str = match.group(1)
        steps = int(match.group(2))
        return normalize_date(date_str), steps
    
    # Просто число
    if text.isdigit():
        yesterday = datetime.now() - timedelta(days=1)
        return yesterday.strftime("%Y-%m-%d"), int(text)
    
    # "15.01 8500" — дата и число через пробел
    parts = text.split()
    if len(parts) >= 2:
        date_match = re.match(r"^(\d{2}[.\-]\d{2}(?:[.\-]\d{4})?)$", parts[0])
        if date_match:
            for part in parts[1:]:
                if part.isdigit():
                    return normalize_date(date_match.group(1)), int(part)
    
    return None, None


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


# ─── Обработчики команд ─────────────────────────────────────────────
@dp.message(CommandStart())
async def cmd_start(message: Message):
    """Обработка /start — регистрация."""
    user = message.from_user
    display_name = user.full_name or user.username or "Unknown"
    
    # Регистрируем участника
    db.get_or_create_participant(user.id, user.username, display_name)
    
    welcome_text = f"""
👋 Привет, {display_name}!

Я бот для конкурса шагов. Все данные хранятся в облаке — безопасно и надёжно.

📋 <b>Как отправлять шаги:</b>

1️⃣ <b>Число</b> — шаги за вчера:
   <code>8500</code>

2️⃣ <b>Дата + шаги</b>:
   <code>15.01 8500</code>
   <code>15.01: 8500</code>

3️⃣ <b>Полный формат</b>:
   <code>Дата: 15.01, Шаги: 8500</code>

4️⃣ <b>Со скриншотом</b> — прикрепи фото с подписью

📊 <b>Команды:</b>
/my_stats — моя статистика
/leaderboard — рейтинг
/help — справка

💡 <b>Важно:</b> Твои скриншоты сохраняются в твоей личной папке в облаке — их можно перепроверить в любой момент.
"""
    await message.answer(welcome_text, parse_mode=ParseMode.HTML)


@dp.message(Command("help"))
async def cmd_help(message: Message):
    """Обработка /help."""
    help_text = """
📖 <b>Справка</b>

<b>Форматы:</b>
• <code>8500</code> — шаги за вчера
• <code>15.01 8500</code> — за конкретную дату
• <code>Дата: 15.01, Шаги: 8500</code> — полный формат

<b>Команды:</b>
• /start — регистрация
• /my_stats — твоя статистика
• /leaderboard — рейтинг участников
• /help — справка

<b>Скриншоты:</b>
Прикрепляй скриншот из шагомера — он сохранится в твоей личной папке.
"""
    await message.answer(help_text, parse_mode=ParseMode.HTML)


@dp.message(Command("my_stats"))
async def cmd_my_stats(message: Message):
    """Показать статистику пользователя."""
    user = message.from_user
    stats = db.get_user_stats(user.id)
    
    if not stats:
        await message.answer("📊 У тебя пока нет записей. Отправь свои шаги!")
        return
    
    recent = stats["records"][:7]
    recent_text = "\n".join(
        f"  {r['Date']}: {int(r['Steps']):,} шагов"
        for r in recent
    )
    
    stats_text = f"""
📊 <b>Твоя статистика</b>

👤 {stats['name']}
📅 Дней: <b>{stats['days']}</b>
👣 Всего: <b>{stats['total_steps']:,}</b>
📈 Среднее: <b>{stats['avg_steps']:,}</b>/день
🔥 Рекорд: <b>{stats['max_steps']:,}</b>

📋 <b>Последние записи:</b>
{recent_text}
"""
    await message.answer(stats_text, parse_mode=ParseMode.HTML)


@dp.message(Command("leaderboard"))
async def cmd_leaderboard(message: Message):
    """Показать рейтинг."""
    board = db.get_leaderboard()
    
    if not board:
        await message.answer("📊 Пока нет данных. Стань первым!")
        return
    
    medals = ["🥇", "🥈", "🥉"]
    text = "🏆 <b>Рейтинг участников</b>\n\n"
    
    for i, user in enumerate(board[:15], 1):
        medal = medals[i-1] if i <= 3 else f"{i}."
        text += (
            f"{medal} <b>{user['name']}</b>\n"
            f"   👣 {user['total_steps']:,} | "
            f"ср. {user['avg_steps']:,}/день | "
            f"{user['days']} дней\n\n"
        )
    
    if API_BASE_URL:
        text += f"\n📊 <a href='{API_BASE_URL}'>Открыть дашборд</a>"
    
    await message.answer(text, parse_mode=ParseMode.HTML, disable_web_page_preview=True)


# ─── Обработка сообщений ────────────────────────────────────────────
@dp.message(F.photo)
async def handle_photo(message: Message):
    """Обработка фото (скриншотов)."""
    user = message.from_user
    caption = message.caption or ""
    
    # Пробуем распарсить шаги из подписи
    _, steps = parse_steps_message(caption)
    
    # Скачиваем фото локально в любом случае
    photo = message.photo[-1]
    file = await bot.get_file(photo.file_id)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"pending_{user.id}_{timestamp}.jpg"
    local_path = LOCAL_SCREENSHOTS_DIR / filename
    
    try:
        await bot.download_file(file.file_path, local_path)
    except Exception as e:
        logger.error(f"Ошибка сохранения скриншота: {e}")
        await message.answer("❌ Ошибка сохранения скриншота. Попробуй ещё раз.")
        return
    
    # Удаляем предыдущее ожидающее фото
    old_path = pending_photos.get(user.id)
    if old_path:
        Path(old_path).unlink(missing_ok=True)
    
    pending_photos[user.id] = str(local_path)
    
    if steps is None:
        await message.answer(
            f"📸 Скриншот получен!\n\n"
            f"Теперь отправь количество шагов:\n"
            f"<code>15.01 8500</code> или просто <code>8500</code>",
            parse_mode=ParseMode.HTML,
        )
        return
    
    # Если шаги указаны — спрашиваем дату
    await ask_date_selection(user, steps, str(local_path), message)


@dp.message(F.text)
async def handle_text(message: Message):
    """Обработка текстовых сообщений."""
    if not message.text or message.text.startswith("/"):
        return
    
    user = message.from_user
    date_str, steps = parse_steps_message(message.text)
    
    if steps is None:
        await message.answer(
            "❌ Не понял формат. Попробуй:\n\n"
            "<code>8500</code> — шаги за вчера\n"
            "<code>15.01 8500</code> — за конкретную дату\n"
            "<code>Дата: 15.01, Шаги: 8500</code> — полный формат\n\n"
            "Или отправь /help для справки.",
            parse_mode=ParseMode.HTML,
        )
        return
    
    pending_photo_path = pending_photos.pop(user.id, "")
    if pending_photo_path:
        # Если ждали фото — выбираем дату
        await ask_date_selection(user, steps, pending_photo_path, message)
    else:
        # Текст без фото — обрабатываем сразу
        await process_steps(message, user, date_str, steps, photo_path="")


async def process_steps(
    reply_target: Message,
    user: types.User,
    date_str: str,
    steps: int,
    photo_path: str = "",
):
    """Обработка и запись (или обновление) шагов."""
    display_name = user.full_name or user.username or "Unknown"
    
    # Регистрируем участника
    db.get_or_create_participant(user.id, user.username, display_name)
    
    screenshot_url = ""
    
    # Если есть фото — загружаем в S3 с правильным именем
    if photo_path:
        try:
            screenshot_url = upload_screenshot_for_record(
                user_id=user.id,
                display_name=display_name,
                date_str=date_str,
                steps=steps,
                local_path=photo_path,
            )
        except Exception as e:
            logger.error(f"Ошибка загрузки скриншота: {e}")
            screenshot_url = ""
        finally:
            Path(photo_path).unlink(missing_ok=True)
    
    # Записываем в базу (обновляем запись за день, если уже была)
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    username = user.username or ""
    
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
    
    # Формируем ответ
    date_display = datetime.strptime(date_str, "%Y-%m-%d").strftime("%d.%m.%Y")
    
    action = "Обновлено" if updated else "Записано"
    response = (
        f"✅ <b>{action} в облако!</b>\n\n"
        f"📅 Дата: <b>{date_display}</b>\n"
        f"👣 Шаги: <b>{steps:,}</b>\n"
    )
    
    if screenshot_url:
        response += f"📸 Скриншот: <a href='{screenshot_url}'>открыть</a>\n"
    
    response += "\n💪 Отличная работа! Продолжай в том же духе!"
    
    await reply_target.answer(response, parse_mode=ParseMode.HTML)


@dp.callback_query(F.data.startswith("date_select:"))
async def on_date_selected(callback: CallbackQuery):
    """Обработка выбора даты в inline-клавиатуре."""
    user = callback.from_user
    date_str = callback.data.split(":", 1)[1]
    
    pending = pending_date_selections.pop(user.id, None)
    if not pending:
        await callback.answer(
            "Сессия устарела. Отправь скриншот и шаги заново.",
            show_alert=True,
        )
        return
    
    await callback.answer()
    
    if callback.message:
        try:
            await callback.message.edit_reply_markup(reply_markup=None)
        except Exception:
            pass
        await process_steps(
            callback.message,
            user,
            date_str,
            pending["steps"],
            photo_path=pending.get("photo_path") or "",
        )


# ─── Главная функция ────────────────────────────────────────────────
async def main():
    """Запуск бота."""
    logger.info("Инициализация...")
    
    # Инициализация хранилища
    try:
        init_storage()
    except Exception as e:
        logger.error(f"Ошибка инициализации хранилища: {e}")
        return
    
    logger.info("Запуск бота...")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
