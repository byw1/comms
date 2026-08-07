import { getDb, eq, and, isNull, sql } from '@comms/db';
import {
  contacts,
  contactIdentities,
  conversations,
  conversationParticipants,
} from '@comms/db';
import {
  type BBChat,
  type BBHandle,
  addressFromChatGuid,
  normalizeAddress,
  logger,
} from '@comms/core';

const log = logger.child({ module: 'participants' });

export interface ResolvedContact {
  contactId: string;
  identityId: string;
}

/**
 * Find-or-create a contact for an iMessage handle address, returning both the
 * contact and the identity row so callers can also record participation.
 */
export async function resolveContact(
  address: string,
  displayName?: string | null,
): Promise<ResolvedContact | null> {
  const db = getDb();
  if (!address?.trim()) return null;
  const norm = normalizeAddress(address);

  const existing = await db.query.contactIdentities.findFirst({
    where: and(eq(contactIdentities.kind, norm.kind), eq(contactIdentities.value, norm.value)),
  });
  if (existing) return { contactId: existing.contactId, identityId: existing.id };

  const [contact] = await db
    .insert(contacts)
    // Fall back to the address when the chat has no (or an empty) display name.
    .values({ displayName: displayName?.trim() || norm.raw })
    .returning({ id: contacts.id });
  if (!contact) return null;

  const [identity] = await db
    .insert(contactIdentities)
    .values({ contactId: contact.id, kind: norm.kind, value: norm.value, rawValue: norm.raw })
    .onConflictDoNothing()
    .returning({ id: contactIdentities.id });

  if (identity) return { contactId: contact.id, identityId: identity.id };

  // Lost a race — another worker inserted the same identity. Read it back.
  const raced = await db.query.contactIdentities.findFirst({
    where: and(eq(contactIdentities.kind, norm.kind), eq(contactIdentities.value, norm.value)),
  });
  return raced ? { contactId: raced.contactId, identityId: raced.id } : null;
}

/**
 * Every address that belongs to a chat, newest source first.
 *
 * The chat's own participant list is authoritative. The GUID is the fallback
 * that always works for a 1:1, because the address is literally part of it.
 */
export function addressesForChat(chatGuid: string, chat?: BBChat | null): string[] {
  const fromChat = (chat?.participants ?? [])
    .map((p: BBHandle) => p?.address)
    .filter((a): a is string => typeof a === 'string' && a.trim().length > 0);
  if (fromChat.length) return fromChat;

  const fromGuid = addressFromChatGuid(chatGuid);
  return fromGuid ? [fromGuid] : [];
}

/**
 * The contact a direct conversation belongs to.
 *
 * Deliberately independent of any message. Outbound messages carry no handle,
 * so deriving the contact from `message.handle` meant a thread whose first
 * ingested message was one we sent got `contact_id = null` — and nothing ever
 * backfilled it. That thread then rendered as "Unknown contact" with "No
 * contact info" forever, even though its address was sitting in the chat GUID
 * we had stored all along.
 *
 * Groups return null on purpose: a group has participants, not a counterparty.
 */
export async function resolveConversationContact(
  chatGuid: string,
  chat?: BBChat | null,
): Promise<string | null> {
  const addresses = addressesForChat(chatGuid, chat);
  // A group's counterparty is ambiguous; participants are recorded separately.
  if (addresses.length !== 1) return null;
  const resolved = await resolveContact(addresses[0]!, chat?.displayName);
  return resolved?.contactId ?? null;
}

/**
 * Record who is in a conversation. Populates the participants table for groups
 * as well as 1:1s, so a group can be named after its members instead of
 * "Group conversation".
 */
export async function linkParticipants(
  conversationId: string,
  chatGuid: string,
  chat?: BBChat | null,
): Promise<void> {
  const db = getDb();
  const addresses = addressesForChat(chatGuid, chat);
  if (!addresses.length) return;

  for (const address of addresses) {
    const resolved = await resolveContact(address).catch(() => null);
    if (!resolved) continue;
    await db
      .insert(conversationParticipants)
      .values({ conversationId, contactIdentityId: resolved.identityId })
      .onConflictDoNothing();
  }
}

/**
 * Attach a contact to direct conversations that never got one.
 *
 * These are threads where every message we ingested was outbound, so no handle
 * was ever available. The address comes out of the stored chat GUID, which
 * means this needs no network call and can run at boot.
 */
export async function repairContactlessConversations(): Promise<number> {
  const db = getDb();
  const orphans = await db
    .select({ id: conversations.id, guid: conversations.providerChatGuid })
    .from(conversations)
    .where(and(isNull(conversations.contactId), eq(conversations.isGroup, false)))
    .limit(2000);

  let linked = 0;
  for (const row of orphans) {
    const address = addressFromChatGuid(row.guid);
    if (!address) continue;
    const resolved = await resolveContact(address).catch(() => null);
    if (!resolved) continue;
    await db
      .update(conversations)
      .set({ contactId: resolved.contactId })
      .where(and(eq(conversations.id, row.id), isNull(conversations.contactId)));
    await db
      .insert(conversationParticipants)
      .values({ conversationId: row.id, contactIdentityId: resolved.identityId })
      .onConflictDoNothing();
    linked += 1;
  }

  if (orphans.length) {
    log.info(
      { found: orphans.length, linked, unresolvable: orphans.length - linked },
      'repaired conversations with no contact',
    );
  }
  return linked;
}

/**
 * Backfill the participants table for conversations that predate it, so group
 * threads can be named after their members.
 */
export async function backfillParticipants(limit = 500): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ id: conversations.id, guid: conversations.providerChatGuid })
    .from(conversations)
    .where(
      sql`not exists (select 1 from ${conversationParticipants} cp where cp.conversation_id = ${conversations.id})`,
    )
    .limit(limit);

  let filled = 0;
  for (const row of rows) {
    // No chat object here — the GUID only yields participants for a 1:1. Group
    // membership arrives with the next message or backfill sweep, which do
    // carry the chat.
    const before = await db
      .select({ n: sql<number>`count(*)` })
      .from(conversationParticipants)
      .where(eq(conversationParticipants.conversationId, row.id));
    await linkParticipants(row.id, row.guid, null);
    const after = await db
      .select({ n: sql<number>`count(*)` })
      .from(conversationParticipants)
      .where(eq(conversationParticipants.conversationId, row.id));
    if (Number(after[0]?.n ?? 0) > Number(before[0]?.n ?? 0)) filled += 1;
  }

  if (filled) log.info({ scanned: rows.length, filled }, 'backfilled conversation participants');
  return filled;
}
