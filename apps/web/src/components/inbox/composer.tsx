'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Send, Zap, StickyNote, CornerDownLeft, Clock, CornerUpLeft, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AnimatePresence, motion } from '@/components/ui/motion';
import { AiAssist } from '@/components/inbox/ai-assist';
import {
  MacroPicker,
  useMacroPickerState,
  type MacroOption,
} from '@/components/inbox/macro-picker';
import { applyMacro } from '@/server/actions/macros';
import { sendTypingIndicator } from '@/server/actions/imessage';
import { SEND_LATER_PRESETS } from '@/lib/snooze';
import { cn } from '@/lib/utils';

export function Composer({
  conversationId,
  macros,
  aiEnabled,
  aiDraft,
  replyTo,
  onCancelReply,
  onSubmit,
}: {
  conversationId: string;
  macros: MacroOption[];
  aiEnabled: boolean;
  /** Pre-computed suggestion shown as ghost text; Tab accepts it. */
  aiDraft?: string | null;
  /** The message this reply is threaded to, if any. */
  replyTo?: { id: string; body: string | null; guid: string | null } | null;
  onCancelReply?: () => void;
  /**
   * Owns the actual send (optimistic append + server action + undo toast).
   * Returns false on failure so the composer can restore the draft.
   */
  onSubmit: (body: string, isNote: boolean, scheduledFor?: Date) => Promise<boolean>;
}) {
  const [body, setBody] = useState('');
  const [isNote, setIsNote] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);
  const lastTypingPing = useRef(0);
  const picker = useMacroPickerState(macros, body);

  // The global `r` shortcut focuses the composer from anywhere in the thread.
  useEffect(() => {
    const focus = () => ref.current?.focus();
    window.addEventListener('comms:focus-composer', focus);
    return () => window.removeEventListener('comms:focus-composer', focus);
  }, []);

  // Broadcast a throttled "typing" presence ping so other agents see collisions,
  // and — when the inbox enables it — show the customer a real iMessage typing
  // bubble. Stops after a pause or on send so it never sticks on.
  useEffect(() => {
    if (!body.trim() || isNote) return;
    const now = Date.now();
    if (now - lastTypingPing.current < 2000) return;
    lastTypingPing.current = now;

    fetch('/api/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, state: 'typing' }),
    }).catch(() => {});

    void sendTypingIndicator({ conversationId, isTyping: true });
  }, [body, conversationId, isNote]);

  // Clear the customer-facing bubble ~4s after they stop typing.
  useEffect(() => {
    if (isNote) return;
    const t = setTimeout(() => {
      if (lastTypingPing.current > 0) {
        lastTypingPing.current = 0;
        void sendTypingIndicator({ conversationId, isTyping: false });
      }
    }, 4000);
    return () => clearTimeout(t);
  }, [body, conversationId, isNote]);

  // Grow the textarea with its content instead of scrolling inside a fixed box.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [body]);

  function submit(scheduledFor?: Date) {
    const trimmed = body.trim();
    if (!trimmed) return;
    // Optimistic: clear the field immediately — the shell shows the bubble.
    setBody('');
    start(async () => {
      const ok = await onSubmit(trimmed, isNote, scheduledFor);
      if (!ok) setBody(trimmed); // restore the draft on failure
    });
  }

  /** Insert a macro: render its variables server-side and run its actions. */
  function pickMacro(m: MacroOption) {
    start(async () => {
      const res = await applyMacro({ macroId: m.id, conversationId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setBody((b) => {
        // Slash-invoked macros replace the "/query"; button-invoked ones append.
        const base = /^\/[\w-]*$/.test(b) ? '' : b;
        return base ? `${base}\n${res.body}` : res.body;
      });
      if (res.appliedActions.length > 0) {
        toast.success(`Macro applied — ${res.appliedActions.join(', ')}`);
      }
      ref.current?.focus();
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // While the slash picker is open it owns the arrows, Enter and Tab.
    if (picker.open) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        picker.setActiveIndex(Math.min(picker.activeIndex + 1, picker.filtered.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        picker.setActiveIndex(Math.max(picker.activeIndex - 1, 0));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const chosen = picker.filtered[picker.activeIndex];
        if (chosen) pickMacro(chosen);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setBody('');
        return;
      }
    }

    // Tab accepts the pre-computed AI draft when the field is empty.
    if (e.key === 'Tab' && !e.shiftKey && aiDraft && !body.trim()) {
      e.preventDefault();
      setBody(aiDraft);
      return;
    }

    if (e.key === 'Enter' && (!e.shiftKey || e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  }

  const canSend = Boolean(body.trim()) && !pending;

  return (
    <div className="px-3 pb-3 pt-1">
      {picker.open && (
        <MacroPicker
          macros={macros}
          query={picker.query}
          onPick={pickMacro}
          onDismiss={() => undefined}
          activeIndex={picker.activeIndex}
          setActiveIndex={picker.setActiveIndex}
        />
      )}
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
        {/* Reply-to banner: shows what this message threads onto. */}
        <AnimatePresence>
          {replyTo && !isNote && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              className="overflow-hidden"
            >
              <div className="mx-2 mt-2 flex items-start gap-2 rounded-lg border-l-2 border-primary bg-secondary/60 px-2.5 py-1.5">
                <CornerUpLeft className="mt-px h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="line-clamp-1 flex-1 text-[11.5px] text-muted-foreground">
                  {replyTo.body || 'Attachment'}
                </span>
                <button
                  type="button"
                  onClick={onCancelReply}
                  className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Cancel reply"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
                  <p className="px-2.5 py-1.5 text-[10.5px] text-muted-foreground">
                    Tip: type <kbd className="rounded border bg-secondary px-1">/</kbd> in the
                    composer to search macros without leaving the keyboard.
                  </p>
                  <div className="max-h-72 overflow-y-auto">
                    {macros.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => pickMacro(m)}
                        className="flex w-full flex-col items-start gap-0.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-accent"
                      >
                        <span className="flex w-full items-center gap-1.5">
                          <span className="text-[13px] font-medium">{m.name}</span>
                          {m.shortcut && (
                            <span className="rounded bg-secondary px-1 font-mono text-[10px] text-muted-foreground">
                              /{m.shortcut}
                            </span>
                          )}
                          {m.hasActions && (
                            <span className="ml-auto rounded bg-secondary px-1.5 text-[10px] text-muted-foreground">
                              + actions
                            </span>
                          )}
                        </span>
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
            placeholder={
              isNote
                ? 'Write an internal note — the customer never sees this…'
                : aiDraft
                  ? 'Type a message…  ⇥ to accept the suggested reply'
                  : 'Type a message…  /  for macros'
            }
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
                className="flex items-center gap-1"
              >
                {!isNote && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Send later"
                        title="Send later"
                      >
                        <Clock className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                        Send later…
                      </DropdownMenuLabel>
                      {SEND_LATER_PRESETS.map((p) => {
                        const when = p.until();
                        return (
                          <DropdownMenuItem key={p.key} onClick={() => submit(when)}>
                            <span className="flex-1">{p.label}</span>
                            <span className="tabular text-[11px] text-muted-foreground">
                              {when.toLocaleDateString(undefined, { weekday: 'short' })}{' '}
                              {when.toLocaleTimeString(undefined, {
                                hour: 'numeric',
                                minute: '2-digit',
                              })}
                            </span>
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <Button
                  onClick={() => submit()}
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
