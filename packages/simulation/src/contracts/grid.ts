import type { Position } from './position';

export type Station = {
  id: string;
  serviceCells: readonly Position[];
};

export type Grid = {
  width: number;
  height: number;
  obstacles: readonly Position[];
  stations: readonly Station[];
};
