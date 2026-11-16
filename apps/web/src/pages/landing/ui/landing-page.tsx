import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Heading,
  Text,
} from '@robots/ui';
import { useTranslations } from 'next-intl';

import { Link } from '@/shared/i18n';

import { LandingHeader } from './landing-header';

const STEPS = ['buildMap', 'addRobots', 'createTasks', 'observe'] as const;

const FEATURES = [
  'realtime',
  'idleReasons',
  'collaboration',
  'aiAssistant',
  'telegram',
  'serverSide',
] as const;

const ROBOTS = [
  { id: 'r1', name: 'R1' },
  { id: 'r2', name: 'R2' },
  { id: 'r3', name: 'R3' },
] as const;

export function LandingPage() {
  const t = useTranslations('landing');

  return (
    <div className="min-h-dvh bg-background">
      <LandingHeader />

      <main>
        <section className="border-b">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-10 sm:px-6 sm:py-24 lg:grid-cols-2 lg:px-8 lg:py-32">
            <div>
              <Text variant="muted" size="sm" weight="medium" className="mb-4">
                {t('hero.eyebrow')}
              </Text>

              <Heading level={1} className="max-w-2xl">
                {t('hero.title')}
              </Heading>

              <Text variant="lead" size="base" className="mt-6 max-w-xl sm:text-lg">
                {t('hero.lead')}
              </Text>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href="/login">{t('hero.start')}</Link>
                </Button>

                <Button asChild variant="outline" size="lg">
                  <a href="#how-it-works">{t('hero.howItWorks')}</a>
                </Button>
              </div>
            </div>

            <Card className="overflow-hidden bg-muted/30">
              <CardHeader className="border-b pb-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle>{t('preview.warehouse')}</CardTitle>
                    <CardDescription className="mt-1">{t('preview.status')}</CardDescription>
                  </div>

                  <Text size="sm" weight="medium">
                    {t('preview.robotCount', { count: ROBOTS.length })}
                  </Text>
                </div>
              </CardHeader>

              <CardContent className="grid gap-3">
                {ROBOTS.map((robot) => (
                  <Card key={robot.name} className="gap-3 bg-background py-4 shadow-none">
                    <CardHeader className="flex grid-cols-none flex-row items-start justify-between gap-4">
                      <div>
                        <CardTitle asChild>
                          <Text>{robot.name}</Text>
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {t(`preview.robots.${robot.id}.route`)}
                        </CardDescription>
                      </div>

                      <Text size="sm" weight="medium" className="text-right">
                        {t(`preview.robots.${robot.id}.status`)}
                      </Text>
                    </CardHeader>
                  </Card>
                ))}
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-14 border-b bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
            <div className="max-w-2xl">
              <Heading level={2}>{t('howItWorks.title')}</Heading>

              <Text variant="muted" className="mt-3">
                {t('howItWorks.subtitle')}
              </Text>
            </div>

            <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, index) => (
                <li key={step}>
                  <Card className="h-full shadow-none">
                    <CardHeader>
                      <Text variant="muted" size="sm" weight="medium">
                        {t('howItWorks.step', { number: String(index + 1).padStart(2, '0') })}
                      </Text>

                      <CardTitle asChild>
                        <Heading level={3} size="sm">
                          {t(`howItWorks.steps.${step}.title`)}
                        </Heading>
                      </CardTitle>
                    </CardHeader>

                    <CardContent>
                      <Text variant="muted" className="leading-6">
                        {t(`howItWorks.steps.${step}.description`)}
                      </Text>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="features" className="scroll-mt-14">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
            <div className="max-w-2xl">
              <Heading level={2}>{t('features.title')}</Heading>

              <Text variant="muted" className="mt-3">
                {t('features.subtitle')}
              </Text>
            </div>

            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <li key={feature}>
                  <Card className="h-full shadow-none">
                    <CardHeader>
                      <CardTitle asChild>
                        <Heading level={3} size="sm">
                          {t(`features.items.${feature}.title`)}
                        </Heading>
                      </CardTitle>

                      <CardDescription className="leading-6">
                        {t(`features.items.${feature}.description`)}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </li>
              ))}
            </ul>

            <Card className="mt-12 border-primary bg-primary text-primary-foreground">
              <CardContent className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
                <div>
                  <Heading level={2} size="lg" className="text-primary-foreground">
                    {t('features.cta.title')}
                  </Heading>

                  <Text size="sm" className="mt-2 text-primary-foreground/80">
                    {t('features.cta.description')}
                  </Text>
                </div>

                <Button asChild variant="secondary" size="lg">
                  <Link href="/login">{t('features.cta.action')}</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <Text variant="muted" size="sm">
            {t('footer.project')}
          </Text>

          <Text variant="muted" size="sm">
            {t('footer.tagline')}
          </Text>
        </div>
      </footer>
    </div>
  );
}
