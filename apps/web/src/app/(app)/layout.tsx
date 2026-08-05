import { requireUser } from '@/lib/session';
import { inboxCounts, listInboxes, listUnhealthyConnections } from '@/server/queries';
import { Sidebar } from '@/components/app/sidebar';
import { RealtimeProvider } from '@/components/app/realtime-provider';
import { ChannelHealthBanner } from '@/components/app/channel-health-banner';
import { CommandPalette } from '@/components/app/command-palette';
import { MobileTopBar, SidebarShell } from '@/components/app/mobile-shell';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [counts, inboxRows, unhealthy] = await Promise.all([
    inboxCounts(user.id),
    listInboxes(),
    listUnhealthyConnections(),
  ]);

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
      <div className="flex h-dvh flex-col overflow-hidden">
        <ChannelHealthBanner initial={unhealthy} />
        <MobileTopBar />
        <div className="flex min-h-0 flex-1">
          <SidebarShell>
            <Sidebar
              user={{ name: user.name, email: user.email, image: user.image }}
              counts={counts}
              inboxes={inboxList}
            />
          </SidebarShell>
          <main className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
        </div>
      </div>
      <CommandPalette />
    </RealtimeProvider>
  );
}
