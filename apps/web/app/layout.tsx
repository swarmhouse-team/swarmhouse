import type { ReactNode } from 'react';

// Настоящий корневой layout — app/[locale]/layout.tsx. Этот нужен только для app/not-found.tsx
// (адреса с неподдерживаемым языком), поэтому просто пропускает children.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
