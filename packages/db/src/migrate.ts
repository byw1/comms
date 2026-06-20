import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Apply pending migrations. Runs as the web service's Railway `preDeployCommand`
 * so the schema is up to date before any container starts serving. Retries on
 * boot because Railway private DNS can lag container start by a few seconds.
 */
async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required to run migrations.');

  // migrations folder ships next to the compiled output: dist/../migrations
  const migrationsFolder = join(__dirname, '..', 'migrations');

  const maxAttempts = 8;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const pool = new pg.Pool({ connectionString, max: 1 });
    try {
      const db = drizzle(pool);
      console.log(`[migrate] applying migrations from ${migrationsFolder} (attempt ${attempt})`);
      await migrate(db, { migrationsFolder });
      console.log('[migrate] done');
      await pool.end();
      return;
    } catch (err) {
      await pool.end().catch(() => {});
      const isLast = attempt === maxAttempts;
      console.error(`[migrate] attempt ${attempt} failed:`, (err as Error).message);
      if (isLast) throw err;
      const delayMs = Math.min(1000 * 2 ** (attempt - 1), 15_000);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

main().catch((err) => {
  console.error('[migrate] fatal:', err);
  process.exit(1);
});
