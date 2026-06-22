'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Inbox, Users, Settings, Hash, Search } from 'lucide-react';
import { Logo } from '@/components/brand';
import { UserMenu } from '@/components/app/user-menu';
import { NotificationsBell } from '@/components/app/notifications-bell';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type NavItem = { href: string; label: string; icon: React.ElementType; count?: number };

export function Sidebar({
  user,
  counts,
}: {
  user: { name?: string | null; email?: string | null; image?: string | null };
  counts: { open: number; mine: number; unassigned: number; closed: number };
}) {
  const pathname = usePathname();

  const nav: NavItem[] = [
    { href: '/inbox', label: 'Inbox', icon: Inbox, count: counts.open },
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
          const active = pathname === item.href.split('?')[0] && !item.href.includes('?');
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
