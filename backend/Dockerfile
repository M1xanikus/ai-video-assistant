FROM python:3.10-slim

# Устанавливаем системные зависимости
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Переменные окружения
ENV PIP_NO_CACHE_DIR=0 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Копируем requirements.txt первым для кэширования
COPY requirements.txt .

# Устанавливаем пакеты
RUN pip install --upgrade pip && \
    pip install -r requirements.txt --no-cache-dir

# Копируем скрипт предзагрузки моделей (ПРАВИЛЬНЫЙ ПУТЬ!)
COPY modules/preload_models.py /app/modules/preload_models.py

# Копируем остальной код
COPY . .

# Создаем рабочие папки
RUN mkdir -p uploads outputs temp_audio audio_cache

EXPOSE 8000

# Запускаем предзагрузку моделей и потом сервер
CMD ["sh", "-c", "python /app/modules/preload_models.py && uvicorn main:app --host 0.0.0.0 --port 8000"]