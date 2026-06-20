'use server';

import { revalidatePath } from 'next/cache';
import { eq, count } from '@comms/db';
import { inboxes, channelConnections } from '@comms/db';
import {
  BlueBubblesClient,
  encryptSecret,
  decryptSecret,
  randomToken,
  loadConfig,
  enqueueMaintenance,
  COMMS_WEBHOOK_EVENTS,
  logger,
} from '@comms/core';
import { db } from '@/server/db';
import { requireAdmin } from '@/lib/session';

const log = logger.child({ action: 'connections' });

export type ConnectResult =
  | { ok: true; connectionId: string; privateApi: boolean; webhookRegistered: boolean }
  | { ok: false; error: string };

/**
 * Connect a BlueBubbles server: validate credentials, persist an encrypted
 * connection, register the inbound webhook, and queue an initial history sync.
 */
export async function connectBlueBubbles(input: {
  name: string;
  serverUrl: string;
  password: string;
}): Promise<ConnectResult> {
  await requireAdmin();
  const cfg = loadConfig();

  const serverUrl = input.serverUrl.trim().replace(/\/+$/, '');
  const password = input.password.trim();
  if (!serverUrl || !password) return { ok: false, error: 'Server URL and password are required.' };

  // 1. Validate by hitting the server.
  const probe = new BlueBubblesClient({ serverUrl, password });
  let privateApi = false;
  let serverVersion: string | undefined;
  let osVersion: string | undefined;
  try {
    const info = await probe.serverInfo();
    privateApi = Boolean(info.private_api);
    serverVersion = info.server_version;
    osVersion = info.os_version;
  } catch (err) {
    return {
      ok: false,
      error: `Could not reach the BlueBubbles server: ${(err as Error).message}`,
    };
  }

  // 2. Create the inbox (default if it's the first one).
  const [countRow] = await db.select({ value: count() }).from(inboxes);
  const inboxCount = Number(countRow?.value ?? 0);
  const [inbox] = await db
    .insert(inboxes)
    .values({
      name: input.name.trim() || 'iMessage',
      channelType: 'imessage',
      isDefault: inboxCount === 0,
      settings: { markReadOnReply: false, sendTypingIndicators: privateApi },
    })
    .returning();
  if (!inbox) return { ok: false, error: 'Failed to create inbox.' };

  // 3. Persist the connection with the encrypted password.
  const webhookSecret = randomToken(24);
  const [connection] = await db
    .insert(channelConnections)
    .values({
      inboxId: inbox.id,
      provider: 'bluebubbles',
      serverUrl,
      credentialsEncrypted: encryptSecret(password, cfg.appSecret),
      webhookSecret,
      status: 'connected',
      lastHeartbeatAt: new Date(),
      capabilities: { privateApi, serverVersion, macosVersion: osVersion },
    })
    .returning();
  if (!connection) return { ok: false, error: 'Failed to save connection.' };

  // 4. Register the inbound webhook (best-effort: a localhost APP_URL can't be reached).
  let webhookRegistered = false;
  try {
    const webhookUrl = `${cfg.appUrl}/api/webhooks/bluebubbles/${connection.id}?secret=${webhookSecret}`;
    const hook = await probe.registerWebhook(webhookUrl, COMMS_WEBHOOK_EVENTS);
    await db
      .update(channelConnections)
      .set({ providerWebhookId: String(hook.id) })
      .where(eq(channelConnections.id, connection.id));
    webhookRegistered = true;
  } catch (err) {
    log.warn({ err: (err as Error).message }, 'webhook registration failed (will need retry)');
    await db
      .update(channelConnections)
      .set({ lastError: `Webhook registration failed: ${(err as Error).message}` })
      .where(eq(channelConnections.id, connection.id));
  }

  // 5. Kick off a history backfill + heartbeat.
  await enqueueMaintenance({ type: 'backfill', connectionId: connection.id }).catch(() => {});
  await enqueueMaintenance({ type: 'heartbeat', connectionId: connection.id }).catch(() => {});

  revalidatePath('/settings/inboxes');
  revalidatePath('/inbox');
  return { ok: true, connectionId: connection.id, privateApi, webhookRegistered };
}

/** Re-test a connection and refresh its capabilities. */
export async function testConnection(
  connectionId: string,
): Promise<{ ok: boolean; privateApi?: boolean; error?: string }> {
  await requireAdmin();
  const cfg = loadConfig();
  const conn = await db.query.channelConnections.findFirst({
    where: eq(channelConnections.id, connectionId),
  });
  if (!conn) return { ok: false, error: 'Connection not found.' };

  try {
    const client = new BlueBubblesClient({
      serverUrl: conn.serverUrl,
      password: decryptSecret(conn.credentialsEncrypted, cfg.appSecret),
    });
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
        },
      })
      .where(eq(channelConnections.id, connectionId));
    revalidatePath('/settings/inboxes');
    return { ok: true, privateApi: Boolean(info.private_api) };
  } catch (err) {
    await db
      .update(channelConnections)
      .set({ status: 'error', lastError: (err as Error).message })
      .where(eq(channelConnections.id, connectionId));
    revalidatePath('/settings/inboxes');
    return { ok: false, error: (err as Error).message };
  }
}

/** Re-register the webhook (e.g. after the public URL changes). */
export async function reRegisterWebhook(
  connectionId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const cfg = loadConfig();
  const conn = await db.query.channelConnections.findFirst({
    where: eq(channelConnections.id, connectionId),
  });
  if (!conn) return { ok: false, error: 'Connection not found.' };

  try {
    const client = new BlueBubblesClient({
      serverUrl: conn.serverUrl,
      password: decryptSecret(conn.credentialsEncrypted, cfg.appSecret),
    });
    if (conn.providerWebhookId) {
      await client.deleteWebhook(conn.providerWebhookId).catch(() => {});
    }
    const url = `${cfg.appUrl}/api/webhooks/bluebubbles/${conn.id}?secret=${conn.webhookSecret}`;
    const hook = await client.registerWebhook(url, COMMS_WEBHOOK_EVENTS);
    await db
      .update(channelConnections)
      .set({ providerWebhookId: String(hook.id), lastError: null })
      .where(eq(channelConnections.id, connectionId));
    revalidatePath('/settings/inboxes');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function updateInboxSettings(
  inboxId: string,
  settings: {
    autoAssign?: boolean;
    assignStrategy?: 'round_robin' | 'least_busy';
    markReadOnReply?: boolean;
  },
): Promise<{ ok: boolean }> {
  await requireAdmin();
  const inbox = await db.query.inboxes.findFirst({ where: eq(inboxes.id, inboxId) });
  if (!inbox) return { ok: false };
  await db
    .update(inboxes)
    .set({ settings: { ...inbox.settings, ...settings } })
    .where(eq(inboxes.id, inboxId));
  revalidatePath('/settings/inboxes');
  return { ok: true };
}

export async function disconnect(connectionId: string): Promise<{ ok: boolean }> {
  await requireAdmin();
  const cfg = loadConfig();
  const conn = await db.query.channelConnections.findFirst({
    where: eq(channelConnections.id, connectionId),
  });
  if (conn) {
    try {
      if (conn.providerWebhookId) {
        const client = new BlueBubblesClient({
          serverUrl: conn.serverUrl,
          password: decryptSecret(conn.credentialsEncrypted, cfg.appSecret),
        });
        await client.deleteWebhook(conn.providerWebhookId).catch(() => {});
      }
    } catch {
      /* best effort */
    }
    await db.delete(channelConnections).where(eq(channelConnections.id, connectionId));
  }
  revalidatePath('/settings/inboxes');
  return { ok: true };
}
