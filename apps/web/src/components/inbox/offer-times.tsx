'use client';

import { useMemo, useState } from 'react';
import { CalendarClock, CornerDownLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  computeSlots,
  formatSlotLabel,
  formatSlotsAsText,
  type AvailabilitySlot,
  type BusinessHours,
} from '@/lib/availability';
import { cn } from '@/lib/utils';

/**
 * Offer meeting times without leaving the thread.
 *
 * Slots come from the workspace business hours — the times someone will
 * actually be around to honor — and land in the composer as plain text,
 * because the person on the other end has a Messages app, not a booking page.
 */
export function OfferTimes({ hours, onInsert }: { hours: BusinessHours; onInsert: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [duration, setDuration] = useState(30);
  const [picked, setPicked] = useState<AvailabilitySlot[]>([]);

  const slots = useMemo(
    () => (open ? computeSlots(hours, { durationMinutes: duration }) : []),
    [open, hours, duration],
  );

  const byDay = useMemo(() => {
    const groups = new Map<string, AvailabilitySlot[]>();
    for (const s of slots) {
      const key = s.start.toDateString();
      groups.set(key, [...(groups.get(key) ?? []), s]);
    }
    return Array.from(groups.entries());
  }, [slots]);

  function toggle(slot: AvailabilitySlot) {
    setPicked((prev) =>
      prev.some((p) => p.start.getTime() === slot.start.getTime())
        ? prev.filter((p) => p.start.getTime() !== slot.start.getTime())
        : [...prev, slot],
    );
  }

  function insert() {
    const text = formatSlotsAsText(picked);
    if (!text) return;
    onInsert(text);
    setOpen(false);
    setPicked([]);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setPicked([]);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="xs" className="gap-1.5" title="Offer available times">
          <CalendarClock className="h-3.5 w-3.5" />
          Times
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-[12px] font-medium">Offer times</p>
          <div className="flex items-center gap-0.5 rounded-lg bg-secondary/70 p-0.5">
            {[15, 30, 60].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setDuration(d);
                  setPicked([]);
                }}
                className={cn(
                  'rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors',
                  duration === d
                    ? 'bg-surface text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {d}m
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto p-2">
          {byDay.length === 0 ? (
            <p className="px-2 py-6 text-center text-[12px] text-muted-foreground">
              No open slots inside your business hours. Adjust them in Settings → Workspace.
            </p>
          ) : (
            byDay.map(([day, daySlots]) => (
              <div key={day} className="mb-2">
                <p className="px-1.5 pb-1 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                  {daySlots[0]!.start.toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
                <div className="flex flex-wrap gap-1">
                  {daySlots.map((s) => {
                    const active = picked.some((p) => p.start.getTime() === s.start.getTime());
                    return (
                      <button
                        key={s.start.toISOString()}
                        type="button"
                        onClick={() => toggle(s)}
                        className={cn(
                          'rounded-md border px-2 py-1 text-[11.5px] font-medium tabular transition-all duration-150 active:scale-95',
                          active
                            ? 'border-brand bg-brand-muted text-brand'
                            : 'text-muted-foreground hover:border-border-strong hover:bg-accent',
                        )}
                      >
                        {s.start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t px-3 py-2">
          <span className="text-[10.5px] text-muted-foreground">
            {picked.length === 0
              ? 'Pick one or more slots'
              : picked.length === 1
                ? formatSlotLabel(picked[0]!)
                : `${picked.length} slots picked`}
          </span>
          <Button size="xs" onClick={insert} disabled={picked.length === 0} className="gap-1">
            Insert
            <CornerDownLeft className="h-3 w-3" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
