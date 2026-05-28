const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const ROOT = process.cwd();
const REVERSE_PROXY = resolve(ROOT, 'deploy/nginx/reverse-proxy.conf');
const SPA_CONF = resolve(ROOT, 'deploy/nginx/spa.conf');
const ENV_TEMPLATE = resolve(ROOT, '.env.example');

const REQUIRED_SECURITY_HEADERS = [
  'Content-Security-Policy',
  'X-Content-Type-Options',
  'X-Frame-Options',
  'Referrer-Policy',
  'Permissions-Policy',
];

function fail(message) {
  throw new Error(message);
}

function readText(path) {
  return readFileSync(path, 'utf8');
}

function countMatches(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

function parseEnvFile(filePath) {
  const content = readText(filePath);
  const result = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const equalIndex = line.indexOf('=');
    if (equalIndex === -1) continue;
    result[line.slice(0, equalIndex).trim()] = line.slice(equalIndex + 1).trim().replace(/^["']|["']$/g, '');
  }
  return result;
}

function assertIncludes(text, token, label) {
  if (!text.includes(token)) {
    fail(`${label} 缺少：${token}`);
  }
}

function assertRequiredHeaders(text, label, options = {}) {
  for (const header of REQUIRED_SECURITY_HEADERS) {
    assertIncludes(text, `add_header ${header}`, label);
  }

  if (options.requireHsts) {
    assertIncludes(text, 'add_header Strict-Transport-Security', label);
  }

  assertIncludes(text, 'X-Content-Type-Options nosniff', label);
  assertIncludes(text, 'X-Frame-Options DENY', label);
  assertIncludes(text, 'frame-ancestors', label);
  assertIncludes(text, 'always', label);
}

function assertReverseProxySecurity() {
  const text = readText(REVERSE_PROXY);
  assertIncludes(text, 'server_tokens off;', '生产反向代理');
  assertRequiredHeaders(text, '生产反向代理', { requireHsts: true });
  assertIncludes(text, "default-src 'none'", 'API CSP');
  assertIncludes(text, "object-src 'none'", '站点 CSP');
  assertIncludes(text, 'Referrer-Policy no-referrer', 'API Referrer-Policy');
  assertIncludes(text, 'Referrer-Policy strict-origin-when-cross-origin', '站点 Referrer-Policy');
  assertIncludes(text, 'Permissions-Policy "camera=(), microphone=(), geolocation=()"', 'API Permissions-Policy');

  const proxyPassCount = countMatches(text, /proxy_pass\s+/g);
  const hidePoweredByCount = countMatches(text, /proxy_hide_header\s+X-Powered-By\s*;/g);
  if (proxyPassCount === 0) {
    fail('生产反向代理没有 proxy_pass，无法审计上游安全头隐藏');
  }
  if (hidePoweredByCount < proxyPassCount) {
    fail(`生产反向代理有 ${proxyPassCount} 个 proxy_pass，但只有 ${hidePoweredByCount} 个 proxy_hide_header X-Powered-By`);
  }

  if (/proxy_pass\s+http:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)/i.test(text)) {
    fail('生产反向代理 proxy_pass 不能指向本地地址');
  }
}

function assertSpaSecurity() {
  const text = readText(SPA_CONF);
  assertIncludes(text, 'server_tokens off;', 'SPA Nginx');
  assertRequiredHeaders(text, 'SPA Nginx');
  assertIncludes(text, "object-src 'none'", 'SPA CSP');
  assertIncludes(text, 'connect-src', 'SPA CSP');
}

function assertCorsTemplate() {
  const env = parseEnvFile(ENV_TEMPLATE);
  const configured = env.CORS_ORIGINS;
  if (!configured) {
    fail('.env.example 缺少 CORS_ORIGINS');
  }

  const origins = configured.split(',').map((item) => item.trim()).filter(Boolean);
  if (!origins.length) {
    fail('CORS_ORIGINS 至少需要一个正式来源');
  }

  for (const origin of origins) {
    if (origin === '*' || origin.toLowerCase() === 'null') {
      fail(`CORS_ORIGINS 不能包含通配或 null：${origin}`);
    }
    let parsed;
    try {
      parsed = new URL(origin);
    } catch (_error) {
      fail(`CORS_ORIGINS 包含无效 URL：${origin}`);
    }
    if (parsed.protocol !== 'https:') {
      fail(`CORS_ORIGINS 必须使用 HTTPS：${origin}`);
    }
  }
}

try {
  assertReverseProxySecurity();
  assertSpaSecurity();
  assertCorsTemplate();
  console.log('安全基线校验通过：Nginx 安全头、X-Powered-By 隐藏和生产 CORS 模板已覆盖');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
