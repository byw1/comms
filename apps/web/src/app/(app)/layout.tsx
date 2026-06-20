import { requireUser } from '@/lib/session';
import { inboxCounts } from '@/server/queries';
import { Sidebar } from '@/components/app/sidebar';
import { RealtimeProvider } from '@/components/app/realtime-provider';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const counts = await inboxCounts(user.id);

  return (
    <RealtimeProvider
      currentUser={{ id: user.id, name: user.name ?? null, image: user.image ?? null }}
    >
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          user={{ name: user.name, email: user.email, image: user.image }}
          counts={counts}
        />
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
      </div>
    </RealtimeProvider>
  );
}
