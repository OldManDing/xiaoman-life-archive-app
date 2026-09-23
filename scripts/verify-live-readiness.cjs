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

function optionalEnv(name) {
  return String(process.env[name] || '').trim();
}

// 联调需要准备的环境变量清单（离线预检用，不联网）。
// 直接跑完整检查会在第一个缺失项就退出，运维改一个变量跑一次很费时间，所以先给一次列全。
const READINESS_ENV_PLAN = [
  {
    name: 'LIVE_TEST_USER_CREDENTIAL',
    required: true,
    purpose: '线上测试账号（手机号或用户编号），用于登录 App API 跑 AI / POI 检查',
    example: '13800000000',
  },
  {
    name: 'LIVE_TEST_USER_PASSWORD',
    required: true,
    purpose: '上面这个账号的密码',
    example: 'DemoUser123!',
  },
  {
    name: 'LIVE_AI_TEST_USER_CREDENTIAL',
    required: false,
    purpose: 'AI 会员账号（测试账号本身不是 AI 会员时用它；与密码必须同时给）',
    example: '13900000000',
  },
  {
    name: 'LIVE_AI_TEST_USER_PASSWORD',
    required: false,
    purpose: '上面的 AI 会员账号密码',
    example: 'DemoUser123!',
  },
  {
    name: 'LIVE_API_BASE_URL',
    required: false,
    purpose: '线上 API 地址（默认 https://webapi.xmlga.top）',
    example: 'https://webapi.xmlga.top',
  },
  {
    name: 'LIVE_APP_BASE_URL',
    required: false,
    purpose: '线上 App/后台入口（默认 https://nianlun.xmlga.top）',
    example: 'https://nianlun.xmlga.top',
  },
  {
    name: 'LIVE_ADMIN_BASE_URL',
    required: false,
    purpose: '后台独立域名（与 App 不同域时填，默认同上）',
    example: 'https://admin.xmlga.top',
  },
  {
    name: 'LIVE_EXPECT_MAP_PROVIDER',
    required: false,
    purpose: '期望的地图供应商（默认 amap）',
    example: 'amap',
  },
  {
    name: 'LIVE_POI_TEST_KEYWORD',
    required: false,
    purpose: 'POI 检索用的关键词（默认 公园）',
    example: '公园',
  },
  {
    name: 'LIVE_POI_TEST_LATITUDE',
    required: false,
    purpose: 'POI 检索中心点纬度（默认 31.2304，上海）',
    example: '31.2304',
  },
  {
    name: 'LIVE_POI_TEST_LONGITUDE',
    required: false,
    purpose: 'POI 检索中心点经度（默认 121.4737）',
    example: '121.4737',
  },
  {
    name: 'LIVE_READINESS_MAX_ATTEMPTS',
    required: false,
    purpose: '可重试失败的最大尝试次数（默认 2）',
    example: '2',
  },
  {
    name: 'LIVE_READINESS_RETRY_DELAY_MS',
    required: false,
    purpose: '重试间隔毫秒（默认 1200）',
    example: '1200',
  },
  {
    name: 'LIVE_READINESS_ALLOW_P1_DEFERRALS',
    required: false,
    purpose: '允许 P1 项延后（置 1 时，仅剩 P1 未过可判 conditional_pass）',
    example: '0',
  },
];

const isPreflight = () =>
  process.argv.includes('--preflight') || ['1', 'true', 'yes', 'on'].includes(String(process.env.LIVE_READINESS_PREFLIGHT || '').trim().toLowerCase());

function runPreflight() {
  const missingRequired = [];
  const missingOptional = [];

  console.log('上线联调预检（离线，不联网、不写报告）');
  console.log('');
  console.log('需要准备的环境变量：');
  for (const item of READINESS_ENV_PLAN) {
    const value = optionalEnv(item.name);
    const status = value ? '已设置' : item.required ? '缺失（必填）' : '未设置（有默认值）';
    console.log(`  [${status}] ${item.name}`);
    console.log(`      用途：${item.purpose}`);
    if (!value) console.log(`      示例：${item.example}`);
    if (!value && item.required) missingRequired.push(item.name);
    if (!value && !item.required) missingOptional.push(item.name);
  }

  console.log('');
  console.log('另外需要确认（这些由部署侧配置，脚本只能连上后校验）：');
  console.log('  - 线上 API /health 的 providers.storage / providers.ai 不能是 mock 或 disabled');
  console.log(`  - providers.map 必须等于 ${optionalEnv('LIVE_EXPECT_MAP_PROVIDER') || 'amap'}`);
  console.log('  - API 与入口页要带安全响应头，且 CORS 只放行 App 域名并允许凭据');
  console.log('  - runtime.app_env 必须是 production，database 必须是 up');

  console.log('');
  if (missingRequired.length) {
    console.error(`预检未通过：还缺 ${missingRequired.length} 个必填变量 —— ${missingRequired.join(', ')}`);
    console.error('补齐后重新执行：npm run verify:live-preflight');
    process.exitCode = 1;
    return;
  }

  console.log(`预检通过：必填变量已就绪${missingOptional.length ? `（可选变量未设置 ${missingOptional.length} 个，将使用默认值）` : ''}。`);
  console.log('下一步：npm run verify:live-readiness（会联网校验，并把报告写到');
  console.log('       artifacts/app-live-audit/live-readiness-latest.json，后台「系统运维 → 上线验收门禁」读这份报告）。');
}

async function parseJsonResponse(response, label) {
  try {
    return await response.json();
  } catch {
    fail(`${label} did not return JSON`);
  }
}

async function loginLiveUser(apiBaseUrl, credential, password, label) {
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
    label,
  );
  const loginPayload = await parseJsonResponse(loginResponse, label);
  const accessToken = loginPayload?.data?.access_token;
  if (!accessToken) fail(`${label} did not return an access token`);
  return {
    accessToken,
    user: loginPayload?.data?.user || null,
  };
}

async function loginLiveTestUser(apiBaseUrl) {
  return loginLiveUser(
    apiBaseUrl,
    requiredEnv('LIVE_TEST_USER_CREDENTIAL'),
    requiredEnv('LIVE_TEST_USER_PASSWORD'),
    'Live test user login',
  );
}

async function resolveLiveAiUser(apiBaseUrl, primarySession) {
  const credential = optionalEnv('LIVE_AI_TEST_USER_CREDENTIAL');
  const password = optionalEnv('LIVE_AI_TEST_USER_PASSWORD');
  if (credential || password) {
    if (!credential || !password) fail('LIVE_AI_TEST_USER_CREDENTIAL and LIVE_AI_TEST_USER_PASSWORD must be set together');
    return loginLiveUser(apiBaseUrl, credential, password, 'Live AI member login');
  }

  if (primarySession?.user?.membership_type === 'ai_plus') return primarySession;
  return null;
}

async function assertLiveAiAccessControl(apiBaseUrl, accessToken) {
  const apiV1Base = apiV1BaseFromApiBase(apiBaseUrl);
  const previewResponse = await fetch(`${apiV1Base}/ai-jobs/preview`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      title: '普通用户 AI 权限验收',
      content_text: '普通用户不应拥有 AI 生成入口。',
      tags: ['成长'],
    }),
  });
  const previewPayload = await parseJsonResponse(previewResponse, 'Live AI access control');
  if (previewResponse.status !== 403) {
    fail(`Live AI access control expected HTTP 403, got ${previewResponse.status}`);
  }
  if (!String(previewPayload?.message || '').includes('AI 功能仅对 AI 会员开放')) {
    fail(`Live AI access control returned unexpected message: ${previewPayload?.message || '<missing>'}`);
  }

  return {
    forbidden: true,
    message: previewPayload.message,
  };
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

  if (check.name === 'aiAccessControl') {
    return '确认普通用户 membership_type 不为 ai_plus 时，/ai-jobs/preview 与 /records/:record_no/ai-jobs 返回 403；修复 AI 会员权限判断后重新执行 verify:live-readiness。';
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

  if (check.name === 'aiAccessControl') {
    return {
      requirement: 'P0-26 AI 会员权限',
      severity: 'P0',
      owner: 'AI 产品权限负责人',
      evidence: '普通用户登录后 verify:live-readiness AI 访问控制检查',
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
  if (isPreflight()) {
    runPreflight();
    return;
  }

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

  const testSession = await loginLiveTestUser(apiBaseUrl);
  const aiSession = await resolveLiveAiUser(apiBaseUrl, testSession);
  const checks = await Promise.all([
    runReadinessCheck('aiAccessControl', () => assertLiveAiAccessControl(apiBaseUrl, testSession.accessToken)),
    runReadinessCheck(
      'aiPreview',
      aiSession
        ? () => assertLiveAiPreview(apiBaseUrl, aiSession.accessToken, health.providers.ai)
        : () => ({
            skipped: true,
            reason: 'LIVE_AI_TEST_USER_CREDENTIAL not configured and live test user is not an AI member',
          }),
    ),
    runReadinessCheck('poi', () => assertLivePoiSearch(apiBaseUrl, expectedMapProvider, testSession.accessToken)),
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
