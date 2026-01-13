import React, { useEffect, useRef } from 'react';
import { ScrollArea } from './ui/scroll-area';
import { Activity, CheckCircle, Clock, AlertCircle, ImageIcon } from 'lucide-react';
import { Progress } from './ui/progress';

// Экспортируем интерфейсы, чтобы App.tsx мог их использовать
export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'success' | 'info' | 'processing' | 'warning';
}

export interface KeyFrame {
  id: string;
  time: number;
  thumbnail: string; // Это будет либо URL, либо Base64 строка от ИИ
}

interface StatusPanelProps {
  logs: LogEntry[];
  keyframes: KeyFrame[];
  isProcessing: boolean;
  processingProgress: number;
  processingTask: string;
  onKeyframeClick?: (time: number) => void;
}

export function StatusPanel({
  logs,
  keyframes,
  isProcessing,
  processingProgress,
  processingTask,
  onKeyframeClick
}: StatusPanelProps) {

  const scrollRef = useRef<HTMLDivElement>(null);

  // Авто-скролл логов вниз при добавлении новых записей
  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
      }
    }
  }, [logs]);

  const getLogIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'info':
        return <Activity className="w-4 h-4 text-[#1A73E8]" />;
      case 'processing':
        return <Clock className="w-4 h-4 text-[#FA7B17] animate-pulse" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-600" />;
    }
  };

  return (
    <div className="h-full bg-white flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#DADCE0] flex items-center justify-between bg-[#F8F9FA]">
        <h3 className="font-medium text-[#202124]">Status & Assets</h3>
        <div className="flex items-center gap-2">
           <span className="text-[10px] bg-[#E8EAED] px-2 py-0.5 rounded text-[#5F6368] font-mono">
             LOGS: {logs.length}
           </span>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Индикатор активного процесса ИИ */}
        {isProcessing && (
          <div className="p-4 bg-[#E8F0FE] border-b border-[#1A73E8] transition-all">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-[#1A73E8] animate-pulse" />
              <span className="text-sm font-medium text-[#202124]">{processingTask}</span>
            </div>
            <Progress value={processingProgress} className="h-2" />
            <p className="text-xs text-[#5F6368] mt-2">
              {processingProgress}% complete
            </p>
          </div>
        )}

        {/* Activity Log - Список системных сообщений */}
        <div className="flex-1 border-b border-[#DADCE0] flex flex-col min-h-0">
          <div className="px-4 py-2 bg-[#F8F9FA] border-b border-[#DADCE0]">
            <h4 className="text-xs font-semibold text-[#5F6368] uppercase tracking-wider">Activity Log</h4>
          </div>
          <ScrollArea ref={scrollRef} className="flex-1">
            <div className="p-2 space-y-1">
              {logs.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#BDC1C6] italic">
                  No activities recorded yet
                </div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-2 p-2 rounded hover:bg-[#F8F9FA] transition-colors"
                  >
                    <div className="mt-0.5 shrink-0">{getLogIcon(log.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-[#5F6368] font-mono mb-0.5">
                        [{log.timestamp}]
                      </div>
                      <div className="text-sm text-[#202124] leading-tight break-words">{log.message}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Extracted Keyframes - Найденные ИИ сцены */}
        <div className="h-[120px] shrink-0 flex flex-col bg-white">
          <div className="px-4 py-2 bg-[#F8F9FA] border-b border-[#DADCE0] flex justify-between items-center">
            <h4 className="text-xs font-semibold text-[#5F6368] uppercase tracking-wider">Extracted Keyframes</h4>
            <ImageIcon className="w-3 h-3 text-[#BDC1C6]" />
          </div>
          <ScrollArea className="flex-1" orientation="horizontal">
            <div className="flex gap-3 p-3 min-w-full">
              {keyframes.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-[10px] text-[#BDC1C6] uppercase">
                  No frames extracted
                </div>
              ) : (
                keyframes.map((kf) => (
                  <div
                    key={kf.id}
                    onClick={() => onKeyframeClick?.(kf.time)}
                    className="flex-shrink-0 group cursor-pointer"
                  >
                    <div className="w-20 h-14 bg-[#F1F3F4] rounded border border-[#DADCE0] overflow-hidden flex items-center justify-center relative hover:border-[#1A73E8] transition-all">
                      {/* Если в thumbnail строка, похожая на emoji (как в моке) — выводим текст, иначе <img> */}
                      {kf.thumbnail.length < 5 ? (
                        <span className="text-2xl">{kf.thumbnail}</span>
                      ) : (
                        <img src={kf.thumbnail} alt={`Frame at ${kf.time}`} className="w-full h-full object-cover" />
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                    </div>
                    <div className="text-[10px] text-center text-[#5F6368] mt-1 font-mono font-medium">
                      {Math.floor(kf.time / 60)}:{String(Math.floor(kf.time % 60)).padStart(2, '0')}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}