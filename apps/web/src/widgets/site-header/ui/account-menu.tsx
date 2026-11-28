'use client';

import {
  Avatar,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@robots/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { currentUserQueryKey, getCurrentUser, logout, useSessionStore } from '@/entities/session';
import { Link } from '@/shared/i18n';

export function AccountMenu() {
  const status = useSessionStore.use.status();
  const t = useTranslations();

  if (status === 'anonymous') {
    return (
      <Button asChild size="sm">
        <Link href="/login">{t('landing.header.signIn')}</Link>
      </Button>
    );
  }

  if (status === 'authenticated') {
    return <SignedInMenu />;
  }

  return <span className="size-9" aria-label={t('session.checking')} role="status" />;
}

function SignedInMenu() {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const profile = useQuery({
    queryKey: currentUserQueryKey,
    queryFn: ({ signal }) => getCurrentUser(signal),
  });
  const signOut = useMutation({
    mutationFn: logout,
    onSuccess: () => queryClient.removeQueries(),
  });
  const user = profile.data;
  const name = user?.name.trim() || user?.email || '';
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => Array.from(word)[0])
    .join('')
    .toLocaleUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="group cursor-pointer rounded-full hover:bg-transparent focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring dark:hover:bg-transparent"
          aria-label={t('session.accountMenu')}
          disabled={signOut.isPending}
        >
          <Avatar
            aria-hidden="true"
            className="group-hover:bg-primary/10 group-hover:text-primary motion-safe:transition-colors"
          >
            {initials || '…'}
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href="/warehouses?filter=mine">{t('session.myWarehouses')}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/profile">{t('session.profile')}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={() => signOut.mutate()}>
          {t('session.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
