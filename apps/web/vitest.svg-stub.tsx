import type { SVGProps } from 'react';

// Заглушка SVG-импортов для тестов: в Vitest нет SVGR, поэтому иконка рендерится пустым <svg>.
const SvgStub = (props: SVGProps<SVGSVGElement>) => <svg {...props} />;

export default SvgStub;
