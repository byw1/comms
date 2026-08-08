'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarClock, CornerDownLeft } from 'lucide-react';
import { describeTime, parseNaturalTime } from '@/lib/parse-time';
import { cn } from '@/lib/utils';

/**
 * "Pick a custom time" for snooze, follow-up and send-later.
 *
 * Typing comes first and the calendar input second, because the fast path is
 * `tue 9am` + Enter — a picker that makes you click through a month grid to
 * say "tomorrow" is slower than the presets it exists to escape. The parsed
 * result is echoed back in full before you commit, since the whole risk of
 * natural language is confidently doing the wrong thing.
 */
export function CustomTimePicker({
  onPick,
  placeholder = 'tue 9am, in 3 hours, tomorrow…',
  autoFocus = true,
}: {
  onPick: (date: Date) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // Recomputed against a fresh `now` on every keystroke: "in 3 hours" typed at
  // 14:59 and committed at 15:01 should mean three hours from the commit.
  const parsed = useMemo(() => (text.trim() ? parseNaturalTime(text) : null), [text]);
  const invalid = text.trim().length > 0 && !parsed;

  function commit() {
    const at = parseNaturalTime(text);
    if (at) onPick(at);
  }

  return (
    <div className="space-y-1.5 p-1">
      <div className="relative">
        <CalendarClock className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Stop Enter/Escape reaching the menu that owns this popover.
            e.stopPropagation();
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            }
          }}
          placeholder={placeholder}
          aria-label="Custom time"
          aria-invalid={invalid}
          className={cn(
            'type-item h-9 w-full rounded-lg border bg-surface pl-8 pr-8 outline-none transition-colors',
            'placeholder:text-muted-foreground/60 focus:border-brand',
            invalid && 'border-destructive/60',
          )}
        />
        {parsed && (
          <CornerDownLeft className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
        )}
      </div>

      {/* Always say what was understood. Silent interpretation is how a
          "tomorrow" ends up scheduled for next March. */}
      <p
        className={cn(
          'type-caption px-1',
          invalid ? 'text-destructive' : 'text-muted-foreground',
        )}
      >
        {parsed
          ? describeTime(parsed)
          : invalid
            ? "Couldn't read that — try “tue 9am” or “in 3 hours”"
            : 'Type a time, or press Enter to confirm'}
      </p>

      <input
        type="datetime-local"
        aria-label="Pick a date and time"
        onChange={(e) => {
          const v = e.target.value;
          if (!v) return;
          const at = new Date(v);
          if (!Number.isNaN(at.getTime()) && at.getTime() > Date.now()) onPick(at);
        }}
        onKeyDown={(e) => e.stopPropagation()}
        className="type-caption h-8 w-full rounded-lg border bg-surface px-2 text-muted-foreground outline-none focus:border-brand"
      />
    </div>
  );
}
