'use client';

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@robots/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { useErrorMessage } from '@/shared/api';

import { healthQueryOptions } from '../api/health';

export function HomePage() {
  const t = useTranslations('home');
  const errorMessage = useErrorMessage();
  const { data, error, isPending, isFetching, refetch } = useQuery(healthQueryOptions);

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="font-mono text-sm" role="status">
            {isPending && t('healthPending')}
            {data && t('healthStatus', { status: data.status })}
            {error && (
              <span className="text-destructive">
                {t('healthError', { message: errorMessage(error) })}
              </span>
            )}
          </p>
          <Button variant="outline" size="sm" disabled={isFetching} onClick={() => refetch()}>
            {t('refresh')}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
