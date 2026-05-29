import { getRefreshCookieOptions } from '../../src/shared/auth-cookie';

describe('getRefreshCookieOptions', () => {
  it('keeps local and test refresh cookies compatible with non-HTTPS development', () => {
    expect(getRefreshCookieOptions({ APP_ENV: 'test', JWT_REFRESH_EXPIRES_IN: '2h' })).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
      maxAge: 7_200_000,
    });
  });

  it('uses cross-site secure cookies in production so native App refresh survives restart', () => {
    expect(getRefreshCookieOptions({ APP_ENV: 'production', JWT_REFRESH_EXPIRES_IN: '30d' })).toMatchObject({
      httpOnly: true,
      sameSite: 'none',
      secure: true,
      path: '/',
      maxAge: 2_592_000_000,
    });
  });
});
