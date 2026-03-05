# modules/renderer.py
"""
Video renderer with TikTok-optimized output and fixed filter_complex stream indexing.

TikTok / Reels требования:
- Разрешение: 1080×1920 (9:16)
- Codec: H.264 Main/High profile, level 4.0+
- FPS: 30 (TikTok реsamples если выше)
- Битрейт видео: 6–8 Mbps для 1080p
- Аудио: AAC 44100Hz stereo, -14 LUFS
- Контейнер: MP4, faststart (moov atom в начале)
- Цветовое пространство: yuv420p
"""

import os
import subprocess
import tempfile
import hashlib
from typing import List, Dict, Optional
from pathlib import Path
import mutagen
from .subtitle_renderer import render_vertical_video_with_subtitles


# ── TikTok encoding preset ───────────────────────────────────────────────────
TIKTOK_VIDEO_OPTS = [
    "-c:v", "libx264",
    "-preset", "fast",
    "-profile:v", "main",
    "-level", "4.0",
    "-crf", "23",               # качество (18=lossless, 28=low)
    "-maxrate", "8M",           # TikTok cap
    "-bufsize", "16M",
    "-r", "30",                 # 30fps — TikTok standard
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
]

TIKTOK_AUDIO_OPTS = [
    "-c:a", "aac",
    "-b:a", "128k",
    "-ar", "44100",
    "-ac", "2",
    # loudnorm filter применяется отдельно при необходимости
]


def get_media_duration(file_path: str) -> float:
    """Получает длительность медиафайла в секундах."""
    try:
        f = mutagen.File(file_path)
        if f and f.info:
            return f.info.length
    except:
        pass
    try:
        cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration",
               "-of", "default=noprint_wrappers=1:nokey=1", file_path]
        r = subprocess.run(cmd, capture_output=True, text=True)
        return float(r.stdout.strip())
    except:
        return 0.0


# ════════════════════════════════════════════════════════════════════════════
# Per-clip audio sync render
# ════════════════════════════════════════════════════════════════════════════

def render_video_recap_with_clip_audio(
        video_path: str,
        clips: List[Dict],
        clip_audios: List[Dict],
        output_dir: str = "outputs"
) -> Optional[str]:
    """
    Рендерит горизонтальное видео с TTS аудио, синхронизированным под каждый клип.

    BUG FIX (filter_complex stream indices):
    Старый код: video_idx = i * 2 if pc['audio'] else i
    Проблема: при смешанных клипах (с аудио / без аудио) индексы сбивались,
    ffmpeg падал с "no such stream" или склеивал неправильные потоки.
    Новый код: глобальный input_index, который честно инкрементируется
    при каждом добавленном -i аргументе.
    """
    Path(output_dir).mkdir(exist_ok=True)
    Path("temp_audio").mkdir(exist_ok=True)

    if not clips or not clip_audios:
        print("❌ No clips or audio provided")
        return None

    audio_by_time = {ca.get("clip_start", 0): ca for ca in clip_audios}
    processed_clips = []
    MIN_PAUSE = 0.1

    for i, clip in enumerate(clips):
        start    = clip.get("startTime", 0)
        end      = clip.get("endTime", 0)
        duration = end - start
        if duration <= 0:
            continue

        clip_hash  = hashlib.md5(f"{video_path}_{start}_{end}".encode()).hexdigest()[:8]
        video_clip = f"temp_audio/vclip_{i}_{clip_hash}.mp4"

        print(f"📹 [{i+1}/{len(clips)}] {start:.2f}s–{end:.2f}s ({duration:.2f}s)")

        r = subprocess.run(
            ["ffmpeg", "-i", video_path,
             "-ss", str(start), "-to", str(end),
             "-c:v", "libx264", "-c:a", "aac", "-strict", "experimental",
             "-y", video_clip],
            capture_output=True, text=True
        )
        if r.returncode != 0 or not os.path.exists(video_clip):
            print(f"⚠️ Failed to extract clip {i}")
            continue

        audio_info = audio_by_time.get(start)

        if audio_info:
            audio_path = audio_info.get("audio_path")
            if not audio_path:
                filename = audio_info.get("filename", "")
                if filename:
                    audio_path = os.path.join("temp_audio", filename)
                    if not os.path.exists(audio_path):
                        try:
                            from modules.storage import storage
                            storage.download_file(filename, audio_path, bucket="audio-cache")
                        except Exception as e:
                            print(f"⚠️ Download failed: {e}")
                            continue

            if not audio_path or not os.path.exists(audio_path):
                print(f"⚠️ Audio not found for clip {i}")
                continue

            audio_duration = audio_info.get("duration", 0)
            if audio_duration <= 0:
                audio_duration = get_media_duration(audio_path)
            if audio_duration <= 0:
                audio_duration = duration

            print(f"   🎵 audio={audio_duration:.2f}s  video={duration:.2f}s")

            if audio_duration < duration - MIN_PAUSE:
                new_dur = audio_duration + MIN_PAUSE
                trimmed = f"temp_audio/tvclip_{i}.mp4"
                subprocess.run(
                    ["ffmpeg", "-i", video_clip, "-t", str(new_dur),
                     "-c:v", "libx264", "-c:a", "copy", "-y", trimmed],
                    capture_output=True
                )
                video_clip = trimmed
                duration   = new_dur
            elif audio_duration > duration + MIN_PAUSE:
                trimmed_a = f"temp_audio/taclip_{i}.mp3"
                subprocess.run(
                    ["ffmpeg", "-i", audio_path, "-t", str(duration),
                     "-c", "copy", "-y", trimmed_a],
                    capture_output=True
                )
                audio_path = trimmed_a

            processed_clips.append({"video": video_clip, "audio": audio_path, "duration": duration})
        else:
            processed_clips.append({"video": video_clip, "audio": None, "duration": duration})

    if not processed_clips:
        print("❌ No clips processed")
        return None

    if not any(pc["audio"] for pc in processed_clips):
        return _render_video_only(processed_clips, output_dir)

    return _merge_clips_with_audio(processed_clips, clips, output_dir, vertical=False)


# ════════════════════════════════════════════════════════════════════════════
# Vertical TikTok render with subtitles
# ════════════════════════════════════════════════════════════════════════════

def render_vertical_recap_with_subtitles(
        video_path: str,
        clips: List[Dict],
        clip_audios: List[Dict],
        output_dir: str = "outputs"
) -> Optional[str]:
    """
    Рендерит вертикальное 9:16 видео с субтитрами, TikTok-оптимизированное.
    """
    from modules.storage import storage

    Path(output_dir).mkdir(exist_ok=True)
    Path("temp_audio").mkdir(exist_ok=True)

    if not clips or not clip_audios:
        print("❌ No clips or audio")
        return None

    audio_by_time = {ca.get("clip_start", 0): ca for ca in clip_audios}
    vertical_clips = []

    for i, clip in enumerate(clips):
        start    = clip.get("startTime", 0)
        end      = clip.get("endTime", 0)
        duration = end - start

        print(f"\n📹 [{i+1}/{len(clips)}] {start:.2f}s–{end:.2f}s")

        clip_hash  = hashlib.md5(f"{video_path}_{start}_{end}".encode()).hexdigest()[:8]
        video_clip = f"temp_audio/vclip_{i}_{clip_hash}.mp4"

        r = subprocess.run(
            ["ffmpeg", "-i", video_path,
             "-ss", str(start), "-to", str(end),
             "-c:v", "libx264", "-c:a", "aac", "-y", video_clip],
            capture_output=True, text=True
        )
        if r.returncode != 0 or not os.path.exists(video_clip):
            print("⚠️ Failed to extract video clip")
            continue

        audio_info = audio_by_time.get(start)
        if not audio_info:
            print(f"⚠️ No audio for clip at {start}s")
            continue

        audio_path = audio_info.get("audio_path")
        filename   = audio_info.get("filename")

        if not audio_path and filename:
            audio_path = os.path.join("temp_audio", filename)
            if not os.path.exists(audio_path):
                try:
                    storage.download_file(filename, audio_path, bucket="audio-cache")
                except Exception as e:
                    print(f"❌ Download {filename}: {e}")
                    continue

        if not audio_path or not os.path.exists(audio_path):
            print(f"⚠️ Audio file missing: {audio_path}")
            continue

        audio_duration = audio_info.get("duration", 0)
        if audio_duration <= 0:
            audio_duration = get_media_duration(audio_path) or duration

        subtitles = audio_info.get("subtitles", [])
        print(f"   🎵 audio={audio_duration:.2f}s | {len(subtitles)} subtitle groups")

        vertical_out = f"temp_audio/vertical_{i}_{clip_hash}.mp4"

        ok = render_vertical_video_with_subtitles(
            video_path=video_clip,
            audio_path=audio_path,
            subtitles=subtitles,
            output_path=vertical_out,
            width=1080,
            height=1920,
        )

        if ok and os.path.exists(vertical_out):
            vertical_clips.append(vertical_out)
            print(f"   ✅ Vertical clip {i+1} OK")
        else:
            print(f"   ❌ Vertical clip {i+1} FAILED")

    if not vertical_clips:
        print("❌ No vertical clips rendered")
        return None

    # Склеиваем через concat demuxer (все клипы уже одного формата — просто copy)
    output_hash  = hashlib.md5(str([c.get("id") for c in clips]).encode()).hexdigest()[:8]
    final_output = f"{output_dir}/recap_vertical_{output_hash}.mp4"

    clips_txt = tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".txt")
    for vc in vertical_clips:
        clips_txt.write(f"file '{os.path.abspath(vc)}'\n")
    clips_txt.close()

    r = subprocess.run(
        ["ffmpeg", "-f", "concat", "-safe", "0", "-i", clips_txt.name,
         "-c", "copy", "-y", final_output],
        capture_output=True, text=True
    )

    try:
        os.unlink(clips_txt.name)
        for vc in vertical_clips:
            if os.path.exists(vc):
                os.unlink(vc)
    except:
        pass

    if r.returncode != 0 or not os.path.exists(final_output):
        print(f"❌ Merge failed: {r.stderr[:500]}")
        return None

    dur = get_media_duration(final_output)
    print(f"\n✅ Vertical recap: {final_output} ({dur:.2f}s)")
    return final_output


# ════════════════════════════════════════════════════════════════════════════
# Internal helpers
# ════════════════════════════════════════════════════════════════════════════

def _merge_clips_with_audio(
        processed_clips: List[Dict],
        original_clips: List[Dict],
        output_dir: str,
        vertical: bool = False
) -> Optional[str]:
    """
    Склеивает клипы через filter_complex concat.

    CRITICAL FIX: глобальный input_index вместо формулы i*2.
    При смешанных клипах (есть аудио / нет аудио) старая формула
    давала неверные индексы потоков → ffmpeg крашился или склеивал мусор.
    """
    output_hash  = hashlib.md5(str([c.get("id") for c in original_clips]).encode()).hexdigest()[:8]
    suffix       = "vertical" if vertical else "sync"
    final_output = f"{output_dir}/recap_{suffix}_{output_hash}.mp4"

    # Строим список -i аргументов и параллельно запоминаем реальный
    # индекс каждого потока в порядке добавления
    input_args  = []
    input_index = 0
    stream_map  = []  # [(v_idx, a_idx_or_None), ...]

    for pc in processed_clips:
        v_idx = input_index
        input_args += ["-i", pc["video"]]
        input_index += 1

        a_idx = None
        if pc["audio"]:
            a_idx = input_index
            input_args += ["-i", pc["audio"]]
            input_index += 1

        stream_map.append((v_idx, a_idx))

    n = len(processed_clips)
    v_parts = [f"[{v}:v]" for v, _ in stream_map]
    a_parts = [f"[{a}:a]" for _, a in stream_map if a is not None]

    v_concat = "".join(v_parts) + f"concat=n={n}:v=1:a=0[outv]"

    if a_parts:
        # Если у каких-то клипов нет аудио — a_parts короче n,
        # concat для аудио берёт только реальные звуковые входы
        na = len(a_parts)
        a_concat = "".join(a_parts) + f"concat=n={na}:v=0:a=1[outa]"
        filter_complex = f"{v_concat};{a_concat}"

        cmd = (
            ["ffmpeg"] + input_args
            + ["-filter_complex", filter_complex,
               "-map", "[outv]", "-map", "[outa]"]
            + TIKTOK_VIDEO_OPTS + TIKTOK_AUDIO_OPTS
            + ["-progress", "pipe:1", "-y", final_output]
        )
    else:
        filter_complex = v_concat
        cmd = (
            ["ffmpeg"] + input_args
            + ["-filter_complex", filter_complex, "-map", "[outv]"]
            + TIKTOK_VIDEO_OPTS
            + ["-an", "-progress", "pipe:1", "-y", final_output]
        )

    print(f"🎞️ Merging {n} clips → {final_output}")

    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        if r.returncode != 0:
            print(f"❌ Merge failed:\n{r.stderr[:600]}")
            return None
        if not os.path.exists(final_output):
            print("❌ Output file not created")
            return None

        dur = get_media_duration(final_output)
        print(f"✅ Render complete: {final_output} ({dur:.2f}s)")

        # Cleanup
        for pc in processed_clips:
            for f in [pc["video"], pc["audio"]]:
                if f and "temp_audio" in str(f) and os.path.exists(f):
                    try:
                        os.unlink(f)
                    except:
                        pass

        return final_output

    except subprocess.TimeoutExpired:
        print("❌ Render timeout")
        return None
    except Exception as e:
        print(f"❌ Render error: {e}")
        return None


def _render_video_only(processed_clips: List[Dict], output_dir: str) -> Optional[str]:
    """Fallback: склеиваем только видео дорожки."""
    clips_txt = tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".txt")
    for pc in processed_clips:
        clips_txt.write(f"file '{os.path.abspath(pc['video'])}'\n")
    clips_txt.close()

    output_hash  = hashlib.md5(str(hash(str(processed_clips))).encode()).hexdigest()[:8]
    final_output = f"{output_dir}/recap_nosync_{output_hash}.mp4"

    r = subprocess.run(
        ["ffmpeg", "-f", "concat", "-safe", "0", "-i", clips_txt.name,
         "-c", "copy", "-y", final_output],
        capture_output=True, text=True
    )

    try:
        os.unlink(clips_txt.name)
    except:
        pass

    return final_output if r.returncode == 0 and os.path.exists(final_output) else None


# ════════════════════════════════════════════════════════════════════════════
# Legacy single-audio render
# ════════════════════════════════════════════════════════════════════════════

def render_video_recap(
        video_path: str,
        clips: List[Dict],
        tts_audio_path: Optional[str] = None,
        output_dir: str = "outputs"
) -> Optional[str]:
    """Legacy режим: одно аудио на всё видео."""
    Path(output_dir).mkdir(exist_ok=True)
    if not clips:
        return None

    total_duration = sum(c["endTime"] - c["startTime"] for c in clips)
    clip_files = []

    for i, clip in enumerate(clips):
        ch = hashlib.md5(f"{video_path}_{clip['startTime']}_{clip['endTime']}".encode()).hexdigest()[:8]
        out = f"temp_audio/clip_{i}_{ch}.mp4"
        subprocess.run(
            ["ffmpeg", "-i", video_path,
             "-ss", str(clip["startTime"]), "-to", str(clip["endTime"]),
             "-c:v", "libx264", "-c:a", "aac", "-strict", "experimental",
             "-y", out],
            capture_output=True
        )
        if os.path.exists(out):
            clip_files.append(out)

    if not clip_files:
        return None

    clips_txt = tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".txt")
    for cf in clip_files:
        clips_txt.write(f"file '{os.path.abspath(cf)}'\n")
    clips_txt.close()

    output_hash  = hashlib.md5(str(clips).encode()).hexdigest()[:8]
    final_output = f"{output_dir}/recap_{output_hash}.mp4"

    if tts_audio_path and os.path.exists(tts_audio_path):
        aud_dur = get_media_duration(tts_audio_path)
        if aud_dur > total_duration:
            trimmed = "temp_audio/trimmed_final.mp3"
            subprocess.run(["ffmpeg", "-i", tts_audio_path, "-t", str(total_duration),
                            "-y", trimmed], capture_output=True)
            tts_audio_path = trimmed

        cmd = (
            ["ffmpeg", "-f", "concat", "-safe", "0", "-i", clips_txt.name,
             "-i", tts_audio_path,
             "-map", "0:v:0", "-map", "1:a:0",
             "-shortest"]
            + TIKTOK_VIDEO_OPTS + TIKTOK_AUDIO_OPTS
            + ["-y", final_output]
        )
    else:
        cmd = ["ffmpeg", "-f", "concat", "-safe", "0", "-i", clips_txt.name,
               "-c", "copy", "-y", final_output]

    r = subprocess.run(cmd, capture_output=True, text=True)

    try:
        os.unlink(clips_txt.name)
        for cf in clip_files:
            if os.path.exists(cf):
                os.unlink(cf)
    except:
        pass

    return final_output if r.returncode == 0 and os.path.exists(final_output) else None