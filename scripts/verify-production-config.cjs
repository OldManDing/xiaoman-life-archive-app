const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

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
  'AUTH_RATE_LIMIT_WINDOW_MS',
  'AUTH_RATE_LIMIT_MAX_ATTEMPTS',
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
  'BACKUP_RETENTION_DAYS',
  'BACKUP_RUNBOOK_URL',
  'BACKUP_RESTORE_DRILL_AT',
  'ALERT_CONTACT_NAME',
  'ALERT_CONTACT_CHANNEL',
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

function isPlaceholderLike(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return true;
  if (isPlaceholder(normalized)) return true;
  return ['your', 'replace', 'placeholder', 'changeme', 'change_me', 'example', 'dummy', 'mock', 'todo'].some((token) =>
    normalized.includes(token),
  );
}

function fail(message) {
  throw new Error(message);
}

function requireKey(env, key) {
  if (!(key in env)) fail(`缺少必填变量：${key}`);
}

function requireConfiguredValue(env, key, allowPlaceholders) {
  requireKey(env, key);
  const value = String(env[key] ?? '').trim();
  if (allowPlaceholders && isPlaceholder(value)) return;
  if (!value) fail(`${key} cannot be empty`);
  if (!allowPlaceholders && isPlaceholderLike(value)) {
    fail(`${key} still looks like a placeholder and must be replaced with a real production value`);
  }
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

function validateBackupRecovery(env) {
  const retentionDays = Number(env.BACKUP_RETENTION_DAYS);
  if (!Number.isInteger(retentionDays) || retentionDays < 90) {
    fail(`BACKUP_RETENTION_DAYS 必须是不小于 90 的整数，当前为 ${env.BACKUP_RETENTION_DAYS}`);
  }

  try {
    const url = new URL(env.BACKUP_RUNBOOK_URL);
    if (url.protocol !== 'https:') {
      fail(`BACKUP_RUNBOOK_URL 必须使用 HTTPS：${env.BACKUP_RUNBOOK_URL}`);
    }
  } catch (_error) {
    fail(`BACKUP_RUNBOOK_URL 不是有效 URL：${env.BACKUP_RUNBOOK_URL}`);
  }

  if (Number.isNaN(Date.parse(env.BACKUP_RESTORE_DRILL_AT))) {
    fail(`BACKUP_RESTORE_DRILL_AT 不是有效时间：${env.BACKUP_RESTORE_DRILL_AT}`);
  }

  if (!String(env.ALERT_CONTACT_NAME ?? '').trim()) {
    fail('ALERT_CONTACT_NAME 不能为空');
  }

  if (!String(env.ALERT_CONTACT_CHANNEL ?? '').trim()) {
    fail('ALERT_CONTACT_CHANNEL 不能为空');
  }
}

function providerErrorSummary(error) {
  if (!(error instanceof Error)) return String(error).slice(0, 240);
  return [error.name, error.message].filter(Boolean).join(': ').slice(0, 240);
}

function storageCorsOrigin(env) {
  const configured = String(env.CORS_ORIGINS ?? '').split(',')[0]?.trim();
  if (configured && configured !== '*') return configured;
  const fallback = String(env.APP_BASE_URL ?? '').trim();
  if (!fallback) return 'https://nianlun.xmlga.top';
  try {
    return new URL(fallback).origin;
  } catch (_error) {
    return 'https://nianlun.xmlga.top';
  }
}

async function assertStorageCors(uploadUrl, env, timeoutMs) {
  const origin = storageCorsOrigin(env);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 15000);
  try {
    const response = await fetch(uploadUrl, {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'PUT',
        'Access-Control-Request-Headers': 'content-type',
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      fail(`STORAGE CORS preflight failed: HTTP ${response.status}`);
    }

    const allowOrigin = response.headers.get('access-control-allow-origin') || '';
    const allowMethods = response.headers.get('access-control-allow-methods') || '';
    const allowHeaders = response.headers.get('access-control-allow-headers') || '';

    if (allowOrigin !== '*' && allowOrigin !== origin) {
      fail(`STORAGE CORS preflight origin expected ${origin} or *, got ${allowOrigin || '<missing>'}`);
    }
    if (!allowMethods.toUpperCase().split(/\s*,\s*/).includes('PUT')) {
      fail(`STORAGE CORS preflight must allow PUT, got ${allowMethods || '<missing>'}`);
    }
    if (allowHeaders !== '*' && !allowHeaders.toLowerCase().split(/\s*,\s*/).includes('content-type')) {
      fail(`STORAGE CORS preflight must allow content-type, got ${allowHeaders || '<missing>'}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function validateStorageProvider(env, options) {
  requireConfiguredValue(env, 'STORAGE_REGION', options.allowPlaceholders);
  requireConfiguredValue(env, 'STORAGE_BUCKET', options.allowPlaceholders);
  requireConfiguredValue(env, 'STORAGE_ENDPOINT', options.allowPlaceholders);
  requireConfiguredValue(env, 'STORAGE_ACCESS_KEY', options.allowPlaceholders);
  requireConfiguredValue(env, 'STORAGE_SECRET_KEY', options.allowPlaceholders);

  const storageValues = ['STORAGE_REGION', 'STORAGE_BUCKET', 'STORAGE_ENDPOINT', 'STORAGE_ACCESS_KEY', 'STORAGE_SECRET_KEY'];
  if (options.allowPlaceholders && storageValues.some((key) => String(env[key] ?? '').includes('<'))) return;

  try {
    new URL(env.STORAGE_ENDPOINT);
  } catch (_error) {
    fail(`STORAGE_ENDPOINT is not a valid URL: ${env.STORAGE_ENDPOINT}`);
  }

  if (!options.checkExternalProviders) return;

  const timeoutMs = Number(process.env.VERIFY_EXTERNAL_PROVIDER_TIMEOUT_MS || 15000);
  const body = Buffer.from(`nianlun-storage-provider-check:${new Date().toISOString()}`, 'utf8');
  const key = `production-readiness/${Date.now()}-${randomUUID()}.jpg`;
  const mimeType = 'image/jpeg';
  const client = new S3Client({
    region: env.STORAGE_REGION || 'auto',
    endpoint: env.STORAGE_ENDPOINT,
    forcePathStyle: String(env.STORAGE_FORCE_PATH_STYLE ?? 'true').toLowerCase() === 'true',
    credentials: {
      accessKeyId: env.STORAGE_ACCESS_KEY,
      secretAccessKey: env.STORAGE_SECRET_KEY,
    },
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 15000);
  let created = false;
  try {
    const putCommand = new PutObjectCommand({
      Bucket: env.STORAGE_BUCKET,
      Key: key,
      ContentType: mimeType,
    });
    const uploadUrl = await getSignedUrl(client, putCommand, { expiresIn: 120 });

    await assertStorageCors(uploadUrl, env, timeoutMs);

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': mimeType,
      },
      body,
      signal: controller.signal,
    });
    if (!uploadResponse.ok) {
      fail(`STORAGE signed upload failed: HTTP ${uploadResponse.status}`);
    }
    created = true;

    const accessUrl = await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: env.STORAGE_BUCKET,
        Key: key,
      }),
      { expiresIn: 120 },
    );
    const accessResponse = await fetch(accessUrl, { method: 'GET', signal: controller.signal });
    if (!accessResponse.ok) {
      fail(`STORAGE signed access failed: HTTP ${accessResponse.status}`);
    }
    const downloaded = Buffer.from(await accessResponse.arrayBuffer());
    if (!downloaded.equals(body)) {
      fail('STORAGE provider validation read back different object content');
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('STORAGE provider')) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      fail(`STORAGE provider validation timed out after ${timeoutMs}ms`);
    }
    fail(`STORAGE provider validation failed: ${providerErrorSummary(error)}`);
  } finally {
    clearTimeout(timeout);
    if (created) {
      try {
        await client.send(
          new DeleteObjectCommand({
            Bucket: env.STORAGE_BUCKET,
            Key: key,
          }),
        );
      } catch (error) {
        fail(`STORAGE provider validation cleanup failed: ${providerErrorSummary(error)}`);
      }
    }
  }
}

async function validateAmapProvider(env, options) {
  if (String(env.MAP_PROVIDER).toLowerCase() !== 'amap') return;

  requireConfiguredValue(env, 'MAP_API_KEY', options.allowPlaceholders);
  requireConfiguredValue(env, 'MAP_AMAP_ENDPOINT', options.allowPlaceholders);
  if (options.allowPlaceholders && isPlaceholder(String(env.MAP_API_KEY ?? '').trim())) return;

  let endpoint;
  try {
    endpoint = new URL(env.MAP_AMAP_ENDPOINT);
  } catch (_error) {
    fail(`MAP_AMAP_ENDPOINT is not a valid URL: ${env.MAP_AMAP_ENDPOINT}`);
  }

  if (!options.checkExternalProviders) return;

  const keyword = String(process.env.VERIFY_AMAP_KEYWORD || '公园').trim();
  const timeoutMs = Number(process.env.VERIFY_EXTERNAL_PROVIDER_TIMEOUT_MS || env.MAP_REQUEST_TIMEOUT_MS || 8000);
  endpoint.searchParams.set('key', env.MAP_API_KEY);
  endpoint.searchParams.set('keywords', keyword);
  endpoint.searchParams.set('offset', '1');
  endpoint.searchParams.set('page', '1');
  endpoint.searchParams.set('extensions', 'base');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 8000);
  try {
    const response = await fetch(endpoint, { signal: controller.signal });
    if (!response.ok) {
      fail(`MAP_API_KEY validation request failed: HTTP ${response.status}`);
    }
    const payload = await response.json();
    if (payload.status !== '1') {
      fail(`MAP_API_KEY failed AMap POI validation: ${payload.info || 'UNKNOWN_ERROR'}`);
    }
    if (!Array.isArray(payload.pois) || payload.pois.length === 0) {
      fail('MAP_API_KEY validation did not return real POI results');
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('MAP_API_KEY')) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      fail(`MAP_API_KEY validation timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function parseProviderErrorBody(text) {
  try {
    const parsed = JSON.parse(text);
    const error = parsed?.error;
    if (error && typeof error === 'object') {
      return [error.code, error.message].filter(Boolean).join(': ');
    }
  } catch (_error) {
    // Fall through to a short text snippet.
  }

  return text.slice(0, 300);
}

async function validateAiProvider(env, options) {
  const provider = String(env.AI_PROVIDER).toLowerCase();
  if (!['openai', 'openai-compatible'].includes(provider)) return;

  requireConfiguredValue(env, 'AI_API_KEY', options.allowPlaceholders);
  requireConfiguredValue(env, 'AI_BASE_URL', options.allowPlaceholders);
  requireConfiguredValue(env, 'AI_MODEL', options.allowPlaceholders);

  let baseUrl;
  try {
    baseUrl = new URL(env.AI_BASE_URL);
  } catch (_error) {
    fail(`AI_BASE_URL is not a valid URL: ${env.AI_BASE_URL}`);
  }

  const normalizedPath = baseUrl.pathname.replace(/\/+$/, '').toLowerCase();
  if (normalizedPath.endsWith('/chat/completions')) {
    fail('AI_BASE_URL must be the API root; do not include /chat/completions because the service appends it');
  }
  if (normalizedPath.includes('/api/coding/')) {
    fail('AI_BASE_URL must point to a chat-completions compatible API root, not the Ark coding API');
  }

  if (options.allowPlaceholders && isPlaceholder(String(env.AI_API_KEY ?? '').trim())) return;
  if (options.allowPlaceholders && isPlaceholder(String(env.AI_MODEL ?? '').trim())) return;

  if (!options.checkExternalProviders) return;

  const timeoutMs = Number(process.env.VERIFY_EXTERNAL_PROVIDER_TIMEOUT_MS || env.AI_TIMEOUT_MS || 15000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 15000);
  try {
    const response = await fetch(`${env.AI_BASE_URL.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.AI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.AI_MODEL,
        temperature: 0.1,
        messages: [
          { role: 'system', content: '只输出 JSON。' },
          { role: 'user', content: '{"ping":"production-ai-provider-check"}' },
        ],
      }),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      fail(`AI provider validation request failed: HTTP ${response.status} ${parseProviderErrorBody(text)}`);
    }
    let payload;
    try {
      payload = JSON.parse(text);
    } catch (_error) {
      fail('AI provider validation did not return JSON');
    }
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      fail('AI provider validation did not return chat completion content');
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('AI provider')) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      fail(`AI provider validation timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function validateNoPlaceholders(env) {
  for (const [key, value] of Object.entries(env)) {
    if (isPlaceholder(value)) {
      fail(`${key} 仍是占位符，必须替换为真实值`);
    }
  }
}

async function validate(filePath, options) {
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
  await validateStorageProvider(env, options);
  await validateAiProvider(env, options);
  await validateAmapProvider(env, options);
  validateNoLocalDefaults(env);
  validateSecrets(env, options.allowPlaceholders);
  validateBackupRecovery(env);

  if (!options.allowPlaceholders) {
    validateNoPlaceholders(env);
  }

  console.log(`生产配置校验通过：${filePath}`);
}

const args = process.argv.slice(2);
const templateIndex = args.indexOf('--template');
const envIndex = args.indexOf('--env');

async function main() {
  if (templateIndex !== -1) {
    await validate(resolve(process.cwd(), args[templateIndex + 1] ?? '.env.example'), {
      allowPlaceholders: true,
      checkExternalProviders: false,
    });
  } else if (envIndex !== -1) {
    await validate(resolve(process.cwd(), args[envIndex + 1] ?? '.env.production'), {
      allowPlaceholders: false,
      checkExternalProviders: process.env.VERIFY_PRODUCTION_EXTERNAL_CHECKS !== '0',
    });
  } else {
    await validate(resolve(process.cwd(), '.env.production'), {
      allowPlaceholders: false,
      checkExternalProviders: process.env.VERIFY_PRODUCTION_EXTERNAL_CHECKS !== '0',
    });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
