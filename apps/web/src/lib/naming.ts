/**
 * One place that decides what a conversation is called.
 *
 * Previously each surface did `contact?.displayName ?? title ?? 'Unknown'`,
 * which is subtly wrong: `??` only falls through on null/undefined, and
 * BlueBubbles sends an EMPTY STRING as the display name for any chat the user
 * never named — which is most of them. The chain returned '' and the row
 * rendered blank.
 */

/** Treat empty and whitespace-only strings as absent. */
function present(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Human-readable form of a raw handle. A phone number is a perfectly good
 * label when we have no name — far better than "Unknown".
 */
export function formatAddress(address: string | null | undefined): string | null {
  const raw = present(address);
  if (!raw) return null;
  if (raw.includes('@')) return raw;

  const digits = raw.replace(/\D/g, '');
  // US/Canada, with or without the country code.
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  // Anything else: keep the leading + so it reads as a phone number.
  return raw.startsWith('+') ? raw : digits.length > 6 ? `+${digits}` : raw;
}

export interface NameableConversation {
  contactName?: string | null;
  /** The contact's first known address, used when there's no name. */
  contactAddress?: string | null;
  title?: string | null;
  isGroup?: boolean | null;
  /** Group participant names/addresses, for building "Ana, Ben +2". */
  participants?: Array<string | null | undefined>;
}

/** The label to show for a conversation. Never returns an empty string. */
export function conversationName(c: NameableConversation): string {
  const contactName = present(c.contactName);
  if (contactName) return contactName;

  const title = present(c.title);

  if (c.isGroup) {
    if (title) return title;
    const names = (c.participants ?? [])
      .map((p) => present(p) && (formatAddress(p) ?? present(p)))
      .filter((p): p is string => Boolean(p));
    if (names.length === 1) return names[0]!;
    if (names.length === 2) return `${names[0]}, ${names[1]}`;
    if (names.length > 2) return `${names[0]}, ${names[1]} +${names.length - 2}`;
    return 'Group conversation';
  }

  // A phone number beats a generic placeholder for a 1:1 thread.
  const address = formatAddress(c.contactAddress);
  if (address) return address;
  if (title) return title;
  return 'Unknown contact';
}

/** Initials source — avoids "UN" for every unnamed thread. */
export function nameForInitials(c: NameableConversation): string {
  const contactName = present(c.contactName);
  if (contactName) return contactName;
  const digits = present(c.contactAddress)?.replace(/\D/g, '');
  // Last two digits read better than "UN" repeated down the list.
  if (digits && digits.length >= 2) return digits.slice(-2);
  return present(c.title) ?? '?';
}
