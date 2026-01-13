import React, { useState, useRef, useMemo } from 'react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from './components/ui/resizable';
import { TopToolbar } from './components/TopToolbar';
import { VideoPlayer } from './components/VideoPlayer';
import { Timeline } from './components/Timeline';
import { RightSidebar } from './components/RightSidebar';
import { StatusPanel, LogEntry, KeyFrame } from './components/StatusPanel';
import { TranscriptLine, MarkerData } from './components/TranscriptPanel';
import { VoiceSettings } from './components/VoiceExportPanel';

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

export default function App() {
  // --- Состояние видео и времени ---
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // --- Состояние UI и Workflow ---
  const [currentStep, setCurrentStep] = useState<string>('upload');
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [bindingSegmentId, setBindingSegmentId] = useState<string | null>(null);

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
      addLog(`Linked: Script segment attached to Clip #${clipId.split('-')[1] || clipId}`, 'success');
    }
  };

  // --- Обработчики событий ---

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setCurrentStep('transcribe');
      addLog(`Video "${file.name}" uploaded. Metadata analyzed.`, 'success');
      setProcessingTask('Ready for transcription');
    }
  };

  const handleStepClick = (step: string) => {
    if (step === 'upload') {
      fileInputRef.current?.click();
    } else {
      setCurrentStep(step);
      addLog(`Stage changed to: ${step.toUpperCase()}`, 'info');
    }
  };

  const handleGenerateVoice = (settings: VoiceSettings) => {
    if (scriptSegments.length === 0) {
      addLog("Cannot generate voice: script is empty", "warning");
      return;
    }
    setIsProcessing(true);
    setProcessingProgress(20);
    setProcessingTask("Connecting to Voice AI...");
    addLog(`Initiated TTS generation (${settings.voiceType})`, 'processing');

    setTimeout(() => {
      setProcessingProgress(100);
      setIsProcessing(false);
      addLog("Voiceover generated successfully", "success");
    }, 2000);
  };

  const handleExport = (settings: VoiceSettings) => {
    if (clips.length === 0) {
      addLog("Export failed: No clips selected on timeline", "warning");
      return;
    }
    addLog("Rendering pipeline started. Preparing final recap.mp4...", "processing");
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-white flex flex-col font-sans relative">

      {/*
          ПОЛНОЕ СКРЫТИЕ ИНПУТА
          Используем display: none и абсолютное позиционирование вне экрана,
          чтобы браузер не рендерил текст "Файл не выбран"
      */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="video/*"
        style={{
          display: 'none',
          opacity: 0,
          position: 'absolute',
          zIndex: -1
        }}
      />

      {/* Top Toolbar */}
      <TopToolbar
        currentStep={currentStep}
        onStepClick={handleStepClick}
        isProcessing={isProcessing}
        hasVideo={!!videoUrl}
      />

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">

          {/* Левая часть: Плеер и Таймлайн */}
          <ResizablePanel defaultSize={70} minSize={50}>
            <div className="h-full flex flex-col bg-[#F8F9FA]">
              <div className="flex-1 overflow-hidden">
                <VideoPlayer
                  videoUrl={videoUrl}
                  currentTime={currentTime}
                  duration={duration}
                  onTimeUpdate={setCurrentTime}
                  onDurationChange={setDuration}
                />
              </div>

              <div className="h-[300px] border-t border-[#DADCE0]">
                <Timeline
                  videoUrl={videoUrl}
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
                />
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle className="w-1 bg-[#DADCE0] hover:bg-[#1A73E8] transition-colors" />

          {/* Правая часть: Правая панель с табами и Панель статуса */}
          <ResizablePanel defaultSize={30} minSize={25} maxSize={40}>
            <div className="h-full flex flex-col min-w-0">

              <div className="flex-1 overflow-hidden">
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
                  isProcessing={isProcessing}
                  processingProgress={processingProgress}
                />
              </div>

              <div className="h-[250px] border-t border-[#DADCE0]">
                <StatusPanel
                  logs={logs}
                  keyframes={keyframes}
                  isProcessing={isProcessing}
                  processingProgress={processingProgress}
                  processingTask={processingTask}
                  onKeyframeClick={(time) => setCurrentTime(time)}
                />
              </div>
            </div>
          </ResizablePanel>

        </ResizablePanelGroup>
      </div>
    </div>
  );
}