'use client';

import { SimulationStatus, type MockWarehouse, type WarehouseMember } from '@/entities/warehouse';
import { useZodResolver } from '@/shared/i18n';
import { WarehouseUsersTab } from './warehouse-users-tab';
import {
  MAX_WAREHOUSE_NAME_LENGTH,
  MIN_WAREHOUSE_NAME_LENGTH,
  renameWarehouseRequestSchema,
  type RenameWarehouseRequest,
} from '@robots/shared';
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Text,
} from '@robots/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

type SettingsTab = 'general' | 'users';

const SETTINGS_TABS_ORIENTATION = 'vertical' as const;

type WarehouseSettingsDialogProps = {
  warehouse: MockWarehouse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (warehouseId: string, name: string) => void;
  onMembersChange: (warehouseId: string, members: readonly WarehouseMember[]) => void;
};

export function WarehouseSettingsDialog({
  warehouse,
  open,
  onOpenChange,
  onSave,
  onMembersChange,
}: WarehouseSettingsDialogProps) {
  const t = useTranslations('warehouses.settings');
  const format = useFormatter();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  const form = useForm<RenameWarehouseRequest>({
    resolver: useZodResolver(renameWarehouseRequestSchema),
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

  const handleSave = useCallback(
    (values: RenameWarehouseRequest) => {
      if (!warehouse) {
        return;
      }

      onSave(warehouse.warehouseId, values.name);
      onOpenChange(false);
    },
    [onOpenChange, onSave, warehouse],
  );

  const handleCancel = useCallback(() => {
    if (!warehouse) {
      return;
    }

    reset({
      name: warehouse.name,
    });

    onOpenChange(false);
  }, [onOpenChange, reset, warehouse]);

  const handleTabChange = useCallback((tab: string) => setActiveTab(tab as SettingsTab), []);

  const handleMembersChange = useCallback(
    (members: readonly WarehouseMember[]) => {
      if (warehouse) {
        onMembersChange(warehouse.warehouseId, members);
      }
    },
    [onMembersChange, warehouse],
  );

  const handleDone = useCallback(() => onOpenChange(false), [onOpenChange]);

  if (!warehouse) {
    return null;
  }

  const createdAt = warehouse.createdAt
    ? format.dateTime(new Date(warehouse.createdAt), {
        dateStyle: 'long',
        timeZone: 'UTC',
      })
    : t('notAvailable');

  const submit = handleSubmit(handleSave);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-3xl">
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          orientation={SETTINGS_TABS_ORIENTATION}
          className="grid min-h-130 gap-0 md:grid-cols-[190px_1fr]"
        >
          <aside className="border-b bg-muted/30 p-5 md:border-r md:border-b-0">
            <div className="mb-6">
              <Text weight="semibold">{t('title')}</Text>

              <Text variant="muted" size="xs" className="mt-1 truncate">
                {warehouse.name}
              </Text>
            </div>

            <TabsList
              aria-label={t('navigationLabel')}
              className="-m-1 flex w-auto flex-col items-stretch gap-2 rounded-none bg-transparent p-1 text-foreground md:m-0 md:p-0"
            >
              <TabsTrigger
                value="general"
                className="w-full justify-start text-left text-muted-foreground hover:bg-muted hover:text-foreground data-[state=active]:text-foreground"
              >
                {t('tabs.general')}
              </TabsTrigger>

              <TabsTrigger
                value="size"
                disabled
                title={t('tabs.unavailable')}
                className="w-full justify-start text-left text-muted-foreground"
              >
                {t('tabs.size')}
              </TabsTrigger>

              <TabsTrigger
                value="users"
                className="w-full justify-start text-left text-muted-foreground hover:bg-muted hover:text-foreground data-[state=active]:text-foreground"
              >
                {t('tabs.users')}
              </TabsTrigger>
            </TabsList>
          </aside>

          <div className="flex min-w-0 flex-col">
            <DialogHeader className="border-b px-6 py-5 pr-14">
              <DialogTitle>
                {activeTab === 'general' ? t('tabs.general') : t('tabs.users')}
              </DialogTitle>

              <DialogDescription className="mt-1">
                {activeTab === 'general' ? t('general.description') : t('users.description')}
              </DialogDescription>
            </DialogHeader>

            <TabsContent value="general" className="flex flex-1 flex-col">
              <Form {...form}>
                <form onSubmit={submit} className="flex flex-1 flex-col">
                  <DialogBody className="flex-1 space-y-6">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between gap-4">
                            <FormLabel>{t('general.nameLabel')}</FormLabel>

                            <Text as="span" variant="muted" size="xs">
                              {t('general.characterCount', {
                                count: nameLength,
                                max: MAX_WAREHOUSE_NAME_LENGTH,
                              })}
                            </Text>
                          </div>

                          <FormControl>
                            <Input
                              {...field}
                              minLength={MIN_WAREHOUSE_NAME_LENGTH}
                              maxLength={MAX_WAREHOUSE_NAME_LENGTH}
                              autoComplete="off"
                            />
                          </FormControl>

                          <FormDescription>
                            {t('general.nameHint', {
                              min: MIN_WAREHOUSE_NAME_LENGTH,
                              max: MAX_WAREHOUSE_NAME_LENGTH,
                            })}
                          </FormDescription>

                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="rounded-lg border bg-muted/20 p-4">
                      <dl className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <dt className="text-sm text-muted-foreground">
                            {t('general.createdAt')}
                          </dt>

                          <dd className="mt-1 text-sm font-medium">{createdAt}</dd>
                        </div>

                        <div>
                          <dt className="text-sm text-muted-foreground">{t('general.mapSize')}</dt>

                          <dd className="mt-1 text-sm font-medium">
                            {t('general.mapSizeValue', {
                              width: warehouse.mapSize.width,
                              height: warehouse.mapSize.height,
                            })}
                          </dd>
                        </div>

                        <div>
                          <dt className="text-sm text-muted-foreground">
                            {t('general.simulationStatus')}
                          </dt>

                          <dd className="mt-1">
                            <SimulationStatus status={warehouse.simulationStatus} />
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </DialogBody>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={handleCancel}>
                      {t('general.cancel')}
                    </Button>

                    <Button type="submit" disabled={!isDirty || !isValid || isSubmitting}>
                      {t('general.save')}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="users" className="flex flex-1 flex-col">
              <WarehouseUsersTab
                members={warehouse.members}
                onMembersChange={handleMembersChange}
                onDone={handleDone}
              />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
