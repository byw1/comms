'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Send, Zap, StickyNote, CornerDownLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AnimatePresence, motion } from '@/components/ui/motion';
import { AiAssist } from '@/components/inbox/ai-assist';
import { cn } from '@/lib/utils';

export function Composer({
  conversationId,
  macros,
  aiEnabled,
  onSubmit,
}: {
  conversationId: string;
  macros: { id: string; name: string; body: string }[];
  aiEnabled: boolean;
  /**
   * Owns the actual send (optimistic append + server action + undo toast).
   * Returns false on failure so the composer can restore the draft.
   */
  onSubmit: (body: string, isNote: boolean) => Promise<boolean>;
}) {
  const [body, setBody] = useState('');
  const [isNote, setIsNote] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);
  const lastTypingPing = useRef(0);

  // The global `r` shortcut focuses the composer from anywhere in the thread.
  useEffect(() => {
    const focus = () => ref.current?.focus();
    window.addEventListener('comms:focus-composer', focus);
    return () => window.removeEventListener('comms:focus-composer', focus);
  }, []);

  // Broadcast a throttled "typing" presence ping so other agents see collisions.
  useEffect(() => {
    if (!body.trim()) return;
    const now = Date.now();
    if (now - lastTypingPing.current < 2000) return;
    lastTypingPing.current = now;
    fetch('/api/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, state: 'typing' }),
    }).catch(() => {});
  }, [body, conversationId]);

  // Grow the textarea with its content instead of scrolling inside a fixed box.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [body]);

  function submit() {
    const trimmed = body.trim();
    if (!trimmed) return;
    // Optimistic: clear the field immediately — the shell shows the bubble.
    setBody('');
    start(async () => {
      const ok = await onSubmit(trimmed, isNote);
      if (!ok) setBody(trimmed); // restore the draft on failure
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (!e.shiftKey || e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  }

  function insertMacro(text: string) {
    setBody((b) => (b ? `${b}\n${text}` : text));
    ref.current?.focus();
  }

  const canSend = Boolean(body.trim()) && !pending;

  return (
    <div className="px-3 pb-3 pt-1">
      {/* One bordered surface containing toolbar + field + send, so the composer
          reads as a single object rather than three stacked strips. */}
      <div
        className={cn(
          'rounded-xl border bg-surface shadow-sm transition-all duration-200 ease-smooth',
          focused && !isNote && 'border-brand/50 ring-[3px] ring-brand/12',
          isNote && 'border-warning/45 bg-warning-muted/40',
          focused && isNote && 'ring-[3px] ring-warning/15',
        )}
      >
        <div className="flex items-center justify-between gap-2 px-2 pt-2">
          {/* Segmented reply/note switch — clearer than a bare toggle. */}
          <div className="flex items-center gap-0.5 rounded-lg bg-secondary/70 p-0.5">
            <button
              type="button"
              onClick={() => setIsNote(false)}
              className={cn(
                'relative rounded-[0.4rem] px-2.5 py-1 text-[11.5px] font-medium transition-colors duration-150',
                !isNote ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {!isNote && (
                <motion.span
                  layoutId="composer-mode"
                  className="absolute inset-0 rounded-[0.4rem] bg-surface shadow-xs"
                  transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                />
              )}
              <span className="relative">Reply</span>
            </button>
            <button
              type="button"
              onClick={() => setIsNote(true)}
              className={cn(
                'relative flex items-center gap-1 rounded-[0.4rem] px-2.5 py-1 text-[11.5px] font-medium transition-colors duration-150',
                isNote ? 'text-warning' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {isNote && (
                <motion.span
                  layoutId="composer-mode"
                  className="absolute inset-0 rounded-[0.4rem] bg-surface shadow-xs"
                  transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                />
              )}
              <span className="relative flex items-center gap-1">
                <StickyNote className="h-3 w-3" />
                Note
              </span>
            </button>
          </div>

          <div className="flex items-center gap-0.5">
            {aiEnabled && <AiAssist conversationId={conversationId} onDraft={setBody} />}
            {macros.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="xs" className="gap-1.5">
                    <Zap className="h-3.5 w-3.5" />
                    Macros
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-1">
                  <div className="max-h-72 overflow-y-auto">
                    {macros.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => insertMacro(m.body)}
                        className="flex w-full flex-col items-start gap-0.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-accent"
                      >
                        <span className="text-[13px] font-medium">{m.name}</span>
                        <span className="line-clamp-2 text-[11.5px] leading-snug text-muted-foreground">
                          {m.body}
                        </span>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>

        <div className="flex items-end gap-2 p-2">
          <Textarea
            ref={ref}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={isNote ? 'Write an internal note — the customer never sees this…' : 'Type a message…'}
            className="max-h-[180px] min-h-[38px] resize-none border-0 bg-transparent px-1.5 py-1.5 text-[13.5px] shadow-none focus-visible:ring-0"
            rows={1}
          />
          <AnimatePresence mode="popLayout">
            {canSend || pending ? (
              <motion.div
                key="send"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              >
                <Button
                  onClick={submit}
                  loading={pending}
                  size="icon-sm"
                  variant={isNote ? 'default' : 'brand'}
                  aria-label="Send"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      <p className="hidden items-center gap-1 px-1.5 pt-1.5 text-[10.5px] text-muted-foreground md:flex">
        <kbd className="rounded border bg-secondary px-1 font-sans text-[10px]">
          <CornerDownLeft className="inline h-2.5 w-2.5" />
        </kbd>
        to send
        <span className="opacity-40">·</span>
        <kbd className="rounded border bg-secondary px-1 font-sans text-[10px]">Shift</kbd>+
        <kbd className="rounded border bg-secondary px-1 font-sans text-[10px]">↵</kbd>
        for a new line
      </p>
    </div>
  );
}
