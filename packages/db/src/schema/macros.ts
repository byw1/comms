import { pgTable, text, jsonb, boolean } from 'drizzle-orm/pg-core';
import { genId, timestamps } from './_helpers.js';
import { users } from './auth.js';

/**
 * A macro / canned response. `body` supports template variables like
 * {{contact.name}} and {{agent.name}}. `actions` optionally mutate the
 * conversation (set status, assign, add tags) when applied.
 */
export const macros = pgTable('macros', {
  id: text('id').primaryKey().$defaultFn(genId('mac')),
  name: text('name').notNull(),
  shortcut: text('shortcut'),
  body: text('body').notNull().default(''),
  actions: jsonb('actions')
    .$type<{
      setStatus?: 'open' | 'pending' | 'snoozed' | 'closed';
      setPriority?: 'low' | 'normal' | 'high' | 'urgent';
      assignToUserId?: string | null;
      assignToTeamId?: string | null;
      addTagIds?: string[];
    }>()
    .notNull()
    .default({}),
  isShared: boolean('is_shared').notNull().default(true),
  createdByUserId: text('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  ...timestamps,
});
