'use client';

import {
  Avatar,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@robots/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';

import { currentUserQueryKey, getCurrentUser, logout, useSessionStore } from '@/entities/session';
import { useErrorMessage } from '@/shared/api';
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
  const getErrorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [profileOpen, setProfileOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
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
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            ref={trigger}
            type="button"
            size="icon"
            variant="ghost"
            className="rounded-full"
            aria-label={t('session.accountMenu')}
            disabled={signOut.isPending}
          >
            <Avatar aria-hidden="true">{initials || '…'}</Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href="/warehouses?filter=mine">{t('session.myWarehouses')}</Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setProfileOpen(true)}>
            {t('session.profile')}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => signOut.mutate()}>
            {t('session.signOut')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>{t('session.profile')}</DialogTitle>
            <DialogDescription>{t('session.profileDescription')}</DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-6">
            {user ? (
              <dl className="grid gap-4">
                <div>
                  <dt className="text-sm text-muted-foreground">{t('session.name')}</dt>
                  <dd className="break-all">{name}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">{t('login.email')}</dt>
                  <dd className="break-all">{user.email}</dd>
                </div>
              </dl>
            ) : profile.isError ? (
              <div className="grid gap-3">
                <p role="alert">{getErrorMessage(profile.error)}</p>
                <Button type="button" variant="outline" onClick={() => void profile.refetch()}>
                  {t('session.retryProfile')}
                </Button>
              </div>
            ) : (
              <p role="status">{t('session.loadingProfile')}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
