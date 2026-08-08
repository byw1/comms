/**
 * Text matching for find-in-conversation.
 *
 * Separate from the component so it can be tested: the reassembly property
 * below — that the highlighted runs rejoin into exactly the original string —
 * is the one that matters, because getting it wrong silently corrupts a
 * rendered message rather than failing loudly.
 */

export interface FindMatch {
  messageId: string;
  /** Index of this match within the message body. */
  offset: number;
}

/** Case-insensitive occurrences of `needle` in `haystack`. */
export function findOffsets(haystack: string, needle: string): number[] {
  if (!needle) return [];
  const hay = haystack.toLowerCase();
  const pin = needle.toLowerCase();
  const out: number[] = [];
  let from = 0;
  for (;;) {
    const at = hay.indexOf(pin, from);
    if (at === -1) return out;
    out.push(at);
    // Advance by one, not by the needle length: overlapping matches ("aa" in
    // "aaa") are still two places a person would expect to be taken to.
    from = at + 1;
  }
}

/** Split text into runs, marking the ones that match. */
export function highlightRuns(
  text: string,
  needle: string,
): Array<{ text: string; match: boolean }> {
  if (!needle) return [{ text, match: false }];
  const offsets = findOffsets(text, needle);
  if (offsets.length === 0) return [{ text, match: false }];

  const runs: Array<{ text: string; match: boolean }> = [];
  let cursor = 0;
  for (const at of offsets) {
    // Overlapping matches would double-render the same characters.
    if (at < cursor) continue;
    if (at > cursor) runs.push({ text: text.slice(cursor, at), match: false });
    runs.push({ text: text.slice(at, at + needle.length), match: true });
    cursor = at + needle.length;
  }
  if (cursor < text.length) runs.push({ text: text.slice(cursor), match: false });
  return runs;
}
