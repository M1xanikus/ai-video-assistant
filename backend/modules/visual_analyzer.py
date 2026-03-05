import cv2
import torch
from PIL import Image
from transformers import AutoModelForCausalLM, AutoTokenizer
import os
import gc


def analyze_video_scenes(video_path, timestamps):
    """
    Принимает путь к видео и список таймкодов.
    Загружает Moondream2 в RAM, описывает кадры и полностью выгружает модель.
    """
    if not os.path.exists(video_path):
        return []

    # Определяем устройство (GPU если есть, иначе CPU)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model_id = "vikhyatk/moondream2"
    revision = "2024-08-26"

    model = None
    tokenizer = None
    results = []

    try:
        # 1. ЗАГРУЗКА МОДЕЛИ В RAM ПЕРЕД ВЫПОЛНЕНИЕМ
        print(f"--- Loading Moondream2 into RAM on {device}... ---")
        model = AutoModelForCausalLM.from_pretrained(
            model_id,
            trust_remote_code=True,
            revision=revision
        ).to(device)
        tokenizer = AutoTokenizer.from_pretrained(model_id, revision=revision)

        # 2. ВЫПОЛНЕНИЕ АНАЛИЗА
        cap = cv2.VideoCapture(video_path)

        for ts in timestamps:
            cap.set(cv2.CAP_PROP_POS_MSEC, ts * 1000)
            success, frame = cap.read()

            if success:
                # Конвертация кадра для PIL
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                image = Image.fromarray(frame_rgb)

                try:
                    with torch.no_grad():
                        image_embeds = model.encode_image(image)
                        caption = model.answer_question(
                            image_embeds,
                            "Describe this scene in one concise sentence, focusing on main characters and actions.",
                            tokenizer
                        )

                    results.append({
                        "timecode": ts,
                        "description": caption.strip()
                    })
                    print(f"Frame at {ts}s: {caption.strip()}")
                except Exception as e:
                    print(f"Error processing frame at {ts}s: {e}")

        cap.release()
        return results

    except Exception as e:
        print(f"Visual Analysis failed: {e}")
        raise e

    finally:
        # 3. ПОЛНАЯ ВЫГРУЗКА ИЗ ПАМЯТИ
        if model is not None:
            print("--- Unloading Moondream2 and clearing RAM... ---")
            # Перемещаем на CPU перед удалением
            model.cpu()
            del model
            del tokenizer

            # Очистка мусора Python
            gc.collect()

            # Очистка кэша PyTorch/CUDA
            if torch.cuda.is_available():
                torch.cuda.empty_cache()

            print("--- RAM cleared successfully ---")


def extract_frame(video_path, timestamp_seconds):
    """
    Вспомогательная функция (теперь используется внутри analyze_video_scenes
    через прямой захват VideoCapture для оптимизации ресурсов)
    """
    cap = cv2.VideoCapture(video_path)
    cap.set(cv2.CAP_PROP_POS_MSEC, timestamp_seconds * 1000)
    success, frame = cap.read()
    cap.release()
    if success:
        return Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    return None