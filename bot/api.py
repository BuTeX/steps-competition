"""
FastAPI-сервер для дашборда.
Предоставляет REST API + раздаёт статический дашборд (React).
"""

import logging
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

import database as db
from storage import list_user_screenshots

logger = logging.getLogger(__name__)

# ─── FastAPI приложение ─────────────────────────────────────────────
app = FastAPI(
    title="Steps Competition API",
    description="API и дашборд для конкурса шагов",
    version="1.0.0",
)

# CORS — разрешаем доступ с дашборда
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Pydantic-модели ────────────────────────────────────────────────
class GlobalStats(BaseModel):
    total_steps: int
    total_participants: int
    total_records: int
    active_days: int
    avg_steps_per_day: int


class UserStat(BaseModel):
    name: str
    user_id: str
    total_steps: int
    days: int
    avg_steps: int
    max_steps: int


class DailyStat(BaseModel):
    date: str
    total_steps: int
    participants: int


class DailyMatrixEntry(BaseModel):
    date: str
    steps: int
    screenshot_url: str


class DailyMatrixUser(BaseModel):
    user_id: int
    name: str
    dates: list[DailyMatrixEntry]


class StepRecord(BaseModel):
    Timestamp: str
    Username: str
    UserID: str
    DisplayName: str
    Date: str
    Steps: str
    ScreenshotURL: str
    Verified: str
    Notes: str


class UserDetail(BaseModel):
    user_id: int
    name: str
    total_steps: int
    days: int
    avg_steps: int
    max_steps: int
    records: list[dict]


class ScreenshotInfo(BaseModel):
    key: str
    filename: str
    url: str
    size: int
    last_modified: str


# ─── API Endpoints ──────────────────────────────────────────────────
@app.get("/api/health", tags=["Health"])
async def root():
    """Проверка работоспособности."""
    return {
        "status": "ok",
        "service": "Steps Competition API",
        "version": "1.0.0",
    }


@app.get("/api/stats", response_model=GlobalStats, tags=["Statistics"])
async def get_stats():
    """Глобальная статистика."""
    return db.get_global_stats()


@app.get("/api/leaderboard", response_model=list[UserStat], tags=["Leaderboard"])
async def get_leaderboard():
    """Рейтинг участников (топ-50)."""
    board = db.get_leaderboard()
    result = []
    for b in board[:50]:
        result.append({
            "name": b["name"],
            "user_id": str(b.get("user_id", "")),
            "total_steps": b["total_steps"],
            "days": b["days"],
            "avg_steps": b["avg_steps"],
            "max_steps": b["max_steps"],
        })
    return result


@app.get("/api/daily", response_model=list[DailyStat], tags=["Statistics"])
async def get_daily():
    """Статистика по дням."""
    return db.get_daily_stats()


@app.get("/api/daily-matrix", response_model=list[DailyMatrixUser], tags=["Statistics"])
async def get_daily_matrix():
    """Матрица шагов по участникам и дням (для дашборда со скриншотами)."""
    records = db.get_all_steps()
    users: dict[str, dict] = {}

    for record in records:
        user_id = str(record.get("UserID", ""))
        date = record.get("Date", "")
        if not user_id or not date:
            continue

        if user_id not in users:
            users[user_id] = {
                "user_id": int(user_id),
                "name": record.get("DisplayName") or record.get("Username") or "Unknown",
                "dates": {},
            }

        existing = users[user_id]["dates"].get(date)
        if existing is None or record.get("Timestamp", "") > existing.get("Timestamp", ""):
            users[user_id]["dates"][date] = record

    result = []
    for user_id in sorted(users, key=lambda uid: users[uid]["name"].lower()):
        data = users[user_id]
        dates = [
            {
                "date": date,
                "steps": int(data["dates"][date].get("Steps", 0) or 0),
                "screenshot_url": data["dates"][date].get("ScreenshotURL", ""),
            }
            for date in sorted(data["dates"])
        ]
        result.append({**data, "dates": dates})

    return result


@app.get("/api/records", response_model=list[StepRecord], tags=["Records"])
async def get_records(limit: int = 100):
    """Последние записи (по умолчанию 100)."""
    records = db.get_all_steps()
    records.sort(key=lambda x: x.get("Timestamp", ""), reverse=True)
    return records[:limit]


@app.get("/api/users/{user_id}", response_model=UserDetail, tags=["Users"])
async def get_user(user_id: int):
    """Статистика конкретного пользователя."""
    stats = db.get_user_stats(user_id)
    if not stats:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return stats


@app.get("/api/users/{user_id}/screenshots", response_model=list[ScreenshotInfo], tags=["Users"])
async def get_user_screenshots_api(user_id: int):
    """Скриншоты пользователя."""
    return list_user_screenshots(user_id)


@app.get("/api/records/recent", response_model=list[StepRecord], tags=["Records"])
async def get_recent_records(limit: int = 20):
    """Последние записи для виджета."""
    records = db.get_all_steps()
    records.sort(key=lambda x: x.get("Timestamp", ""), reverse=True)
    return records[:limit]


# ─── Static files (Dashboard) ──────────────────────────────────────
# Определяем путь к dist/ — он может быть в разных местах в зависимости от окружения
DIST_PATHS = [
    Path(__file__).parent.parent / "dist",      # bot/../dist (локально)
    Path(__file__).parent.parent.parent / "dist", # bot/../../dist (Docker)
    Path("/app/dist"),                             # Docker абсолютный путь
]

dist_path = None
for p in DIST_PATHS:
    if p.exists() and (p / "index.html").exists():
        dist_path = p
        break

if dist_path:
    logger.info(f"Dashboard static files: {dist_path}")
    
    # Монтируем assets/
    if (dist_path / "assets").exists():
        app.mount("/assets", StaticFiles(directory=str(dist_path / "assets")), name="assets")
    
    @app.get("/{full_path:path}")
    async def serve_dashboard(full_path: str):
        """Раздаём React SPA — index.html для всех маршрутов."""
        # API пути уже обработаны выше, сюда попадают только не-API запросы
        index_file = dist_path / "index.html"
        if index_file.exists():
            return FileResponse(str(index_file))
        raise HTTPException(status_code=404, detail="Dashboard not found")
