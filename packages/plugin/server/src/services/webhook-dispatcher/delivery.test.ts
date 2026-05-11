import { describe, it, expect } from 'vitest';
import { computeBackoffMs } from './delivery';

describe('computeBackoffMs', () => {
  it('grows exponentially', () => {
    expect(computeBackoffMs(1)).toBe(1000);
    expect(computeBackoffMs(2)).toBe(2000);
    expect(computeBackoffMs(3)).toBe(4000);
    expect(computeBackoffMs(4)).toBe(8000);
  });
  it('caps at 60 seconds', () => {
    expect(computeBackoffMs(7)).toBe(60_000);
    expect(computeBackoffMs(20)).toBe(60_000);
  });
});
