import { describe, it, expect } from 'vitest';
import { localTimeForAddress, zoneForAddress } from '../src/lib/area-code-time';

describe('zoneForAddress', () => {
  it('reads the area code with or without the country code', () => {
    expect(zoneForAddress('+12125551234')).toBe('America/New_York');
    expect(zoneForAddress('2125551234')).toBe('America/New_York');
    expect(zoneForAddress('(212) 555-1234')).toBe('America/New_York');
  });

  it('covers the four continental zones', () => {
    expect(zoneForAddress('+14155551234')).toBe('America/Los_Angeles');
    expect(zoneForAddress('+13035551234')).toBe('America/Denver');
    expect(zoneForAddress('+13125551234')).toBe('America/Chicago');
    expect(zoneForAddress('+12025551234')).toBe('America/New_York');
  });

  it('gives Arizona its own zone', () => {
    // Arizona doesn't observe DST, so folding it into Denver would be an hour
    // wrong for eight months of the year.
    expect(zoneForAddress('+16025551234')).toBe('America/Phoenix');
  });

  it('handles Alaska and Hawaii', () => {
    expect(zoneForAddress('+19075551234')).toBe('America/Anchorage');
    expect(zoneForAddress('+18085551234')).toBe('Pacific/Honolulu');
  });

  it('returns null rather than guessing', () => {
    // A wrong local time would be used to decide whether to send.
    expect(zoneForAddress('+442071234567')).toBeNull(); // UK
    expect(zoneForAddress('+19995551234')).toBeNull(); // unassigned code
    expect(zoneForAddress('jordan@acme.com')).toBeNull();
    expect(zoneForAddress('')).toBeNull();
    expect(zoneForAddress(null)).toBeNull();
    expect(zoneForAddress('555')).toBeNull();
  });

  it('does not treat a long international number as North American', () => {
    expect(zoneForAddress('+861012345678')).toBeNull();
  });
});

describe('localTimeForAddress', () => {
  // 2025-03-12T20:00:00Z — 4pm in New York, 1pm in Los Angeles (both on DST).
  const NOON_UTC = new Date('2025-03-12T20:00:00Z');

  it('renders the wall clock in their zone', () => {
    expect(localTimeForAddress('+12125551234', NOON_UTC)?.time).toBe('4:00 PM');
    expect(localTimeForAddress('+14155551234', NOON_UTC)?.time).toBe('1:00 PM');
  });

  it('flags hours it would be rude to text at', () => {
    // 06:00 UTC is 1am in New York and 10pm the previous day in LA.
    const early = new Date('2025-03-12T06:00:00Z');
    expect(localTimeForAddress('+12125551234', early)?.unsociable).toBe(true);
    expect(localTimeForAddress('+14155551234', early)?.unsociable).toBe(true);
    // Mid-afternoon is fine everywhere.
    expect(localTimeForAddress('+12125551234', NOON_UTC)?.unsociable).toBe(false);
  });

  it('returns null for an unknown zone', () => {
    expect(localTimeForAddress('+442071234567', NOON_UTC)).toBeNull();
  });
});
