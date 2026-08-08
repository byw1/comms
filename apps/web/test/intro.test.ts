import { describe, it, expect } from 'vitest';
import { extractSelfIntroduction, zoneLabel } from '../src/lib/intro';

describe('extractSelfIntroduction', () => {
  it('pulls a name from the common introduction forms', () => {
    expect(extractSelfIntroduction('Hi, this is Sarah from Acme Roofing')).toEqual({
      name: 'Sarah',
      company: 'Acme Roofing',
    });
    expect(extractSelfIntroduction("Hey! It's Jordan Blake, we met at the expo")).toEqual({
      name: 'Jordan Blake',
      company: null,
    });
    expect(extractSelfIntroduction('My name is Priya and I need help with an order')?.name).toBe(
      'Priya',
    );
    expect(extractSelfIntroduction('Hello, I’m Marcus with Delta Plumbing')).toEqual({
      name: 'Marcus',
      company: 'Delta Plumbing',
    });
  });

  it('refuses non-name continuations', () => {
    expect(extractSelfIntroduction("it's fine, thanks")).toBeNull();
    expect(extractSelfIntroduction('this is urgent!!')).toBeNull();
    expect(extractSelfIntroduction('THIS IS UNACCEPTABLE')).toBeNull();
    expect(extractSelfIntroduction("I'm wondering about my order")).toBeNull();
    expect(extractSelfIntroduction("I'm so happy with the service")).toBeNull();
  });

  it('requires the introduction near the start of the message', () => {
    const longTail = `${'They kept me waiting for hours and hours. '.repeat(10)}this is Sarah`;
    expect(extractSelfIntroduction(longTail)).toBeNull();
  });

  it('handles empty input', () => {
    expect(extractSelfIntroduction('')).toBeNull();
    expect(extractSelfIntroduction(null)).toBeNull();
  });
});

describe('zoneLabel', () => {
  it('labels the zones the area-code table produces', () => {
    expect(zoneLabel('America/Los_Angeles')).toBe('Pacific time');
    expect(zoneLabel('America/Phoenix')).toBe('Arizona');
    expect(zoneLabel(null)).toBeNull();
    expect(zoneLabel('Europe/Paris')).toBeNull();
  });
});
