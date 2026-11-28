import type { FC, SVGProps } from 'react';

// Импорт `*.svg` отдаёт React-компонент (см. turbopack.rules в next.config.ts).
declare module '*.svg' {
  const SvgComponent: FC<SVGProps<SVGSVGElement>>;
  export default SvgComponent;
}
