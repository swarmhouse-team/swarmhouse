'use client';

import { useTranslations } from 'next-intl';
import { useEffect, type ReactNode } from 'react';

import { useSessionStore } from '@/entities/session';
import { usePathname, useRouter } from '@/shared/i18n';

export function RequireSession({ children }: { children: ReactNode }) {
  const status = useSessionStore.use.status();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('session');

  useEffect(() => {
    if (status === 'anonymous') {
      const { search, hash } = window.location;
      router.replace({ pathname: '/login', query: { next: pathname + search + hash } });
    }
  }, [pathname, router, status]);

  if (status === 'authenticated') {
    return children;
  }

  return (
    <p role="status" className="p-6 text-center text-sm text-muted-foreground">
      {t('checking')}
    </p>
  );
}
