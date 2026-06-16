"""
Работа с Yandex Object Storage через S3 API.
Скриншоты хранятся в папках: screenshots/{user_id}/
"""

import io
import logging
from datetime import datetime

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from config import (
    BUCKET_SCREENSHOTS_DIR,
    BUCKET_STEPS_FILE,
    BUCKET_PARTICIPANTS_FILE,
    BUCKET_DATA_DIR,
    YC_ACCESS_KEY,
    YC_BUCKET_NAME,
    YC_ENDPOINT,
    YC_REGION,
    YC_SECRET_KEY,
)

logger = logging.getLogger(__name__)

# ─── S3-клиент ──────────────────────────────────────────────────────
_s3 = None


def get_s3():
    """Получение S3-клиента (singleton)."""
    global _s3
    if _s3 is None:
        _s3 = boto3.client(
            "s3",
            endpoint_url=YC_ENDPOINT,
            region_name=YC_REGION,
            aws_access_key_id=YC_ACCESS_KEY,
            aws_secret_access_key=YC_SECRET_KEY,
            config=Config(signature_version="s3v4"),
        )
        logger.info("S3-клиент создан")
    return _s3


# ─── Бакет ──────────────────────────────────────────────────────────
def ensure_bucket():
    """Создание бакета если не существует."""
    s3 = get_s3()
    try:
        s3.head_bucket(Bucket=YC_BUCKET_NAME)
        logger.info(f"Бакет '{YC_BUCKET_NAME}' доступен")
    except ClientError as e:
        error_code = e.response["Error"]["Code"]
        if error_code == "404":
            s3.create_bucket(
                Bucket=YC_BUCKET_NAME,
                ACL="private",
            )
            logger.info(f"Бакет '{YC_BUCKET_NAME}' создан")
        else:
            raise


def ensure_data_files():
    """Создание CSV-файлов в бакете если не существуют."""
    s3 = get_s3()
    
    # steps.csv
    try:
        s3.head_object(Bucket=YC_BUCKET_NAME, Key=BUCKET_STEPS_FILE)
    except ClientError:
        headers = "Timestamp,Username,UserID,DisplayName,Date,Steps,ScreenshotURL,Verified,Notes\n"
        s3.put_object(
            Bucket=YC_BUCKET_NAME,
            Key=BUCKET_STEPS_FILE,
            Body=headers.encode("utf-8"),
            ContentType="text/csv; charset=utf-8",
        )
        logger.info(f"Создан файл {BUCKET_STEPS_FILE}")
    
    # participants.csv
    try:
        s3.head_object(Bucket=YC_BUCKET_NAME, Key=BUCKET_PARTICIPANTS_FILE)
    except ClientError:
        headers = "UserID,Username,DisplayName,JoinedAt,Active\n"
        s3.put_object(
            Bucket=YC_BUCKET_NAME,
            Key=BUCKET_PARTICIPANTS_FILE,
            Body=headers.encode("utf-8"),
            ContentType="text/csv; charset=utf-8",
        )
        logger.info(f"Создан файл {BUCKET_PARTICIPANTS_FILE}")


# ─── Работа с файлами ──────────────────────────────────────────────
def upload_file(local_path: str, s3_key: str, content_type: str = None) -> str:
    """Загрузка файла в Object Storage."""
    s3 = get_s3()
    extra_args = {}
    if content_type:
        extra_args["ContentType"] = content_type
    
    s3.upload_file(local_path, YC_BUCKET_NAME, s3_key, ExtraArgs=extra_args)
    url = f"{YC_ENDPOINT}/{YC_BUCKET_NAME}/{s3_key}"
    logger.info(f"Файл загружен: {s3_key}")
    return url


def upload_bytes(data: bytes, s3_key: str, content_type: str = "application/octet-stream") -> str:
    """Загрузка байтов в Object Storage."""
    s3 = get_s3()
    s3.put_object(
        Bucket=YC_BUCKET_NAME,
        Key=s3_key,
        Body=data,
        ContentType=content_type,
    )
    url = f"{YC_ENDPOINT}/{YC_BUCKET_NAME}/{s3_key}"
    logger.info(f"Данные загружены: {s3_key}")
    return url


def download_file(s3_key: str) -> bytes:
    """Скачивание файла из Object Storage."""
    s3 = get_s3()
    try:
        response = s3.get_object(Bucket=YC_BUCKET_NAME, Key=s3_key)
        return response["Body"].read()
    except ClientError as e:
        if e.response["Error"]["Code"] == "NoSuchKey":
            return b""
        raise


def file_exists(s3_key: str) -> bool:
    """Проверка существования файла."""
    s3 = get_s3()
    try:
        s3.head_object(Bucket=YC_BUCKET_NAME, Key=s3_key)
        return True
    except ClientError:
        return False


# ─── Скриншоты ──────────────────────────────────────────────────────
def get_screenshot_key(user_id: int, filename: str) -> str:
    """Получение ключа для скриншота: screenshots/{user_id}/{filename}"""
    return f"{BUCKET_SCREENSHOTS_DIR}/{user_id}/{filename}"


def upload_screenshot(user_id: int, local_path: str, filename: str) -> str:
    """Загрузка скриншота в папку пользователя."""
    s3_key = get_screenshot_key(user_id, filename)
    return upload_file(local_path, s3_key, content_type="image/jpeg")


def get_screenshots_prefix(user_id: int) -> str:
    """Префикс для скриншотов пользователя."""
    return f"{BUCKET_SCREENSHOTS_DIR}/{user_id}/"


def list_user_screenshots(user_id: int) -> list[dict]:
    """Список скриншотов пользователя."""
    s3 = get_s3()
    prefix = get_screenshots_prefix(user_id)
    
    try:
        response = s3.list_objects_v2(
            Bucket=YC_BUCKET_NAME,
            Prefix=prefix,
        )
        files = []
        for obj in response.get("Contents", []):
            key = obj["Key"]
            filename = key.split("/")[-1]
            url = f"{YC_ENDPOINT}/{YC_BUCKET_NAME}/{key}"
            files.append({
                "key": key,
                "filename": filename,
                "url": url,
                "size": obj["Size"],
                "last_modified": obj["LastModified"].isoformat(),
            })
        return files
    except ClientError:
        return []


# ─── CSV-данные ─────────────────────────────────────────────────────
def read_csv(s3_key: str) -> str:
    """Чтение CSV-файла из бакета."""
    data = download_file(s3_key)
    return data.decode("utf-8") if data else ""


def write_csv(s3_key: str, content: str):
    """Запись CSV-файла в бакет."""
    upload_bytes(content.encode("utf-8"), s3_key, content_type="text/csv; charset=utf-8")


def append_to_csv(s3_key: str, line: str):
    """Добавление строки в CSV-файл."""
    current = read_csv(s3_key)
    if not current.endswith("\n") and current:
        current += "\n"
    current += line + "\n"
    write_csv(s3_key, current)


# ─── Инициализация ──────────────────────────────────────────────────
def init_storage():
    """Инициализация хранилища."""
    from config import validate_config
    validate_config()
    ensure_bucket()
    ensure_data_files()
    logger.info("Хранилище инициализировано")
