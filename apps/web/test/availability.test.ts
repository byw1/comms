import { describe, it, expect } from 'vitest';
import {
  computeSlots,
  formatSlotsAsText,
  DEFAULT_BUSINESS_HOURS,
} from '../src/lib/availability';

/** Wednesday 12 March 2025, 10:00 local — inside default business hours. */
const NOW = new Date(2025, 2, 12, 10, 0, 0, 0);

describe('computeSlots', () => {
  it('produces slots only on business days, inside business hours', () => {
    const slots = computeSlots(DEFAULT_BUSINESS_HOURS, { durationMinutes: 30, now: NOW });
    expect(slots.length).toBeGreaterThan(0);
    for (const s of slots) {
      const day = s.start.getDay();
      expect(DEFAULT_BUSINESS_HOURS.days).toContain(day);
      const startMin = s.start.getHours() * 60 + s.start.getMinutes();
      expect(startMin).toBeGreaterThanOrEqual(DEFAULT_BUSINESS_HOURS.startMinutes);
      const endMin = s.end.getHours() * 60 + s.end.getMinutes();
      expect(endMin).toBeLessThanOrEqual(DEFAULT_BUSINESS_HOURS.endMinutes);
    }
  });

  it('never offers a slot in the past or inside the lead window', () => {
    const slots = computeSlots(DEFAULT_BUSINESS_HOURS, {
      durationMinutes: 30,
      now: NOW,
      leadMinutes: 60,
    });
    for (const s of slots) {
      expect(s.start.getTime()).toBeGreaterThanOrEqual(NOW.getTime() + 60 * 60_000);
    }
  });

  it('caps slots per day', () => {
    const slots = computeSlots(DEFAULT_BUSINESS_HOURS, { durationMinutes: 30, now: NOW, perDay: 3 });
    const byDay = new Map<string, number>();
    for (const s of slots) {
      const k = s.start.toDateString();
      byDay.set(k, (byDay.get(k) ?? 0) + 1);
    }
    for (const n of byDay.values()) expect(n).toBeLessThanOrEqual(3);
  });

  it('slot length matches the requested duration', () => {
    const slots = computeSlots(DEFAULT_BUSINESS_HOURS, { durationMinutes: 60, now: NOW });
    for (const s of slots) {
      expect(s.end.getTime() - s.start.getTime()).toBe(60 * 60_000);
    }
  });
});

describe('formatSlotsAsText', () => {
  it('reads like a person for one slot and lists several', () => {
    const slots = computeSlots(DEFAULT_BUSINESS_HOURS, { durationMinutes: 30, now: NOW });
    const one = formatSlotsAsText([slots[0]!], NOW);
    expect(one).toMatch(/^Would .* work for you\?$/);

    const many = formatSlotsAsText(slots.slice(0, 3), NOW);
    expect(many).toContain('Would any of these times work?');
    expect(many.split('\n')).toHaveLength(4);
  });

  it('returns empty for no slots', () => {
    expect(formatSlotsAsText([], NOW)).toBe('');
  });
});
