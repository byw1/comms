import { getDb, eq, and, inArray, isNull, sql } from '@comms/db';
import { contacts, contactIdentities, channelConnections } from '@comms/db';
import {
  type BBContact,
  normalizeAddress,
  putObject,
  isStorageEnabled,
  logger,
} from '@comms/core';
import { loadConnection } from './connection.js';

const log = logger.child({ module: 'contacts' });

/** Guard against a malicious or corrupt avatar blowing up object storage. */
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/** Base64 has no mime type attached, so sniff the signature. */
function avatarMime(base64: string): string {
  if (base64.startsWith('/9j/')) return 'image/jpeg';
  if (base64.startsWith('iVBORw0KGgo')) return 'image/png';
  if (base64.startsWith('R0lGOD')) return 'image/gif';
  return 'image/jpeg';
}

/** Best display name we can build from a BlueBubbles contact record. */
function displayNameOf(c: BBContact): string | null {
  const full = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
  return (c.displayName?.trim() || full || c.nickname?.trim() || null) ?? null;
}

/** Every usable address on a contact, normalized for matching. */
function addressesOf(c: BBContact) {
  return [...(c.phoneNumbers ?? []), ...(c.emails ?? [])]
    .map((a) => a.address)
    .filter((a): a is string => typeof a === 'string' && a.trim().length > 0)
    .map((a) => normalizeAddress(a));
}

/**
 * True when a contact's name is just its own address — i.e. a placeholder
 * created by `resolveContact()` during ingest, safe to overwrite with a real
 * name from the address book.
 */
function isPlaceholderName(name: string | null, addresses: string[]): boolean {
  if (!name) return true;
  const n = name.trim().toLowerCase();
  return addresses.some((a) => a.toLowerCase() === n) || /^\+?[\d\s()\-.]+$/.test(n);
}

export interface ContactSyncResult {
  fetched: number;
  enriched: number;
  created: number;
  skippedCollisions: number;
  macContactsVisible: boolean;
}

/**
 * Pull the Mac's address book into Comms.
 *
 * Merge policy, deliberately conservative: we ENRICH existing contacts (fill
 * in a real name/avatar where we only had a phone number) and CREATE contacts
 * for addresses we've never seen. We never merge two existing Comms contacts
 * together — that's destructive and unreversible, so collisions are counted
 * and logged for a future manual-merge UI instead.
 */
export async function syncContacts(connectionId: string): Promise<ContactSyncResult> {
  const db = getDb();
  const { client } = await loadConnection(connectionId);

  // Two passes: the roster is fast, avatars are slow (base64-inlined), so they
  // come in batches rather than one enormous request that would time out.
  const roster = await client.listContacts({ withAvatars: false });
  log.info({ connectionId, count: roster.length }, 'contact roster fetched');

  const result: ContactSyncResult = {
    fetched: roster.length,
    enriched: 0,
    created: 0,
    skippedCollisions: 0,
    // If macOS Contacts permission was never granted, the 'api' half is empty
    // and we'd silently sync almost nothing — surface that to the operator.
    macContactsVisible: roster.some((c) => c.sourceType === 'api'),
  };

  // Dedupe by normalized address, preferring the macOS ('api') record: it's
  // the one carrying nickname/birthday. BlueBubbles returns the same human
  // twice with no cross-source dedup.
  const byAddress = new Map<string, BBContact>();
  for (const c of roster) {
    for (const addr of addressesOf(c)) {
      const existing = byAddress.get(addr.value);
      if (!existing || (c.sourceType === 'api' && existing.sourceType !== 'api')) {
        byAddress.set(addr.value, c);
      }
    }
  }

  // Which of these addresses do we already know?
  const allValues = Array.from(byAddress.keys());
  const known = allValues.length
    ? await db
        .select({
          value: contactIdentities.value,
          contactId: contactIdentities.contactId,
          displayName: contacts.displayName,
          avatarUrl: contacts.avatarUrl,
        })
        .from(contactIdentities)
        .innerJoin(contacts, eq(contacts.id, contactIdentities.contactId))
        .where(inArray(contactIdentities.value, allValues))
    : [];
  const knownByValue = new Map(known.map((k) => [k.value, k]));

  // Avatars only for contacts we'll actually touch, in batches of 50.
  const wantAvatars = Array.from(byAddress.entries())
    .filter(([value, c]) => {
      const k = knownByValue.get(value);
      if (!k) return true; // new contact
      return !k.avatarUrl || isPlaceholderName(k.displayName, [value]);
    })
    .map(([value]) => value);

  const avatarByAddress = new Map<string, string>();
  if (isStorageEnabled() && wantAvatars.length) {
    for (let i = 0; i < wantAvatars.length; i += 50) {
      const batch = wantAvatars.slice(i, i + 50);
      try {
        const detailed = await client.queryContacts(batch, { withAvatars: true });
        for (const c of detailed) {
          if (!c.avatar) continue;
          for (const a of addressesOf(c)) avatarByAddress.set(a.value, c.avatar);
        }
      } catch (err) {
        log.warn({ err: (err as Error).message }, 'avatar batch failed; continuing without');
      }
    }
  }

  /** Store an avatar in S3 and return its key, or null. */
  async function storeAvatar(contactId: string, base64: string): Promise<string | null> {
    try {
      const bytes = Buffer.from(base64, 'base64');
      if (bytes.length === 0 || bytes.length > MAX_AVATAR_BYTES) return null;
      const mime = avatarMime(base64);
      const key = `avatars/${contactId}.${mime === 'image/png' ? 'png' : 'jpg'}`;
      await putObject(key, bytes, mime);
      return key;
    } catch (err) {
      log.warn({ err: (err as Error).message }, 'avatar upload failed');
      return null;
    }
  }

  const now = new Date();

  for (const [value, bb] of byAddress) {
    const name = displayNameOf(bb);
    const existing = knownByValue.get(value);

    if (existing) {
      const patch: Partial<typeof contacts.$inferInsert> = { syncedAt: now };
      // Only overwrite a name that's really just the raw address.
      if (name && isPlaceholderName(existing.displayName, [value])) {
        patch.displayName = name;
      }
      if (!existing.avatarUrl && avatarByAddress.has(value)) {
        const key = await storeAvatar(existing.contactId, avatarByAddress.get(value)!);
        if (key) {
          patch.avatarStorageKey = key;
          patch.avatarUrl = `/api/avatars/${existing.contactId}`;
        }
      }
      if (Object.keys(patch).length > 1) {
        await db.update(contacts).set(patch).where(eq(contacts.id, existing.contactId));
        result.enriched += 1;
      }
      continue;
    }

    // Unknown address → create a contact, unless one of this person's OTHER
    // addresses already maps to a Comms contact (in which case just attach).
    const siblings = addressesOf(bb)
      .map((a) => knownByValue.get(a.value)?.contactId)
      .filter((id): id is string => Boolean(id));
    const uniqueSiblings = Array.from(new Set(siblings));

    if (uniqueSiblings.length > 1) {
      // This address book entry spans two existing Comms contacts. Merging
      // them automatically would be destructive — leave for a manual UI.
      result.skippedCollisions += 1;
      log.info({ value, contactIds: uniqueSiblings }, 'contact collision; not auto-merging');
      continue;
    }

    let contactId = uniqueSiblings[0];
    if (!contactId) {
      if (!name) continue; // nothing worth creating a record for
      const [created] = await db
        .insert(contacts)
        .values({ displayName: name, syncedAt: now })
        .returning({ id: contacts.id });
      if (!created) continue;
      contactId = created.id;
      result.created += 1;

      const avatar = avatarByAddress.get(value);
      if (avatar) {
        const key = await storeAvatar(contactId, avatar);
        if (key) {
          await db
            .update(contacts)
            .set({ avatarStorageKey: key, avatarUrl: `/api/avatars/${contactId}` })
            .where(eq(contacts.id, contactId));
        }
      }
    }

    const norm = normalizeAddress(value);
    await db
      .insert(contactIdentities)
      .values({ contactId, kind: norm.kind, value: norm.value, rawValue: norm.raw })
      .onConflictDoNothing();
  }

  await db
    .update(channelConnections)
    .set({ contactsSyncedAt: now })
    .where(eq(channelConnections.id, connectionId));

  log.info({ connectionId, ...result }, 'contact sync complete');
  return result;
}
