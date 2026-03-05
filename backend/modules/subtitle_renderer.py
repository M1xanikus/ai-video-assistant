# modules/subtitle_renderer.py
"""
TikTok-style subtitle renderer.

Шрифт: Montserrat Bold (fallback → Arial Bold)
Стиль: белый текст, чёрная обводка, БЕЗ тени, БЕЗ фонового бокса.
Karaoke: слова изначально БЕЛЫЕ, текущее слово подсвечивается ЖЁЛТЫМ.
Позиция субтитров фиксирована — текст не прыгает между строками.
"""

import subprocess
import tempfile
import os
from typing import List, Dict
import mutagen


def get_media_duration(file_path: str) -> float:
    try:
        f = mutagen.File(file_path)
        if f and f.info:
            return f.info.length
    except:
        pass
    try:
        r = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", file_path],
            capture_output=True, text=True
        )
        return float(r.stdout.strip())
    except:
        return 0.0


def render_vertical_video_with_subtitles(
        video_path: str,
        audio_path: str,
        subtitles: List[Dict],
        output_path: str,
        width: int = 1080,
        height: int = 1920
) -> bool:
    """
    Рендерит вертикальное видео 9:16 с Montserrat субтитрами.
    BorderStyle=1 (outline only), Shadow=0 — чистая обводка без теней и боксов.
    """
    ass_content = _build_ass(subtitles, width, height)

    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".ass", delete=False, encoding="utf-8"
    ) as f:
        f.write(ass_content)
        ass_file = f.name

    try:
        # ffmpeg vf: экранируем путь (\ → /, : → \:)
        ass_escaped = ass_file.replace("\\", "/").replace(":", "\\:")

        print(f"🎬 Vertical render | {video_path} → {output_path}")

        vf = (
            f"crop=min(iw\\,ih*9/16):ih:(iw-min(iw\\,ih*9/16))/2:0,"
            f"scale={width}:{height}:flags=lanczos,"
            f"subtitles='{ass_escaped}'"
        )

        cmd = [
            "ffmpeg",
            "-i", video_path,
            "-i", audio_path,
            "-vf", vf,
            "-map", "0:v:0",
            "-map", "1:a:0",
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "23",
            "-profile:v", "main",
            "-level", "4.0",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-b:a", "128k",
            "-ar", "44100",
            "-ac", "2",
            "-movflags", "+faststart",
            "-shortest",
            "-y", output_path,
        ]

        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode != 0:
            print(f"❌ Render failed:\n{result.stderr[:1000]}")
            return False

        if not os.path.exists(output_path):
            print("❌ Output file not created")
            return False

        duration = get_media_duration(output_path)
        has_audio = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "a",
             "-show_entries", "stream=codec_type",
             "-of", "default=noprint_wrappers=1:nokey=1", output_path],
            capture_output=True, text=True
        ).stdout.strip()

        print(f"✅ {output_path} | {duration:.2f}s | audio={bool(has_audio)}")
        return True

    finally:
        try:
            os.unlink(ass_file)
        except:
            pass


# ════════════════════════════════════════════════════════════════════════════
# ASS builder
# ════════════════════════════════════════════════════════════════════════════

# ASS цвета: AABBGGRR (alpha, blue, green, red)
COLOR_WHITE  = "&H00FFFFFF"  # белый текст
COLOR_YELLOW = "&H0000FFFF"  # жёлтый karaoke highlight (BGR: 00 FF FF)
COLOR_BLACK  = "&H00000000"  # чёрная обводка
COLOR_TRANS  = "&H00000000"  # прозрачный фон (не используем бокс)


def _build_ass(subtitles: List[Dict], width: int, height: int) -> str:
    """
    ASS файл с Montserrat Bold, чистой чёрной обводкой.

    BorderStyle=1  → только outline (обводка), никакого бокса
    Shadow=0       → без тени
    Outline=4      → толщина обводки 4px при PlayRes 1080
    BackColour     → не используется при BorderStyle=1, ставим прозрачный
    """
    font_size = max(54, int(height * 0.047) - 2)   # ~88px на 1920 (на 2pt меньше)
    margin_v  = int(height * 0.09)                  # ~172px от низа

    header = f"""[Script Info]
Title: TikTok Subtitles
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {height}
ScaledBorderAndShadow: yes
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Montserrat,{font_size},{COLOR_WHITE},{COLOR_YELLOW},{COLOR_BLACK},{COLOR_TRANS},1,0,0,0,100,100,0,0,1,2,0,2,30,30,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    events = []
    for sub in subtitles:
        start      = _fmt_time(sub.get("start", 0))
        end        = _fmt_time(sub.get("end",   0))
        words_data = sub.get("words", [])

        if words_data:
            text = _build_karaoke_text(words_data)
        else:
            text = _esc(sub.get("text", ""))

        events.append(f"Dialogue: 0,{start},{end},Default,,0,0,0,,{text}")

    return header + "\n".join(events) + "\n"


def _build_karaoke_text(words: List[Dict]) -> str:
    """
    Karaoke подсветка: все слова начинаются белыми, текущее слово
    окрашивается в жёлтый при чтении.

    Используем \\kf (fill karaoke) — плавная подсветка слева направо.
    SecondaryColour (\\2c) = жёлтый задан в стиле, PrimaryColour = белый.
    \\K<cs> — длительность подсветки: слово "заполняется" жёлтым → белым.

    Вся группа слов — одна строка, без переносов: текст не прыгает.
    """
    parts = []
    for i, w in enumerate(words):
        dur_cs = max(1, int((w.get("end", 0) - w.get("start", 0)) * 100))
        text = _esc(w.get("text", ""))
        # \\kf — karaoke fill: жёлтый → белый по мере чтения
        # Пробел между словами добавляем внутри тега чтобы не было прыжков
        space = "" if i == 0 else " "
        parts.append(f"{space}{{\\kf{dur_cs}}}{text}")

    # Результат: всё в одну строку, без \N
    return "".join(parts)


def _esc(text: str) -> str:
    """Экранирование спецсимволов ASS."""
    return (
        str(text)
        .replace("\\", "\\\\")
        .replace("{", "\\{")
        .replace("}", "\\}")
        .replace(",", "{\\,}")
    )


def _fmt_time(seconds: float) -> str:
    """float секунды → ASS H:MM:SS.cc"""
    if seconds < 0:
        seconds = 0.0
    h  = int(seconds // 3600)
    m  = int((seconds % 3600) // 60)
    s  = int(seconds % 60)
    cs = min(99, int(round((seconds % 1) * 100)))
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"