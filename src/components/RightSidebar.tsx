import React from 'react';
import { OverlayScrollbarsComponent } from "overlayscrollbars-react";
import "overlayscrollbars/overlayscrollbars.css";
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { TranscriptPanel, TranscriptLine, MarkerData } from './TranscriptPanel';
import { ScriptEditor } from './ScriptEditor';
import { VoiceExportPanel, VoiceSettings } from './VoiceExportPanel';
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
  transcript: TranscriptLine[];
  markers: MarkerData[];
  onMarkersChange: (markers: MarkerData[]) => void;
  // Пропсы для режима привязки
  bindingSegmentId: string | null;
  onBindingSegmentChange: (id: string | null) => void;
  // Пропсы для экспорта
  clipCount: number;
  totalDuration: string;
  onGenerateVoice: (settings: VoiceSettings) => void;
  onExport: (settings: VoiceSettings) => void;
  onExportVertical?: (settings: VoiceSettings) => void;  // 🔥 Новая опциональная пропса
  isProcessing: boolean;
  processingProgress: number;
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
  onMarkersChange,
  bindingSegmentId,
  onBindingSegmentChange,
  clipCount,
  totalDuration,
  onGenerateVoice,
  onExport,
  onExportVertical,
  isProcessing,
  processingProgress
}: RightSidebarProps) {
  return (
    // Главный контейнер с жестким ограничением высоты
    <div className="h-full bg-white flex flex-col min-h-0 overflow-hidden border-l border-[#DADCE0]">
      <Tabs defaultValue="transcript" className="flex-1 flex flex-col min-h-0">
        {/* Список табов - фиксированная высота */}
        <TabsList className="w-full justify-start rounded-none border-b border-[#DADCE0] bg-white px-4 shrink-0">
          <TabsTrigger
            value="transcript"
            className="data-[state=active]:border-b-2 data-[state=active]:border-[#1A73E8] rounded-none px-4 text-xs font-semibold h-12 transition-all"
          >
            Transcript & Markers
          </TabsTrigger>
          <TabsTrigger
            value="script"
            className="data-[state=active]:border-b-2 data-[state=active]:border-[#1A73E8] rounded-none px-4 text-xs font-semibold h-12 transition-all"
          >
            Script Editor
          </TabsTrigger>
          <TabsTrigger
            value="voice"
            className="data-[state=active]:border-b-2 data-[state=active]:border-[#1A73E8] rounded-none px-4 text-xs font-semibold h-12 transition-all"
          >
            Voice & Export
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 min-h-0 relative bg-white">

          {/* Вкладка Транскрипта (внутри уже есть свои скроллбары) */}
          <TabsContent
            value="transcript"
            className="absolute inset-0 m-0 flex flex-col min-h-0 data-[state=active]:flex focus-visible:outline-none"
          >
            <TranscriptPanel
              currentTime={currentTime}
              onTimeSeek={onTimeSeek}
              selectedMarker={selectedMarker}
              onMarkerSelect={onMarkerSelect}
              transcript={transcript}
              markers={markers}
              onMarkersChange={onMarkersChange}
            />
          </TabsContent>

          {/* Вкладка Редактора сценария (добавлен OverlayScrollbars) */}
          <TabsContent
            value="script"
            className="absolute inset-0 m-0 flex flex-col min-h-0 data-[state=active]:flex focus-visible:outline-none"
          >
            <OverlayScrollbarsComponent
              defer
              className="h-full w-full"
              options={{ scrollbars: { autoHide: 'scroll' } }}
            >
              <ScriptEditor
                clips={clips}
                scriptSegments={scriptSegments}
                onScriptSegmentsChange={onScriptSegmentsChange}
                selectedClipId={selectedClipId}
                onClipSelect={onClipSelect}
                onTimeSeek={onTimeSeek}
                bindingSegmentId={bindingSegmentId}
                onBindingSegmentChange={onBindingSegmentChange}
              />
            </OverlayScrollbarsComponent>
          </TabsContent>

          {/* Вкладка Настроек голоса и Экспорта (добавлен OverlayScrollbars) */}
          <TabsContent
            value="voice"
            className="absolute inset-0 m-0 flex flex-col min-h-0 data-[state=active]:flex focus-visible:outline-none"
          >
            <OverlayScrollbarsComponent
              defer
              className="h-full w-full"
              options={{ scrollbars: { autoHide: 'scroll' } }}
            >
              <VoiceExportPanel
                clipCount={clipCount}
                totalDuration={totalDuration}
                onGenerateVoice={onGenerateVoice}
                onExport={onExport}
                onExportVertical={onExportVertical}
                isProcessing={isProcessing}
                processingProgress={processingProgress}
              />
            </OverlayScrollbarsComponent>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}