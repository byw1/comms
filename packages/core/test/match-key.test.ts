import { describe, it, expect } from 'vitest';
import { phoneMatchKey, matchKeyForAddress } from '../src/bluebubbles/helpers.js';

describe('phone matching across iMessage and the Mac address book', () => {
  it('matches E.164 against national format — the bug that broke contact sync', () => {
    // iMessage hands us the first; Contacts.app stores the second.
    expect(matchKeyForAddress('+15551234567')).toBe(matchKeyForAddress('(555) 123-4567'));
  });

  it('matches every common US formatting variant', () => {
    const variants = [
      '+1 555 123 4567',
      '555-123-4567',
      '(555) 123-4567',
      '5551234567',
      '+15551234567',
      '1-555-123-4567',
    ];
    const keys = new Set(variants.map(matchKeyForAddress));
    expect(keys.size).toBe(1);
  });

  it('matches international numbers with and without the plus', () => {
    expect(matchKeyForAddress('+442071234567')).toBe(matchKeyForAddress('442071234567'));
  });

  it('does NOT collapse genuinely different numbers', () => {
    expect(matchKeyForAddress('+15551234567')).not.toBe(matchKeyForAddress('+15559999999'));
  });

  it('keeps emails case-insensitive but distinct from phones', () => {
    expect(matchKeyForAddress('Jordan@Acme.com')).toBe(matchKeyForAddress('jordan@acme.com'));
    expect(matchKeyForAddress('jordan@acme.com')).not.toBe(matchKeyForAddress('+15551234567'));
  });

  it('returns null for fragments too short to identify anyone', () => {
    expect(phoneMatchKey('12345')).toBeNull();
    expect(phoneMatchKey('')).toBeNull();
  });

  it('uses the last 10 digits so a country code cannot split a person', () => {
    expect(phoneMatchKey('+15551234567')).toBe('5551234567');
    expect(phoneMatchKey('5551234567')).toBe('5551234567');
  });
});
