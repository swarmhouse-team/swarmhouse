import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { devtools } from 'zustand/middleware';

import { devtoolsEnabled, type StoreInitializer } from './types';

export type WithSelectors<S> = S extends { getState: () => infer T }
  ? S & { use: { [K in keyof T]: () => T[K] } }
  : never;

/**
 * Добавляет к стору готовые селекторы по каждому полю: `useStore.use.count()` вместо
 * `useStore((s) => s.count)`. Компонент перерисовывается только при смене этого поля.
 */
export function createSelectors<S extends UseBoundStore<StoreApi<object>>>(
  store: S,
): WithSelectors<S> {
  const withSelectors = store as WithSelectors<S>;
  withSelectors.use = {} as WithSelectors<S>['use'];
  for (const key of Object.keys(store.getState())) {
    (withSelectors.use as Record<string, () => unknown>)[key] = () =>
      store((state) => state[key as keyof typeof state]);
  }
  return withSelectors;
}

/**
 * Стор слайса — один экземпляр на модуль. Подключает devtools под именем `name`
 * и селекторы `use.<поле>()`.
 *
 * Для чисто клиентского состояния (UI, выбор, черновики). Модуль общий для всех запросов
 * на сервере, поэтому данные пользователя сюда при SSR не пишем — для этого
 * `createScopedStore`.
 *
 * @example
 * export const useMapViewStore = createModelStore<MapViewState>('map-view', (set) => ({
 *   zoom: 1,
 *   setZoom: (zoom) => set({ zoom }, false, 'setZoom'),
 * }));
 */
export function createModelStore<T extends object>(name: string, initializer: StoreInitializer<T>) {
  const store = create<T>()(devtools(initializer, { name, enabled: devtoolsEnabled }));
  return createSelectors(store);
}
