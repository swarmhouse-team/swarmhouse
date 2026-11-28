import { useCallback, useState } from 'react';
import { EditorTool } from '../types';

export const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];

const DEFAULT_ZOOM_INDEX = ZOOM_STEPS.indexOf(1);
const MAX_ZOOM_INDEX = ZOOM_STEPS.length - 1;

/** Ограничивает индекс шага допустимым диапазоном. */
export const clampZoomIndex = (index: number): number =>
  Math.min(MAX_ZOOM_INDEX, Math.max(0, index));

/**
 * Индекс максимального шага, при котором карточка `baseSize` помещается в `available` пикселей.
 * Если даже минимальный шаг не помещается, возвращает 0.
 */
export const getFitZoomIndex = (baseSize: number, available: number): number =>
  ZOOM_STEPS.reduce((best, step, i) => (step * baseSize <= available ? i : best), 0);

export interface UseWarehouseMapStateOptions {
  /** Базовый размер карточки при 100%, нужен для вписывания. */
  baseSize: number;
}

/**
 * Состояние виджета карты: активный инструмент и масштаб.
 * Возвращает готовые значения и колбэки, чтобы виджет не считал границы сам.
 */
export const useWarehouseMapState = (options: UseWarehouseMapStateOptions) => {
  const { baseSize } = options;

  const [activeTool, setActiveTool] = useState<EditorTool>(EditorTool.ERASE);
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);

  const zoom = ZOOM_STEPS[zoomIndex] ?? 1;
  const canZoomOut = zoomIndex > 0;
  const canZoomIn = zoomIndex < MAX_ZOOM_INDEX;

  const zoomOut = useCallback(() => setZoomIndex((i) => clampZoomIndex(i - 1)), []);
  const zoomIn = useCallback(() => setZoomIndex((i) => clampZoomIndex(i + 1)), []);
  const zoomFit = useCallback(
    (availableWidth: number) => {
      setZoomIndex(getFitZoomIndex(baseSize, availableWidth));
    },
    [baseSize],
  );

  return {
    activeTool,
    setActiveTool,
    zoom,
    canZoomOut,
    canZoomIn,
    zoomOut,
    zoomIn,
    zoomFit,
  };
};
