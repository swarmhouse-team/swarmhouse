'use client';

import { useEffect, useRef, useState } from 'react';
import Konva from 'konva';
import { Circle, Layer, Line, Rect, Stage } from 'react-konva';

const CELL = 30; // Размер клетки в пикселях.
const GRID = 20; // Клеток по каждой стороне.
const SIZE = CELL * GRID;
const WALL = { col: 8, row: 5 };
const ROBOT_ROW = 12;

type Cell = { col: number; row: number };

function nearestCell(x: number, y: number): Cell {
  // Округляем позицию объекта до ближайшей клетки.
  return { col: Math.round(x / CELL), row: Math.round(y / CELL) };
}

function canPlace({ col, row }: Cell) {
  // Клетка должна быть внутри карты, вне стены и ряда робота.
  return (
    col >= 0 &&
    col < GRID &&
    row >= 0 &&
    row < GRID &&
    (col !== WALL.col || row !== WALL.row) &&
    row !== ROBOT_ROW
  );
}

function bound(position: number, scale: number) {
  // Ограничиваем сдвиг, чтобы за краями карты не появлялось пустое место.
  return Math.max(SIZE - SIZE * scale, Math.min(0, position));
}

export default function WarehouseDemo() {
  const stageRef = useRef<Konva.Stage>(null);
  const robotRef = useRef<Konva.Circle>(null);

  const [object, setObject] = useState<Cell>({ col: 5, row: 5 });
  const [preview, setPreview] = useState<Cell | null>(null);

  useEffect(() => {
    const robot = robotRef.current;
    if (!robot) return;

    const animation = new Konva.Animation((frame) => {
      if (!frame) return;

      // 600 мс на клетку. После 12 клеток робот едет обратно.
      const phase = (frame.time / 600) % 24;
      const step = phase <= 12 ? phase : 24 - phase;

      // Двигаем фигуру напрямую, чтобы React не обновлял страницу каждый кадр.
      robot.x((3.5 + step) * CELL);
    }, robot.getLayer());

    animation.start();
    return () => {
      animation.stop(); // Останавливаем анимацию при уходе со страницы.
    };
  }, []);

  function zoom(event: Konva.KonvaEventObject<WheelEvent>) {
    event.evt.preventDefault();

    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (!stage || !pointer) return;

    const oldScale = stage.scaleX();
    const scale = Math.max(1, Math.min(3, oldScale * Math.exp(-event.evt.deltaY * 0.002)));

    // Запоминаем, какая точка карты сейчас под курсором.
    const mapX = (pointer.x - stage.x()) / oldScale;
    const mapY = (pointer.y - stage.y()) / oldScale;

    // После зума сдвигаем карту так, чтобы эта точка осталась под курсором.
    stage.scale({ x: scale, y: scale });
    stage.position({
      x: bound(pointer.x - mapX * scale, scale),
      y: bound(pointer.y - mapY * scale, scale),
    });
  }

  return (
    <main style={{ padding: 20 }}>
      <h1>Прототип карты склада</h1>
      <p>
        Колесо — зум. После зума потяни фон, чтобы сдвинуть карту. Зелёный квадрат можно переносить
        по клеткам.
      </p>

      <div style={{ overflowX: 'auto' }}>
        <Stage
          ref={stageRef}
          width={SIZE}
          height={SIZE}
          style={{ background: '#fff', outline: '1px solid #94a3b8' }}
          draggable
          onWheel={zoom}
          dragBoundFunc={(position) => {
            const scale = stageRef.current?.scaleX() ?? 1;

            return {
              x: bound(position.x, scale),
              y: bound(position.y, scale),
            };
          }}
        >
          {/* Сетка и стена не обрабатывают события мыши. */}
          <Layer listening={false}>
            {Array.from({ length: GRID + 1 }, (_, i) => (
              <Line
                key={`vertical-${i}`}
                points={[i * CELL, 0, i * CELL, SIZE]}
                stroke="#cbd5e1"
                strokeWidth={1}
              />
            ))}
            {Array.from({ length: GRID + 1 }, (_, i) => (
              <Line
                key={`horizontal-${i}`}
                points={[0, i * CELL, SIZE, i * CELL]}
                stroke="#cbd5e1"
                strokeWidth={1}
              />
            ))}
            <Rect
              x={WALL.col * CELL}
              y={WALL.row * CELL}
              width={CELL}
              height={CELL}
              fill="#334155"
            />
          </Layer>

          <Layer>
            <Rect
              x={object.col * CELL}
              y={object.row * CELL}
              width={CELL}
              height={CELL}
              fill="#16a34a"
              draggable
              onDragMove={(event) => {
                // Пока тянем объект, подсвечиваем ближайшую клетку.
                const node = event.target;
                setPreview(nearestCell(node.x(), node.y()));
              }}
              onDragEnd={(event) => {
                const node = event.target;
                const cell = nearestCell(node.x(), node.y());
                const allowed = canPlace(cell);

                // Свободная клетка — ставим туда. Иначе возвращаем объект назад.
                const next = allowed ? cell : object;
                node.position({ x: next.col * CELL, y: next.row * CELL });

                if (allowed) setObject(next);
                setPreview(null);
              }}
            />

            {preview && (
              <Rect
                x={preview.col * CELL}
                y={preview.row * CELL}
                width={CELL}
                height={CELL}
                stroke={canPlace(preview) ? '#22c55e' : '#ef4444'}
                strokeWidth={3}
                listening={false}
              />
            )}
          </Layer>

          {/* Отдельный слой: движение робота не перерисовывает сетку. */}
          <Layer listening={false}>
            <Circle
              ref={robotRef}
              x={3.5 * CELL}
              y={(ROBOT_ROW + 0.5) * CELL}
              radius={CELL / 3}
              fill="#2563eb"
            />
          </Layer>
        </Stage>
      </div>
    </main>
  );
}
