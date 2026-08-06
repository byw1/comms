'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Reply, SmilePlus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { sendReaction } from '@/server/actions/imessage';
import type { BBReaction } from '@comms/core';
import { cn } from '@/lib/utils';

/** The six tapbacks iMessage supports, in Apple's own order. */
const TAPBACKS: { key: BBReaction; emoji: string; label: string }[] = [
  { key: 'love', emoji: '❤️', label: 'Love' },
  { key: 'like', emoji: '👍', label: 'Like' },
  { key: 'dislike', emoji: '👎', label: 'Dislike' },
  { key: 'laugh', emoji: '😂', label: 'Haha' },
  { key: 'emphasize', emoji: '‼️', label: 'Emphasize' },
  { key: 'question', emoji: '❓', label: 'Question' },
];

/**
 * Hover actions on a message bubble: tapback and reply-to. Both ride on client
 * methods that already existed but had no UI — `react()` and the
 * `selectedMessageGuid` that was already plumbed through the outbound worker.
 */
export function MessageActions({
  conversationId,
  messageId,
  canReact,
  onReply,
  side,
}: {
  conversationId: string;
  messageId: string;
  /** False when the Private API isn't available, or the message hasn't sent. */
  canReact: boolean;
  onReply: () => void;
  side: 'left' | 'right';
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function react(reaction: BBReaction) {
    setOpen(false);
    start(async () => {
      const res = await sendReaction({ conversationId, messageId, reaction });
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  return (
    <div
      className={cn(
        'flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover/msg:opacity-100 focus-within:opacity-100',
        side === 'right' ? 'order-first' : 'order-last',
        pending && 'opacity-100',
      )}
    >
      <button
        type="button"
        onClick={onReply}
        title="Reply to this message"
        aria-label="Reply to this message"
        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Reply className="h-3.5 w-3.5" />
      </button>

      {canReact && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              title="React"
              aria-label="React to this message"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <SmilePlus className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto rounded-full p-1" align="center" side="top">
            <div className="flex items-center gap-0.5">
              {TAPBACKS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => react(t.key)}
                  title={t.label}
                  aria-label={t.label}
                  className="rounded-full px-1.5 py-1 text-base transition-transform hover:scale-125 active:scale-95"
                >
                  {t.emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
