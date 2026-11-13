import '@/app/styles/globals.css';

import { NotFoundPage } from '@/pages/not-found';
import { DEFAULT_LOCALE, LocalIntlProvider } from '@/shared/i18n';

// Вне сегмента [locale] (например, `/robots.txt` без файла) языка нет — показываем 404 на языке по умолчанию.
export default function GlobalNotFound() {
  return (
    <html lang={DEFAULT_LOCALE}>
      <body className="min-h-dvh antialiased">
        <LocalIntlProvider>
          <NotFoundPage />
        </LocalIntlProvider>
      </body>
    </html>
  );
}
