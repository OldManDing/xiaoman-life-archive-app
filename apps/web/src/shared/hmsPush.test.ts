import { describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' },
  registerPlugin: () => ({}),
}));

import { resolveHmsNotificationPath } from './hmsPush';

describe('resolveHmsNotificationPath', () => {
  it('opens a record from nested HMS notification data', () => {
    expect(
      resolveHmsNotificationPath({
        extras: {
          data: JSON.stringify({ target_type: 'record', target_no: 'rec_20260727' }),
        },
      }),
    ).toBe('/record/rec_20260727');
  });

  it('accepts a safe explicit path and rejects arbitrary paths', () => {
    expect(resolveHmsNotificationPath({ data: { path: '/record/rec_001' } })).toBe('/record/rec_001');
    expect(resolveHmsNotificationPath({ data: { path: 'https://example.com' } })).toBe('/profile/messages');
  });

  it('opens a record from Huawei pushMsg and msgContent JSON wrappers', () => {
    expect(
      resolveHmsNotificationPath({
        pushMsg: JSON.stringify({
          msgContent: {
            data: JSON.stringify({ path: '/record/rec_huawei_001' }),
          },
        }),
      }),
    ).toBe('/record/rec_huawei_001');
  });
});
