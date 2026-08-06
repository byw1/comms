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
  };
  /** Human-readable descriptions of the operators that matched. */
  applied: string[];
}

const STATUSES = new Set(['open', 'pending', 'snoozed', 'closed', 'all', 'active']);
const PRIORITIES = new Set(['low', 'normal', 'high', 'urgent']);

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

  const qs = p.toString();
  return qs ? `/inbox?${qs}` : null;
}
