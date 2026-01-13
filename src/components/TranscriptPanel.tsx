import React from 'react';
import { ScrollArea } from './ui/scroll-area';
import { Plus, Sparkles, Check } from 'lucide-react';

// Экспортируем интерфейсы для App.tsx
export interface TranscriptLine {
  id: string;
  timecode: number;
  text: string;
}

export interface MarkerData {
  id: string;
  timecode: number;
  type: 'ai' | 'user';
  description: string;
  thumbnail: string;
  inRecap: boolean;
}

interface TranscriptPanelProps {
  currentTime: number;
  onTimeSeek: (time: number) => void;
  selectedMarker: string | null;
  onMarkerSelect: (id: string | null) => void;
  // Добавляем новые пропсы для реальных данных
  transcript: TranscriptLine[];
  markers: MarkerData[];
  onMarkersChange: (markers: MarkerData[]) => void;
}

export function TranscriptPanel({
  currentTime,
  onTimeSeek,
  selectedMarker,
  onMarkerSelect,
  transcript,
  markers,
  onMarkersChange
}: TranscriptPanelProps) {

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleMarkerInRecap = (markerId: string) => {
    const updatedMarkers = markers.map(m =>
      m.id === markerId ? { ...m, inRecap: !m.inRecap } : m
    );
    onMarkersChange(updatedMarkers);
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Секция Транскрибации */}
      <div className="flex-1 border-b border-[#DADCE0] flex flex-col min-h-0">
        <div className="px-4 py-3 border-b border-[#DADCE0] bg-[#F8F9FA] flex justify-between items-center">
          <h3 className="font-medium text-[#202124]">Transcript</h3>
          <span className="text-[10px] text-[#5F6368] font-mono uppercase">Whisper AI</span>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2">
            {transcript.length === 0 ? (
              <div className="p-12 text-center text-sm text-[#BDC1C6] italic">
                No transcription available yet. Start the process from the toolbar.
              </div>
            ) : (
              transcript.map((line, index) => {
                // Определяем, является ли эта строка активной в данный момент
                const isCurrent = currentTime >= line.timecode &&
                                 (index === transcript.length - 1 || currentTime < transcript[index + 1].timecode);

                return (
                  <div
                    key={line.id}
                    onClick={() => onTimeSeek(line.timecode)}
                    className={`
                      p-3 mb-1 rounded-lg cursor-pointer transition-all border-l-2
                      ${isCurrent 
                        ? 'bg-[#E8F0FE] border-[#1A73E8] shadow-sm' 
                        : 'border-transparent hover:bg-[#F1F3F4]'
                      }
                    `}
                  >
                    <div className={`text-[10px] font-mono mb-1 ${isCurrent ? 'text-[#1A73E8]' : 'text-[#5F6368]'}`}>
                      {formatTime(line.timecode)}
                    </div>
                    <div className={`text-sm leading-relaxed ${isCurrent ? 'text-[#202124] font-medium' : 'text-[#5F6368]'}`}>
                      {line.text}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Секция Маркеров (Scene Manager) */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-4 py-3 border-b border-[#DADCE0] bg-[#F8F9FA] flex justify-between items-center">
          <div>
            <h3 className="font-medium text-[#202124]">Marker Manager</h3>
            <p className="text-[10px] text-[#1A73E8] font-medium">
              {markers.filter(m => m.inRecap).length} scenes selected for recap
            </p>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2">
            {markers.length === 0 ? (
              <div className="p-12 text-center text-sm text-[#BDC1C6] italic">
                AI hasn't analyzed scenes yet.
              </div>
            ) : (
              markers.map((marker) => {
                const isSelected = marker.id === selectedMarker;
                const isAI = marker.type === 'ai';

                return (
                  <div
                    key={marker.id}
                    onClick={() => {
                      onMarkerSelect(marker.id);
                      onTimeSeek(marker.timecode);
                    }}
                    className={`
                      p-3 mb-2 rounded-lg cursor-pointer transition-all border
                      ${isSelected 
                        ? 'bg-[#E8F0FE] border-[#1A73E8] ring-1 ring-[#1A73E8]' 
                        : 'bg-white border-[#DADCE0] hover:border-[#BDC1C6]'
                      }
                    `}
                  >
                    <div className="flex items-start gap-3">
                      {/* Миниатюра */}
                      <div className={`
                        w-16 h-12 rounded flex items-center justify-center text-2xl flex-shrink-0 border border-black/5
                        ${isAI ? 'bg-[#FFF4E5]' : 'bg-[#E8F0FE]'}
                      `}>
                        {marker.thumbnail.length < 5 ? marker.thumbnail : <img src={marker.thumbnail} className="w-full h-full object-cover rounded" alt=""/>}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-mono font-bold text-[#5F6368]">
                            {formatTime(marker.timecode)}
                          </span>
                          {isAI && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#FA7B17] text-white uppercase tracking-wider">
                              <Sparkles className="w-2 h-2" />
                              AI Match
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-[#202124] mb-2 truncate">
                          {marker.description}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleMarkerInRecap(marker.id);
                          }}
                          className={`
                            inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-semibold transition-all
                            ${marker.inRecap
                              ? 'bg-[#1A73E8] text-white'
                              : 'bg-[#F1F3F4] text-[#202124] hover:bg-[#E8EAED]'
                            }
                          `}
                        >
                          {marker.inRecap ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                          {marker.inRecap ? 'In Recap' : 'Add to Recap'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}