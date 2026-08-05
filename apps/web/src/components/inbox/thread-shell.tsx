'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { MessageThread, type ThreadMessage } from '@/components/inbox/message-thread';
import { Composer } from '@/components/inbox/composer';
import { useCurrentUser } from '@/components/app/realtime-provider';
import { sendMessage, undoSend } from '@/server/actions/inbox';

type PendingMessage = ThreadMessage & { realId?: string; addedAt: number };

/**
 * Client shell around the thread + composer that makes sending feel instant:
 * the bubble appears the moment you hit Enter (optimistically, marked queued),
 * the server action runs in the background, and an Undo toast covers the
 * delayed-send window. Server props flowing back through router.refresh
 * reconcile away the optimistic copy.
 */
export function ThreadShell({
  conversationId,
  messages,
  macros,
  aiEnabled,
}: {
  conversationId: string;
  messages: ThreadMessage[];
  macros: { id: string; name: string; body: string }[];
  aiEnabled: boolean;
}) {
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
  useEffect(() => setPending([]), [conversationId]);

  async function handleSubmit(body: string, isNote: boolean): Promise<boolean> {
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

    const res = await sendMessage({ conversationId, body, isPrivateNote: isNote });
    if (!res.ok) {
      setPending((prev) => prev.filter((p) => p.id !== tempId));
      toast.error(res.error);
      return false;
    }

    setPending((prev) => prev.map((p) => (p.id === tempId ? { ...p, realId: res.messageId } : p)));

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
      <MessageThread conversationId={conversationId} messages={merged} />
      <Composer
        conversationId={conversationId}
        macros={macros}
        aiEnabled={aiEnabled}
        onSubmit={handleSubmit}
      />
    </>
  );
}
