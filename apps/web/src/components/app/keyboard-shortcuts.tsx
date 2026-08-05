'use client';

import { useEffect, useState } from 'react';
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

/**
 * The Superhuman-style triage loop, global across the inbox:
 *
 *   j / ↓   next conversation          k / ↑   previous conversation
 *   e       close + advance            s       snooze menu
 *   r       reply (focus composer)     ⌘↵      send (in composer)
 *   ?       this cheat sheet
 *
 * Shortcuts are inert while an input, textarea, contenteditable, or dialog has
 * focus — typing must never trigger triage.
 */
export function KeyboardShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const [helpOpen, setHelpOpen] = useState(false);

  const activeId = pathname.startsWith('/inbox/')
    ? (pathname.split('/inbox/')[1]?.split('/')[0] ?? null)
    : null;

  useEffect(() => {
    function isTyping(): boolean {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName;
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        (el as HTMLElement).isContentEditable ||
        // Radix portals (dialogs, menus, palettes) own the keyboard while open.
        document.querySelector('[role="dialog"][data-state="open"], [role="menu"][data-state="open"]') !== null
      );
    }

    function go(direction: 1 | -1) {
      const next = siblingConversationId(activeId, direction);
      if (next && next !== activeId) router.push(`/inbox/${next}`);
    }

    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping()) return;

      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          e.preventDefault();
          go(1);
          break;
        case 'k':
        case 'ArrowUp':
          e.preventDefault();
          go(-1);
          break;
        case 'e': {
          if (!activeId) return;
          e.preventDefault();
          // Close, then advance to the next conversation — the game loop.
          const next =
            siblingConversationId(activeId, 1) ?? siblingConversationId(activeId, -1);
          void updateConversation({ id: activeId, status: 'closed' }).then((res) => {
            if (!res.ok) toast.error(res.error);
          });
          toast.success('Closed', { duration: 1500 });
          router.push(next ? `/inbox/${next}` : '/inbox');
          break;
        }
        case 's':
          if (!activeId) return;
          e.preventDefault();
          window.dispatchEvent(new Event('comms:snooze-open'));
          break;
        case 'r':
          if (!activeId) return;
          e.preventDefault();
          window.dispatchEvent(new Event('comms:focus-composer'));
          break;
        case '?':
          e.preventDefault();
          setHelpOpen((o) => !o);
          break;
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeId, router]);

  const rows: { keys: string[]; label: string }[] = [
    { keys: ['j', '↓'], label: 'Next conversation' },
    { keys: ['k', '↑'], label: 'Previous conversation' },
    { keys: ['e'], label: 'Close and advance' },
    { keys: ['s'], label: 'Snooze…' },
    { keys: ['r'], label: 'Reply (focus composer)' },
    { keys: ['↵'], label: 'Send message' },
    { keys: ['⇧', '↵'], label: 'New line' },
    { keys: ['⌘', 'K'], label: 'Search / command palette' },
    { keys: ['?'], label: 'This cheat sheet' },
  ];

  return (
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-muted text-brand">
              <Keyboard className="h-3.5 w-3.5" />
            </span>
            Keyboard shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-1 pt-1">
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex items-center justify-between rounded-lg px-2 py-1.5 text-[13px] hover:bg-accent/60"
            >
              <span>{r.label}</span>
              <span className="flex items-center gap-1">
                {r.keys.map((k) => (
                  <kbd
                    key={k}
                    className="grid h-6 min-w-6 place-items-center rounded-md border bg-secondary px-1.5 font-sans text-[11px] text-muted-foreground"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
