"""
Работа с данными — CSV в Yandex Object Storage.
Использует pandas для удобства.
"""

import csv
import io
import logging
from datetime import datetime

from storage import (
    BUCKET_PARTICIPANTS_FILE,
    BUCKET_STEPS_FILE,
    append_to_csv,
    delete_screenshot_by_url,
    read_csv,
    upload_bytes,
    write_csv,
)

logger = logging.getLogger(__name__)


# ─── Helpers ────────────────────────────────────────────────────────
def _csv_to_list(csv_text: str) -> list[dict]:
    """Парсинг CSV в список словарей."""
    if not csv_text.strip():
        return []
    reader = csv.DictReader(io.StringIO(csv_text))
    return list(reader)


def _list_to_csv(records: list[dict], fieldnames: list[str]) -> str:
    """Сериализация списка словарей в CSV."""
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=fieldnames, lineterminator="\n")
    writer.writeheader()
    writer.writerows(records)
    return output.getvalue()


def _escape_csv(value) -> str:
    """Экранирование значения для CSV."""
    if value is None:
        return ""
    val = str(value)
    if "," in val or '"' in val or "\n" in val:
        val = val.replace('"', '""')
        val = f'"{val}"'
    return val


# ─── Шаги ───────────────────────────────────────────────────────────
STEPS_FIELDS = ["Timestamp", "Username", "UserID", "DisplayName", "Date", "Steps", "ScreenshotURL", "Verified", "Notes"]


def add_step_record(
    timestamp: str,
    username: str,
    user_id: int,
    display_name: str,
    date: str,
    steps: int,
    screenshot_url: str = "",
    verified: str = "No",
    notes: str = "",
) -> dict:
    """Добавление записи о шагах."""
    line = ",".join([
        _escape_csv(timestamp),
        _escape_csv(username),
        _escape_csv(user_id),
        _escape_csv(display_name),
        _escape_csv(date),
        _escape_csv(steps),
        _escape_csv(screenshot_url),
        _escape_csv(verified),
        _escape_csv(notes),
    ])
    append_to_csv(BUCKET_STEPS_FILE, line)
    logger.info(f"Добавлена запись: {display_name} - {date}: {steps} шагов")
    
    return {
        "Timestamp": timestamp,
        "Username": username,
        "UserID": str(user_id),
        "DisplayName": display_name,
        "Date": date,
        "Steps": str(steps),
        "ScreenshotURL": screenshot_url,
        "Verified": verified,
        "Notes": notes,
    }


def add_or_update_step_record(
    timestamp: str,
    username: str,
    user_id: int,
    display_name: str,
    date: str,
    steps: int,
    screenshot_url: str = "",
    verified: str = "No",
    notes: str = "",
) -> tuple[dict, bool]:
    """
    Добавление или обновление записи о шагах.
    Одна запись на пользователя на день — при повторной отправке
    обновляются шаги (скриншот сохраняется, если не передан новый).
    """
    records = get_all_steps()
    new_record = {
        "Timestamp": timestamp,
        "Username": username,
        "UserID": str(user_id),
        "DisplayName": display_name,
        "Date": date,
        "Steps": str(steps),
        "ScreenshotURL": screenshot_url,
        "Verified": verified,
        "Notes": notes,
    }

    updated = False
    for i, record in enumerate(records):
        if (
            str(record.get("UserID", "")) == str(user_id)
            and record.get("Date", "") == date
        ):
            # Сохраняем старый скриншот, если новый не передан
            old_screenshot = record.get("ScreenshotURL", "")
            if not screenshot_url:
                new_record["ScreenshotURL"] = old_screenshot
            elif old_screenshot and old_screenshot != screenshot_url:
                # Удаляем старый скриншот, если заменяем на новый
                delete_screenshot_by_url(old_screenshot)
            records[i] = new_record
            updated = True
            break

    if not updated:
        records.append(new_record)

    write_csv(BUCKET_STEPS_FILE, _list_to_csv(records, STEPS_FIELDS))
    action = "Обновлена" if updated else "Добавлена"
    logger.info(f"{action} запись: {display_name} - {date}: {steps} шагов")

    return new_record, updated


def get_all_steps() -> list[dict]:
    """Получение всех записей о шагах."""
    csv_text = read_csv(BUCKET_STEPS_FILE)
    return _csv_to_list(csv_text)


def get_user_steps(user_id: int) -> list[dict]:
    """Получение шагов конкретного пользователя."""
    all_steps = get_all_steps()
    return [s for s in all_steps if str(s.get("UserID", "")) == str(user_id)]


# ─── Участники ──────────────────────────────────────────────────────
PARTICIPANTS_FIELDS = ["UserID", "Username", "DisplayName", "JoinedAt", "Active"]


def get_or_create_participant(user_id: int, username: str, display_name: str) -> dict:
    """Получение или создание участника."""
    participants = get_all_participants()
    
    for p in participants:
        if str(p.get("UserID", "")) == str(user_id):
            return p
    
    # Создаём нового
    joined_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    new_participant = {
        "UserID": str(user_id),
        "Username": username or "",
        "DisplayName": display_name,
        "JoinedAt": joined_at,
        "Active": "Yes",
    }
    
    line = ",".join([
        _escape_csv(new_participant["UserID"]),
        _escape_csv(new_participant["Username"]),
        _escape_csv(new_participant["DisplayName"]),
        _escape_csv(new_participant["JoinedAt"]),
        _escape_csv(new_participant["Active"]),
    ])
    append_to_csv(BUCKET_PARTICIPANTS_FILE, line)
    logger.info(f"Добавлен участник: {display_name} (ID: {user_id})")
    
    return new_participant


def get_all_participants() -> list[dict]:
    """Получение всех участников."""
    csv_text = read_csv(BUCKET_PARTICIPANTS_FILE)
    return _csv_to_list(csv_text)


# ─── Агрегация ──────────────────────────────────────────────────────
def get_leaderboard() -> list[dict]:
    """Получение рейтинга участников."""
    steps = get_all_steps()
    stats = {}
    
    for record in steps:
        user_id = record.get("UserID", "")
        display_name = record.get("DisplayName", "Unknown")
        steps_val = record.get("Steps", "0")
        
        try:
            steps_num = int(steps_val)
        except (ValueError, TypeError):
            continue
        
        key = str(display_name) if display_name else str(user_id)
        if key not in stats:
            stats[key] = {
                "name": key,
                "user_id": user_id,
                "total_steps": 0,
                "days": 0,
                "max_steps": 0,
                "records": [],
            }
        
        stats[key]["total_steps"] += steps_num
        stats[key]["days"] += 1
        stats[key]["max_steps"] = max(stats[key]["max_steps"], steps_num)
        stats[key]["records"].append(record)
    
    result = list(stats.values())
    for s in result:
        s["avg_steps"] = round(s["total_steps"] / s["days"]) if s["days"] > 0 else 0
    
    return sorted(result, key=lambda x: x["total_steps"], reverse=True)


def get_daily_stats() -> list[dict]:
    """Получение статистики по дням."""
    steps = get_all_steps()
    date_map = {}
    
    for record in steps:
        date = record.get("Date", "")
        steps_val = record.get("Steps", "0")
        
        try:
            steps_num = int(steps_val)
        except (ValueError, TypeError):
            continue
        
        if date not in date_map:
            date_map[date] = {"date": date, "total_steps": 0, "participants": 0}
        
        date_map[date]["total_steps"] += steps_num
        date_map[date]["participants"] += 1
    
    return sorted(date_map.values(), key=lambda x: x["date"])


def get_user_stats(user_id: int) -> dict | None:
    """Получение статистики пользователя."""
    user_steps = get_user_steps(user_id)
    if not user_steps:
        return None
    
    steps_list = []
    for s in user_steps:
        try:
            steps_list.append(int(s.get("Steps", 0)))
        except (ValueError, TypeError):
            pass
    
    if not steps_list:
        return None
    
    participants = get_all_participants()
    user_name = "Unknown"
    for p in participants:
        if str(p.get("UserID", "")) == str(user_id):
            user_name = p.get("DisplayName", p.get("Username", "Unknown"))
            break
    
    return {
        "user_id": user_id,
        "name": user_name,
        "total_steps": sum(steps_list),
        "days": len(steps_list),
        "avg_steps": round(sum(steps_list) / len(steps_list)),
        "max_steps": max(steps_list),
        "records": sorted(user_steps, key=lambda x: x.get("Date", ""), reverse=True),
    }


def get_global_stats() -> dict:
    """Получение глобальной статистики."""
    steps = get_all_steps()
    participants = get_all_participants()
    daily = get_daily_stats()
    
    total_steps = 0
    for s in steps:
        try:
            total_steps += int(s.get("Steps", 0))
        except (ValueError, TypeError):
            pass
    
    return {
        "total_steps": total_steps,
        "total_participants": len(participants),
        "total_records": len(steps),
        "active_days": len(daily),
        "avg_steps_per_day": round(total_steps / len(daily)) if daily else 0,
    }
