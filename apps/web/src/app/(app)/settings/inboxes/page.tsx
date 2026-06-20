import { listInboxes } from '@/server/queries';
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
            Connect the messaging channels your team shares.
          </p>
        </div>
        <ConnectBlueBubbles />
      </div>

      {inboxes.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No channels connected yet. Connect a BlueBubbles server to start receiving iMessages.
          </p>
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
