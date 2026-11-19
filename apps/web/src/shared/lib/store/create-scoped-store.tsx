import { createContext, useContext, useState, type ReactNode } from 'react';
import { createStore, useStore, type StoreApi } from 'zustand';
import { devtools } from 'zustand/middleware';

import { devtoolsEnabled, type StoreInitializer } from './types';

/**
 * Стор с экземпляром на поддерево: создаётся в `Provider` и живёт, пока тот смонтирован.
 * Нужен, когда начальное состояние приходит из пропсов (данные с сервера) или на странице
 * несколько независимых экземпляров (например, две карты склада).
 *
 * Пропсы `Provider` читаются один раз при создании стора; дальше меняйте состояние действиями.
 *
 * Тип состояния задаётся в первом вызове, тип пропсов выводится из `init`
 * (как `create<T>()(…)` в самом Zustand).
 *
 * @example
 * export const robotSelection = createScopedStore<SelectionState>()(
 *   'robot-selection',
 *   ({ initialId }: { initialId: string | null }) =>
 *     (set) => ({ selectedId: initialId, select: (id) => set({ selectedId: id }, false, 'select') }),
 * );
 * // <robotSelection.Provider initialId={null}>…</robotSelection.Provider>
 * // const selectedId = robotSelection.useStore((s) => s.selectedId);
 */
export const createScopedStore =
  <T extends object>() =>
  <P extends object = object>(name: string, init: (props: P) => StoreInitializer<T>) =>
    buildScopedStore(name, init);

function buildScopedStore<T extends object, P extends object>(
  name: string,
  init: (props: P) => StoreInitializer<T>,
) {
  const StoreContext = createContext<StoreApi<T> | null>(null);
  StoreContext.displayName = name;

  function Provider({ children, ...props }: P & { children: ReactNode }) {
    const [store] = useState(() =>
      createStore<T>()(devtools(init(props as unknown as P), { name, enabled: devtoolsEnabled })),
    );
    return <StoreContext value={store}>{children}</StoreContext>;
  }

  /** Сам стор: `getState`/`setState`/`subscribe` для кода вне рендера (обработчики, эффекты). */
  function useStoreApi(): StoreApi<T> {
    const store = useContext(StoreContext);
    if (!store) {
      throw new Error(`Стор «${name}» используется вне своего Provider`);
    }
    return store;
  }

  function useScopedStore<U>(selector: (state: T) => U): U {
    return useStore(useStoreApi(), selector);
  }

  return { Provider, useStore: useScopedStore, useStoreApi };
}
