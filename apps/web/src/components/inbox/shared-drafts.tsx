'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Loader2, PencilLine, Send, Undo2, Users } from 'lucide-react';
import { AnimatePresence, motion } from '@/components/ui/motion';
import { unshareDraft } from '@/server/actions/drafts';
import { cn } from '@/lib/utils';
import { relativeTime } from '@/lib/format';

export interface SharedDraftItem {
  authorUserId: string;
  authorName: string | null;
  body: string;
  sharedAt: string;
  mine: boolean;
}

/**
 * Shared drafts awaiting review, shown between the thread and the composer —
 * exactly where the reply they propose to be would go.
 *
 * Three verbs per draft: send it as-is (approve), pull it into your own
 * composer to rework it, or hand it back to the author. Your own shared draft
 * shows as "waiting for review" so you know the team can see it.
 */
export function SharedDraftsPanel({
  conversationId,
  drafts,
  isAdmin,
  onApprove,
  onEdit,
}: {
  conversationId: string;
  drafts: SharedDraftItem[];
  isAdmin: boolean;
  /** Approve & send — owned by the shell so optimistic UI + undo apply. */
  onApprove: (authorUserId: string) => Promise<void>;
  /** Load the draft's text into the caller's composer. */
  onEdit: (body: string) => void;
}) {
  const [pendingFor, setPendingFor] = useState<string | null>(null);
  const [, start] = useTransition();

  if (drafts.length === 0) return null;

  function handBack(d: SharedDraftItem) {
    start(async () => {
      const res = await unshareDraft(conversationId, d.authorUserId);
      if (!res.ok) toast.error(res.error ?? 'Could not return the draft');
      else if (d.mine) toast.success('Draft is private again');
      else toast.success(`Returned to ${d.authorName ?? 'the author'}`);
    });
  }

  return (
    <div className="mx-auto w-full max-w-[680px] px-3">
      <AnimatePresence initial={false}>
        {drafts.map((d) => (
          <motion.div
            key={d.authorUserId}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            className={cn(
              'mb-2 overflow-hidden rounded-xl border shadow-xs',
              d.mine ? 'border-border bg-secondary/40' : 'border-brand/35 bg-brand-muted/40',
            )}
          >
            <div className="flex items-center gap-1.5 px-3 pt-2">
              <Users className={cn('h-3 w-3', d.mine ? 'text-muted-foreground' : 'text-brand')} />
              <span className="type-caption font-medium">
                {d.mine ? 'Your shared draft' : `Draft by ${d.authorName ?? 'a teammate'}`}
              </span>
              <span className="type-caption text-muted-foreground/70">
                · {d.mine ? 'waiting for review' : `shared ${relativeTime(d.sharedAt)}`}
              </span>
            </div>

            <p className="whitespace-pre-wrap break-words px-3 py-2 text-[13px] leading-relaxed">
              {d.body}
            </p>

            <div className="flex items-center gap-0.5 border-t border-inherit px-2 py-1.5">
              {!d.mine && (
                <>
                  <button
                    type="button"
                    disabled={pendingFor === d.authorUserId}
                    onClick={() => {
                      setPendingFor(d.authorUserId);
                      void onApprove(d.authorUserId).finally(() => setPendingFor(null));
                    }}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1 text-[11.5px] font-medium text-primary-foreground transition-all hover:opacity-90 active:scale-95 disabled:opacity-60"
                  >
                    {pendingFor === d.authorUserId ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Send className="h-3 w-3" />
                    )}
                    Approve &amp; send
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(d.body)}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <PencilLine className="h-3 w-3" />
                    Edit in composer
                  </button>
                </>
              )}
              {(d.mine || isAdmin) && (
                <button
                  type="button"
                  onClick={() => handBack(d)}
                  className="ml-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Undo2 className="h-3 w-3" />
                  {d.mine ? 'Unshare' : 'Hand back'}
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
