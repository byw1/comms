import type { Job } from 'bullmq';
import {
  type MaintenanceJob,
  COMMS_WEBHOOK_EVENTS,
  COMMS_WEBHOOK_VERSION,
  describeConnectionError,
  enqueueMaintenance,
  outboundQueue,
  loadConfig,
  publishEvent,
  logger,
} from '@comms/core';
import { syncContacts } from '../lib/contacts.js';
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
    columns: { status: true, inboxId: true, webhookVersion: true, contactsSyncedAt: true },
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
      // Anything parked while the Mac was unreachable should go out NOW, not
      // after the rest of its backoff — the laptop is awake again.
      const flushed = await flushParkedSends(connectionId);
      await notifyAdminsOfTransition(
        connectionId,
        prior.inboxId,
        flushed > 0
          ? `bridge recovered — sending ${flushed} queued message${flushed === 1 ? '' : 's'}`
          : 'bridge recovered — messages are flowing again',
      ).catch(() => {});
    }

    // Self-heal a stale webhook subscription: an install created before an
    // event type was added would otherwise never receive it.
    if ((prior?.webhookVersion ?? 0) < COMMS_WEBHOOK_VERSION) {
      await enqueueMaintenance({ type: 'reregister', connectionId }).catch(() => {});
    }
  } catch (err) {
    // Store the human explanation, not the raw "fetch failed" — this string
    // is what the operator reads on the connection card and in the alert.
    const conn = await db.query.channelConnections.findFirst({
      where: eq(channelConnections.id, connectionId),
      columns: { serverUrl: true },
    });
    const explained = describeConnectionError(err, conn?.serverUrl);

    await db
      .update(channelConnections)
      .set({ status: 'error', lastError: explained })
      .where(eq(channelConnections.id, connectionId));
    await publishEvent({ type: 'connection.status', connectionId, status: 'error' });
    log.warn({ connectionId, err: (err as Error).message }, 'heartbeat failed');

    if (prior && prior.status === 'connected') {
      await notifyAdminsOfTransition(
        connectionId,
        prior.inboxId,
        `bridge DOWN — messages are NOT being received. ${explained}`,
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

/**
 * Delete and re-create the webhook. Needed after a URL change, and whenever
 * COMMS_WEBHOOK_EVENTS grows — re-POSTing an existing webhook URL is a silent
 * no-op on the BlueBubbles side, so old installs would never subscribe to
 * newly-added event types.
 */
async function reregisterWebhook(connectionId: string) {
  const db = getDb();
  const { client, connection } = await loadConnection(connectionId);
  const cfg = loadConfig();

  const existing = await client.listWebhooks().catch(() => [] as { id: number | string; url: string }[]);
  for (const hook of existing) {
    if (hook.url?.includes(`/api/webhooks/bluebubbles/${connectionId}`)) {
      await client.deleteWebhook(hook.id).catch(() => {});
    }
  }

  const url = `${cfg.appUrl}/api/webhooks/bluebubbles/${connectionId}?secret=${connection.webhookSecret}`;
  const hook = await client.registerWebhook(url, COMMS_WEBHOOK_EVENTS);
  await db
    .update(channelConnections)
    .set({
      providerWebhookId: String(hook.id),
      webhookVersion: COMMS_WEBHOOK_VERSION,
      lastError: null,
    })
    .where(eq(channelConnections.id, connectionId));
  log.info({ connectionId, version: COMMS_WEBHOOK_VERSION }, 'webhook re-registered');
}

/**
 * Promote every delayed outbound job for this connection so parked replies go
 * out the moment the bridge is back, rather than sitting out a 15-minute
 * backoff that was sized for an outage that just ended.
 */
async function flushParkedSends(connectionId: string): Promise<number> {
  try {
    const delayed = await outboundQueue().getDelayed(0, 500);
    let promoted = 0;
    for (const job of delayed) {
      if (job.data?.connectionId !== connectionId) continue;
      await job.promote().catch(() => {});
      promoted += 1;
    }
    if (promoted > 0) log.info({ connectionId, promoted }, 'flushed parked outbound sends');
    return promoted;
  } catch (err) {
    log.warn({ err: (err as Error).message }, 'could not flush parked sends');
    return 0;
  }
}

async function contactSync(connectionId: string) {
  const result = await syncContacts(connectionId);
  if (!result.macContactsVisible && result.fetched === 0) {
    log.warn(
      { connectionId },
      'contact sync returned nothing — BlueBubbles may lack macOS Contacts permission',
    );
  }
}

export async function processMaintenance(job: Job<MaintenanceJob>): Promise<void> {
  const data = job.data;
  switch (data.type) {
    case 'heartbeat':
      return heartbeat(data.connectionId);
    case 'reregister':
      return reregisterWebhook(data.connectionId);
    case 'contactSync':
      return contactSync(data.connectionId);
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
