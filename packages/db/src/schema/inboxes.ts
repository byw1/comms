import { pgTable, text, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { genId, timestamps } from './_helpers.js';
import { channelType, channelProvider, connectionStatus } from './enums.js';

/**
 * A logical shared mailbox. For v1 each inbox is backed by one iMessage number
 * (one BlueBubbles connection). Future channels (WhatsApp, SMS) attach the same way.
 */
export const inboxes = pgTable('inboxes', {
  id: text('id').primaryKey().$defaultFn(genId('inbx')),
  name: text('name').notNull(),
  channelType: channelType('channel_type').notNull().default('imessage'),
  color: text('color').notNull().default('#000000'),
  isDefault: boolean('is_default').notNull().default(false),
  settings: jsonb('settings')
    .$type<{
      signature?: string;
      autoAssign?: boolean;
      markReadOnReply?: boolean;
      sendTypingIndicators?: boolean;
    }>()
    .notNull()
    .default({}),
  ...timestamps,
});

/**
 * The transport connection that powers an inbox. Holds the BlueBubbles server
 * URL, the encrypted shared password, the webhook secret we registered, and the
 * detected capabilities (Private API availability, server version).
 */
export const channelConnections = pgTable('channel_connections', {
  id: text('id').primaryKey().$defaultFn(genId('conn')),
  inboxId: text('inbox_id')
    .notNull()
    .references(() => inboxes.id, { onDelete: 'cascade' }),
  provider: channelProvider('provider').notNull().default('bluebubbles'),
  serverUrl: text('server_url').notNull(),
  /** AES-GCM encrypted BlueBubbles password (never stored or logged in plaintext). */
  credentialsEncrypted: text('credentials_encrypted').notNull(),
  /** Secret embedded in the registered webhook URL to authenticate inbound posts. */
  webhookSecret: text('webhook_secret').notNull(),
  /** The webhook id returned by BlueBubbles, so we can update/delete it. */
  providerWebhookId: text('provider_webhook_id'),
  status: connectionStatus('status').notNull().default('pending'),
  capabilities: jsonb('capabilities')
    .$type<{
      privateApi?: boolean;
      serverVersion?: string;
      macosVersion?: string;
      proxyService?: string;
    }>()
    .notNull()
    .default({}),
  lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true }),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  lastError: text('last_error'),
  ...timestamps,
});
