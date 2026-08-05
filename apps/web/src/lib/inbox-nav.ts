/**
 * Tiny module-level registry of the conversation ids currently visible in the
 * list pane, in display order. The list pane writes it on every filter change;
 * the global keyboard handler reads it for j/k navigation and close-advance.
 * A singleton (not context) because the two components live in different
 * layout subtrees.
 */
let visibleIds: string[] = [];

export function setVisibleConversationIds(ids: string[]) {
  visibleIds = ids;
}

export function getVisibleConversationIds(): string[] {
  return visibleIds;
}

/** The id j/k should move to, relative to the currently open conversation. */
export function siblingConversationId(
  activeId: string | null,
  direction: 1 | -1,
): string | null {
  if (visibleIds.length === 0) return null;
  if (!activeId) return visibleIds[0] ?? null;
  const idx = visibleIds.indexOf(activeId);
  if (idx === -1) return visibleIds[0] ?? null;
  return visibleIds[idx + direction] ?? null;
}
