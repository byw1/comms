import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema/index.js';

export type Database = NodePgDatabase<typeof schema>;

let pool: pg.Pool | undefined;
let dbInstance: Database | undefined;

/**
 * Lazily create a singleton pooled Drizzle client. Reused across the web and
 * worker processes. Connection retries are handled by callers on startup
 * because Railway private DNS may not be ready the instant the container boots.
 */
export function getDb(connectionString = process.env.DATABASE_URL): Database {
  if (dbInstance) return dbInstance;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Comms cannot connect to Postgres.');
  }
  pool = new pg.Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    // Railway envs created before 2025-10-16 are IPv6-only on the private network.
    // node-postgres resolves via the connection string host; no extra flag needed,
    // but keep statement timeouts sane for a responsive UI.
    statement_timeout: 30_000,
  });
  dbInstance = drizzle(pool, { schema, casing: 'snake_case' });
  return dbInstance;
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
  dbInstance = undefined;
}

export { schema };
