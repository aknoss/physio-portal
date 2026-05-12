import { describe, expect, it } from 'vitest';
import {
  monthRangeFor,
  sumRealizadaCents,
  weekRangeFor,
} from '../../../src/shared/pricing/billing.js';

describe('weekRangeFor', () => {
  it('returns Monday..Sunday for a Wednesday', () => {
    expect(weekRangeFor('2026-03-04')).toEqual({
      from: '2026-03-02',
      to: '2026-03-08',
    });
  });

  it('returns the same week when the reference date is a Monday', () => {
    expect(weekRangeFor('2026-03-02')).toEqual({
      from: '2026-03-02',
      to: '2026-03-08',
    });
  });

  it('returns the previous Monday when the reference date is a Sunday', () => {
    expect(weekRangeFor('2026-03-08')).toEqual({
      from: '2026-03-02',
      to: '2026-03-08',
    });
  });

  it('crosses a month boundary cleanly', () => {
    expect(weekRangeFor('2026-04-01')).toEqual({
      from: '2026-03-30',
      to: '2026-04-05',
    });
  });

  it('crosses a year boundary cleanly', () => {
    expect(weekRangeFor('2026-01-01')).toEqual({
      from: '2025-12-29',
      to: '2026-01-04',
    });
  });
});

describe('monthRangeFor', () => {
  it('returns first..last calendar day of the month', () => {
    expect(monthRangeFor('2026-03-15')).toEqual({
      from: '2026-03-01',
      to: '2026-03-31',
    });
  });

  it('handles February in a leap year', () => {
    expect(monthRangeFor('2024-02-10')).toEqual({
      from: '2024-02-01',
      to: '2024-02-29',
    });
  });

  it('handles February in a non-leap year', () => {
    expect(monthRangeFor('2026-02-10')).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    });
  });

  it('handles 30-day months', () => {
    expect(monthRangeFor('2026-04-30')).toEqual({
      from: '2026-04-01',
      to: '2026-04-30',
    });
  });

  it('handles December', () => {
    expect(monthRangeFor('2026-12-25')).toEqual({
      from: '2026-12-01',
      to: '2026-12-31',
    });
  });
});

describe('sumRealizadaCents', () => {
  it('returns 0 for an empty list', () => {
    expect(sumRealizadaCents([])).toBe(0);
  });

  it('sums only REALIZADA sessions', () => {
    expect(
      sumRealizadaCents([
        { status: 'REALIZADA', priceCents: 12000 },
        { status: 'FALTA', priceCents: 12000 },
        { status: 'REMARCADA', priceCents: 12000 },
        { status: 'SCHEDULED', priceCents: 12000 },
        { status: 'REALIZADA', priceCents: 8000 },
      ]),
    ).toBe(20000);
  });

  it('returns 0 when no session is REALIZADA', () => {
    expect(
      sumRealizadaCents([
        { status: 'FALTA', priceCents: 12000 },
        { status: 'REMARCADA', priceCents: 12000 },
        { status: 'SCHEDULED', priceCents: 12000 },
      ]),
    ).toBe(0);
  });
});
