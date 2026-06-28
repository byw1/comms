/**
 * Runs once when the server process starts, before any request is handled.
 * If no APP_SECRET/AUTH_SECRET is provided, we generate and persist one in the
 * database so the operator never has to set a secret — making DATABASE_URL and
 * REDIS_URL the only required configuration.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.APP_SECRET || process.env.AUTH_SECRET) return;
  if (!process.env.DATABASE_URL) return; // nothing to derive from; config will error clearly

  try {
    const { ensureAppSecret } = await import('@comms/db');
    process.env.APP_SECRET = await ensureAppSecret();
  } catch (err) {
    console.error('[comms] could not initialize APP_SECRET from the database:', err);
  }
}
