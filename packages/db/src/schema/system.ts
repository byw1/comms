import { pgTable, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { genId, timestamps } from './_helpers.js';
import { users } from './auth.js';

/**
 * Singleton-ish key/value settings store for the whole instance (single-org).
 * Holds org name, branding, business hours, the `setupCompleted` flag, etc.
 */
export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').$type<unknown>(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/** Append-only audit trail for sensitive actions. */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: text('id').primaryKey().$defaultFn(genId('aud')),
    actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (a) => [index('audit_logs_entity_idx').on(a.entityType, a.entityId)],
);
