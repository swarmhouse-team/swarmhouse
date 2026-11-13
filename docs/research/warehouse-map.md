# Konva и react-konva для карты склада

**Konva** — JavaScript-библиотека для рисования на HTML Canvas. Она умеет рисовать фигуры, обрабатывать клики и перетаскивание, масштабировать сцену и анимировать объекты. **react-konva** позволяет описывать эти фигуры как React-компоненты.

В карте склада Konva отвечает за то, что видно на экране. React хранит данные карты, например клетку объекта и ID выбранного робота.

## 1. Подключение в Next.js

Из корня проекта установи зависимости:

```powershell
pnpm --dir apps/web add konva react-konva
```

Для лучшего усвоения лучше читать параллельно с прототипом карты (web/app/prototype-map).
В `page.tsx` загружаем карту только в браузере. `'use client'` нужен для использования `ssr: false` в App Router.

```tsx
'use client';

import dynamic from 'next/dynamic';

const WarehouseDemo = dynamic(() => import('./WarehouseDemo'), { ssr: false });

export default function Page() {
  return <WarehouseDemo />;
}
```

## 2. Сетка и фигуры

`Stage` — видимая область карты. `Layer` — отдельный слой отрисовки. `Line`, `Rect` и `Circle` рисуют линии, квадраты и роботов. `Group` позволяет двигать фигуру и её подпись вместе.

В демо клетка равна 30 пикселям. Сетка 20 × 20 занимает 600 × 600 пикселей. Для неё рисуем по 21 линии в каждом направлении.

```tsx
const CELL = 30;
const SIZE = 20 * CELL;

// Вертикальная линия с номером i, от 0 до 20.
<Line points={[i * CELL, 0, i * CELL, SIZE]} stroke="#cbd5e1" />

// Препятствие занимает одну клетку.
<Rect x={8 * CELL} y={5 * CELL} width={CELL} height={CELL} fill="#334155" />
```

`col` — колонка, `row` — строка. У квадрата координаты задают верхний левый угол. У робота в виде круга координаты задают центр, поэтому прибавляем половину клетки: `x = (col + 0.5) * CELL`.

## 3. Зум под курсором и перемещение карты

`zoom` получает положение курсора внутри холста через `getPointerPosition()`. Вычитаем сдвиг карты и делим на старый масштаб. Так получаем координату на карте. Затем вычисляем новый сдвиг, чтобы эта точка осталась под курсором.

```ts
const oldScale = stage.scaleX();
const mapX = (pointer.x - stage.x()) / oldScale;
const mapY = (pointer.y - stage.y()) / oldScale;

stage.scale({ x: scale, y: scale });
stage.position({
  x: bound(pointer.x - mapX * scale, scale),
  y: bound(pointer.y - mapY * scale, scale),
});
```

`onWheel` вызывает `zoom`. В демо масштаб ограничен от 1 до 3, а `event.evt.preventDefault()` останавливает прокрутку страницы над картой. `draggable` на `Stage` позволяет тянуть фон. `dragBoundFunc` вызывает `bound` для обеих осей.

```ts
function bound(position: number, scale: number) {
  return Math.max(SIZE - SIZE * scale, Math.min(0, position));
}
```

При масштабе 2 карта шириной 1200 видна через холст шириной 600. Допустимый сдвиг от −600 до 0. У края ограничение сдвига может сместить точку из-под курсора.

## 4. Перетаскивание и привязка к сетке

`nearestCell` переводит позицию квадрата в ближайшую клетку. `canPlace` проверяет, что клетка внутри сетки, свободна от стены и находится вне ряда робота.

```ts
function nearestCell(x: number, y: number) {
  return { col: Math.round(x / CELL), row: Math.round(y / CELL) };
}
```

- `onDragMove` обновляет `preview`. Рамка зелёная на допустимой клетке и красная на запрещённой.
- `onDragEnd` снова проверяет клетку. `node.position()` ставит квадрат ровно по сетке или возвращает его назад. `setObject()` сохраняет допустимый перенос в React.

Для добавления объекта берём `stage.getRelativePointerPosition()` и применяем `Math.floor(x / CELL)` и `Math.floor(y / CELL)`: нужен квадрат **под курсором**. После проверки добавляем объект в массив. Для удаления убираем его по ID: `setObjects(items => items.filter(item => item.id !== id))`.

## 5. Движение робота

`robotRef.current` даёт доступ к кругу Konva. `Konva.Animation` обновляет его позицию на каждом кадре. В демо робот проходит одну клетку за 600 мс, едет 12 клеток вперёд и возвращается.

```ts
const animation = new Konva.Animation((frame) => {
  if (!frame) return;
  const phase = (frame.time / 600) % 24;
  const step = phase <= 12 ? phase : 24 - phase;
  robot.x((3.5 + step) * CELL);
}, robot.getLayer());

animation.start();
return () => {
  animation.stop();
}; // Очистка эффекта при уходе со страницы.
```

Для симуляции принцип тот же: шаг задаёт конечную клетку и длительность, а позиция между ними считается по формуле `from + (to - from) * progress`. `progress` растёт от 0 до 1.

## 6. Выбор робота и маршрут

При клике сохраняем `selectedId`, выделяем выбранного робота рамкой. `Line` соединяет центры клеток из его маршрута.

```tsx
const points = route.flatMap(({ col, row }) => [(col + 0.5) * CELL, (row + 0.5) * CELL]);

{
  selectedId === robot.id && <Line points={points} stroke="orange" listening={false} />;
}
```

Для клика слой роботов должен принимать события, а у фигуры нужен `onClick={() => setSelectedId(robot.id)}`.

## 7. Слои, иконки и размер холста

| Что нужно                                  | Как сделать                                                                                                                                                                |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Перерисовывать только роботов при движении | Вынести роботов в отдельный `Layer`. `robot.x()` меняет Konva-узел напрямую, поэтому React не обновляет страницу на каждом кадре.                                          |
| Отключить события у декора                 | `listening={false}` на сетке, подписях и линии маршрута.                                                                                                                   |
| Кэшировать сложную графику                 | Вызвать `group.cache()` после замера производительности. При изменении фигур очистить кэш через `clearCache()` и создать заново. Простой сетке достаточно отдельного слоя. |
| Показать SVG                               | Положить файл в `public`, загрузить через `const [image] = useImage('/robot.svg')` и передать в `<KonvaImage image={image} />`. Для этого нужен пакет `use-image`.         |
| Подстроить холст под контейнер             | В `ResizeObserver` взять `entry.contentRect.width` и `height`, передать в `Stage` и пересчитать границы сдвига. В демо размер фиксированный.                               |
| Сохранить чёткость на Retina               | Konva автоматически учитывает плотность экрана. В `Stage` передаём размеры в CSS-пикселях. `Konva.pixelRatio = 1` уменьшает нагрузку ценой чёткости.                       |
| Добавить зум двумя пальцами                | Опционально. Масштаб меняется по отношению нового расстояния между пальцами к старому. Вместо курсора используем середину между касаниями.                                 |

[Документация Konva](https://konvajs.org/docs/) · [Зум под курсором](https://konvajs.org/docs/sandbox/Zooming_Relative_To_Pointer.html) · [Анимация](https://konvajs.org/docs/animations/Moving.html)
