"""
Административные endpoints для панели управления.
Позволяют редактировать записи, управлять бекапами и скачивать архивы.
"""

import logging
import secrets
from typing import Optional

from fastapi import APIRouter, Cookie, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field

import database as db
from config import ADMIN_PASSWORD
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


class BackupInfo(BaseModel):
    backup_id: str
    key: str
    url: str
    created_at: str
    size: int


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


@router.put("/records")
async def admin_update_record(body: RecordUpdateRequest, _: None = Depends(require_admin)):
    """Редактирование записи о шагах."""
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
