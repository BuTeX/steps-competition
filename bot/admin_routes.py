"""
Административные endpoints для панели управления.
Позволяют редактировать записи, управлять бекапами и скачивать архивы.
"""

import asyncio
import logging
import secrets
from datetime import datetime
from typing import Optional

from fastapi import (
    APIRouter,
    Cookie,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
)
from pydantic import BaseModel, Field

import bot as bot_module
import database as db
import storage
from config import ADMIN_PASSWORD, YC_BUCKET_NAME, YC_ENDPOINT
from storage import create_backup, download_backup, list_backups

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin", tags=["Admin"])

# In-memory хранилище активных сессий (перезапуск приложения сбрасывает сессии)
_valid_sessions: set[str] = set()


def _create_session() -> str:
    """Генерация уникального токена сессии."""
    return secrets.token_urlsafe(32)


def _set_auth_cookie(response: Response, token: str):
    """Установка httpOnly cookie с токеном сессии."""
    response.set_cookie(
        key="admin_session",
        value=token,
        httponly=True,
        secure=False,  # Railway использует HTTPS, но для универсальности оставляем False
        samesite="lax",
        max_age=86400,  # 24 часа
        path="/",
    )


def _clear_auth_cookie(response: Response):
    """Очистка cookie сессии."""
    response.delete_cookie(key="admin_session", path="/")


def require_admin(admin_session: Optional[str] = Cookie(None)) -> None:
    """Dependency для защиты admin-рутов."""
    if not ADMIN_PASSWORD:
        raise HTTPException(status_code=503, detail="Админ-панель не настроена")
    if not admin_session or admin_session not in _valid_sessions:
        raise HTTPException(status_code=401, detail="Требуется авторизация")


# ─── Pydantic-модели ────────────────────────────────────────────────
class LoginRequest(BaseModel):
    password: str = Field(..., min_length=1)


class LoginResponse(BaseModel):
    success: bool


class RecordCreateRequest(BaseModel):
    user_id: int = Field(..., gt=0)
    display_name: str = Field(..., min_length=1)
    username: str = ""
    date: str = Field(..., min_length=1)
    steps: int = Field(..., ge=0)
    notes: str = ""


class RecordUpdateRequest(BaseModel):
    timestamp: str = Field(..., min_length=1)
    user_id: int = Field(..., gt=0)
    old_date: str = Field(..., min_length=1)
    new_date: Optional[str] = None
    steps: Optional[int] = Field(None, ge=0)
    notes: Optional[str] = None


class RecordDeleteRequest(BaseModel):
    timestamp: str = Field(..., min_length=1)
    user_id: int = Field(..., gt=0)
    date: str = Field(..., min_length=1)


class ParticipantUpdateRequest(BaseModel):
    display_name: str = Field(..., min_length=1)
    username: str = ""


class BackupInfo(BaseModel):
    backup_id: str
    key: str
    url: str
    created_at: str
    size: int


class ReminderRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)


class ReminderResponse(BaseModel):
    sent: int
    failed: int


# ─── Авторизация ────────────────────────────────────────────────────
@router.post("/login", response_model=LoginResponse)
async def admin_login(request: Request, response: Response, body: LoginRequest):
    """Вход в админ-панель."""
    if not ADMIN_PASSWORD:
        raise HTTPException(status_code=503, detail="Админ-панель не настроена")
    if secrets.compare_digest(body.password, ADMIN_PASSWORD):
        token = _create_session()
        _valid_sessions.add(token)
        _set_auth_cookie(response, token)
        logger.info(f"Успешный вход в админ-панель: {request.client.host if request.client else 'unknown'}")
        return {"success": True}
    logger.warning(f"Неудачная попытка входа в админ-панель: {request.client.host if request.client else 'unknown'}")
    raise HTTPException(status_code=401, detail="Неверный пароль")


@router.post("/logout", response_model=LoginResponse)
async def admin_logout(response: Response, admin_session: Optional[str] = Cookie(None)):
    """Выход из админ-панели."""
    if admin_session and admin_session in _valid_sessions:
        _valid_sessions.discard(admin_session)
    _clear_auth_cookie(response)
    return {"success": True}


@router.get("/me")
async def admin_me(_: None = Depends(require_admin)):
    """Проверка активной сессии."""
    return {"authenticated": True}


# ─── Участники ──────────────────────────────────────────────────────
@router.get("/participants")
async def admin_participants(_: None = Depends(require_admin)):
    """Список участников для выбора при создании записи."""
    return db.get_all_participants()


@router.put("/participants/{user_id}")
async def admin_update_participant(
    user_id: int,
    body: ParticipantUpdateRequest,
    _: None = Depends(require_admin),
):
    """Переименование участника."""
    updated = db.update_participant(
        user_id=user_id,
        display_name=body.display_name,
        username=body.username,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Участник не найден")
    return {"success": True}


# ─── Управление записями ────────────────────────────────────────────
@router.get("/records")
async def admin_records(
    _: None = Depends(require_admin),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    search: Optional[str] = Query(None),
    sort_by: str = Query("Timestamp"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
):
    """Список записей о шагах с фильтрацией и сортировкой."""
    records = db.get_all_steps()

    if search:
        search_lower = search.lower()
        records = [
            r
            for r in records
            if search_lower in (r.get("DisplayName", "")).lower()
            or search_lower in (r.get("Username", "")).lower()
            or search_lower in (r.get("Date", "")).lower()
            or search_lower in (r.get("Steps", "")).lower()
        ]

    reverse = sort_order == "desc"
    records.sort(key=lambda x: x.get(sort_by, ""), reverse=reverse)

    total = len(records)
    return {
        "records": records[offset : offset + limit],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.post("/records")
async def admin_create_record(body: RecordCreateRequest, _: None = Depends(require_admin)):
    """Создание новой записи о шагах из админ-панели."""
    try:
        datetime.strptime(body.date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Некорректный формат даты, ожидается YYYY-MM-DD")

    record = db.create_step_record(
        user_id=body.user_id,
        display_name=body.display_name,
        username=body.username,
        date=body.date,
        steps=body.steps,
        notes=body.notes,
    )
    return {"success": True, "record": record}


@router.put("/records")
async def admin_update_record(body: RecordUpdateRequest, _: None = Depends(require_admin)):
    """Редактирование записи о шагах."""
    if body.new_date:
        try:
            datetime.strptime(body.new_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Некорректный формат даты, ожидается YYYY-MM-DD")

    updated = db.update_step_record(
        timestamp=body.timestamp,
        user_id=body.user_id,
        old_date=body.old_date,
        new_date=body.new_date,
        steps=body.steps,
        notes=body.notes,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    return {"success": True, "record": updated}


@router.delete("/records")
async def admin_delete_record(body: RecordDeleteRequest, _: None = Depends(require_admin)):
    """Удаление записи о шагах."""
    deleted = db.delete_step_record(
        timestamp=body.timestamp,
        user_id=body.user_id,
        date=body.date,
    )
    if not deleted:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    return {"success": True}


@router.put("/records/{timestamp}/screenshot")
async def admin_upload_screenshot(
    timestamp: str,
    user_id: int = Query(..., gt=0),
    date: str = Query(..., min_length=1),
    screenshot: UploadFile = File(...),
    _: None = Depends(require_admin),
):
    """Загрузка или замена скриншота для существующей записи."""
    records = db.get_all_steps()
    target = None
    for record in records:
        if (
            record.get("Timestamp", "") == timestamp
            and str(record.get("UserID", "")) == str(user_id)
            and record.get("Date", "") == date
        ):
            target = record
            break

    if target is None:
        raise HTTPException(status_code=404, detail="Запись не найдена")

    content = await screenshot.read()
    if not content:
        raise HTTPException(status_code=400, detail="Файл скриншота пустой")

    display_name = target.get("DisplayName", "Unknown")
    steps = int(target.get("Steps", "0") or "0")
    content_type = screenshot.content_type or "image/jpeg"

    try:
        url = storage.upload_screenshot_bytes(
            user_id=user_id,
            display_name=display_name,
            date_str=date,
            steps=steps,
            data=content,
            content_type=content_type,
        )
    except Exception as e:
        logger.exception("Ошибка загрузки скриншота")
        raise HTTPException(status_code=500, detail=f"Ошибка загрузки скриншота: {e}")

    updated = db.update_step_record(
        timestamp=timestamp,
        user_id=user_id,
        old_date=date,
        screenshot_url=url,
    )
    if not updated:
        # Если запись не найдена после параллельного изменения — удаляем загруженный файл
        storage.delete_screenshot_by_url(url)
        raise HTTPException(status_code=404, detail="Запись не найдена")

    return {"success": True, "record": updated}


@router.delete("/records/{timestamp}/screenshot")
async def admin_delete_screenshot(
    timestamp: str,
    user_id: int = Query(..., gt=0),
    date: str = Query(..., min_length=1),
    _: None = Depends(require_admin),
):
    """Удаление скриншота у существующей записи."""
    records = db.get_all_steps()
    target = None
    for record in records:
        if (
            record.get("Timestamp", "") == timestamp
            and str(record.get("UserID", "")) == str(user_id)
            and record.get("Date", "") == date
        ):
            target = record
            break

    if target is None:
        raise HTTPException(status_code=404, detail="Запись не найдена")

    screenshot_url = target.get("ScreenshotURL", "")
    if screenshot_url:
        storage.delete_screenshot_by_url(screenshot_url)

    updated = db.update_step_record(
        timestamp=timestamp,
        user_id=user_id,
        old_date=date,
        screenshot_url="",
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Запись не найдена")

    return {"success": True, "record": updated}


@router.get("/screenshots/view")
async def admin_view_screenshot(url: str = Query(..., min_length=1), _: None = Depends(require_admin)):
    """Proxy для просмотра скриншотов внутри админки."""
    expected_prefix = f"{YC_ENDPOINT}/{YC_BUCKET_NAME}/"
    if not url.startswith(expected_prefix):
        raise HTTPException(status_code=400, detail="Некорректный URL скриншота")

    key = storage.get_screenshot_key_from_url(url)
    if not key:
        raise HTTPException(status_code=400, detail="Не удалось извлечь ключ скриншота")

    data = storage.download_screenshot_by_url(url)
    if not data:
        raise HTTPException(status_code=404, detail="Скриншот не найден")

    content_type = "image/jpeg"
    if key.lower().endswith(".png"):
        content_type = "image/png"
    elif key.lower().endswith((".jpg", ".jpeg")):
        content_type = "image/jpeg"
    elif key.lower().endswith(".webp"):
        content_type = "image/webp"

    return Response(content=data, media_type=content_type)


# ─── Рассылка напоминаний ───────────────────────────────────────────
@router.post("/send-reminder", response_model=ReminderResponse)
async def admin_send_reminder(body: ReminderRequest, _: None = Depends(require_admin)):
    """Отправить напоминание всем участникам через бота."""
    loop = bot_module.get_bot_loop()
    if loop is None:
        raise HTTPException(status_code=503, detail="Бот ещё не запущен")

    participants = db.get_all_participants()
    if not participants:
        return {"sent": 0, "failed": 0}

    sent = 0
    failed = 0

    for participant in participants:
        user_id = participant.get("UserID", "")
        if not user_id:
            continue

        coro = bot_module.send_message_to_user(
            int(user_id),
            body.message,
            parse_mode=None,  # plain text — эмодзи работают, не нужно экранировать HTML
        )
        try:
            future = asyncio.run_coroutine_threadsafe(coro, loop)
            success = await asyncio.wrap_future(future)
            if success:
                sent += 1
            else:
                failed += 1
        except Exception as e:
            logger.warning(f"Ошибка отправки напоминания пользователю {user_id}: {e}")
            failed += 1

        # Небольшая задержка чтобы не получить 429 от Telegram
        await asyncio.sleep(0.05)

    logger.info(f"Рассылка завершена: отправлено {sent}, ошибок {failed}")
    return {"sent": sent, "failed": failed}


# ─── Бекапы ─────────────────────────────────────────────────────────
@router.post("/backup", response_model=BackupInfo)
async def admin_create_backup(_: None = Depends(require_admin)):
    """Создание ZIP-бекапа всех данных."""
    return create_backup()


@router.get("/backups", response_model=list[BackupInfo])
async def admin_list_backups(_: None = Depends(require_admin)):
    """Список доступных бекапов."""
    return list_backups()


@router.get("/backup/download/{backup_id}")
async def admin_download_backup(backup_id: str, _: None = Depends(require_admin)):
    """Скачивание ZIP-бекапа по ID."""
    if not backup_id.endswith(".zip") or "/" in backup_id or "\\" in backup_id:
        raise HTTPException(status_code=400, detail="Некорректный ID бекапа")
    data = download_backup(backup_id)
    if not data:
        raise HTTPException(status_code=404, detail="Бекап не найден")
    return Response(
        content=data,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={backup_id}"},
    )
