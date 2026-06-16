#!/usr/bin/env python3
"""
Скрипт для полной очистки всех внесённых данных.

Использование:
    cd bot
    python reset_data.py --yes

Требуются переменные окружения (YC_ACCESS_KEY, YC_SECRET_KEY, YC_BUCKET_NAME).
"""

import argparse
import os
import sys

# Добавляем папку со скриптом в путь, чтобы импортировать модули бота
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import storage
from config import validate_config


def main():
    parser = argparse.ArgumentParser(description="Очистка данных конкурса шагов")
    parser.add_argument(
        "--yes",
        action="store_true",
        required=True,
        help="Подтвердить удаление всех данных",
    )
    args = parser.parse_args()

    validate_config()
    storage.reset_all_data()
    print("✅ Все данные очищены.")


if __name__ == "__main__":
    main()
