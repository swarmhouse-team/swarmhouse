import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cn } from '../lib/cn';

export const avatarVariants = cva(
  'inline-flex shrink-0 items-center justify-center rounded-full bg-muted font-medium text-muted-foreground',
  {
    variants: {
      size: {
        sm: 'size-8 text-xs',
        default: 'size-9 text-xs',
        lg: 'size-10 text-sm',
      },
      variant: {
        default: '',
        dashed: 'border border-dashed border-border',
      },
    },
    defaultVariants: {
      size: 'default',
      variant: 'default',
    },
  },
);

export type AvatarProps = ComponentProps<'span'> & VariantProps<typeof avatarVariants>;

export function Avatar({ className, size, variant, ...props }: AvatarProps) {
  return (
    <span
      data-slot="avatar"
      className={cn(avatarVariants({ size, variant, className }))}
      {...props}
    />
  );
}
