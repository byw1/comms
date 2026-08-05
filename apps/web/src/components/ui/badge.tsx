import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/*
 * Status badges are read at a glance, in peripheral vision, dozens at a time.
 * Tinted-background + saturated-text ("soft") variants stay legible at 11px
 * without shouting the way solid fills do — reserve solid for counts only.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-md border font-medium transition-colors duration-150',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        brand: 'border-transparent bg-brand text-brand-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'border-border-strong text-muted-foreground',

        // Soft variants — the default choice for status.
        'soft-brand': 'border-brand-border/60 bg-brand-muted text-brand',
        'soft-danger': 'border-destructive/25 bg-destructive-muted text-destructive',
        'soft-success': 'border-success/25 bg-success-muted text-success',
        'soft-warning': 'border-warning/30 bg-warning-muted text-warning',
      },
      size: {
        default: 'px-2 py-0.5 text-xs',
        sm: 'px-1.5 py-px text-[11px] leading-[1.35]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

export { Badge, badgeVariants };
