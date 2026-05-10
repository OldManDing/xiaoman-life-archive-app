const localDatabaseUrl = 'mysql://xiaoman:password@localhost:3307/xiaoman_archive';

const apiPort = process.env.E2E_API_PORT ?? '3001';
const webPort = process.env.E2E_WEB_PORT ?? '5176';
const adminPort = process.env.E2E_ADMIN_PORT ?? '5177';

function cleanEnv(env) {
  return Object.fromEntries(
    Object.entries(env).filter(([key, value]) => key && !key.startsWith('=') && value !== undefined),
  );
}

const apiEnv = {
  ...cleanEnv(process.env),
  APP_ENV: process.env.APP_ENV ?? 'local',
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  APP_PORT: apiPort,
  APP_BASE_URL: process.env.APP_BASE_URL ?? `http://127.0.0.1:${apiPort}`,
  DATABASE_URL: process.env.DATABASE_URL ?? localDatabaseUrl,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? 'local_access_secret_for_e2e',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? 'local_refresh_secret_for_e2e',
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN ?? '2h',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
  SMS_PROVIDER: process.env.SMS_PROVIDER ?? 'mock',
  SMS_MOCK_CODE: process.env.SMS_MOCK_CODE ?? '123456',
  SMS_SEND_COOLDOWN_SECONDS: process.env.SMS_SEND_COOLDOWN_SECONDS ?? '0',
  SMS_DAILY_LIMIT_PER_MOBILE: process.env.SMS_DAILY_LIMIT_PER_MOBILE ?? '100',
  STORAGE_PROVIDER: process.env.STORAGE_PROVIDER ?? 'mock',
  AI_PROVIDER: process.env.AI_PROVIDER ?? 'mock',
  AI_DAILY_LIMIT_PER_USER: process.env.AI_DAILY_LIMIT_PER_USER ?? '20',
  ADMIN_INITIAL_USERNAME: process.env.ADMIN_INITIAL_USERNAME ?? 'admin',
  ADMIN_INITIAL_PASSWORD: process.env.ADMIN_INITIAL_PASSWORD ?? 'ChangeMe123!',
  CORS_ORIGINS:
    process.env.CORS_ORIGINS ??
    [`http://127.0.0.1:${webPort}`, `http://127.0.0.1:${adminPort}`].join(','),
};

const frontendEnv = {
  ...cleanEnv(process.env),
  VITE_API_PROXY_TARGET: process.env.VITE_API_PROXY_TARGET ?? `http://127.0.0.1:${apiPort}`,
};

module.exports = {
  apiEnv,
  frontendEnv,
  apiPort,
  webPort,
  adminPort,
};
