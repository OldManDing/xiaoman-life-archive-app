import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearLocalSettings, defaultLocalSettings, saveLocalSettings } from './localSettings';

describe('localSettings', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('does not throw when saving settings in a restricted WebView', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => saveLocalSettings(defaultLocalSettings)).not.toThrow();
  });

  it('does not throw when clearing settings in a restricted WebView', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => clearLocalSettings()).not.toThrow();
  });
});
