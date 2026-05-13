const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const REQUIRED_KEYS = [
  'NODE_ENV',
  'APP_ENV',
  'APP_PORT',
  'APP_BASE_URL',
  'ADMIN_BOOTSTRAP_ENABLED',
  'DATABASE_URL',
  'MYSQL_ROOT_PASSWORD',
  'MYSQL_DATABASE',
  'MYSQL_USER',
  'MYSQL_PASSWORD',
  'REDIS_HOST',
  'REDIS_PORT',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'STORAGE_PROVIDER',
  'STORAGE_REGION',
  'STORAGE_BUCKET',
  'STORAGE_ENDPOINT',
  'STORAGE_ACCESS_KEY',
  'STORAGE_SECRET_KEY',
  'STORAGE_FORCE_PATH_STYLE',
  'STORAGE_PUBLIC_BASE_URL',
  'STORAGE_SIGNED_URL_EXPIRES_IN',
  'AI_PROVIDER',
  'AI_API_KEY',
  'AI_BASE_URL',
  'AI_MODEL',
  'MAP_PROVIDER',
  'MAP_API_KEY',
  'MAP_AMAP_ENDPOINT',
  'SMS_ENABLED',
  'ADMIN_INITIAL_USERNAME',
  'ADMIN_INITIAL_PASSWORD',
  'VITE_API_BASE_URL',
  'VITE_APP_NAME',
  'VITE_ADMIN_APP_NAME',
  'CORS_ORIGINS',
];

const FORBIDDEN_EXACT_VALUES = new Set([
  'replace_me_access_secret',
  'replace_me_refresh_secret',
  'ChangeMe123!',
  'minioadmin',
  'root',
  'password',
  '123456',
]);

const LOCAL_ONLY_KEYS = [
  'APP_BASE_URL',
  'DATABASE_URL',
  'STORAGE_ENDPOINT',
  'STORAGE_PUBLIC_BASE_URL',
  'VITE_API_BASE_URL',
  'CORS_ORIGINS',
];

function parseEnvFile(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const result = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const equalIndex = line.indexOf('=');
    if (equalIndex === -1) continue;
    const key = line.slice(0, equalIndex).trim();
    const value = line.slice(equalIndex + 1).trim().replace(/^["']|["']$/g, '');
    result[key] = value;
  }

  return result;
}

function isPlaceholder(value) {
  return /^<[^>]+>$/.test(value);
}

function fail(message) {
  throw new Error(message);
}

function requireKey(env, key) {
  if (!(key in env)) fail(`缺少必填变量：${key}`);
}

function validateProvider(env, name, expected) {
  requireKey(env, name);
  const value = String(env[name]).toLowerCase();
  if (!expected.includes(value)) {
    fail(`${name} 必须是 ${expected.join(' / ')}，当前为 ${env[name]}`);
  }
  if (value === 'mock') {
    fail(`${name}=mock 不能用于生产模板或生产环境`);
  }
}

function isEnabled(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());
}

function validateNoLocalDefaults(env) {
  for (const [key, value] of Object.entries(env)) {
    if (FORBIDDEN_EXACT_VALUES.has(value)) {
      fail(`${key} 仍在使用默认值：${value}`);
    }
  }

  for (const key of LOCAL_ONLY_KEYS) {
    const value = env[key];
    if (value && /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(value)) {
      fail(`${key} 仍包含本地地址：${value}`);
    }
  }
}

function validateSecrets(env, allowPlaceholders) {
  const access = env.JWT_ACCESS_SECRET;
  const refresh = env.JWT_REFRESH_SECRET;

  if (access === refresh) {
    fail('JWT_ACCESS_SECRET 和 JWT_REFRESH_SECRET 不能相同');
  }

  const secretKeys = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
  if (isEnabled(env.SMS_ENABLED)) {
    secretKeys.push('SMS_CODE_PEPPER');
  }

  for (const key of secretKeys) {
    const value = env[key] ?? '';
    if (allowPlaceholders && isPlaceholder(value)) continue;
    if (value.length < 32) {
      fail(`${key} 长度不足 32 个字符`);
    }
  }
}

function validateNoPlaceholders(env) {
  for (const [key, value] of Object.entries(env)) {
    if (isPlaceholder(value)) {
      fail(`${key} 仍是占位符，必须替换为真实值`);
    }
  }
}

function validate(filePath, options) {
  const env = parseEnvFile(filePath);
  for (const key of REQUIRED_KEYS) requireKey(env, key);

  if (!['production', 'prod', 'staging'].includes(String(env.APP_ENV).toLowerCase())) {
    fail(`APP_ENV 必须是 production/prod/staging，当前为 ${env.APP_ENV}`);
  }

  if (isEnabled(env.SMS_ENABLED)) {
    for (const key of ['SMS_PROVIDER', 'SMS_ACCESS_KEY', 'SMS_SECRET_KEY', 'SMS_SIGN_NAME', 'SMS_TEMPLATE_CODE', 'SMS_CODE_PEPPER']) {
      requireKey(env, key);
    }
    validateProvider(env, 'SMS_PROVIDER', ['aliyun']);
  }
  validateProvider(env, 'STORAGE_PROVIDER', ['oss', 'cos', 's3', 'r2', 'minio']);
  validateProvider(env, 'AI_PROVIDER', ['openai', 'openai-compatible']);
  validateProvider(env, 'MAP_PROVIDER', ['amap']);
  validateNoLocalDefaults(env);
  validateSecrets(env, options.allowPlaceholders);

  if (!options.allowPlaceholders) {
    validateNoPlaceholders(env);
  }

  console.log(`生产配置校验通过：${filePath}`);
}

const args = process.argv.slice(2);
const templateIndex = args.indexOf('--template');
const envIndex = args.indexOf('--env');

try {
  if (templateIndex !== -1) {
    validate(resolve(process.cwd(), args[templateIndex + 1] ?? '.env.example'), { allowPlaceholders: true });
  } else if (envIndex !== -1) {
    validate(resolve(process.cwd(), args[envIndex + 1] ?? '.env.production'), { allowPlaceholders: false });
  } else {
    validate(resolve(process.cwd(), '.env.production'), { allowPlaceholders: false });
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
