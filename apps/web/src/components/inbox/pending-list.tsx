'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Bell, Clock, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CustomTimePicker } from '@/components/inbox/time-picker';
import { cancelScheduled } from '@/server/actions/inbox';
import {
  rescheduleConversation,
  rescheduleMessage,
  type PendingItem,
} from '@/server/actions/scheduled';
import { describeTime } from '@/lib/parse-time';
import { cn } from '@/lib/utils';

const KIND = {
  send: { icon: Send, label: 'Scheduled message', cancel: 'Cancel send' },
  reminder: { icon: Bell, label: 'Reminder if no reply', cancel: 'Cancel reminder' },
  snooze: { icon: Clock, label: 'Snoozed', cancel: 'Wake now' },
} as const;

export function PendingList({ items }: { items: PendingItem[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [openFor, setOpenFor] = useState<string | null>(null);

  function reschedule(item: PendingItem, at: Date) {
    setOpenFor(null);
    start(async () => {
      const res =
        item.kind === 'send'
          ? await rescheduleMessage(item.id, at.toISOString())
          : await rescheduleConversation(item.conversationId, item.kind, at.toISOString());
      if (res.ok) {
        toast.success(`Moved to ${describeTime(at)}`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function cancel(item: PendingItem) {
    start(async () => {
      const res =
        item.kind === 'send'
          ? await cancelScheduled(item.id)
          : await rescheduleConversation(item.conversationId, item.kind, null);
      if (res.ok) {
        toast.success(item.kind === 'send' ? 'Send cancelled' : 'Cleared');
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-secondary text-muted-foreground">
          <Clock className="h-5 w-5" />
        </div>
        <div>
          <p className="type-title">Nothing waiting</p>
          <p className="type-body mt-0.5 text-muted-foreground">
            Messages you schedule, reminders you set, and conversations you snooze all appear here
            until they fire.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="divide-y rounded-xl border">
      {items.map((item) => {
        const meta = KIND[item.kind];
        const Icon = meta.icon;
        const key = `${item.kind}:${item.id}`;
        const due = new Date(item.dueAt);
        const overdue = due.getTime() < Date.now();

        return (
          <div key={key} className="flex flex-wrap items-center gap-3 px-3 py-3">
            <span
              className={cn(
                'grid h-8 w-8 shrink-0 place-items-center rounded-lg',
                item.kind === 'send'
                  ? 'bg-brand-muted text-brand'
                  : 'bg-secondary text-muted-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>

            <div className="min-w-0 flex-1">
              <Link
                href={`/inbox/${item.conversationId}`}
                className="type-title block truncate hover:underline"
              >
                {item.conversationName}
              </Link>
              <p className="type-body truncate text-muted-foreground">
                {item.body ? item.body : meta.label}
              </p>
            </div>

            <span
              className={cn(
                'type-caption tabular shrink-0',
                // A due time in the past means the worker hasn't got to it yet
                // — worth showing rather than hiding behind a stale timestamp.
                overdue ? 'text-warning' : 'text-muted-foreground',
              )}
            >
              {overdue ? 'due now' : describeTime(due)}
            </span>

            <div className="flex shrink-0 items-center gap-1">
              <Popover
                open={openFor === key}
                onOpenChange={(o) => setOpenFor(o ? key : null)}
              >
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2" disabled={pending}>
                    Reschedule
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 p-1">
                  <CustomTimePicker onPick={(at) => reschedule(item, at)} />
                </PopoverContent>
              </Popover>

              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => cancel(item)}
                disabled={pending}
                aria-label={meta.cancel}
                title={meta.cancel}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
