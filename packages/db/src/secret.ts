import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb } from './client.js';
import { appSettings } from './schema/index.js';

const SECRET_KEY = 'app_secret';

/**
 * Return the instance's app secret, generating and persisting one on first boot
 * if it doesn't exist yet. This lets Comms run with zero required secrets — the
 * operator never has to set APP_SECRET.
 *
 * Both the web and worker processes call this and read the same DB-persisted
 * value, so the secret (used for session signing + credential encryption) is
 * consistent across services. An explicit APP_SECRET env var always takes
 * precedence and is recommended for production hardening (keeps the encryption
 * key out of the database).
 *
 * Race-safe across concurrent boots via onConflictDoNothing + re-read.
 */
export async function ensureAppSecret(): Promise<string> {
  const db = getDb();

  const existing = await db.query.appSettings.findFirst({ where: eq(appSettings.key, SECRET_KEY) });
  if (typeof existing?.value === 'string' && existing.value.length >= 16) {
    return existing.value;
  }

  const secret = randomBytes(48).toString('base64url');
  await db.insert(appSettings).values({ key: SECRET_KEY, value: secret }).onConflictDoNothing();

  // Re-read to get the canonical value if another process won the race.
  const row = await db.query.appSettings.findFirst({ where: eq(appSettings.key, SECRET_KEY) });
  return typeof row?.value === 'string' ? row.value : secret;
}
