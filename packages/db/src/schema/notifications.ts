import { pgTable, text, timestamp, index, pgEnum } from 'drizzle-orm/pg-core';
import { genId, timestamps } from './_helpers.js';
import { users } from './auth.js';
import { conversations } from './conversations.js';

export const notificationType = pgEnum('notification_type', ['mention', 'assignment', 'system']);

/** A per-user notification (an @mention in a note, a ticket assigned to you, …). */
export const notifications = pgTable(
  'notifications',
  {
    id: text('id').primaryKey().$defaultFn(genId('ntf')),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: notificationType('type').notNull(),
    conversationId: text('conversation_id').references(() => conversations.id, {
      onDelete: 'cascade',
    }),
    actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    body: text('body').notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
    ...timestamps,
  },
  (n) => [index('notifications_user_idx').on(n.userId, n.readAt)],
);
