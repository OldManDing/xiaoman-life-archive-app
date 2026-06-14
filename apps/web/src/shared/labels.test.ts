import { describe, expect, it } from 'vitest';

import { membershipTypeLabel } from './labels';

describe('labels', () => {
  it('localizes both current and legacy basic membership values', () => {
    expect(membershipTypeLabel('free')).toBe('基础会员');
    expect(membershipTypeLabel('basic')).toBe('基础会员');
  });
});
