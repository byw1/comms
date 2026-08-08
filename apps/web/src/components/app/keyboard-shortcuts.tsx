'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Keyboard } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { updateConversation } from '@/server/actions/inbox';
import { siblingConversationId } from '@/lib/inbox-nav';
import { useKeymap } from '@/components/app/keymap-provider';
import { useGlobalShortcuts } from '@/lib/use-global-shortcuts';
import {
  KEY_ACTIONS,
  formatBinding,
  isMacPlatform,
  type KeyActionGroup,
} from '@/lib/keymap';

/**
 * The one global shortcut listener.
 *
 * Every binding comes from the user's keymap, so the cheat sheet below and the
 * settings editor can never drift from what the keys actually do. Components
 * that own their own UI (the palette, the compose dialog, the snooze menu) are
 * opened by event rather than by listening for keys themselves — a second
 * listener would double-fire and break sequences.
 */
export function KeyboardShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const [helpOpen, setHelpOpen] = useState(false);
  const { keymap } = useKeymap();

  const activeId = pathname.startsWith('/inbox/')
    ? (pathname.split('/inbox/')[1]?.split('/')[0] ?? null)
    : null;

  const go = (direction: 1 | -1) => {
    const next = siblingConversationId(activeId, direction);
    if (next && next !== activeId) router.push(`/inbox/${next}`);
  };

  /** Only fire conversation actions when one is actually open. */
  const onOpen = (fn: () => void) => () => {
    if (activeId) fn();
  };

  useGlobalShortcuts({
    'nav.next': () => go(1),
    'nav.prev': () => go(-1),
    'nav.back': () => {
      if (activeId) router.push('/inbox');
    },

    'conversation.close': onOpen(() => {
      // Close, then advance to the next conversation — the game loop.
      const next = siblingConversationId(activeId, 1) ?? siblingConversationId(activeId, -1);
      void updateConversation({ id: activeId!, status: 'closed' }).then((res) => {
        if (!res.ok) toast.error(res.error);
      });
      toast.success('Closed', { duration: 1500 });
      router.push(next ? `/inbox/${next}` : '/inbox');
    }),
    'conversation.snooze': onOpen(() => window.dispatchEvent(new Event('comms:snooze-open'))),
    'conversation.tag': onOpen(() => window.dispatchEvent(new Event('comms:tag-open'))),
    'conversation.reply': onOpen(() => window.dispatchEvent(new Event('comms:focus-composer'))),

    'go.inbox': () => router.push('/inbox'),
    'go.mine': () => router.push('/inbox?assignee=me'),
    'go.unassigned': () => router.push('/inbox?assignee=unassigned'),
    'go.closed': () => router.push('/inbox?status=closed'),

    'compose.new': () => window.dispatchEvent(new Event('comms:new-conversation')),
    'app.search': () => window.dispatchEvent(new Event('comms:open-palette')),
    // Registered only with a thread open. A no-op handler would still swallow
    // the keypress, taking the browser's own find away on every other screen.
    ...(activeId
      ? { 'app.find': () => window.dispatchEvent(new Event('comms:thread-find')) }
      : {}),
    'app.help': () => setHelpOpen((o) => !o),
  });

  const isMac = isMacPlatform();
  const groups = KEY_ACTIONS.reduce<Record<string, typeof KEY_ACTIONS>>((acc, action) => {
    acc[action.group] = [...(acc[action.group] ?? []), action];
    return acc;
  }, {});

  return (
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
      <DialogContent className="max-h-[80dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-muted text-brand">
              <Keyboard className="h-3.5 w-3.5" />
            </span>
            Keyboard shortcuts
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {(Object.keys(groups) as KeyActionGroup[]).map((group) => (
            <div key={group}>
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {group}
              </p>
              {groups[group]!.map((action) => {
                const bindings = keymap[action.id] ?? [];
                return (
                  <div
                    key={action.id}
                    className="flex items-center justify-between gap-4 rounded-lg px-2 py-1.5 text-[13px] hover:bg-accent/60"
                  >
                    <span className="min-w-0 truncate">{action.label}</span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {bindings.length === 0 ? (
                        <span className="text-[11px] text-muted-foreground/60">Not set</span>
                      ) : (
                        <BindingKeys binding={bindings[0]!} isMac={isMac} />
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}

          {/* Context-specific keys the global map doesn't own. */}
          <div>
            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              In the composer
            </p>
            {[
              { label: 'Macros', keys: [['/']] },
              { label: 'Accept AI draft', keys: [['⇥']] },
              { label: 'Send', keys: [['↵']] },
              { label: 'New line', keys: [['⇧', '↵']] },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between rounded-lg px-2 py-1.5 text-[13px] hover:bg-accent/60"
              >
                <span>{row.label}</span>
                <span className="flex items-center gap-1">
                  {row.keys[0]!.map((k) => (
                    <Kbd key={k}>{k}</Kbd>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </div>

        <Link
          href="/settings/keyboard"
          onClick={() => setHelpOpen(false)}
          className="mt-1 block rounded-lg border px-3 py-2 text-center text-[12px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          Customize shortcuts →
        </Link>
      </DialogContent>
    </Dialog>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="grid h-6 min-w-6 place-items-center rounded-md border bg-secondary px-1.5 font-sans text-[11px] text-muted-foreground">
      {children}
    </kbd>
  );
}

/** One binding, with `then` between the chords of a sequence. */
export function BindingKeys({ binding, isMac }: { binding: string; isMac?: boolean }) {
  const chords = formatBinding(binding, isMac);
  return (
    <>
      {chords.map((chord, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="px-0.5 text-[10px] text-muted-foreground/60">then</span>}
          {chord.map((part, j) => (
            <Kbd key={j}>{part}</Kbd>
          ))}
        </span>
      ))}
    </>
  );
}
