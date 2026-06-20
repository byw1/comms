import Link from 'next/link';
import { Inbox, Plug } from 'lucide-react';
import { listInboxes } from '@/server/queries';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function InboxEmptyPage() {
  const inboxes = await listInboxes();
  const hasConnection = inboxes.some((i) => i.connections.length > 0);

  return (
    <div className="flex h-full flex-1 items-center justify-center p-8">
      <div className="max-w-sm text-center">
        {hasConnection ? (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary">
              <Inbox className="h-6 w-6 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold">Select a conversation</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose a conversation from the list to start replying.
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary">
              <Plug className="h-6 w-6 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold">Connect your iMessage</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Comms talks to iMessage through a BlueBubbles server running on your Mac. Connect it
              to start receiving messages.
            </p>
            <Button asChild className="mt-4">
              <Link href="/settings/inboxes">Connect BlueBubbles</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
