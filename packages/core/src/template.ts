/**
 * Macro / auto-reply template rendering.
 *
 * Deliberately tiny: `{{path.to.value}}` lookups against a flat context, with
 * an optional `|fallback` after a pipe. No logic, no loops, no eval — a macro
 * is a message, not a program, and this text is sent to real customers.
 */

export interface TemplateContext {
  contact?: {
    name?: string | null;
    first_name?: string | null;
    company?: string | null;
    phone?: string | null;
  };
  agent?: { name?: string | null; first_name?: string | null; email?: string | null };
  ticket?: { number?: number | string | null; status?: string | null };
  inbox?: { name?: string | null };
  org?: { name?: string | null };
}

/** Every variable offered in the macro editor's helper list. */
export const TEMPLATE_VARIABLES = [
  { token: '{{contact.first_name}}', label: "Contact's first name" },
  { token: '{{contact.name}}', label: "Contact's full name" },
  { token: '{{contact.company}}', label: "Contact's company" },
  { token: '{{agent.first_name}}', label: 'Your first name' },
  { token: '{{agent.name}}', label: 'Your full name' },
  { token: '{{ticket.number}}', label: 'Ticket number' },
  { token: '{{inbox.name}}', label: 'Inbox / number name' },
  { token: '{{org.name}}', label: 'Workspace name' },
] as const;

/** Derive a first name from a full name or a raw handle. */
export function firstNameOf(name: string | null | undefined): string | null {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return null;
  // Don't slice handles into nonsense: anything with no letters is a phone
  // number in some format ("(555) 123-4567" → "(555)"), and emails aren't names.
  if (!/[a-z]/i.test(trimmed) || trimmed.includes('@')) return null;
  return trimmed.split(/\s+/)[0] ?? null;
}

function lookup(ctx: TemplateContext, path: string): string | null {
  const parts = path.split('.');
  let cur: unknown = ctx;
  for (const p of parts) {
    if (cur === null || typeof cur !== 'object') return null;
    cur = (cur as Record<string, unknown>)[p];
  }
  if (cur === null || cur === undefined || cur === '') return null;
  return String(cur);
}

/**
 * Render a template. Unresolved variables fall back to the text after `|`, or
 * to `defaultFallback` ('there' — so "Hi {{contact.first_name}}" degrades to
 * "Hi there" rather than "Hi " or "Hi {{contact.first_name}}").
 */
export function renderTemplate(
  template: string,
  ctx: TemplateContext,
  defaultFallback = 'there',
): string {
  return template.replace(/\{\{\s*([\w.]+)\s*(?:\|\s*([^}]*?)\s*)?\}\}/g, (_m, path, fallback) => {
    const value = lookup(ctx, String(path));
    if (value !== null) return value;
    return fallback !== undefined ? String(fallback) : defaultFallback;
  });
}

/** True if the text contains at least one template variable. */
export function hasTemplateVariables(text: string): boolean {
  return /\{\{\s*[\w.]+/.test(text);
}
