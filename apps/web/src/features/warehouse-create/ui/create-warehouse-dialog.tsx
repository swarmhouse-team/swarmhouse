'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { createWarehouseRequestSchema, type CreateWarehouseRequest } from '@robots/shared';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
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
    resolver: zodResolver(createWarehouseRequestSchema),
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
            <div className="space-y-5 p-6">
              <DialogTitle>{t('title')}</DialogTitle>
              <DialogDescription className="sr-only">{t('description')}</DialogDescription>

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
                        maxLength={100}
                        autoComplete="off"
                        placeholder={t('namePlaceholder')}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <footer className="flex justify-end gap-3 border-t px-6 py-4">
              <Button type="button" variant="outline" onClick={handleCancel}>
                {t('cancel')}
              </Button>

              <Button
                type="submit"
                disabled={!form.formState.isValid || form.formState.isSubmitting}
              >
                {t('submit')}
              </Button>
            </footer>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
