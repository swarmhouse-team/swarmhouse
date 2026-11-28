import type { Position, Grid } from '../contracts';

export function isInsideGrid(position: Position, grid: Grid): boolean {
  return position.x >= 0 && position.x < grid.width && position.y >= 0 && position.y < grid.height;
}

export function isObstacle(position: Position, grid: Grid): boolean {
  return grid.obstacles.some((obstacle) => obstacle.x === position.x && obstacle.y === position.y);
}
