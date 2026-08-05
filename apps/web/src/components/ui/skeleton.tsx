import { cn } from '@/lib/utils';

/**
 * A sweeping sheen rather than a pulsing block — it reads as "loading" instead
 * of "broken", and the movement direction hints that content flows in.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('skeleton-sheen rounded-md bg-muted/70', className)} {...props} />
  );
}

export { Skeleton };
