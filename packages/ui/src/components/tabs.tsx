'use client';

import {
  createContext,
  type ComponentProps,
  type KeyboardEvent,
  type ReactNode,
  useContext,
  useId,
} from 'react';

import { cn } from '../lib/cn';

type TabsOrientation = 'horizontal' | 'vertical';

type TabsContextValue = {
  id: string;
  orientation: TabsOrientation;
  value: string;
  onValueChange: (value: string) => void;
};

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const context = useContext(TabsContext);

  if (!context) {
    throw new Error('Tabs components must be used inside <Tabs>');
  }

  return context;
}

type TabsProps = Omit<ComponentProps<'div'>, 'onChange'> & {
  value: string;
  onValueChange: (value: string) => void;
  orientation?: TabsOrientation;
};

export function Tabs({
  value,
  onValueChange,
  orientation = 'horizontal',
  className,
  children,
  ...props
}: TabsProps) {
  const id = useId();

  return (
    <TabsContext.Provider value={{ id, orientation, value, onValueChange }}>
      <div
        data-slot="tabs"
        data-orientation={orientation}
        className={cn('flex gap-2', className)}
        {...props}
      >
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className, onKeyDown, ...props }: ComponentProps<'div'>) {
  const { orientation } = useTabsContext();

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);

    if (event.defaultPrevented) {
      return;
    }

    const previousKey = orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp';
    const nextKey = orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown';

    if (![previousKey, nextKey, 'Home', 'End'].includes(event.key)) {
      return;
    }

    const tabs = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'),
    );
    const currentIndex = tabs.indexOf(document.activeElement as HTMLButtonElement);

    if (currentIndex === -1 || tabs.length === 0) {
      return;
    }

    event.preventDefault();

    const targetIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tabs.length - 1
          : (currentIndex + (event.key === nextKey ? 1 : -1) + tabs.length) % tabs.length;

    tabs[targetIndex]?.focus();
    tabs[targetIndex]?.click();
  };

  return (
    <div
      role="tablist"
      aria-orientation={orientation}
      data-slot="tabs-list"
      data-orientation={orientation}
      className={cn(
        'inline-flex w-fit items-center rounded-lg bg-muted p-1 text-muted-foreground',
        className,
      )}
      onKeyDown={handleKeyDown}
      {...props}
    />
  );
}

type TabsTriggerProps = ComponentProps<'button'> & {
  value: string;
};

export function TabsTrigger({ value, className, onClick, ...props }: TabsTriggerProps) {
  const context = useTabsContext();
  const isActive = context.value === value;

  return (
    <button
      type="button"
      role="tab"
      id={`${context.id}-trigger-${value}`}
      aria-controls={`${context.id}-content-${value}`}
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
      data-slot="tabs-trigger"
      data-state={isActive ? 'active' : 'inactive'}
      className={cn(
        'inline-flex h-8 items-center justify-center rounded-md px-3 text-sm font-medium whitespace-nowrap transition-all outline-none',
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
        'disabled:pointer-events-none disabled:opacity-50',
        'data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
        className,
      )}
      onClick={(event) => {
        onClick?.(event);

        if (!event.defaultPrevented) {
          context.onValueChange(value);
        }
      }}
      {...props}
    />
  );
}

type TabsContentProps = ComponentProps<'div'> & {
  value: string;
  children: ReactNode;
};

export function TabsContent({ value, className, ...props }: TabsContentProps) {
  const context = useTabsContext();

  if (context.value !== value) {
    return null;
  }

  return (
    <div
      role="tabpanel"
      id={`${context.id}-content-${value}`}
      aria-labelledby={`${context.id}-trigger-${value}`}
      data-slot="tabs-content"
      data-state="active"
      className={cn('outline-none', className)}
      {...props}
    />
  );
}
