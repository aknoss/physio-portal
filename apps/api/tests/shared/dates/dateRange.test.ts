import { describe, expect, it } from 'vitest';
import {
  enumerateDates,
  maxIsoDate,
  minIsoDate,
  weekdayOfIsoDate,
} from '../../../src/shared/dates/dateRange.js';

describe('enumerateDates', () => {
  it('returns inclusive range one day at a time', () => {
    expect(enumerateDates('2026-03-01', '2026-03-04')).toEqual([
      '2026-03-01',
      '2026-03-02',
      '2026-03-03',
      '2026-03-04',
    ]);
  });

  it('returns single day when from == to', () => {
    expect(enumerateDates('2026-05-12', '2026-05-12')).toEqual(['2026-05-12']);
  });

  it('returns empty array when from > to', () => {
    expect(enumerateDates('2026-05-12', '2026-05-11')).toEqual([]);
  });

  it('crosses the spring-forward DST boundary without skipping a day', () => {
    const days = enumerateDates('2026-03-07', '2026-03-09');
    expect(days).toEqual(['2026-03-07', '2026-03-08', '2026-03-09']);
  });

  it('crosses the fall-back DST boundary without duplicating a day', () => {
    const days = enumerateDates('2026-10-31', '2026-11-02');
    expect(days).toEqual(['2026-10-31', '2026-11-01', '2026-11-02']);
  });

  it('crosses month and year boundaries', () => {
    const days = enumerateDates('2025-12-30', '2026-01-02');
    expect(days).toEqual(['2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02']);
  });
});

describe('weekdayOfIsoDate', () => {
  it('returns 0 for Sunday', () => {
    expect(weekdayOfIsoDate('2026-03-01')).toBe(0);
  });
  it('returns 1 for Monday', () => {
    expect(weekdayOfIsoDate('2026-03-02')).toBe(1);
  });
  it('returns 6 for Saturday', () => {
    expect(weekdayOfIsoDate('2026-03-07')).toBe(6);
  });
});

describe('maxIsoDate / minIsoDate', () => {
  it('maxIsoDate picks the later one', () => {
    expect(maxIsoDate('2026-03-01', '2026-04-01')).toBe('2026-04-01');
    expect(maxIsoDate('2026-04-01', '2026-03-01')).toBe('2026-04-01');
    expect(maxIsoDate('2026-03-01', '2026-03-01')).toBe('2026-03-01');
  });
  it('minIsoDate picks the earlier one', () => {
    expect(minIsoDate('2026-03-01', '2026-04-01')).toBe('2026-03-01');
    expect(minIsoDate('2026-04-01', '2026-03-01')).toBe('2026-03-01');
    expect(minIsoDate('2026-03-01', '2026-03-01')).toBe('2026-03-01');
  });
});
