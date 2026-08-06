'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { MessageThread, type ThreadMessage } from '@/components/inbox/message-thread';
import { Composer } from '@/components/inbox/composer';
import { useCurrentUser } from '@/components/app/realtime-provider';
import type { MacroOption } from '@/components/inbox/macro-picker';
import { sendMessage, undoSend } from '@/server/actions/inbox';

type PendingMessage = ThreadMessage & { realId?: string; addedAt: number };

/**
 * Client shell around the thread + composer that makes sending feel instant:
 * the bubble appears the moment you hit Enter (optimistically, marked queued),
 * the server action runs in the background, and an Undo toast covers the
 * delayed-send window. Server props flowing back through router.refresh
 * reconcile away the optimistic copy.
 */
export interface ReplyTarget {
  id: string;
  body: string | null;
  guid: string | null;
}

export function ThreadShell({
  conversationId,
  messages,
  macros,
  aiEnabled,
  aiDraft,
  canReact = false,
}: {
  conversationId: string;
  messages: ThreadMessage[];
  macros: MacroOption[];
  aiEnabled: boolean;
  aiDraft?: string | null;
  canReact?: boolean;
}) {
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const router = useRouter();
  const me = useCurrentUser();
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const counter = useRef(0);

  // Reconcile: once the server list contains the real message (or a pending
  // entry has sat unreconciled for 30s — something went wrong), drop our copy.
  const serverIds = useMemo(() => new Set(messages.map((m) => m.id)), [messages]);
  useEffect(() => {
    setPending((prev) =>
      prev.filter((p) => !(p.realId && serverIds.has(p.realId)) && Date.now() - p.addedAt < 30_000),
    );
  }, [serverIds]);

  // Switching conversations discards leftover optimistic state.
  useEffect(() => {
    setPending([]);
    setReplyTo(null);
  }, [conversationId]);

  async function handleSubmit(
    body: string,
    isNote: boolean,
    scheduledFor?: Date,
  ): Promise<boolean> {
    counter.current += 1;
    const tempId = `optimistic-${counter.current}`;
    const optimistic: PendingMessage = {
      id: tempId,
      body,
      authorType: 'agent',
      direction: 'outbound',
      isPrivateNote: isNote,
      status: isNote ? 'sent' : 'queued',
      authorName: me?.name ?? null,
      reactionType: null,
      createdAt: new Date(),
      sentAt: new Date(),
      readAt: null,
      deliveredAt: null,
      attachments: [],
      addedAt: Date.now(),
    };
    setPending((prev) => [...prev, optimistic]);

    const res = await sendMessage({
      conversationId,
      body,
      isPrivateNote: isNote,
      scheduledFor: scheduledFor?.toISOString(),
      // Inline reply — the outbound worker already forwards this to BlueBubbles.
      replyToMessageGuid: !isNote ? (replyTo?.guid ?? undefined) : undefined,
    });
    setReplyTo(null);
    if (!res.ok) {
      setPending((prev) => prev.filter((p) => p.id !== tempId));
      toast.error(res.error);
      return false;
    }

    setPending((prev) => prev.map((p) => (p.id === tempId ? { ...p, realId: res.messageId } : p)));

    if (scheduledFor) {
      const messageId = res.messageId;
      toast.success(
        `Scheduled for ${scheduledFor.toLocaleDateString(undefined, { weekday: 'short' })} ${scheduledFor.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`,
        {
          duration: 8000,
          action: {
            label: 'Cancel',
            onClick: () => {
              void (async () => {
                const undo = await undoSend(messageId);
                if (undo.ok) {
                  setPending((prev) => prev.filter((p) => p.realId !== messageId));
                  toast.success('Scheduled message cancelled');
                  router.refresh();
                } else {
                  toast.error(undo.error);
                }
              })();
            },
          },
        },
      );
      router.refresh();
      return true;
    }

    if (!isNote && res.undoMs > 0) {
      const messageId = res.messageId;
      toast('Message sent', {
        description: 'Sending shortly…',
        duration: Math.max(res.undoMs - 500, 1500),
        action: {
          label: 'Undo',
          onClick: () => {
            void (async () => {
              const undo = await undoSend(messageId);
              if (undo.ok) {
                setPending((prev) => prev.filter((p) => p.realId !== messageId));
                toast.success('Message unsent');
                router.refresh();
              } else {
                toast.error(undo.error);
              }
            })();
          },
        },
      });
    }
    return true;
  }

  const merged = useMemo(() => {
    const visible = pending.filter((p) => !(p.realId && serverIds.has(p.realId)));
    return [...messages, ...visible];
  }, [messages, pending, serverIds]);

  return (
    <>
      <MessageThread
        conversationId={conversationId}
        messages={merged}
        canReact={canReact}
        onReplyTo={setReplyTo}
      />
      <Composer
        conversationId={conversationId}
        macros={macros}
        aiEnabled={aiEnabled}
        aiDraft={aiDraft}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        onSubmit={handleSubmit}
      />
    </>
  );
}
