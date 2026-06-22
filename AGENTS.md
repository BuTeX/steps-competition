# Steps Competition — Контекст проекта для Kimi Code

> Этот файл содержит полный контекст проекта. Перед новой задачей — прочитай его.

---

## Что это за проект

Telegram-бот + веб-дашборд для командного конкурса шагов (фитнес-челлендж).
- Участники отправляют боту количество шагов + скриншот.
- Бот сохраняет всё в Yandex Object Storage (S3) в CSV + файлы скриншотов.
- Дашборд показывает рейтинг, графики, статистику и таблицу дней со скриншотами.
- Деплоится на Railway (бот + API + дашборд в одном контейнере).
- `vite.config.ts` использует `base: "/"`, чтобы asset-файлы грузились по абсолютным путям и SPA-роуты (`/admin`) работали корректно.

---

## Архитектура

```
Telegram-бот (aiogram 3.x)  →  Yandex Object Storage  ←  FastAPI  ←  React Dashboard
  aiogram 3.x                   S3-совместимое            REST API      SPA (Vite)
  Python 3.12                   Бакет: steps-competition   /api/*       / (index.html)
  asyncio в main thread         CSV: data/steps.csv        /api/stats   /admin
  uvicorn в фоновом thread      CSV: data/participants.csv /api/leaderboard
                                                           /api/daily
                                                           /api/daily-matrix
                                                           /api/records
                                                           /api/admin/*
```

### Важное архитектурное решение

- **Бот работает в main thread** (asyncio + aiogram требуют этого).
- **FastAPI/uvicorn работает в фоновом потоке** (`threading.Thread(daemon=True)`).
- Это нужно для Railway: один процесс с одним открытым портом.

### Структура хранения в S3

```
steps-competition (бакет)
├── data/
│   ├── steps.csv              # Все записи о шагах
│   └── participants.csv       # Список участников
└── screenshots/
    └── {ИмяУчастника}_{user_id}/     # Папка участника
        └── {ИмяУчастника}-{ДД.ММ}-{шаги}.jpg
```

Пример файла скриншота:
```
screenshots/VictorDulets_123456/VictorDulets-15.05-10341.jpg
```

### Правило: одна запись на пользователя на день

- `database.add_or_update_step_record` проверяет `UserID + Date`.
- Если запись есть — обновляется (шаги, скриншот, timestamp).
- Если скриншот заменяется — старый файл удаляется из S3.
- Если новый скриншот не передан — старый URL сохраняется.

---

## Структура папок проекта

```
.
├── bot/                       # Python backend (bot + API)
│   ├── main.py               # Точка входа: API в фоне, бот в main thread
│   ├── bot.py                # Telegram-бот (aiogram 3.x)
│   ├── api.py                # FastAPI REST API
│   ├── admin_routes.py       # Административные endpoints
│   ├── database.py           # Работа с CSV в S3
│   ├── storage.py            # Yandex Object Storage (boto3)
│   ├── config.py             # Конфигурация из env-переменных
│   ├── reset_data.py         # Скрипт полной очистки данных
│   ├── requirements.txt      # Python зависимости
│   └── .env.example          # Шаблон переменных
│
├── src/                       # React frontend (dashboard)
│   ├── App.tsx               # Главный компонент + роутинг
│   ├── App.css               # Стили
│   ├── pages/Home.tsx        # Заглушка
│   ├── pages/DashboardPage.tsx # Дашборд
│   ├── pages/AdminPage.tsx   # Панель администратора
│   ├── hooks/useApiData.ts   # Хук для получения данных из API
│   ├── hooks/useAdmin.ts     # Хук для admin API
│   ├── components/
│   │   ├── StatsCards.tsx    # Карточки статистики
│   │   ├── Leaderboard.tsx   # Таблица рейтинга
│   │   ├── ActivityChart.tsx # SVG-график активности
│   │   ├── RecentActivity.tsx # Последние записи
│   │   └── DailyMatrix.tsx   # Таблица участники × дни + скриншоты
│   └── ... (vite, tailwind, shadcn/ui конфиги)
│
├── dist/                     # Собранный дашборд (коммитится для Railway)
├── Dockerfile                # Мультистейдж: Node → Python
├── railway.toml              # Конфиг деплоя на Railway
├── DEPLOY.md                 # Инструкция по деплою
├── README.md                 # Общая документация
├── PROJECT_CONTEXT.md        # Этот файл
└── package.json              # Node зависимости
```

---

## Зависимости

### Python (`bot/requirements.txt`)
```
aiogram==3.17.0          # Telegram бот
boto3==1.35.90           # AWS/Yandex S3
botocore==1.35.90
fastapi==0.115.6         # REST API
uvicorn==0.34.0          # ASGI сервер
python-multipart==0.0.20 # Для FastAPI
python-dotenv==1.0.1     # .env файлы
pydantic==2.10.5         # Валидация
```

### Node.js (`package.json`)
- React 19 + TypeScript + Vite
- Tailwind CSS 3.4 + shadcn/ui
- SVG-графики без внешних библиотек

---

## Переменные окружения

### Обязательные
| Переменная | Описание |
|------------|----------|
| `BOT_TOKEN` | Токен от @BotFather |
| `YC_ACCESS_KEY` | Access key Yandex Object Storage |
| `YC_SECRET_KEY` | Secret key Yandex Object Storage |
| `YC_BUCKET_NAME` | Название бакета (default: steps-competition) |

### Опциональные
| Переменная | Default | Описание |
|------------|---------|----------|
| `YC_REGION` | ru-central1 | Регион Yandex |
| `YC_ENDPOINT` | https://storage.yandexcloud.net | S3 endpoint |
| `API_HOST` | 0.0.0.0 | Хост API |
| `API_PORT` | 8000 | Порт API |
| `PORT` | — | Railway подставляет автоматически |
| `RAILWAY_PUBLIC_DOMAIN` | — | Railway подставляет автоматически |
| `ADMIN_PASSWORD` | — | Пароль для входа в `/admin`. Без него админка недоступна. |

### Локальная разработка
Создать файл `bot/.env` (не коммитить в git!):
```env
BOT_TOKEN=your_token
YC_ACCESS_KEY=your_key
YC_SECRET_KEY=your_secret
YC_BUCKET_NAME=steps-competition

# Админ-панель (опционально)
ADMIN_PASSWORD=your_secure_password
```

---

## Потоки данных и UX

### Управление ботом
- Бот использует reply-меню с кнопками: 📊 Моя статистика, 🏆 Рейтинг, ❓ Помощь, 👣 Отправить шаги.
- Постоянное reply-меню прикрепляется к каждому ответу бота.
- Под сообщениями со статистикой/рейтингом/справкой добавлены inline-кнопки (обновить, открыть дашборд).
- Текстовые команды (`/start`, `/help`, `/my_stats`, `/leaderboard`) оставлены для обратной совместимости.

### Отправка шагов текстом
1. Пользователь отправляет только число, например `8500`.
2. Бот показывает inline-клавиатуру с датами за последние 7 дней.
3. После выбора даты бот записывает/обновляет запись.

### Отправка скриншота + шаги
1. Пользователь отправляет фото.
2. Если в подписи к фото есть число — бот сразу показывает выбор даты.
3. Если подписи нет — бот просит отправить количество шагов текстом, затем показывает выбор даты.
4. Бот загружает скриншот в S3 с именем `Пользователь-ДД.ММ-шаги.jpg` и записывает/обновляет запись.

### Дашборд
- `ActivityChart` — график общих шагов по дням.
- `DailyMatrix` — таблица участники × дни. Клик по числу открывает скриншот.
- `Leaderboard` — общий рейтинг.
- `RecentActivity` — последние записи.
- Автообновление каждые 30 секунд.
- Ссылка на `/admin` в шапке.

### Админ-панель (`/admin`)
- Вход по паролю из `ADMIN_PASSWORD`.
- Редактирование и удаление записей о шагах.
- Создание ZIP-бекапов (`data/steps.csv`, `data/participants.csv`, все скриншоты).
- Скачивание готовых бекапов.
- Подтверждение удаления через модальное окно.

---

## API Endpoints

| Endpoint | Описание |
|----------|----------|
| `GET /api/health` | Healthcheck |
| `GET /api/stats` | Глобальная статистика |
| `GET /api/leaderboard` | Рейтинг участников |
| `GET /api/daily` | Шаги по дням |
| `GET /api/daily-matrix` | Матрица участники × дни + screenshot_url |
| `GET /api/records?limit=N` | Последние записи |
| `GET /api/records/recent?limit=N` | Последние записи для виджета |
| `GET /api/users/{user_id}` | Данные пользователя |
| `GET /api/users/{user_id}/screenshots` | Скриншоты пользователя |

### Admin endpoints (требуют `ADMIN_PASSWORD`)

| Endpoint | Описание |
|----------|----------|
| `POST /api/admin/login` | Вход, устанавливает cookie `admin_session` |
| `POST /api/admin/logout` | Выход |
| `GET /api/admin/me` | Проверка сессии |
| `GET /api/admin/records?limit=&offset=&search=&sort_by=&sort_order=` | Список записей с фильтрами |
| `PUT /api/admin/records` | Редактировать запись (date, steps, notes) |
| `DELETE /api/admin/records` | Удалить запись (+ скриншот) |
| `POST /api/admin/backup` | Создать ZIP-бекап в S3 |
| `GET /api/admin/backups` | Список бекапов |
| `GET /api/admin/backup/download/{backup_id}` | Скачать бекап |

---

## Команды

### Локальная разработка
```bash
# Python backend
cd bot
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py          # Запускает бота + API

# Frontend
cd ..
npm install
npm run dev             # Dev-сервер на http://localhost:5173
npm run build           # Сборка в dist/
```

### Очистка данных
```bash
cd bot
python reset_data.py --yes
```

### Деплой на Railway
```bash
npm run build
git add .
git commit -m "Update"
git push
```

---

## Анализ кода: риски, ошибки и неожиданные сценарии

### Критические / высокий приоритет

1. **Потеря состояния при перезапуске бота**
   - `pending_photos` и `pending_date_selections` хранятся в памяти.
   - Если бот перезапустится между отправкой фото и выбором даты — фото и сессия пропадут.
   - Временные файлы в `screenshots/` могут остаться мусором.

2. **Race condition при одновременной записи**
   - `add_or_update_step_record` читает весь CSV, модифицирует и перезаписывает его.
   - Если два пользователя одновременно пришлют шаги — одна запись может затереть другую.
   - Нет никакой блокировки/атомарности.

3. **Скриншоты могут быть недоступны в дашборде**
   - URL скриншота — прямая ссылка на Yandex Object Storage.
   - Если бакет или объекты приватные, картинка в дашборде не загрузится.
   - Нужно либо публичное чтение бакета, либо presigned URLs.

4. **Смена имени участника ломает путь к старым скриншотам**
   - Папка и имя файла зависят от `DisplayName`.
   - Если пользователь сменит имя в Telegram, новые скриншоты уйдут в новую папку; старые останутся по старому пути, но `DailyMatrix` будет ссылаться на старый URL (работает, если файл не удалён).
   - При удалении старого скриншота при перезаписи `delete_screenshot_by_url` парсит URL — может не сработать, если URL изменится или закодирован по-другому.

5. **Дата по умолчанию — «вчера» может привести к записи в будущее/прошлое**
   - `normalize_date` для `DD.MM` подставляет текущий год.
   - Если сейчас январь, а пользователь пишет `31.12`, запись уйдёт на прошлый год (или на 31 декабря текущего, если год ещё не кончился, но дата уже прошла).
   - Бот не проверяет, что дата в рамках конкурса.

6. **Ограничение выбора даты — только последние 7 дней**
   - Для скриншотов нельзя выбрать дату старше недели.
   - Если пользователь хочет отправить шаги за более ранний день с фото — не получится.

### Средний приоритет

7. **Ограничение Telegram на длину текста кнопки**
   - Текст кнопки `15.06 ✅ (Перезаписать?)` короткий, но если логика изменится, можно превысить лимит Telegram (64 символа).

8. **Callback-сессия не имеет TTL**
   - `pending_date_selections` не очищается по таймауту.
   - Пользователь может нажать старую кнопку через день и перезаписать данные неожиданно.

9. **Нет валидации формата токена в runtime**
   - aiogram валидирует токен при создании `Bot`, но если токен невалиден, бот упадёт на старте.

10. **CSV-экранирование может быть несовместимо с `csv.DictReader`**
    - `database._escape_csv` обрабатывает `,`, `"`, `\n`.
    - Если значение содержит `
` или другие спецсимволы, могут быть проблемы при парсинге.
    - Пользовательские имена из Telegram могут содержать эмодзи и спецсимволы.

11. **`delete_objects` в `reset_all_data` ограничен 1000 объектами**
    - Если скриншотов больше 1000 — скрипт удалит только первую партию.
    - Нужна пагинация.

12. **Авторизация есть только в админке**
    - Основной дашборд и публичные API остаются открытыми.
    - Админ-панель защищена паролем через cookie-сессию; сессии хранятся в памяти и сбрасываются при перезапуске.
    - Без `ADMIN_PASSWORD` админ-руты возвращают 503.

### Низкий приоритет

13. **Не обрабатывается ситуация, когда пользователь отправляет несколько фото подряд**
    - Старое pending-фото удаляется локально, но если за него уже выдали клавиатуру выбора даты — старая клавиатура останется в чате и может работать с новым состоянием.

14. **Старые записи-дубли останутся после ввода новой логики**
    - Пока не запущен `reset_data.py`, в `steps.csv` могут быть дубли `UserID + Date`.
    - `DailyMatrix` берёт последнюю по `Timestamp`, но `leaderboard` и `global_stats` могут суммировать дубли.

15. **Папка `screenshots/` на локальном диске может расти**
    - Временные файлы `pending_*.jpg` должны удаляться, но при аварийном завершении могут остаться.

---

## Правила работы с кодом

1. **Не коммить `.env`** — файл с секретами.
2. **Не коммить `node_modules/`, `venv/`, `.DS_Store`** — есть в `.gitignore`.
3. **После изменений фронтенда запускать `npm run build`** перед `git push`.
4. **Минимальные изменения**: не переписывать логику без причины.
5. **Python**: бот single-threaded asyncio; будь осторожен с `threading` и блокирующими операциями.
6. **CSV**: любое изменение формата `steps.csv`/`participants.csv` требует миграции данных.

---

## Контакты и ссылки

- Railway Dashboard: https://railway.app/dashboard
- Yandex Cloud Console: https://console.yandex.cloud
- BotFather: https://t.me/BotFather
- Деплой: см. DEPLOY.md
