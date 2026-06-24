# ─── Build stage: Frontend ──────────────────────────────────────────
FROM node:20-alpine AS frontend

WORKDIR /app
COPY package*.json ./
RUN npm install

# Копируем только файлы, необходимые для сборки фронтенда
COPY src/ ./src/
COPY public/ ./public/
COPY index.html ./
COPY vite.config.ts ./
COPY tsconfig*.json ./
COPY postcss.config.js ./
COPY tailwind.config.js ./
COPY components.json ./
COPY eslint.config.js ./
COPY package.json ./
RUN npm run build

# ─── Production stage: Python + Bot + API + Dashboard ──────────────
FROM python:3.12-slim

# Создаём непривилегированного пользователя
RUN groupadd -r appuser && useradd -r -g appuser appuser

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

# Переводим владение файлами на непривилегированного пользователя
RUN chown -R appuser:appuser /app

USER appuser

# Environment
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# Порт (Railway подставит свою переменную PORT)
EXPOSE 8000

# Запуск: бот + API-сервер
CMD ["python", "bot/main.py"]
