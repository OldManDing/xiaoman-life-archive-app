import { describe, expect, it } from 'vitest';

import { diffCalendarAge, formatAgeAtEvent } from './age';

describe('age helpers', () => {
  it('uses the China calendar day when formatting record-event age', () => {
    expect(formatAgeAtEvent('2021-06-01', '2026-06-24T16:30:00.000Z')).toBe('5岁');
    expect(diffCalendarAge('2021-06-01', '2026-06-24T16:30:00.000Z')).toEqual({
      years: 5,
      months: 0,
      days: 24,
    });
  });

  it('formats newborn and month-only ages from calendar dates', () => {
    expect(formatAgeAtEvent('2026-06-01', '2026-06-24T16:30:00.000Z')).toBe('24天');
    expect(formatAgeAtEvent('2024-01-31', '2024-02-28T16:30:00.000Z')).toBe('1个月');
  });
});
