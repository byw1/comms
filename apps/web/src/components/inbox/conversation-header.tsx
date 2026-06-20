'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, RotateCcw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { updateConversation } from '@/server/actions/inbox';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-success/15 text-success border-success/30',
  pending: 'bg-warning/15 text-warning border-warning/30',
  snoozed: 'bg-secondary text-secondary-foreground',
  closed: 'bg-secondary text-muted-foreground',
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
    <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
      <div className="flex items-center gap-3">
        <h1 className="font-semibold">{name}</h1>
        <span className="text-xs text-muted-foreground">#{number}</span>
        <Badge variant="outline" className={cn('capitalize', STATUS_STYLES[status])}>
          {status}
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        {status === 'closed' ? (
          <Button size="sm" variant="outline" onClick={() => setStatus('open')} disabled={pending}>
            {pending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="mr-1.5 h-4 w-4" />
            )}
            Reopen
          </Button>
        ) : (
          <Button size="sm" onClick={() => setStatus('closed')} disabled={pending}>
            {pending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-1.5 h-4 w-4" />
            )}
            Close
          </Button>
        )}
      </div>
    </header>
  );
}
