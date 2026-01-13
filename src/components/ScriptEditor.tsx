import React, { useState } from 'react';
import { ScrollArea } from './ui/scroll-area';
import { Volume2, Scissors, Trash2, Link2, Target, Save, Check } from 'lucide-react';
import type { ClipRegion, ScriptSegment } from '../App';

interface ScriptEditorProps {
  clips: ClipRegion[];
  scriptSegments: ScriptSegment[];
  onScriptSegmentsChange: (segments: ScriptSegment[]) => void;
  selectedClipId: string | null;
  onClipSelect: (id: string | null) => void;
  onTimeSeek: (time: number) => void;
  // Новые пропсы для режима привязки
  bindingSegmentId: string | null;
  onBindingSegmentChange: (id: string | null) => void;
}

export function ScriptEditor({
  clips,
  scriptSegments,
  onScriptSegmentsChange,
  selectedClipId,
  onClipSelect,
  onTimeSeek,
  bindingSegmentId,
  onBindingSegmentChange
}: ScriptEditorProps) {
  const [hoveredSegmentId, setHoveredSegmentId] = useState<string | null>(null);

  const formatTimecode = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const getClipNumber = (clipId: string): number => {
    const sortedClips = [...clips].sort((a, b) => a.startTime - b.startTime);
    const index = sortedClips.findIndex(c => c.id === clipId);
    return index !== -1 ? index + 1 : 0;
  };

  const handleSegmentTextChange = (segmentId: string, newText: string) => {
    onScriptSegmentsChange(
      scriptSegments.map(seg =>
        seg.id === segmentId ? { ...seg, text: newText } : seg
      )
    );
  };

  const handleSegmentClick = (segment: ScriptSegment) => {
    if (segment.linkedClipId) {
      onClipSelect(segment.linkedClipId);
      const clip = clips.find(c => c.id === segment.linkedClipId);
      if (clip) onTimeSeek(clip.startTime);
    }
  };

  const handleSplitSegment = (segmentId: string) => {
    const segment = scriptSegments.find(seg => seg.id === segmentId);
    if (!segment) return;

    const words = segment.text.split(' ');
    const mid = Math.floor(words.length / 2);
    const firstPart = words.slice(0, mid).join(' ');
    const secondPart = words.slice(mid).join(' ');

    const index = scriptSegments.findIndex(s => s.id === segmentId);
    const newSegments = [...scriptSegments];
    newSegments.splice(index, 1,
      { ...segment, text: firstPart },
      { id: `seg-${Date.now()}`, text: secondPart, linkedClipId: null }
    );
    onScriptSegmentsChange(newSegments);
  };

  const handleUnlink = (e: React.MouseEvent, segmentId: string) => {
    e.stopPropagation();
    onScriptSegmentsChange(
      scriptSegments.map(s => s.id === segmentId ? { ...s, linkedClipId: null } : s)
    );
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#DADCE0] bg-[#F8F9FA]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-[#202124]">Script Editor</h3>
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1A73E8] text-white text-sm hover:bg-[#1557B0] transition-colors shadow-sm">
            <Save className="w-4 h-4" />
            Save Draft
          </button>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-[#5F6368] font-medium uppercase tracking-wider">
            {scriptSegments.filter(s => s.linkedClipId).length} / {scriptSegments.length} Linked to video
          </p>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {scriptSegments.map((segment, index) => {
            const isLinked = !!segment.linkedClipId;
            const linkedClip = isLinked ? clips.find(c => c.id === segment.linkedClipId) : null;
            const isSelected = segment.linkedClipId === selectedClipId && isLinked;
            const isBinding = bindingSegmentId === segment.id;

            return (
              <div
                key={segment.id}
                onMouseEnter={() => setHoveredSegmentId(segment.id)}
                onMouseLeave={() => setHoveredSegmentId(null)}
                onClick={() => handleSegmentClick(segment)}
                className={`
                  group border rounded-xl transition-all duration-200 overflow-hidden
                  ${isSelected ? 'border-[#1A73E8] ring-2 ring-[#1A73E8]/20 shadow-md' : 'border-[#DADCE0]'}
                  ${isBinding ? 'border-[#FA7B17] ring-4 ring-[#FA7B17]/10' : ''}
                  ${isLinked ? 'bg-white' : 'bg-[#F8F9FA]'}
                `}
              >
                {/* Segment Header */}
                <div className={`
                  px-3 py-2 flex items-center justify-between
                  ${isLinked ? 'bg-[#1A73E8] text-white' : 'bg-[#F1F3F4] text-[#5F6368]'}
                  ${isBinding ? 'bg-[#FA7B17] text-white' : ''}
                `}>
                  <div className="flex items-center gap-2">
                    {isLinked ? (
                      <div className="flex items-center gap-2">
                        <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                          Clip #{getClipNumber(segment.linkedClipId!)}
                        </span>
                        <span className="text-[10px] font-mono">
                          {linkedClip ? formatTimecode(linkedClip.startTime) : '00:00'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold uppercase opacity-70">Unlinked Segment</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {isLinked ? (
                      <button
                        onClick={(e) => handleUnlink(e, segment.id)}
                        className="p-1 hover:bg-white/20 rounded transition-colors"
                        title="Unlink"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onBindingSegmentChange(isBinding ? null : segment.id);
                        }}
                        className={`p-1.5 rounded-md transition-all ${isBinding ? 'bg-white text-[#FA7B17] shadow-sm' : 'hover:bg-black/5'}`}
                      >
                        {isBinding ? <Check className="w-3.5 h-3.5" /> : <Target className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Text Area */}
                <div className="p-3">
                  <textarea
                    value={segment.text}
                    onChange={(e) => handleSegmentTextChange(segment.id, e.target.value)}
                    placeholder="Enter text for AI voiceover..."
                    className="w-full min-h-[60px] text-sm bg-transparent border-none focus:ring-0 resize-none leading-relaxed text-[#202124]"
                  />
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-[10px] text-[#9AA0A6] font-mono">
                      {segment.text.length} chars | {segment.text.split(' ').filter(t => t).length} words
                    </span>

                    {/* Inline Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); alert('Previewing voice...'); }} className="p-1.5 hover:bg-[#F1F3F4] rounded-md text-[#5F6368]"><Volume2 className="w-3.5 h-3.5" /></button>
                      <button onClick={(e) => { e.stopPropagation(); handleSplitSegment(segment.id); }} className="p-1.5 hover:bg-[#F1F3F4] rounded-md text-[#5F6368]"><Scissors className="w-3.5 h-3.5" /></button>
                      <button onClick={(e) => { e.stopPropagation(); onScriptSegmentsChange(scriptSegments.filter(s => s.id !== segment.id)); }} className="p-1.5 hover:bg-red-50 rounded-md text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <button
            onClick={() => onScriptSegmentsChange([...scriptSegments, { id: `seg-${Date.now()}`, text: '', linkedClipId: null }])}
            className="w-full py-3 border-2 border-dashed border-[#DADCE0] rounded-xl text-sm text-[#5F6368] hover:border-[#1A73E8] hover:text-[#1A73E8] transition-all"
          >
            + Add segment
          </button>
        </div>
      </ScrollArea>

      {/* Binding Tooltip */}
      {bindingSegmentId && (
        <div className="p-4 bg-[#FA7B17] text-white animate-in slide-in-from-bottom-full">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <Target className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-wider">Binding Mode Active</p>
              <p className="text-[11px] opacity-90">Select a blue region on the timeline to link this script.</p>
            </div>
            <button
              onClick={() => onBindingSegmentChange(null)}
              className="px-3 py-1 bg-white text-[#FA7B17] text-[10px] font-bold rounded-md"
            >
              CANCEL
            </button>
          </div>
        </div>
      )}
    </div>
  );
}