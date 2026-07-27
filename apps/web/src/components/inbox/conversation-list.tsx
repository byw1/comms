'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, CheckSquare, Square, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { bulkUpdateConversations } from '@/server/actions/inbox';
import { cn, initials } from '@/lib/utils';
import { listTime, relativeTime } from '@/lib/format';
import type { ConversationListItem } from '@/server/queries';

const PRIORITY_COLOR: Record<string, string> = {
  urgent: 'bg-destructive',
  high: 'bg-warning',
  normal: 'bg-transparent',
  low: 'bg-transparent',
};

export function ConversationListPane({
  conversations,
  currentUserId,
  showChannels = false,
}: {
  conversations: ConversationListItem[];
  currentUserId: string;
  currentUserName: string;
  /** When multiple numbers are connected, show which inbox each conversation belongs to. */
  showChannels?: boolean;
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
  const activeId = pathname.startsWith('/inbox/') ? pathname.split('/inbox/')[1] : null;

  const filtered = useMemo(() => {
    return conversations.filter((c) => {
      if (inboxFilter && c.inboxId !== inboxFilter) return false;
      if (assignee === 'me' && c.assigneeId !== currentUserId) return false;
      if (assignee === 'unassigned' && c.assigneeId) return false;
      if (statusFilter === 'active' && c.status === 'closed') return false;
      else if (statusFilter !== 'active' && statusFilter !== 'all' && c.status !== statusFilter)
        return false;
      if (query) {
        const hay = `${c.contact?.displayName ?? ''} ${c.title ?? ''} ${
          c.lastMessagePreview ?? ''
        }`.toLowerCase();
        if (!hay.includes(query.toLowerCase())) return false;
      }
      return true;
    });
  }, [conversations, assignee, statusFilter, inboxFilter, query, currentUserId]);

  const tabs = [
    { label: 'Active', href: '/inbox' },
    { label: 'Mine', href: '/inbox?assignee=me' },
    { label: 'Closed', href: '/inbox?status=closed' },
  ];

  return (
    <div className="flex w-80 shrink-0 flex-col border-r bg-card">
      <div className="space-y-3 border-b p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations"
            className="h-9 pl-8"
          />
        </div>
        <div className="flex items-center gap-1">
          {tabs.map((t) => {
            const isActive =
              (t.href === '/inbox' && !assignee && statusFilter === 'active') ||
              (t.href.includes('assignee=me') && assignee === 'me') ||
              (t.href.includes('status=closed') && statusFilter === 'closed');
            return (
              <Link
                key={t.label}
                href={t.href}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  isActive
                    ? 'bg-secondary text-secondary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-2 border-b bg-secondary/60 px-3 py-2 text-xs">
          <span className="font-medium">{selected.size} selected</span>
          <div className="ml-auto flex items-center gap-1">
            {bulkPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              disabled={bulkPending}
              onClick={() => bulk({ status: 'closed' })}
            >
              Close
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              disabled={bulkPending}
              onClick={() => bulk({ status: 'open' })}
            >
              Reopen
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No conversations.</div>
        ) : (
          filtered.map((c) => {
            const active = c.id === activeId;
            const isSelected = selected.has(c.id);
            const name = c.contact?.displayName ?? c.title ?? 'Unknown';
            return (
              <Link
                key={c.id}
                href={`/inbox/${c.id}`}
                className={cn(
                  'group flex gap-3 border-b px-3 py-3 transition-colors',
                  active ? 'bg-secondary' : isSelected ? 'bg-accent/60' : 'hover:bg-accent/60',
                )}
              >
                <button
                  onClick={(e) => toggleSelect(c.id, e)}
                  className={cn(
                    'mt-0.5 shrink-0 text-muted-foreground transition-opacity hover:text-foreground',
                    isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                  )}
                  aria-label={isSelected ? 'Deselect' : 'Select'}
                >
                  {isSelected ? (
                    <CheckSquare className="h-4 w-4" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                </button>
                <span
                  className={cn(
                    'mt-1 h-2 w-2 shrink-0 rounded-full',
                    PRIORITY_COLOR[c.priority] ?? 'bg-transparent',
                  )}
                />
                <Avatar className="h-9 w-9">
                  {c.contact?.avatarUrl && <AvatarImage src={c.contact.avatarUrl} alt={name} />}
                  <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-medium">{name}</p>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {listTime(c.lastMessageAt)}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.lastMessagePreview || 'No messages yet'}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5">
                    {showChannels && c.inbox && (
                      <span
                        className="inline-flex h-4 items-center gap-1 rounded-full px-1.5 text-[10px]"
                        style={{ backgroundColor: `${c.inbox.color}20`, color: c.inbox.color }}
                        title={`Number: ${c.inbox.name}`}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: c.inbox.color }}
                        />
                        {c.inbox.name}
                      </span>
                    )}
                    {c.unreadCount > 0 && (
                      <Badge className="h-4 px-1.5 text-[10px]">{c.unreadCount}</Badge>
                    )}
                    {c.slaBreachedAt ? (
                      <Badge variant="destructive" className="h-4 px-1.5 text-[10px]">
                        Overdue
                      </Badge>
                    ) : c.nextResponseDueAt && c.status !== 'closed' ? (
                      <span className="text-[10px] text-warning">
                        due {relativeTime(c.nextResponseDueAt)}
                      </span>
                    ) : null}
                    {c.status !== 'open' && c.status !== 'closed' && (
                      <Badge variant="outline" className="h-4 px-1.5 text-[10px] capitalize">
                        {c.status}
                      </Badge>
                    )}
                    {c.tags?.map((t) => (
                      <span
                        key={t.tag.id}
                        className="inline-flex h-4 items-center rounded-full px-1.5 text-[10px]"
                        style={{ backgroundColor: `${t.tag.color}20`, color: t.tag.color }}
                      >
                        {t.tag.name}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
