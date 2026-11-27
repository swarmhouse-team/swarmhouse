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
    <div
      role="status"
      className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <span
        aria-hidden="true"
        className="size-8 rounded-full border-[3px] border-primary/20 border-t-primary motion-safe:animate-spin"
      />
      <p className="text-lg font-medium text-foreground">{t('checking')}</p>
    </div>
  );
}
