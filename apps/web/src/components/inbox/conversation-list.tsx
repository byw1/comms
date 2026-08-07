'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, Check, Loader2, Inbox as InboxIcon, X } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { AnimatePresence, motion } from '@/components/ui/motion';
import { bulkUpdateConversations } from '@/server/actions/inbox';
import { FilterBar } from '@/components/inbox/filter-bar';
import { setVisibleConversationIds } from '@/lib/inbox-nav';
import { conversationName, nameForInitials } from '@/lib/naming';
import { cn, initials } from '@/lib/utils';
import { listTime, relativeTime } from '@/lib/format';
import type { ConversationListItem } from '@/server/queries';

/** Priority reads as a coloured spine on the row edge, not another dot in the row. */
const PRIORITY_SPINE: Record<string, string> = {
  urgent: 'bg-destructive',
  high: 'bg-warning',
  normal: 'bg-transparent',
  low: 'bg-transparent',
};

export function ConversationListPane({
  conversations,
  currentUserId,
  showChannels = false,
  allTags = [],
  agents = [],
  inboxes = [],
}: {
  conversations: ConversationListItem[];
  currentUserId: string;
  currentUserName: string;
  /** When multiple numbers are connected, show which inbox each conversation belongs to. */
  showChannels?: boolean;
  allTags?: { id: string; name: string; color: string }[];
  agents?: { id: string; name: string | null; email: string }[];
  inboxes?: { id: string; name: string }[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPending, startBulk] = useTransition();

  function toggleSelect(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function bulk(patch: { status?: 'open' | 'pending' | 'closed' }) {
    const ids = Array.from(selected);
    startBulk(async () => {
      const res = await bulkUpdateConversations(ids, patch);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(`Updated ${ids.length} conversation${ids.length === 1 ? '' : 's'}`);
        setSelected(new Set());
        router.refresh();
      }
    });
  }

  const assignee = searchParams.get('assignee');
  const statusFilter = searchParams.get('status') ?? 'active';
  const inboxFilter = searchParams.get('inbox');
  const tagFilter = searchParams.get('tags')?.split(',').filter(Boolean) ?? [];
  const priorityFilter = searchParams.get('priority')?.split(',').filter(Boolean) ?? [];
  const slaFilter = searchParams.get('sla') === 'breached';
  const unreadFilter = searchParams.get('unread') === '1';
  const sort = searchParams.get('sort') ?? 'newest';
  const activeId = pathname.startsWith('/inbox/') ? pathname.split('/inbox/')[1] : null;

  // Filtering and sorting run client-side against the loaded working set so
  // every filter change is instant (no server round-trip). Saved-view badge
  // counts come from SQL, which is what keeps them accurate beyond this window.
  const filtered = useMemo(() => {
    const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
    const rows = conversations.filter((c) => {
      if (inboxFilter && c.inboxId !== inboxFilter) return false;
      if (assignee === 'me' && c.assigneeId !== currentUserId) return false;
      if (assignee === 'unassigned' && c.assigneeId) return false;
      if (assignee && assignee !== 'me' && assignee !== 'unassigned' && c.assigneeId !== assignee)
        return false;
      if (statusFilter === 'active' && c.status === 'closed') return false;
      else if (statusFilter !== 'active' && statusFilter !== 'all' && c.status !== statusFilter)
        return false;
      if (priorityFilter.length && !priorityFilter.includes(c.priority)) return false;
      if (slaFilter && !c.slaBreachedAt) return false;
      if (unreadFilter && c.unreadCount === 0) return false;
      // AND semantics: every selected tag must be present.
      if (tagFilter.length) {
        const ids = new Set(c.tags?.map((t) => t.tag.id) ?? []);
        if (!tagFilter.every((id) => ids.has(id))) return false;
      }
      if (query) {
        // Search the address too, so typing a phone number finds the thread.
        const hay = `${c.contact?.displayName ?? ''} ${c.title ?? ''} ${
          c.contact?.identities?.map((i) => `${i.value} ${i.rawValue ?? ''}`).join(' ') ?? ''
        } ${c.lastMessagePreview ?? ''}`.toLowerCase();
        if (!hay.includes(query.toLowerCase())) return false;
      }
      return true;
    });

    const time = (c: (typeof rows)[number]) =>
      new Date(c.lastMessageAt ?? c.createdAt).getTime();
    if (sort === 'oldest') rows.sort((a, b) => time(a) - time(b));
    else if (sort === 'priority')
      rows.sort(
        (a, b) =>
          (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9) ||
          time(b) - time(a),
      );
    else rows.sort((a, b) => time(b) - time(a));

    return rows;
  }, [
    conversations,
    assignee,
    statusFilter,
    inboxFilter,
    query,
    currentUserId,
    // Arrays are rebuilt each render; compare by value to avoid a render loop.
    tagFilter.join(','),
    priorityFilter.join(','),
    slaFilter,
    unreadFilter,
    sort,
  ]);

  /** Toggle a tag in the URL filter — used by the clickable tag chips. */
  function toggleTagFilter(tagId: string) {
    const current = (searchParams.get('tags') ?? '').split(',').filter(Boolean);
    const next = current.includes(tagId)
      ? current.filter((t) => t !== tagId)
      : [...current, tagId];
    const params = new URLSearchParams(searchParams.toString());
    if (next.length) params.set('tags', next.join(','));
    else params.delete('tags');
    const qs = params.toString();
    router.push(qs ? `/inbox?${qs}` : '/inbox');
  }

  // Publish the visible ordering for the global j/k keyboard navigation.
  useEffect(() => {
    setVisibleConversationIds(filtered.map((c) => c.id));
  }, [filtered]);

  const tabs = [
    { label: 'Active', href: '/inbox', key: 'active' },
    { label: 'Mine', href: '/inbox?assignee=me', key: 'mine' },
    { label: 'Closed', href: '/inbox?status=closed', key: 'closed' },
  ];

  // A truly empty Active queue (no filters, no search) is an achievement.
  const inboxZero =
    filtered.length === 0 && !query && !assignee && statusFilter === 'active' && !inboxFilter;

  return (
    // Mobile is master/detail: the list owns the screen at /inbox and hides
    // once a conversation is open; md+ shows both panes side by side.
    <div
      className={cn(
        'w-full shrink-0 flex-col border-r bg-surface md:flex md:w-[344px]',
        activeId ? 'hidden' : 'flex',
      )}
    >
      <div className="space-y-2.5 px-3 pb-2.5 pt-3">
        <div className="group relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-muted-foreground/70 transition-colors group-focus-within:text-brand" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations"
            className="h-9 pl-9 pr-8"
          />
          <AnimatePresence>
            {query && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Sliding segmented control — quick presets over the filter bar. */}
        <div className="flex items-center gap-0.5 rounded-lg bg-secondary/60 p-0.5">
          {tabs.map((t) => {
            const isActive =
              (t.key === 'active' && !assignee && statusFilter === 'active') ||
              (t.key === 'mine' && assignee === 'me') ||
              (t.key === 'closed' && statusFilter === 'closed');
            return (
              <Link
                key={t.key}
                href={t.href}
                className={cn(
                  'relative flex-1 rounded-[0.4rem] px-2.5 py-1 text-center text-[12px] font-medium transition-colors duration-150',
                  isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="list-tab"
                    className="absolute inset-0 rounded-[0.4rem] bg-surface shadow-xs"
                    transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                  />
                )}
                <span className="relative">{t.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <FilterBar allTags={allTags} agents={agents} inboxes={inboxes} />

      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 34 }}
            className="overflow-hidden border-y bg-brand-muted/60"
          >
            <div className="flex items-center gap-2 px-3 py-2 text-xs">
              <span className="font-medium text-brand">{selected.size} selected</span>
              <div className="ml-auto flex items-center gap-0.5">
                {bulkPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />}
                <Button
                  size="xs"
                  variant="ghost"
                  disabled={bulkPending}
                  onClick={() => bulk({ status: 'closed' })}
                >
                  Close
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  disabled={bulkPending}
                  onClick={() => bulk({ status: 'open' })}
                >
                  Reopen
                </Button>
                <Button size="xs" variant="ghost" onClick={() => setSelected(new Set())}>
                  Clear
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {inboxZero ? (
          <div className="flex animate-slide-up flex-col items-center justify-center gap-3.5 px-6 py-20 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <Check className="h-6 w-6" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-[15px] font-semibold tracking-[-0.01em]">Inbox Zero</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Every conversation handled. Nicely done — new messages will appear here the moment
                they arrive.
              </p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-secondary text-muted-foreground">
              <InboxIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium">{query ? 'No matches' : 'Nothing here yet'}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {query
                  ? 'Try a different search term.'
                  : 'New conversations will appear here automatically.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-px">
            {filtered.map((c) => {
              const active = c.id === activeId;
              const isSelected = selected.has(c.id);
              const nameInput = {
                contactName: c.contact?.displayName,
                contactAddress: c.contact?.identities?.[0]?.value,
                title: c.title,
                isGroup: c.isGroup,
              };
              const name = conversationName(nameInput);
              const unread = c.unreadCount > 0;
              const hasMeta =
                unread ||
                Boolean(c.slaBreachedAt) ||
                Boolean(c.nextResponseDueAt && c.status !== 'closed') ||
                (c.status !== 'open' && c.status !== 'closed') ||
                (showChannels && Boolean(c.inbox)) ||
                (c.tags?.length ?? 0) > 0;

              return (
                <Link
                  key={c.id}
                  href={`/inbox/${c.id}`}
                  className={cn(
                    'group relative flex gap-2.5 rounded-lg py-2.5 pl-3 pr-2.5 transition-colors duration-150',
                    active ? 'bg-brand-muted' : isSelected ? 'bg-accent' : 'hover:bg-accent/70',
                  )}
                >
                  {/* Priority spine */}
                  <span
                    className={cn(
                      'absolute inset-y-2 left-0 w-[3px] rounded-full',
                      PRIORITY_SPINE[c.priority] ?? 'bg-transparent',
                    )}
                  />

                  <div className="relative h-9 w-9 shrink-0">
                    <Avatar
                      className={cn(
                        'h-9 w-9 ring-1 ring-border transition-opacity duration-150',
                        'group-hover:opacity-0',
                        isSelected && 'opacity-0',
                      )}
                    >
                      {c.contact?.avatarUrl && <AvatarImage src={c.contact.avatarUrl} alt={name} />}
                      <AvatarFallback
                        className={cn(
                          'text-[11px] font-semibold',
                          unread
                            ? 'bg-brand-muted text-brand'
                            : 'bg-secondary text-muted-foreground',
                        )}
                      >
                        {initials(nameForInitials(nameInput))}
                      </AvatarFallback>
                    </Avatar>

                    {/* Checkbox occupies the avatar's slot on hover — no layout shift. */}
                    <button
                      onClick={(e) => toggleSelect(c.id, e)}
                      className={cn(
                        'absolute inset-0 grid place-items-center rounded-lg border transition-all duration-150',
                        isSelected
                          ? 'border-brand bg-brand text-brand-foreground opacity-100'
                          : 'border-border-strong bg-surface text-transparent opacity-0 hover:border-brand hover:text-muted-foreground group-hover:opacity-100',
                      )}
                      aria-label={isSelected ? 'Deselect' : 'Select'}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p
                        className={cn(
                          'truncate text-[13px] leading-tight',
                          unread ? 'font-semibold' : 'font-medium',
                        )}
                      >
                        {name}
                      </p>
                      <span className="tabular shrink-0 text-[11px] text-muted-foreground">
                        {listTime(c.lastMessageAt)}
                      </span>
                    </div>

                    <p
                      className={cn(
                        'mt-0.5 truncate text-[12px] leading-snug',
                        unread ? 'text-foreground/80' : 'text-muted-foreground',
                      )}
                    >
                      {c.lastMessagePreview || 'No messages yet'}
                    </p>

                    {hasMeta && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        {unread && (
                          <Badge variant="brand" size="sm" className="tabular">
                            {c.unreadCount}
                          </Badge>
                        )}
                        {c.slaBreachedAt ? (
                          <Badge variant="soft-danger" size="sm">
                            Overdue
                          </Badge>
                        ) : c.nextResponseDueAt && c.status !== 'closed' ? (
                          <Badge variant="soft-warning" size="sm">
                            due {relativeTime(c.nextResponseDueAt)}
                          </Badge>
                        ) : null}
                        {c.status !== 'open' && c.status !== 'closed' && (
                          <Badge variant="outline" size="sm" className="capitalize">
                            {c.status}
                          </Badge>
                        )}
                        {showChannels && c.inbox && (
                          <span
                            className="inline-flex items-center gap-1 rounded-md px-1.5 py-px text-[11px] font-medium"
                            style={{ backgroundColor: `${c.inbox.color}18`, color: c.inbox.color }}
                            title={`Number: ${c.inbox.name}`}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: c.inbox.color }}
                            />
                            {c.inbox.name}
                          </span>
                        )}
                        {c.tags?.map((t) => (
                          // Clicking a tag filters the list by it — the whole
                          // point of tagging, and previously a dead end.
                          <button
                            key={t.tag.id}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleTagFilter(t.tag.id);
                            }}
                            title={`Filter by ${t.tag.name}`}
                            className="inline-flex items-center rounded-md px-1.5 py-px text-[11px] font-medium transition-opacity hover:opacity-75"
                            style={{ backgroundColor: `${t.tag.color}18`, color: t.tag.color }}
                          >
                            {t.tag.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
