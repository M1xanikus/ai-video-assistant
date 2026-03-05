# scripts/preload_models.py
import os
import whisper
from transformers import AutoModelForCausalLM, AutoTokenizer
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def preload_whisper():
    """Загружает модель Whisper если её нет в кэше"""
    model_name = "small"
    try:
        logger.info(f"Checking Whisper model '{model_name}'...")
        model = whisper.load_model(model_name, download_root="/app/models/whisper")
        logger.info(f"✓ Whisper '{model_name}' ready")
    except Exception as e:
        logger.warning(f"⚠ Could not preload Whisper: {e}")


def preload_moondream():
    """Загружает Moondream2 если его нет в кэше"""
    model_id = 'vikhyatk/moondream2'
    revision = '2024-08-26'
    cache_dir = "/app/models/moondream"

    try:
        logger.info(f"Checking Moondream2 model...")
        # Проверяем наличие в кэше
        AutoTokenizer.from_pretrained(model_id, revision=revision, cache_dir=cache_dir)
        AutoModelForCausalLM.from_pretrained(
            model_id,
            trust_remote_code=True,
            revision=revision,
            cache_dir=cache_dir
        )
        logger.info(f"✓ Moondream2 ready")
    except Exception as e:
        logger.warning(f"⚠ Could not preload Moondream2: {e}")


if __name__ == "__main__":
    logger.info("🔄 Preloading AI models (first run may take a while)...")

    # Создаём папки для моделей
    os.makedirs("/app/models/whisper", exist_ok=True)
    os.makedirs("/app/models/moondream", exist_ok=True)

    preload_whisper()
    preload_moondream()

    logger.info("✨ Model preloading complete")