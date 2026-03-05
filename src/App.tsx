import React, { useState, useRef, useMemo, useEffect } from 'react';
import axios from 'axios';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from './components/ui/resizable';
import { TopToolbar } from './components/TopToolbar';
import { VideoPlayer } from './components/VideoPlayer';
import { Timeline } from './components/Timeline';
import { RightSidebar } from './components/RightSidebar';
import { StatusPanel, LogEntry, KeyFrame } from './components/StatusPanel';
import { TranscriptLine, MarkerData } from './components/TranscriptPanel';
import { VoiceSettings } from './components/VoiceExportPanel';
import { AIManualModal } from './components/AIManualModal';

// Настройка базового URL для API бэкенда
const API_BASE_URL = 'http://localhost:8000/api';

export interface ClipRegion {
  id: string;
  startTime: number;
  endTime: number;
}

export interface ScriptSegment {
  id: string;
  text: string;
  linkedClipId: string | null;
}

// === ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ: возвращает прокси-URL (работает без CORS) ===
const getProxyUrl = (filename: string, type: 'audio' | 'video' | 'download'): string => {
  if (!filename) return '';
  const endpoint = type === 'audio'
    ? `${API_BASE_URL}/audio/${encodeURIComponent(filename)}`
    : type === 'video'
    ? `${API_BASE_URL}/video/${encodeURIComponent(filename)}`
    : `${API_BASE_URL}/download/${encodeURIComponent(filename)}`;
  return endpoint;
};

export default function App() {
  // --- Состояние видео и времени ---
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [audioFilename, setAudioFilename] = useState<string | null>(null);
  const [serverFilename, setServerFilename] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [serverTtsFilename, setServerTtsFilename] = useState<string | null>(null);

  // === В интерфейсе состояний ===
const [clipAudios, setClipAudios] = useState<Array<{
  clip_id: string;
  audio_url: string;
  filename: string;
  duration: number;
  clip_start: number;
  clip_end: number;
  text_preview: string;
  speed_used: number;
}>>([]);


  // --- Состояние UI и Workflow ---
  const [currentStep, setCurrentStep] = useState<string>('upload');
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [bindingSegmentId, setBindingSegmentId] = useState<string | null>(null);
  const [showAIModal, setShowAIModal] = useState(false);

  // --- Состояние ИИ-процессов (StatusPanel) ---
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [keyframes, setKeyframes] = useState<KeyFrame[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingTask, setProcessingTask] = useState('');

  // --- Состояние данных ИИ (Transcript & Markers) ---
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [markers, setMarkers] = useState<MarkerData[]>([]);

  // --- Данные пользователя (Клипы и Сценарий) ---
  const [clips, setClips] = useState<ClipRegion[]>([]);
  const [scriptSegments, setScriptSegments] = useState<ScriptSegment[]>([]);

  // --- Рефы ---
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Вычисляемые данные ---
  const totalClipsDuration = useMemo(() => {
    return clips.reduce((sum, clip) => sum + (clip.endTime - clip.startTime), 0);
  }, [clips]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // --- Вспомогательные функции ---

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    const newLog: LogEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      message,
      type
    };
    setLogs(prev => [...prev, newLog]);
  };

  const handleBindClipToSegment = (clipId: string) => {
    if (bindingSegmentId) {
      setScriptSegments(prev => prev.map(seg =>
        seg.id === bindingSegmentId ? { ...seg, linkedClipId: clipId } : seg
      ));
      setBindingSegmentId(null);
      addLog(`Success: Script linked to Clip #${clipId.split('-')[1] || clipId}`, 'success');
    }
  };

  // --- ЛОГИКА ПЕРСИСТЕНТНОСТИ (REDIS + VIDEO RESTORE) ---

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/state/load`);
        const data = res.data;
        if (data && data.serverFilename) {
          setServerFilename(data.serverFilename);

          // Восстанавливаем видео через прокси-эндпоинт
          setVideoUrl(getProxyUrl(data.serverFilename, 'video'));

          // Восстанавливаем аудио через прокси-эндпоинт
          if (data.audioFilename) {
            setAudioFilename(data.audioFilename);
            setAudioUrl(getProxyUrl(data.audioFilename, 'audio'));
          } else if (data.serverFilename) {
            // Fallback: генерируем имя аудио из имени видео
            const baseName = data.serverFilename.replace(/\.[^/.]+$/, '');
            const generatedAudioFilename = `${baseName}.mp3`;
            setAudioFilename(generatedAudioFilename);
            setAudioUrl(getProxyUrl(generatedAudioFilename, 'audio'));
          }

          if (data.transcript) setTranscript(data.transcript);
          if (data.clips) setClips(data.clips);
          if (data.scriptSegments) setScriptSegments(data.scriptSegments);
          if (data.markers) setMarkers(data.markers);
          if (data.logs) setLogs(data.logs);
          if (data.currentStep) setCurrentStep(data.currentStep);
          addLog("Session restored from server", "success");
        }
      } catch (e) {
        console.error("Session restoration failed", e);
        addLog("Failed to restore session from server", "warning");
      }
    };
    restoreSession();
  }, []);

  useEffect(() => {
    if (!serverFilename) return;
    const saveTimer = setTimeout(async () => {
      const stateToSave = {
        serverFilename,
        audioFilename,
        transcript,
        clips,
        scriptSegments,
        markers,
        logs,
        currentStep
      };
      try {
        await axios.post(`${API_BASE_URL}/state/save`, stateToSave);
      } catch (e) {
        console.error("Auto-save sync failed", e);
        addLog("Auto-save failed. Please try again.", "warning");
      }
    }, 2000);
    return () => clearTimeout(saveTimer);
  }, [serverFilename, audioFilename, transcript, clips, scriptSegments, markers, logs, currentStep]);

  // --- ЛОГИКА ВЗАИМОДЕЙСТВИЯ С БЭКЕНДОМ ---

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Локальный preview для видео (быстро, без загрузки)
      setVideoUrl(URL.createObjectURL(file));

      setIsProcessing(true);
      setProcessingTask("Uploading video...");
      addLog(`Uploading "${file.name}"...`, 'info');

      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await axios.post(`${API_BASE_URL}/upload`, formData);
        setServerFilename(response.data.filename);

        // Устанавливаем URL аудио через прокси-эндпоинт
        if (response.data.audio_filename) {
          setAudioFilename(response.data.audio_filename);
          setAudioUrl(getProxyUrl(response.data.audio_filename, 'audio'));
        }

        addLog("Upload complete. Ready to process.", "success");
        setCurrentStep('transcribe');
      } catch (error) {
        console.error("Upload failed:", error);
        addLog("Server connection lost during upload.", "warning");
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const runTranscription = async () => {
    if (!serverFilename) return;
    setIsProcessing(true);
    setProcessingProgress(5);
    setProcessingTask("Whisper AI is analyzing speech...");
    addLog("Transcription engine started...", "info");
    const progressInterval = setInterval(() => {
      setProcessingProgress(prev => (prev >= 95 ? prev : prev + 2));
    }, 2000);
    try {
      const response = await axios.post(`${API_BASE_URL}/transcribe`, { filename: serverFilename });
      clearInterval(progressInterval);
      setProcessingProgress(100);
      setTranscript(response.data.transcript);
      addLog("Transcription finished successfully", "success");
      setTimeout(() => {
        setIsProcessing(false);
        setProcessingProgress(0);
        setCurrentStep('analyze');
      }, 1000);
    } catch (error) {
      console.error("Transcription failed:", error);
      clearInterval(progressInterval);
      addLog("Transcription failed.", "warning");
      setIsProcessing(false);
    }
  };

  const runSceneAnalysis = async () => {
    if (!serverFilename) return;

    setIsProcessing(true);
    setProcessingProgress(10);
    setProcessingTask("AI is identifying key scenes...");

    addLog("Starting combined analysis (Moondream2 + Speech Sync)...", "info");

    try {
      const response = await axios.post(`${API_BASE_URL}/analyze_scene`, {
        filename: serverFilename,
        transcript: transcript
      });

      const aiMarkers: MarkerData[] = response.data.scenes.map((s: any, i: number) => ({
        id: `ai-${i}`,
        timecode: s.timecode,
        type: 'ai',
        description: s.description,
        thumbnail: '🖼️',
        inRecap: false
      }));

      setMarkers(aiMarkers);
      setProcessingProgress(100);
      addLog(`Visual analysis complete: ${aiMarkers.length} relevant scenes identified`, "success");

      setTimeout(() => {
        setIsProcessing(false);
        setProcessingProgress(0);
        setCurrentStep('script');
      }, 800);
    } catch (error) {
      console.error("Scene analysis failed:", error);
      addLog("Visual analysis failed. Check server logs.", "warning");
      setIsProcessing(false);
    }
  };

  // --- НОВЫЙ РЕЖИМ: Ручная генерация через чат-боты ---
  const runScriptGenerationManual = () => {
    if (transcript.length === 0 || markers.length === 0) {
      addLog("Analysis required: Need both transcript and visual scenes.", "warning");
      return;
    }
    setShowAIModal(true);
  };

  // Обработчик результата из модального окна
  const handleAIResult = (data: any) => {
    try {
      const { segments } = data;

      if (!segments || segments.length === 0) {
        throw new Error("No segments found in AI response");
      }

      // Создаем синие блоки на таймлайне
      setClips(segments.map((s: any) => ({
        id: `clip-${s.id}`,
        startTime: s.start_time,
        endTime: s.end_time
      })));

      // Заполняем карточки сценария
      setScriptSegments(segments.map((s: any) => ({
        id: `seg-${s.id}`,
        text: s.narrator_text,
        linkedClipId: `clip-${s.id}`
      })));

      addLog(`Success: Applied ${segments.length}-scene storyboard from manual AI`, "success");
      setCurrentStep('voice');
      setShowAIModal(false);
    } catch (error) {
      console.error("Failed to apply AI result:", error);
      addLog("Error applying AI result. Check JSON format.", "warning");
    }
  };

  // --- АВТОМАТИЧЕСКИЙ РЕЖИМ: Генерация через бэкенд ---
  const runScriptGenerationAuto = async () => {
    if (transcript.length === 0 || markers.length === 0) {
      addLog("Analysis required: Need both transcript and visual scenes.", "warning");
      return;
    }

    setIsProcessing(true);
    setProcessingProgress(15);
    setProcessingTask("DeepSeek AI is writing your script...");
    addLog("Sending transcript and visual context to AI...", "info");

    try {
      const response = await axios.post(`${API_BASE_URL}/generate_script`, {
        transcript: transcript,
        markers: markers
      });

      const { segments } = response.data;

      if (!segments || segments.length === 0) {
        throw new Error("AI returned empty storyboard");
      }

      setClips(segments.map((s: any) => ({
        id: `clip-${s.id}`,
        startTime: s.start_time,
        endTime: s.end_time
      })));

      setScriptSegments(segments.map((s: any) => ({
        id: `seg-${s.id}`,
        text: s.narrator_text,
        linkedClipId: `clip-${s.id}`
      })));

      setProcessingProgress(100);
      addLog(`Success: AI generated a ${segments.length}-scene storyboard`, "success");

      setTimeout(() => {
        setIsProcessing(false);
        setProcessingProgress(0);
        setCurrentStep('voice');
      }, 800);

    } catch (error) {
      console.error("Script generation failed:", error);
      addLog("AI Reasoning Error. Check API key and logs.", "warning");
      setIsProcessing(false);
    }
  };

  // Универсальный обработчик для кнопки "Generate Script"
  const runScriptGeneration = () => {
    const hasAutoAccess = localStorage.getItem('ai_auto_mode') === 'true';
    if (hasAutoAccess) {
      runScriptGenerationAuto();
    } else {
      runScriptGenerationManual();
    }
  };

 // В App.tsx, функция handleGenerateVoice:
const handleExportVertical = async (settings: VoiceSettings) => {
  if (clips.length === 0 || !serverFilename) return;

  setIsProcessing(true);
  setProcessingTask("Rendering vertical TikTok video...");

  try {
    const renderPayload: any = {
      filename: serverFilename,
      clips: clips
    };

    if (clipAudios && clipAudios.length > 0) {
      renderPayload.clip_audios = clipAudios;
    }

    const response = await axios.post(`${API_BASE_URL}/render_vertical`, renderPayload);

    addLog("VERTICAL RECAP FINISHED! Downloading...", "success");

    const link = document.createElement('a');
    link.href = `http://localhost:8000${response.data.recap_url}`;
    link.setAttribute('download', 'recap_vertical.mp4');
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (error) {
    addLog("Vertical render failed.", "warning");
  } finally {
    setIsProcessing(false);
  }
};
const handleGenerateVoice = async (settings: VoiceSettings) => {
  if (scriptSegments.length === 0) return;

  setIsProcessing(true);
  setProcessingTask("Synthesizing neural voice...");
  setAudioPreviewUrl(null);

  try {
    // 🔥 Формируем сегменты с timing для per-clip режима
    const segmentsWithTiming = scriptSegments.map(seg => {
      const linkedClip = clips.find(c => c.id === seg.linkedClipId);
      return {
        id: seg.id,
        text: seg.text,
        startTime: linkedClip?.startTime || 0,
        endTime: linkedClip?.endTime || 0
      };
    });

    const response = await axios.post(`${API_BASE_URL}/synthesize_voice`, {
      segments: segmentsWithTiming,  // 🔥 С timing!
      settings: {
        voiceType: settings.voiceType,
        speed: settings.speed,
        pitch: settings.pitch
      }
    });

    if (response.data.mode === 'per_clip') {
      // 🔥 Per-clip режим: сохраняем список аудио-клипов для рендера
      setServerTtsFilename(null); // Сбрасываем legacy filename
      setClipAudios(response.data.clips); // 🔥 Новый state для per-clip аудио
      setAudioPreviewUrl(`http://localhost:8000${response.data.clips[0]?.audio_url}`);
    } else {
      // Legacy режим
      const filename = response.data.filename;
      setServerTtsFilename(filename);
      setClipAudios([]);
      setAudioPreviewUrl(`http://localhost:8000${response.data.audio_url}`);
    }

    setProcessingProgress(100);
    addLog("Voiceover ready!", "success");
  } catch (error) {
    console.error("TTS Error:", error);
    addLog("Voice synthesis failed.", "warning");
  } finally {
    setTimeout(() => setIsProcessing(false), 1000);
  }
};

  // В App.tsx, функция handleExport:
// В App.tsx, функция handleExport:

const handleExport = async () => {
  if (clips.length === 0 || !serverFilename) return;
  setIsProcessing(true);
  setProcessingTask("Rendering final video...");

  try {
    const renderPayload: any = {
      filename: serverFilename,
      clips: clips
    };

    // 🔥 Отправляем per-clip аудио с ПРАВИЛЬНЫМИ ключами (snake_case)
    if (clipAudios && clipAudios.length > 0) {
      renderPayload.clip_audios = clipAudios.map(ca => ({
        clip_id: ca.clip_id,           // ✅ snake_case
        audio_url: ca.audio_url,       // ✅
        filename: ca.filename,         // ✅
        duration: ca.duration,         // ✅
        clip_start: ca.clip_start,     // ✅
        clip_end: ca.clip_end,         // ✅
        text_preview: ca.text_preview, // ✅
        speed_used: ca.speed_used      // ✅
      }));
    } else if (serverTtsFilename) {
      // Legacy режим
      renderPayload.tts_filename = serverTtsFilename;
    }

    const response = await axios.post(`${API_BASE_URL}/render`, renderPayload);

    addLog("RECAP FINISHED! Downloading...", "success");

    const downloadUrl = `http://localhost:8000${response.data.recap_url}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', 'recap.mp4');
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (error) {
    console.error("Render error:", error);
    addLog("Render failed.", "warning");
  } finally {
    setIsProcessing(false);
  }
};
  const handleStepClick = (step: string) => {
    if (step === 'upload') fileInputRef.current?.click();
    else if (step === 'transcribe') {
      if (transcript.length > 0) setCurrentStep('transcribe');
      else runTranscription();
    } else if (step === 'analyze') {
      if (markers.length > 0) setCurrentStep('analyze');
      else runSceneAnalysis();
    } else if (step === 'script') {
      if (scriptSegments.length > 0) setCurrentStep('script');
      else runScriptGeneration();
    } else setCurrentStep(step);
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-white flex flex-col font-sans relative">
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="video/*" style={{ display: 'none', opacity: 0, position: 'absolute', zIndex: -1 }} />

      <TopToolbar currentStep={currentStep} onStepClick={handleStepClick} isProcessing={isProcessing} hasVideo={!!videoUrl} />

      <div className="flex-1 min-h-0 overflow-hidden bg-[#F8F9FA]">
        <ResizablePanelGroup direction="horizontal" className="h-full">

          {/* ЛЕВАЯ ЧАСТЬ: ВИДЕО + ТАЙМЛАЙН */}
          <ResizablePanel defaultSize={70} minSize={40} className="flex flex-col min-h-0">
            <ResizablePanelGroup direction="vertical">
              <ResizablePanel defaultSize={60} minSize={30}>
                <div className="h-full overflow-hidden bg-white">
                  <VideoPlayer
                    videoUrl={videoUrl}
                    currentTime={currentTime}
                    duration={duration}
                    onTimeUpdate={setCurrentTime}
                    onDurationChange={setDuration}
                  />
                </div>
              </ResizablePanel>

              <ResizableHandle className="h-1 bg-[#DADCE0] hover:bg-[#1A73E8] transition-all cursor-row-resize" />

              <ResizablePanel defaultSize={40} minSize={20}>
                <div className="h-full bg-white overflow-hidden">
                  <Timeline
                    videoUrl={videoUrl}
                    audioUrl={audioUrl}
                    currentTime={currentTime}
                    duration={duration}
                    onTimeUpdate={setCurrentTime}
                    selectedMarker={selectedMarker}
                    onMarkerSelect={setSelectedMarker}
                    clips={clips}
                    onClipsChange={setClips}
                    selectedClipId={selectedClipId}
                    onClipSelect={(id) => {
                      setSelectedClipId(id);
                      if (bindingSegmentId && id) handleBindClipToSegment(id);
                    }}
                    markers={markers}
                  />
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>

          <ResizableHandle className="w-1 bg-[#DADCE0] hover:bg-[#1A73E8] transition-all cursor-col-resize" />

          {/* ПРАВАЯ ЧАСТЬ: ТАБЫ + ЛОГИ (РАЗДЕЛЕНЫ ВЕРТИКАЛЬНО) */}
          <ResizablePanel defaultSize={30} minSize={25} maxSize={45} className="flex flex-col min-h-0">
            <ResizablePanelGroup direction="vertical">

              {/* ВЕРХ: САЙДБАР (Транскрипт, Редактор и т.д.) */}
              <ResizablePanel defaultSize={70} minSize={30}>
                <div className="h-full flex flex-col min-h-0 bg-white overflow-hidden">
                  <RightSidebar
                    currentTime={currentTime}
                    onTimeSeek={setCurrentTime}
                    selectedMarker={selectedMarker}
                    onMarkerSelect={setSelectedMarker}
                    clips={clips}
                    scriptSegments={scriptSegments}
                    onScriptSegmentsChange={setScriptSegments}
                    selectedClipId={selectedClipId}
                    onClipSelect={setSelectedClipId}
                    transcript={transcript}
                    markers={markers}
                    onMarkersChange={setMarkers}
                    bindingSegmentId={bindingSegmentId}
                    onBindingSegmentChange={setBindingSegmentId}
                    clipCount={clips.length}
                    totalDuration={formatDuration(totalClipsDuration)}
                    onGenerateVoice={handleGenerateVoice}
                    onExport={handleExport}
                    onExportVertical={handleExportVertical}
                    isProcessing={isProcessing}
                    processingProgress={processingProgress}
                    onTranscriptChange={setTranscript}
                  />
                </div>
              </ResizablePanel>

              <ResizableHandle className="h-1 bg-[#DADCE0] hover:bg-[#1A73E8] transition-all cursor-row-resize" />

              {/* НИЗ: ПАНЕЛЬ СТАТУСА И ЛОГОВ */}
              <ResizablePanel defaultSize={30} minSize={15}>
                <div className="h-full bg-white overflow-hidden">
                  <StatusPanel
                    logs={logs}
                    keyframes={keyframes}
                    isProcessing={isProcessing}
                    processingProgress={processingProgress}
                    processingTask={processingTask}
                    onKeyframeClick={(time) => setCurrentTime(time)}
                  />
                </div>
              </ResizablePanel>

            </ResizablePanelGroup>
          </ResizablePanel>

        </ResizablePanelGroup>
      </div>

      {/* Модальное окно для ручного режима */}
      {showAIModal && (
        <AIManualModal
          transcript={transcript}
          markers={markers}
          onClose={() => setShowAIModal(false)}
          onResult={handleAIResult}
        />
      )}
    </div>
  );
}