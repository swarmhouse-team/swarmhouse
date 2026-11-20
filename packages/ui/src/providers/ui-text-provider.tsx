'use client';

import { createContext, type ReactNode, useContext } from 'react';

export type UiText = {
  dialog: {
    close: string;
  };
};

export const defaultUiText: UiText = {
  dialog: {
    close: 'Close',
  },
};

const UiTextContext = createContext<UiText>(defaultUiText);

type UiTextProviderProps = {
  children: ReactNode;
  value: UiText;
};

export function UiTextProvider({ children, value }: UiTextProviderProps) {
  return <UiTextContext.Provider value={value}>{children}</UiTextContext.Provider>;
}

export function useUiText() {
  return useContext(UiTextContext);
}
