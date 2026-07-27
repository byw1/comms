'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Inbox, Users, Settings, Hash, Search, Plus } from 'lucide-react';
import { Logo } from '@/components/brand';
import { UserMenu } from '@/components/app/user-menu';
import { NotificationsBell } from '@/components/app/notifications-bell';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type NavItem = { href: string; label: string; icon: React.ElementType; count?: number };

export function Sidebar({
  user,
  counts,
  inboxes,
}: {
  user: { name?: string | null; email?: string | null; image?: string | null };
  counts: { open: number; mine: number; unassigned: number; closed: number };
  inboxes: { id: string; name: string; color: string; connected: boolean }[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeInbox = searchParams.get('inbox');
  const onInbox = pathname === '/inbox' || pathname.startsWith('/inbox/');

  const nav: NavItem[] = [
    { href: '/inbox', label: 'All conversations', icon: Inbox, count: counts.open },
    { href: '/inbox?assignee=me', label: 'Assigned to me', icon: Users, count: counts.mine },
    { href: '/inbox?assignee=unassigned', label: 'Unassigned', icon: Hash, count: counts.unassigned },
  ];

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r bg-card">
      <div className="flex h-14 items-center justify-between border-b px-4">
        <Logo />
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('comms:open-command'))}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Search (⌘K)"
            title="Search (⌘K)"
          >
            <Search className="h-4 w-4" />
          </button>
          <NotificationsBell />
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        <p className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Conversations
        </p>
        {nav.map((item) => {
          const isAll = item.href === '/inbox';
          const active = isAll
            ? onInbox && !activeInbox && !searchParams.get('assignee')
            : pathname === '/inbox' && searchParams.toString() === item.href.split('?')[1];
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
                active
                  ? 'bg-secondary font-medium text-secondary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {item.count ? (
                <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                  {item.count}
                </Badge>
              ) : null}
            </Link>
          );
        })}

        {/* Per-number channels — filter the inbox by a specific iMessage number. */}
        <div className="pt-4">
          <p className="flex items-center justify-between px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Channels
            <Link href="/settings/inboxes" title="Connect a number" className="hover:text-foreground">
              <Plus className="h-3.5 w-3.5" />
            </Link>
          </p>
          {inboxes.length === 0 ? (
            <Link
              href="/settings/inboxes"
              className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
              Connect a number
            </Link>
          ) : (
            inboxes.map((i) => {
              const active = onInbox && activeInbox === i.id;
              return (
                <Link
                  key={i.id}
                  href={`/inbox?inbox=${i.id}`}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
                    active
                      ? 'bg-secondary font-medium text-secondary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  <span
                    className={cn('h-2.5 w-2.5 shrink-0 rounded-full', !i.connected && 'opacity-40')}
                    style={{ backgroundColor: i.color }}
                    title={i.connected ? 'Connected' : 'Not connected'}
                  />
                  <span className="flex-1 truncate">{i.name}</span>
                </Link>
              );
            })
          )}
        </div>

        <div className="pt-4">
          <Link
            href="/settings"
            className={cn(
              'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
              pathname.startsWith('/settings')
                ? 'bg-secondary font-medium text-secondary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            <Settings className="h-4 w-4" />
            <span className="flex-1">Settings</span>
          </Link>
        </div>
      </nav>

      <div className="border-t p-2">
        <UserMenu user={user} />
      </div>
    </aside>
  );
}
