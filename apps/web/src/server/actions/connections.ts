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

/**
 * Update a connection's server URL (and optionally its password) IN PLACE.
 *
 * This exists because tunnel URLs rotate (Cloudflare quick tunnels change on
 * every BlueBubbles restart). Before this action the only path was
 * connectBlueBubbles, which creates a brand-new inbox — duplicating the inbox
 * and stranding all conversation history. Editing in place keeps the same
 * inbox, conversations, and webhook secret; only the transport address moves.
 */
export async function updateConnectionServerUrl(input: {
  connectionId: string;
  serverUrl: string;
  /** Optional: also rotate the password. Blank/omitted keeps the stored one. */
  password?: string;
}): Promise<{ ok: boolean; privateApi?: boolean; webhookRegistered?: boolean; error?: string }> {
  await requireAdmin();
  const cfg = loadConfig();

  const conn = await db.query.channelConnections.findFirst({
    where: eq(channelConnections.id, input.connectionId),
  });
  if (!conn) return { ok: false, error: 'Connection not found.' };

  const serverUrl = input.serverUrl.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//.test(serverUrl)) {
    return { ok: false, error: 'Server URL must start with http:// or https://' };
  }
  const password = input.password?.trim() || decryptSecret(conn.credentialsEncrypted, cfg.appSecret);

  // 1. Verify the new address actually answers with these credentials before
  //    touching the stored row — a typo must not take a working channel down.
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
      error: `Could not reach BlueBubbles at the new URL: ${(err as Error).message}`,
    };
  }

  // 2. Persist the move. Same row, same inbox, same webhook secret.
  await db
    .update(channelConnections)
    .set({
      serverUrl,
      ...(input.password?.trim()
        ? { credentialsEncrypted: encryptSecret(input.password.trim(), cfg.appSecret) }
        : {}),
      status: 'connected',
      lastHeartbeatAt: new Date(),
      lastError: null,
      capabilities: { privateApi, serverVersion, macosVersion: osVersion },
    })
    .where(eq(channelConnections.id, conn.id));

  // 3. Re-register the webhook against the new server. The old registration
  //    lives on the old (dead) server, so deleting it is best-effort only.
  let webhookRegistered = false;
  try {
    const existing = await probe.listWebhooks().catch(() => [] as { id: number | string; url: string }[]);
    for (const hook of existing) {
      if (hook.url?.includes(`/api/webhooks/bluebubbles/${conn.id}`)) {
        await probe.deleteWebhook(hook.id).catch(() => {});
      }
    }
    const url = `${cfg.appUrl}/api/webhooks/bluebubbles/${conn.id}?secret=${conn.webhookSecret}`;
    const hook = await probe.registerWebhook(url, COMMS_WEBHOOK_EVENTS);
    await db
      .update(channelConnections)
      .set({ providerWebhookId: String(hook.id) })
      .where(eq(channelConnections.id, conn.id));
    webhookRegistered = true;
  } catch (err) {
    log.warn({ err: (err as Error).message }, 'webhook re-registration after URL change failed');
    await db
      .update(channelConnections)
      .set({ lastError: `Webhook registration failed: ${(err as Error).message}` })
      .where(eq(channelConnections.id, conn.id));
  }

  // 4. Backfill anything missed while the old URL was dead.
  await enqueueMaintenance({ type: 'backfill', connectionId: conn.id }).catch(() => {});
  await enqueueMaintenance({ type: 'heartbeat', connectionId: conn.id }).catch(() => {});

  revalidatePath('/settings/inboxes');
  return { ok: true, privateApi, webhookRegistered };
}

export type VerifyResult =
  | { ok: true; privateApi: boolean; serverVersion?: string; macosVersion?: string }
  | { ok: false; problem: 'url' | 'password' | 'unreachable' | 'timeout'; message: string; hint: string };

/**
 * Check a URL + password WITHOUT saving anything, and translate whatever went
 * wrong into something a non-technical person can act on. Used by the guided
 * setup so step 6 can say "that password doesn't match" instead of surfacing a
 * raw HTTP error.
 */
export async function verifyBlueBubbles(input: {
  serverUrl: string;
  password: string;
}): Promise<VerifyResult> {
  await requireAdmin();

  const serverUrl = input.serverUrl.trim().replace(/\/+$/, '');
  const password = input.password.trim();

  if (!serverUrl) {
    return {
      ok: false,
      problem: 'url',
      message: 'You need to paste the web address first.',
      hint: 'In BlueBubbles on your Mac, look for the address under the connection settings — it usually ends in .trycloudflare.com or .ngrok.io',
    };
  }
  if (!/^https?:\/\//i.test(serverUrl)) {
    return {
      ok: false,
      problem: 'url',
      message: 'That address is missing the https:// at the front.',
      hint: `Try using: https://${serverUrl.replace(/^\/+/, '')}`,
    };
  }
  if (!password) {
    return {
      ok: false,
      problem: 'password',
      message: 'You need to enter your BlueBubbles password.',
      hint: 'This is the password you chose inside the BlueBubbles app on your Mac — not your Apple ID password.',
    };
  }

  try {
    const info = await new BlueBubblesClient({ serverUrl, password, timeoutMs: 12_000 }).serverInfo();
    return {
      ok: true,
      privateApi: Boolean(info.private_api),
      serverVersion: info.server_version,
      macosVersion: info.os_version,
    };
  } catch (err) {
    const raw = (err as Error).message ?? '';
    const status = (err as { status?: number }).status;

    if (status === 401 || status === 403 || /unauthor|forbidden|password/i.test(raw)) {
      return {
        ok: false,
        problem: 'password',
        message: "That password doesn't match the one on your Mac.",
        hint: 'Open BlueBubbles on your Mac and check the password field. Watch for autocorrect capitalising the first letter.',
      };
    }
    if (status === 408 || /timed out|timeout|abort/i.test(raw)) {
      return {
        ok: false,
        problem: 'timeout',
        message: 'Your Mac took too long to answer.',
        hint: 'Is the Mac awake and connected to the internet? Wake it up, make sure BlueBubbles is running, then try again.',
      };
    }
    return {
      ok: false,
      problem: 'unreachable',
      message: "We couldn't reach your Mac at that address.",
      hint: 'Two usual causes: the address changed when BlueBubbles restarted (copy the current one), or the Mac is asleep. Check that BlueBubbles is open and shows a green/connected status.',
    };
  }
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
    csatEnabled?: boolean;
    csatMessage?: string;
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
