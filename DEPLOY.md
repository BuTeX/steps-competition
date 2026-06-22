# Деплой на Railway (бот + дашборд + API)

## Что будет после деплоя

| Компонент | URL | Описание |
|-----------|-----|----------|
| **Дашборд** | `https://<твой-проект>.railway.app` | Веб-страница с рейтингом |
| **API** | `https://<твой-проект>.railway.app/api/...` | REST API |
| **Админ-панель** | `https://<твой-проект>.railway.app/admin` | Управление записями и бекапами |
| **Бот** | работает в main thread (asyncio) | Telegram-бот |

---

## Шаг 1: Подготовка кода

### 1.1 Создай аккаунт на GitHub
Если ещё нет: https://github.com/signup

### 1.2 Загрузи проект на GitHub

```bash
# В терминале, в папке проекта
cd /Users/viktordulec/Yandex.Disk-v.dulec.localized/app

# Инициализируй Git
rm -rf .git  # на всякий случай, если есть старый
git init

# Добавь все файлы
git add .

# Создай коммит
git commit -m "Initial commit"

# Создай репозиторий на GitHub (вручную через сайт) и свяжи:
git remote add origin https://github.com/ТВОЙ_НИКНЕЙМ/steps-competition.git

# Загрузи
git push -u origin main
```

> Если команда выше не работает, попробуй `git branch -M main` перед `git push`.

---

## Шаг 2: Настройка Railway

### 2.1 Регистрация

1. Зайди на https://railway.app
2. Нажми **"Start for Free"**
3. Залогинься через **GitHub**

### 2.2 Создание проекта

1. Нажми **"New Project"**
2. Выбери **"Deploy from GitHub repo"**
3. Найди свой репозиторий `steps-competition`
4. Railway автоматически найдёт Dockerfile и начнёт деплой

### 2.3 Переменные окружения (ВАЖНО!)

1. В проекте Railway перейди во вкладку **"Variables"**
2. Нажми **"New Variable"** и добавь каждую:

| Переменная | Значение |
|------------|----------|
| `BOT_TOKEN` | Твой токен от @BotFather |
| `YC_ACCESS_KEY` | Access key из Yandex Cloud |
| `YC_SECRET_KEY` | Secret key из Yandex Cloud |
| `YC_BUCKET_NAME` | Название бакета (например `steps-competition`) |
| `YC_REGION` | `ru-central1` |
| `YC_ENDPOINT` | `https://storage.yandexcloud.net` |
| `ADMIN_PASSWORD` (опц.) | Пароль для `/admin` |

> Railway **автоматически** добавит переменную `PORT` и `RAILWAY_PUBLIC_DOMAIN`.

3. Переменные `API_HOST`, `API_PORT` можно не добавлять — значения по умолчанию подходят.

### 2.4 Деплой

1. Перейди во вкладку **"Deployments"**
2. Railway автоматически соберёт и запустит проект
3. Жди пока статус станет **"Healthy"** (зелёная галочка)

### 2.5 Публичный домен

1. Перейди во вкладку **"Settings"**
2. В разделе **"Environment"** → **"Domains"**
3. Railway даст тебе домен вида `steps-competition-production.up.railway.app`
4. Можешь добавить свой домен (опционально)

---

## Шаг 3: Проверка

### Дашборд
Открой в браузере:
```
https://<твой-домен>.railway.app
```

Должен открыться дашборд с рейтингом.

### API
Проверь работу API:
```
https://<твой-домен>.railway.app/api/health
```
Должен вернуть: `{"status": "ok", ...}`

### Админ-панель
Если задан `ADMIN_PASSWORD`, открой:
```
https://<твой-домен>.railway.app/admin
```
Войди с паролем — там можно редактировать записи, удалять их и создавать ZIP-бекапы.

### Бот
Напиши своему боту в Telegram:
- `/start` — должен ответить приветствием
- `8500` — должен записать шаги

---

## Переменные окружения (итоговый список)

Вот все переменные, которые должны быть в Railway:

```
BOT_TOKEN=123456789:ABCdefGHIjkl...
YC_ACCESS_KEY=YCAJE...
YC_SECRET_KEY=YCPkK...
YC_BUCKET_NAME=steps-competition
YC_REGION=ru-central1
YC_ENDPOINT=https://storage.yandexcloud.net
ADMIN_PASSWORD=your_secure_password
```

Railway автоматически добавит:
```
PORT=8000
RAILWAY_PUBLIC_DOMAIN=твой-домен.railway.app
```

---

## Обновление кода

После внесения изменений в код:

```bash
cd /Users/viktordulec/Yandex.Disk-v.dulec.localized/app
git add .
git commit -m "Описание изменений"
git push
```

Railway **автоматически** пересоберёт и перезапустит проект.

---

## Если что-то не работает

### Смотри логи
В Railway: вкладка **"Deployments"** → кликни на деплой → **"View Logs"**

### Частые ошибки

| Ошибка | Решение |
|--------|---------|
| `ModuleNotFoundError` | Переменные окружения не заданы, проверь вкладку Variables |
| `NoCredentialsError` | Yandex ключи неверные, перепроверь YC_ACCESS_KEY и YC_SECRET_KEY |
| `NoSuchBucket` | Бакет не создан в Yandex Object Storage |
| `Bot not responding` | Проверь что BOT_TOKEN верный, бот запущен в main thread |

---

## Стоимость Railway

| Тариф | Цена | Что включено |
|-------|------|-------------|
| **Hobby** | $5/мес | 2 сервиса, постоянный URL, приоритетная поддержка |
| **Free** | $0 | Ограничения по ресурсам, спит при неактивности |

Для нашего проекта подойдёт **Free** — бот будет работать пока есть трафик.

---

**Готово!** После деплоя у тебя будет:
- 🤖 Бот в Telegram (работает 24/7)
- 📊 Дашборд по ссылке (открывается в браузере)
- ☁️ Все данные в Yandex Object Storage
