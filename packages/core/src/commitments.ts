/**
 * Detect promises in outbound messages — the raw material for nudges.
 *
 * "I'll send that over Friday" is a commitment with a deadline, and the worker
 * uses it to say "you said you'd send this Friday; that was 4 days ago". The
 * difference from a follow-up reminder is that nobody had to remember to set
 * anything: the promise itself is the reminder.
 *
 * Deliberately heuristic and deliberately conservative, like the rest of this
 * codebase's text parsing (see `parse-time` in the web app). A nudge about a
 * sentence that wasn't a promise trains people to dismiss nudges, so the
 * pattern requires a first-person future ("I'll…", "we're going to…")
 * followed closely by a delivery verb — "I'll bet" and "I will say" don't
 * qualify.
 */

export interface DetectedCommitment {
  /** The sentence containing the promise, trimmed, for display in the nudge. */
  excerpt: string;
  /**
   * When the promise falls due, or null when no time was named ("I'll send
   * that over"). Callers decide the grace period for undated promises.
   */
  dueAt: Date | null;
}

/** First-person future intent: I'll / we will / I'm going to / we're gonna. */
const INTENT =
  /\b(?:i|we)(?:['’]ll|\s+will|\s+shall|['’]m\s+going\s+to|['’]re\s+going\s+to|\s+am\s+going\s+to|\s+are\s+going\s+to|['’]m\s+gonna|['’]re\s+gonna)\s+/i;

/**
 * Delivery verbs that make a future-tense sentence a promise. "I'll bet",
 * "I'll never", "I will say" all miss this list on purpose.
 */
const DELIVERY_VERBS = [
  'send',
  'share',
  'get',
  'give',
  'update',
  'call',
  'text',
  'email',
  'confirm',
  'check',
  'follow',
  'circle',
  'look',
  'find',
  'let',
  'reach',
  'book',
  'schedule',
  'write',
  'put',
  'make',
  'finish',
  'deliver',
  'ship',
  'drop',
  'forward',
  'review',
  'have',
  'post',
  'mail',
  'invoice',
  'pay',
  'fix',
];

const VERB_RE = new RegExp(`^(?:\\w+\\s+){0,2}?(?:${DELIVERY_VERBS.join('|')})\\b`, 'i');

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const UNIT_MS: Record<string, number> = {
  minute: 60_000,
  minutes: 60_000,
  hour: 3_600_000,
  hours: 3_600_000,
  day: 86_400_000,
  days: 86_400_000,
  week: 604_800_000,
  weeks: 604_800_000,
};

/** 6pm on the given day — "by Friday" means during Friday, not at midnight. */
function endOfBusinessDay(base: Date): Date {
  const d = new Date(base);
  d.setHours(18, 0, 0, 0);
  return d;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

/** Next occurrence of a weekday strictly after `from` (same day → next week). */
function nextWeekday(from: Date, weekday: number): Date {
  const days = (weekday - from.getDay() + 7) % 7 || 7;
  return addDays(from, days);
}

/**
 * A named time inside a promise sentence, resolved against when it was sent.
 * Returns null when the sentence names no time — that is still a commitment,
 * just an undated one.
 */
export function parseDeadline(sentence: string, sentAt: Date): Date | null {
  const s = sentence.toLowerCase();

  // "in 2 hours", "in 3 days" — the most precise form wins first.
  const rel = s.match(/\bin\s+(?:a|an|(\d+))\s*(minutes?|hours?|days?|weeks?)\b/);
  if (rel) {
    const n = rel[1] ? Number(rel[1]) : 1;
    const unit = UNIT_MS[rel[2]!];
    if (unit && n > 0 && n < 1000) return new Date(sentAt.getTime() + n * unit);
  }

  // Weekday, with or without "by"/"on". "By Friday" typed on a Friday means
  // next Friday — a promise for right now would not name the day.
  const day = s.match(
    /\b(?:by|on|before|this)?\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/,
  );
  if (day) return endOfBusinessDay(nextWeekday(sentAt, WEEKDAYS[day[1]!]!));

  if (/\b(?:by\s+)?(?:end of (?:the )?week|eow)\b/.test(s)) {
    return endOfBusinessDay(nextWeekday(sentAt, 5));
  }
  if (/\b(?:by\s+)?(?:end of (?:the )?day|eod|later today|this afternoon|this evening|tonight|today)\b/.test(s)) {
    return endOfBusinessDay(sentAt);
  }
  if (/\btomorrow\b/.test(s)) return endOfBusinessDay(addDays(sentAt, 1));
  if (/\bnext week\b/.test(s)) return endOfBusinessDay(addDays(sentAt, 7));
  if (/\bthis week\b/.test(s)) return endOfBusinessDay(nextWeekday(sentAt, 5));

  return null;
}

/**
 * The first commitment in a message, or null. Scans sentence by sentence so
 * the excerpt shown in the nudge is the promise itself, not the whole text.
 */
export function detectCommitment(
  body: string | null | undefined,
  sentAt: Date,
): DetectedCommitment | null {
  const text = (body ?? '').trim();
  if (!text) return null;

  // Sentences, roughly. Newlines count as boundaries — texts rarely punctuate.
  const sentences = text.split(/(?<=[.!?])\s+|\n+/).filter(Boolean);

  for (const sentence of sentences) {
    const intent = INTENT.exec(sentence);
    if (!intent) continue;

    // The delivery verb must follow the intent closely ("I'll go ahead and
    // send it" is the loosest form that still matches).
    const rest = sentence.slice(intent.index + intent[0].length);
    if (!VERB_RE.test(rest)) continue;

    // Questions aren't promises ("should I send it tomorrow?").
    if (sentence.trimEnd().endsWith('?')) continue;

    return {
      excerpt: sentence.trim().slice(0, 200),
      dueAt: parseDeadline(sentence, sentAt),
    };
  }

  return null;
}
