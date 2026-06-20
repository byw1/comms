import { customAlphabet } from 'nanoid';
import { timestamp } from 'drizzle-orm/pg-core';

// URL-safe, lowercase + digits — readable in logs and URLs.
const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
const nano = customAlphabet(alphabet, 20);

/**
 * Generate a prefixed, sortable-ish unique id, e.g. `conv_8h2k...`.
 * Prefixes make ids self-describing across logs and the BlueBubbles bridge.
 */
export const genId = (prefix: string) => () => `${prefix}_${nano()}`;

/** Shared created/updated timestamp columns (timezone-aware). */
export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};
