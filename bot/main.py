#!/usr/bin/env python3
"""
Точка входа — запускает FastAPI-сервер (в фоне) и Telegram-бота (в main thread).
Для Railway: API-сервер обслуживает HTTP + дашборд, бот — Telegram.
"""

import asyncio
import logging
import signal
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

_api_server: uvicorn.Server | None = None


def run_api():
    """Запуск API-сервера в отдельном потоке."""
    global _api_server
    logger.info(f"API-сервер запускается на {API_HOST}:{API_PORT}")
    config = uvicorn.Config(
        api_app,
        host=API_HOST,
        port=API_PORT,
        log_level="info",
        access_log=True,
    )
    _api_server = uvicorn.Server(config)
    _api_server.run()


def _stop_api():
    """Запросить graceful shutdown API-сервера."""
    global _api_server
    if _api_server is not None:
        _api_server.should_exit = True


async def main():
    """Главная функция — API в фоне, бот в main thread."""
    logger.info("=" * 50)
    logger.info("Steps Competition — Bot + API + Dashboard")
    logger.info("=" * 50)

    # Запускаем API в отдельном потоке
    api_thread = threading.Thread(target=run_api, daemon=True)
    api_thread.start()
    logger.info("API-сервер запущен в фоне")

    loop = asyncio.get_running_loop()

    def signal_handler(sig):
        logger.info(f"Получен сигнал {sig}, завершаем работу...")
        # Останавливаем polling бота из того же event loop
        asyncio.create_task(bot_module.dp.stop_polling())
        # Запрашиваем остановку API-сервера
        loop.call_soon_threadsafe(_stop_api)

    for sig in (signal.SIGTERM, signal.SIGINT):
        try:
            loop.add_signal_handler(sig, signal_handler, sig)
        except NotImplementedError:
            # Windows не поддерживает add_signal_handler для SIGTERM
            pass

    try:
        # Запускаем бота в main thread (asyncio)
        logger.info("Запуск бота...")
        await bot_module.main()
    finally:
        logger.info("Завершение работы API-сервера...")
        _stop_api()
        api_thread.join(timeout=5)
        try:
            await bot_module.bot.session.close()
        except Exception as e:
            logger.warning(f"Ошибка закрытия сессии бота: {e}")
        logger.info("Завершено")


if __name__ == "__main__":
    asyncio.run(main())
