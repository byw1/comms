import 'server-only';
import { db } from './db';
import { appSettings, users, count, eq } from '@comms/db';

export interface OrgSettings {
  orgName?: string;
  supportEmail?: string;
  setupCompleted?: boolean;
}

export async function getSetting<T = unknown>(key: string): Promise<T | undefined> {
  const row = await db.query.appSettings.findFirst({ where: eq(appSettings.key, key) });
  return row?.value as T | undefined;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value } });
}

/** Setup is complete once the first admin user has been provisioned. */
export async function isSetupCompleted(): Promise<boolean> {
  const [row] = await db.select({ value: count() }).from(users);
  return Number(row?.value ?? 0) > 0;
}

export async function getOrgSettings(): Promise<OrgSettings> {
  return (await getSetting<OrgSettings>('org')) ?? {};
}
