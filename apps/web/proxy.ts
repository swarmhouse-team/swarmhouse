import createMiddleware from 'next-intl/middleware';

import { routing } from '@/shared/i18n/routing/routing';

// Адрес без префикса языка перенаправляется: cookie NEXT_LOCALE → Accept-Language → `ru`.
export default createMiddleware(routing);

export const config = {
  // Всё, кроме /api (проксируется в бэкенд), служебных путей Next и файлов с расширением.
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
