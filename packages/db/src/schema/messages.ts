import {
  pgTable,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

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
    /**
     * Set when a reply is deliberately scheduled for later. The queued job is
     * delayed until this time; the UI shows and can cancel it. Distinct from
     * the short undo-send delay, which leaves this null.
     */
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }),

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
  /**
   * Apple's Uniform Type Identifier. Unlike mimeType/fileName — which the
   * BlueBubbles server rewrites during audio conversion — this is never
   * mutated, so it's the only reliable voice-memo signal.
   */
  uti: text('uti'),
  isVoiceMemo: boolean('is_voice_memo').notNull().default(false),
  /** S3 object key for the original bytes, exactly as the Mac had them. */
  storageKey: text('storage_key'),
  /**
   * S3 key for a browser-playable rendition, when the original isn't (Apple's
   * CAF format plays in no browser). Same object as `storageKey` when the
   * original was already playable.
   */
  playableStorageKey: text('playable_storage_key'),
  playableMimeType: text('playable_mime_type'),
  /** Voice-memo transcript, from Apple's on-device text or a speech provider. */
  transcript: text('transcript'),
  transcriptSource: text('transcript_source'),
  status: attachmentStatus('status').notNull().default('pending'),
  ...timestamps,
});

/**
 * An unsent reply, kept per conversation per person.
 *
 * Without this the composer holds its text in component state, so moving to
 * another conversation — the one thing this app is built to make fast —
 * silently destroys whatever you had written. A draft is per USER as well as
 * per conversation: in a shared inbox two people can be part-way through a
 * reply to the same thread, and showing one person the other's half-finished
 * sentence would be worse than losing it.
 */
export const drafts = pgTable(
  'drafts',
  {
    id: text('id').primaryKey().$defaultFn(genId('draft')),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    body: text('body').notNull().default(''),
    /** The note/reply toggle is part of the draft — losing it changes meaning. */
    isPrivateNote: boolean('is_private_note').notNull().default(false),
    /** The message being replied to, so the reply context survives too. */
    replyToMessageId: text('reply_to_message_id'),

    ...timestamps,
  },
  (d) => [
    // One draft per person per conversation — the upsert target.
    uniqueIndex('drafts_conversation_user_idx').on(d.conversationId, d.userId),
    index('drafts_user_idx').on(d.userId, d.updatedAt),
  ],
);
