import { fireEvent, screen, within } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import ru from '@locales/ru.json';
import { renderWithProviders } from '@/shared/lib/test-utils';

import { MapEditor } from './map-editor';

const m = ru.mapEditor;

vi.mock('react-konva', () => ({
  Stage: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Layer: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Line: () => null,
}));

vi.mock('@/shared/i18n/routing/navigation', () => ({
  Link: (props: ComponentProps<'a'>) => <a {...props} />,
  usePathname: () => '/',
  useRouter: () => ({ replace: vi.fn() }),
}));

describe('MapEditor', () => {
  it('рендерит шапку, тулбар, панель и сводку с числами из фикстуры', () => {
    renderWithProviders(<MapEditor />);

    expect(screen.getByText(m.warehouseName)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: m.modes.editor })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('button', { name: m.save })).toBeDisabled();

    const toolbar = screen.getByRole('toolbar', { name: m.tools.groupLabel });
    expect(within(toolbar).getAllByRole('button')).toHaveLength(5);

    expect(screen.getByRole('complementary', { name: m.panel.label })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: m.panel.tabs.add })).toBeInTheDocument();

    expect(screen.getByText('20 × 20')).toBeInTheDocument();
    expect(screen.getByText('2 станции')).toBeInTheDocument();
    expect(screen.getByText('2 робота')).toBeInTheDocument();
    expect(screen.getByText('6 препятствий')).toBeInTheDocument();
    expect(screen.getByText(m.saveState.saved)).toBeInTheDocument();
  });

  it('переключает активный инструмент', () => {
    renderWithProviders(<MapEditor />);

    const station = screen.getByRole('button', { name: m.tools.station });
    expect(station).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(station);

    expect(station).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: m.tools.erase })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('меняет масштаб кнопками зума', () => {
    renderWithProviders(<MapEditor />);

    expect(screen.getByText('100%')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: m.zoom.zoomIn }));
    expect(screen.getByText('125%')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: m.zoom.zoomOut }));
    fireEvent.click(screen.getByRole('button', { name: m.zoom.zoomOut }));
    expect(screen.getByText('75%')).toBeInTheDocument();
  });
});
