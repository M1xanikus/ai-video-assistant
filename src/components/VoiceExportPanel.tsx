import React, { useState } from 'react';
import { Play, Pause, Download, Sparkles, AudioLines, FileVideo, Settings2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Slider } from './ui/slider';
import { Progress } from './ui/progress';
import { ScrollArea } from './ui/scroll-area';

interface VoiceExportPanelProps {
  clipCount: number;
  totalDuration: string;
  onGenerateVoice: (settings: VoiceSettings) => void;
  onExport: (settings: VoiceSettings) => void;
  isProcessing: boolean;
  processingProgress: number;
}

export interface VoiceSettings {
  voiceType: string;
  speed: number;
  pitch: number;
}

export function VoiceExportPanel({
  clipCount = 4,
  totalDuration = "02:30",
  onGenerateVoice,
  onExport,
  isProcessing,
  processingProgress
}: VoiceExportPanelProps) {
  const [isGenerated, setIsGenerated] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const [voiceType, setVoiceType] = useState('male-1');
  const [speed, setSpeed] = useState([1.0]);
  const [pitch, setPitch] = useState([1.0]);

  const handleGenerateClick = () => {
    if (onGenerateVoice) {
      onGenerateVoice({ voiceType, speed: speed[0], pitch: pitch[0] });
    }
    setIsGenerated(true);
  };

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* 1. Верхняя часть с прокруткой для настроек и превью */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-10"> {/* Увеличили общий шаг между глобальными блоками */}

          {/* Секция: Voice Engine Settings */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 border-b border-[#DADCE0] pb-3">
              <Settings2 className="w-4 h-4 text-[#1A73E8]" />
              <h3 className="font-medium text-[#202124]">Voice Engine Settings</h3>
            </div>

            {/* Выбор голоса */}
            <div className="space-y-2">
              <label className="text-[13px] text-[#5F6368] font-medium">Narrator Voice</label>
              <Select value={voiceType} onValueChange={setVoiceType}>
                <SelectTrigger className="w-full bg-[#F8F9FA] border-[#DADCE0] h-10">
                  <SelectValue placeholder="Select voice" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male-1">👨‍💼 Professional Male (Standard)</SelectItem>
                  <SelectItem value="male-2">🎙️ Deep Radio Male</SelectItem>
                  <SelectItem value="female-1">👩‍💼 Professional Female</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Группа ползунков */}
            <div className="space-y-8"> {/* Увеличили расстояние между самими ползунками */}
                {/* Скорость */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-[13px]">
                    <span className="text-[#5F6368]">Speech Rate</span>
                    <span className="text-[#1A73E8] bg-[#E8F0FE] px-2 py-0.5 rounded font-mono text-xs font-bold">
                      {speed[0].toFixed(1)}x
                    </span>
                  </div>
                  <div className="px-1">
                    <Slider
                      value={speed}
                      onValueChange={setSpeed}
                      min={0.5}
                      max={2.0}
                      step={0.1}
                    />
                  </div>
                </div>

                {/* Тон */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-[13px]">
                    <span className="text-[#5F6368]">Voice Pitch</span>
                    <span className="text-[#1A73E8] bg-[#E8F0FE] px-2 py-0.5 rounded font-mono text-xs font-bold">
                      {pitch[0].toFixed(1)}x
                    </span>
                  </div>
                  <div className="px-1">
                    <Slider
                      value={pitch}
                      onValueChange={setPitch}
                      min={0.5}
                      max={2.0}
                      step={0.1}
                    />
                  </div>
                </div>
            </div>

            {/* БЛОК КНОПКИ ГЕНЕРАЦИИ с увеличенным отступом */}
            <div className="mt-12 pt-6 border-t border-dashed border-[#DADCE0]">
                <button
                  onClick={handleGenerateClick}
                  disabled={isProcessing}
                  className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-[#202124] text-white font-bold hover:bg-black transition-all active:scale-[0.98] disabled:opacity-50 shadow-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  Generate Voiceover
                </button>

                {isProcessing && (
                  <div className="mt-4 space-y-2">
                    <Progress value={processingProgress} className="h-1.5" />
                    <p className="text-[11px] text-center text-[#5F6368] italic">AI is processing audio...</p>
                  </div>
                )}
            </div>
          </div>

          {/* Voice Preview */}
          {(isGenerated || isProcessing) && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2">
                <AudioLines className="w-4 h-4 text-[#1A73E8]" />
                <h3 className="font-medium text-[#202124] text-sm">Voice Preview</h3>
              </div>
              <div className="bg-[#F8F9FA] rounded-xl border border-[#DADCE0] p-4 group">
                <div className="flex items-end gap-1 h-10 mb-4 overflow-hidden">
                  {Array.from({ length: 32 }, (_, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-[#1A73E8]/30 rounded-full group-hover:bg-[#1A73E8]/50 transition-all"
                      style={{ height: `${20 + Math.sin(i * 0.5) * 60 + Math.random() * 20}%` }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="w-9 h-9 rounded-full bg-[#1A73E8] flex items-center justify-center text-white hover:bg-[#1557B0] transition-colors shadow-sm"
                  >
                    {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
                  </button>
                  <div className="flex-1 text-xs font-mono text-[#5F6368]">
                    0:00 / {totalDuration}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* 2. Фиксированный блок экспорта внизу */}
      <div className="p-4 bg-white border-t border-[#DADCE0] space-y-4 shadow-[0_-4px_12px_rgba(0,0,0,0.03)]">
        <div className="bg-[#F8F9FA] border border-[#DADCE0] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3 border-b border-[#DADCE0]/50 pb-2">
            <FileVideo className="w-4 h-4 text-[#5F6368]" />
            <span className="text-[11px] font-bold text-[#5F6368] uppercase tracking-wider">Recap Manifest</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-[#5F6368]">Selected Scenes:</span>
              <span className="font-bold text-[#202124]">{clipCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#5F6368]">Final Length:</span>
              <span className="font-bold text-[#202124] font-mono">{totalDuration}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#5F6368]">Resolution:</span>
              <span className="font-bold text-[#202124]">1080p (HD)</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => onExport?.({ voiceType, speed: speed[0], pitch: pitch[0] })}
          className="w-full h-14 flex items-center justify-center gap-3 rounded-xl bg-[#1A73E8] text-white font-bold text-sm shadow-lg hover:bg-[#1557B0] transition-all active:scale-[0.97]"
        >
          <Download size={20} />
          Render Recap
        </button>
      </div>
    </div>
  );
}