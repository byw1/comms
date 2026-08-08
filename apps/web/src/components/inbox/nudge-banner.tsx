'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { AlarmClockCheck, X } from 'lucide-react';
import { dismissNudge } from '@/server/actions/inbox';
import { relativeTime } from '@/lib/format';

export interface NudgeData {
  excerpt: string;
  dueAt: string;
}

/**
 * "You said you'd send this Friday; that was 4 days ago."
 *
 * Detected from your own outbound words by the worker — nobody set a
 * reminder, which is exactly what distinguishes a nudge from one. Dismissing
 * is permanent for this particular promise; replying clears it automatically.
 */
export function NudgeBanner({
  conversationId,
  nudge,
}: {
  conversationId: string;
  nudge: NudgeData;
}) {
  const [hidden, setHidden] = useState(false);
  const [, start] = useTransition();

  if (hidden) return null;

  return (
    <div className="mx-auto w-full max-w-[680px] px-3 pt-3">
      <div className="flex items-start gap-2.5 rounded-xl border border-warning/35 bg-warning-muted px-3 py-2.5">
        <AlarmClockCheck className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-medium">
            You said “<span className="italic">{nudge.excerpt}</span>”
          </p>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
            That was due {relativeTime(nudge.dueAt)} — reply below, or dismiss if it's handled.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('comms:focus-composer'))}
            className="rounded-lg bg-primary px-2.5 py-1 text-[11.5px] font-medium text-primary-foreground transition-all hover:opacity-90 active:scale-95"
          >
            Reply
          </button>
          <button
            type="button"
            onClick={() => {
              setHidden(true);
              start(async () => {
                const res = await dismissNudge(conversationId);
                if (!res.ok) {
                  setHidden(false);
                  toast.error(res.error);
                }
              });
            }}
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Dismiss nudge"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
