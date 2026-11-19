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
  const form = useForm<CreateWarehouseRequest>({
    resolver: zodResolver(createWarehouseRequestSchema),
    mode: 'onChange',
    defaultValues: {
      name: '',
    },
  });

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      form.reset();
    }

    onOpenChange(nextOpen);
  };

  const handleSubmit = form.handleSubmit(({ name }) => {
    onCreate(name);
    handleOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <Form {...form}>
          <form onSubmit={handleSubmit}>
            <div className="space-y-5 p-6">
              <DialogTitle>Новый склад</DialogTitle>
              <DialogDescription className="sr-only">
                Введите название нового склада.
              </DialogDescription>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Название</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        autoFocus
                        maxLength={100}
                        autoComplete="off"
                        placeholder="Например, Центральный склад"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <footer className="flex justify-end gap-3 border-t px-6 py-4">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Отмена
              </Button>

              <Button
                type="submit"
                disabled={!form.formState.isValid || form.formState.isSubmitting}
              >
                Создать склад
              </Button>
            </footer>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
