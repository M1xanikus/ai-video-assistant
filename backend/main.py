import os
import shutil
import json
import requests  # <-- Добавьте эту строку в импорты
import redis
import cv2
import subprocess
from fastapi import FastAPI, UploadFile, File, HTTPException, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse, StreamingResponse
from modules.renderer import render_video_recap
from modules.script_gen import generate_recap_script
from modules.transcriber import transcribe_video
from modules.visual_analyzer import analyze_video_scenes
from modules.tts_engine import synthesize_voice
from urllib.parse import unquote
from modules.storage import storage

app = FastAPI()

# --- КОНФИГУРАЦИЯ И ДИРЕКТОРИИ ---
REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = os.getenv("REDIS_PORT", 6379)
r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=0, decode_responses=True)

UPLOAD_DIR = "uploads"
AUDIO_CACHE_DIR = "audio_cache"
OUTPUT_DIR = "outputs"
TEMP_AUDIO_DIR = "temp_audio"

for d in [UPLOAD_DIR, AUDIO_CACHE_DIR, OUTPUT_DIR, TEMP_AUDIO_DIR]:
    os.makedirs(d, exist_ok=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ---

def extract_audio(video_path: str, original_filename: str):
    """Извлекает аудио из видео для таймлайна и сохраняет в MinIO"""
    base_name = os.path.splitext(original_filename)[0]
    safe_name = "".join(c if c.isalnum() or c in ('-', '_') else '_' for c in base_name)
    safe_name = safe_name.strip().replace(' ', '_')

    audio_filename = f"{safe_name}.mp3"
    audio_path = os.path.join(AUDIO_CACHE_DIR, audio_filename)

    if not os.path.exists(audio_path):
        command = [
            'ffmpeg', '-i', video_path,
            '-vn', '-acodec', 'libmp3lame', '-q:a', '4',
            audio_path, '-y'
        ]
        subprocess.run(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        # Выгружаем в MinIO бакет audio-cache
        with open(audio_path, "rb") as f:
            storage.upload_file(f, audio_filename, bucket='audio-cache')

    return audio_filename


def get_combined_timestamps(video_path, transcript):
    """Комбинированный поиск релевантных кадров (склейки + речь)"""
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0: fps = 24

    visual_cuts = [0.0]
    last_hist = None
    step = int(fps / 2)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    frame_count = 0
    while frame_count < total_frames:
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_count)
        ret, frame = cap.read()
        if not ret: break

        hist = cv2.calcHist([frame], [0, 1, 2], None, [8, 8, 8], [0, 256, 0, 256, 0, 256])
        hist = cv2.normalize(hist, hist).flatten()

        if last_hist is not None:
            diff = cv2.compareHist(last_hist, hist, cv2.HISTCMP_CORREL)
            if diff < 0.7:
                visual_cuts.append(frame_count / fps)
        last_hist = hist
        frame_count += step
    cap.release()

    speech_starts = [t['timecode'] for t in transcript]
    all_potential = sorted(list(set(visual_cuts + speech_starts)))

    final_timestamps = []
    if all_potential:
        final_timestamps.append(all_potential[0])
        for t in all_potential[1:]:
            if t - final_timestamps[-1] > 2.5:
                final_timestamps.append(t)
    return final_timestamps


# --- ЭНДПОИНТЫ СОСТОЯНИЯ (REDIS) ---

@app.post("/api/state/save")
async def save_state(state: dict = Body(...)):
    try:
        r.set("editor_state", json.dumps(state))
        return {"status": "success", "message": "State saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/state/load")
async def load_state():
    state = r.get("editor_state")
    return json.loads(state) if state else {}


# --- ОСНОВНЫЕ ЭНДПОИНТЫ (C MINIO) ---

@app.post("/api/upload")
async def upload_video(file: UploadFile = File(...)):
    file_path = os.path.join(UPLOAD_DIR, file.filename)

    # 1. Сохраняем локально для обработки
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # 2. Выгружаем в MinIO
    file.file.seek(0)
    storage.upload_file(file.file, file.filename, bucket='uploads')

    # 3. Извлекаем аудио для таймлайна
    try:
        audio_filename = extract_audio(file_path, file.filename)
    except Exception as e:
        print(f"Audio extraction error: {e}")
        audio_filename = None

    return {
        "filename": file.filename,
        "audio_filename": audio_filename,
        "status": "success"
    }


@app.post("/api/transcribe")
async def transcribe(data: dict):
    filename = data.get("filename")
    file_path = os.path.join(UPLOAD_DIR, filename)
    # Если локально файла нет (например, после рестарта), тянем из MinIO
    if not os.path.exists(file_path):
        storage.download_file(filename, file_path, bucket='uploads')

    try:
        return {"transcript": transcribe_video(file_path)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/analyze_scene")
async def analyze_scene(data: dict):
    filename = data.get("filename")
    transcript = data.get("transcript", [])
    file_path = os.path.join(UPLOAD_DIR, filename)

    if not os.path.exists(file_path):
        storage.download_file(filename, file_path, bucket='uploads')

    relevant_timestamps = get_combined_timestamps(file_path, transcript)
    try:
        visual_descriptions = analyze_video_scenes(file_path, relevant_timestamps)
        return {"scenes": visual_descriptions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate_script")
async def generate_script(data: dict):
    transcript = data.get("transcript", [])
    markers = data.get("markers", [])

    t_text = "\n".join([f"[{t['timecode']}s] {t['text']}" for t in transcript])
    v_text = "\n".join([f"[{m['timecode']}s] {m['description']}" for m in markers])

    ai_response = generate_recap_script(t_text, v_text)
    if ai_response: return ai_response
    raise HTTPException(status_code=500, detail="AI script generation failed")


# main.py

@app.post("/api/synthesize_voice")
async def api_synthesize(data: dict):
    """
    Генерирует TTS аудио:
    - Если сегменты имеют timing (startTime/endTime) → per-clip режим
    - Иначе → legacy режим (одно аудио на весь текст)
    """
    from modules.tts_engine import synthesize_voice, synthesize_voice_for_clips

    segments = data.get("segments", [])
    settings = data.get("settings", {})

    voice_key = settings.get("voiceType", "male-ru-1")
    speed = settings.get("speed", 1.3)  # 🔥 По умолчанию 1.3x для динамики
    pitch = settings.get("pitch", 0.0)

    # 🔥 Определяем режим: есть ли timing у сегментов?
    has_timing = all(
        'startTime' in s and 'endTime' in s and 'id' in s
        for s in segments
    )

    if has_timing and len(segments) > 0:
        # 🔥 PER-CLIP РЕЖИМ: генерируем аудио под каждый клип
        print(f"🎬 Per-clip TTS mode: {len(segments)} segments")

        clip_audios = await synthesize_voice_for_clips(
            segments=segments,
            voice_key=voice_key,
            base_speed=speed,
            pitch=pitch
        )

        if not clip_audios:
            raise HTTPException(status_code=500, detail="Failed to generate any audio clips")

        # 🔥 Выгружаем каждый аудиофайл в MinIO и собираем ответ
        uploaded_clips = []
        for ca in clip_audios:
            filename = os.path.basename(ca['audio_path'])
            try:
                with open(ca['audio_path'], "rb") as f:
                    storage.upload_file(f, filename, bucket='audio-cache')

                uploaded_clips.append({
                    "clip_id": ca['clip_id'],
                    "audio_url": f"/api/audio-preview/{filename}",
                    "filename": filename,
                    "duration": ca['duration'],
                    "clip_start": ca['clip_start'],
                    "clip_end": ca['clip_end'],
                    "text_preview": ca['text'][:50] + "..." if len(ca['text']) > 50 else ca['text'],
                    "speed_used": ca['speed_used'],
                    "subtitles": ca.get('subtitles', [])
                })
            except Exception as e:
                print(f"⚠️ Could not upload {filename}: {e}")
                continue

        if not uploaded_clips:
            raise HTTPException(status_code=500, detail="Failed to upload audio clips")

        return {
            "status": "success",
            "mode": "per_clip",
            "clips": uploaded_clips,
            "total_duration": sum(c['duration'] for c in uploaded_clips),
            "clip_count": len(uploaded_clips)
        }

    else:
        # 🔥 LEGACY РЕЖИМ: одно аудио на весь текст
        print(f"🎤 Legacy TTS mode: single audio for {len(segments)} segments")

        full_text = " . ".join([s['text'] for s in segments if s.get('text')])
        if not full_text:
            raise HTTPException(status_code=400, detail="No text to synthesize")

        audio_path = await synthesize_voice(
            text=full_text,
            voice_key=voice_key,
            speed=speed,
            pitch=pitch
        )

        filename = os.path.basename(audio_path)
        with open(audio_path, "rb") as f:
            storage.upload_file(f, filename, bucket='audio-cache')

        return {
            "status": "success",
            "mode": "single",
            "audio_url": f"/api/audio-preview/{filename}",
            "filename": filename
        }

# main.py

# main.py (дополните существующий /api/render)

@app.post("/api/render")
async def render(data: dict):
    from modules.renderer import render_video_recap, render_video_recap_with_clip_audio

    filename = data.get("filename")
    clips = data.get("clips", [])
    tts_filename = data.get("tts_filename")
    clip_audios = data.get("clip_audios")  # 🔥 Новый режим

    if not filename or not clips:
        raise HTTPException(status_code=400, detail="Missing filename or clips")

    source_path = os.path.join("uploads", filename)
    if not os.path.exists(source_path):
        try:
            storage.download_file(filename, source_path, bucket='uploads')
        except:
            raise HTTPException(status_code=404, detail=f"Video not found: {filename}")

    # 🔥 Режим с аудио под клипы
    # main.py — внутри @app.post("/api/render")

    # 🔥 Обработка per-clip аудио
    if clip_audios:
        print(f"🎬 Rendering with per-clip audio: {len(clip_audios)} audio clips")

        # Скачиваем аудиофайлы из MinIO и сохраняем clip_id
        processed_audios = []
        for ca in clip_audios:
            # 🔧 Извлекаем clip_id из ответа frontend (поддержка обоих форматов)
            clip_id = ca.get('clip_id') or ca.get('clipId')

            # Если clip_id нет — извлекаем из audio_url
            if not clip_id:
                audio_url = ca.get('audio_url', '')
                # Пример: /api/audio-preview/clip_seg-1_xxx.mp3 → seg-1
                import re
                match = re.search(r'clip_(seg-\d+)_', audio_url)
                if match:
                    clip_id = match.group(1)

            # Если всё ещё нет — генерируем из индекса
            if not clip_id:
                clip_id = f"clip-{len(processed_audios)}"

            audio_name = ca.get('audio_url', '').split('/')[-1]
            local_path = os.path.join("temp_audio", audio_name)

            if not os.path.exists(local_path):
                try:
                    storage.download_file(audio_name, local_path, bucket='audio-cache')
                except Exception as e:
                    print(f"⚠️ Could not download {audio_name}: {e}")
                    continue

            processed_audios.append({
                'clip_id': clip_id,  # 🔧 Сохраняем clip_id!
                'audio_path': local_path,
                'duration': ca.get('duration', 0),
                'clip_start': ca.get('clip_start', 0),
                'clip_end': ca.get('clip_end', 0)
            })

        if not processed_audios:
            raise HTTPException(status_code=500, detail="No audio clips available")

        print(f"✅ Processed {len(processed_audios)} audio clips with IDs")

        result_path = render_video_recap_with_clip_audio(
            video_path=source_path,
            clips=clips,
            clip_audios=processed_audios  # 🔧 Теперь с clip_id
        )
    # 🔥 Старый режим: одно аудио на всё
    else:
        tts_path = None
        if tts_filename:
            tts_path = os.path.join("temp_audio", tts_filename)
            if not os.path.exists(tts_path):
                try:
                    storage.download_file(tts_filename, tts_path, bucket='audio-cache')
                except:
                    tts_path = None

        result_path = render_video_recap(
            video_path=source_path,
            clips=clips,
            tts_audio_path=tts_path
        )

    if not result_path:
        raise HTTPException(status_code=500, detail="Rendering failed")

    # Выгрузка в MinIO
    res_filename = os.path.basename(result_path)
    with open(result_path, "rb") as f:
        storage.upload_file(f, res_filename, bucket='outputs')

    return {
        "status": "success",
        "recap_url": f"/api/download/{res_filename}",
        "mode": "per_clip" if clip_audios else "single"
    }
# === АУДИО ===
@app.get("/api/audio/{filename}")
async def get_audio(filename: str, request: Request):
    """Проксируем аудио из MinIO (работает без CORS)"""
    try:
        # Получаем presigned URL из MinIO (внутренний запрос)
        presigned_url = storage.get_presigned_url(
            unquote(filename),
            bucket='audio-cache',
            expires_in=3600
        )

        # Проксируем Range-заголовок для поддержки seek в WaveSurfer
        range_header = request.headers.get("Range")
        headers = {"Range": range_header} if range_header else {}

        # Загружаем файл из MinIO с streaming
        response = requests.get(
            presigned_url,
            headers=headers,
            stream=True,
            timeout=30
        )
        response.raise_for_status()

        # Возвращаем бинарный поток с правильными заголовками
        return StreamingResponse(
            response.iter_content(chunk_size=8192),
            status_code=response.status_code,
            headers={
                "Content-Type": "audio/mpeg",
                "Accept-Ranges": "bytes",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=3600",
            }
        )
    except requests.exceptions.HTTPError as e:
        if e.response and e.response.status_code == 404:
            raise HTTPException(status_code=404, detail=f"Audio not found: {filename}")
        raise HTTPException(status_code=502, detail=f"MinIO error: {str(e)}")
    except Exception as e:
        print(f"Audio proxy error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


# === ВИДЕО ===
@app.get("/api/video/{filename}")
async def get_video(filename: str, request: Request):
    """Проксируем видео из MinIO (работает без CORS)"""
    try:
        presigned_url = storage.get_presigned_url(
            unquote(filename),
            bucket='uploads',
            expires_in=3600
        )

        range_header = request.headers.get("Range")
        headers = {"Range": range_header} if range_header else {}

        response = requests.get(
            presigned_url,
            headers=headers,
            stream=True,
            timeout=60
        )
        response.raise_for_status()

        return StreamingResponse(
            response.iter_content(chunk_size=8192),
            status_code=response.status_code,
            headers={
                "Content-Type": "video/mp4",
                "Accept-Ranges": "bytes",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=3600",
            }
        )
    except requests.exceptions.HTTPError as e:
        if e.response and e.response.status_code == 404:
            raise HTTPException(status_code=404, detail=f"Video not found: {filename}")
        raise HTTPException(status_code=502, detail=f"MinIO error: {str(e)}")
    except Exception as e:
        print(f"Video proxy error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


# === ПРЕВЬЮ ГОЛОСА (audio-preview) ===
@app.get("/api/audio-preview/{filename}")
async def get_audio_preview(filename: str, request: Request):
    """Alias для audio (для совместимости с handleGenerateVoice)"""
    return await get_audio(filename, request)


# === СКАЧИВАНИЕ РЕКАПА ===
@app.get("/api/download/{filename}")
async def get_output(filename: str, request: Request):
    """Проксируем готовый рекап из MinIO"""
    try:
        presigned_url = storage.get_presigned_url(
            filename,
            bucket='outputs',
            expires_in=3600
        )

        response = requests.get(presigned_url, stream=True, timeout=60)
        response.raise_for_status()

        return StreamingResponse(
            response.iter_content(chunk_size=8192),
            status_code=response.status_code,
            headers={
                "Content-Type": "video/mp4",
                "Content-Disposition": f"attachment; filename={filename}",
                "Accept-Ranges": "bytes",
                "Access-Control-Allow-Origin": "*",
            }
        )
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Output file not found: {filename}")


@app.post("/api/render_vertical")
async def render_vertical(data: dict):
    """
    🔥 Рендерит ВЕРТИКАЛЬНОЕ видео (9:16) с TikTok-стиль субтитрами
    """
    from modules.renderer import render_vertical_recap_with_subtitles

    filename = data.get("filename")
    clips = data.get("clips", [])
    clip_audios = data.get("clip_audios")

    if not filename or not clips:
        raise HTTPException(status_code=400, detail="Missing filename or clips")

    source_path = os.path.join("uploads", filename)
    if not os.path.exists(source_path):
        try:
            storage.download_file(filename, source_path, bucket='uploads')
        except:
            raise HTTPException(status_code=404, detail=f"Video not found: {filename}")

    if not clip_audios:
        raise HTTPException(status_code=400, detail="No audio clips for subtitles")

    print(f"🎬 Rendering VERTICAL recap with subtitles...")

    result_path = render_vertical_recap_with_subtitles(
        video_path=source_path,
        clips=clips,
        clip_audios=clip_audios,
        output_dir="outputs"
    )

    if not result_path:
        raise HTTPException(status_code=500, detail="Vertical render failed")

    # Выгружаем в MinIO
    res_filename = os.path.basename(result_path)
    with open(result_path, "rb") as f:
        storage.upload_file(f, res_filename, bucket='outputs')

    return {
        "status": "success",
        "recap_url": f"/api/download/{res_filename}",
        "format": "vertical_9_16",
        "subtitles": True
    }