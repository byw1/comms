import { isAdminRole, requireDbUser } from '@/lib/session';
import {
  inboxCounts,
  listInboxes,
  listUnhealthyConnections,
  listSavedViews,
  listTags,
} from '@/server/queries';
import { Sidebar } from '@/components/app/sidebar';
import { RealtimeProvider } from '@/components/app/realtime-provider';
import { ChannelHealthBanner } from '@/components/app/channel-health-banner';
import { CommandPalette } from '@/components/app/command-palette';
import { KeymapProvider } from '@/components/app/keymap-provider';
import { KeyboardShortcuts } from '@/components/app/keyboard-shortcuts';
import { NewConversation } from '@/components/inbox/new-conversation';
import { MobileTopBar, SidebarShell } from '@/components/app/mobile-shell';
import type { KeymapPreference } from '@/lib/keymap';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Read the row rather than the JWT: the token snapshots name/image/role at
  // sign-in, so a profile edit would otherwise not show up until the next login.
  const user = await requireDbUser();
  const [counts, inboxRows, unhealthy, viewRows, tagRows] = await Promise.all([
    inboxCounts(user.id),
    listInboxes(),
    listUnhealthyConnections(),
    listSavedViews(user.id),
    listTags(),
  ]);

  /** Turn a saved view's stored filters back into an inbox URL. */
  const viewHref = (f: Record<string, unknown>) => {
    const p = new URLSearchParams();
    if (f.status && f.status !== 'active') p.set('status', String(f.status));
    if (f.assignee) p.set('assignee', String(f.assignee));
    if (f.inboxId) p.set('inbox', String(f.inboxId));
    if (Array.isArray(f.tagIds) && f.tagIds.length) p.set('tags', f.tagIds.join(','));
    if (Array.isArray(f.priorityIn) && f.priorityIn.length)
      p.set('priority', f.priorityIn.join(','));
    if (f.slaBreached) p.set('sla', 'breached');
    if (f.unreadOnly) p.set('unread', '1');
    if (f.sort && f.sort !== 'newest') p.set('sort', String(f.sort));
    const qs = p.toString();
    return qs ? `/inbox?${qs}` : '/inbox';
  };

  const inboxList = inboxRows.map((i) => ({
    id: i.id,
    name: i.name,
    color: i.color,
    connected: i.connections.some((c) => c.status === 'connected'),
  }));

  return (
    <RealtimeProvider
      currentUser={{ id: user.id, name: user.name ?? null, image: user.image ?? null }}
    >
      <KeymapProvider preference={user.preferences?.keymap as KeymapPreference | undefined}>
      <div className="flex h-dvh flex-col overflow-hidden">
        <ChannelHealthBanner initial={unhealthy} />
        <MobileTopBar />
        <div className="flex min-h-0 flex-1">
          <SidebarShell>
            <Sidebar
              user={{ name: user.name, email: user.email, image: user.image }}
              counts={counts}
              inboxes={inboxList}
              views={viewRows.map((v) => ({
                id: v.id,
                name: v.name,
                href: viewHref(v.filters as Record<string, unknown>),
                count: v.count,
              }))}
            />
          </SidebarShell>
          <main className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
        </div>
      </div>
      <CommandPalette
        tags={tagRows.map((t) => ({ id: t.id, name: t.name }))}
        isAdmin={isAdminRole(user.role)}
      />
      <NewConversation />
      {/* One listener for the whole app: `c`, ⌘K and the jump keys should work
          from settings too, not only inside the inbox. */}
      <KeyboardShortcuts />
      </KeymapProvider>
    </RealtimeProvider>
  );
}
