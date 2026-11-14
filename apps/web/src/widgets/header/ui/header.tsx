import { Button } from '@robots/ui';
import Link from 'next/link';

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          aria-label="RobotsProject — главная"
          className="flex items-center gap-2 font-semibold"
        >
          <span
            aria-hidden="true"
            className="grid size-8 place-items-center rounded-md bg-primary text-sm text-primary-foreground"
          >
            R
          </span>
          <span>RobotsProject</span>
        </Link>

        <nav
          aria-label="Навигация по главной странице"
          className="order-3 flex w-full gap-5 text-sm text-muted-foreground sm:order-0 sm:ml-auto sm:w-auto"
        >
          <a href="#how-it-works" className="transition-colors hover:text-foreground">
            Как это работает
          </a>

          <a href="#features" className="transition-colors hover:text-foreground">
            Возможности
          </a>
        </nav>

        <Button asChild size="sm" className="ml-auto sm:ml-0">
          <Link href="/login">Войти</Link>
        </Button>
      </div>
    </header>
  );
}
