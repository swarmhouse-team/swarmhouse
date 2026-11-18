'use client';

import { SimulationStatus, type MockWarehouse, type WarehouseMember } from '@/entities/warehouse';
import { WarehouseUsersTab } from './warehouse-users-tab';
import { zodResolver } from '@hookform/resolvers/zod';
import { renameWarehouseRequestSchema, type RenameWarehouseRequest } from '@robots/shared';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  cn,
} from '@robots/ui';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

type SettingsTab = 'general' | 'users';

type WarehouseSettingsDialogProps = {
  warehouse: MockWarehouse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (warehouseId: string, name: string) => void;
  onMembersChange: (warehouseId: string, members: readonly WarehouseMember[]) => void;
};

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  dateStyle: 'long',
  timeZone: 'UTC',
});

export function WarehouseSettingsDialog({
  warehouse,
  open,
  onOpenChange,
  onSave,
  onMembersChange,
}: WarehouseSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  const form = useForm<RenameWarehouseRequest>({
    resolver: zodResolver(renameWarehouseRequestSchema),
    mode: 'onChange',
    defaultValues: {
      name: warehouse?.name ?? '',
    },
  });

  const {
    formState: { isDirty, isValid, isSubmitting },
    handleSubmit,
    reset,
  } = form;

  const nameValue = useWatch({
    control: form.control,
    name: 'name',
  });

  const nameLength = nameValue.length;

  if (!warehouse) {
    return null;
  }

  const createdAt = warehouse.createdAt ? dateFormatter.format(new Date(warehouse.createdAt)) : '—';

  const submit = handleSubmit((values) => {
    onSave(warehouse.warehouseId, values.name);
    onOpenChange(false);
  });

  const handleCancel = () => {
    reset({
      name: warehouse.name,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-3xl">
        <div className="grid min-h-130 md:grid-cols-[190px_1fr]">
          <aside className="border-b bg-muted/30 p-5 md:border-r md:border-b-0">
            <div className="mb-6">
              <p className="font-semibold">Настройки склада</p>

              <p className="mt-1 truncate text-xs text-muted-foreground">{warehouse.name}</p>
            </div>

            <nav aria-label="Разделы настроек" className="flex gap-2 overflow-x-auto md:flex-col">
              <button
                type="button"
                onClick={() => setActiveTab('general')}
                className={cn(
                  'rounded-md px-3 py-2 text-left text-sm transition-colors',
                  activeTab === 'general'
                    ? 'bg-background font-medium shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                Основное
              </button>

              <button
                type="button"
                disabled
                title="Раздел пока не реализован"
                className="cursor-not-allowed rounded-md px-3 py-2 text-left text-sm text-muted-foreground opacity-50"
              >
                Размер
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('users')}
                className={cn(
                  'rounded-md px-3 py-2 text-left text-sm transition-colors',
                  activeTab === 'users'
                    ? 'bg-background font-medium shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                Пользователи
              </button>
            </nav>
          </aside>

          <div className="flex min-w-0 flex-col">
            <header className="border-b px-6 py-5 pr-14">
              <DialogTitle>{activeTab === 'general' ? 'Основное' : 'Пользователи'}</DialogTitle>

              <DialogDescription className="mt-1">
                {activeTab === 'general'
                  ? 'Название и информация о складе'
                  : 'Управление доступом к складу'}
              </DialogDescription>
            </header>

            {activeTab === 'general' ? (
              <Form {...form}>
                <form onSubmit={submit} className="flex flex-1 flex-col">
                  <div className="flex-1 space-y-6 p-6">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between gap-4">
                            <FormLabel>Название</FormLabel>

                            <span className="text-xs text-muted-foreground">
                              {nameLength} / 100
                            </span>
                          </div>

                          <FormControl>
                            <Input {...field} maxLength={100} autoComplete="off" />
                          </FormControl>

                          <FormDescription>От 1 до 100 символов.</FormDescription>

                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="rounded-lg border bg-muted/20 p-4">
                      <dl className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <dt className="text-sm text-muted-foreground">Дата создания</dt>

                          <dd className="mt-1 text-sm font-medium">{createdAt}</dd>
                        </div>

                        <div>
                          <dt className="text-sm text-muted-foreground">Размер карты</dt>

                          <dd className="mt-1 text-sm font-medium">
                            {warehouse.mapSize.width} × {warehouse.mapSize.height} клеток
                          </dd>
                        </div>

                        <div>
                          <dt className="text-sm text-muted-foreground">Статус симуляции</dt>

                          <dd className="mt-1">
                            <SimulationStatus status={warehouse.simulationStatus} />
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>

                  <footer className="flex justify-end gap-3 border-t px-6 py-4">
                    <Button type="button" variant="outline" onClick={handleCancel}>
                      Отмена
                    </Button>

                    <Button type="submit" disabled={!isDirty || !isValid || isSubmitting}>
                      Сохранить
                    </Button>
                  </footer>
                </form>
              </Form>
            ) : (
              <WarehouseUsersTab
                members={warehouse.members}
                onMembersChange={(members) => onMembersChange(warehouse.warehouseId, members)}
                onDone={() => onOpenChange(false)}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
