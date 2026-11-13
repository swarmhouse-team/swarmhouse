import { Button, Form, FormControl, FormField, FormItem, FormMessage, Input } from '@robots/ui';
import { fireEvent, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { renderWithProviders } from '@/shared/lib/test-utils';

import { useZodResolver } from './use-zod-resolver';

const schema = z.object({
  name: z.string().min(3),
  // Явное сообщение — ключ словаря.
  code: z.string().refine((value) => value !== 'x', 'validation.invalid_value'),
});

function TestForm() {
  const form = useForm({ resolver: useZodResolver(schema), defaultValues: { name: '', code: '' } });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(() => {})}>
        {(['name', 'code'] as const).map((name) => (
          <FormField
            key={name}
            control={form.control}
            name={name}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input aria-label={name} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ))}
        <Button type="submit">submit</Button>
      </form>
    </Form>
  );
}

describe('useZodResolver', () => {
  it('сообщения правил на текущем языке', async () => {
    renderWithProviders(<TestForm />, { locale: 'en' });

    fireEvent.change(screen.getByLabelText('name'), { target: { value: 'ab' } });
    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    expect(await screen.findByText('At least 3 characters')).toBeInTheDocument();
  });

  it('явное сообщение схемы переводится как ключ словаря', async () => {
    renderWithProviders(<TestForm />);

    fireEvent.change(screen.getByLabelText('name'), { target: { value: 'abc' } });
    fireEvent.change(screen.getByLabelText('code'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    expect(await screen.findByText('Недопустимое значение')).toBeInTheDocument();
  });
});
