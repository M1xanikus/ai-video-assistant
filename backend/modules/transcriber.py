import whisper
import os
import torch
import gc


def transcribe_video(file_path: str):
    """
    Транскрибация видео: загрузка модели -> выполнение -> выгрузка из RAM.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    # Определяем устройство (GPU если есть, иначе CPU)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = None

    try:
        # 1. ЗАГРУЗКА МОДЕЛИ В RAM
        print(f"--- Loading Whisper [small] into RAM on {device}... ---")
        model = whisper.load_model("small", device=device)

        print(f"--- Processing audio: {file_path} ---")

        # 2. ВЫПОЛНЕНИЕ ЗАДАЧИ
        # language="ru" — фиксируем язык
        # fp16=False — для стабильности на CPU
        result = model.transcribe(
            file_path,
            language="ru",
            verbose=False,
            fp16=False if device == "cpu" else True
        )

        formatted_transcript = []
        for i, segment in enumerate(result['segments']):
            formatted_transcript.append({
                "id": f"t{i + 1}",
                "timecode": round(segment['start'], 2),
                "text": segment['text'].strip()
            })

        return formatted_transcript

    except Exception as e:
        print(f"Transcription error: {e}")
        raise e

    finally:
        # 3. ВЫГРУЗКА ИЗ ПАМЯТИ
        if model is not None:
            print("--- Unloading Whisper model from RAM... ---")
            # Перемещаем модель на CPU перед удалением (важно для GPU)
            model.cpu()
            del model

            # Принудительный запуск сборщика мусора Python
            gc.collect()

            # Очистка кэша CUDA (если используется видеокарта)
            if torch.cuda.is_available():
                torch.cuda.empty_cache()

            print("--- RAM cleared successfully ---")