import React, { useState, useEffect } from 'react';
import { OverlayScrollbarsComponent } from "overlayscrollbars-react";
import "overlayscrollbars/overlayscrollbars.css";
import { Plus, Sparkles, Check, MessageSquare, Bookmark, List, Tag } from 'lucide-react';

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
  transcript: TranscriptLine[];
  markers: MarkerData[];
  onMarkersChange: (markers: MarkerData[]) => void;
  onTranscriptChange: (transcript: TranscriptLine[]) => void;
}

export function TranscriptPanel({
  currentTime,
  onTimeSeek,
  selectedMarker,
  onMarkerSelect,
  transcript,
  markers,
  onMarkersChange,
  onTranscriptChange
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

  // Локальное состояние для управления редактированием
  const [localTranscript, setLocalTranscript] = useState<TranscriptLine[]>(transcript);
  const [isEditing, setIsEditing] = useState<{ [key: string]: boolean }>({});
  const [activeTab, setActiveTab] = useState<'transcript' | 'markers'>('transcript');

  // Синхронизация локального состояния с пропсами
  useEffect(() => {
    setLocalTranscript(transcript);
  }, [transcript]);

  const handleTextChange = (lineId: string, newText: string) => {
    setLocalTranscript(prev =>
      prev.map(line =>
        line.id === lineId
          ? { ...line, text: newText }
          : line
      )
    );
  };

  const handleTextBlur = (lineId: string) => {
    // Сохраняем изменения в родительское состояние
    onTranscriptChange(localTranscript);
    // Завершаем редактирование для этой строки
    setIsEditing(prev => ({ ...prev, [lineId]: false }));
  };

  const handleTextClick = (lineId: string) => {
    // Начинаем редактирование для этой строки
    setIsEditing(prev => ({ ...prev, [lineId]: true }));
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-white overflow-hidden font-sans">
      {/* Tab Navigation */}
      <div className="px-4 py-2 border-b border-[#DADCE0] bg-[#F8F9FA] flex gap-1">
        <button
          onClick={() => setActiveTab('transcript')}
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-t-md font-medium text-sm transition-all
            ${activeTab === 'transcript'
              ? 'bg-white text-[#202124] shadow-sm border border-[#DADCE0] border-b-white z-10'
              : 'text-[#5F6368] hover:bg-[#F1F3F4]'
            }
          `}
        >
          <List className="w-4 h-4" />
          Transcript
        </button>
        <button
          onClick={() => setActiveTab('markers')}
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-t-md font-medium text-sm transition-all
            ${activeTab === 'markers'
              ? 'bg-white text-[#202124] shadow-sm border border-[#DADCE0] border-b-white z-10'
              : 'text-[#5F6368] hover:bg-[#F1F3F4]'
            }
          `}
        >
          <Tag className="w-4 h-4" />
          Marker Manager ({markers.length})
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'transcript' ? (
          // TRANSCRIPT SECTION
          <div className="flex flex-col h-full">
            <div className="px-4 py-3 border-b border-[#DADCE0] bg-[#F8F9FA] flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#5F6368]" />
                <h3 className="font-medium text-[#202124]">Transcript</h3>
              </div>
              <span className="text-[10px] bg-[#E8F0FE] text-[#1A73E8] px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter">
                Whisper Small
              </span>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden">
              <OverlayScrollbarsComponent
                defer
                className="h-full w-full"
                options={{
                  scrollbars: {
                    autoHide: 'scroll',
                    visibility: 'auto'
                  }
                }}
              >
                <div className="p-2 h-full">
                  {localTranscript.length === 0 ? (
                    <div className="p-12 text-center text-sm text-[#BDC1C6] italic">
                      No transcription available yet. Start the process from the toolbar.
                    </div>
                  ) : (
                    localTranscript.map((line, index) => {
                      const isCurrent = currentTime >= line.timecode &&
                        (index === localTranscript.length - 1 || currentTime < localTranscript[index + 1].timecode);
                      const isEditingLine = isEditing[line.id] || false;

                      return (
                        <div
                          key={line.id}
                          onClick={() => onTimeSeek(line.timecode)}
                          className={`
                            p-3 mb-1 rounded-lg cursor-pointer transition-all
                            ${isCurrent
                              ? 'bg-[#E8F0FE] border-l-2 border-[#1A73E8]'
                              : 'hover:bg-[#F1F3F4] border-l-2 border-transparent'
                            }
                          `}
                        >
                          <div className={`text-xs mb-1 font-mono font-bold ${isCurrent ? 'text-[#1A73E8]' : 'text-[#5F6368]'}`}>
                            {formatTime(line.timecode)}
                          </div>
                          {isEditingLine ? (
                            <textarea
                              autoFocus
                              value={line.text}
                              onChange={(e) => handleTextChange(line.id, e.target.value)}
                              onBlur={() => handleTextBlur(line.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  handleTextBlur(line.id);
                                }
                              }}
                              className={`
                                w-full text-sm leading-relaxed bg-white resize-none outline-none
                                ${isCurrent ? 'text-[#202124] font-medium' : 'text-[#5F6368]'}
                                border border-[#1A73E8] rounded px-1 py-0.5
                              `}
                              rows={Math.max(1, line.text.split('\n').length)}
                              style={{
                                fontFamily: 'inherit',
                                minHeight: '1.5rem',
                              }}
                            />
                          ) : (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTextClick(line.id);
                              }}
                              className={`
                                w-full text-sm leading-relaxed cursor-text
                                ${isCurrent ? 'text-[#202124] font-medium' : 'text-[#5F6368]'}
                              `}
                            >
                              {line.text || 'Click to edit'}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </OverlayScrollbarsComponent>
            </div>
          </div>
        ) : (
          // MARKERS SECTION (теперь с такой же структурой, как и транскрипт)
          <div className="flex flex-col h-full">
            <div className="px-4 py-3 border-b border-[#DADCE0] bg-[#F8F9FA]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bookmark className="w-4 h-4 text-[#5F6368]" />
                  <h3 className="font-medium text-[#202124]">Marker Manager</h3>
                </div>
                <span className="text-[10px] font-bold text-[#1A73E8]">
                  {markers.filter(m => m.inRecap).length} SELECTED
                </span>
              </div>
              <p className="text-[10px] text-[#5F6368] mt-1 font-medium">
                {markers.filter(m => m.inRecap).length} scenes selected for recap
              </p>
            </div>

            {/* Основной контейнер для прокрутки - теперь такой же, как у транскрипта */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <OverlayScrollbarsComponent
                defer
                className="h-full w-full"
                options={{
                  scrollbars: {
                    autoHide: 'scroll',
                    visibility: 'auto'
                  }
                }}
              >
                <div className="p-2 h-full">
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
                              ? 'bg-[#E8F0FE] border-[#1A73E8]'
                              : 'bg-white border-[#DADCE0] hover:border-[#BDC1C6]'
                            }
                          `}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`
                              w-20 h-14 rounded flex items-center justify-center text-2xl flex-shrink-0 border border-black/5 overflow-hidden relative
                              ${isAI ? 'bg-[#FFF4E5]' : 'bg-[#E8F0FE]'}
                            `}>
                              {marker.thumbnail.length < 5
                                ? marker.thumbnail
                                : <img src={marker.thumbnail} className="w-full h-full object-cover" alt="" />
                              }
                              <div className="absolute bottom-0 right-0 bg-black/60 px-1 text-[8px] text-white font-mono rounded-tl-md">
                                {formatTime(marker.timecode)}
                              </div>
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-mono font-bold text-[#5F6368]">
                                  {formatTime(marker.timecode)}
                                </span>
                                {isAI && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black bg-[#FA7B17] text-white uppercase tracking-wider">
                                    <Sparkles className="w-2 h-2" />
                                    AI Match
                                  </span>
                                )}
                              </div>
                              <div className="text-[13px] text-[#202124] mb-2 font-bold truncate">
                                {marker.description}
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleMarkerInRecap(marker.id);
                                }}
                                className={`
                                  w-full inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-semibold transition-all
                                  ${marker.inRecap
                                    ? 'bg-[#1A73E8] text-white shadow-sm'
                                    : 'bg-[#F1F3F4] text-[#202124] hover:bg-[#E8EAED]'
                                  }
                                `}
                              >
                                {marker.inRecap ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                                {marker.inRecap ? 'In Recap' : 'Add to Recap'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </OverlayScrollbarsComponent>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}