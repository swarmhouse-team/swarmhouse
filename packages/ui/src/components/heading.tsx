import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cn } from '../lib/cn';

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
export type HeadingSize = '2xl' | 'xl' | 'lg' | 'md' | 'sm';

const headingTags = {
  1: 'h1',
  2: 'h2',
  3: 'h3',
  4: 'h4',
  5: 'h5',
  6: 'h6',
} as const;

const defaultSizeByLevel: Record<HeadingLevel, HeadingSize> = {
  1: '2xl',
  2: 'xl',
  3: 'lg',
  4: 'md',
  5: 'sm',
  6: 'sm',
};

export const headingVariants = cva('text-foreground', {
  variants: {
    size: {
      '2xl': 'text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl',
      xl: 'text-3xl font-bold tracking-tight sm:text-4xl',
      lg: 'text-2xl font-semibold',
      md: 'text-xl font-semibold',
      sm: 'text-lg font-semibold',
    },
  },
});

export type HeadingProps = ComponentProps<'h1'> &
  VariantProps<typeof headingVariants> & {
    level: HeadingLevel;
    asChild?: boolean;
  };

export function Heading({ level, size, asChild = false, className, ...props }: HeadingProps) {
  const Comp = asChild ? Slot : headingTags[level];
  const resolvedSize = size ?? defaultSizeByLevel[level];

  return (
    <Comp
      data-slot="heading"
      className={cn(headingVariants({ size: resolvedSize }), className)}
      {...props}
    />
  );
}
