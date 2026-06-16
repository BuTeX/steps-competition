# ─── Build stage: Frontend ──────────────────────────────────────────
FROM node:20-alpine AS frontend

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# ─── Production stage: Python + Bot + API + Dashboard ──────────────
FROM python:3.12-slim

WORKDIR /app

# Установка системных зависимостей
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Python зависимости
COPY bot/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем код бота
COPY bot/ ./bot/

# Копируем собранный дашборд из frontend stage
COPY --from=frontend /app/dist /app/dist

# Environment
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# Порт (Railway подставит свою переменную PORT)
EXPOSE 8000

# Запуск: бот + API-сервер
CMD ["python", "bot/main.py"]
