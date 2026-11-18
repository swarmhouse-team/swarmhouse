'use client';

import { type WarehouseMember, type WarehouseMemberRole } from '@/entities/warehouse';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Form, FormControl, FormField, FormItem, FormMessage, Input, cn } from '@robots/ui';
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
        message: 'Этот пользователь уже приглашён',
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
                      placeholder="name@company.com"
                      autoComplete="email"
                    />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2">
              <div className="flex h-9 items-center rounded-md border bg-muted/30 px-3 text-sm text-muted-foreground">
                Наблюдатель
              </div>

              <Button type="submit">Пригласить</Button>
            </div>
          </form>
        </Form>

        <p className="text-xs text-muted-foreground">
          Наблюдатель видит карту и симуляцию в реальном времени.
        </p>

        <div>
          <div className="mb-3 flex items-center justify-between gap-4">
            <h3 className="text-sm font-semibold">Участники</h3>

            <span className="text-xs text-muted-foreground">
              {activeCount} доступно · {pendingCount} ожидает
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
                      {member.isCurrentUser ? ' (вы)' : ''}
                    </p>

                    <p className="truncate text-xs text-muted-foreground">
                      {member.status === 'pending' ? 'Приглашение отправлено' : member.email}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:justify-end">
                  {member.status === 'pending' ? (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">
                      Ожидает
                    </span>
                  ) : (
                    <select
                      aria-label={`Роль пользователя ${member.name}`}
                      value={member.role}
                      disabled={member.isCurrentUser}
                      onChange={(event) =>
                        handleRoleChange(member.id, event.target.value as WarehouseMemberRole)
                      }
                      className="h-9 rounded-md border bg-background px-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="owner">Владелец</option>
                      <option value="observer">Наблюдатель</option>
                    </select>
                  )}

                  {!member.isCurrentUser ? (
                    <button
                      type="button"
                      aria-label={`Удалить пользователя ${member.name}`}
                      onClick={() => handleRemove(member.id)}
                      className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <footer className="flex justify-end border-t px-6 py-4">
        <Button type="button" onClick={onDone}>
          Готово
        </Button>
      </footer>
    </div>
  );
}
