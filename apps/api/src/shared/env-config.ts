const RELAXED_ENVIRONMENTS = new Set(['local', 'development', 'dev', 'test']);
const SECURE_COOKIE_ENVIRONMENTS = new Set(['production', 'prod']);
const DEFAULT_ADMIN_PASSWORD = 'ChangeMe123!';
const DEFAULT_ACCESS_SECRET = 'replace_me_access_secret';
const DEFAULT_REFRESH_SECRET = 'replace_me_refresh_secret';
const SMS_PROVIDER_VALUES = new Set(['mock', 'aliyun']);
const STORAGE_PROVIDER_VALUES = new Set(['mock', 'minio', 's3', 'oss', 'cos', 'r2']);
const AI_PROVIDER_VALUES = new Set(['mock', 'openai', 'openai-compatible']);
const MAP_PROVIDER_VALUES = new Set(['mock', 'amap', 'disabled']);

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

  return origins;
}

export function getJwtAccessSecret(env: EnvSource = process.env): string {
  return requireEnvValue(env, 'JWT_ACCESS_SECRET');
}

export function getJwtRefreshSecret(env: EnvSource = process.env): string {
  return requireEnvValue(env, 'JWT_REFRESH_SECRET');
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
  return resolveProviderValue(env, 'MAP_PROVIDER', MAP_PROVIDER_VALUES, {
    relaxedDefault: 'mock',
    allowMockInStrict: false,
  }) as MapProviderName;
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
  if (mapProvider === 'disabled') {
    throw new Error('MAP_PROVIDER=disabled is not allowed outside local/test environments');
  }
  if (mapProvider === 'amap') {
    requireEnvValue(env, 'MAP_API_KEY');
  }
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

export function validateRuntimeConfig(config: Record<string, unknown>): Record<string, unknown> {
  const accessSecret = getJwtAccessSecret(config);
  const refreshSecret = getJwtRefreshSecret(config);

  getAppPort(config);
  resolveCorsOrigins(config);
  if (isSmsEnabled(config)) {
    getSmsProviderName(config);
  }
  getStorageProviderName(config);
  getAiProviderName(config);
  getMapProviderName(config);

  if (isStrictEnvironment(config)) {
    validateStrictProviderConfig(config);

    if (isPlaceholderSecret(accessSecret, 'JWT_ACCESS_SECRET')) {
      throw new Error('JWT_ACCESS_SECRET cannot use the placeholder value outside local/test environments');
    }

    if (isPlaceholderSecret(refreshSecret, 'JWT_REFRESH_SECRET')) {
      throw new Error('JWT_REFRESH_SECRET cannot use the placeholder value outside local/test environments');
    }

    validateStrictJwtSecrets(accessSecret, refreshSecret);

    if (isAdminBootstrapAllowed(config) && getAdminInitialPassword(config) === DEFAULT_ADMIN_PASSWORD) {
      throw new Error('ADMIN_INITIAL_PASSWORD cannot use the default value when admin bootstrap is enabled outside local/test environments');
    }
  }

  return config;
}
