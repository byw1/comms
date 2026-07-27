import { describe, it, expect } from 'vitest';
import {
  normalizeAddress,
  parseChatGuid,
  reactionFromAssociatedType,
  bbDate,
} from '../src/bluebubbles/helpers';

describe('normalizeAddress', () => {
  it('lowercases emails', () => {
    expect(normalizeAddress('Foo@Bar.COM')).toMatchObject({ kind: 'email', value: 'foo@bar.com' });
  });

  it('normalizes phone numbers to +digits', () => {
    expect(normalizeAddress('(555) 123-4567')).toMatchObject({
      kind: 'phone',
      value: '+5551234567',
    });
  });

  it('preserves an existing leading +', () => {
    expect(normalizeAddress('+1 555 123 4567').value).toBe('+15551234567');
  });

  it('falls back to an opaque handle', () => {
    expect(normalizeAddress('some.random.handle').kind).toBe('handle');
  });

  it('keeps the raw value for reference', () => {
    expect(normalizeAddress('  +15551234567 ').raw).toBe('+15551234567');
  });
});

describe('parseChatGuid', () => {
  it('parses an individual iMessage chat', () => {
    expect(parseChatGuid('iMessage;-;+15551234567')).toEqual({
      service: 'iMessage',
      isGroup: false,
      identifier: '+15551234567',
    });
  });

  it('detects a group chat via the + type', () => {
    expect(parseChatGuid('iMessage;+;chat123456')).toMatchObject({ isGroup: true });
  });

  it('handles the newer `any` service prefix', () => {
    expect(parseChatGuid('any;-;+15551234567').service).toBe('any');
  });

  it('keeps emails with special chars intact in the identifier', () => {
    expect(parseChatGuid('iMessage;-;person@icloud.com').identifier).toBe('person@icloud.com');
  });
});

describe('reactionFromAssociatedType', () => {
  it('maps add-reaction codes', () => {
    expect(reactionFromAssociatedType(2000)).toBe('love');
    expect(reactionFromAssociatedType(2003)).toBe('laugh');
  });

  it('maps remove-reaction codes with a - prefix', () => {
    expect(reactionFromAssociatedType(3002)).toBe('-dislike');
  });

  it('accepts numeric strings', () => {
    expect(reactionFromAssociatedType('2001')).toBe('like');
  });

  it('returns null for non-reaction / missing types', () => {
    expect(reactionFromAssociatedType(null)).toBeNull();
    expect(reactionFromAssociatedType(undefined)).toBeNull();
    expect(reactionFromAssociatedType(9999)).toBeNull();
  });
});

describe('bbDate', () => {
  it('converts a ms timestamp to a Date', () => {
    expect(bbDate(1_700_000_000_000)?.getTime()).toBe(1_700_000_000_000);
  });

  it('treats 0 / null / undefined as no date', () => {
    expect(bbDate(0)).toBeNull();
    expect(bbDate(null)).toBeNull();
    expect(bbDate(undefined)).toBeNull();
  });
});
