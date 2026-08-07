import { describe, it, expect } from 'vitest';
import { conversationName, formatAddress, nameForInitials } from '../src/lib/naming';

describe('conversationName', () => {
  it('never returns an empty string when the name is blank — the blank-row bug', () => {
    // BlueBubbles sends '' for any chat the user never named.
    expect(conversationName({ contactName: '', title: '' })).not.toBe('');
    expect(conversationName({ contactName: '   ', title: '   ' })).not.toBe('');
  });

  it('falls through an empty contact name to the phone number', () => {
    expect(conversationName({ contactName: '', contactAddress: '+15551234567' })).toBe(
      '(555) 123-4567',
    );
  });

  it('prefers a real contact name above everything', () => {
    expect(
      conversationName({ contactName: 'Jordan Blake', contactAddress: '+15551234567' }),
    ).toBe('Jordan Blake');
  });

  it('shows the number rather than "Unknown" for an unnamed 1:1', () => {
    expect(conversationName({ contactAddress: '+15551234567' })).toBe('(555) 123-4567');
  });

  it('builds a name from participants for an unnamed group', () => {
    expect(
      conversationName({ isGroup: true, title: '', participants: ['Ana', 'Ben'] }),
    ).toBe('Ana, Ben');
    expect(
      conversationName({ isGroup: true, participants: ['Ana', 'Ben', 'Cal', 'Dee'] }),
    ).toBe('Ana, Ben +2');
  });

  it('uses a group title when it has one', () => {
    expect(conversationName({ isGroup: true, title: 'Weekend plans' })).toBe('Weekend plans');
  });

  it('falls back sensibly with nothing at all', () => {
    expect(conversationName({})).toBe('Unknown contact');
    expect(conversationName({ isGroup: true })).toBe('Group conversation');
  });
});

describe('formatAddress', () => {
  it('formats US numbers with and without the country code', () => {
    expect(formatAddress('+15551234567')).toBe('(555) 123-4567');
    expect(formatAddress('5551234567')).toBe('(555) 123-4567');
  });

  it('leaves emails alone', () => {
    expect(formatAddress('jordan@acme.com')).toBe('jordan@acme.com');
  });

  it('keeps international numbers recognisable', () => {
    expect(formatAddress('+442071234567')).toBe('+442071234567');
  });

  it('returns null for blank input', () => {
    expect(formatAddress('')).toBeNull();
    expect(formatAddress(null)).toBeNull();
  });
});

describe('nameForInitials', () => {
  it('uses the name when present', () => {
    expect(nameForInitials({ contactName: 'Jordan Blake' })).toBe('Jordan Blake');
  });

  it('uses trailing digits rather than a generic placeholder', () => {
    expect(nameForInitials({ contactAddress: '+15551234567' })).toBe('67');
  });
});
