import { requireUser } from '@/lib/session';
import { inboxCounts, listInboxes } from '@/server/queries';
import { Sidebar } from '@/components/app/sidebar';
import { RealtimeProvider } from '@/components/app/realtime-provider';
import { CommandPalette } from '@/components/app/command-palette';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [counts, inboxRows] = await Promise.all([inboxCounts(user.id), listInboxes()]);

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
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          user={{ name: user.name, email: user.email, image: user.image }}
          counts={counts}
          inboxes={inboxList}
        />
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
      </div>
      <CommandPalette />
    </RealtimeProvider>
  );
}
