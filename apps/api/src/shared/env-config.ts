const RELAXED_ENVIRONMENTS = new Set(['local', 'development', 'dev', 'test']);
const SECURE_COOKIE_ENVIRONMENTS = new Set(['production', 'prod']);
const DEFAULT_ADMIN_PASSWORD = 'ChangeMe123!';
const DEFAULT_ACCESS_SECRET = 'replace_me_access_secret';
const DEFAULT_REFRESH_SECRET = 'replace_me_refresh_secret';
const DEFAULT_ADMIN_ACCESS_SECRET = 'replace_me_admin_access_secret';
const DEFAULT_SYSTEM_CONFIG_SECRET = 'replace_me_system_config_secret';
const SMS_PROVIDER_VALUES = new Set(['mock', 'aliyun']);
const STORAGE_PROVIDER_VALUES = new Set(['mock', 'minio', 's3', 'oss', 'cos', 'r2']);
const AI_PROVIDER_VALUES = new Set(['mock', 'openai', 'openai-compatible']);
const MAP_PROVIDER_VALUES = new Set(['mock', 'amap', 'disabled']);
const NATIVE_APP_CORS_ORIGINS = ['https://localhost', 'capacitor://localhost', 'ionic://localhost'];
const DEFAULT_AUTH_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_AUTH_RATE_LIMIT_MAX_ATTEMPTS = 10;
const RELAXED_AUTH_RATE_LIMIT_MAX_ATTEMPTS = 1_000;
const DEFAULT_BACKUP_RETENTION_DAYS = 30;

export type AiProviderName = 'mock' | 'openai' | 'openai-compatible';
export type MapProviderName = 'mock' | 'amap' | 'disabled';

type EnvSource = Record<string, unknown>;

function readEnvValue(env: EnvSource, name: string): string | undefined {
  const value = env[name];
  if (value === undefined || value === null) return undefined;

  const normalized = String(value).trim();
  return normalized ? normalized : undefined;
}

function requireEnvValue(env: EnvSource, name: string): string {
  const value = readEnvValue(env, name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function resolveProviderValue(
  env: EnvSource,
  name: string,
  allowedValues: Set<string>,
  options: {
    relaxedDefault: string;
    allowMockInStrict: boolean;
  },
): string {
  const configured = readEnvValue(env, name)?.toLowerCase() ?? (isStrictEnvironment(env) ? undefined : options.relaxedDefault);
  if (!configured) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  if (!allowedValues.has(configured)) {
    throw new Error(`Invalid ${name} value: ${configured}`);
  }

  if (isStrictEnvironment(env) && configured === 'mock' && !options.allowMockInStrict) {
    throw new Error(`${name}=mock is not allowed outside local/test environments`);
  }

  return configured;
}

function isPlaceholderSecret(value: string, name: string): boolean {
  if (name === 'JWT_ACCESS_SECRET') return value === DEFAULT_ACCESS_SECRET;
  if (name === 'JWT_REFRESH_SECRET') return value === DEFAULT_REFRESH_SECRET;
  if (name === 'ADMIN_JWT_ACCESS_SECRET') return value === DEFAULT_ADMIN_ACCESS_SECRET;
  if (name === 'SYSTEM_CONFIG_ENCRYPTION_SECRET') return value === DEFAULT_SYSTEM_CONFIG_SECRET;
  return false;
}

export function getAppEnv(env: EnvSource = process.env): string {
  return (readEnvValue(env, 'APP_ENV') ?? readEnvValue(env, 'NODE_ENV') ?? 'local').toLowerCase();
}

export function isStrictEnvironment(env: EnvSource = process.env): boolean {
  return !RELAXED_ENVIRONMENTS.has(getAppEnv(env));
}

export function isSecureCookieEnvironment(env: EnvSource = process.env): boolean {
  return SECURE_COOKIE_ENVIRONMENTS.has(getAppEnv(env));
}

export function isSmsEnabled(env: EnvSource = process.env): boolean {
  const configured = readEnvValue(env, 'SMS_ENABLED');
  if (!configured) return false;
  return ['1', 'true', 'yes', 'on'].includes(configured.toLowerCase());
}

export function isAdminBootstrapAllowed(env: EnvSource = process.env): boolean {
  const configured = readEnvValue(env, 'ADMIN_BOOTSTRAP_ENABLED');
  if (configured) {
    return configured.toLowerCase() === 'true';
  }

  return !isStrictEnvironment(env);
}

export function getAppPort(env: EnvSource = process.env): number {
  const configured = readEnvValue(env, 'APP_PORT');
  if (!configured) return 3000;

  const port = Number(configured);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid APP_PORT value: ${configured}`);
  }

  return port;
}

function readPositiveInteger(env: EnvSource, name: string, fallback: number): number {
  const configured = readEnvValue(env, name);
  if (!configured) return fallback;

  const value = Number(configured);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid ${name} value: ${configured}`);
  }

  return value;
}

function readNonNegativeInteger(env: EnvSource, name: string, fallback: number): number {
  const configured = readEnvValue(env, name);
  if (!configured) return fallback;

  const value = Number(configured);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid ${name} value: ${configured}`);
  }

  return value;
}

function readBoolean(env: EnvSource, name: string, fallback: boolean): boolean {
  const configured = readEnvValue(env, name);
  if (!configured) return fallback;

  const normalized = configured.toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;

  throw new Error(`Invalid ${name} value: ${configured}`);
}

export function getAuthRateLimitWindowMs(env: EnvSource = process.env): number {
  return readPositiveInteger(env, 'AUTH_RATE_LIMIT_WINDOW_MS', DEFAULT_AUTH_RATE_LIMIT_WINDOW_MS);
}

export function getAuthRateLimitMaxAttempts(env: EnvSource = process.env): number {
  const fallback = isStrictEnvironment(env) ? DEFAULT_AUTH_RATE_LIMIT_MAX_ATTEMPTS : RELAXED_AUTH_RATE_LIMIT_MAX_ATTEMPTS;
  const attempts = readPositiveInteger(env, 'AUTH_RATE_LIMIT_MAX_ATTEMPTS', fallback);
  if (isStrictEnvironment(env) && attempts > 30) {
    throw new Error('AUTH_RATE_LIMIT_MAX_ATTEMPTS cannot exceed 30 outside local/test environments');
  }

  return attempts;
}

export function getBackupRetentionDays(env: EnvSource = process.env): number {
  return readPositiveInteger(env, 'BACKUP_RETENTION_DAYS', DEFAULT_BACKUP_RETENTION_DAYS);
}

export function getBackupRunbookUrl(env: EnvSource = process.env): string | null {
  return readEnvValue(env, 'BACKUP_RUNBOOK_URL') ?? null;
}

export function getBackupRestoreDrillAt(env: EnvSource = process.env): string | null {
  const configured = readEnvValue(env, 'BACKUP_RESTORE_DRILL_AT');
  if (!configured) return null;

  const timestamp = Date.parse(configured);
  if (Number.isNaN(timestamp)) {
    throw new Error(`Invalid BACKUP_RESTORE_DRILL_AT value: ${configured}`);
  }

  return new Date(timestamp).toISOString();
}

export function getAlertContactName(env: EnvSource = process.env): string | null {
  return readEnvValue(env, 'ALERT_CONTACT_NAME') ?? null;
}

export function getAlertContactChannel(env: EnvSource = process.env): string | null {
  return readEnvValue(env, 'ALERT_CONTACT_CHANNEL') ?? null;
}

export function getMobileLatestVersion(env: EnvSource = process.env): string {
  return readEnvValue(env, 'MOBILE_LATEST_VERSION') ?? '2.0.4';
}

export function getMobileLatestBuildNumber(env: EnvSource = process.env): number {
  return readNonNegativeInteger(env, 'MOBILE_LATEST_BUILD_NUMBER', 10);
}

export function getMobileReleaseNotes(env: EnvSource = process.env): string {
  return readEnvValue(env, 'MOBILE_RELEASE_NOTES') ?? '暂无更新说明。';
}

export function getMobileApkUrl(env: EnvSource = process.env): string | null {
  const configured = readEnvValue(env, 'MOBILE_APK_URL');
  if (!configured) return null;

  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    throw new Error(`Invalid MOBILE_APK_URL value: ${configured}`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('MOBILE_APK_URL must use http or https');
  }

  return parsed.toString();
}

export function getMobileForceUpdate(env: EnvSource = process.env): boolean {
  return readBoolean(env, 'MOBILE_FORCE_UPDATE', false);
}

export function isHuaweiPushEnabled(env: EnvSource = process.env): boolean {
  return readBoolean(env, 'HUAWEI_PUSH_ENABLED', false);
}

export function getHuaweiPushAppId(env: EnvSource = process.env): string {
  return isHuaweiPushEnabled(env) ? requireEnvValue(env, 'HUAWEI_PUSH_APP_ID') : readEnvValue(env, 'HUAWEI_PUSH_APP_ID') ?? '';
}

export function getHuaweiPushAppSecret(env: EnvSource = process.env): string {
  return isHuaweiPushEnabled(env) ? requireEnvValue(env, 'HUAWEI_PUSH_APP_SECRET') : readEnvValue(env, 'HUAWEI_PUSH_APP_SECRET') ?? '';
}

export function getHuaweiPushAuthUrl(env: EnvSource = process.env): string {
  return readEnvValue(env, 'HUAWEI_PUSH_AUTH_URL') ?? 'https://oauth-login.cloud.huawei.com/oauth2/v3/token';
}

export function getHuaweiPushApiUrl(env: EnvSource = process.env): string {
  return readEnvValue(env, 'HUAWEI_PUSH_API_URL') ?? 'https://push-api.cloud.huawei.com/v1';
}

export function resolveCorsOrigins(env: EnvSource = process.env): true | string[] {
  const configured = readEnvValue(env, 'CORS_ORIGINS');
  if (!configured) {
    if (isStrictEnvironment(env)) {
      throw new Error('CORS_ORIGINS is required outside local/test environments');
    }

    return true;
  }

  const origins = configured
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (!origins.length) {
    throw new Error('CORS_ORIGINS must contain at least one origin');
  }

  if (isStrictEnvironment(env)) {
    validateStrictCorsOrigins(origins);
  }

  return Array.from(new Set([...origins, ...NATIVE_APP_CORS_ORIGINS]));
}

function validateStrictCorsOrigins(origins: string[]) {
  for (const origin of origins) {
    if (origin === '*' || origin.toLowerCase() === 'null') {
      throw new Error('CORS_ORIGINS cannot include wildcard or null origins outside local/test environments');
    }

    if (NATIVE_APP_CORS_ORIGINS.includes(origin)) {
      continue;
    }

    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`Invalid CORS origin: ${origin}`);
    }

    if (parsed.protocol !== 'https:') {
      throw new Error('CORS_ORIGINS must use https origins outside local/test environments');
    }
  }
}

export function getJwtAccessSecret(env: EnvSource = process.env): string {
  return requireEnvValue(env, 'JWT_ACCESS_SECRET');
}

export function getJwtRefreshSecret(env: EnvSource = process.env): string {
  return requireEnvValue(env, 'JWT_REFRESH_SECRET');
}

export function getAdminJwtAccessSecret(env: EnvSource = process.env): string {
  const configured = readEnvValue(env, 'ADMIN_JWT_ACCESS_SECRET');
  if (configured) return configured;
  if (isStrictEnvironment(env)) {
    throw new Error('Missing required environment variable: ADMIN_JWT_ACCESS_SECRET');
  }

  return getJwtAccessSecret(env);
}

export function getAdminJwtAccessExpiresIn(env: EnvSource = process.env): string {
  return readEnvValue(env, 'ADMIN_JWT_ACCESS_EXPIRES_IN') ?? readEnvValue(env, 'JWT_ACCESS_EXPIRES_IN') ?? '2h';
}

export function getSystemConfigEncryptionSecret(env: EnvSource = process.env): string {
  const configured = readEnvValue(env, 'SYSTEM_CONFIG_ENCRYPTION_SECRET');
  if (configured) return configured;
  if (isStrictEnvironment(env)) {
    throw new Error('Missing required environment variable: SYSTEM_CONFIG_ENCRYPTION_SECRET');
  }

  return getJwtRefreshSecret(env);
}

export function getAdminInitialUsername(env: EnvSource = process.env): string {
  return readEnvValue(env, 'ADMIN_INITIAL_USERNAME') ?? 'admin';
}

export function getAdminInitialPassword(env: EnvSource = process.env): string {
  return readEnvValue(env, 'ADMIN_INITIAL_PASSWORD') ?? DEFAULT_ADMIN_PASSWORD;
}

export function getSmsProviderName(env: EnvSource = process.env): 'mock' | 'aliyun' {
  return resolveProviderValue(env, 'SMS_PROVIDER', SMS_PROVIDER_VALUES, {
    relaxedDefault: 'mock',
    allowMockInStrict: false,
  }) as 'mock' | 'aliyun';
}

export function getStorageProviderName(env: EnvSource = process.env): 'mock' | 'minio' | 's3' | 'oss' | 'cos' | 'r2' {
  return resolveProviderValue(env, 'STORAGE_PROVIDER', STORAGE_PROVIDER_VALUES, {
    relaxedDefault: 'mock',
    allowMockInStrict: false,
  }) as 'mock' | 'minio' | 's3' | 'oss' | 'cos' | 'r2';
}

export function getAiProviderName(env: EnvSource = process.env): AiProviderName {
  return resolveProviderValue(env, 'AI_PROVIDER', AI_PROVIDER_VALUES, {
    relaxedDefault: 'mock',
    allowMockInStrict: false,
  }) as AiProviderName;
}

export function getMapProviderName(env: EnvSource = process.env): MapProviderName {
  const provider = resolveProviderValue(env, 'MAP_PROVIDER', MAP_PROVIDER_VALUES, {
    relaxedDefault: 'mock',
    allowMockInStrict: false,
  }) as MapProviderName;

  if (isStrictEnvironment(env) && provider === 'disabled') {
    throw new Error('MAP_PROVIDER=disabled is not allowed outside local/test environments');
  }

  return provider;
}

export function getJwtAccessExpiresIn(env: EnvSource = process.env): string {
  return readEnvValue(env, 'JWT_ACCESS_EXPIRES_IN') ?? '2h';
}

export function getJwtRefreshExpiresIn(env: EnvSource = process.env): string {
  return readEnvValue(env, 'JWT_REFRESH_EXPIRES_IN') ?? '30d';
}

export function getMapApiKey(env: EnvSource = process.env): string | null {
  return readEnvValue(env, 'MAP_API_KEY') ?? null;
}

export function getMapAmapEndpoint(env: EnvSource = process.env): string {
  return readEnvValue(env, 'MAP_AMAP_ENDPOINT') ?? 'https://restapi.amap.com/v3/place/text';
}

export function getMapAmapRegeocodeEndpoint(env: EnvSource = process.env): string {
  return readEnvValue(env, 'MAP_AMAP_REGEOCODE_ENDPOINT') ?? 'https://restapi.amap.com/v3/geocode/regeo';
}

export function getMapRequestTimeoutMs(env: EnvSource = process.env): number {
  const value = readEnvValue(env, 'MAP_REQUEST_TIMEOUT_MS');
  return value ? Number(value) : 5000;
}

export function getMediaUploadSessionTtlSeconds(env: EnvSource = process.env): number {
  const value = readEnvValue(env, 'MEDIA_UPLOAD_SESSION_TTL_SECONDS');
  return value ? Number(value) : 3600;
}

export function getStorageBucket(env: EnvSource = process.env): string {
  return readEnvValue(env, 'STORAGE_BUCKET') ?? 'xiaoman-archive-local';
}

export function getUploadImageMaxBytes(env: EnvSource = process.env): number {
  const value = readEnvValue(env, 'UPLOAD_IMAGE_MAX_BYTES');
  return value ? Number(value) : 10 * 1024 * 1024;
}

export function getUploadVideoMaxBytes(env: EnvSource = process.env): number {
  const value = readEnvValue(env, 'UPLOAD_VIDEO_MAX_BYTES');
  return value ? Number(value) : 200 * 1024 * 1024;
}

export function getUploadAudioMaxBytes(env: EnvSource = process.env): number {
  const value = readEnvValue(env, 'UPLOAD_AUDIO_MAX_BYTES');
  return value ? Number(value) : 50 * 1024 * 1024;
}

export function getStorageEndpoint(env: EnvSource = process.env): string | undefined {
  return readEnvValue(env, 'STORAGE_ENDPOINT') ?? undefined;
}

export function getStorageSignedUrlExpiresIn(env: EnvSource = process.env): number {
  const value = readEnvValue(env, 'STORAGE_SIGNED_URL_EXPIRES_IN');
  return value ? Number(value) : 600;
}

export function getStorageRegion(env: EnvSource = process.env): string {
  return readEnvValue(env, 'STORAGE_REGION') ?? 'auto';
}

export function getStorageForcePathStyle(env: EnvSource = process.env): boolean {
  const value = readEnvValue(env, 'STORAGE_FORCE_PATH_STYLE');
  return String(value ?? 'true').toLowerCase() === 'true';
}

export function getStorageAccessKey(env: EnvSource = process.env): string | undefined {
  return readEnvValue(env, 'STORAGE_ACCESS_KEY') ?? undefined;
}

export function getStorageSecretKey(env: EnvSource = process.env): string | undefined {
  return readEnvValue(env, 'STORAGE_SECRET_KEY') ?? undefined;
}

export function getLiveReadinessReportPath(env: EnvSource = process.env): string | null {
  const value = readEnvValue(env, 'LIVE_READINESS_REPORT_PATH');
  return value ? value : null;
}

export function getSmsAccessKey(env: EnvSource = process.env): string {
  return requireEnvValue(env, 'SMS_ACCESS_KEY');
}

export function getSmsSecretKey(env: EnvSource = process.env): string {
  return requireEnvValue(env, 'SMS_SECRET_KEY');
}

export function getSmsEndpoint(env: EnvSource = process.env): string {
  return readEnvValue(env, 'SMS_ENDPOINT') ?? 'https://dysmsapi.aliyuncs.com';
}

export function getSmsSignName(env: EnvSource = process.env): string {
  return requireEnvValue(env, 'SMS_SIGN_NAME');
}

function requireEnvValues(env: EnvSource, names: string[]) {
  for (const name of names) {
    requireEnvValue(env, name);
  }
}

function validateStrictProviderConfig(env: EnvSource) {
  requireEnvValue(env, 'DATABASE_URL');
  requireEnvValues(env, ['REDIS_HOST', 'REDIS_PORT']);

  if (isSmsEnabled(env)) {
    const smsProvider = getSmsProviderName(env);
    if (smsProvider === 'aliyun') {
      requireEnvValues(env, ['SMS_ACCESS_KEY', 'SMS_SECRET_KEY', 'SMS_SIGN_NAME', 'SMS_TEMPLATE_CODE']);
    }
  }

  const storageProvider = getStorageProviderName(env);
  if (storageProvider !== 'mock') {
    requireEnvValues(env, ['STORAGE_REGION', 'STORAGE_BUCKET', 'STORAGE_ACCESS_KEY', 'STORAGE_SECRET_KEY']);
    if (storageProvider !== 's3') {
      requireEnvValue(env, 'STORAGE_ENDPOINT');
    }
  }

  const aiProvider = getAiProviderName(env);
  if (aiProvider !== 'mock') {
    requireEnvValues(env, ['AI_API_KEY', 'AI_BASE_URL', 'AI_MODEL']);
  }

  const mapProvider = getMapProviderName(env);
  if (mapProvider === 'amap') {
    requireEnvValue(env, 'MAP_API_KEY');
  }
}

function validateStrictOperationsConfig(env: EnvSource) {
  getBackupRetentionDays(env);
  requireEnvValue(env, 'BACKUP_RUNBOOK_URL');
  requireEnvValue(env, 'BACKUP_RESTORE_DRILL_AT');
  getBackupRestoreDrillAt(env);
  requireEnvValue(env, 'ALERT_CONTACT_NAME');
  requireEnvValue(env, 'ALERT_CONTACT_CHANNEL');
}

function validateStrictJwtSecrets(accessSecret: string, refreshSecret: string) {
  if (accessSecret === refreshSecret) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different outside local/test environments');
  }

  if (accessSecret.length < 32) {
    throw new Error('JWT_ACCESS_SECRET must be at least 32 characters outside local/test environments');
  }

  if (refreshSecret.length < 32) {
    throw new Error('JWT_REFRESH_SECRET must be at least 32 characters outside local/test environments');
  }
}

function validateStrictAdminJwtSecret(adminAccessSecret: string, userAccessSecret: string) {
  if (adminAccessSecret === userAccessSecret) {
    throw new Error('ADMIN_JWT_ACCESS_SECRET and JWT_ACCESS_SECRET must be different outside local/test environments');
  }

  if (adminAccessSecret.length < 32) {
    throw new Error('ADMIN_JWT_ACCESS_SECRET must be at least 32 characters outside local/test environments');
  }
}

function validateStrictSystemConfigSecret(systemConfigSecret: string, accessSecret: string, refreshSecret: string) {
  if (systemConfigSecret.length < 32) {
    throw new Error('SYSTEM_CONFIG_ENCRYPTION_SECRET must be at least 32 characters outside local/test environments');
  }

  if (systemConfigSecret === accessSecret || systemConfigSecret === refreshSecret) {
    throw new Error('SYSTEM_CONFIG_ENCRYPTION_SECRET must be different from JWT secrets outside local/test environments');
  }

  if (isPlaceholderSecret(systemConfigSecret, 'SYSTEM_CONFIG_ENCRYPTION_SECRET')) {
    throw new Error('SYSTEM_CONFIG_ENCRYPTION_SECRET cannot use the placeholder value outside local/test environments');
  }
}

export function validateRuntimeConfig(config: Record<string, unknown>): Record<string, unknown> {
  const accessSecret = getJwtAccessSecret(config);
  const refreshSecret = getJwtRefreshSecret(config);

  getAppPort(config);
  getAuthRateLimitWindowMs(config);
  getAuthRateLimitMaxAttempts(config);
  resolveCorsOrigins(config);
  if (isSmsEnabled(config)) {
    getSmsProviderName(config);
  }
  getStorageProviderName(config);
  getAiProviderName(config);
  getMapProviderName(config);
  if (isHuaweiPushEnabled(config)) {
    getHuaweiPushAppId(config);
    getHuaweiPushAppSecret(config);
    new URL(getHuaweiPushAuthUrl(config));
    new URL(getHuaweiPushApiUrl(config));
  }

  if (isStrictEnvironment(config)) {
    validateStrictProviderConfig(config);

    if (isPlaceholderSecret(accessSecret, 'JWT_ACCESS_SECRET')) {
      throw new Error('JWT_ACCESS_SECRET cannot use the placeholder value outside local/test environments');
    }

    if (isPlaceholderSecret(refreshSecret, 'JWT_REFRESH_SECRET')) {
      throw new Error('JWT_REFRESH_SECRET cannot use the placeholder value outside local/test environments');
    }

    validateStrictJwtSecrets(accessSecret, refreshSecret);
    const adminAccessSecret = getAdminJwtAccessSecret(config);
    if (isPlaceholderSecret(adminAccessSecret, 'ADMIN_JWT_ACCESS_SECRET')) {
      throw new Error('ADMIN_JWT_ACCESS_SECRET cannot use the placeholder value outside local/test environments');
    }
    validateStrictAdminJwtSecret(adminAccessSecret, accessSecret);
    const systemConfigSecret = getSystemConfigEncryptionSecret(config);
    validateStrictSystemConfigSecret(systemConfigSecret, accessSecret, refreshSecret);

    if (isAdminBootstrapAllowed(config)) {
      const initialPassword = getAdminInitialPassword(config);
      if (initialPassword === DEFAULT_ADMIN_PASSWORD) {
        throw new Error('ADMIN_INITIAL_PASSWORD cannot use the default value when admin bootstrap is enabled outside local/test environments');
      }
      if (initialPassword.length < 12) {
        throw new Error('ADMIN_INITIAL_PASSWORD must be at least 12 characters in production environments');
      }
    }

    validateStrictOperationsConfig(config);
  }

  return config;
}
