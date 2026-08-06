'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { saveBusinessHours, type BusinessHoursSetting } from '@/server/actions/automations';
import { cn } from '@/lib/utils';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toTimeInput(minutes: number): string {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}

function fromTimeInput(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function BusinessHoursForm({ initial }: { initial: BusinessHoursSetting }) {
  const [days, setDays] = useState<number[]>(initial.days);
  const [start, setStart] = useState(toTimeInput(initial.startMinutes));
  const [end, setEnd] = useState(toTimeInput(initial.endMinutes));
  const [timezone, setTimezone] = useState(
    initial.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await saveBusinessHours({
        days,
        startMinutes: fromTimeInput(start),
        endMinutes: fromTimeInput(end),
        timezone,
      });
      if (res.ok) toast.success('Business hours saved');
      else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-3.5 rounded-xl border bg-surface p-4 shadow-xs">
      <div className="space-y-1.5">
        <Label className="text-[12.5px]">Open days</Label>
        <div className="flex flex-wrap gap-1">
          {DAYS.map((label, i) => {
            const on = days.includes(i);
            return (
              <button
                key={label}
                type="button"
                onClick={() =>
                  setDays((prev) =>
                    prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i].sort(),
                  )
                }
                className={cn(
                  'rounded-md border px-2.5 py-1 text-[12px] font-medium transition-all active:scale-95',
                  on
                    ? 'border-transparent bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent',
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-[12.5px]">Opens</Label>
          <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[12.5px]">Closes</Label>
          <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[12.5px]">Timezone</Label>
          <Input
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="America/Los_Angeles"
          />
        </div>
      </div>

      <Button onClick={save} loading={pending} size="sm">
        Save business hours
      </Button>
    </div>
  );
}
