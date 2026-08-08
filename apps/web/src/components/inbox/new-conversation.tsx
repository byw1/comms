'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PenSquare, Search, CornerDownLeft, User } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  searchRecipients,
  startConversation,
  type RecipientSuggestion,
} from '@/server/actions/new-conversation';
import { cn, initials } from '@/lib/utils';

export interface ComposeInbox {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;
}

/**
 * Compose a message to someone new. Opened with `c` (Superhuman's compose key)
 * or the pencil button. Two steps: pick a recipient, write the message —
 * choosing which of your numbers it goes out from when there's more than one.
 */
export function NewConversation({ inboxes = [] }: { inboxes?: ComposeInbox[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RecipientSuggestion[]>([]);
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState<RecipientSuggestion | null>(null);
  const [body, setBody] = useState('');
  const [fromInboxId, setFromInboxId] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const defaultInboxId = inboxes.find((i) => i.isDefault)?.id ?? inboxes[0]?.id ?? null;
  const sendFrom = fromInboxId ?? defaultInboxId;

  useEffect(() => {
    const onOpen = () => {
      setQuery('');
      setResults([]);
      setPicked(null);
      setBody('');
      setActive(0);
      setOpen(true);
    };
    // The `c` binding lives in the user's keymap and reaches us as an event.
    window.addEventListener('comms:new-conversation', onOpen);
    return () => window.removeEventListener('comms:new-conversation', onOpen);
  }, []);

  useEffect(() => {
    if (picked) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      start(async () => {
        setResults(await searchRecipients(q));
        setActive(0);
      });
    }, 180);
    return () => clearTimeout(t);
  }, [query, picked]);

  function choose(r: RecipientSuggestion) {
    // Already talking to them — just go to the thread.
    if (r.hasConversation && r.conversationId) {
      setOpen(false);
      router.push(`/inbox/${r.conversationId}`);
      return;
    }
    setPicked(r);
  }

  function send() {
    if (!picked || !body.trim()) return;
    start(async () => {
      const res = await startConversation({
        address: picked.address,
        message: body,
        inboxId: sendFrom ?? undefined,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setOpen(false);
      toast.success(res.existing ? 'Opened your existing conversation' : 'Message sent');
      router.push(`/inbox/${res.conversationId}`);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="top-[18%] max-w-lg translate-y-0 gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">New conversation</DialogTitle>

        {!picked ? (
          <>
            <div className="flex items-center gap-2.5 border-b px-3.5">
              <Search className="h-[15px] w-[15px] shrink-0 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setActive((a) => Math.min(a + 1, results.length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setActive((a) => Math.max(a - 1, 0));
                  } else if (e.key === 'Enter' && results[active]) {
                    e.preventDefault();
                    choose(results[active]!);
                  }
                }}
                placeholder="Name, phone number, or email…"
                className="h-[52px] w-full bg-transparent text-[13.5px] outline-none placeholder:text-muted-foreground/70"
              />
            </div>
            <div className="max-h-72 overflow-y-auto p-1.5">
              {results.length === 0 ? (
                <p className="px-3 py-8 text-center text-[13px] text-muted-foreground">
                  {query.trim().length < 2
                    ? 'Search your contacts, or type a phone number.'
                    : 'No matches — type a full phone number or email to message someone new.'}
                </p>
              ) : (
                results.map((r, i) => (
                  <button
                    key={`${r.address}-${i}`}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(r)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                      i === active ? 'bg-accent' : 'hover:bg-accent/60',
                    )}
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-secondary text-[10px] font-semibold">
                        {r.contactId ? initials(r.name) : <User className="h-3 w-3" />}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{r.name}</span>
                      <span className="block truncate font-mono text-[11px] text-muted-foreground">
                        {r.address}
                      </span>
                    </span>
                    {r.hasConversation && (
                      <span className="shrink-0 text-[11px] text-muted-foreground">open thread</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="p-3.5">
            <div className="mb-2.5 flex items-center gap-2">
              <span className="text-[12px] text-muted-foreground">To</span>
              <span className="flex items-center gap-1.5 rounded-md bg-secondary px-2 py-1 text-[12.5px] font-medium">
                {picked.name}
                <button
                  onClick={() => setPicked(null)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Change recipient"
                >
                  ×
                </button>
              </span>
            </div>

            {/* Per-number send routing: which of your numbers this goes from.
                A single-number workspace never sees this row. */}
            {inboxes.length > 1 && (
              <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
                <span className="text-[12px] text-muted-foreground">From</span>
                {inboxes.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => setFromInboxId(i.id)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md border px-2 py-1 text-[12px] font-medium transition-all active:scale-95',
                      sendFrom === i.id
                        ? 'border-brand bg-brand-muted text-brand'
                        : 'text-muted-foreground hover:border-border-strong hover:bg-accent',
                    )}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: i.color }} />
                    {i.name}
                  </button>
                ))}
              </div>
            )}
            <Textarea
              autoFocus
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={4}
              placeholder={`Message ${picked.name}…`}
              className="resize-none text-[13.5px]"
            />
            <div className="mt-2.5 flex items-center justify-between">
              <span className="flex items-center gap-1 text-[10.5px] text-muted-foreground">
                <kbd className="rounded border bg-secondary px-1">
                  <CornerDownLeft className="inline h-2.5 w-2.5" />
                </kbd>
                to send
              </span>
              <Button onClick={send} loading={pending} disabled={!body.trim()} size="sm">
                Send
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Toolbar button that opens the composer. */
export function NewConversationButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event('comms:new-conversation'))}
      className="rounded-md p-1.5 text-muted-foreground transition-all duration-150 hover:bg-accent hover:text-foreground active:scale-95"
      title="New conversation (c)"
      aria-label="New conversation"
    >
      <PenSquare className="h-[15px] w-[15px]" />
    </button>
  );
}
