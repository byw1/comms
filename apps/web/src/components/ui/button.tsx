import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

/*
 * Buttons carry the app's tactility. Three things do the work:
 *   - `active:scale-[0.97]` — a press should feel like a press.
 *   - transition-all on a smooth curve, so hover/press interpolate rather than snap.
 *   - shadow that lifts on hover and flattens on press, mirroring real depth.
 */
const buttonVariants = cva(
  'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 ease-smooth active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-md active:shadow-xs',
        brand:
          'bg-brand text-brand-foreground shadow-sm hover:bg-brand/90 hover:shadow-brand active:shadow-xs',
        destructive:
          'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 hover:shadow-md active:shadow-xs',
        outline:
          'border border-border-strong bg-surface shadow-xs hover:border-border-strong hover:bg-accent hover:shadow-sm active:shadow-none',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
        ghost: 'hover:bg-accent hover:text-accent-foreground active:bg-accent/80',
        link: 'text-brand underline-offset-4 hover:underline active:scale-100',
      },
      size: {
        default: 'h-9 px-3.5 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        xs: 'h-7 rounded-md px-2.5 text-xs [&_svg]:size-3.5',
        lg: 'h-11 rounded-xl px-6 text-[0.95rem]',
        icon: 'h-9 w-9',
        'icon-sm': 'h-8 w-8 rounded-md [&_svg]:size-4',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Swaps content for a spinner and blocks interaction, preserving button width. */
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';

    // `asChild` forwards a single child to Slot, so the spinner wrapper must not
    // apply — render through untouched in that case.
    if (asChild) {
      return (
        <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
          {children}
        </Comp>
      );
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <span className="absolute inset-0 grid place-items-center">
            <Loader2 className="animate-spin" />
          </span>
        )}
        <span
          className={cn(
            'inline-flex items-center gap-2 transition-opacity',
            loading && 'opacity-0',
          )}
        >
          {children}
        </span>
      </Comp>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
