import { cn } from '@/lib/utils';

/**
 * The Comms wordmark. Flat ink tile — black in light mode, white in dark.
 * No gradient, no highlight: the monochrome system IS the brand.
 */
export function Logo({
  className,
  size = 'md',
  showWordmark = true,
}: {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
}) {
  const mark = size === 'lg' ? 'h-10 w-10' : size === 'sm' ? 'h-6 w-6' : 'h-7 w-7';
  const text = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-[0.95rem]' : 'text-[1.05rem]';
  const radius = size === 'lg' ? 'rounded-[0.75rem]' : 'rounded-[0.5rem]';

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div
        className={cn(
          'flex items-center justify-center bg-primary text-primary-foreground',
          radius,
          mark,
        )}
      >
        <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" fill="none" aria-hidden>
          <path
            d="M4 6.5C4 5.12 5.12 4 6.5 4h11C18.88 4 20 5.12 20 6.5v7c0 1.38-1.12 2.5-2.5 2.5H9l-4 4V6.5Z"
            fill="currentColor"
          />
        </svg>
      </div>
      {showWordmark && (
        <span className={cn('font-semibold tracking-[-0.02em]', text)}>Comms</span>
      )}
    </div>
  );
}
