'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Zap, CornerDownLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MacroOption {
  id: string;
  name: string;
  body: string;
  shortcut: string | null;
  hasActions: boolean;
}

/**
 * Slash-command macro picker. Rendered above the composer when the draft
 * starts with `/`, filtered by whatever follows it. Arrow keys move, Enter or
 * Tab inserts — the composer forwards those keys rather than handling them.
 */
export function MacroPicker({
  macros,
  query,
  onPick,
  onDismiss,
  activeIndex,
  setActiveIndex,
}: {
  macros: MacroOption[];
  query: string;
  onPick: (m: MacroOption) => void;
  onDismiss: () => void;
  activeIndex: number;
  setActiveIndex: (i: number) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return macros.slice(0, 8);
    return macros
      .filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          (m.shortcut ?? '').toLowerCase().includes(q) ||
          m.body.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [macros, query]);

  // Keep the highlighted row in view as the user arrows through.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  useEffect(() => {
    if (filtered.length === 0) onDismiss();
  }, [filtered.length, onDismiss]);

  if (filtered.length === 0) return null;

  return (
    <div className="mb-1.5 overflow-hidden rounded-xl border bg-popover shadow-lg">
      <div className="flex items-center gap-1.5 border-b px-3 py-1.5 text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
        <Zap className="h-3 w-3" />
        Macros
        <span className="ml-auto flex items-center gap-1 normal-case tracking-normal">
          <kbd className="rounded border bg-secondary px-1">↑↓</kbd>
          <kbd className="rounded border bg-secondary px-1">
            <CornerDownLeft className="inline h-2.5 w-2.5" />
          </kbd>
        </span>
      </div>
      <div ref={listRef} className="max-h-56 overflow-y-auto p-1">
        {filtered.map((m, i) => (
          <button
            key={m.id}
            type="button"
            data-idx={i}
            onMouseEnter={() => setActiveIndex(i)}
            // onMouseDown (not onClick) so the composer never loses focus first.
            onMouseDown={(e) => {
              e.preventDefault();
              onPick(m);
            }}
            className={cn(
              'flex w-full flex-col items-start gap-0.5 rounded-lg px-2.5 py-1.5 text-left transition-colors',
              i === activeIndex ? 'bg-accent' : 'hover:bg-accent/60',
            )}
          >
            <span className="flex w-full items-center gap-1.5">
              <span className="text-[13px] font-medium">{m.name}</span>
              {m.shortcut && (
                <span className="rounded bg-secondary px-1 font-mono text-[10px] text-muted-foreground">
                  /{m.shortcut}
                </span>
              )}
              {m.hasActions && (
                <span className="ml-auto rounded bg-secondary px-1.5 text-[10px] text-muted-foreground">
                  + actions
                </span>
              )}
            </span>
            <span className="line-clamp-1 text-[11.5px] text-muted-foreground">{m.body}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Returns the `/query` at the start of the draft, or null if not in slash mode. */
export function slashQuery(body: string): string | null {
  const m = /^\/([\w-]*)$/.exec(body);
  return m ? (m[1] ?? '') : null;
}

/** Filter helper shared with the composer so Enter picks the same row. */
export function filterMacros(macros: MacroOption[], query: string): MacroOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return macros.slice(0, 8);
  return macros
    .filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.shortcut ?? '').toLowerCase().includes(q) ||
        m.body.toLowerCase().includes(q),
    )
    .slice(0, 8);
}

/** Keep the visual list and the Enter target in sync. */
export function useMacroPickerState(macros: MacroOption[], body: string) {
  const query = slashQuery(body);
  const open = query !== null;
  const [activeIndex, setActiveIndex] = useState(0);
  const filtered = useMemo(
    () => (open ? filterMacros(macros, query ?? '') : []),
    [macros, open, query],
  );
  useEffect(() => setActiveIndex(0), [query]);
  return { open: open && filtered.length > 0, query: query ?? '', filtered, activeIndex, setActiveIndex };
}
