'use client';

import { loginRequestSchema, type LoginRequest } from '@robots/shared';
import {
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from '@robots/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';

import { currentUserQueryKey, login, useSessionStore } from '@/entities/session';
import { HttpError, useErrorMessage } from '@/shared/api';
import { useRouter, useZodResolver } from '@/shared/i18n';

export function LoginForm() {
  const t = useTranslations('login');
  const getErrorMessage = useErrorMessage();
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useForm<LoginRequest>({
    resolver: useZodResolver(loginRequestSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(credentials: LoginRequest) {
    form.clearErrors('root');

    try {
      const { accessToken } = await login(credentials);
      queryClient.removeQueries({ queryKey: currentUserQueryKey });
      useSessionStore.getState().setAccessToken(accessToken);
      const next = new URLSearchParams(window.location.search).get('next');
      // Разрешаем возврат только на известный закрытый маршрут.
      router.replace(next && /^\/warehouses(?:[?#]|$)/.test(next) ? next : '/warehouses');
    } catch (error) {
      form.setError('root', {
        message:
          error instanceof HttpError && error.status === 401
            ? t('invalidCredentials')
            : getErrorMessage(error),
      });
    }
  }

  const rootError = form.formState.errors.root?.message;

  return (
    <Form {...form}>
      <form className="grid gap-5" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('email')}</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" autoFocus {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('password')}</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {rootError && (
          <p role="alert" className="text-sm text-destructive">
            {rootError}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? t('submitting') : t('submit')}
        </Button>
      </form>
    </Form>
  );
}
