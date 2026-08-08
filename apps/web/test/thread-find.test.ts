import { describe, it, expect } from 'vitest';
import { findOffsets, highlightRuns } from '../src/lib/find-in-text';
import { parseSearchQuery, searchFiltersToHref } from '../src/lib/search-query';

describe('findOffsets', () => {
  it('finds every occurrence, case-insensitively', () => {
    expect(findOffsets('Cat cat CAT', 'cat')).toEqual([0, 4, 8]);
  });

  it('counts overlapping matches — both are places to jump to', () => {
    expect(findOffsets('aaa', 'aa')).toEqual([0, 1]);
  });

  it('returns nothing for an empty needle rather than one match per character', () => {
    expect(findOffsets('hello', '')).toEqual([]);
  });

  it('returns nothing when absent', () => {
    expect(findOffsets('hello', 'zz')).toEqual([]);
  });
});

describe('highlightRuns', () => {
  it('splits around a match', () => {
    expect(highlightRuns('say hello there', 'hello')).toEqual([
      { text: 'say ', match: false },
      { text: 'hello', match: true },
      { text: ' there', match: false },
    ]);
  });

  it('reassembles into exactly the original text', () => {
    // Any drop or duplication here silently corrupts a rendered message.
    const cases: Array<[string, string]> = [
      ['aaa', 'aa'],
      ['Cat cat CAT', 'cat'],
      ['hello', 'hello'],
      ['no match here', 'zz'],
      ['edge', ''],
      ['ababab', 'ab'],
    ];
    for (const [text, needle] of cases) {
      const joined = highlightRuns(text, needle)
        .map((r) => r.text)
        .join('');
      expect(joined, `${text} / ${needle}`).toBe(text);
    }
  });

  it('handles a match at each boundary', () => {
    expect(highlightRuns('abc', 'a')[0]).toEqual({ text: 'a', match: true });
    const end = highlightRuns('abc', 'c');
    expect(end[end.length - 1]).toEqual({ text: 'c', match: true });
  });

  it('preserves the original casing of a match', () => {
    const runs = highlightRuns('Hello', 'hello');
    expect(runs[0]).toEqual({ text: 'Hello', match: true });
  });
});

describe('has: search operator', () => {
  it('accepts the plurals and synonyms people actually type', () => {
    for (const word of ['photo', 'photos', 'image', 'pics']) {
      expect(parseSearchQuery(`has:${word}`).filters.has, word).toBe('photo');
    }
    for (const word of ['voice', 'audio', 'voicemail']) {
      expect(parseSearchQuery(`has:${word}`).filters.has, word).toBe('voice');
    }
    expect(parseSearchQuery('has:files').filters.has).toBe('attachment');
    expect(parseSearchQuery('has:link').filters.has).toBe('link');
  });

  it('leaves an unknown value in the free text rather than dropping it', () => {
    const parsed = parseSearchQuery('has:banana refund');
    expect(parsed.filters.has).toBeUndefined();
    expect(parsed.text).toBe('has:banana refund');
  });

  it('combines with other operators and free text', () => {
    const parsed = parseSearchQuery('has:photo tag:billing deposit');
    expect(parsed.filters.has).toBe('photo');
    expect(parsed.filters.tags).toEqual(['billing']);
    expect(parsed.text).toBe('deposit');
  });

  it('reaches the inbox URL', () => {
    const href = searchFiltersToHref(parseSearchQuery('has:voice'), new Map());
    expect(href).toBe('/inbox?has=voice');
  });
});
