import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentPropsWithoutRef, ElementType } from 'react';

import { cn } from '../lib/cn';

export const textVariants = cva('', {
  variants: {
    variant: {
      default: 'text-foreground',
      muted: 'text-muted-foreground',
      lead: 'text-pretty leading-7 text-muted-foreground',
      destructive: 'text-destructive',
    },
    size: {
      xs: 'text-xs',
      sm: 'text-sm',
      base: 'text-base',
      lg: 'text-lg',
    },
    weight: {
      normal: 'font-normal',
      medium: 'font-medium',
      semibold: 'font-semibold',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'base',
    weight: 'normal',
  },
});

export type TextElement = 'p' | 'span' | 'div' | 'li';

export type TextProps<T extends TextElement = 'p'> = ComponentPropsWithoutRef<T> &
  VariantProps<typeof textVariants> & {
    as?: T;
    asChild?: boolean;
  };

export function Text<T extends TextElement = 'p'>({
  as,
  asChild = false,
  variant,
  size,
  weight,
  className,
  ...props
}: TextProps<T>) {
  const Comp: ElementType = asChild ? Slot : (as ?? 'p');

  return (
    <Comp
      data-slot="text"
      className={cn(textVariants({ variant, size, weight }), className)}
      {...props}
    />
  );
}
