import { act, render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { createScopedStore } from './create-scoped-store';

type SelectionState = {
  selectedId: string | null;
  select: (id: string) => void;
};

const selection = createScopedStore<SelectionState>()(
  'selection',
  ({ initialId }: { initialId: string | null }) =>
    (set) => ({
      selectedId: initialId,
      select: (id) => set({ selectedId: id }, false, 'select'),
    }),
);

function SelectedId() {
  return <span>{selection.useStore((state) => state.selectedId) ?? 'none'}</span>;
}

describe('createScopedStore', () => {
  it('берёт начальное состояние из пропсов Provider', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <selection.Provider initialId="r-1">{children}</selection.Provider>
    );
    const { result } = renderHook(
      () => ({ id: selection.useStore((s) => s.selectedId), api: selection.useStoreApi() }),
      { wrapper },
    );

    expect(result.current.id).toBe('r-1');

    act(() => result.current.api.getState().select('r-2'));

    expect(result.current.id).toBe('r-2');
  });

  it('у каждого Provider свой экземпляр стора', () => {
    render(
      <>
        <selection.Provider initialId="a">
          <SelectedId />
        </selection.Provider>
        <selection.Provider initialId="b">
          <SelectedId />
        </selection.Provider>
      </>,
    );

    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
  });

  it('падает с понятной ошибкой вне Provider', () => {
    expect(() => renderHook(() => selection.useStore((s) => s.selectedId))).toThrow(
      'Стор «selection» используется вне своего Provider',
    );
  });
});
