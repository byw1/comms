import type { Job } from 'bullmq';
import { type MaintenanceJob, publishEvent, logger } from '@comms/core';
import { getDb, eq, and, lte, inArray, isNotNull } from '@comms/db';
import {
  channelConnections,
  conversations,
  inboxes,
  messages,
  notifications,
  users,
} from '@comms/db';
import { loadConnection } from '../lib/connection.js';
import { ingestNewMessage } from '../lib/ingest.js';
import { checkSlaBreaches } from '../lib/sla.js';

const log = logger.child({ module: 'maintenance' });

/**
 * Notify every admin/owner about a channel transition (down or recovered).
 * Fires only on TRANSITIONS — a bridge that stays down alerts once, not every
 * 60s heartbeat tick.
 */
async function notifyAdminsOfTransition(connectionId: string, inboxId: string, body: string) {
  const db = getDb();
  const inbox = await db.query.inboxes.findFirst({ where: eq(inboxes.id, inboxId) });
  const admins = await db.query.users.findMany({
    where: and(eq(users.status, 'active'), inArray(users.role, ['owner', 'admin'])),
    columns: { id: true },
  });
  for (const a of admins) {
    await db.insert(notifications).values({
      userId: a.id,
      type: 'system',
      body: `${inbox?.name ?? 'iMessage'}: ${body}`,
    });
    await publishEvent({ type: 'notification', userId: a.id });
  }
  log.info({ connectionId, admins: admins.length, body }, 'channel transition alert sent');
}

async function heartbeat(connectionId: string) {
  const db = getDb();
  // Read the prior status first so we only alert on transitions.
  const prior = await db.query.channelConnections.findFirst({
    where: eq(channelConnections.id, connectionId),
    columns: { status: true, inboxId: true },
  });
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

    if (prior && prior.status !== 'connected' && prior.status !== 'pending') {
      await notifyAdminsOfTransition(
        connectionId,
        prior.inboxId,
        'bridge recovered — messages are flowing again',
      ).catch(() => {});
    }
  } catch (err) {
    await db
      .update(channelConnections)
      .set({ status: 'error', lastError: (err as Error).message })
      .where(eq(channelConnections.id, connectionId));
    await publishEvent({ type: 'connection.status', connectionId, status: 'error' });
    log.warn({ connectionId, err: (err as Error).message }, 'heartbeat failed');

    if (prior && prior.status === 'connected') {
      await notifyAdminsOfTransition(
        connectionId,
        prior.inboxId,
        `bridge DOWN — messages are NOT being received (${(err as Error).message})`,
      ).catch(() => {});
    }
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

/**
 * Follow-up reminders: resurface conversations the customer never replied to.
 *
 * The distinction from a snooze is the whole point — if `lastInboundAt` moved
 * past `followUpArmedAt`, the customer DID reply, so the reminder resolves
 * silently. You're only ever interrupted about actual silence.
 */
async function followUps() {
  const db = getDb();
  const due = await db
    .update(conversations)
    .set({ followUpAt: null, followUpArmedAt: null })
    .where(and(isNotNull(conversations.followUpAt), lte(conversations.followUpAt, new Date())))
    .returning({
      id: conversations.id,
      inboxId: conversations.inboxId,
      number: conversations.number,
      status: conversations.status,
      lastInboundAt: conversations.lastInboundAt,
      armedAt: conversations.followUpArmedAt,
      userId: conversations.followUpUserId,
    });

  for (const c of due) {
    const customerReplied =
      c.lastInboundAt && c.armedAt && c.lastInboundAt.getTime() > c.armedAt.getTime();
    if (customerReplied) continue; // resolved itself — stay quiet

    if (c.status === 'closed' || c.status === 'snoozed') {
      await db
        .update(conversations)
        .set({ status: 'open', snoozedUntil: null })
        .where(eq(conversations.id, c.id));
    }

    await db.insert(messages).values({
      conversationId: c.id,
      direction: 'outbound',
      authorType: 'system',
      body: 'Follow-up reminder — the customer never replied',
      status: 'sent',
      sentAt: new Date(),
    });

    if (c.userId) {
      await db.insert(notifications).values({
        userId: c.userId,
        type: 'assignment',
        conversationId: c.id,
        body: `No reply yet on #${c.number} — time to follow up`,
      });
      await publishEvent({ type: 'notification', userId: c.userId });
    }
    await publishEvent({ type: 'conversation.updated', conversationId: c.id, inboxId: c.inboxId });
  }
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
      // Same tick: due snoozes wake, due follow-ups resurface.
      await unsnooze();
      return followUps();
    case 'sla':
      return checkSlaBreaches();
  }
}
