import { createNavigation } from 'next-intl/navigation';

import { routing } from './routing';

/**
 * Навигация с учётом языка: ссылки и переходы сохраняют текущий префикс.
 * Вместо `next/link` и `next/navigation` для внутренних путей используем эти.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
