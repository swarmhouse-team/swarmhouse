import type { WarehouseDetails } from '@robots/shared';

export type WarehouseRole = 'owner' | 'observer';

export type SimulationStatus = 'running' | 'paused' | 'not_started';

export type WarehouseMapSize = {
  width: number;
  height: number;
};

export type WarehouseMemberRole = 'owner' | 'observer';

export type WarehouseMemberStatus = 'active' | 'pending';

export type WarehouseMember = {
  id: string;
  name: string;
  email: string;
  role: WarehouseMemberRole;
  status: WarehouseMemberStatus;
  isCurrentUser: boolean;
};

export type MockWarehouse = WarehouseDetails & {
  role: WarehouseRole;
  mapSize: WarehouseMapSize;
  robotsCount: number;
  stationsCount: number;
  simulationStatus: SimulationStatus;
  members: readonly WarehouseMember[];
};

const ownerWarehouseMembers = [
  {
    id: 'current-user',
    name: 'Игорь Смирнов',
    email: 'igor@example.com',
    role: 'owner',
    status: 'active',
    isCurrentUser: true,
  },
  {
    id: 'dmitry-orlov',
    name: 'Дмитрий Орлов',
    email: 'd.orlov@example.com',
    role: 'owner',
    status: 'active',
    isCurrentUser: false,
  },
  {
    id: 'anna-kovaleva',
    name: 'Анна Ковалёва',
    email: 'anna.k@example.com',
    role: 'observer',
    status: 'active',
    isCurrentUser: false,
  },
  {
    id: 'pending-petr',
    name: 'petr@example.com',
    email: 'petr@example.com',
    role: 'observer',
    status: 'pending',
    isCurrentUser: false,
  },
] satisfies readonly WarehouseMember[];

export const warehouseMocks = [
  {
    warehouseId: '0e63f771-d13d-4f7f-987c-50c840fa8788',
    name: 'Центральный склад',
    createdAt: '2026-09-12T09:30:00.000Z',
    updatedAt: '2026-11-17T14:20:00.000Z',
    role: 'owner',
    mapSize: {
      width: 24,
      height: 24,
    },
    robotsCount: 6,
    stationsCount: 4,
    simulationStatus: 'running',
    members: ownerWarehouseMembers,
  },
  {
    warehouseId: 'c6d53c14-2828-4f43-9ae2-86877593a999',
    name: 'Северный терминал',
    createdAt: '2026-08-04T12:00:00.000Z',
    updatedAt: '2026-11-16T18:45:00.000Z',
    role: 'observer',
    mapSize: {
      width: 18,
      height: 18,
    },
    robotsCount: 3,
    stationsCount: 2,
    simulationStatus: 'paused',
    members: [],
  },
  {
    warehouseId: '96970b6c-b365-4ec8-a204-5962c776f23d',
    name: 'Склад готовой продукции',
    createdAt: '2026-10-21T07:15:00.000Z',
    updatedAt: '2026-11-10T11:10:00.000Z',
    role: 'owner',
    mapSize: {
      width: 32,
      height: 32,
    },
    robotsCount: 0,
    stationsCount: 4,
    simulationStatus: 'not_started',
    members: ownerWarehouseMembers,
  },
  {
    warehouseId: '86caa1b8-7f62-472f-8dcc-546af62c347f',
    name: 'Экспериментальный полигон',
    createdAt: '2026-07-18T15:40:00.000Z',
    updatedAt: '2026-11-18T08:05:00.000Z',
    role: 'observer',
    mapSize: {
      width: 20,
      height: 20,
    },
    robotsCount: 8,
    stationsCount: 5,
    simulationStatus: 'running',
    members: [],
  },
  {
    warehouseId: 'df0dd192-b8b9-4bb4-918b-068d00453b78',
    name: 'Южный распределительный центр',
    createdAt: '2026-06-02T10:25:00.000Z',
    updatedAt: '2026-11-15T16:30:00.000Z',
    role: 'owner',
    mapSize: {
      width: 28,
      height: 28,
    },
    robotsCount: 4,
    stationsCount: 3,
    simulationStatus: 'paused',
    members: ownerWarehouseMembers,
  },
  {
    warehouseId: '27a6534d-73b0-4fa6-b60e-3f8422134ad0',
    name: 'Учебный склад',
    createdAt: '2026-11-01T13:00:00.000Z',
    updatedAt: '2026-11-01T13:00:00.000Z',
    role: 'observer',
    mapSize: {
      width: 12,
      height: 12,
    },
    robotsCount: 2,
    stationsCount: 2,
    simulationStatus: 'not_started',
    members: [],
  },
] satisfies readonly MockWarehouse[];
