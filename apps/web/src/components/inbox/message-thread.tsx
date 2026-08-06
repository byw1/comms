'use client';

import { useEffect, useRef } from 'react';
import { Check, CheckCheck, Clock, Loader2, AlertCircle, Paperclip, Lock, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { clockTime, dayLabel } from '@/lib/format';
import { markRead } from '@/server/actions/inbox';
import { MessageActions } from '@/components/inbox/message-actions';

type Attachment = {
  id: string;
  fileName: string | null;
  mimeType: string | null;
  status: string;
  isVoiceMemo?: boolean;
  /** Null when no browser-playable rendition could be produced (e.g. raw CAF). */
  playable?: boolean;
  transcript?: string | null;
  transcriptSource?: string | null;
};

export type ThreadMessage = {
  id: string;
  body: string | null;
  /** Null until the message has actually left the Mac — can't be reacted to yet. */
  providerMessageGuid?: string | null;
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
      return <CheckCheck className="h-3 w-3 text-brand" />;
    case 'delivered':
      return <CheckCheck className="h-3 w-3" />;
    default:
      return <Check className="h-3 w-3" />;
  }
}

function AttachmentView({ att, onBubble }: { att: Attachment; onBubble: boolean }) {
  const isImage = att.mimeType?.startsWith('image/');

  if (att.status !== 'stored') {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs',
          onBubble ? 'border-white/20 text-current opacity-80' : 'text-muted-foreground',
        )}
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        {att.fileName ?? 'Attachment'} · downloading
      </div>
    );
  }

  // Voice memo: an inline player plus the transcript, which is the whole point
  // — a voice message you can't skim is the worst thing to get in a queue.
  if (att.isVoiceMemo) {
    return (
      <div className="space-y-1.5">
        {att.playable ? (
          <audio
            controls
            preload="metadata"
            src={`/api/attachments/${att.id}?rendition=playable`}
            className="h-9 w-full max-w-[280px]"
          />
        ) : (
          <a
            href={`/api/attachments/${att.id}`}
            target="_blank"
            rel="noreferrer"
            className={cn(
              'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs transition-colors',
              onBubble ? 'border-white/20 hover:bg-white/10' : 'hover:bg-accent',
            )}
          >
            <Mic className="h-3.5 w-3.5 shrink-0" />
            Voice message — download to play
          </a>
        )}
        {att.transcript && (
          <p
            className={cn(
              'flex gap-1.5 text-[12.5px] italic leading-relaxed',
              onBubble ? 'opacity-90' : 'text-muted-foreground',
            )}
          >
            <Mic className="mt-[3px] h-3 w-3 shrink-0" />
            <span className="not-italic">{att.transcript}</span>
          </p>
        )}
      </div>
    );
  }

  if (isImage) {
    return (
      <a
        href={`/api/attachments/${att.id}`}
        target="_blank"
        rel="noreferrer"
        className="group/img block overflow-hidden rounded-xl"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/attachments/${att.id}`}
          alt={att.fileName ?? 'attachment'}
          className="max-h-72 max-w-full rounded-xl border transition-transform duration-300 ease-smooth group-hover/img:scale-[1.02]"
        />
      </a>
    );
  }

  return (
    <a
      href={`/api/attachments/${att.id}`}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs transition-colors',
        onBubble ? 'border-white/20 hover:bg-white/10' : 'hover:bg-accent',
      )}
    >
      <Paperclip className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{att.fileName ?? 'Download attachment'}</span>
    </a>
  );
}

/** Centred pill used for system events and reaction notices. */
function TimelineNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-center py-1">
      <span className="rounded-full bg-secondary/70 px-2.5 py-1 text-[11px] text-muted-foreground">
        {children}
      </span>
    </div>
  );
}

export function MessageThread({
  conversationId,
  messages,
  canReact = false,
  onReplyTo,
}: {
  conversationId: string;
  messages: ThreadMessage[];
  /** Private API available — tapbacks can actually be delivered. */
  canReact?: boolean;
  onReplyTo?: (m: { id: string; body: string | null; guid: string | null }) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages.length]);

  useEffect(() => {
    void markRead(conversationId);
  }, [conversationId, messages.length]);

  let lastDay = '';

  return (
    <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4 md:px-5 md:py-6">
      {messages.map((m, i) => {
        const stamp = m.sentAt ?? m.createdAt;
        const day = dayLabel(stamp);
        const showDay = day !== lastDay;
        if (showDay) lastDay = day;

        const dayDivider = showDay ? (
          <div key={`day-${m.id}`} className="flex items-center gap-3 py-4">
            <div className="divider-fade h-px flex-1" />
            <span className="text-[11px] font-medium text-muted-foreground">{day}</span>
            <div className="divider-fade h-px flex-1" />
          </div>
        ) : null;

        if (m.authorType === 'system') {
          return (
            <div key={m.id}>
              {dayDivider}
              <TimelineNote>{m.body}</TimelineNote>
            </div>
          );
        }

        if (m.reactionType) {
          const base = m.reactionType.replace('-', '');
          const removed = m.reactionType.startsWith('-');
          return (
            <div key={m.id}>
              {dayDivider}
              <TimelineNote>
                {m.authorName ?? (m.direction === 'inbound' ? 'Contact' : 'You')}{' '}
                {removed ? 'removed a' : 'reacted'} {REACTION_EMOJI[base] ?? '👍'}
              </TimelineNote>
            </div>
          );
        }

        const isOutbound = m.direction === 'outbound';
        const isNote = m.isPrivateNote;

        // Consecutive messages from the same side group together: tighter spacing
        // and a squared-off corner on the joining edge, like iMessage.
        const prev = messages[i - 1];
        const next = messages[i + 1];
        const sameAsPrev =
          !showDay &&
          prev &&
          !prev.reactionType &&
          prev.authorType !== 'system' &&
          prev.direction === m.direction &&
          prev.isPrivateNote === m.isPrivateNote;
        const sameAsNext =
          next &&
          !next.reactionType &&
          next.authorType !== 'system' &&
          next.direction === m.direction &&
          next.isPrivateNote === m.isPrivateNote;

        return (
          <div key={m.id}>
            {dayDivider}
            <div
              className={cn(
                'group/msg flex animate-bubble-in flex-col',
                isOutbound ? 'items-end' : 'items-start',
                sameAsPrev ? 'mt-0.5' : 'mt-3',
              )}
            >
              {isOutbound && m.authorName && !isNote && !sameAsPrev && (
                <span className="mb-1 px-1 text-[11px] font-medium text-muted-foreground">
                  {m.authorName}
                </span>
              )}

              <div
                className={cn(
                  'flex max-w-full items-center gap-1',
                  isOutbound ? 'flex-row' : 'flex-row-reverse',
                )}
              >
                {onReplyTo && !isNote && (
                  <MessageActions
                    conversationId={conversationId}
                    messageId={m.id}
                    canReact={canReact && Boolean(m.providerMessageGuid)}
                    side={isOutbound ? 'right' : 'left'}
                    onReply={() =>
                      onReplyTo({
                        id: m.id,
                        body: m.body,
                        guid: m.providerMessageGuid ?? null,
                      })
                    }
                  />
                )}
                <div
                className={cn(
                  'max-w-[74%] space-y-2 px-3.5 py-2 text-[13.5px] leading-relaxed shadow-xs',
                  // Rounded 18px everywhere, squared on the grouped edge.
                  'rounded-[1.15rem]',
                  isOutbound
                    ? sameAsPrev && sameAsNext
                      ? 'rounded-br-md rounded-tr-md'
                      : sameAsPrev
                        ? 'rounded-tr-md'
                        : sameAsNext
                          ? 'rounded-br-md'
                          : ''
                    : sameAsPrev && sameAsNext
                      ? 'rounded-bl-md rounded-tl-md'
                      : sameAsPrev
                        ? 'rounded-tl-md'
                        : sameAsNext
                          ? 'rounded-bl-md'
                          : '',
                  isNote
                    ? 'border border-warning/35 bg-warning-muted text-foreground'
                    : isOutbound
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground',
                )}
              >
                {isNote && (
                  <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-warning">
                    <Lock className="h-2.5 w-2.5" />
                    Internal note
                  </p>
                )}
                  {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                  {m.attachments.map((a) => (
                    <AttachmentView key={a.id} att={a} onBubble={isOutbound && !isNote} />
                  ))}
                </div>
              </div>

              {/* Timestamp only on the last message of a group — cuts visual noise a lot. */}
              {!sameAsNext && (
                <div
                  className={cn(
                    'mt-1 flex items-center gap-1 px-1 text-[10.5px] text-muted-foreground',
                    isOutbound && 'flex-row-reverse',
                  )}
                >
                  <span className="tabular">{clockTime(stamp)}</span>
                  {isOutbound && <StatusTick message={m} />}
                </div>
              )}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
