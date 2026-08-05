import { cn } from '@/lib/utils';

/**
 * The Comms wordmark. The mark carries the accent gradient — it's the one place
 * the brand colour appears at full strength, which is what makes it read as a
 * logo rather than as another UI chip.
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
          'relative flex items-center justify-center overflow-hidden text-white shadow-brand',
          'bg-gradient-to-br from-brand to-brand/75',
          radius,
          mark,
        )}
      >
        {/* Specular highlight — keeps the mark from looking like a flat swatch. */}
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/25 to-transparent" />
        <svg viewBox="0 0 24 24" className="relative h-[58%] w-[58%]" fill="none" aria-hidden>
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
