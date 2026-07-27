import { describe, it, expect } from 'vitest';
import { newTempGuid } from '../src/ids';

describe('newTempGuid', () => {
  it('is prefixed so echoes are recognizable', () => {
    expect(newTempGuid()).toMatch(/^comms-/);
  });

  it('is unique across calls (echo reconciliation depends on this)', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newTempGuid()));
    expect(ids.size).toBe(1000);
  });
});
