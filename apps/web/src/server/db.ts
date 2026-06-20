import 'server-only';
import { getDb } from '@comms/db';

/**
 * Real Drizzle client. We pass a placeholder connection string when DATABASE_URL
 * is absent so `next build` — which imports this module while collecting routes
 * but never executes a query (all data routes are dynamic) — can construct the
 * client. The Postgres pool connects lazily on first query, so the placeholder is
 * never actually dialed. At runtime on Railway, DATABASE_URL is always present.
 */
export const db = getDb(
  process.env.DATABASE_URL ?? 'postgresql://comms:comms@127.0.0.1:5432/comms',
);

export * from '@comms/db';
