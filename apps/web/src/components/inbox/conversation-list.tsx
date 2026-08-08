'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, Check, Loader2, Inbox as InboxIcon, X, Pencil, Eye } from 'lucide-react';
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
import { matchesFolder } from '@/lib/conversation-folder';
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
  draftConversationIds = [],
}: {
  conversations: ConversationListItem[];
  currentUserId: string;
  currentUserName: string;
  /** Conversations where the signed-in user has unsent text. */
  draftConversationIds?: string[];
  /** When multiple numbers are connected, show which inbox each conversation belongs to. */
  showChannels?: boolean;
  allTags?: { id: string; name: string; color: string }[];
  agents?: { id: string; name: string | null; email: string }[];
  inboxes?: { id: string; name: string }[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftIds = useMemo(() => new Set(draftConversationIds), [draftConversationIds]);
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
  const seenFilter = searchParams.get('seen') === '1';
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
      // Shared with the server filter so the list and the sidebar counts can
      // never disagree about what is in the inbox.
      if (!matchesFolder(c.status, statusFilter, draftIds.has(c.id))) return false;
      if (priorityFilter.length && !priorityFilter.includes(c.priority)) return false;
      if (slaFilter && !c.slaBreachedAt) return false;
      if (unreadFilter && c.unreadCount === 0) return false;
      if (seenFilter && !c.readNoReply) return false;
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
    // In the snoozed folder the question is "what comes back next", so wake
    // order beats recency — same as every mail client's snoozed list.
    if (statusFilter === 'snoozed') {
      rows.sort(
        (a, b) =>
          new Date(a.snoozedUntil ?? 0).getTime() - new Date(b.snoozedUntil ?? 0).getTime(),
      );
    } else if (sort === 'oldest') rows.sort((a, b) => time(a) - time(b));
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
    draftIds,
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
    seenFilter,
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

  /** Selection mode: once anything is picked, every row offers its checkbox. */
  const selecting = selected.size > 0;

  // Drafts earns a tab only when you have one. An always-present empty folder
  // is chrome; one that appears because you left something unsent is a prompt.
  const tabs = [
    { label: 'Inbox', href: '/inbox', key: 'active' },
    { label: 'Mine', href: '/inbox?assignee=me', key: 'mine' },
    ...(draftIds.size > 0
      ? [{ label: 'Drafts', href: '/inbox?status=drafts', key: 'drafts' }]
      : []),
    { label: 'Snoozed', href: '/inbox?status=snoozed', key: 'snoozed' },
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
        'w-full shrink-0 flex-col border-r bg-surface md:flex md:w-[380px]',
        activeId ? 'hidden' : 'flex',
      )}
    >
      <div className="pane-x space-y-2.5 pb-3 pt-3">
        <div className="group relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-muted-foreground/70 transition-colors group-focus-within:text-brand" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations"
            className="type-item h-10 rounded-xl pl-9 pr-8"
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
        <div className="flex items-center gap-0.5 rounded-xl bg-secondary/60 p-[3px]">
          {tabs.map((t) => {
            const isActive =
              (t.key === 'active' && !assignee && statusFilter === 'active') ||
              (t.key === 'mine' && assignee === 'me') ||
              (t.key === 'drafts' && statusFilter === 'drafts') ||
              (t.key === 'snoozed' && statusFilter === 'snoozed') ||
              (t.key === 'closed' && statusFilter === 'closed');
            return (
              <Link
                key={t.key}
                href={t.href}
                className={cn(
                  'type-caption relative flex-1 rounded-lg px-2 py-1.5 text-center font-medium transition-colors duration-150',
                  isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="list-tab"
                    className="absolute inset-0 rounded-lg bg-surface shadow-xs"
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

      <div className="pane-x min-h-0 flex-1 overflow-y-auto pb-2">
        {inboxZero ? (
          <div className="flex animate-slide-up flex-col items-center justify-center gap-3.5 px-6 py-20 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <Check className="h-6 w-6" strokeWidth={2.5} />
            </div>
            <div>
              <p className="type-title">Inbox Zero</p>
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
              {/* An empty Snoozed folder means something different from an
                  empty inbox, and saying "new conversations appear here" would
                  be a lie in both Snoozed and Closed. */}
              <p className="text-sm font-medium">
                {query
                  ? 'No matches'
                  : statusFilter === 'snoozed'
                    ? 'Nothing snoozed'
                    : statusFilter === 'closed'
                      ? 'Nothing closed yet'
                      : statusFilter === 'drafts'
                        ? 'No unsent drafts'
                        : 'Nothing here yet'}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {query
                  ? 'Try a different search term.'
                  : statusFilter === 'snoozed'
                    ? 'Snoozed conversations wait here and return to your inbox at the time you picked.'
                    : statusFilter === 'closed'
                      ? 'Conversations you close land here. They reopen automatically if someone writes back.'
                      : statusFilter === 'drafts'
                        ? 'Replies you start but do not send are kept here until you finish them.'
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
                // The GUID carries the number even when no contact was linked.
                chatGuid: c.providerChatGuid,
                title: c.title,
                isGroup: c.isGroup,
              };
              const name = conversationName(nameInput);
              const unread = c.unreadCount > 0;
              const hasMeta =
                unread ||
                c.readNoReply ||
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
                    'group relative flex gap-3 rounded-xl px-3 py-3 transition-colors duration-150',
                    active ? 'bg-brand-muted' : isSelected ? 'bg-accent' : 'hover:bg-accent/60',
                  )}
                >
                  {/* Priority spine — urgent and high only. A marker that
                      appears on every row marks nothing. */}
                  {(c.priority === 'urgent' || c.priority === 'high') && (
                    <span
                      className={cn(
                        'absolute inset-y-3 left-0 w-[3px] rounded-full',
                        PRIORITY_SPINE[c.priority],
                      )}
                    />
                  )}

                  <div className="relative h-10 w-10 shrink-0">
                    <Avatar
                      className={cn(
                        'h-10 w-10 ring-1 ring-border transition-opacity duration-150',
                        // Only fade the face away once selecting is actually
                        // happening. Blanking every avatar on casual hover made
                        // scanning the list flicker.
                        selecting && 'group-hover:opacity-0',
                        isSelected && 'opacity-0',
                      )}
                    >
                      {c.contact?.avatarUrl && <AvatarImage src={c.contact.avatarUrl} alt={name} />}
                      <AvatarFallback className="type-caption bg-secondary font-semibold text-muted-foreground">
                        {initials(nameForInitials(nameInput))}
                      </AvatarFallback>
                    </Avatar>

                    {/* Checkbox occupies the avatar's slot on hover — no layout shift. */}
                    <button
                      onClick={(e) => toggleSelect(c.id, e)}
                      className={cn(
                        'absolute inset-0 grid place-items-center rounded-full border transition-all duration-150',
                        isSelected
                          ? 'border-brand bg-brand text-brand-foreground opacity-100'
                          : cn(
                              'border-border-strong bg-surface text-transparent opacity-0 hover:border-brand hover:text-muted-foreground',
                              // Reachable on hover of the avatar itself, and
                              // shown across the list once selection begins.
                              selecting ? 'group-hover:opacity-100' : 'hover:opacity-100',
                            ),
                      )}
                      aria-label={isSelected ? 'Deselect' : 'Select'}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2.5">
                      <p
                        className={cn(
                          'type-title truncate',
                          !unread && 'font-medium text-foreground/90',
                        )}
                      >
                        {name}
                      </p>
                      <span className="tabular type-caption shrink-0 text-muted-foreground/80">
                        {listTime(c.lastMessageAt)}
                      </span>
                    </div>

                    {/* Two lines, not one. A single truncated line tells you
                        almost nothing about a text message, and the second line
                        is what lets you triage without opening the thread. */}
                    {draftIds.has(c.id) ? (
                      // An unsent reply outranks what they last said: it is the
                      // thing you have to deal with, and the only way to notice
                      // you left one is for the row to say so.
                      <p className="type-body mt-1 flex items-center gap-1.5 text-muted-foreground">
                        <Pencil className="h-3 w-3 shrink-0 text-warning" />
                        <span className="truncate italic">Draft</span>
                      </p>
                    ) : (
                      <p
                        className={cn(
                          'type-body mt-1 line-clamp-2',
                          unread ? 'text-foreground/75' : 'text-muted-foreground',
                        )}
                      >
                        {c.lastMessagePreview || 'No messages yet'}
                      </p>
                    )}

                    {hasMeta && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {unread && (
                          <Badge variant="brand" size="sm" className="tabular">
                            {c.unreadCount}
                          </Badge>
                        )}
                        {/* Apple tells us they opened it. Saying so is the
                            whole reason this data is worth having. */}
                        {c.readNoReply && !unread && (
                          <Badge variant="outline" size="sm" className="gap-1">
                            <Eye className="h-3 w-3" />
                            Seen
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
                        {/* In the snoozed folder the useful fact is when it
                            comes back, not that it is snoozed — you can see
                            that from the folder you are standing in. */}
                        {c.status === 'snoozed' && c.snoozedUntil ? (
                          <Badge variant="outline" size="sm">
                            wakes {relativeTime(c.snoozedUntil)}
                          </Badge>
                        ) : (
                          c.status !== 'open' &&
                          c.status !== 'closed' && (
                            <Badge variant="outline" size="sm" className="capitalize">
                              {c.status}
                            </Badge>
                          )
                        )}
                        {showChannels && c.inbox && (
                          <span
                            className="type-caption inline-flex items-center gap-1 rounded-md px-1.5 py-px font-medium"
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
                        {c.tags?.slice(0, 2).map((t) => (
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
                            className="type-caption inline-flex items-center rounded-md px-1.5 py-px font-medium transition-opacity hover:opacity-75"
                            style={{ backgroundColor: `${t.tag.color}18`, color: t.tag.color }}
                          >
                            {t.tag.name}
                          </button>
                        ))}
                        {(c.tags?.length ?? 0) > 2 && (
                          <span className="type-caption text-muted-foreground/70">
                            +{c.tags!.length - 2}
                          </span>
                        )}
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
