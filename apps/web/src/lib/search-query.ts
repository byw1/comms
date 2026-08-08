/**
 * Parse Superhuman/GitHub-style search operators out of a query string.
 *
 *   tag:billing status:open is:unread refund
 *   → { filters: {tags:['billing'], status:'open', unread:true}, text: 'refund' }
 *
 * Unknown operators are left in the free text rather than silently dropped —
 * a typo should search, not vanish.
 */
export interface ParsedSearch {
  text: string;
  filters: {
    tags: string[];
    status?: string;
    assignee?: string;
    priority?: string[];
    unread?: boolean;
    breaching?: boolean;
    /** has:photo | has:attachment | has:voice | has:link */
    has?: 'photo' | 'attachment' | 'voice' | 'link';
  };
  /** Human-readable descriptions of the operators that matched. */
  applied: string[];
}

const STATUSES = new Set(['open', 'pending', 'snoozed', 'closed', 'all', 'active']);
const PRIORITIES = new Set(['low', 'normal', 'high', 'urgent']);

/** `has:` values, with the plurals and synonyms people actually type. */
const HAS_ALIASES: Record<string, 'photo' | 'attachment' | 'voice' | 'link'> = {
  photo: 'photo', photos: 'photo', image: 'photo', images: 'photo', pic: 'photo', pics: 'photo',
  attachment: 'attachment', attachments: 'attachment', file: 'attachment', files: 'attachment',
  voice: 'voice', audio: 'voice', voicemail: 'voice', memo: 'voice',
  link: 'link', links: 'link', url: 'link',
};

export function parseSearchQuery(input: string): ParsedSearch {
  const filters: ParsedSearch['filters'] = { tags: [] };
  const applied: string[] = [];
  const rest: string[] = [];

  for (const token of input.split(/\s+/)) {
    if (!token) continue;
    const m = /^(\w+):(.+)$/.exec(token);
    if (!m) {
      rest.push(token);
      continue;
    }
    const key = (m[1] ?? '').toLowerCase();
    const value = (m[2] ?? '').toLowerCase();

    switch (key) {
      case 'tag':
        filters.tags.push(value);
        applied.push(`tag: ${value}`);
        break;
      case 'status':
        if (STATUSES.has(value)) {
          filters.status = value;
          applied.push(`status: ${value}`);
        } else rest.push(token);
        break;
      case 'from':
      case 'assignee':
        filters.assignee = value;
        applied.push(`${key}: ${value}`);
        break;
      case 'priority':
        if (PRIORITIES.has(value)) {
          (filters.priority ??= []).push(value);
          applied.push(`priority: ${value}`);
        } else rest.push(token);
        break;
      case 'has': {
        const kind = HAS_ALIASES[value];
        if (kind) {
          filters.has = kind;
          applied.push(`has: ${kind}`);
        } else rest.push(token);
        break;
      }
      case 'is':
        if (value === 'unread') {
          filters.unread = true;
          applied.push('unread');
        } else if (value === 'breaching' || value === 'overdue') {
          filters.breaching = true;
          applied.push('breaching SLA');
        } else rest.push(token);
        break;
      default:
        rest.push(token);
    }
  }

  return { text: rest.join(' '), filters, applied };
}

/** Turn parsed operators into an /inbox URL so Enter can jump to a filtered list. */
export function searchFiltersToHref(
  parsed: ParsedSearch,
  tagNameToId: Map<string, string>,
): string | null {
  const p = new URLSearchParams();
  const tagIds = parsed.filters.tags
    .map((name) => tagNameToId.get(name.toLowerCase()))
    .filter((v): v is string => Boolean(v));

  if (tagIds.length) p.set('tags', tagIds.join(','));
  if (parsed.filters.status && parsed.filters.status !== 'active')
    p.set('status', parsed.filters.status);
  if (parsed.filters.assignee) p.set('assignee', parsed.filters.assignee);
  if (parsed.filters.priority?.length) p.set('priority', parsed.filters.priority.join(','));
  if (parsed.filters.unread) p.set('unread', '1');
  if (parsed.filters.breaching) p.set('sla', 'breached');
  if (parsed.filters.has) p.set('has', parsed.filters.has);

  const qs = p.toString();
  return qs ? `/inbox?${qs}` : null;
}
