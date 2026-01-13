import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, ZoomIn, ZoomOut, Play, Pause, SkipBack, SkipForward, X } from 'lucide-react';
import WaveSurfer from 'wavesurfer.js';
import type { ClipRegion } from '../App';

interface Marker {
  id: string;
  time: number;
  type: 'ai' | 'user';
  description: string;
}

interface TimelineProps {
  videoUrl: string | null; // Добавлено
  currentTime: number;
  duration: number;
  onTimeUpdate: (time: number) => void;
  selectedMarker: string | null;
  onMarkerSelect: (id: string | null) => void;
  clips: ClipRegion[];
  onClipsChange: (clips: ClipRegion[]) => void;
  selectedClipId: string | null;
  onClipSelect: (id: string | null) => void;
}

const mockMarkers: Marker[] = [
  { id: 'ai-1', time: 12, type: 'ai', description: 'Wide shot of mountains' },
  { id: 'ai-2', time: 28, type: 'ai', description: 'Close-up of waterfall' },
  { id: 'ai-3', time: 45, type: 'ai', description: 'Aerial view of valley' },
  { id: 'ai-4', time: 75, type: 'ai', description: 'Sunset panorama' },
  { id: 'ai-5', time: 105, type: 'ai', description: 'Forest trail' },
];

type DragMode = 'none' | 'playhead' | 'clip-move' | 'clip-resize-left' | 'clip-resize-right' | 'new-clip';

export function Timeline({
  videoUrl,
  currentTime,
  duration,
  onTimeUpdate,
  selectedMarker,
  onMarkerSelect,
  clips,
  onClipsChange,
  selectedClipId,
  onClipSelect
}: TimelineProps) {
  const [zoom, setZoom] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hoveredClip, setHoveredClip] = useState<string | null>(null);
  const [dragMode, setDragMode] = useState<DragMode>('none');
  const [draggedClipId, setDraggedClipId] = useState<string | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartTime, setDragStartTime] = useState(0);
  const [newClipStart, setNewClipStart] = useState<number | null>(null);

  const timelineRef = useRef<HTMLDivElement>(null);
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);

  // --- Инициализация WaveSurfer ---
  useEffect(() => {
    if (!videoUrl || !waveformRef.current) return;

    wavesurfer.current = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#BDC1C6',
      progressColor: '#1A73E8',
      cursorWidth: 0,
      height: 120,
      barWidth: 2,
      barGap: 3,
      barRadius: 4,
      url: videoUrl,
      interact: false, // Мы управляем перемоткой через свою логику таймлайна
    });

    return () => {
      wavesurfer.current?.destroy();
    };
  }, [videoUrl]);

  // Синхронизация визуального прогресса волны с текущим временем
  useEffect(() => {
    if (wavesurfer.current && duration > 0) {
      wavesurfer.current.seekTo(currentTime / duration);
    }
  }, [currentTime, duration]);

  const formatTimecode = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * 30);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
  };

  const getTimeFromX = (x: number): number => {
    if (!timelineRef.current) return 0;
    const rect = timelineRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
    return pos * duration;
  };

  const getXFromTime = (time: number): number => {
    if (duration === 0) return 0;
    return (time / duration) * 100;
  };

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const stepFrame = (direction: 'forward' | 'backward') => {
    const frameTime = 1 / 30;
    const newTime = direction === 'forward'
      ? Math.min(currentTime + frameTime, duration)
      : Math.max(currentTime - frameTime, 0);
    onTimeUpdate(newTime);
  };

  const skip = (direction: 'forward' | 'backward') => {
    const skipTime = 5;
    const newTime = direction === 'forward'
      ? Math.min(currentTime + skipTime, duration)
      : Math.max(currentTime - skipTime, 0);
    onTimeUpdate(newTime);
  };

  const handleTimelineMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;

    const time = getTimeFromX(e.clientX);
    const clickedOnPlayhead = Math.abs(time - currentTime) < (duration * 0.02); // Адаптивная область захвата

    if (clickedOnPlayhead) {
      setDragMode('playhead');
      return;
    }

    const clickedClip = clips.find(clip => time >= clip.startTime && time <= clip.endTime);
    if (!clickedClip) {
      setDragMode('new-clip');
      setNewClipStart(time);
      setDragStartX(e.clientX);
    }
  };

  const handleClipMouseDown = (e: React.MouseEvent, clipId: string, edge?: 'left' | 'right') => {
    e.stopPropagation();
    setDraggedClipId(clipId);
    setDragStartX(e.clientX);
    setDragStartTime(getTimeFromX(e.clientX));

    if (edge === 'left') {
      setDragMode('clip-resize-left');
    } else if (edge === 'right') {
      setDragMode('clip-resize-right');
    } else {
      setDragMode('clip-move');
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragMode === 'none') return;

    const currentDragTime = getTimeFromX(e.clientX);

    if (dragMode === 'playhead') {
      onTimeUpdate(Math.max(0, Math.min(duration, currentDragTime)));
    } else if (dragMode === 'clip-move' && draggedClipId) {
      const clip = clips.find(c => c.id === draggedClipId);
      if (!clip) return;

      const clipDuration = clip.endTime - clip.startTime;
      const delta = currentDragTime - dragStartTime;
      let newStart = clip.startTime + delta;

      newStart = Math.max(0, Math.min(duration - clipDuration, newStart));

      onClipsChange(clips.map(c =>
        c.id === draggedClipId
          ? { ...c, startTime: newStart, endTime: newStart + clipDuration }
          : c
      ));
      setDragStartTime(currentDragTime);
    } else if (dragMode === 'clip-resize-left' && draggedClipId) {
      const clip = clips.find(c => c.id === draggedClipId);
      if (!clip) return;
      const newStart = Math.max(0, Math.min(clip.endTime - 0.5, currentDragTime));
      onClipsChange(clips.map(c => c.id === draggedClipId ? { ...c, startTime: newStart } : c));
    } else if (dragMode === 'clip-resize-right' && draggedClipId) {
      const clip = clips.find(c => c.id === draggedClipId);
      if (!clip) return;
      const newEnd = Math.max(clip.startTime + 0.5, Math.min(duration, currentDragTime));
      onClipsChange(clips.map(c => c.id === draggedClipId ? { ...c, endTime: newEnd } : c));
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragMode === 'new-clip' && newClipStart !== null) {
      const endTime = getTimeFromX(e.clientX);
      const start = Math.min(newClipStart, endTime);
      const end = Math.max(newClipStart, endTime);

      if (end - start > 0.5) {
        const newClip: ClipRegion = {
          id: `clip-${Date.now()}`,
          startTime: start,
          endTime: end,
        };
        onClipsChange([...clips, newClip]);
      }
      setNewClipStart(null);
    }

    setDragMode('none');
    setDraggedClipId(null);
  };

  const addClipFromMarker = (marker: Marker) => {
    const defaultDuration = 5;
    const start = Math.max(0, marker.time - defaultDuration / 2);
    const end = Math.min(duration, marker.time + defaultDuration / 2);
    const newClip: ClipRegion = { id: `clip-${Date.now()}`, startTime: start, endTime: end };
    onClipsChange([...clips, newClip]);
    onClipSelect(newClip.id);
    onTimeUpdate(marker.time);
  };

  const deleteClip = (clipId: string) => {
    onClipsChange(clips.filter(c => c.id !== clipId));
    if (selectedClipId === clipId) onClipSelect(null);
  };

  return (
    <div className="h-full bg-white flex flex-col">
      {/* Timeline Header */}
      <div className="px-4 py-2 border-b border-[#DADCE0] flex items-center justify-between">
        <div className="text-sm font-medium text-[#202124]">Timeline Editor</div>
        <div className="flex items-center gap-2">
          <button onClick={() => skip('backward')} className="p-1.5 rounded-lg bg-[#202124] text-white hover:bg-[#5F6368] transition-colors"><SkipBack className="w-4 h-4" /></button>
          <button onClick={() => stepFrame('backward')} className="p-1.5 rounded-lg hover:bg-[#F1F3F4] text-[#202124] text-xs font-mono">◄◄</button>
          <button onClick={togglePlayPause} className="p-2 rounded-lg bg-[#202124] text-white hover:bg-[#5F6368] transition-colors">
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button onClick={() => stepFrame('forward')} className="p-1.5 rounded-lg hover:bg-[#F1F3F4] text-[#202124] text-xs font-mono">►►</button>
          <button onClick={() => skip('forward')} className="p-1.5 rounded-lg bg-[#202124] text-white hover:bg-[#5F6368] transition-colors"><SkipForward className="w-4 h-4" /></button>

          <div className="w-px h-5 bg-[#DADCE0] mx-1" />

          <button onClick={() => setZoom(Math.max(0.5, zoom - 0.25))} className="p-1.5 rounded hover:bg-[#F1F3F4]"><ZoomOut className="w-4 h-4 text-[#5F6368]" /></button>
          <div className="text-xs text-[#5F6368] min-w-[40px] text-center">{Math.round(zoom * 100)}%</div>
          <button onClick={() => setZoom(Math.min(3, zoom + 0.25))} className="p-1.5 rounded hover:bg-[#F1F3F4]"><ZoomIn className="w-4 h-4 text-[#5F6368]" /></button>
        </div>
      </div>

      {/* Ruler */}
      <div className="px-4 py-2 border-b border-[#DADCE0] bg-[#F8F9FA]">
        <div className="flex justify-between text-xs text-[#5F6368] font-mono">
          {Array.from({ length: 11 }, (_, i) => (
            <div key={i}>{duration > 0 ? formatTimecode((duration / 10) * i) : '--:--:--'}</div>
          ))}
        </div>
      </div>

      {/* Track Layer */}
      <div className="flex-1 relative px-4 py-4 overflow-x-hidden select-none">
        <div
          ref={timelineRef}
          className="relative h-full cursor-crosshair"
          onMouseDown={handleTimelineMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* REAL Waveform Background */}
          <div
            ref={waveformRef}
            className="absolute inset-0 z-0 opacity-40 pointer-events-none flex items-center"
          />

          {/* AI Suggestion Markers */}
          {duration > 0 && mockMarkers.map((marker) => {
            const posPercent = getXFromTime(marker.time);
            return (
              <div
                key={marker.id}
                className="absolute top-0 bottom-0 group z-10 cursor-pointer"
                style={{ left: `${posPercent}%` }}
                onClick={(e) => { e.stopPropagation(); addClipFromMarker(marker); }}
              >
                <div className="w-0.5 h-full border-l-2 border-dashed border-[#FA7B17]" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full mb-1 bg-[#FA7B17] rounded-full p-1 shadow-md">
                  <Sparkles className="w-3 h-3 text-white" />
                </div>
              </div>
            );
          })}

          {/* Clip Regions */}
          {duration > 0 && clips.map((clip) => {
            const leftPercent = getXFromTime(clip.startTime);
            const widthPercent = getXFromTime(clip.endTime) - leftPercent;
            const isSelected = clip.id === selectedClipId;
            const isHovered = clip.id === hoveredClip;

            return (
              <div
                key={clip.id}
                className={`
                  absolute top-4 bottom-4 border-2 rounded-md cursor-move z-20 group
                  ${isSelected ? 'border-[#1A73E8]' : 'border-[#1A73E8]/80'}
                  ${isHovered || isSelected ? 'bg-[#1A73E8]/40' : 'bg-[#1A73E8]/30'}
                `}
                style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                onMouseDown={(e) => handleClipMouseDown(e, clip.id)}
                onMouseEnter={() => setHoveredClip(clip.id)}
                onMouseLeave={() => setHoveredClip(null)}
                onClick={(e) => { e.stopPropagation(); onClipSelect(clip.id); }}
              >
                <div className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-[#1A73E8] z-30" onMouseDown={(e) => handleClipMouseDown(e, clip.id, 'left')} />
                <div className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-[#1A73E8] z-30" onMouseDown={(e) => handleClipMouseDown(e, clip.id, 'right')} />
                <button
                  className="absolute top-1 right-1 w-5 h-5 bg-[#202124] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-40"
                  onClick={(e) => { e.stopPropagation(); deleteClip(clip.id); }}
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            );
          })}

          {/* New clip drawing */}
          {dragMode === 'new-clip' && newClipStart !== null && (
            <div
              className="absolute top-4 bottom-4 bg-[#1A73E8]/20 border-2 border-dashed border-[#1A73E8] rounded-md pointer-events-none z-20"
              style={{
                left: `${getXFromTime(Math.min(newClipStart, getTimeFromX(dragStartX)))}%`,
                width: `${Math.abs(getXFromTime(getTimeFromX(dragStartX)) - getXFromTime(newClipStart))}%`,
              }}
            />
          )}

          {/* Playhead */}
          {duration > 0 && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-[#1A73E8] pointer-events-none z-30 shadow-lg"
              style={{ left: `${getXFromTime(currentTime)}%` }}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full">
                <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-[#1A73E8]" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-[#DADCE0] bg-[#F8F9FA] text-xs flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-[#5F6368]">Current: <span className="font-mono text-[#202124] font-medium">{formatTimecode(currentTime)}</span></div>
          <div className="text-[#5F6368]">Duration: <span className="font-mono text-[#202124] font-medium">{formatTimecode(duration)}</span></div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-[#5F6368]">Selected Clips: <span className="text-[#1A73E8] font-medium">{clips.length}</span></div>
          <div className="text-[#5F6368]">Total Duration: <span className="text-[#1A73E8] font-medium">
            {formatTimecode(clips.reduce((sum, clip) => sum + (clip.endTime - clip.startTime), 0))}
          </span></div>
        </div>
      </div>
    </div>
  );
}