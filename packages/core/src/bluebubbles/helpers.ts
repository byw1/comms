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
