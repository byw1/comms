import type { Job } from 'bullmq';
import { type MaintenanceJob, publishEvent, logger } from '@comms/core';
import { getDb, eq, and, lte } from '@comms/db';
import { channelConnections, conversations } from '@comms/db';
import { loadConnection } from '../lib/connection.js';
import { ingestNewMessage } from '../lib/ingest.js';
import { checkSlaBreaches } from '../lib/sla.js';

const log = logger.child({ module: 'maintenance' });

async function heartbeat(connectionId: string) {
  const db = getDb();
  try {
    const { client } = await loadConnection(connectionId);
    const info = await client.serverInfo();
    await db
      .update(channelConnections)
      .set({
        status: 'connected',
        lastHeartbeatAt: new Date(),
        lastError: null,
        capabilities: {
          privateApi: Boolean(info.private_api),
          serverVersion: info.server_version,
          macosVersion: info.os_version,
          proxyService: info.proxy_service,
        },
      })
      .where(eq(channelConnections.id, connectionId));
    await publishEvent({ type: 'connection.status', connectionId, status: 'connected' });
  } catch (err) {
    await db
      .update(channelConnections)
      .set({ status: 'error', lastError: (err as Error).message })
      .where(eq(channelConnections.id, connectionId));
    await publishEvent({ type: 'connection.status', connectionId, status: 'error' });
    log.warn({ connectionId, err: (err as Error).message }, 'heartbeat failed');
  }
}

async function backfill(connectionId: string, since?: number) {
  const db = getDb();
  const { client, connection } = await loadConnection(connectionId);
  const after = since ?? connection.lastSyncedAt?.getTime();

  const chats = await client.queryChats({ limit: 500, with: ['lastMessage', 'participants'] });
  log.info({ connectionId, chats: chats.length }, 'backfill: fetched chats');

  for (const chat of chats) {
    try {
      const msgs = await client.getChatMessages(chat.guid, {
        after,
        limit: 200,
        sort: 'ASC',
        with: ['attachment', 'handle'],
      });
      for (const m of msgs) {
        // ingestNewMessage dedups by provider guid, so re-runs are safe.
        await ingestNewMessage(connectionId, { ...m, chats: m.chats ?? [chat] });
      }
    } catch (err) {
      log.warn({ chat: chat.guid, err: (err as Error).message }, 'backfill chat failed');
    }
  }

  await db
    .update(channelConnections)
    .set({ lastSyncedAt: new Date() })
    .where(eq(channelConnections.id, connectionId));
}

async function unsnooze() {
  const db = getDb();
  const due = await db
    .update(conversations)
    .set({ status: 'open', snoozedUntil: null })
    .where(
      and(
        eq(conversations.status, 'snoozed'),
        lte(conversations.snoozedUntil, new Date()),
      ),
    )
    .returning({ id: conversations.id, inboxId: conversations.inboxId });

  for (const c of due) {
    await publishEvent({ type: 'conversation.updated', conversationId: c.id, inboxId: c.inboxId });
  }
}

export async function processMaintenance(job: Job<MaintenanceJob>): Promise<void> {
  const data = job.data;
  switch (data.type) {
    case 'heartbeat':
      return heartbeat(data.connectionId);
    case 'backfill':
      return backfill(data.connectionId, data.since);
    case 'unsnooze':
      return unsnooze();
    case 'sla':
      return checkSlaBreaches();
  }
}
