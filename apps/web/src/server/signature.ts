import 'server-only';
import { eq, users, inboxes } from '@comms/db';
import { db } from '@/server/db';
import { getSetting } from '@/server/settings';

/**
 * Signature resolution: workspace switch → personal signature → inbox
 * signature.
 *
 * The workspace toggle exists so a team that finds signatures noisy over
 * iMessage can turn the whole mechanism off in one place; it defaults to ON
 * because with no signatures written anywhere it changes nothing. A person's
 * own signature beats the inbox one — the inbox signature is the fallback
 * identity of the number, the personal one is the identity of whoever is
 * actually typing.
 */

export interface SignatureWorkspaceSettings {
  enabled?: boolean;
}

export async function signaturesEnabled(): Promise<boolean> {
  const s = await getSetting<SignatureWorkspaceSettings>('signatures');
  return s?.enabled !== false;
}

/** The signature that would be appended for this user in this inbox, or null. */
export async function resolveSignature(
  userId: string,
  inboxId: string,
): Promise<string | null> {
  if (!(await signaturesEnabled())) return null;

  const [user, inbox] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, userId), columns: { preferences: true } }),
    db.query.inboxes.findFirst({ where: eq(inboxes.id, inboxId), columns: { settings: true } }),
  ]);

  const personal = user?.preferences?.signature?.trim();
  if (personal) return personal;
  const perInbox = inbox?.settings?.signature?.trim();
  return perInbox || null;
}

/**
 * Append a signature to an outgoing body. Skips itself when the person
 * already typed the signature (or the body ends with it) — nobody should be
 * signed twice because they signed once by hand.
 */
export function appendSignature(body: string, signature: string | null): string {
  const sig = signature?.trim();
  if (!sig) return body;
  if (body.trimEnd().endsWith(sig)) return body;
  return `${body.trimEnd()}\n\n${sig}`;
}
