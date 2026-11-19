'use client';

import { type WarehouseMember, type WarehouseMemberRole } from '@/entities/warehouse';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  Heading,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Text,
  cn,
} from '@robots/ui';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
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

type WarehouseMemberRowProps = {
  member: WarehouseMember;
  onRoleChange: (memberId: string, role: WarehouseMemberRole) => void;
  onRemove: (memberId: string) => void;
};

function WarehouseMemberRow({ member, onRoleChange, onRemove }: WarehouseMemberRowProps) {
  const t = useTranslations('warehouses.settings.users');

  const handleRoleChange = useCallback(
    (role: string) => onRoleChange(member.id, role as WarehouseMemberRole),
    [member.id, onRoleChange],
  );

  const handleRemove = useCallback(() => onRemove(member.id), [member.id, onRemove]);

  return (
    <li className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
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
          <Text size="sm" weight="medium" className="truncate">
            {member.name}
            {member.isCurrentUser ? ` ${t('currentUser')}` : ''}
          </Text>

          <Text variant="muted" size="xs" className="truncate">
            {member.status === 'pending' ? t('invitationSent') : member.email}
          </Text>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:justify-end">
        {member.status === 'pending' ? (
          <Text as="span" size="xs" className="rounded-full bg-amber-100 px-2 py-1 text-amber-800">
            {t('pending')}
          </Text>
        ) : (
          <Select
            value={member.role}
            disabled={member.isCurrentUser}
            onValueChange={handleRoleChange}
          >
            <SelectTrigger
              size="sm"
              aria-label={t('roleLabel', { name: member.name })}
              className="min-w-28 text-xs"
            >
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="owner" className="text-xs">
                {t('ownerRole')}
              </SelectItem>
              <SelectItem value="observer" className="text-xs">
                {t('observerRole')}
              </SelectItem>
            </SelectContent>
          </Select>
        )}

        {!member.isCurrentUser ? (
          <>
            <span aria-hidden="true" className="h-5 w-px bg-border" />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t('removeLabel', { name: member.name })}
              onClick={handleRemove}
              className="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-4">
                <path
                  d="M18 6 6 18M6 6l12 12"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </Button>
          </>
        ) : null}
      </div>
    </li>
  );
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

  const handleRoleChange = useCallback(
    (memberId: string, role: WarehouseMemberRole) => {
      onMembersChange(
        members.map((member) => (member.id === memberId ? { ...member, role } : member)),
      );
    },
    [members, onMembersChange],
  );

  const handleRemove = useCallback(
    (memberId: string) => {
      onMembersChange(members.filter((member) => member.id !== memberId));
    },
    [members, onMembersChange],
  );

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
              <Text
                as="div"
                variant="muted"
                size="sm"
                className="flex h-9 items-center rounded-md border bg-muted/30 px-3"
              >
                {t('observerRole')}
              </Text>

              <Button type="submit">{t('invite')}</Button>
            </div>
          </form>
        </Form>

        <Text variant="muted" size="xs">
          {t('observerDescription')}
        </Text>

        <div>
          <div className="mb-3 flex items-center justify-between gap-4">
            <Heading level={3} size="sm" className="text-sm">
              {t('participants')}
            </Heading>

            <Text as="span" variant="muted" size="xs">
              {t('participantsCount', { active: activeCount, pending: pendingCount })}
            </Text>
          </div>

          <ul className="divide-y rounded-lg border">
            {members.map((member) => (
              <WarehouseMemberRow
                key={member.id}
                member={member}
                onRoleChange={handleRoleChange}
                onRemove={handleRemove}
              />
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
