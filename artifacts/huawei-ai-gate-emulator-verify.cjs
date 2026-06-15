const fs = require('node:fs');

const CDP_LIST_URL = 'http://127.0.0.1:9223/json/list';
const API_V1_BASE = 'https://webapi.xmlga.top/api/v1';
const SCREENSHOT_PATH = 'F:/https-github-com-oldmanding-xiaoman-life/artifacts/huawei-ai-gate-record-create-emulator-20260615.png';
const REPORT_PATH = 'F:/https-github-com-oldmanding-xiaoman-life/artifacts/huawei-ai-gate-emulator-verify-20260615.json';

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
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  throw new Error(`Timed out waiting for condition. Last=${JSON.stringify(last)}`);
}

async function main() {
  const cdp = await connectPage();
  const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const credential = `hw_ai_gate_${stamp}_${Math.floor(Math.random() * 1000)}`;
  const password = `Temp${stamp.slice(-6)}!a`;
  let setup = null;

  try {
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
          name: '审核测试宝宝',
          birthday: '2022-06-01',
          gender: 'female',
          birth_place: '上海',
          remark: '华为审核临时验证'
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
          title: '审核验证记录',
          content_text: '验证普通用户不能使用 AI 会员整理能力。',
          tags: []
        })
      });
      const previewPayload = await previewResponse.json().catch(() => ({}));

      localStorage.setItem('nianlun:access-token', token);
      localStorage.setItem('nianlun:session-hint', '1');
      return {
        ok: true,
        membership_type: registerPayload.data.user?.membership_type || null,
        need_create_child: registerPayload.data.need_create_child,
        child_no: childPayload.data.child_no || null,
        freePreview: {
          status: previewResponse.status,
          message: previewPayload.message || null,
          forbidden: previewResponse.status === 403 && String(previewPayload.message || '').includes('AI 功能仅对 AI 会员开放')
        }
      };
    })()`);

    if (!setup.ok) throw new Error(`Temp user setup failed: ${JSON.stringify(setup)}`);

    await cdp.send('Page.navigate', { url: 'https://localhost/record/create?type=text' });
    await waitFor(
      cdp.evaluate,
      `(() => {
        const text = document.body?.innerText || '';
        const hasTitleInput = Boolean(document.querySelector('input[placeholder="给这一刻起个名字"]'));
        return { ok: location.href.includes('/record/create') && hasTitleInput, href: location.href, textLength: text.length, hasTitleInput };
      })()`,
    );

    const check = await cdp.evaluate(`(() => {
      const text = document.body?.innerText || '';
      const buttons = [...document.querySelectorAll('button')]
        .map((button) => button.getAttribute('aria-label') || button.innerText.trim())
        .filter(Boolean);
      return {
        href: location.href,
        hasRecordTitleInput: Boolean(document.querySelector('input[placeholder="给这一刻起个名字"]')),
        has403DeletedGroupText: text.includes('API Key 所属分组已删除') || text.includes('HTTP 403'),
        hasOldAiCopy: /AI 智能|AI 整理|AI 标题|AI 摘要|AI 标签|AI 建议/.test(text),
        hasMemberSuggestionButton: buttons.includes('会员整理建议'),
        buttons: buttons.slice(0, 18)
      };
    })()`);

    const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    fs.writeFileSync(SCREENSHOT_PATH, Buffer.from(screenshot.data, 'base64'));

    const cleanup = await cdp.evaluate(`(async () => {
      let token = localStorage.getItem('nianlun:access-token');
      if (!token) {
        const refreshResponse = await fetch(${JSON.stringify(`${API_V1_BASE}/auth/refresh`)}, {
          method: 'POST',
          credentials: 'include'
        });
        const refreshPayload = await refreshResponse.json().catch(() => ({}));
        token = refreshPayload.data?.access_token || null;
      }
      if (!token) return { ok: false, status: 401, message: '未取得清理用登录态' };
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

    const report = {
      setup: {
        credential_prefix: credential.slice(0, 15),
        membership_type: setup.membership_type,
        need_create_child: setup.need_create_child,
        childCreated: Boolean(setup.child_no),
        freePreview: setup.freePreview,
      },
      check,
      screenshotPath: SCREENSHOT_PATH,
      cleanup,
    };
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    let cleanupOnError = null;
    try {
      cleanupOnError = await cdp.evaluate(`(async () => {
        let token = localStorage.getItem('nianlun:access-token');
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
    } catch (cleanupError) {
      cleanupOnError = { ok: false, message: cleanupError instanceof Error ? cleanupError.message : String(cleanupError) };
    }
    const report = {
      error: error instanceof Error ? error.message : String(error),
      setup: setup
        ? {
            membership_type: setup.membership_type ?? null,
            need_create_child: setup.need_create_child ?? null,
            childCreated: Boolean(setup.child_no),
          }
        : null,
      cleanupOnError,
    };
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
    throw error;
  } finally {
    cdp.ws.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
