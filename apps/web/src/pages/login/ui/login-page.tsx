'use client';

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@robots/ui';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { SessionLoading, useSessionStore } from '@/entities/session';

import { LocaleSwitcher } from '@/features/switch-locale';
import { Link, useRouter } from '@/shared/i18n';

import { LoginForm } from './login-form';

export function LoginPage() {
  const t = useTranslations('login');
  const status = useSessionStore.use.status();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      const next = new URLSearchParams(window.location.search).get('next');
      // Разрешаем возврат только на известный закрытый маршрут.
      router.replace(next && /^\/warehouses(?:[?#]|$)/.test(next) ? next : '/warehouses');
    }
  }, [router, status]);

  return (
    <div className="flex min-h-dvh flex-col bg-muted/30">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Button asChild variant="ghost" size="sm">
            <Link href="/">{t('backHome')}</Link>
          </Button>
          <LocaleSwitcher />
        </div>
      </header>

      <main className="grid flex-1 place-items-center px-4 py-12">
        {status === 'anonymous' ? (
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>{t('title')}</CardTitle>
              <CardDescription>{t('description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <LoginForm />
            </CardContent>
          </Card>
        ) : (
          <SessionLoading />
        )}
      </main>
    </div>
  );
}
