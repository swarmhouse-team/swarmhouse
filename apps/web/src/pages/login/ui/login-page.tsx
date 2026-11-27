import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@robots/ui';
import { useTranslations } from 'next-intl';

import { LocaleSwitcher } from '@/features/switch-locale';
import { Link } from '@/shared/i18n';

import { LoginForm } from './login-form';

export function LoginPage() {
  const t = useTranslations('login');

  return (
    <main className="grid min-h-dvh place-items-center bg-muted/30 px-4 py-16">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/">{t('backHome')}</Link>
        </Button>
        <LocaleSwitcher />
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
