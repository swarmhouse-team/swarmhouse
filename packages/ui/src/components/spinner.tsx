import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '../lib/cn';

type SpinnerProps = Pick<ComponentPropsWithoutRef<'span'>, 'className'>;

export function Spinner({ className }: SpinnerProps) {
  return (
    <span
      data-slot="spinner"
      aria-hidden="true"
      className={cn(
        'inline-block size-8 shrink-0 rounded-full border-[3px] border-primary/20 border-t-primary motion-safe:animate-spin',
        className,
      )}
    />
  );
}
