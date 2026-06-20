import { getDb, eq } from '@comms/db';
import { channelConnections } from '@comms/db';
import { BlueBubblesClient, decryptSecret, loadConfig } from '@comms/core';

export interface LoadedConnection {
  connection: typeof channelConnections.$inferSelect;
  client: BlueBubblesClient;
}

/** Load a channel connection and build an authenticated BlueBubbles client. */
export async function loadConnection(connectionId: string): Promise<LoadedConnection> {
  const db = getDb();
  const connection = await db.query.channelConnections.findFirst({
    where: eq(channelConnections.id, connectionId),
  });
  if (!connection) throw new Error(`Channel connection ${connectionId} not found`);

  const cfg = loadConfig();
  const password = decryptSecret(connection.credentialsEncrypted, cfg.appSecret);
  const client = new BlueBubblesClient({ serverUrl: connection.serverUrl, password });
  return { connection, client };
}
