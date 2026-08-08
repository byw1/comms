import { listPending } from '@/server/actions/scheduled';
import { PendingList } from '@/components/inbox/pending-list';

export const dynamic = 'force-dynamic';

export default async function ScheduledPage() {
  const items = await listPending();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 overflow-y-auto p-6">
      <div>
        <h1 className="type-title text-lg">Scheduled &amp; reminders</h1>
        <p className="type-body mt-1 text-muted-foreground">
          Everything with a future timestamp — messages waiting to send, reminders armed for
          silence, and conversations sleeping until you asked for them back.
        </p>
      </div>

      <PendingList items={items} />
    </div>
  );
}
