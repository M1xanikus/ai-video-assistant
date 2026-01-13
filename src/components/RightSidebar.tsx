import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { TranscriptPanel, TranscriptLine, MarkerData } from './TranscriptPanel'; // Импортируем типы
import { ScriptEditor } from './ScriptEditor';
import { VoiceExportPanel } from './VoiceExportPanel';
import type { ClipRegion, ScriptSegment } from '../App';

interface RightSidebarProps {
  currentTime: number;
  onTimeSeek: (time: number) => void;
  selectedMarker: string | null;
  onMarkerSelect: (id: string | null) => void;
  clips: ClipRegion[];
  scriptSegments: ScriptSegment[];
  onScriptSegmentsChange: (segments: ScriptSegment[]) => void;
  selectedClipId: string | null;
  onClipSelect: (id: string | null) => void;
  // Новые пропсы для связи с данными ИИ из App.tsx
  transcript: TranscriptLine[];
  markers: MarkerData[];
  onMarkersChange: (markers: MarkerData[]) => void;
}

export function RightSidebar({
  currentTime,
  onTimeSeek,
  selectedMarker,
  onMarkerSelect,
  clips,
  scriptSegments,
  onScriptSegmentsChange,
  selectedClipId,
  onClipSelect,
  transcript,
  markers,
  onMarkersChange
}: RightSidebarProps) {
  return (
    <div className="h-full bg-white flex flex-col">
      <Tabs defaultValue="transcript" className="h-full flex flex-col">
        <TabsList className="w-full justify-start rounded-none border-b border-[#DADCE0] bg-white px-4">
          <TabsTrigger
            value="transcript"
            className="data-[state=active]:border-b-2 data-[state=active]:border-[#1A73E8] rounded-none px-4 text-xs font-medium"
          >
            Transcript & Markers
          </TabsTrigger>
          <TabsTrigger
            value="script"
            className="data-[state=active]:border-b-2 data-[state=active]:border-[#1A73E8] rounded-none px-4 text-xs font-medium"
          >
            Script Editor
          </TabsTrigger>
          <TabsTrigger
            value="voice"
            className="data-[state=active]:border-b-2 data-[state=active]:border-[#1A73E8] rounded-none px-4 text-xs font-medium"
          >
            Voice & Export
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-hidden">
          {/* Вкладка Транскрипта и Маркеров */}
          <TabsContent value="transcript" className="h-full m-0">
            <TranscriptPanel
              currentTime={currentTime}
              onTimeSeek={onTimeSeek}
              selectedMarker={selectedMarker}
              onMarkerSelect={onMarkerSelect}
              // Передаем реальные данные и обработчик изменений
              transcript={transcript}
              markers={markers}
              onMarkersChange={onMarkersChange}
            />
          </TabsContent>

          {/* Вкладка Редактора сценария */}
          <TabsContent value="script" className="h-full m-0">
            <ScriptEditor
              clips={clips}
              scriptSegments={scriptSegments}
              onScriptSegmentsChange={onScriptSegmentsChange}
              selectedClipId={selectedClipId}
              onClipSelect={onClipSelect}
              onTimeSeek={onTimeSeek}
            />
          </TabsContent>

          {/* Вкладка Настроек голоса и Экспорта */}
          <TabsContent value="voice" className="h-full m-0">
            <VoiceExportPanel />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}