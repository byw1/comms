'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, RotateCcw, Clock, ChevronLeft, PanelRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { updateConversation } from '@/server/actions/inbox';
import { PresenceBar } from '@/components/inbox/presence-bar';
import { SNOOZE_PRESETS } from '@/lib/snooze';
import { cn } from '@/lib/utils';

/** Status is a dot + label rather than a filled chip — quieter in a header. */
const STATUS_DOT: Record<string, string> = {
  open: 'bg-success',
  pending: 'bg-warning',
  snoozed: 'bg-muted-foreground',
  closed: 'bg-muted-foreground/60',
};

export function ConversationHeader({
  conversationId,
  number,
  name,
  status: serverStatus,
}: {
  conversationId: string;
  number: number;
  name: string;
  status: string;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  // Optimistic status: flips instantly on click, server props reconcile later.
  const [status, setStatus] = useState(serverStatus);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  useEffect(() => setStatus(serverStatus), [serverStatus]);

  // The global `s` shortcut opens the snooze menu for the open conversation.
  useEffect(() => {
    const open = () => setSnoozeOpen(true);
    window.addEventListener('comms:snooze-open', open);
    return () => window.removeEventListener('comms:snooze-open', open);
  }, []);

  function applyStatus(next: 'open' | 'closed') {
    const prev = status;
    setStatus(next);
    start(async () => {
      const res = await updateConversation({ id: conversationId, status: next });
      if (!res.ok) {
        setStatus(prev);
        toast.error(res.error);
      } else {
        router.refresh();
      }
    });
  }

  function snooze(until: Date, label: string) {
    const prev = status;
    setStatus('snoozed');
    setSnoozeOpen(false);
    start(async () => {
      const res = await updateConversation({
        id: conversationId,
        status: 'snoozed',
        snoozedUntil: until.toISOString(),
      });
      if (!res.ok) {
        setStatus(prev);
        toast.error(res.error);
      } else {
        toast.success(`Snoozed until ${label.toLowerCase()}`);
        router.refresh();
      }
    });
  }

  return (
    <header className="flex h-[52px] shrink-0 items-center justify-between gap-2 border-b bg-surface/80 px-2.5 backdrop-blur-xl md:gap-4 md:px-4">
      <div className="flex min-w-0 items-center gap-2 md:gap-2.5">
        <Link
          href="/inbox"
          className="-ml-0.5 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
          aria-label="Back to conversations"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="truncate text-[14px] font-semibold tracking-[-0.01em]">{name}</h1>
        <span className="tabular hidden shrink-0 rounded-md bg-secondary px-1.5 py-px font-mono text-[11px] text-muted-foreground sm:inline">
          #{number}
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-[11.5px] capitalize text-muted-foreground">
          <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[status])} />
          {status}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1 md:gap-2">
        <div className="hidden sm:block">
          <PresenceBar conversationId={conversationId} />
        </div>

        {status !== 'closed' && (
          <DropdownMenu open={snoozeOpen} onOpenChange={setSnoozeOpen}>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Snooze</span>
                <kbd className="ml-0.5 hidden rounded border bg-secondary px-1 text-[10px] text-muted-foreground md:inline">
                  s
                </kbd>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                Snooze until…
              </DropdownMenuLabel>
              {SNOOZE_PRESETS.map((p) => {
                const when = p.until();
                return (
                  <DropdownMenuItem key={p.key} onClick={() => snooze(when, p.label)}>
                    <span className="flex-1">{p.label}</span>
                    <span className="tabular text-[11px] text-muted-foreground">
                      {when.toLocaleDateString(undefined, { weekday: 'short' })}{' '}
                      {when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {status === 'closed' ? (
          <Button size="sm" variant="outline" onClick={() => applyStatus('open')}>
            <RotateCcw className="h-3.5 w-3.5" />
            Reopen
          </Button>
        ) : (
          <Button size="sm" onClick={() => applyStatus('closed')}>
            <Check className="h-3.5 w-3.5" />
            Close
            <kbd className="ml-0.5 hidden rounded border border-primary-foreground/25 px-1 text-[10px] opacity-70 md:inline">
              e
            </kbd>
          </Button>
        )}

        {/* Ticket details live in a slide-over below lg. */}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event('comms:toggle-details'))}
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden"
          aria-label="Ticket details"
        >
          <PanelRight className="h-[18px] w-[18px]" />
        </button>
      </div>
    </header>
  );
}
