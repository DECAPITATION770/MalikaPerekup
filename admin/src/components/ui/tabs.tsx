import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...rest }, ref) => (
  // Track surface: container fill goes a half-step DOWN the surface scale
  // (bg-bg, the page background) so the active trigger going UP to bg-bg2
  // has a real lightness delta in both themes. Old setup put container at
  // bg-bg2 and trigger at bg-bg3 — in light theme that delta is only 3%
  // and the active state effectively vanished (the bug the user flagged).
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex h-10 items-center justify-center rounded-xl bg-bg p-1 text-text-dim',
      'border border-border',
      className,
    )}
    {...rest}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...rest }, ref) => (
  // Active state lifts off the track: bg-bg2 + small drop-shadow + thin
  // border so the segmented control reads as a physical toggle (Apple /
  // Material 3 pattern). Inactive gains a hover affordance so the row
  // doesn't feel inert.
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-1.5',
      // Explicit transition list (was `transition-all`) — only colour, bg,
      // border and shadow change between states.
      'text-label font-semibold tracking-tight transition-[background-color,border-color,box-shadow,color] duration-150',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
      'disabled:pointer-events-none disabled:opacity-50',
      'hover:text-text',
      'data-[state=active]:bg-bg2 data-[state=active]:text-text',
      'data-[state=active]:border data-[state=active]:border-border',
      'data-[state=active]:shadow-[0_1px_2px_rgb(0_0_0/0.06),0_1px_3px_rgb(0_0_0/0.10)]',
      className,
    )}
    {...rest}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...rest }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded-xl',
      className,
    )}
    {...rest}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
