# shared/lib/store

Хелперы для сторов [Zustand](https://zustand.docs.pmnd.rs). Сами сторы здесь не лежат — только фабрики.

## Правило

- **Zustand — клиентское состояние** (UI, выбор, черновики, настройки вида).
  **TanStack Query — данные с сервера** (`@/shared/api`). Ответы API в Zustand не копируем.
- Глобального стора на всё приложение нет. Стор живёт в сегменте `model` своего слайса:
  `entities/session/model/session-store.ts`, `features/select-robot/model/selection-store.ts`.
- Наружу стор отдаётся через `index.ts` слайса, как и всё остальное.
- Один стор — одна зона ответственности. Если стор нужен двум слайсам одного слоя,
  его место — слоем ниже.

## Какой хелпер брать

| Хелпер              | Экземпляр                | Когда                                                                   |
| ------------------- | ------------------------ | ----------------------------------------------------------------------- |
| `createModelStore`  | один на модуль           | чисто клиентское состояние без данных с сервера                         |
| `createScopedStore` | свой в каждом `Provider` | начальное состояние из пропсов (SSR), несколько экземпляров на странице |

Оба подключают Redux DevTools в разработке под переданным именем — третий аргумент `set` даёт
действию имя в DevTools.

На сервере модуль общий для всех запросов: в стор из `createModelStore` при SSR ничего
пользовательского не пишем, для этого `createScopedStore`.

### createModelStore

```ts
// features/map-view/model/map-view-store.ts
import { createModelStore } from '@/shared/lib/store';

type MapViewState = {
  zoom: number;
  setZoom: (zoom: number) => void;
};

export const useMapViewStore = createModelStore<MapViewState>('map-view', (set) => ({
  zoom: 1,
  setZoom: (zoom) => set({ zoom }, false, 'setZoom'),
}));
```

```tsx
const zoom = useMapViewStore.use.zoom(); // селектор на поле — перерисовка только при смене zoom
const setZoom = useMapViewStore.use.setZoom();
useMapViewStore.getState().setZoom(2); // вне рендера
```

### createScopedStore

```tsx
// features/select-robot/model/selection-store.ts
'use client';

import { createScopedStore } from '@/shared/lib/store';

type SelectionState = {
  selectedId: string | null;
  select: (id: string | null) => void;
};

export const robotSelection = createScopedStore<SelectionState>()(
  'robot-selection',
  ({ initialId }: { initialId: string | null }) =>
    (set) => ({
      selectedId: initialId,
      select: (id) => set({ selectedId: id }, false, 'select'),
    }),
);
```

```tsx
<robotSelection.Provider initialId={params.robotId}>…</robotSelection.Provider>;

const selectedId = robotSelection.useStore((s) => s.selectedId);
const api = robotSelection.useStoreApi(); // getState/setState/subscribe в обработчиках
```

Тип состояния — в первом вызове `createScopedStore<State>()`, тип пропсов выводится из `init`.
`'use client'` в файле стора нужен, если `Provider` рендерится из серверного компонента.
Пропсы `Provider` читаются один раз — при создании стора.
