import { pgEnum } from 'drizzle-orm/pg-core';

export const userRole = pgEnum('user_role', ['owner', 'admin', 'agent']);
export const userStatus = pgEnum('user_status', ['active', 'invited', 'disabled']);

/** The transport family of a conversation. Extensible: whatsapp, sms, etc. later. */
export const channelType = pgEnum('channel_type', ['imessage']);

/** Concrete integration provider behind a channel. */
export const channelProvider = pgEnum('channel_provider', ['bluebubbles']);

export const connectionStatus = pgEnum('connection_status', [
  'pending',
  'connected',
  'disconnected',
  'error',
]);

/** Ticket lifecycle, applied directly to a conversation (a conversation IS the ticket). */
export const conversationStatus = pgEnum('conversation_status', [
  'open',
  'pending',
  'snoozed',
  'closed',
]);

export const priority = pgEnum('priority', ['low', 'normal', 'high', 'urgent']);

export const messageDirection = pgEnum('message_direction', ['inbound', 'outbound']);

export const messageAuthorType = pgEnum('message_author_type', [
  'contact', // the customer
  'agent', // a Comms user
  'system', // generated timeline events (assigned, closed, …)
  'external', // sent from the Mac/iPhone outside Comms (echo with no tempGuid)
]);

export const messageStatus = pgEnum('message_status', [
  'queued',
  'sending',
  'sent',
  'delivered',
  'read',
  'failed',
]);

/** How we can reach a contact. */
export const identityKind = pgEnum('identity_kind', ['phone', 'email', 'handle']);

export const attachmentStatus = pgEnum('attachment_status', ['pending', 'stored', 'failed']);
