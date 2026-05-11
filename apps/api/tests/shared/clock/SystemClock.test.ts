import { describe, expect, it } from 'vitest';
import { SystemClock } from '../../../src/shared/clock/SystemClock.js';

describe('SystemClock', () => {
  it('returns a Date at the current instant', () => {
    const before = Date.now();
    const t = new SystemClock().now().getTime();
    const after = Date.now();
    expect(t).toBeGreaterThanOrEqual(before);
    expect(t).toBeLessThanOrEqual(after);
  });
});
