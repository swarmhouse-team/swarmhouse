'use client';
import { useTranslations } from 'next-intl';
import type { MapSummary } from '../../model/map-summary';

interface EditorSummaryProps {
  summary: MapSummary;
}

export const EditorSummary = (props: EditorSummaryProps) => {
  const { summary } = props;
  const t = useTranslations('mapEditor.summary');

  return (
    <div className="absolute bottom-4 left-4 flex flex-wrap items-center gap-3.5 rounded-[10px] border border-[#E4E4E7] bg-white px-3 py-2 text-xs text-[#3F3F46]">
      <span className="font-semibold text-[#09090B]">
        {summary.width} × {summary.height}
      </span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className="size-2.5 rounded-[2px] bg-[#2563EB]" />
        {t('stations', { count: summary.stations })}
      </span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className="size-2.5 rounded-full bg-[#EA580C]" />
        {t('robots', { count: summary.robots })}
      </span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className="size-2.5 rounded-[2px] bg-[#3F3F46]" />
        {t('obstacles', { count: summary.obstacles })}
      </span>
    </div>
  );
};

const zoomButtonClass =
  'flex size-8 cursor-pointer items-center justify-center rounded-md text-[#09090B] transition-colors hover:bg-[#F4F4F5] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent';

interface EditorZoomProps {
  /** Текущий масштаб: 1 = 100%. */
  zoom: number;
  canZoomOut: boolean;
  canZoomIn: boolean;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onZoomFit: () => void;
}

/** Плавающий контрол зума справа внизу холста. */
export const EditorZoom = (props: EditorZoomProps) => {
  const { zoom, canZoomOut, canZoomIn, onZoomOut, onZoomIn, onZoomFit } = props;
  const t = useTranslations('mapEditor.zoom');

  return (
    <div
      role="group"
      aria-label={t('groupLabel')}
      className="absolute right-4 bottom-4 flex items-center rounded-[10px] border border-[#E4E4E7] bg-white p-1"
    >
      <button
        type="button"
        aria-label={t('zoomOut')}
        disabled={!canZoomOut}
        onClick={onZoomOut}
        className={zoomButtonClass}
      >
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M5 12h14" />
        </svg>
      </button>
      <span aria-live="polite" className="min-w-12 text-center text-xs font-medium">
        {Math.round(zoom * 100)}%
      </span>
      <button
        type="button"
        aria-label={t('zoomIn')}
        disabled={!canZoomIn}
        onClick={onZoomIn}
        className={zoomButtonClass}
      >
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M5 12h14" />
          <path d="M12 5v14" />
        </svg>
      </button>
      <span aria-hidden="true" className="mx-1 h-5 w-px bg-[#E4E4E7]" />
      <button type="button" aria-label={t('fit')} onClick={onZoomFit} className={zoomButtonClass}>
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8 3H5a2 2 0 0 0-2 2v3" />
          <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
          <path d="M3 16v3a2 2 0 0 0 2 2h3" />
          <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
        </svg>
      </button>
    </div>
  );
};
