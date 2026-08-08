'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { highlightRuns } from '@/lib/find-in-text';

export type { FindMatch } from '@/lib/find-in-text';
export { findOffsets, highlightRuns } from '@/lib/find-in-text';

/**
 * Find within a conversation.
 *
 * The browser's own ⌘F only searches what is in the DOM, which for a thread
 * that scrolls years of history is a fraction of it — and it can't tell you
 * "hit 3 of 41". This owns the key instead and searches the loaded messages.
 */

export function ThreadFindBar({
  open,
  query,
  onQueryChange,
  onClose,
  matchCount,
  activeIndex,
  onStep,
}: {
  open: boolean;
  query: string;
  onQueryChange: (q: string) => void;
  onClose: () => void;
  matchCount: number;
  activeIndex: number;
  onStep: (delta: 1 | -1) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [open]);

  if (!open) return null;

  const none = query.length > 0 && matchCount === 0;

  return (
    <div className="flex items-center gap-1.5 border-b bg-surface/95 px-3 py-2 backdrop-blur-xl">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              onClose();
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              onStep(e.shiftKey ? -1 : 1);
            }
          }}
          placeholder="Find in conversation"
          aria-label="Find in conversation"
          className={cn(
            'type-item h-8 w-full rounded-lg border bg-background pl-8 pr-2 outline-none transition-colors',
            'placeholder:text-muted-foreground/60 focus:border-brand',
            none && 'border-destructive/60',
          )}
        />
      </div>

      <span
        className={cn(
          'tabular type-caption min-w-[68px] text-right',
          none ? 'text-destructive' : 'text-muted-foreground',
        )}
      >
        {query.length === 0
          ? ''
          : matchCount === 0
            ? 'No results'
            : `${activeIndex + 1} of ${matchCount}`}
      </span>

      <div className="flex items-center">
        <button
          type="button"
          onClick={() => onStep(-1)}
          disabled={matchCount === 0}
          aria-label="Previous match"
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onStep(1)}
          disabled={matchCount === 0}
          aria-label="Next match"
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close find"
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/** Body text with matches marked, and the current one distinguished. */
export function Highlighted({
  text,
  query,
  activeOffset,
}: {
  text: string;
  query: string;
  /** Offset of the match that is currently selected, if it's in this message. */
  activeOffset?: number;
}) {
  const runs = useMemo(() => highlightRuns(text, query), [text, query]);
  if (runs.length === 1 && !runs[0]!.match) return <>{text}</>;

  let cursor = 0;
  return (
    <>
      {runs.map((run, i) => {
        const at = cursor;
        cursor += run.text.length;
        if (!run.match) return <span key={i}>{run.text}</span>;
        return (
          <mark
            key={i}
            className={cn(
              'rounded-[3px] px-px',
              at === activeOffset
                ? 'bg-warning text-warning-foreground'
                : 'bg-warning/30 text-inherit',
            )}
          >
            {run.text}
          </mark>
        );
      })}
    </>
  );
}
