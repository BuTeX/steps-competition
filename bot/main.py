#!/usr/bin/env python3
"""
Точка входа — запускает FastAPI-сервер (в фоне) и Telegram-бота (в main thread).
Для Railway: API-сервер обслуживает HTTP + дашборд, бот — Telegram.
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


def run_api():
    """Запуск API-сервера в отдельном потоке."""
    logger.info(f"API-сервер запускается на {API_HOST}:{API_PORT}")
    uvicorn.run(
        api_app,
        host=API_HOST,
        port=API_PORT,
        log_level="info",
        access_log=True,
    )


async def main():
    """Главная функция — API в фоне, бот в main thread."""
    logger.info("=" * 50)
    logger.info("Steps Competition — Bot + API + Dashboard")
    logger.info("=" * 50)
    
    # Запускаем API в отдельном потоке
    api_thread = threading.Thread(target=run_api, daemon=True)
    api_thread.start()
    logger.info("API-сервер запущен в фоне")
    
    # Запускаем бота в main thread (asyncio)
    logger.info("Запуск бота...")
    await bot_module.main()


if __name__ == "__main__":
    asyncio.run(main())
