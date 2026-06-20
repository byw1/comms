'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn, initials } from '@/lib/utils';
import { listTime } from '@/lib/format';
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
}: {
  conversations: ConversationListItem[];
  currentUserId: string;
  currentUserName: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState('');

  const assignee = searchParams.get('assignee');
  const statusFilter = searchParams.get('status') ?? 'active';
  const activeId = pathname.startsWith('/inbox/') ? pathname.split('/inbox/')[1] : null;

  const filtered = useMemo(() => {
    return conversations.filter((c) => {
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
  }, [conversations, assignee, statusFilter, query, currentUserId]);

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

      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No conversations.</div>
        ) : (
          filtered.map((c) => {
            const active = c.id === activeId;
            const name = c.contact?.displayName ?? c.title ?? 'Unknown';
            return (
              <Link
                key={c.id}
                href={`/inbox/${c.id}`}
                className={cn(
                  'flex gap-3 border-b px-3 py-3 transition-colors',
                  active ? 'bg-secondary' : 'hover:bg-accent/60',
                )}
              >
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
                    {c.unreadCount > 0 && (
                      <Badge className="h-4 px-1.5 text-[10px]">{c.unreadCount}</Badge>
                    )}
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
