import { requireUser } from '@/lib/session';
import { inboxCounts } from '@/server/queries';
import { Sidebar } from '@/components/app/sidebar';
import { RealtimeListener } from '@/components/app/realtime-listener';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const counts = await inboxCounts(user.id);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        user={{ name: user.name, email: user.email, image: user.image }}
        counts={counts}
      />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
      <RealtimeListener />
    </div>
  );
}
