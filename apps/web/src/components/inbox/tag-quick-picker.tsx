'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, Tag as TagIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { toggleTag } from '@/server/actions/inbox';
import { cn } from '@/lib/utils';

/**
 * Type-to-tag dialog opened with `t` on the active conversation. Tagging from
 * the side panel is a mouse trip; this keeps triage on the keyboard, which is
 * the only way tagging actually happens consistently.
 */
export function TagQuickPicker({
  allTags,
}: {
  allTags: { id: string; name: string; color: string }[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [, start] = useTransition();

  const conversationId = pathname.startsWith('/inbox/')
    ? (pathname.split('/inbox/')[1]?.split('/')[0] ?? null)
    : null;

  useEffect(() => {
    const openPicker = () => {
      setQuery('');
      setActive(0);
      setApplied(new Set());
      setOpen(true);
    };
    window.addEventListener('comms:tag-open', openPicker);
    return () => window.removeEventListener('comms:tag-open', openPicker);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = q ? allTags.filter((t) => t.name.toLowerCase().includes(q)) : allTags;
    return rows.slice(0, 8);
  }, [allTags, query]);

  useEffect(() => setActive(0), [query]);

  function apply(tagId: string) {
    if (!conversationId) return;
    setApplied((prev) => {
      const next = new Set(prev);
      next.has(tagId) ? next.delete(tagId) : next.add(tagId);
      return next;
    });
    start(async () => {
      const res = await toggleTag(conversationId, tagId);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = filtered[active];
      if (chosen) apply(chosen.id);
    }
  }

  if (!conversationId) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="top-[22%] max-w-sm translate-y-0 gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Tag conversation</DialogTitle>
        <div className="flex items-center gap-2.5 border-b px-3.5">
          <TagIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Tag this conversation…"
            className="h-11 w-full bg-transparent text-[13.5px] outline-none placeholder:text-muted-foreground/70"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">
              No tags match. Create tags in Settings → Tags.
            </p>
          ) : (
            filtered.map((t, i) => (
              <button
                key={t.id}
                onMouseEnter={() => setActive(i)}
                onClick={() => apply(t.id)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors',
                  i === active ? 'bg-accent' : 'hover:bg-accent/60',
                )}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                <span className="flex-1 truncate">{t.name}</span>
                {applied.has(t.id) && <Check className="h-3.5 w-3.5" />}
              </button>
            ))
          )}
        </div>
        <div className="border-t bg-surface-sunken px-3.5 py-2 text-[10.5px] text-muted-foreground">
          <kbd className="rounded border bg-surface px-1">↵</kbd> toggle ·{' '}
          <kbd className="rounded border bg-surface px-1">esc</kbd> done
        </div>
      </DialogContent>
    </Dialog>
  );
}
