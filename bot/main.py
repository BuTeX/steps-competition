#!/usr/bin/env python3
"""
Точка входа — запускает Telegram-бота и FastAPI-сервер.
Для Railway: API-сервер — основной процесс, бот — в фоне.
"""

import asyncio
import logging
import threading

import uvicorn

import bot as bot_module
from api import app as api_app
from config import API_HOST, API_PORT

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def run_bot():
    """Запуск Telegram-бота в отдельном потоке."""
    logger.info("Запуск бота в фоновом потоке...")
    try:
        asyncio.run(bot_module.main())
    except Exception as e:
        logger.error(f"Бот упал: {e}")


def main():
    """Главная функция — запускает API-сервер (основной) и бота (фон)."""
    logger.info("=" * 50)
    logger.info("Steps Competition — Bot + API + Dashboard")
    logger.info(f"API: http://{API_HOST}:{API_PORT}")
    logger.info("=" * 50)
    
    # Запускаем бота в отдельном потоке
    bot_thread = threading.Thread(target=run_bot, daemon=True)
    bot_thread.start()
    logger.info("Бот запущен в фоне")
    
    # Запускаем API-сервер (основной процесс — Railway видит порт)
    logger.info(f"API-сервер запускается на {API_HOST}:{API_PORT}")
    uvicorn.run(
        api_app,
        host=API_HOST,
        port=API_PORT,
        log_level="info",
        access_log=True,
    )


if __name__ == "__main__":
    main()
