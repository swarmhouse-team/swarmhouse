'use client';
import { memo } from 'react';
import { useTranslations } from 'next-intl';
import { Layer, Line, Stage } from 'react-konva';

const GRID = 20;
const CELL = 32;
const ARM = 4;
const PADDING = 20;

/** Полный размер карточки при 100%: сетка плюс отступы с обеих сторон. */
export const MAP_BASE_SIZE = GRID * CELL + PADDING * 2;

interface MapCanvasProps {
  /** Масштаб: 1 = 100%. */
  zoom: number;
}

const gridLines = (() => {
  const lines = [];
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const cx = col * CELL + CELL / 2;
      const cy = row * CELL + CELL / 2;
      lines.push(
        <Line
          key={`h-${row}-${col}`}
          points={[cx - ARM, cy, cx + ARM, cy]}
          stroke="#A1A1AA"
          strokeWidth={1}
          listening={false}
        />,
        <Line
          key={`v-${row}-${col}`}
          points={[cx, cy - ARM, cx, cy + ARM]}
          stroke="#A1A1AA"
          strokeWidth={1}
          listening={false}
        />,
      );
    }
  }
  return lines;
})();

/**
 * Заглушка слота карты: белая карточка 20×20 клеток с сеткой «+», центрируется в слоте.
 * Размер масштабируется через zoom. Объекты пока не рисуются.
 * memo: при смене активного инструмента или подсказок холст не перерисовывается, меняется только zoom.
 */
export const MapCanvas = memo(function MapCanvas(props: MapCanvasProps) {
  const { zoom } = props;
  const t = useTranslations('mapEditor');
  const size = GRID * CELL;

  return (
    <div
      className="rounded-2xl bg-white shadow-[0_1px_3px_rgba(9,9,11,0.08),0_8px_24px_rgba(9,9,11,0.06)]"
      style={{ padding: PADDING * zoom }}
    >
      <div role="img" aria-label={t('canvas.label', { size: GRID })}>
        <Stage width={size * zoom} height={size * zoom} scale={{ x: zoom, y: zoom }}>
          <Layer listening={false}>{gridLines}</Layer>
        </Stage>
      </div>
    </div>
  );
});
