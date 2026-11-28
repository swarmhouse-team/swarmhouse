'use client';

import { useEffect, type ReactNode } from 'react';

import { SessionLoading, useSessionStore } from '@/entities/session';
import { usePathname, useRouter } from '@/shared/i18n';

export function RequireSession({ children }: { children: ReactNode }) {
  const status = useSessionStore.use.status();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (status === 'anonymous') {
      const { search, hash } = window.location;
      router.replace({ pathname: '/login', query: { next: pathname + search + hash } });
    }
  }, [pathname, router, status]);

  if (status === 'authenticated') {
    return children;
  }

  return <SessionLoading className="min-h-dvh" />;
}
