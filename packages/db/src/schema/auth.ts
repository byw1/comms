import {
  pgTable,
  text,
  timestamp,
  primaryKey,
  integer,
  boolean,
} from 'drizzle-orm/pg-core';
import { genId, timestamps } from './_helpers.js';
import { userRole, userStatus } from './enums.js';

/**
 * Users table. Compatible with the Auth.js Drizzle adapter (id/name/email/
 * emailVerified/image) and extended with Comms-specific columns. `hashedPassword`
 * is null for users who only use OAuth or magic-link sign-in.
 */
export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(genId('usr')),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: timestamp('email_verified', { withTimezone: true, mode: 'date' }),
  image: text('image'),
  hashedPassword: text('hashed_password'),
  role: userRole('role').notNull().default('agent'),
  status: userStatus('status').notNull().default('active'),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  ...timestamps,
});

/** OAuth provider accounts linked to a user (Auth.js adapter shape). */
export const accounts = pgTable(
  'accounts',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (account) => [primaryKey({ columns: [account.provider, account.providerAccountId] })],
);

/** Database sessions (Auth.js adapter shape). Used for OAuth / magic-link flows. */
export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true, mode: 'date' }).notNull(),
});

/** Verification tokens for magic-link email sign-in (Auth.js adapter shape). */
export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

/** Pending teammate invitations. Accepting one provisions a user. */
export const invites = pgTable('invites', {
  id: text('id').primaryKey().$defaultFn(genId('inv')),
  email: text('email').notNull(),
  role: userRole('role').notNull().default('agent'),
  token: text('token').notNull().unique(),
  invitedByUserId: text('invited_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  revoked: boolean('revoked').notNull().default(false),
  ...timestamps,
});
