'use client';

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@robots/ui';
import { useQuery } from '@tanstack/react-query';

import { getErrorMessage } from '@/shared/api';

import { healthQueryOptions } from '../api/health';

export function HomePage() {
  const { data, error, isPending, isFetching, refetch } = useQuery(healthQueryOptions);

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Robots</CardTitle>
          <CardDescription>Каркас проекта: web → /api → api → PostgreSQL</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="font-mono text-sm" role="status">
            {isPending && 'health: …'}
            {data && `health: ${data.status}`}
            {error && <span className="text-destructive">health: {getErrorMessage(error)}</span>}
          </p>
          <Button variant="outline" size="sm" disabled={isFetching} onClick={() => refetch()}>
            Проверить ещё раз
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
