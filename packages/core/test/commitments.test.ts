import { describe, it, expect } from 'vitest';
import { detectCommitment, parseDeadline } from '../src/commitments.js';

/** Wednesday 12 March 2025, 15:00 local — same anchor the web tests use. */
const SENT = new Date(2025, 2, 12, 15, 0, 0, 0);

describe('detectCommitment', () => {
  it('detects a dated promise and keeps the sentence as the excerpt', () => {
    const c = detectCommitment("Sounds good! I'll send the invoice over on Friday.", SENT);
    expect(c).not.toBeNull();
    expect(c!.excerpt).toBe("I'll send the invoice over on Friday.");
    // Friday 14 March 2025, end of business day.
    expect(c!.dueAt?.getDay()).toBe(5);
    expect(c!.dueAt?.getDate()).toBe(14);
    expect(c!.dueAt?.getHours()).toBe(18);
  });

  it('detects undated promises with a null dueAt', () => {
    const c = detectCommitment("I'll get back to you with pricing.", SENT);
    expect(c).not.toBeNull();
    expect(c!.dueAt).toBeNull();
  });

  it('accepts the full spread of intent forms', () => {
    for (const text of [
      'We will send the contract tomorrow',
      "I'm going to check with the warehouse today",
      "we're gonna have it fixed by Monday",
      'I’ll follow up next week', // curly apostrophe
    ]) {
      expect(detectCommitment(text, SENT), text).not.toBeNull();
    }
  });

  it('ignores future tense without a delivery verb', () => {
    expect(detectCommitment("I'll bet it arrives soon", SENT)).toBeNull();
    expect(detectCommitment('I will never understand this', SENT)).toBeNull();
  });

  it('ignores questions and other people’s promises', () => {
    expect(detectCommitment('Should I send it tomorrow?', SENT)).toBeNull();
    expect(detectCommitment('They said they will send it Friday', SENT)).toBeNull();
    expect(detectCommitment(null, SENT)).toBeNull();
  });

  it('finds the promise sentence inside a longer message', () => {
    const c = detectCommitment(
      'Thanks for your patience. I’ll email the tracking number tomorrow. Let me know if anything else comes up!',
      SENT,
    );
    expect(c?.excerpt).toContain('tracking number');
    expect(c?.dueAt?.getDate()).toBe(13);
  });
});

describe('parseDeadline', () => {
  it('reads relative offsets', () => {
    expect(parseDeadline('in 2 hours', SENT)?.getTime()).toBe(SENT.getTime() + 2 * 3_600_000);
    expect(parseDeadline('in 3 days', SENT)?.getTime()).toBe(SENT.getTime() + 3 * 86_400_000);
  });

  it('reads "by Friday" as this coming Friday, and same-day names as next week', () => {
    expect(parseDeadline('by friday', SENT)?.getDate()).toBe(14);
    // Sent on a Wednesday: "Wednesday" means NEXT Wednesday.
    expect(parseDeadline('on wednesday', SENT)?.getDate()).toBe(19);
  });

  it('reads eod / eow / tomorrow / next week', () => {
    expect(parseDeadline('by end of day', SENT)?.getDate()).toBe(12);
    expect(parseDeadline('by eow', SENT)?.getDate()).toBe(14);
    expect(parseDeadline('tomorrow morning', SENT)?.getDate()).toBe(13);
    expect(parseDeadline('next week', SENT)?.getDate()).toBe(19);
  });

  it('returns null when no time is named', () => {
    expect(parseDeadline('as soon as I can', SENT)).toBeNull();
  });
});
