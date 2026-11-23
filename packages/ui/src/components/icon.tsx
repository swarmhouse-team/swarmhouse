import type { ComponentProps } from 'react';

import { cn } from '../lib/cn';

const iconPaths = {
  check: <path d="m5 12 4 4L19 6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronUp: <path d="m6 15 6-6 6 6" />,
  ellipsis: (
    <>
      <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  x: <path d="M18 6 6 18M6 6l12 12" />,
} as const;

export type IconName = keyof typeof iconPaths;

export type IconProps = Omit<ComponentProps<'svg'>, 'children'> & {
  name: IconName;
};

export function Icon({ name, className, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-4', className)}
      {...props}
    >
      {iconPaths[name]}
    </svg>
  );
}
