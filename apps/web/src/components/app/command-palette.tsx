'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Inbox, Settings, Users, Hash, Zap, MessageSquare, ListFilter } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { searchConversations, type SearchHit } from '@/server/actions/search';
import { parseSearchQuery, searchFiltersToHref } from '@/lib/search-query';
import { cn } from '@/lib/utils';

type Item = {
  id: string;
  label: string;
  sub?: string;
  icon: React.ElementType;
  action: () => void;
};

export function CommandPalette({
  tags = [],
  isAdmin = false,
}: {
  /** Used to resolve `tag:name` operators to ids. */
  tags?: { id: string; name: string }[];
  /** Agents never see workspace-level destinations they cannot open. */
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const tagNameToId = useMemo(
    () => new Map(tags.map((t) => [t.name.toLowerCase(), t.id])),
    [tags],
  );
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const [, startSearch] = useTransition();

  // Global ⌘K / Ctrl+K, and an in-app open event (from the sidebar button).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('comms:open-command', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('comms:open-command', onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setHits([]);
      setActive(0);
    }
  }, [open]);

  /**
   * Search operators: `tag:billing`, `status:open`, `from:jordan`, `is:unread`.
   * Recognised operators become inbox filters; the leftover words are the
   * free-text query.
   */
  const parsed = useMemo(() => parseSearchQuery(query), [query]);

  useEffect(() => {
    const q = parsed.text.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => {
      startSearch(async () => setHits(await searchConversations(q)));
    }, 200);
    return () => clearTimeout(t);
  }, [parsed.text]);

  const nav = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const commands: Item[] = useMemo(
    () => [
      { id: 'inbox', label: 'Go to Inbox', icon: Inbox, action: () => nav('/inbox') },
      { id: 'mine', label: 'Assigned to me', icon: Users, action: () => nav('/inbox?assignee=me') },
      {
        id: 'unassigned',
        label: 'Unassigned',
        icon: Hash,
        action: () => nav('/inbox?assignee=unassigned'),
      },
      { id: 'settings', label: 'Settings', icon: Settings, action: () => nav('/settings') },
      ...(isAdmin
        ? [
            {
              id: 'automations',
              label: 'Automations',
              icon: Zap,
              action: () => nav('/settings/automations'),
            },
          ]
        : []),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAdmin],
  );

  const q = parsed.text.trim().toLowerCase();
  const filteredCommands =
    q.length < 2 && parsed.applied.length === 0
      ? commands
      : commands.filter((c) => c.label.toLowerCase().includes(q));

  // When operators are present, offer "show me that filtered list" as the top hit.
  const filterHref = parsed.applied.length > 0 ? searchFiltersToHref(parsed, tagNameToId) : null;
  const filterItem: Item[] = filterHref
    ? [
        {
          id: 'apply-filters',
          label: `Filter inbox — ${parsed.applied.join(', ')}`,
          icon: ListFilter,
          action: () => nav(filterHref),
        },
      ]
    : [];
  const hitItems: Item[] = hits.map((h) => ({
    id: `conv-${h.id}`,
    label: h.title,
    sub: `#${h.number}${h.preview ? ` · ${h.preview}` : ''}`,
    icon: MessageSquare,
    action: () => nav(`/inbox/${h.id}`),
  }));
  const items = [...filterItem, ...filteredCommands, ...hitItems];

  useEffect(() => {
    setActive(0);
  }, [query, hits.length]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      items[active]?.action();
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="top-[18%] max-w-lg translate-y-0 gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <div className="flex items-center gap-2.5 border-b px-3.5">
          <Search className="h-[15px] w-[15px] shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search, or try tag:billing  status:open  is:unread"
            className="h-[52px] w-full bg-transparent text-[13.5px] outline-none placeholder:text-muted-foreground/70"
          />
          <kbd className="shrink-0 rounded border bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
            ESC
          </kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-1.5">
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-[13px] text-muted-foreground">No results.</p>
          ) : (
            items.map((it, i) => {
              const Icon = it.icon;
              const selected = i === active;
              return (
                <button
                  key={it.id}
                  onClick={it.action}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    'relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors duration-100',
                    selected ? 'bg-brand-muted text-brand' : 'text-foreground hover:bg-accent/70',
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4 shrink-0',
                      selected ? 'text-brand' : 'text-muted-foreground',
                    )}
                  />
                  <span className="shrink-0 font-medium">{it.label}</span>
                  {it.sub && (
                    <span
                      className={cn(
                        'ml-auto truncate text-[11.5px]',
                        selected ? 'text-brand/70' : 'text-muted-foreground',
                      )}
                    >
                      {it.sub}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
        <div className="flex items-center gap-3 border-t bg-surface-sunken px-3.5 py-2 text-[10.5px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="rounded border bg-surface px-1">↑</kbd>
            <kbd className="rounded border bg-surface px-1">↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border bg-surface px-1">↵</kbd>
            open
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
