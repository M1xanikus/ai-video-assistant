import axios from 'axios';

const API_BASE = 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE,
});

export const videoApi = {
  // 1. Загрузка файла
  upload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/upload', formData);
  },

  // 2. Транскрибация (Whisper)
  transcribe: (filename: string) =>
    api.post('/transcribe', { filename }),

  // 3. Визуальный анализ (CoCa)
  analyzeScene: (filename: string) =>
    api.post('/analyze_scene', { filename }),

  // 4. Генерация сценария (Gemini)
  generateScript: (transcript: any[]) =>
    api.post('/generate_script', { transcript }),

  // 5. Озвучка (Edge-TTS)
  synthesizeVoice: (segments: any[], settings: any) =>
    api.post('/synthesize_voice', { segments, settings }),

  // 6. Рендеринг (MoviePy)
  renderRecap: (filename: string, clips: any[]) =>
    api.post('/render', { filename, clips }),
};