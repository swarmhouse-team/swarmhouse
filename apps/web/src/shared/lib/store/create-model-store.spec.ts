import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createModelStore } from './create-model-store';

type CounterState = {
  count: number;
  label: string;
  increment: () => void;
};

const createCounter = () =>
  createModelStore<CounterState>('counter', (set) => ({
    count: 0,
    label: 'counter',
    increment: () => set((state) => ({ count: state.count + 1 }), false, 'increment'),
  }));

describe('createModelStore', () => {
  it('создаёт стор с начальным состоянием и действиями', () => {
    const useCounter = createCounter();

    useCounter.getState().increment();

    expect(useCounter.getState().count).toBe(1);
  });

  it('добавляет селектор на каждое поле', () => {
    const useCounter = createCounter();
    const { result } = renderHook(() => useCounter.use.count());

    act(() => useCounter.getState().increment());

    expect(result.current).toBe(1);
    expect(Object.keys(useCounter.use)).toEqual(['count', 'label', 'increment']);
  });
});
