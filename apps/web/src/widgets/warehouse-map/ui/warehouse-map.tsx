'use client';
import { VStack } from '@/shared/ui/Stack';
import type { WarehouseMapBody } from '@robots/shared';
import { useTranslations } from 'next-intl';
import { getMapSummary } from '../model/map-summary';
import { EditorToolbar } from './editor-toolbar/editor-toolbar';
import { EditorSummary, EditorZoom } from './editor-overlays/editor-overlays';
import { MAP_BASE_SIZE, MapCanvas } from './map-canvas/map-canvas';
import { useWarehouseMapState } from '../model/hooks/use-warehouse-map-state';
import { useElementWidth } from '../model/hooks/use-element-width';
import { EditorTool } from '../model/types';

const FIT_RATIO = 0.6;

const HINT_KEY: Record<EditorTool, 'select' | 'obstacle' | 'station' | 'robot' | 'erase'> = {
  [EditorTool.SELECT]: 'select',
  [EditorTool.OBSTACLE]: 'obstacle',
  [EditorTool.STATION]: 'station',
  [EditorTool.ROBOT]: 'robot',
  [EditorTool.ERASE]: 'erase',
};

export interface WarehouseMapProps {
  map: WarehouseMapBody;
}

export const WarehouseMap = (props: WarehouseMapProps) => {
  const { map } = props;
  const t = useTranslations('mapEditor');

  const { activeTool, setActiveTool, zoom, canZoomOut, canZoomIn, zoomOut, zoomIn, zoomFit } =
    useWarehouseMapState({ baseSize: MAP_BASE_SIZE });
  const [slotRef, slotWidth] = useElementWidth<HTMLDivElement>();
  const handleZoomFit = () => zoomFit(slotWidth * FIT_RATIO);

  return (
    <VStack className="relative min-h-[520px] min-w-0 flex-1 bg-[#F4F4F5] bg-[radial-gradient(#D4D4D8_1px,transparent_1px)] bg-[length:16px_16px]">
      <EditorToolbar
        value={activeTool}
        onChange={setActiveTool}
        className="z-9 absolute top-4 left-4"
      />
      <div ref={slotRef} className="absolute inset-0 flex items-center justify-center">
        <MapCanvas zoom={zoom} />
      </div>
      <div className="absolute top-4 right-4 rounded-[10px] border border-[#E4E4E7] bg-white px-3 py-2 text-[13px] text-[#3F3F46] shadow-[0_2px_8px_rgba(9,9,11,0.06)]">
        {t(`hints.${HINT_KEY[activeTool]}`)}
      </div>
      <EditorSummary summary={getMapSummary(map)} />
      <EditorZoom
        zoom={zoom}
        canZoomOut={canZoomOut}
        canZoomIn={canZoomIn}
        onZoomOut={zoomOut}
        onZoomIn={zoomIn}
        onZoomFit={handleZoomFit}
      />
    </VStack>
  );
};
