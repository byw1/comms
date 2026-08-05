'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { updateConversation } from '@/server/actions/inbox';
import { PresenceBar } from '@/components/inbox/presence-bar';
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
  status,
}: {
  conversationId: string;
  number: number;
  name: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function setStatus(next: 'open' | 'closed') {
    start(async () => {
      const res = await updateConversation({ id: conversationId, status: next });
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  return (
    <header className="flex h-[52px] shrink-0 items-center justify-between gap-4 border-b bg-surface/80 px-4 backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-2.5">
        <h1 className="truncate text-[14px] font-semibold tracking-[-0.01em]">{name}</h1>
        <span className="tabular shrink-0 rounded-md bg-secondary px-1.5 py-px font-mono text-[11px] text-muted-foreground">
          #{number}
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-[11.5px] capitalize text-muted-foreground">
          <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[status])} />
          {status}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <PresenceBar conversationId={conversationId} />
        {status === 'closed' ? (
          <Button size="sm" variant="outline" onClick={() => setStatus('open')} loading={pending}>
            <RotateCcw className="h-3.5 w-3.5" />
            Reopen
          </Button>
        ) : (
          <Button size="sm" onClick={() => setStatus('closed')} loading={pending}>
            <Check className="h-3.5 w-3.5" />
            Close
          </Button>
        )}
      </div>
    </header>
  );
}
