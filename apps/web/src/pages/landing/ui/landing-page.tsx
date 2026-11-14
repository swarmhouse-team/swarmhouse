import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@robots/ui';
import Link from 'next/link';

import { Header } from '@/widgets/header';

const steps = [
  {
    number: '01',
    title: 'Соберите карту',
    description: 'Разместите стены, проходы, станции погрузки и точки доставки.',
  },
  {
    number: '02',
    title: 'Добавьте роботов',
    description: 'Настройте складской флот и назначьте роботам стартовые позиции.',
  },
  {
    number: '03',
    title: 'Создайте задания',
    description: 'Укажите груз, станцию отправления и конечную точку маршрута.',
  },
  {
    number: '04',
    title: 'Наблюдайте',
    description: 'Следите за движением роботов, очередью и состоянием склада.',
  },
] as const;

const features = [
  {
    title: 'Диспетчерская в реальном времени',
    description: 'Карта, роботы и задания обновляются одновременно у всей команды.',
  },
  {
    title: 'Понятные причины простоя',
    description:
      'Сразу видно, почему робот остановился, ожидает маршрут или не может продолжить движение.',
  },
  {
    title: 'Совместная работа',
    description: 'Владелец управляет складом, а наблюдатели следят за симуляцией.',
  },
  {
    title: 'ИИ-помощник',
    description: 'Помогает подготовить задания и быстро разобраться в состоянии склада.',
  },
  {
    title: 'Уведомления в Telegram',
    description: 'Сообщает о завершении задания, ошибке или длительной остановке робота.',
  },
  {
    title: 'Работает после закрытия вкладки',
    description: 'Симуляция выполняется на сервере и не зависит от открытого браузера.',
  },
] as const;

const robots = [
  {
    name: 'R1',
    status: 'Перевозит груз',
    route: 'Приёмка → Станция 4',
  },
  {
    name: 'R2',
    status: 'Свободен',
    route: 'Ожидает новое задание',
  },
  {
    name: 'R3',
    status: 'Ожидает проход',
    route: 'Станция 2 → Упаковка',
  },
] as const;

export function LandingPage() {
  return (
    <div className="min-h-dvh bg-background">
      <Header />

      <main>
        <section className="border-b">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2 lg:px-8 lg:py-32">
            <div>
              <p className="mb-4 text-sm font-medium text-muted-foreground">
                Симуляция склада в браузере
              </p>

              <h1 className="max-w-2xl text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                Соберите склад и наблюдайте, как роботы доставляют грузы
              </h1>

              <p className="mt-6 max-w-xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
                Нарисуйте карту, расставьте станции и роботов, создайте задания на перевозку.
                Симуляция работает на сервере, а вся команда видит изменения в реальном времени.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href="/login">Начать работу</Link>
                </Button>

                <Button asChild variant="outline" size="lg">
                  <a href="#how-it-works">Как это работает</a>
                </Button>
              </div>
            </div>

            <Card className="overflow-hidden bg-muted/30">
              <CardHeader className="border-b">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle>Склад №1</CardTitle>
                    <CardDescription className="mt-1">Симуляция запущена</CardDescription>
                  </div>

                  <p className="text-sm font-medium">3 робота</p>
                </div>
              </CardHeader>

              <CardContent className="grid gap-3">
                {robots.map((robot) => (
                  <Card key={robot.name} className="gap-3 bg-background py-4 shadow-none">
                    <CardHeader className="flex grid-cols-none flex-row items-start justify-between gap-4">
                      <div>
                        <CardTitle>
                          <h2 className="text-base">{robot.name}</h2>
                        </CardTitle>
                        <CardDescription className="mt-1">{robot.route}</CardDescription>
                      </div>

                      <p className="text-right text-sm font-medium">{robot.status}</p>
                    </CardHeader>
                  </Card>
                ))}
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-28 border-b bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Как это работает</h2>

              <p className="mt-3 text-muted-foreground">
                Четыре шага от пустой карты до первой доставки.
              </p>
            </div>

            <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((step) => (
                <li key={step.number}>
                  <Card className="h-full shadow-none">
                    <CardHeader>
                      <p className="text-sm font-medium text-muted-foreground">Шаг {step.number}</p>

                      <CardTitle>
                        <h3 className="text-lg">{step.title}</h3>
                      </CardTitle>
                    </CardHeader>

                    <CardContent>
                      <p className="text-sm leading-6 text-muted-foreground">{step.description}</p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="features" className="scroll-mt-28">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Возможности</h2>

              <p className="mt-3 text-muted-foreground">
                Всё необходимое для управления симуляцией и совместной работы.
              </p>
            </div>

            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <li key={feature.title}>
                  <Card className="h-full shadow-none">
                    <CardHeader>
                      <CardTitle>
                        <h3 className="text-lg">{feature.title}</h3>
                      </CardTitle>

                      <CardDescription className="leading-6">{feature.description}</CardDescription>
                    </CardHeader>
                  </Card>
                </li>
              ))}
            </ul>

            <Card className="mt-12 border-primary bg-primary text-primary-foreground">
              <CardContent className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-2xl font-semibold">Первый склад — за несколько минут</h2>

                  <p className="mt-2 text-sm text-primary-foreground/80">
                    Добавьте станцию, одного робота и первое задание на перевозку.
                  </p>
                </div>

                <Button asChild variant="secondary" size="lg">
                  <Link href="/login">Войти, чтобы создать склад</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>RobotsProject · учебный командный проект</p>
          <p>Симуляция складской логистики</p>
        </div>
      </footer>
    </div>
  );
}
