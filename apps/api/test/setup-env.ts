const defaults: Record<string, string> = {
  APP_ENV: 'test',
  NODE_ENV: 'test',
  JWT_ACCESS_SECRET: 'test_access_secret',
  JWT_REFRESH_SECRET: 'test_refresh_secret',
  JWT_ACCESS_EXPIRES_IN: '2h',
  JWT_REFRESH_EXPIRES_IN: '30d',
  SMS_PROVIDER: 'mock',
  SMS_MOCK_CODE: '123456',
  STORAGE_PROVIDER: 'mock',
  UPLOAD_IMAGE_MAX_BYTES: '10485760',
  AI_PROVIDER: 'mock',
  AI_DAILY_LIMIT_PER_USER: '20',
};

for (const [key, value] of Object.entries(defaults)) {
  process.env[key] ??= value;
}
