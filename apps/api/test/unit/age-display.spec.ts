import { ageDisplay } from '../../src/shared/utils';

describe('ageDisplay', () => {
  it('uses the China calendar day for current age display', () => {
    expect(ageDisplay(new Date('2021-06-01T00:00:00.000Z'), new Date('2026-06-24T16:30:00.000Z'))).toBe('5岁0月24天');
  });

  it('handles month-end birthdays without drifting by milliseconds', () => {
    expect(ageDisplay(new Date('2024-01-31T00:00:00.000Z'), new Date('2024-02-28T16:30:00.000Z'))).toBe('1月0天');
  });
});
