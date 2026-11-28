'use client';

import { useZodResolver } from '@/shared/i18n';
import {
  createWarehouseRequestSchema,
  MAX_WAREHOUSE_NAME_LENGTH,
  MIN_WAREHOUSE_NAME_LENGTH,
  type CreateWarehouseRequest,
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from '@robots/ui';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { useForm } from 'react-hook-form';

type CreateWarehouseDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string) => void;
};

export function CreateWarehouseDialog({
  open,
  onOpenChange,
  onCreate,
}: CreateWarehouseDialogProps) {
  const t = useTranslations('warehouses.create');
  const form = useForm<CreateWarehouseRequest>({
    resolver: useZodResolver(createWarehouseRequestSchema),
    mode: 'onChange',
    defaultValues: {
      name: '',
    },
  });

  const { handleSubmit, reset } = form;

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        reset();
      }

      onOpenChange(nextOpen);
    },
    [onOpenChange, reset],
  );

  const handleCreate = useCallback(
    ({ name }: CreateWarehouseRequest) => {
      onCreate(name);
      handleOpenChange(false);
    },
    [handleOpenChange, onCreate],
  );

  const submit = handleSubmit(handleCreate);

  const handleCancel = useCallback(() => handleOpenChange(false), [handleOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <Form {...form}>
          <form onSubmit={submit}>
            <DialogHeader className="pb-0">
              <DialogTitle>{t('title')}</DialogTitle>
              <DialogDescription className="sr-only">{t('description')}</DialogDescription>
            </DialogHeader>

            <DialogBody>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('nameLabel')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        autoFocus
                        minLength={MIN_WAREHOUSE_NAME_LENGTH}
                        maxLength={MAX_WAREHOUSE_NAME_LENGTH}
                        autoComplete="off"
                        placeholder={t('namePlaceholder')}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCancel}>
                {t('cancel')}
              </Button>

              <Button
                type="submit"
                disabled={!form.formState.isValid || form.formState.isSubmitting}
              >
                {t('submit')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
