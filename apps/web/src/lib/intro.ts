/**
 * Instant Intro: what can be said about an unknown number before you decide
 * how to answer.
 *
 * Two sources, both already in hand: the number itself (region, local time —
 * see `area-code-time`) and the first thing they wrote. People introduce
 * themselves in the first message far more often than not — "Hi, this is
 * Sarah from Acme" — and pulling that out is the single highest-value fact
 * the panel can show.
 *
 * The extraction is conservative on purpose: a wrongly "detected" name gets
 * saved onto a contact record with one click, and a wrong name on a contact
 * is worse than none. Anything ambiguous returns null.
 */

export interface SelfIntroduction {
  /** The name they called themselves, title-cased as written. */
  name: string;
  /** The company/affiliation after "from"/"with"/"at", when present. */
  company: string | null;
}

/**
 * Words that follow "this is" / "it's" without being names. Lowercase.
 * "it's fine", "this is urgent", "I'm sorry" — all real first messages.
 */
const NOT_NAMES = new Set([
  'a',
  'an',
  'the',
  'me',
  'us',
  'urgent',
  'important',
  'regarding',
  'about',
  'fine',
  'ok',
  'okay',
  'great',
  'good',
  'bad',
  'sorry',
  'just',
  'so',
  'not',
  'very',
  'really',
  'still',
  'crazy',
  'ridiculous',
  'unacceptable',
  'wrong',
  'awesome',
  'perfect',
  'interested',
  'wondering',
  'writing',
  'reaching',
  'following',
  'checking',
  'calling',
  'texting',
  'trying',
  'happy',
  'glad',
  'confused',
  'here',
  'there',
  'now',
  'why',
  'what',
  'who',
  'when',
  'how',
]);

// Company: a run of up to four Capitalized words — greedy enough for "Acme
// Roofing Co", conservative enough to stop before the rest of the sentence.
// The regex is case-insensitive so "It's Jordan" matches; the code below
// re-checks that the captured name/company are actually capitalized, which is
// what separates "this is Sarah" from "this is fine".
const INTRO_RE =
  /\b(?:my name is|my name's|this is|it['’]s|i am|i['’]m)\s+([A-Z][a-zA-Z'’-]+(?:\s+(?!(?:from|with|at|of)\b)[A-Z][a-zA-Z'’.-]+)?)(?:\s*,?\s+(?:from|with|at|of)\s+([A-Z0-9][\w&'’.-]*(?:\s+[A-Z0-9][\w&'’.-]*){0,3}))?/i;

const CAPITALIZED = /^[A-Z0-9]/;

/**
 * The name (and company, if stated) someone used to introduce themselves in
 * `text`, or null when no confident introduction is present.
 */
export function extractSelfIntroduction(text: string | null | undefined): SelfIntroduction | null {
  const body = (text ?? '').trim();
  if (!body) return null;

  // Only trust the opening of the message: an introduction is how a message
  // starts, and matching deep into a paragraph is where false positives live.
  const head = body.slice(0, 240);
  const m = INTRO_RE.exec(head);
  if (!m) return null;

  // Keep only the leading run of Capitalized words — under the /i flag the
  // capture can pick up a lowercase continuation ("Priya and"), and lowercase
  // means the name ended. No capitalized words at all means it wasn't a name.
  const capWords: string[] = [];
  for (const w of m[1]!.trim().split(/\s+/)) {
    if (!/^[A-Z]/.test(w)) break;
    capWords.push(w);
  }
  if (capWords.length === 0) return null;
  const name = capWords.join(' ');

  const first = name.split(/\s+/)[0]!.toLowerCase();
  if (NOT_NAMES.has(first)) return null;
  // A name that is ALL CAPS is shouting, not a name ("THIS IS UNACCEPTABLE").
  if (name === name.toUpperCase() && name.length > 3) return null;

  let company = m[2]?.trim().replace(/[.,;:!?]+$/, '') || null;
  if (company && !CAPITALIZED.test(company)) company = null;
  return { name, company };
}

/** Friendly label for an IANA zone from `area-code-time`. */
const ZONE_LABELS: Record<string, string> = {
  'America/Los_Angeles': 'Pacific time',
  'America/Denver': 'Mountain time',
  'America/Phoenix': 'Arizona',
  'America/Chicago': 'Central time',
  'America/New_York': 'Eastern time',
  'America/Anchorage': 'Alaska',
  'Pacific/Honolulu': 'Hawaii',
};

export function zoneLabel(zone: string | null): string | null {
  if (!zone) return null;
  return ZONE_LABELS[zone] ?? null;
}
