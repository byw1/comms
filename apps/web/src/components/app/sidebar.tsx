'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Inbox, Users, Settings, Hash, Search, Plus, Filter, Clock, Check } from 'lucide-react';
import { Logo } from '@/components/brand';
import { UserMenu } from '@/components/app/user-menu';
import { NotificationsBell } from '@/components/app/notifications-bell';
import { NewConversationButton } from '@/components/inbox/new-conversation';
import { motion } from '@/components/ui/motion';
import { cn } from '@/lib/utils';

type NavItem = { href: string; label: string; icon: React.ElementType; count?: number };

/**
 * Active navigation state is a shared `layoutId` pill that slides between rows
 * rather than a background that pops on and off. It costs nothing and is the
 * clearest "this was designed" signal in the whole shell.
 */
function NavRow({
  href,
  active,
  icon: Icon,
  label,
  count,
  dot,
}: {
  href: string;
  active: boolean;
  icon?: React.ElementType;
  label: string;
  count?: number;
  dot?: { color: string; connected: boolean };
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] transition-colors duration-150',
        active ? 'font-medium text-brand' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {active ? (
        <motion.span
          layoutId="nav-active"
          className="absolute inset-0 -z-10 rounded-lg bg-brand-muted"
          transition={{ type: 'spring', stiffness: 500, damping: 38 }}
        />
      ) : (
        <span className="absolute inset-0 -z-10 rounded-lg bg-transparent transition-colors duration-150 group-hover:bg-accent" />
      )}

      {Icon && <Icon className="h-[15px] w-[15px] shrink-0" />}
      {dot && (
        <span
          className={cn('h-2 w-2 shrink-0 rounded-full', !dot.connected && 'opacity-35')}
          style={{ backgroundColor: dot.color }}
          title={dot.connected ? 'Connected' : 'Not connected'}
        />
      )}
      <span className="flex-1 truncate">{label}</span>
      {count ? (
        <span
          className={cn(
            'tabular rounded-md px-1.5 py-px text-[11px] font-medium transition-colors',
            active ? 'bg-brand/15 text-brand' : 'bg-secondary text-muted-foreground',
          )}
        >
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </Link>
  );
}

function SectionLabel({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-2.5 pb-1 pt-4 first:pt-1">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-muted-foreground/70">
        {children}
      </span>
      {action}
    </div>
  );
}

export function Sidebar({
  user,
  counts,
  inboxes,
  views = [],
}: {
  user: { name?: string | null; email?: string | null; image?: string | null };
  counts: {
    open: number;
    mine: number;
    unassigned: number;
    snoozed: number;
    closed: number;
  };
  inboxes: { id: string; name: string; color: string; connected: boolean }[];
  views?: { id: string; name: string; href: string; count: number }[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeInbox = searchParams.get('inbox');
  const onInbox = pathname === '/inbox' || pathname.startsWith('/inbox/');

  // Snoozed and Closed are folders, not filters: a conversation you snoozed is
  // gone from the inbox until it wakes, and this is where it went. Their counts
  // are deliberately not badged like unread work — they are archives, and a
  // permanent "812" next to Closed is noise.
  const nav: NavItem[] = [
    { href: '/inbox', label: 'Inbox', icon: Inbox, count: counts.open },
    { href: '/inbox?assignee=me', label: 'Assigned to me', icon: Users, count: counts.mine },
    { href: '/inbox?assignee=unassigned', label: 'Unassigned', icon: Hash, count: counts.unassigned },
    { href: '/inbox?status=snoozed', label: 'Snoozed', icon: Clock, count: counts.snoozed },
    { href: '/inbox?status=closed', label: 'Closed', icon: Check },
  ];

  return (
    <aside className="flex h-full w-[248px] shrink-0 flex-col border-r bg-surface-sunken">
      <div className="flex h-[52px] items-center justify-between px-3.5">
        <Logo size="sm" />
        <div className="flex items-center gap-0.5">
          <NewConversationButton />
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('comms:open-command'))}
            className="rounded-md p-1.5 text-muted-foreground transition-all duration-150 hover:bg-accent hover:text-foreground active:scale-95"
            aria-label="Search (⌘K)"
            title="Search (⌘K)"
          >
            <Search className="h-[15px] w-[15px]" />
          </button>
          <NotificationsBell />
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
        <SectionLabel>Conversations</SectionLabel>
        {nav.map((item) => {
          const isAll = item.href === '/inbox';
          // Without the status check the Inbox row stayed lit while standing
          // in Snoozed or Closed, so two rows looked selected at once.
          const active = isAll
            ? onInbox &&
              !activeInbox &&
              !searchParams.get('assignee') &&
              !searchParams.get('status')
            : pathname === '/inbox' && searchParams.toString() === item.href.split('?')[1];
          return (
            <NavRow
              key={item.label}
              href={item.href}
              active={Boolean(active)}
              icon={item.icon}
              label={item.label}
              count={item.count}
            />
          );
        })}

        {views.length > 0 && (
          <>
            <SectionLabel>Views</SectionLabel>
            {views.map((v) => (
              <NavRow
                key={v.id}
                href={v.href}
                active={pathname === '/inbox' && searchParams.toString() === v.href.split('?')[1]}
                icon={Filter}
                label={v.name}
                count={v.count}
              />
            ))}
          </>
        )}

        <SectionLabel
          action={
            <Link
              href="/settings/inboxes"
              title="Connect a number"
              className="rounded p-0.5 text-muted-foreground/70 transition-colors hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
            </Link>
          }
        >
          Channels
        </SectionLabel>

        {inboxes.length === 0 ? (
          <Link
            href="/settings/inboxes"
            className="flex items-center gap-2.5 rounded-lg border border-dashed border-border-strong px-2.5 py-2 text-[13px] text-muted-foreground transition-colors hover:border-brand/40 hover:bg-brand-muted/50 hover:text-brand"
          >
            <Plus className="h-[15px] w-[15px]" />
            Connect a number
          </Link>
        ) : (
          inboxes.map((i) => (
            <NavRow
              key={i.id}
              href={`/inbox?inbox=${i.id}`}
              active={Boolean(onInbox && activeInbox === i.id)}
              label={i.name}
              dot={{ color: i.color, connected: i.connected }}
            />
          ))
        )}

        <SectionLabel>Workspace</SectionLabel>
        <NavRow
          href="/settings"
          active={pathname.startsWith('/settings')}
          icon={Settings}
          label="Settings"
        />
      </nav>

      <div className="border-t p-1.5">
        <UserMenu user={user} />
      </div>
    </aside>
  );
}
