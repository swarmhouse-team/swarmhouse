'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import type { ComponentProps } from 'react';

import { cn } from '../lib/cn';
import { useUiText } from '../providers/ui-text-provider';
import { Icon } from './icon';

export function Dialog(props: ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root {...props} />;
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn('text-lg font-semibold', className)} {...props} />;
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

export function DialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-1.5 p-6 pr-14', className)}
      {...props}
    />
  );
}

export function DialogBody({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="dialog-body" className={cn('p-6', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn('flex justify-end gap-3 border-t px-6 py-4', className)}
      {...props}
    />
  );
}

export function DialogContent({
  className,
  children,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content>) {
  const text = useUiText();

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="dialog-overlay-motion fixed inset-0 z-50 bg-black/60" />

      <DialogPrimitive.Content
        className={cn(
          'dialog-content-motion fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg overflow-hidden rounded-xl border bg-background shadow-xl',
          className,
        )}
        {...props}
      >
        {children}

        <DialogPrimitive.Close
          aria-label={text.dialog.close}
          className="absolute top-4 right-4 flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Icon name="x" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
