import { pgTable, text, boolean, integer, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { genId, timestamps } from './_helpers.js';

export const automationTrigger = pgEnum('automation_trigger', [
  'conversation_created',
  'message_received',
]);

/**
 * A no-code automation: when {trigger} fires and all {conditions} match, apply
 * {actions} to the conversation. Evaluated by the worker on inbound events.
 */
export const automationRules = pgTable('automation_rules', {
  id: text('id').primaryKey().$defaultFn(genId('rule')),
  name: text('name').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  trigger: automationTrigger('trigger').notNull().default('conversation_created'),
  conditions: jsonb('conditions')
    .$type<{ bodyContains?: string[] }>()
    .notNull()
    .default({}),
  actions: jsonb('actions')
    .$type<{
      setStatus?: 'open' | 'pending' | 'snoozed' | 'closed';
      setPriority?: 'low' | 'normal' | 'high' | 'urgent';
      assignToUserId?: string | null;
      addTagIds?: string[];
    }>()
    .notNull()
    .default({}),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps,
});
