import { pgTable, text, primaryKey } from 'drizzle-orm/pg-core';
import { genId, timestamps } from './_helpers.js';
import { users } from './auth.js';

/** A group of agents that conversations can be routed to / assigned to. */
export const teams = pgTable('teams', {
  id: text('id').primaryKey().$defaultFn(genId('team')),
  name: text('name').notNull(),
  color: text('color').notNull().default('#71717a'),
  description: text('description'),
  ...timestamps,
});

export const teamMembers = pgTable(
  'team_members',
  {
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (tm) => [primaryKey({ columns: [tm.teamId, tm.userId] })],
);
