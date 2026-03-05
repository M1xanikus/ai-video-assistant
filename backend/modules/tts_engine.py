# modules/tts_engine.py

import edge_tts
import os
import subprocess
from pathlib import Path
import hashlib
import mutagen

VOICE_MAP = {
    # Русские голоса — более живые, с интонацией
    "male-ru-1":   "ru-RU-DmitryNeural",    # стандартный мужской
    "male-ru-2":   "ru-RU-DmitryNeural",    # тот же, лучший доступный
    "female-ru-1": "ru-RU-SvetlanaNeural",  # стандартный женский

    # Английские голоса — самые живые в edge-tts
    "male-en-1":   "en-US-AndrewNeural",    # живой, с эмоцией
    "male-en-2":   "en-US-BrianNeural",     # молодой, энергичный — лучший для TikTok
    "female-en-1": "en-US-AvaNeural",       # живой женский US
    "female-en-2": "en-GB-SoniaNeural",     # британский женский
    "female-en-3": "en-US-EmmaNeural",      # молодой женский, естественный
}


async def synthesize_voice(
        text: str,
        voice_key: str = "ru-RU-DmitryNeural",
        speed: float = 1.0,
        pitch: float = 0.0
) -> str:
    """Генерирует TTS аудио одним файлом (legacy режим).
    Используем чуть сниженный pitch для более натурального звучания.
    """
    voice_key = VOICE_MAP.get(voice_key, voice_key)
    Path("temp_audio").mkdir(exist_ok=True)

    file_hash = hashlib.md5(f"{text}_{voice_key}_{speed}".encode()).hexdigest()[:12]
    output_path = f"temp_audio/voice_{file_hash}.mp3"

    rate_str  = _speed_to_rate_str(speed)
    pitch_str = _pitch_to_str(pitch)

    print(f"🎤 TTS legacy: {len(text)} chars, voice={voice_key}, speed={speed}x")

    communicate = edge_tts.Communicate(text, voice_key, rate=rate_str, volume="+0%", pitch=pitch_str)
    await communicate.save(output_path)

    if os.path.exists(output_path):
        audio = mutagen.File(output_path)
        duration = audio.info.length if audio else 0
        print(f"✅ TTS generated: {output_path} ({duration:.2f}s)")
        return output_path
    raise Exception("TTS generation failed")


async def synthesize_voice_for_clips(
        segments: list[dict],
        voice_key: str = "ru-RU-DmitryNeural",
        base_speed: float = 1.2,      # чуть медленнее → естественнее (было 1.3)
        pitch: float = -2.0           # лёгкое понижение тона → менее синтетично (было 0.0)
) -> list[dict]:
    """
    Генерирует отдельный аудиофайл для каждого клипа.

    FIXED: использует edge_tts WordBoundary события для точных
    субтитровых таймингов вместо эвристического равномерного распределения.
    Каждое слово получает точный offset_ms и duration_ms от TTS-движка.
    """
    voice_key = VOICE_MAP.get(voice_key, voice_key)
    Path("temp_audio").mkdir(exist_ok=True)

    results = []

    for i, seg in enumerate(segments):
        text = seg.get('text', '').strip()
        tts_text = _make_natural_text(text)   # TTS-версия с паузами, субтитры — из text
        clip_id = seg.get('id', f'clip-{i}')
        clip_start = seg.get('startTime', 0)
        clip_end = seg.get('endTime', 0)
        clip_duration = clip_end - clip_start

        if not text or clip_duration <= 0:
            print(f"⚠️ Skipping empty segment {i}")
            continue

        rate_str = _speed_to_rate_str(base_speed)
        pitch_str = _pitch_to_str(pitch)

        file_hash = hashlib.md5(f"{text}_{voice_key}_{base_speed}_{clip_id}".encode()).hexdigest()[:10]
        output_path = f"temp_audio/clip_{clip_id}_{file_hash}.mp3"

        print(f"🎤 [{i+1}/{len(segments)}] '{text[:40]}...' speed={base_speed}x")

        try:
            # ── Стримим аудио + собираем точные WordBoundary тайминги ──────────
            audio_bytes = bytearray()
            word_boundaries: list[dict] = []

            communicate = edge_tts.Communicate(
                tts_text, voice_key,   # tts_text — с паузами для живости
                rate=rate_str,
                volume="+0%",
                pitch=pitch_str
            )

            async for event in communicate.stream():
                if event["type"] == "audio":
                    audio_bytes.extend(event["data"])
                elif event["type"] == "WordBoundary":
                    # offset и duration в единицах 100 нс → переводим в мс
                    word_boundaries.append({
                        "text":        event["text"],
                        "offset_ms":   event["offset"]   / 10_000.0,
                        "duration_ms": event["duration"] / 10_000.0,
                    })

            if not audio_bytes:
                print(f"❌ Empty audio stream for clip {clip_id}")
                continue

            with open(output_path, "wb") as f:
                f.write(audio_bytes)

            # ── Нормализация до -14 LUFS (стандарт TikTok/Reels) ────────────
            normalized_path = f"temp_audio/norm_{clip_id}_{file_hash}.mp3"
            if _normalize_audio(output_path, normalized_path):
                os.replace(normalized_path, output_path)

            audio_meta = mutagen.File(output_path)
            actual_duration = audio_meta.info.length if audio_meta else 0

            # ── Строим субтитровые группы с точными таймингами ──────────────
            subtitles = _build_subtitle_groups(
                word_boundaries=word_boundaries,
                audio_duration=actual_duration,
                words_per_group=3,
                raw_text=text           # оригинальный текст для субтитров (без TTS-пауз)
            )

            results.append({
                'clip_id':    clip_id,
                'audio_path': output_path,
                'duration':   actual_duration,
                'clip_start': clip_start,
                'clip_end':   clip_end,
                'text':       text,
                'speed_used': round(base_speed, 2),
                'subtitles':  subtitles,
            })

            print(f"✅ [{i+1}] audio={actual_duration:.2f}s | {len(word_boundaries)} words | {len(subtitles)} subtitle groups")

        except Exception as e:
            print(f"❌ Failed clip {clip_id}: {e}")
            import traceback; traceback.print_exc()
            continue

    return results


# ════════════════════════════════════════════════════════════════════════════
# Subtitle helpers
# ════════════════════════════════════════════════════════════════════════════

def _build_subtitle_groups(
        word_boundaries: list[dict],
        audio_duration: float,
        words_per_group: int,
        raw_text: str = ""
) -> list[dict]:
    """
    Группирует слова по words_per_group штук, каждая группа имеет
    точный start/end (в секундах) из WordBoundary событий.

    Если word_boundaries пустой — fallback на равномерное распределение.
    """
    if not word_boundaries:
        # Fallback: равномерно по словам из текста
        words = raw_text.split() if raw_text else []
        return _fallback_subtitle_groups(words, audio_duration, words_per_group)

    groups = []
    n = len(word_boundaries)

    for gi in range(0, n, words_per_group):
        chunk = word_boundaries[gi: gi + words_per_group]
        if not chunk:
            continue

        start_sec = chunk[0]["offset_ms"] / 1000.0
        last = chunk[-1]
        end_sec = (last["offset_ms"] + last["duration_ms"]) / 1000.0
        # Небольшой хвост чтобы последний слог не обрезался
        end_sec = min(end_sec + 0.06, audio_duration)

        groups.append({
            "text":  " ".join(w["text"] for w in chunk),
            "start": round(start_sec, 3),
            "end":   round(end_sec, 3),
            # Точные тайминги отдельных слов внутри группы (для karaoke)
            "words": [
                {
                    "text":  w["text"],
                    "start": round(w["offset_ms"] / 1000.0, 3),
                    "end":   round((w["offset_ms"] + w["duration_ms"]) / 1000.0, 3),
                }
                for w in chunk
            ],
        })

    return groups


def _fallback_subtitle_groups(
        words: list[str],
        audio_duration: float,
        words_per_group: int
) -> list[dict]:
    """Равномерное распределение — только если нет WordBoundary событий."""
    if not words or audio_duration <= 0:
        return []

    wdur = audio_duration / len(words)
    groups = []

    for gi in range(0, len(words), words_per_group):
        chunk = words[gi: gi + words_per_group]
        start = gi * wdur
        end = min((gi + len(chunk)) * wdur + 0.06, audio_duration)
        groups.append({
            "text":  " ".join(chunk),
            "start": round(start, 3),
            "end":   round(end, 3),
            "words": [
                {
                    "text":  w,
                    "start": round((gi + j) * wdur, 3),
                    "end":   round((gi + j + 1) * wdur, 3),
                }
                for j, w in enumerate(chunk)
            ],
        })

    return groups


# ════════════════════════════════════════════════════════════════════════════
# Audio helpers
# ════════════════════════════════════════════════════════════════════════════

def _normalize_audio(input_path: str, output_path: str, target_lufs: float = -14.0) -> bool:
    """
    Нормализует аудио до target_lufs через ffmpeg loudnorm.
    TikTok/Reels стандарт: -14 LUFS, true peak -1.5 dBFS.
    """
    try:
        cmd = [
            "ffmpeg", "-i", input_path,
            "-af", f"loudnorm=I={target_lufs}:TP=-1.5:LRA=11",
            "-c:a", "libmp3lame", "-q:a", "2",
            "-y", output_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        return result.returncode == 0
    except Exception as e:
        print(f"⚠️ Audio normalization failed: {e}")
        return False


def _speed_to_rate_str(speed: float) -> str:
    rate_percent = int((speed - 1.0) * 100)
    return f"+{rate_percent}%" if rate_percent >= 0 else f"{rate_percent}%"


def _pitch_to_str(pitch: float) -> str:
    return f"+{int(pitch)}Hz" if pitch >= 0 else f"{int(pitch)}Hz"


def _make_natural_text(text: str) -> str:
    """
    Делает речь менее роботизированной:
    - Добавляет запятые перед союзами если их нет (пауза ≈150мс)
    - Убирает лишние пробелы
    - Сохраняет оригинальный текст для субтитров (возвращаем только TTS-версию)
    """
    import re
    # Добавляем паузу перед союзами без запятой (русский)
    text = re.sub(r'(?<![,;:.?!])\s+(но|а|и|или|что|чтобы|потому|когда|если|хотя)\s+',
                  r', \1 ', text, flags=re.IGNORECASE)
    # Убираем двойные запятые
    text = re.sub(r',\s*,', ',', text)
    return text.strip()


async def _adjust_audio_duration(audio_path: str, target_duration: float) -> str:
    """Растягивает/сжимает аудио через atempo (range 0.5–2.0)."""
    audio = mutagen.File(audio_path)
    actual_duration = audio.info.length

    if abs(actual_duration - target_duration) < 0.1:
        return audio_path

    tempo = max(0.5, min(2.0, actual_duration / target_duration))
    output_path = f"temp_audio/adjusted_{Path(audio_path).stem}.mp3"

    subprocess.run(
        ["ffmpeg", "-i", audio_path, "-af", f"atempo={tempo:.3f}", "-y", output_path],
        check=True, capture_output=True
    )
    return output_path