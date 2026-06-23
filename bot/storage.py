"""
Работа с Yandex Object Storage через S3 API.
Скриншоты хранятся в папках: screenshots/{имя_участника}_{user_id}/{ДД.ММ-количество_шагов}.jpg
"""

import io
import logging
import re
import urllib.parse
import zipfile
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


def delete_file(s3_key: str):
    """Удаление файла из Object Storage."""
    s3 = get_s3()
    try:
        s3.delete_object(Bucket=YC_BUCKET_NAME, Key=s3_key)
        logger.info(f"Файл удалён: {s3_key}")
    except ClientError as e:
        logger.error(f"Ошибка удаления файла {s3_key}: {e}")


def file_exists(s3_key: str) -> bool:
    """Проверка существования файла."""
    s3 = get_s3()
    try:
        s3.head_object(Bucket=YC_BUCKET_NAME, Key=s3_key)
        return True
    except ClientError:
        return False


# ─── Скриншоты ──────────────────────────────────────────────────────
def _safe_name(name: str) -> str:
    """Безопасное имя папки: буквы, цифры, дефисы."""
    safe = re.sub(r"[^\w\s-]", "", name, flags=re.UNICODE)
    safe = re.sub(r"[-\s]+", "-", safe).strip("-")
    return safe or "unknown"


def _user_folder(display_name: str, user_id: int) -> str:
    """Папка пользователя: имя + id для уникальности."""
    return f"{_safe_name(display_name)}_{user_id}"


def get_screenshot_key(user_id: int, display_name: str, filename: str) -> str:
    """Получение ключа для скриншота."""
    folder = _user_folder(display_name, user_id)
    return f"{BUCKET_SCREENSHOTS_DIR}/{folder}/{filename}"


def upload_screenshot(user_id: int, local_path: str, filename: str, display_name: str = "") -> str:
    """Загрузка скриншота в папку пользователя (deprecated, лучше upload_screenshot_for_record)."""
    s3_key = get_screenshot_key(user_id, display_name or str(user_id), filename)
    return upload_file(local_path, s3_key, content_type="image/jpeg")


def upload_screenshot_for_record(
    user_id: int,
    display_name: str,
    date_str: str,
    steps: int,
    local_path: str,
) -> str:
    """Загрузка скриншота с именем Пользователь-ДД.ММ-количество_шагов.jpg."""
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    dd_mm = dt.strftime("%d.%m")
    filename = f"{_safe_name(display_name)}-{dd_mm}-{steps}.jpg"
    s3_key = get_screenshot_key(user_id, display_name, filename)
    return upload_file(local_path, s3_key, content_type="image/jpeg")


def upload_screenshot_bytes(
    user_id: int,
    display_name: str,
    date_str: str,
    steps: int,
    data: bytes,
    content_type: str = "image/jpeg",
) -> str:
    """Загрузка скриншота из байтов с именем Пользователь-ДД.ММ-количество_шагов.jpg."""
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    dd_mm = dt.strftime("%d.%m")
    filename = f"{_safe_name(display_name)}-{dd_mm}-{steps}.jpg"
    s3_key = get_screenshot_key(user_id, display_name, filename)
    return upload_bytes(data, s3_key, content_type=content_type)


def get_screenshot_key_from_url(url: str) -> str | None:
    """Извлечение S3-ключа из прямого URL скриншота."""
    if not url:
        return None
    prefix = f"{YC_ENDPOINT}/{YC_BUCKET_NAME}/"
    if not url.startswith(prefix):
        return None
    key = url[len(prefix):]
    key = urllib.parse.unquote(key)
    return key


def download_screenshot_by_url(url: str) -> bytes:
    """Скачивание скриншота по его URL."""
    key = get_screenshot_key_from_url(url)
    if not key:
        return b""
    return download_file(key)


def delete_screenshot_by_url(url: str):
    """Удаление скриншота по его URL."""
    if not url:
        return
    prefix = f"{YC_ENDPOINT}/{YC_BUCKET_NAME}/"
    if not url.startswith(prefix):
        return
    key = url[len(prefix):]
    key = urllib.parse.unquote(key)
    delete_file(key)


def get_screenshots_prefix(user_id: int, display_name: str = "") -> str:
    """Префикс для скриншотов пользователя."""
    if display_name:
        folder = _user_folder(display_name, user_id)
        return f"{BUCKET_SCREENSHOTS_DIR}/{folder}/"
    return f"{BUCKET_SCREENSHOTS_DIR}/"


def list_user_screenshots(user_id: int, display_name: str = "") -> list[dict]:
    """Список скриншотов пользователя."""
    s3 = get_s3()
    prefix = get_screenshots_prefix(user_id, display_name)
    suffix = f"_{user_id}/"
    
    try:
        response = s3.list_objects_v2(
            Bucket=YC_BUCKET_NAME,
            Prefix=prefix,
        )
        files = []
        for obj in response.get("Contents", []):
            key = obj["Key"]
            # Если имя не передано, фильтруем по суффиксу папки _{user_id}/
            if not display_name and suffix not in key:
                continue
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


# ─── Сброс данных ───────────────────────────────────────────────────
def reset_all_data():
    """Полная очистка всех внесённых данных (steps, participants, screenshots)."""
    s3 = get_s3()

    # Очищаем CSV-файлы
    steps_headers = "Timestamp,Username,UserID,DisplayName,Date,Steps,ScreenshotURL,Verified,Notes\n"
    write_csv(BUCKET_STEPS_FILE, steps_headers)
    logger.info(f"Очищен файл {BUCKET_STEPS_FILE}")

    participants_headers = "UserID,Username,DisplayName,JoinedAt,Active\n"
    write_csv(BUCKET_PARTICIPANTS_FILE, participants_headers)
    logger.info(f"Очищен файл {BUCKET_PARTICIPANTS_FILE}")

    # Удаляем все скриншоты
    try:
        response = s3.list_objects_v2(
            Bucket=YC_BUCKET_NAME,
            Prefix=f"{BUCKET_SCREENSHOTS_DIR}/",
        )
        objects = response.get("Contents", [])
        if objects:
            s3.delete_objects(
                Bucket=YC_BUCKET_NAME,
                Delete={"Objects": [{"Key": obj["Key"]} for obj in objects]},
            )
            logger.info(f"Удалено скриншотов: {len(objects)}")
        else:
            logger.info("Скриншотов для удаления не найдено")
    except ClientError as e:
        logger.error(f"Ошибка удаления скриншотов: {e}")


# ─── Бекапы ─────────────────────────────────────────────────────────
def _list_all_objects(prefix: str) -> list[dict]:
    """Пагинированный список всех объектов в бакете по префиксу."""
    s3 = get_s3()
    objects = []
    continuation_token = None
    while True:
        kwargs = {"Bucket": YC_BUCKET_NAME, "Prefix": prefix}
        if continuation_token:
            kwargs["ContinuationToken"] = continuation_token
        response = s3.list_objects_v2(**kwargs)
        objects.extend(response.get("Contents", []))
        if not response.get("IsTruncated"):
            break
        continuation_token = response.get("NextContinuationToken")
    return objects


def create_backup() -> dict:
    """Создание ZIP-бекапа: CSV-файлы + все скриншоты. Возвращает метаинформацию."""
    s3 = get_s3()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_id = f"backup_{timestamp}.zip"
    backup_key = f"backups/{backup_id}"

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        # CSV-файлы
        for key, arcname in [
            (BUCKET_STEPS_FILE, "data/steps.csv"),
            (BUCKET_PARTICIPANTS_FILE, "data/participants.csv"),
        ]:
            data = download_file(key)
            if data:
                zf.writestr(arcname, data.decode("utf-8"))

        # Скриншоты
        screenshots = _list_all_objects(f"{BUCKET_SCREENSHOTS_DIR}/")
        for obj in screenshots:
            key = obj["Key"]
            data = download_file(key)
            if data:
                zf.writestr(key, data)

    buffer.seek(0)
    upload_bytes(buffer.getvalue(), backup_key, content_type="application/zip")
    logger.info(f"Создан бекап: {backup_key}")

    return {
        "backup_id": backup_id,
        "key": backup_key,
        "url": f"{YC_ENDPOINT}/{YC_BUCKET_NAME}/{backup_key}",
        "created_at": datetime.now().isoformat(),
        "size": buffer.tell(),
    }


def list_backups() -> list[dict]:
    """Список созданных бекапов."""
    backups = _list_all_objects("backups/")
    result = []
    for obj in backups:
        key = obj["Key"]
        filename = key.split("/")[-1]
        if not filename.endswith(".zip"):
            continue
        result.append({
            "backup_id": filename,
            "key": key,
            "url": f"{YC_ENDPOINT}/{YC_BUCKET_NAME}/{key}",
            "created_at": obj["LastModified"].isoformat(),
            "size": obj["Size"],
        })
    return sorted(result, key=lambda x: x["created_at"], reverse=True)


def download_backup(backup_id: str) -> bytes:
    """Скачивание бекапа по ID."""
    key = f"backups/{backup_id}"
    return download_file(key)


# ─── Инициализация ──────────────────────────────────────────────────
def init_storage():
    """Инициализация хранилища."""
    from config import validate_config
    validate_config()
    ensure_bucket()
    ensure_data_files()
    logger.info("Хранилище инициализировано")
