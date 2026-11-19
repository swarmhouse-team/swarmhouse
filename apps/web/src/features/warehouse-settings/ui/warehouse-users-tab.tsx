'use client';

import { type WarehouseMember, type WarehouseMemberRole } from '@/entities/warehouse';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Form, FormControl, FormField, FormItem, FormMessage, Input, cn } from '@robots/ui';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';

import {
  inviteWarehouseMemberSchema,
  type InviteWarehouseMember,
} from '../model/invite-warehouse-member';

type WarehouseUsersTabProps = {
  members: readonly WarehouseMember[];
  onMembersChange: (members: readonly WarehouseMember[]) => void;
  onDone: () => void;
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function WarehouseUsersTab({ members, onMembersChange, onDone }: WarehouseUsersTabProps) {
  const t = useTranslations('warehouses.settings.users');
  const form = useForm<InviteWarehouseMember>({
    resolver: zodResolver(inviteWarehouseMemberSchema),
    defaultValues: {
      email: '',
    },
  });

  const activeCount = members.filter((member) => member.status === 'active').length;

  const pendingCount = members.filter((member) => member.status === 'pending').length;

  const handleInvite = form.handleSubmit(({ email }) => {
    const normalizedEmail = email.trim().toLocaleLowerCase();

    const alreadyExists = members.some(
      (member) => member.email.toLocaleLowerCase() === normalizedEmail,
    );

    if (alreadyExists) {
      form.setError('email', {
        message: t('alreadyInvited'),
      });

      return;
    }

    const newMember: WarehouseMember = {
      id: crypto.randomUUID(),
      name: normalizedEmail,
      email: normalizedEmail,
      role: 'observer',
      status: 'pending',
      isCurrentUser: false,
    };

    onMembersChange([...members, newMember]);
    form.reset();
  });

  const handleRoleChange = (memberId: string, role: WarehouseMemberRole) => {
    onMembersChange(
      members.map((member) => (member.id === memberId ? { ...member, role } : member)),
    );
  };

  const handleRemove = (memberId: string) => {
    onMembersChange(members.filter((member) => member.id !== memberId));
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 space-y-6 p-6">
        <Form {...form}>
          <form onSubmit={handleInvite} className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder={t('emailPlaceholder')}
                      autoComplete="email"
                    />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2">
              <div className="flex h-9 items-center rounded-md border bg-muted/30 px-3 text-sm text-muted-foreground">
                {t('observerRole')}
              </div>

              <Button type="submit">{t('invite')}</Button>
            </div>
          </form>
        </Form>

        <p className="text-xs text-muted-foreground">{t('observerDescription')}</p>

        <div>
          <div className="mb-3 flex items-center justify-between gap-4">
            <h3 className="text-sm font-semibold">{t('participants')}</h3>

            <span className="text-xs text-muted-foreground">
              {t('participantsCount', { active: activeCount, pending: pendingCount })}
            </span>
          </div>

          <ul className="divide-y rounded-lg border">
            {members.map((member) => (
              <li key={member.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium',
                      member.status === 'pending' && 'border border-dashed',
                    )}
                  >
                    {member.status === 'pending' ? '@' : getInitials(member.name)}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {member.name}
                      {member.isCurrentUser ? ` ${t('currentUser')}` : ''}
                    </p>

                    <p className="truncate text-xs text-muted-foreground">
                      {member.status === 'pending' ? t('invitationSent') : member.email}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:justify-end">
                  {member.status === 'pending' ? (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">
                      {t('pending')}
                    </span>
                  ) : (
                    <div className="relative">
                      <select
                        aria-label={t('roleLabel', { name: member.name })}
                        value={member.role}
                        disabled={member.isCurrentUser}
                        onChange={(event) =>
                          handleRoleChange(member.id, event.target.value as WarehouseMemberRole)
                        }
                        className="h-8 min-w-28 appearance-none rounded-md border bg-background py-1 pr-8 pl-3 text-xs leading-none disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <option value="owner">{t('ownerRole')}</option>
                        <option value="observer">{t('observerRole')}</option>
                      </select>

                      <svg
                        aria-hidden="true"
                        viewBox="0 0 16 16"
                        fill="none"
                        className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                      >
                        <path
                          d="m4 6 4 4 4-4"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  )}

                  {!member.isCurrentUser ? (
                    <>
                      <span aria-hidden="true" className="h-5 w-px bg-border" />

                      <button
                        type="button"
                        aria-label={t('removeLabel', { name: member.name })}
                        onClick={() => handleRemove(member.id)}
                        className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-4">
                          <path
                            d="M18 6 6 18M6 6l12 12"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <footer className="flex justify-end border-t px-6 py-4">
        <Button type="button" onClick={onDone}>
          {t('done')}
        </Button>
      </footer>
    </div>
  );
}
