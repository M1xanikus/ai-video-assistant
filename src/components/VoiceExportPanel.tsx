import React, { useState, useEffect } from 'react';
import { Play, Pause, Download, Sparkles, AudioLines, FileVideo, Settings2, Loader2, Smartphone } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Slider } from './ui/slider';
import { Progress } from './ui/progress';
import { ScrollArea } from './ui/scroll-area';

export interface VoiceSettings {
  voiceType: string;
  speed: number;
  pitch: number;
}

interface VoiceExportPanelProps {
  clipCount: number;
  totalDuration: string;
  onGenerateVoice: (settings: VoiceSettings) => void;
  onExport: (settings: VoiceSettings) => void;
  onExportVertical?: (settings: VoiceSettings) => void;
  isProcessing: boolean;
  processingProgress: number;
}

export function VoiceExportPanel({
  clipCount,
  totalDuration,
  onGenerateVoice,
  onExport,
  onExportVertical,
  isProcessing,
  processingProgress
}: VoiceExportPanelProps) {
  // Локальные состояния интерфейса
  const [isGenerated, setIsGenerated] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Настройки синтеза
  const [voiceType, setVoiceType] = useState('male-ru-1');
  const [speed, setSpeed] = useState([1.3]);
  const [pitch, setPitch] = useState([0]);

  // Сбрасываем флаг "сгенерировано" при смене настроек
  useEffect(() => {
    setIsGenerated(false);
  }, [voiceType, speed, pitch]);

  // Обработчик генерации
  const handleGenerateClick = () => {
    onGenerateVoice({
      voiceType,
      speed: speed[0],
      pitch: pitch[0]
    });

    if (!isProcessing) {
      setTimeout(() => setIsGenerated(true), 2500);
    }
  };

  // Форматируем pitch для отображения
  const formatPitch = (value: number) => {
    if (value === 0) return 'Normal';
    return value > 0 ? `+${value} st` : `${value} st`;
  };

  // Подписи для скорости
  const getSpeedLabel = (value: number) => {
    if (value < 1.0) return 'Slow';
    if (value === 1.0) return 'Normal';
    if (value < 1.3) return 'Fast';
    return 'Very Fast';
  };

  // 🔧 Проверка: активна ли кнопка вертикального экспорта
  const isVerticalDisabled = !onExportVertical || clipCount === 0 || isProcessing;

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden relative">

      {/* 1. Настройки и превью (скроллируемая часть) */}
      <ScrollArea className="flex-1 w-full" type="auto">
        <div className="h-full w-full">
          <div className="p-4 space-y-10 min-h-full pb-56">

            {/* Секция настроек голоса */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-b border-[#DADCE0] pb-3">
                <Settings2 className="w-4 h-4 text-[#1A73E8] flex-shrink-0" />
                <h3 className="font-medium text-[#202124]">Voice Engine Settings</h3>
              </div>

              {/* Выбор диктора */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase text-[#5F6368] tracking-wider">Narrator Voice</label>
                <Select value={voiceType} onValueChange={setVoiceType}>
                  <SelectTrigger className="w-full bg-[#F8F9FA] border-[#DADCE0] h-10">
                    <SelectValue placeholder="Select voice" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male-ru-1">👨‍💼 Dmitry (RU Male)</SelectItem>
                    <SelectItem value="female-ru-1">👩‍💼 Svetlana (RU Female)</SelectItem>
                    <SelectItem value="male-en-1">🎙️ Andrew (EN Male)</SelectItem>
                    <SelectItem value="female-en-1">🎭 Sonia (EN Female)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Слайдеры параметров */}
              <div className="space-y-8">
                {/* Скорость речи */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[13px] text-[#5F6368] font-medium">Speech Rate</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-[#9AA0A6] uppercase">
                        {getSpeedLabel(speed[0])}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-[#1A73E8] bg-[#E8F0FE] px-2 py-0.5 rounded">
                        {speed[0].toFixed(1)}x
                      </span>
                    </div>
                  </div>
                  <div className="px-1">
                    <Slider
                      value={speed}
                      onValueChange={setSpeed}
                      min={0.8}
                      max={2.0}
                      step={0.1}
                      className="py-2"
                    />
                    <div className="flex justify-between mt-1 px-1">
                      <span className="text-[9px] text-[#9AA0A6]">0.8x</span>
                      <span className="text-[9px] text-[#9AA0A6]">1.0x</span>
                      <span className="text-[9px] text-[#1A73E8] font-medium">1.3x</span>
                      <span className="text-[9px] text-[#9AA0A6]">2.0x</span>
                    </div>
                  </div>
                </div>

                {/* Тон голоса (Pitch в полутонах) */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[13px] text-[#5F6368] font-medium">Voice Pitch</span>
                    <span className="text-[10px] font-mono font-bold text-[#1A73E8] bg-[#E8F0FE] px-2 py-0.5 rounded">
                      {formatPitch(pitch[0])}
                    </span>
                  </div>
                  <div className="px-1">
                    <Slider
                      value={pitch}
                      onValueChange={setPitch}
                      min={-12}
                      max={12}
                      step={1}
                      className="py-2"
                    />
                    <div className="flex justify-between mt-1 px-1">
                      <span className="text-[9px] text-[#9AA0A6]">-12</span>
                      <span className="text-[9px] text-[#9AA0A6]">0</span>
                      <span className="text-[9px] text-[#9AA0A6]">+12</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 🔥 Блок рекомендации по скорости */}
              <div className="bg-[#E8F0FE]/50 border border-[#1A73E8]/20 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#1A73E8] mt-0.5 flex-shrink-0" />
                  <p className="text-[10px] text-[#5F6368] leading-relaxed">
                    <span className="font-medium text-[#202124]">Pro tip:</span> For dynamic recaps, use <span className="font-mono font-bold text-[#1A73E8]">1.3-1.5x</span> speed. For tutorials, stick to <span className="font-mono font-bold text-[#1A73E8]">1.0-1.2x</span>.
                  </p>
                </div>
              </div>

              {/* Кнопка запуска синтеза */}
              <div className="mt-8 pt-6 border-t border-dashed border-[#DADCE0]">
                <button
                  onClick={handleGenerateClick}
                  disabled={isProcessing || clipCount === 0}
                  className={`w-full h-11 flex items-center justify-center gap-2 rounded-xl font-bold transition-all shadow-sm
                    ${isProcessing 
                      ? 'bg-[#E8EAED] text-[#9AA0A6] cursor-not-allowed' 
                      : 'bg-[#202124] text-white hover:bg-black active:scale-[0.98]'
                    }`}
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {isProcessing ? 'Synthesizing...' : 'Generate Voiceover'}
                </button>

                {isProcessing && (
                  <div className="mt-4 space-y-2">
                    <Progress value={processingProgress} className="h-1.5" />
                    <p className="text-[10px] text-center text-[#5F6368] italic font-medium">
                      AI is processing neural audio track...
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Превью голоса */}
            {(isGenerated || isProcessing) && (
              <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-2">
                  <AudioLines className="w-4 h-4 text-[#1A73E8] flex-shrink-0" />
                  <h3 className="font-medium text-[#202124] text-sm">Voice Preview</h3>
                </div>
                <div className="bg-[#F8F9FA] rounded-xl border border-[#DADCE0] p-4 group">
                  <div className="flex items-end gap-1 h-10 mb-4 overflow-hidden px-1">
                    {Array.from({ length: 35 }, (_, i) => (
                      <div
                        key={i}
                        className="flex-1 bg-[#1A73E8]/30 rounded-full group-hover:bg-[#1A73E8]/50 transition-all duration-500"
                        style={{ height: isPlaying ? `${15 + Math.random() * 80}%` : `${20 + Math.sin(i * 0.5) * 40}%` }}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="w-9 h-9 rounded-full bg-[#1A73E8] flex items-center justify-center text-white hover:bg-[#1557B0] transition-colors shadow-md flex-shrink-0"
                    >
                      {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
                    </button>
                    <div className="flex-1 text-[11px] font-mono font-bold text-[#5F6368] truncate">
                      {isPlaying ? "PLAYING" : "0:00"} / {totalDuration}
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-[#DADCE0]/50">
                    <div className="flex items-center gap-1.5 text-[10px] text-[#5F6368]">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#34A853] flex-shrink-0" />
                      <span className="truncate">Per-clip sync enabled • Constant speed</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* 2. Манифест и Финальный экспорт (фиксированный низ) */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-[#DADCE0] space-y-3 shadow-[0_-4px_15px_rgba(0,0,0,0.04)] z-50">

        {/* Манифест */}
        <div className="bg-[#F8F9FA] border border-[#DADCE0] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3 border-b border-[#DADCE0]/50 pb-2">
            <FileVideo className="w-4 h-4 text-[#5F6368] flex-shrink-0" />
            <span className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest">Recap Manifest</span>
          </div>

          <div className="space-y-2.5 text-[12px]">
            <div className="flex justify-between items-center">
              <span className="text-[#5F6368]">Selected Scenes:</span>
              <span className="font-bold text-[#202124]">{clipCount} clips</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#5F6368]">Final Length:</span>
              <span className="font-bold text-[#1A73E8] font-mono">{totalDuration}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#5F6368]">Resolution:</span>
              <span className="font-bold text-[#202124]">1080p (HD)</span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-[#DADCE0]/30">
              <span className="text-[#5F6368]">Voice Speed:</span>
              <span className="font-bold text-[#1A73E8] font-mono">{speed[0].toFixed(1)}x</span>
            </div>
          </div>
        </div>

        {/* 🔥 Кнопка экспорта в вертикальный формат — ВСЕГДА видна, стиль по умолчанию */}
        <button
         onClick={() => onExportVertical?.({ voiceType, speed: speed[0], pitch: pitch[0] })}
          disabled={isVerticalDisabled}
          className={`w-full h-12 flex items-center justify-center gap-2.5 rounded-xl font-bold text-[13px] uppercase tracking-tight transition-all shadow-md active:scale-[0.98] mb-3
            ${isVerticalDisabled
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
              : 'bg-gradient-to-r from-pink-300 via-purple-300 to-indigo-300 text-black hover:from-pink-400 hover:via-purple-400 hover:to-indigo-400 hover:shadow-lg'
            }`}
        >
          <Smartphone size={18} className="flex-shrink-0" />
          <span className="truncate font-semibold">Export Vertical (9:16)</span>
          <span className="text-[10px] opacity-90 hidden sm:inline">TikTok/Reels</span>
        </button>

        {/* Основная кнопка экспорта (горизонтальный формат) */}
        <button
          onClick={() => onExport({ voiceType, speed: speed[0], pitch: pitch[0] })}
          disabled={clipCount === 0 || isProcessing}
          className={`w-full h-14 flex items-center justify-center gap-3 rounded-xl font-black text-sm uppercase tracking-tight transition-all shadow-lg active:scale-[0.97]
            ${clipCount === 0 || isProcessing
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
              : 'bg-[#1A73E8] text-white hover:bg-[#1557B0] hover:shadow-xl'
            }`}
        >
          <Download size={20} className="flex-shrink-0" />
          <span className="truncate">Render & Export Final Video</span>
        </button>
      </div>
    </div>
  );
}