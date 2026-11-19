import type { StateCreator } from 'zustand';

/** Инициализатор стора с подключённым devtools: `set` принимает имя действия третьим аргументом. */
export type StoreInitializer<T> = StateCreator<T, [['zustand/devtools', never]], []>;

/** Redux DevTools — только в разработке: в проде состояние наружу не отдаём. */
export const devtoolsEnabled = process.env.NODE_ENV === 'development';
