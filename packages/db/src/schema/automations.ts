import { pgTable, text, boolean, integer, jsonb, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { genId, timestamps } from './_helpers.js';
import type { ConversationActions } from './macros.js';

export const automationTrigger = pgEnum('automation_trigger', [
  'conversation_created',
  'message_received',
]);

/** All conditions are ANDed. An empty object always matches. */
export interface AutomationConditions {
  /** Any keyword present in the message body (OR within the list). */
  bodyContains?: string[];
  /** Restrict to one inbox / number. */
  inboxId?: string;
  /** Conversation must already carry ALL of these tags. */
  hasTagIds?: string[];
  /** Conversation's current priority is one of these. */
  priorityIn?: Array<'low' | 'normal' | 'high' | 'urgent'>;
  /** Only the contact's very first conversation with us, or only returning contacts. */
  contactIs?: 'first_time' | 'returning';
  /** Inside or outside the workspace business hours (see app_settings 'business_hours'). */
  businessHours?: 'inside' | 'outside';
}

export interface AutomationActions extends ConversationActions {
  /** Send this text back to the customer. Loop-guarded; respects STOP opt-outs. */
  autoReply?: string;
  /** Snooze the conversation for N minutes. */
  snoozeMinutes?: number;
  /** Override the first/next response SLA for this conversation, in minutes. */
  slaMinutes?: number;
}

/**
 * A no-code automation: when {trigger} fires and all {conditions} match, apply
 * {actions} to the conversation. Evaluated by the worker on inbound events, in
 * sortOrder; a matching rule with `stopProcessing` halts the chain.
 */
export const automationRules = pgTable('automation_rules', {
  id: text('id').primaryKey().$defaultFn(genId('rule')),
  name: text('name').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  trigger: automationTrigger('trigger').notNull().default('conversation_created'),
  conditions: jsonb('conditions').$type<AutomationConditions>().notNull().default({}),
  actions: jsonb('actions').$type<AutomationActions>().notNull().default({}),
  /** When this rule matches, skip all lower-priority rules for this event. */
  stopProcessing: boolean('stop_processing').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),

  // Observability — rules that fire silently are rules nobody trusts.
  fireCount: integer('fire_count').notNull().default(0),
  lastFiredAt: timestamp('last_fired_at', { withTimezone: true }),
  lastConversationNumber: integer('last_conversation_number'),

  ...timestamps,
});
