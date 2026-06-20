'use client';

import { useEffect, useRef } from 'react';
import { Check, CheckCheck, Clock, Loader2, AlertCircle, Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';
import { shortTime } from '@/lib/format';
import { markRead } from '@/server/actions/inbox';

type Attachment = {
  id: string;
  fileName: string | null;
  mimeType: string | null;
  status: string;
};

export type ThreadMessage = {
  id: string;
  body: string | null;
  authorType: 'contact' | 'agent' | 'system' | 'external';
  direction: 'inbound' | 'outbound';
  isPrivateNote: boolean;
  status: string;
  authorName: string | null;
  reactionType: string | null;
  createdAt: Date | string;
  sentAt: Date | string | null;
  readAt: Date | string | null;
  deliveredAt: Date | string | null;
  attachments: Attachment[];
};

const REACTION_EMOJI: Record<string, string> = {
  love: '❤️',
  like: '👍',
  dislike: '👎',
  laugh: '😂',
  emphasize: '‼️',
  question: '❓',
};

function StatusTick({ message }: { message: ThreadMessage }) {
  if (message.isPrivateNote) return null;
  switch (message.status) {
    case 'queued':
      return <Clock className="h-3 w-3" />;
    case 'sending':
      return <Loader2 className="h-3 w-3 animate-spin" />;
    case 'failed':
      return <AlertCircle className="h-3 w-3 text-destructive" />;
    case 'read':
      return <CheckCheck className="h-3 w-3 text-sky-400" />;
    case 'delivered':
      return <CheckCheck className="h-3 w-3" />;
    default:
      return <Check className="h-3 w-3" />;
  }
}

function AttachmentView({ att }: { att: Attachment }) {
  const isImage = att.mimeType?.startsWith('image/');
  if (att.status !== 'stored') {
    return (
      <div className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        {att.fileName ?? 'Attachment'} (downloading…)
      </div>
    );
  }
  if (isImage) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <a href={`/api/attachments/${att.id}`} target="_blank" rel="noreferrer">
        <img
          src={`/api/attachments/${att.id}`}
          alt={att.fileName ?? 'attachment'}
          className="max-h-64 max-w-full rounded-lg border"
        />
      </a>
    );
  }
  return (
    <a
      href={`/api/attachments/${att.id}`}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs hover:bg-accent"
    >
      <Paperclip className="h-3.5 w-3.5" />
      {att.fileName ?? 'Download attachment'}
    </a>
  );
}

export function MessageThread({
  conversationId,
  messages,
}: {
  conversationId: string;
  messages: ThreadMessage[];
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages.length]);

  useEffect(() => {
    void markRead(conversationId);
  }, [conversationId, messages.length]);

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-6">
      {messages.map((m) => {
        if (m.authorType === 'system') {
          return (
            <div key={m.id} className="flex justify-center">
              <span className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
                {m.body}
              </span>
            </div>
          );
        }

        if (m.reactionType) {
          const base = m.reactionType.replace('-', '');
          const removed = m.reactionType.startsWith('-');
          return (
            <div key={m.id} className="flex justify-center">
              <span className="text-xs text-muted-foreground">
                {m.authorName ?? (m.direction === 'inbound' ? 'Contact' : 'You')}{' '}
                {removed ? 'removed a' : 'reacted'} {REACTION_EMOJI[base] ?? '👍'}
              </span>
            </div>
          );
        }

        const isOutbound = m.direction === 'outbound';
        const isNote = m.isPrivateNote;

        return (
          <div
            key={m.id}
            className={cn('flex animate-fade-in flex-col', isOutbound ? 'items-end' : 'items-start')}
          >
            {isOutbound && m.authorName && !isNote && (
              <span className="mb-0.5 px-1 text-[11px] text-muted-foreground">{m.authorName}</span>
            )}
            <div
              className={cn(
                'max-w-[78%] space-y-2 rounded-2xl px-3.5 py-2 text-sm shadow-sm',
                isNote
                  ? 'border border-warning/40 bg-warning/10 text-foreground'
                  : isOutbound
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground',
              )}
            >
              {isNote && (
                <p className="text-[10px] font-medium uppercase tracking-wide text-warning">
                  Internal note
                </p>
              )}
              {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
              {m.attachments.map((a) => (
                <AttachmentView key={a.id} att={a} />
              ))}
            </div>
            <div
              className={cn(
                'mt-1 flex items-center gap-1 px-1 text-[11px] text-muted-foreground',
                isOutbound ? 'flex-row-reverse' : '',
              )}
            >
              <span>{shortTime(m.sentAt ?? m.createdAt)}</span>
              {isOutbound && <StatusTick message={m} />}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
