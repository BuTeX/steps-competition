"""
Конфигурация бота и Yandex Cloud.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# ─── Telegram ───────────────────────────────────────────────────────
BOT_TOKEN = os.getenv("BOT_TOKEN", "")
if not BOT_TOKEN:
    raise ValueError("BOT_TOKEN не задан! Укажи его в переменных окружения.")

# ─── Yandex Object Storage (S3) ────────────────────────────────────
YC_ACCESS_KEY = os.getenv("YC_ACCESS_KEY", "")
YC_SECRET_KEY = os.getenv("YC_SECRET_KEY", "")
YC_BUCKET_NAME = os.getenv("YC_BUCKET_NAME", "steps-competition")
YC_REGION = os.getenv("YC_REGION", "ru-central1")
YC_ENDPOINT = os.getenv("YC_ENDPOINT", "https://storage.yandexcloud.net")

# Пути внутри бакета
BUCKET_DATA_DIR = "data"
BUCKET_STEPS_FILE = f"{BUCKET_DATA_DIR}/steps.csv"
BUCKET_PARTICIPANTS_FILE = f"{BUCKET_DATA_DIR}/participants.csv"
BUCKET_SCREENSHOTS_DIR = "screenshots"

# ─── API-сервер ─────────────────────────────────────────────────────
# Railway подставляет переменную PORT — используем её если есть
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("PORT", os.getenv("API_PORT", "8000")))

# Публичный URL (для ссылки в боте, автоматически на Railway)
RAILWAY_PUBLIC_DOMAIN = os.getenv("RAILWAY_PUBLIC_DOMAIN", "")
if RAILWAY_PUBLIC_DOMAIN:
    API_BASE_URL = f"https://{RAILWAY_PUBLIC_DOMAIN}"
else:
    API_BASE_URL = os.getenv("API_BASE_URL", f"http://{API_HOST}:{API_PORT}")

# ─── Администратор ──────────────────────────────────────────────────
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")

# ─── Общие настройки ────────────────────────────────────────────────
LOCAL_SCREENSHOTS_DIR = Path("screenshots")
LOCAL_SCREENSHOTS_DIR.mkdir(exist_ok=True)
BACKUPS_DIR = Path("backups")
BACKUPS_DIR.mkdir(exist_ok=True)


def validate_config():
    """Проверка обязательных переменных."""
    missing = []
    if not YC_ACCESS_KEY:
        missing.append("YC_ACCESS_KEY")
    if not YC_SECRET_KEY:
        missing.append("YC_SECRET_KEY")
    if missing:
        raise ValueError(
            f"Отсутствуют обязательные переменные: {', '.join(missing)}. "
            f"Заполни переменные окружения в Railway."
        )
