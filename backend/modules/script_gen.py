from openai import OpenAI
import os
import json
import re

# Настройка клиента для OpenRouter
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.environ.get("OPENROUTER_API_KEY"),  # Убедись, что ключ в .env или docker-compose
)


def generate_recap_script(transcript_text: str, visual_scenes: str):
    """
    Анализирует текст и визуальные сцены через DeepSeek R1 и возвращает JSON.
    """

    prompt = f"""
    Ты — профессиональный кинорежиссер и сценарист. Твоя задача: создать сценарий для захватывающего рекапа видео.

    Входные данные:
    1. ТРАНСКРИПТ (что говорят):
    {transcript_text}

    2. ВИЗУАЛЬНЫЙ АНАЛИЗ (что происходит в кадре):
    {visual_scenes}

    Твои инструкции:
    1. Выбери 5-8 самых важных моментов, основываясь на визуальных сценах и тексте.
    2. Для каждого момента укажи точные границы (start_time, end_time), основываясь на таймкодах.
    3. Напиши текст для диктора (narrator_text), который будет звучать за кадром. Текст должен быть на русском языке.
    4. Текст должен логически связывать выбранные фрагменты.

    Ответ верни СТРОГО в формате JSON без лишнего текста:
    {{
      "segments": [
        {{
          "id": "1",
          "start_time": 12.0,
          "end_time": 18.5,
          "narrator_text": "Здесь должен быть текст озвучки"
        }}
      ]
    }}
    """

    try:
        completion = client.chat.completions.create(
            extra_headers={
                "HTTP-Referer": "http://localhost:3000",  # Для рейтинга OpenRouter
                "X-OpenRouter-Title": "AI Cut Assistant",
            },
            model="deepseek/deepseek-r1:free",
            messages=[
                {"role": "user", "content": prompt}
            ]
        )

        full_content = completion.choices[0].message.content

        # ОЧИСТКА ОТВЕТА: DeepSeek R1 выдает мысли в <think>...</think>. Удаляем их.
        clean_content = re.sub(r'<think>.*?</think>', '', full_content, flags=re.DOTALL).strip()

        # Удаляем markdown-разметку JSON если она есть
        clean_content = clean_content.replace('```json', '').replace('```', '').strip()

        data = json.loads(clean_content)
        return data

    except Exception as e:
        print(f"OpenRouter Error: {e}")
        # Если ИИ выдал ошибку, возвращаем пустой шаблон, чтобы фронт не упал
        return {"segments": []}