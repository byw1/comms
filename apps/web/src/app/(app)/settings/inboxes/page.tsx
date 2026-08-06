import Link from 'next/link';
import { Plus } from 'lucide-react';
import { listInboxes } from '@/server/queries';
import { Button } from '@/components/ui/button';
import { ConnectBlueBubbles } from '@/components/settings/connect-bluebubbles';
import { ConnectionCard } from '@/components/settings/connection-card';
import { InboxSettings } from '@/components/settings/inbox-settings';

export const dynamic = 'force-dynamic';

export default async function InboxesSettingsPage() {
  const inboxes = await listInboxes();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Inboxes & Channels</h2>
          <p className="text-sm text-muted-foreground">
            Connect one or more iMessage numbers. Each number becomes its own channel you can
            filter by in the inbox.
          </p>
        </div>
        <Button asChild>
          <Link href="/settings/inboxes/setup">
            <Plus className="h-4 w-4" />
            {inboxes.length > 0 ? 'Connect another number' : 'Connect iMessage'}
          </Link>
        </Button>
      </div>

      {inboxes.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <p className="text-[15px] font-medium">No numbers connected yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
            Comms connects to iMessage through a Mac you leave running. Our step-by-step guide walks
            you through it — no technical experience needed, about fifteen minutes.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button asChild>
              <Link href="/settings/inboxes/setup">Start the guided setup</Link>
            </Button>
            <ConnectBlueBubbles hasExisting={false} />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {inboxes.map((inbox) => (
            <div key={inbox.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="font-medium">{inbox.name}</h3>
                {inbox.isDefault && (
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                    Default
                  </span>
                )}
              </div>
              <InboxSettings inboxId={inbox.id} settings={inbox.settings} />
              {inbox.connections.length === 0 ? (
                <p className="text-sm text-muted-foreground">No connection.</p>
              ) : (
                inbox.connections.map((c) => (
                  <ConnectionCard
                    key={c.id}
                    connection={{
                      id: c.id,
                      serverUrl: c.serverUrl,
                      status: c.status,
                      privateApi: Boolean(c.capabilities?.privateApi),
                      serverVersion: c.capabilities?.serverVersion,
                      lastError: c.lastError,
                      webhookRegistered: Boolean(c.providerWebhookId),
                    }}
                  />
                ))
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
