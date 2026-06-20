import { pgTable, text, boolean, integer, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { genId, timestamps } from './_helpers.js';
import {
  messageDirection,
  messageAuthorType,
  messageStatus,
  attachmentStatus,
} from './enums.js';
import { conversations } from './conversations.js';
import { users } from './auth.js';
import { contacts } from './contacts.js';

/**
 * A single message in a conversation timeline. Covers customer messages, agent
 * replies, internal notes (`isPrivateNote`), and system events (`authorType=system`).
 */
export const messages = pgTable(
  'messages',
  {
    id: text('id').primaryKey().$defaultFn(genId('msg')),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),

    /** BlueBubbles message GUID — unique idempotency key for ingestion. Null until sent. */
    providerMessageGuid: text('provider_message_guid').unique(),
    /** Client-generated temp id we attach to outbound sends to reconcile the echo. */
    tempGuid: text('temp_guid').unique(),

    direction: messageDirection('direction').notNull(),
    authorType: messageAuthorType('author_type').notNull(),
    authorUserId: text('author_user_id').references(() => users.id, { onDelete: 'set null' }),
    authorContactId: text('author_contact_id').references(() => contacts.id, {
      onDelete: 'set null',
    }),

    body: text('body'),
    subject: text('subject'),

    /** Internal note visible only to agents — never sent to the customer. */
    isPrivateNote: boolean('is_private_note').notNull().default(false),

    status: messageStatus('status').notNull().default('sent'),
    error: text('error'),

    // Reactions / replies / edits
    associatedMessageGuid: text('associated_message_guid'),
    reactionType: text('reaction_type'),
    replyToMessageGuid: text('reply_to_message_guid'),
    isEdited: boolean('is_edited').notNull().default(false),
    isRetracted: boolean('is_retracted').notNull().default(false),

    // Timeline timestamps (from BlueBubbles, ms-precision sources)
    sentAt: timestamp('sent_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    readAt: timestamp('read_at', { withTimezone: true }),
    editedAt: timestamp('edited_at', { withTimezone: true }),
    retractedAt: timestamp('retracted_at', { withTimezone: true }),

    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (m) => [
    index('messages_conversation_idx').on(m.conversationId, m.createdAt),
    index('messages_status_idx').on(m.status),
  ],
);

export const attachments = pgTable('attachments', {
  id: text('id').primaryKey().$defaultFn(genId('att')),
  messageId: text('message_id')
    .notNull()
    .references(() => messages.id, { onDelete: 'cascade' }),
  providerAttachmentGuid: text('provider_attachment_guid'),
  fileName: text('file_name'),
  mimeType: text('mime_type'),
  sizeBytes: integer('size_bytes'),
  width: integer('width'),
  height: integer('height'),
  /** S3 object key once stored. Served to the UI via presigned URLs. */
  storageKey: text('storage_key'),
  status: attachmentStatus('status').notNull().default('pending'),
  ...timestamps,
});
