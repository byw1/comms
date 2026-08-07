/** Parse a BlueBubbles chat GUID like `iMessage;-;+15551234567`. */
export function parseChatGuid(guid: string): {
  service: string;
  isGroup: boolean;
  identifier: string;
} {
  const parts = guid.split(';');
  const service = parts[0] ?? 'iMessage';
  const type = parts[1] ?? '-';
  const identifier = parts.slice(2).join(';');
  return { service, isGroup: type === '+', identifier };
}

/**
 * The other party's address for a direct chat, read out of the chat GUID.
 *
 * A GUID is `service;type;identifier`, and for a 1:1 chat the identifier IS the
 * handle — `iMessage;-;+15551234567`. That means a conversation can always name
 * who it's with, even when every message we've seen is outbound (outbound
 * messages carry no handle at all).
 *
 * Group GUIDs carry an opaque `chat123456` id instead of an address, so they
 * return null — a group has participants, not a single counterparty.
 */
export function addressFromChatGuid(guid: string): string | null {
  const { isGroup, identifier } = parseChatGuid(guid);
  if (isGroup) return null;
  const id = identifier.trim();
  if (!id) return null;
  // Some direct chats still carry a chat-style identifier; it isn't an address.
  if (/^chat\d+$/i.test(id)) return null;
  return id;
}

export type NormalizedIdentity = {
  kind: 'phone' | 'email' | 'handle';
  value: string;
  raw: string;
};

/**
 * Normalize an iMessage handle address into a stable identity key. Emails are
 * lowercased; phone numbers are reduced to digits with a leading `+`. Anything
 * else is kept as an opaque handle.
 */
export function normalizeAddress(address: string): NormalizedIdentity {
  const raw = address.trim();
  if (raw.includes('@')) {
    return { kind: 'email', value: raw.toLowerCase(), raw };
  }
  const digits = raw.replace(/[^\d+]/g, '');
  if (/^\+?\d{6,}$/.test(digits)) {
    const value = digits.startsWith('+') ? digits : `+${digits}`;
    return { kind: 'phone', value, raw };
  }
  return { kind: 'handle', value: raw, raw };
}

/**
 * A key for deciding whether two addresses are the same person.
 *
 * Storage normalization isn't enough on its own: iMessage hands us E.164
 * (`+15551234567`) while the Mac's address book stores national format
 * (`(555) 123-4567` → `+5551234567`). Comparing those literally never matches,
 * which silently breaks every contact join. Phone numbers therefore match on
 * their last 10 significant digits — enough to identify a person, short enough
 * to survive country-code and formatting differences.
 */
export function phoneMatchKey(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 7) return null;
  return digits.slice(-10);
}

/** Comparable key for any normalized identity. */
export function addressMatchKey(identity: NormalizedIdentity): string {
  if (identity.kind === 'phone') {
    return `phone:${phoneMatchKey(identity.value) ?? identity.value}`;
  }
  return `${identity.kind}:${identity.value.toLowerCase()}`;
}

/** Convenience: match key straight from a raw address string. */
export function matchKeyForAddress(raw: string): string {
  return addressMatchKey(normalizeAddress(raw));
}

/** Convert a BlueBubbles ms timestamp into a Date (or null for 0 / undefined). */
export function bbDate(ms: number | undefined | null): Date | null {
  if (!ms || ms <= 0) return null;
  return new Date(ms);
}

/** Map a BlueBubbles `associatedMessageType` code to a friendly reaction name. */
export function reactionFromAssociatedType(type: number | string | null | undefined): string | null {
  if (type === null || type === undefined) return null;
  const n = typeof type === 'string' ? parseInt(type, 10) : type;
  const map: Record<number, string> = {
    2000: 'love',
    2001: 'like',
    2002: 'dislike',
    2003: 'laugh',
    2004: 'emphasize',
    2005: 'question',
    3000: '-love',
    3001: '-like',
    3002: '-dislike',
    3003: '-laugh',
    3004: '-emphasize',
    3005: '-question',
  };
  return map[n] ?? null;
}
