const fs = require('node:fs');
const path = require('node:path');

const ROOT = 'F:/https-github-com-oldmanding-xiaoman-life';
const CDP_LIST_URL = 'http://127.0.0.1:9223/json/list';
const API_V1_BASE = 'https://webapi.xmlga.top/api/v1';
const ARTIFACT_DIR = path.join(ROOT, 'artifacts', 'huawei-product-smoke-20260615');
const REPORT_PATH = path.join(ARTIFACT_DIR, 'report.json');

const OLD_AI_PATTERN = /AI 服务调用失败|API Key 所属分组已删除|HTTP 403|AI 智能|AI 整理|AI 标题|AI 摘要|AI 标签|AI 建议|AI 月报摘要/;

async function connectPage() {
  const pages = await fetch(CDP_LIST_URL).then((response) => response.json());
  const page = pages.find((item) => item.type === 'page');
  if (!page?.webSocketDebuggerUrl) throw new Error('No WebView page target found on tcp:9223');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let nextId = 1;
  const pending = new Map();

  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message || JSON.stringify(message.error)));
    else resolve(message.result);
  });

  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  const send = (method, params = {}) => {
    const id = nextId++;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  };

  const evaluate = async (expression, awaitPromise = true) => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || JSON.stringify(result.exceptionDetails));
    }
    return result.result.value;
  };

  await send('Runtime.enable');
  await send('Page.enable');
  return { ws, send, evaluate };
}

async function waitFor(evaluate, expression, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await evaluate(expression, true);
    if (last?.ok) return last;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for condition. Last=${JSON.stringify(last)}`);
}

async function navigateAndCheck(cdp, route, name) {
  await cdp.send('Page.navigate', { url: `https://localhost${route}` });
  await waitFor(
    cdp.evaluate,
    `(() => {
      const text = document.body?.innerText || '';
      const bootstrapping = Boolean(document.querySelector('[aria-busy="true"]'));
      return { ok: location.pathname === ${JSON.stringify(route.split('?')[0])} && !bootstrapping && text.trim().length > 8, href: location.href, textLength: text.length, bootstrapping };
    })()`,
  );

  if (route === '/profile/reports') {
    await waitFor(
      cdp.evaluate,
      `(() => {
        const text = document.body?.innerText || '';
        const buttons = [...document.querySelectorAll('button')].map((button) => button.innerText.trim()).filter(Boolean);
        return {
          ok: text.includes('本月还没有记录') || text.includes('月度摘要') || buttons.some((label) => label.includes('添加记录') || label.includes('查看月报')),
          textLength: text.length,
          buttonCount: buttons.length,
        };
      })()`,
      45000,
    );
  }

  if (route === '/home') {
    await waitFor(
      cdp.evaluate,
      `(() => {
        const text = document.body?.innerText || '';
        const buttons = [...document.querySelectorAll('button')].map((button) => button.getAttribute('aria-label') || button.innerText.trim()).filter(Boolean);
        return {
          ok: text.includes('今日值得记录') || buttons.some((label) => label.includes('记录今日提示')),
          textLength: text.length,
          buttonCount: buttons.length,
        };
      })()`,
      45000,
    );
  }

  if (route === '/timeline') {
    await waitFor(
      cdp.evaluate,
      `(() => {
        const text = document.body?.innerText || '';
        const buttons = [...document.querySelectorAll('button')].map((button) => button.getAttribute('aria-label') || button.innerText.trim()).filter(Boolean);
        return {
          ok: text.includes('补一条记录') || text.includes('去创建第一条记录') || buttons.some((label) => label.includes('补一条记录') || label.includes('去创建第一条记录')),
          textLength: text.length,
          buttonCount: buttons.length,
        };
      })()`,
      45000,
    );
  }

  return captureCurrentCheck(cdp, name, route);
}

async function captureCurrentCheck(cdp, name, route = null) {
  const check = await cdp.evaluate(`(() => {
    const text = document.body?.innerText || '';
    const buttons = [...document.querySelectorAll('button')]
      .map((button) => button.getAttribute('aria-label') || button.innerText.trim())
      .filter(Boolean);
    const inputs = [...document.querySelectorAll('input, textarea, select')]
      .map((node) => ({
        tag: node.tagName.toLowerCase(),
        type: node.getAttribute('type') || '',
        placeholder: node.getAttribute('placeholder') || '',
        required: Boolean(node.required),
      }));
    const links = [...document.querySelectorAll('a[href]')]
      .map((link) => link.getAttribute('href'))
      .filter(Boolean);
    const visibleElements = [...document.body.querySelectorAll('main *, header *, section *, button, a, input, textarea')]
      .filter((node) => {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      });
    const maxBottom = visibleElements.reduce((max, node) => Math.max(max, node.getBoundingClientRect().bottom + window.scrollY), 0);
    const scrollHeight = document.scrollingElement?.scrollHeight || document.body.scrollHeight || 0;
    return {
      href: location.href,
      title: document.title,
      textLength: text.length,
      bootstrapping: Boolean(document.querySelector('[aria-busy="true"]')),
      hasAuditChild: text.includes('Audit Baby'),
      hasOldAiCopy: ${OLD_AI_PATTERN}.test(text),
      hasFreeAiButton: buttons.some((label) => /AI 智能|AI 整理|会员整理建议|整理建议|生成标题|生成摘要|生成标签|^AI\b/.test(label)),
      signals: {
        loginValue: text.includes('成长时间线') && text.includes('家庭协作') && text.includes('长期可导出'),
        inviteOptional: text.includes('邀请码（选填）') && inputs.some((input) => input.placeholder.includes('没有也能注册')),
        homeGuidance: text.includes('今日值得记录') && buttons.some((label) => label.includes('记录今日提示') || label.includes('记录')),
        timelineQuickFeedback: text.includes('补一条记录') && text.includes('照片、文字和语音都会进入时间轴'),
        recordLayering: Boolean(document.querySelector('input[placeholder="给这一刻起个名字"]')) && Boolean(document.querySelector('textarea[placeholder*="记录一下"]')),
        monthlyEmptyState: text.includes('月报空状态') && text.includes('本月还没有记录'),
        searchHierarchy: inputs.some((input) => input.placeholder.includes('搜索时间、地点、标签或内容')) && buttons.some((label) => label.includes('搜索')),
        familyCollaboration: text.includes('最近家庭动态') && (text.includes('家人寄语') || text.includes('协作内容')),
        profileArchiveState: text.includes('草稿箱') && text.includes('月报与纪念册') && text.includes('导出与备份'),
      },
      buttonCount: buttons.length,
      buttons: buttons.slice(0, 14),
      inputs,
      links: links.slice(0, 16),
      layout: {
        viewportHeight: window.innerHeight,
        scrollHeight,
        bottomGap: Math.max(0, Math.round(scrollHeight - maxBottom)),
      },
    };
  })()`);

  const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  const screenshotPath = path.join(ARTIFACT_DIR, `${name}.png`);
  fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
  return { name, route, screenshotPath, ...check };
}

async function main() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const cdp = await connectPage();
  const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const credential = `hw_product_${stamp}_${Math.floor(Math.random() * 1000)}`;
  const password = `Temp${stamp.slice(-6)}!a`;
  let token = null;
  let setup = null;
  const checks = [];

  try {
    const loginCheck = await navigateAndCheck(cdp, '/auth/login', '00-login');
    checks.push({
      ...loginCheck,
      forcedInviteRisk: loginCheck.inputs.some((input) => input.required && /邀|invite/i.test(input.placeholder)),
    });
    await cdp.evaluate(`(() => {
      const registerButton = [...document.querySelectorAll('button')].find((button) => button.innerText.trim() === '注册');
      registerButton?.click();
      return { ok: Boolean(registerButton) };
    })()`);
    await waitFor(
      cdp.evaluate,
      `(() => {
        const text = document.body?.innerText || '';
        const hasOptionalInviteInput = Boolean(document.querySelector('input[placeholder*="没有也能注册"]'));
        return { ok: text.includes('邀请码（选填）') && hasOptionalInviteInput, textLength: text.length, hasOptionalInviteInput };
      })()`,
    );
    const registerFormCheck = await captureCurrentCheck(cdp, '00-register-form', '/auth/login');
    checks.push({
      ...registerFormCheck,
      forcedInviteRisk: registerFormCheck.inputs.some((input) => input.required && /邀|invite/i.test(input.placeholder)),
    });

    setup = await cdp.evaluate(`(async () => {
      localStorage.clear();
      sessionStorage.clear();

      const registerResponse = await fetch(${JSON.stringify(`${API_V1_BASE}/auth/register`)}, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: ${JSON.stringify(credential)},
          password: ${JSON.stringify(password)},
          password_confirm: ${JSON.stringify(password)}
        })
      });
      const registerPayload = await registerResponse.json().catch(() => ({}));
      if (!registerResponse.ok || registerPayload.code !== 0) {
        return { ok: false, stage: 'register', status: registerResponse.status, message: registerPayload.message || null };
      }

      const token = registerPayload.data.access_token;
      const childResponse = await fetch(${JSON.stringify(`${API_V1_BASE}/children`)}, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          name: 'Audit Baby',
          birthday: '2022-06-01',
          gender: 'female',
          birth_place: 'Shanghai',
          remark: 'Huawei review smoke child'
        })
      });
      const childPayload = await childResponse.json().catch(() => ({}));
      if (!childResponse.ok || childPayload.code !== 0) {
        return { ok: false, stage: 'createChild', status: childResponse.status, message: childPayload.message || null };
      }

      const previewResponse = await fetch(${JSON.stringify(`${API_V1_BASE}/ai-jobs/preview`)}, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          title: 'Smoke record',
          content_text: 'Free users should not call external provider suggestions.',
          tags: []
        })
      });
      const previewPayload = await previewResponse.json().catch(() => ({}));

      localStorage.setItem('nianlun:access-token', token);
      localStorage.setItem('nianlun:session-hint', '1');
      return {
        ok: true,
        token,
        membership_type: registerPayload.data.user?.membership_type || null,
        child_no: childPayload.data.child_no || null,
        freePreview: {
          status: previewResponse.status,
          message: previewPayload.message || null,
          forbidden: previewResponse.status === 403 && String(previewPayload.message || '').includes('AI 功能仅对 AI 会员开放')
        }
      };
    })()`);
    if (!setup.ok) throw new Error(`Temp user setup failed: ${JSON.stringify(setup)}`);
    token = setup.token;

    const reportsEmptyBefore = await navigateAndCheck(cdp, '/profile/reports', '01-reports-empty-before-record');
    checks.push(reportsEmptyBefore);

    const recordCreateBefore = await navigateAndCheck(cdp, '/record/create?type=text', '02-record-create-before');
    checks.push(recordCreateBefore);

    const publishResult = await cdp.evaluate(`(async () => {
      const setValue = (node, value) => {
        const proto = node.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        setter?.call(node, value);
        node.dispatchEvent(new Event('input', { bubbles: true }));
        node.dispatchEvent(new Event('change', { bubbles: true }));
      };
      const titleInput = document.querySelector('input[placeholder]') || document.querySelector('input');
      const bodyInput = document.querySelector('textarea');
      if (!titleInput || !bodyInput) return { ok: false, reason: 'missing form controls' };
      setValue(titleInput, 'Audit record title');
      setValue(bodyInput, 'Audit record content for Huawei review smoke test. This should publish without provider suggestions.');
      await new Promise((resolve) => setTimeout(resolve, 300));
      const publishButton = [...document.querySelectorAll('button')].find((button) => button.innerText.includes('发布') || /publish/i.test(button.innerText));
      if (!publishButton) return { ok: false, reason: 'missing publish button' };
      publishButton.click();
      return { ok: true };
    })()`);
    if (!publishResult.ok) throw new Error(`Record publish interaction failed: ${JSON.stringify(publishResult)}`);
    await waitFor(
      cdp.evaluate,
      `(() => {
        const text = document.body?.innerText || '';
        const bootstrapping = Boolean(document.querySelector('[aria-busy="true"]'));
        return { ok: location.pathname.startsWith('/record/') && !location.pathname.endsWith('/create') && !bootstrapping && text.length > 8, href: location.href, textLength: text.length, bootstrapping };
      })()`,
      45000,
    );
    checks.push(await captureCurrentCheck(cdp, '03-record-detail', '/record/:record_no'));

    const routes = [
      ['/home', '04-home'],
      ['/timeline', '05-timeline'],
      ['/search', '06-search'],
      ['/family', '07-family'],
      ['/profile', '08-profile'],
      ['/profile/reports', '09-profile-reports'],
    ];
    for (const [route, name] of routes) {
      checks.push(await navigateAndCheck(cdp, route, name));
    }

    const failures = [];
    for (const check of checks) {
      if (check.hasOldAiCopy) failures.push(`${check.name}: old AI/provider error copy is visible`);
      if (check.name.includes('record-create') && check.hasFreeAiButton) failures.push(`${check.name}: free user sees AI/member suggestion button`);
      if (check.textLength <= 8) failures.push(`${check.name}: page content is too short`);
      if (check.forcedInviteRisk) failures.push(`${check.name}: registration form still appears to require invite code`);
      if (check.name === '00-login' && !check.signals.loginValue) failures.push(`${check.name}: login value expression is missing`);
      if (check.name === '00-register-form' && !check.signals.inviteOptional) failures.push(`${check.name}: optional invite copy is missing`);
      if (check.name === '01-reports-empty-before-record' && !check.signals.monthlyEmptyState) failures.push(`${check.name}: monthly empty state is missing before first record`);
      if (check.name === '04-home' && !check.signals.homeGuidance) failures.push(`${check.name}: home guidance is missing`);
      if (check.name === '05-timeline' && !check.signals.timelineQuickFeedback) failures.push(`${check.name}: timeline quick feedback is missing`);
      if (check.name === '06-search' && !check.signals.searchHierarchy) failures.push(`${check.name}: search hierarchy is missing`);
      if (check.name === '07-family' && !check.signals.familyCollaboration) failures.push(`${check.name}: family collaboration motivation is missing`);
      if (check.name === '08-profile' && !check.signals.profileArchiveState) failures.push(`${check.name}: profile archive state is missing`);
    }
    if (!setup.freePreview.forbidden) failures.push(`api: free ai preview did not return membership-only 403`);
    if (setup.membership_type !== 'free') failures.push(`api: temp user is not free membership (${setup.membership_type})`);

    const report = {
      setup: {
        credential_prefix: credential.slice(0, 18),
        membership_type: setup.membership_type,
        childCreated: Boolean(setup.child_no),
        freePreview: setup.freePreview,
      },
      publishResult,
      failures,
      checks: checks.map(({ screenshotPath, ...check }) => ({ ...check, screenshotPath })),
    };
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
    console.log(JSON.stringify(report, null, 2));
    if (failures.length) process.exitCode = 1;
  } finally {
    try {
      const cleanup = await cdp.evaluate(`(async () => {
        let token = ${JSON.stringify(token)};
        if (!token) {
          const refreshResponse = await fetch(${JSON.stringify(`${API_V1_BASE}/auth/refresh`)}, {
            method: 'POST',
            credentials: 'include'
          });
          const refreshPayload = await refreshResponse.json().catch(() => ({}));
          token = refreshPayload.data?.access_token || null;
        }
        if (!token) return { ok: false, status: 401, message: 'no token for cleanup' };
        const response = await fetch(${JSON.stringify(`${API_V1_BASE}/users/me/delete`)}, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ password: ${JSON.stringify(password)}, confirm_text: '确认注销' })
        });
        const payload = await response.json().catch(() => ({}));
        localStorage.clear();
        sessionStorage.clear();
        return { ok: response.ok && payload.code === 0, status: response.status, message: payload.message || payload.data?.message || null };
      })()`);
      const existing = fs.existsSync(REPORT_PATH) ? JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8')) : {};
      fs.writeFileSync(REPORT_PATH, JSON.stringify({ ...existing, cleanup }, null, 2), 'utf8');
    } finally {
      cdp.ws.close();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
