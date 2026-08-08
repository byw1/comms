/**
 * Which folder a conversation belongs to.
 *
 * The inbox is open + pending. Snoozed and closed are FOLDERS, not badges —
 * acting on a conversation takes it out of the inbox and puts it somewhere it
 * can be found again. A snooze that leaves the thread sitting in the list is
 * just a label, and the list stops meaning "things to deal with".
 *
 * `active` is the URL value for the inbox. It stays that word so existing
 * links, saved views and search operators keep working.
 */
export const FOLDERS = [
  'active',
  'open',
  'pending',
  'snoozed',
  'closed',
  'drafts',
  'all',
] as const;

export type FolderKey = (typeof FOLDERS)[number];

export type ConversationStatus = 'open' | 'pending' | 'snoozed' | 'closed';

/** Statuses that count as "in the inbox". */
export const INBOX_STATUSES: ConversationStatus[] = ['open', 'pending'];

export function isFolderKey(value: string | null | undefined): value is FolderKey {
  return Boolean(value) && (FOLDERS as readonly string[]).includes(value!);
}

/**
 * Drafts is the one folder whose membership isn't a status — it's "you have
 * unsent text here", which can be true of an open, snoozed or closed thread
 * alike. Callers pass `hasDraft` so the predicate stays a pure function.
 */
export function matchesFolder(status: string, folder: string, hasDraft = false): boolean {
  if (folder === 'all') return true;
  if (folder === 'drafts') return hasDraft;
  if (folder === 'active') return (INBOX_STATUSES as string[]).includes(status);
  return status === folder;
}

const LABELS: Record<FolderKey, string> = {
  active: 'Inbox',
  open: 'Open',
  pending: 'Pending',
  snoozed: 'Snoozed',
  closed: 'Closed',
  drafts: 'Drafts',
  all: 'Everything',
};

export function folderLabel(folder: string): string {
  return LABELS[folder as FolderKey] ?? folder;
}
