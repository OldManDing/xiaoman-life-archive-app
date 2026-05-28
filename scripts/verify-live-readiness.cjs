const { mkdirSync, writeFileSync } = require('node:fs');
const { dirname, resolve } = require('node:path');

const REQUIRED_SECURITY_HEADERS = [
  'strict-transport-security',
  'content-security-policy',
  'x-content-type-options',
  'x-frame-options',
  'referrer-policy',
  'permissions-policy',
];

function normalizeBaseUrl(value, fallback) {
  const raw = String(value || fallback).trim();
  if (!raw) throw new Error('Base URL is empty');
  return raw.replace(/\/+$/, '');
}

function healthUrlFromApiBase(apiBaseUrl) {
  if (/\/api\/v1$/i.test(apiBaseUrl)) return `${apiBaseUrl}/health`;
  return `${apiBaseUrl}/api/v1/health`;
}

function apiV1BaseFromApiBase(apiBaseUrl) {
  if (/\/api\/v1$/i.test(apiBaseUrl)) return apiBaseUrl;
  return `${apiBaseUrl}/api/v1`;
}

function expectedOrigin(url) {
  const parsed = new URL(url);
  return parsed.origin;
}

function fail(message) {
  throw new Error(message);
}

function assertHeader(response, headerName, label) {
  const value = response.headers.get(headerName);
  if (!value) fail(`${label} missing response header: ${headerName}`);
  return value;
}

function assertSecurityHeaders(response, label) {
  for (const header of REQUIRED_SECURITY_HEADERS) assertHeader(response, header, label);

  const contentTypeOptions = response.headers.get('x-content-type-options') || '';
  if (!contentTypeOptions.toLowerCase().includes('nosniff')) {
    fail(`${label} x-content-type-options must include nosniff`);
  }

  if (response.headers.get('x-powered-by')) {
    fail(`${label} must not expose x-powered-by`);
  }
}

async function fetchChecked(url, options, label) {
  const response = await fetch(url, {
    redirect: 'manual',
    ...options,
  });
  if (response.status < 200 || response.status >= 300) {
    let body = '';
    try {
      body = await response.text();
    } catch {
      body = '';
    }
    const suffix = body ? `: ${body.slice(0, 500)}` : '';
    fail(`${label} returned HTTP ${response.status} for ${url}${suffix}`);
  }
  return response;
}

function assertProvider(name, actual, expected) {
  if (!actual) fail(`health providers.${name} is missing`);
  if (expected && actual !== expected) {
    fail(`health providers.${name} expected ${expected}, got ${actual}`);
  }
  if (!expected && ['mock', 'disabled'].includes(actual)) {
    fail(`health providers.${name} is not production-ready: ${actual}`);
  }
}

function requiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) fail(`${name} is required for live readiness checks`);
  return value;
}

async function parseJsonResponse(response, label) {
  try {
    return await response.json();
  } catch {
    fail(`${label} did not return JSON`);
  }
}

async function loginLiveTestUser(apiBaseUrl) {
  const credential = requiredEnv('LIVE_TEST_USER_CREDENTIAL');
  const password = requiredEnv('LIVE_TEST_USER_PASSWORD');
  const apiV1Base = apiV1BaseFromApiBase(apiBaseUrl);

  const loginResponse = await fetchChecked(
    `${apiV1Base}/auth/login`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        login_type: 'password',
        credential,
        password,
      }),
    },
    'Live test user login',
  );
  const loginPayload = await parseJsonResponse(loginResponse, 'Live test user login');
  const accessToken = loginPayload?.data?.access_token;
  if (!accessToken) fail('Live test user login did not return an access token');
  return accessToken;
}

async function assertLiveAiPreview(apiBaseUrl, accessToken, expectedAiProvider) {
  const apiV1Base = apiV1BaseFromApiBase(apiBaseUrl);
  const previewResponse = await fetchChecked(
    `${apiV1Base}/ai-jobs/preview`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: '线上 AI 验收',
        content_text: '今天孩子认真观察公园里的花草，主动分享自己的发现。',
        tags: ['成长'],
      }),
    },
    'Live AI preview',
  );
  const previewPayload = await parseJsonResponse(previewResponse, 'Live AI preview');
  const data = previewPayload?.data;
  if (!data || typeof data !== 'object') fail('Live AI preview payload is missing data');
  if (data?.provider !== expectedAiProvider) {
    fail(`Live AI preview provider expected ${expectedAiProvider}, got ${data?.provider || '<missing>'}`);
  }

  const hasTextOutput =
    (typeof data.suggested_title === 'string' && data.suggested_title.trim().length > 0) ||
    (typeof data.summary === 'string' && data.summary.trim().length > 0);
  const hasTags = Array.isArray(data?.tags) && data.tags.some((tag) => String(tag || '').trim().length > 0);
  if (!hasTextOutput && !hasTags) {
    fail('Live AI preview did not return usable title, summary, or tags');
  }

  return {
    provider: data.provider,
    hasSuggestedTitle: Boolean(data.suggested_title),
    hasSummary: Boolean(data.summary),
    tagCount: Array.isArray(data.tags) ? data.tags.length : 0,
  };
}

async function assertLivePoiSearch(apiBaseUrl, expectedMapProvider, accessToken) {
  if (expectedMapProvider !== 'amap') return null;

  const keyword = String(process.env.LIVE_POI_TEST_KEYWORD || '公园').trim();
  const latitude = String(process.env.LIVE_POI_TEST_LATITUDE || '31.2304').trim();
  const longitude = String(process.env.LIVE_POI_TEST_LONGITUDE || '121.4737').trim();
  const apiV1Base = apiV1BaseFromApiBase(apiBaseUrl);

  const searchUrl = new URL(`${apiV1Base}/locations/search`);
  searchUrl.searchParams.set('keyword', keyword);
  searchUrl.searchParams.set('latitude', latitude);
  searchUrl.searchParams.set('longitude', longitude);
  const searchResponse = await fetchChecked(
    searchUrl.toString(),
    {
      method: 'GET',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    },
    'Live POI search',
  );
  const searchPayload = await parseJsonResponse(searchResponse, 'Live POI search');
  const data = searchPayload?.data;
  if (data?.provider !== 'amap') fail(`Live POI provider expected amap, got ${data?.provider || '<missing>'}`);
  const list = Array.isArray(data.list) ? data.list : [];
  if (!list.length) fail('Live POI search returned no location suggestions');
  const sources = [...new Set(list.map((item) => item?.source).filter(Boolean))];
  const poiSuggestions = list.filter((item) => item?.source === 'amap');
  if (!poiSuggestions.length) {
    fail(
      `Live POI search did not return AMap text POI suggestions; sources=${sources.join(',') || '<none>'}`,
    );
  }

  return {
    keyword,
    count: list.length,
    poiCount: poiSuggestions.length,
    sources,
    sample: poiSuggestions.slice(0, 3).map((item) => ({
      name: item.name,
      city: item.city,
      district: item.district,
      source: item.source,
    })),
  };
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function configuredMaxAttempts() {
  const raw = Number.parseInt(String(process.env.LIVE_READINESS_MAX_ATTEMPTS || '2'), 10);
  if (!Number.isFinite(raw) || raw < 1) return 2;
  return Math.min(raw, 5);
}

function configuredRetryDelayMs() {
  const raw = Number.parseInt(String(process.env.LIVE_READINESS_RETRY_DELAY_MS || '1200'), 10);
  if (!Number.isFinite(raw) || raw < 0) return 1200;
  return Math.min(raw, 10_000);
}

function isRetryableReadinessError(message) {
  const normalized = String(message || '');
  if (/INVALID_USER_KEY|InvalidSubscription|UnsupportedModel|InvalidEndpointOrModel|expected .* got|returned no location suggestions|did not return AMap text POI/i.test(normalized)) {
    return false;
  }

  return /HTTP 50[234]|timeout|timed out|超时|ECONNRESET|ETIMEDOUT|ECONNREFUSED|fetch failed|network/i.test(normalized);
}

function sleep(ms) {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function reportPath() {
  const configured = String(process.env.LIVE_READINESS_REPORT_PATH || '').trim();
  if (['0', 'false', 'off'].includes(configured.toLowerCase())) return null;
  return resolve(process.cwd(), configured || 'artifacts/app-live-audit/live-readiness-latest.json');
}

function nextActionForFailedCheck(check) {
  const error = String(check.error || '');

  if (check.name === 'aiPreview') {
    return '替换生产 AI endpoint/model/key，确保 provider 兼容 /chat/completions 并能真实返回内容；只修复 AI 时，在当前服务器 release 的 .env.server 中备份并更新 AI_*，执行 docker compose config 校验和 API 重启，然后重新执行带测试账号的 verify:live-readiness。';
  }

  if (check.name === 'poi') {
    const keyHint = error.includes('INVALID_USER_KEY')
      ? '当前错误为 INVALID_USER_KEY，优先确认使用的是高德 Web 服务 Key，且账号已开通 Web 服务 API、服务器出口限制和配额均可用。'
      : '替换生产 MAP_API_KEY 为真实可用的高德 Web 服务 Key。';
    return `${keyHint} 只修复地图时，在当前服务器 release 的 .env.server 中备份并更新 MAP_PROVIDER=amap、MAP_API_KEY、MAP_AMAP_ENDPOINT 和 MAP_REQUEST_TIMEOUT_MS，执行 docker compose config 校验和 API 重启，然后重新执行带测试账号的 verify:live-readiness。`;
  }

  return '根据失败详情修复生产配置，然后重新执行 verify:live-readiness。';
}

function blockedRequirementDetailForFailedCheck(check) {
  if (check.name === 'aiPreview') {
    return {
      requirement: 'P0-26 AI 真实调用',
      severity: 'P0',
      owner: 'AI provider 配置负责人',
      evidence: 'verify:production-env 外部 provider 校验 + 登录后 verify:live-readiness AI 预览',
      next_action: nextActionForFailedCheck(check),
    };
  }

  if (check.name === 'poi') {
    return {
      requirement: 'P1-03 地点真实 POI',
      severity: 'P1',
      owner: '地图服务配置负责人',
      evidence: '登录后 /locations/search 返回 source=amap 的文本 POI 候选',
      next_action: nextActionForFailedCheck(check),
    };
  }

  return null;
}

function blockedRequirementForFailedCheck(check) {
  return blockedRequirementDetailForFailedCheck(check)?.requirement ?? null;
}

function allowsP1Deferrals() {
  return ['1', 'true', 'yes', 'on'].includes(String(process.env.LIVE_READINESS_ALLOW_P1_DEFERRALS || '').trim().toLowerCase());
}

function canConditionallyPass(report) {
  const details = Array.isArray(report?.blockedRequirementDetails) ? report.blockedRequirementDetails : [];
  if (!details.length) return false;
  return details.every((item) => item?.severity !== 'P0');
}

function buildReadinessReport(status, summary, error) {
  const checks = Array.isArray(summary?.checks) ? summary.checks : [];
  const failed = checks.filter((check) => check.status === 'failed');
  const blockedRequirementDetails = error
    ? [
        {
          requirement: 'live readiness 总体验证',
          severity: 'P0',
          owner: '发布负责人',
          evidence: 'verify:live-readiness 总体入口、安全头、CORS、登录或 provider 聚合检查',
          next_action: '修复报告中的 readiness 失败项，然后重新执行 verify:live-readiness。',
        },
      ]
    : [
        ...new Map(
          failed
            .map(blockedRequirementDetailForFailedCheck)
            .filter(Boolean)
            .map((item) => [item.requirement, item]),
        ).values(),
      ];
  const blockedRequirements = blockedRequirementDetails.map((item) => item.requirement);

  return {
    status,
    checkedAt: new Date().toISOString(),
    api: summary?.api,
    app: summary?.app,
    admin: summary?.admin,
    providers: summary?.providers,
    checks,
    failures: error
      ? [{ name: 'readiness', error: errorMessage(error) }]
      : failed.map((check) => ({ name: check.name, error: check.error })),
    blockedRequirements,
    blockedRequirementDetails,
    nextActions: blockedRequirementDetails.map((item) => item.next_action),
  };
}

function writeReadinessReport(report) {
  const outputPath = reportPath();
  if (!outputPath) return;

  try {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`Live readiness report written to ${outputPath}`);
  } catch (error) {
    console.error(`Failed to write live readiness report: ${errorMessage(error)}`);
  }
}

async function runReadinessCheck(name, fn) {
  const maxAttempts = configuredMaxAttempts();
  const retryDelayMs = configuredRetryDelayMs();
  const retryErrors = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = {
        name,
        status: 'passed',
        attempts: attempt,
        data: await fn(),
      };
      if (retryErrors.length) result.retry_errors = retryErrors;
      return result;
    } catch (error) {
      const message = errorMessage(error);
      const retryable = attempt < maxAttempts && isRetryableReadinessError(message);
      if (!retryable) {
        return {
          name,
          status: 'failed',
          attempts: attempt,
          error: message,
          ...(retryErrors.length ? { retry_errors: retryErrors } : {}),
        };
      }

      retryErrors.push({ attempt, error: message });
      await sleep(retryDelayMs);
    }
  }

  return {
    name,
    status: 'failed',
    attempts: maxAttempts,
    error: 'live readiness check exhausted retry attempts',
    ...(retryErrors.length ? { retry_errors: retryErrors } : {}),
  };
}

async function main() {
  const apiBaseUrl = normalizeBaseUrl(process.env.LIVE_API_BASE_URL || process.env.API_BASE_URL, 'https://webapi.xmlga.top');
  const appBaseUrl = normalizeBaseUrl(process.env.LIVE_APP_BASE_URL || process.env.APP_BASE_URL, 'https://nianlun.xmlga.top');
  const adminBaseUrl = normalizeBaseUrl(process.env.LIVE_ADMIN_BASE_URL || process.env.ADMIN_BASE_URL, appBaseUrl);
  const expectedMapProvider = String(process.env.LIVE_EXPECT_MAP_PROVIDER || 'amap').trim().toLowerCase();
  const appOrigin = expectedOrigin(appBaseUrl);
  const healthUrl = healthUrlFromApiBase(apiBaseUrl);

  const healthResponse = await fetchChecked(
    healthUrl,
    {
      method: 'GET',
      headers: {
        Origin: appOrigin,
      },
    },
    'API health',
  );
  assertSecurityHeaders(healthResponse, 'API health');

  const allowOrigin = healthResponse.headers.get('access-control-allow-origin');
  if (allowOrigin !== appOrigin) {
    fail(`API health CORS origin expected ${appOrigin}, got ${allowOrigin || '<missing>'}`);
  }
  const allowCredentials = healthResponse.headers.get('access-control-allow-credentials');
  if (allowCredentials !== 'true') {
    fail(`API health CORS credentials expected true, got ${allowCredentials || '<missing>'}`);
  }

  const healthPayload = await healthResponse.json();
  const health = healthPayload && healthPayload.data;
  if (!health || health.status !== 'ok') fail('API health payload is not ok');
  if (health.database !== 'up') fail(`API database expected up, got ${health.database || '<missing>'}`);
  if (!health.runtime || health.runtime.app_env !== 'production') {
    fail(`API runtime app_env expected production, got ${health.runtime?.app_env || '<missing>'}`);
  }

  assertProvider('storage', health.providers?.storage);
  assertProvider('ai', health.providers?.ai);
  assertProvider('map', health.providers?.map, expectedMapProvider);

  const appResponse = await fetchChecked(appBaseUrl, { method: 'GET' }, 'App/Admin entry');
  assertSecurityHeaders(appResponse, 'App/Admin entry');

  if (adminBaseUrl !== appBaseUrl) {
    const adminResponse = await fetchChecked(adminBaseUrl, { method: 'GET' }, 'Admin entry');
    assertSecurityHeaders(adminResponse, 'Admin entry');
  }

  const accessToken = await loginLiveTestUser(apiBaseUrl);
  const checks = await Promise.all([
    runReadinessCheck('aiPreview', () => assertLiveAiPreview(apiBaseUrl, accessToken, health.providers.ai)),
    runReadinessCheck('poi', () => assertLivePoiSearch(apiBaseUrl, expectedMapProvider, accessToken)),
  ]);
  const summary = {
    api: healthUrl,
    app: appBaseUrl,
    admin: adminBaseUrl,
    providers: health.providers,
    checks,
  };
  const failed = checks.filter((check) => check.status === 'failed');

  if (failed.length) {
    const failedReport = buildReadinessReport('failed', summary);
    if (allowsP1Deferrals() && canConditionallyPass(failedReport)) {
      const conditionalReport = { ...failedReport, status: 'conditional_pass' };
      writeReadinessReport(conditionalReport);
      console.warn(`Live readiness conditionally passed with deferred requirements: ${conditionalReport.blockedRequirements.join(', ')}`);
      console.warn(JSON.stringify(summary, null, 2));
      return;
    }

    writeReadinessReport(failedReport);
    console.error(`Live readiness check failed: ${failed.map((check) => check.name).join(', ')}`);
    console.error(JSON.stringify(summary, null, 2));
    process.exit(1);
  }

  writeReadinessReport(buildReadinessReport('passed', summary));
  console.log('Live readiness check passed');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  writeReadinessReport(buildReadinessReport('failed', null, error));
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
