'use client';

import dynamic from 'next/dynamic';

const WarehouseDemo = dynamic(() => import('./WarehouseDemo'), {
  ssr: false,
  loading: () => <p>Загрузка карты…</p>,
});

export default function Page() {
  return <WarehouseDemo />;
}
