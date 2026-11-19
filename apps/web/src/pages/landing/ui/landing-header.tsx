import { Button, Text } from '@robots/ui';
import { useTranslations } from 'next-intl';

import { LocaleSwitcher } from '@/features/switch-locale';
import { Link } from '@/shared/i18n';

export function LandingHeader() {
  const t = useTranslations('landing');

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" aria-label={t('header.homeLabel')} className="flex items-center gap-2">
          <Text
            as="span"
            size="sm"
            weight="medium"
            aria-hidden="true"
            className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground"
          >
            {t('header.logo')}
          </Text>

          <Text as="span" size="sm" weight="semibold" className="hidden sm:inline">
            {t('header.brand')}
          </Text>
        </Link>

        <nav
          aria-label={t('header.navLabel')}
          className="ml-auto hidden gap-5 text-sm text-muted-foreground sm:flex"
        >
          <a href="#how-it-works" className="transition-colors hover:text-foreground">
            {t('nav.howItWorks')}
          </a>

          <a href="#features" className="transition-colors hover:text-foreground">
            {t('nav.features')}
          </a>
        </nav>

        <div className="ml-auto flex items-center gap-3 sm:ml-0">
          <LocaleSwitcher />

          <Button asChild size="sm">
            <Link href="/login">{t('header.signIn')}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
