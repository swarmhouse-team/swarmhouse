import { notFound } from 'next/navigation';

// Неизвестный путь внутри языка (`/en/xyz`) → app/[locale]/not-found.tsx на этом языке.
export default function CatchAllPage() {
  notFound();
}
