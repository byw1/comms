import {
  pgTable,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  primaryKey,
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { genId, timestamps } from './_helpers.js';
import { channelType, conversationStatus, priority } from './enums.js';
import { inboxes } from './inboxes.js';
import { contacts, contactIdentities } from './contacts.js';
import { users } from './auth.js';
import { teams } from './teams.js';

/**
 * A conversation thread. In Comms a conversation *is* the ticket — it carries
 * status, assignee, priority and a human ticket `number`.
 */
export const conversations = pgTable(
  'conversations',
  {
    id: text('id').primaryKey().$defaultFn(genId('conv')),
    /** Human-friendly ticket number, e.g. #1042. */
    number: integer('number').generatedAlwaysAsIdentity(),
    inboxId: text('inbox_id')
      .notNull()
      .references(() => inboxes.id, { onDelete: 'cascade' }),
    contactId: text('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
    channelType: channelType('channel_type').notNull().default('imessage'),
    /** The BlueBubbles chat GUID, e.g. `iMessage;-;+15551234567`. Reused verbatim for sends. */
    providerChatGuid: text('provider_chat_guid').notNull(),
    isGroup: boolean('is_group').notNull().default(false),
    title: text('title'),

    // Ticket attributes
    status: conversationStatus('status').notNull().default('open'),
    priority: priority('priority').notNull().default('normal'),
    assigneeId: text('assignee_id').references(() => users.id, { onDelete: 'set null' }),
    assignedTeamId: text('assigned_team_id').references(() => teams.id, { onDelete: 'set null' }),
    snoozedUntil: timestamp('snoozed_until', { withTimezone: true }),

    // Activity denormalizations for fast list rendering
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
    lastInboundAt: timestamp('last_inbound_at', { withTimezone: true }),
    lastMessagePreview: text('last_message_preview'),
    unreadCount: integer('unread_count').notNull().default(0),

    // SLA / metrics
    firstResponseAt: timestamp('first_response_at', { withTimezone: true }),
    firstResponseDueAt: timestamp('first_response_due_at', { withTimezone: true }),
    nextResponseDueAt: timestamp('next_response_due_at', { withTimezone: true }),
    slaBreachedAt: timestamp('sla_breached_at', { withTimezone: true }),
    csatScore: integer('csat_score'),
    closedAt: timestamp('closed_at', { withTimezone: true }),

    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (c) => [
    unique('conversations_inbox_chat_guid_unq').on(c.inboxId, c.providerChatGuid),
    index('conversations_status_idx').on(c.status),
    index('conversations_assignee_idx').on(c.assigneeId),
    index('conversations_last_message_idx').on(c.lastMessageAt),
  ],
);

/** Participants of a (group) conversation, by contact identity. */
export const conversationParticipants = pgTable(
  'conversation_participants',
  {
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    contactIdentityId: text('contact_identity_id')
      .notNull()
      .references(() => contactIdentities.id, { onDelete: 'cascade' }),
  },
  (cp) => [primaryKey({ columns: [cp.conversationId, cp.contactIdentityId] })],
);

export const tags = pgTable('tags', {
  id: text('id').primaryKey().$defaultFn(genId('tag')),
  name: text('name').notNull().unique(),
  color: text('color').notNull().default('#71717a'),
  ...timestamps,
});

export const conversationTags = pgTable(
  'conversation_tags',
  {
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (ct) => [primaryKey({ columns: [ct.conversationId, ct.tagId] })],
);
