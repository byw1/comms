import { cn } from '@/lib/utils';

/** The Comms wordmark — a solid black square mark + clean type. */
export function Logo({
  className,
  size = 'md',
  showWordmark = true,
}: {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
}) {
  const mark = size === 'lg' ? 'h-9 w-9' : size === 'sm' ? 'h-6 w-6' : 'h-7 w-7';
  const text = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-base' : 'text-lg';
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div
        className={cn(
          'flex items-center justify-center rounded-[0.5rem] bg-foreground text-background',
          mark,
        )}
      >
        <svg viewBox="0 0 24 24" className="h-[60%] w-[60%]" fill="none" aria-hidden>
          <path
            d="M4 6.5C4 5.12 5.12 4 6.5 4h11C18.88 4 20 5.12 20 6.5v7c0 1.38-1.12 2.5-2.5 2.5H9l-4 4V6.5Z"
            fill="currentColor"
          />
        </svg>
      </div>
      {showWordmark && (
        <span className={cn('font-semibold tracking-tight', text)}>Comms</span>
      )}
    </div>
  );
}
