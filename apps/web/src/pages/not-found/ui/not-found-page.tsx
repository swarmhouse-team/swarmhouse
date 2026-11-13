'use client';

import { useTranslations } from 'next-intl';

// Клиентский компонент: 404 рендерится как граница вне `setRequestLocale`, серверный
// `getTranslations` там прочитал бы заголовки и сделал бы все страницы динамическими.
export function NotFoundPage() {
  const t = useTranslations('notFound');

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <h1 className="text-xl font-semibold">{t('title')}</h1>
    </main>
  );
}
