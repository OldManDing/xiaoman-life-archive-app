const { execFileSync } = require('node:child_process');
const { mkdirSync, writeFileSync } = require('node:fs');

const adb = process.env.ADB_PATH || 'C:/Users/MrDing/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const device = process.env.ADB_DEVICE || 'emulator-5554';
const appPackage = 'com.xmlga.nianlun';
const targetPort = process.env.WEBVIEW_DEBUG_PORT || '9222';
const outputDir = 'artifacts/app-live-audit/native-apk-button-audit-20260530-spa';
const credential = process.env.NIANLUN_TEST_USER || 'xiaoman_parent';
const password = process.env.NIANLUN_TEST_PASSWORD || 'DemoUser123!';

const routes = [
  { name: 'home', path: '/home' },
  { name: 'search', path: '/search' },
  { name: 'timeline', path: '/timeline' },
  { name: 'record-create', path: '/record/create' },
  { name: 'record-create-text', path: '/record/create?type=text&focus=content' },
  { name: 'record-detail', path: '/record/r_demo_001' },
  { name: 'record-edit', path: '/record/r_demo_001/edit' },
  { name: 'family', path: '/family' },
  { name: 'family-child', path: '/family/child' },
  { name: 'family-members', path: '/family/members' },
  { name: 'family-invite', path: '/family/invite' },
  { name: 'profile', path: '/profile' },
  { name: 'profile-account', path: '/profile/account' },
  { name: 'profile-reports', path: '/profile/reports' },
  { name: 'profile-export', path: '/profile/export' },
  { name: 'profile-membership', path: '/profile/membership' },
  { name: 'profile-security', path: '/profile/security' },
  { name: 'profile-help', path: '/profile/help' },
  { name: 'profile-settings', path: '/profile/settings' },
  { name: 'profile-about', path: '/profile/about' },
];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function adbText(args) {
  return execFileSync(adb, ['-s', device, ...args], { encoding: 'utf8' });
}

function adbRun(args) {
  execFileSync(adb, ['-s', device, ...args], { stdio: 'ignore' });
}

function launchApp() {
  adbRun(['shell', 'am', 'start', '-n', `${appPackage}/.MainActivity`]);
}

function capture(name) {
  const remote = `/sdcard/${name}.png`;
  adbRun(['shell', 'screencap', '-p', remote]);
  execFileSync(adb, ['-s', device, 'pull', remote, `${outputDir}/${name}.png`], { stdio: 'ignore' });
  adbRun(['shell', 'rm', remote]);
}

function listWebViewSockets() {
  const output = adbText(['shell', 'cat', '/proc/net/unix']);
  const sockets = [];
  const seen = new Set();
  let pid = '';

  try {
    pid = adbText(['shell', 'pidof', appPackage]).trim();
  } catch {}

  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/@((?:webview|chrome)_devtools_remote_[0-9]+)/);
    if (!match) continue;
    const socket = match[1];
    if (seen.has(socket)) continue;
    seen.add(socket);
    sockets.push(socket);
  }

  sockets.sort((left, right) => {
    if (pid && left.endsWith(`_${pid}`)) return -1;
    if (pid && right.endsWith(`_${pid}`)) return 1;
    return right.localeCompare(left, 'en');
  });

  return sockets;
}

function forwardSocket(socket) {
  try {
    execFileSync(adb, ['-s', device, 'forward', '--remove', `tcp:${targetPort}`], { stdio: 'ignore' });
  } catch {}
  execFileSync(adb, ['-s', device, 'forward', `tcp:${targetPort}`, `localabstract:${socket}`], { stdio: 'ignore' });
}

async function fetchTargets() {
  for (const endpoint of [`http://127.0.0.1:${targetPort}/json/list`, `http://127.0.0.1:${targetPort}/json`]) {
    try {
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(1500) });
      const targets = await response.json();
      if (Array.isArray(targets) && targets.length) return targets;
    } catch {}
  }
  return [];
}

async function resolveTarget() {
  const sockets = listWebViewSockets();
  if (!sockets.length) throw new Error('No WebView devtools sockets found.');

  for (const socket of sockets) {
    forwardSocket(socket);
    const targets = await fetchTargets();
    const page =
      targets.find((target) => target.type === 'page' && target.url?.includes('localhost')) ??
      targets.find((target) => target.type === 'page');
    if (page?.webSocketDebuggerUrl) return page;
  }

  throw new Error(`No usable WebView target found. Sockets: ${sockets.join(', ')}`);
}

async function connect() {
  const target = await resolveTarget();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const events = [];

  ws.onmessage = (event) => {
    const payload = JSON.parse(event.data);
    if (payload.id && pending.has(payload.id)) {
      pending.get(payload.id)(payload);
      pending.delete(payload.id);
      return;
    }
    events.push(payload);
  };

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const messageId = ++id;
      pending.set(messageId, (payload) => {
        if (payload.error) {
          reject(new Error(JSON.stringify(payload.error)));
          return;
        }
        resolve(payload.result);
      });
      ws.send(JSON.stringify({ id: messageId, method, params }));
    });

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Network.enable');

  return {
    ws,
    send,
    takeEvents() {
      const nextEvents = events.slice();
      events.length = 0;
      return nextEvents;
    },
  };
}

async function evaluate(send, expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });

  if (result.exceptionDetails) {
    throw new Error(JSON.stringify(result.exceptionDetails));
  }

  return result.result.value;
}

async function login(send) {
  await evaluate(send, `window.location.href = 'https://localhost/auth/login'; true;`);
  await wait(2200);

  const filled = await evaluate(
    send,
    `(() => {
      const visible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      };
      const setNativeValue = (element, value) => {
        const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value');
        descriptor?.set?.call(element, value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      };
      const buttons = Array.from(document.querySelectorAll('button')).filter(visible);
      const loginTab = buttons.find((button) => button.innerText.trim() === '\\u767b\\u5f55');
      loginTab?.click();
      const controls = Array.from(document.querySelectorAll('input')).filter(visible);
      const textInput = controls.find((input) => input.type !== 'password' && input.type !== 'checkbox');
      const passwordInput = controls.find((input) => input.type === 'password');
      const checkbox = controls.find((input) => input.type === 'checkbox');
      if (textInput) setNativeValue(textInput, ${JSON.stringify(credential)});
      if (passwordInput) setNativeValue(passwordInput, ${JSON.stringify(password)});
      if (checkbox && !checkbox.checked) checkbox.click();
      return {
        textInput: !!textInput,
        passwordInput: !!passwordInput,
        checkbox: !!checkbox,
        modeButtons: buttons.map((button) => button.innerText.trim())
      };
    })()`,
  );

  await wait(600);
  const submitted = await evaluate(
    send,
    `(() => {
      const visible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      };
      const submit = Array.from(document.querySelectorAll('button'))
        .filter(visible)
        .find((button) => button.innerText.includes('\\u8fdb\\u5165\\u5e74\\u8f6e'));
      if (!submit) return { ok: false, reason: 'submit button missing' };
      submit.click();
      return { ok: true, disabled: !!submit.disabled, text: submit.innerText };
    })()`,
  );

  await wait(5200);
  const page = await snapshot(send);
  return {
    ok:
      submitted.ok &&
      (/\/home$/.test(page.href) ||
        page.text.includes('\\u6700\\u8fd1\\u66f4\\u65b0') ||
        page.text.includes('\\u4eca\\u65e5\\u503c\\u5f97\\u8bb0\\u5f55')),
    filled,
    submitted,
    page,
  };
}

async function gotoRoute(send, path) {
  await evaluate(
    send,
    `(() => {
      window.history.pushState({}, '', ${JSON.stringify(path)});
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
      return window.location.href;
    })()`,
  );
  await wait(1600);
  await evaluate(send, `window.scrollTo(0, 0); true;`);
  await wait(500);
  const page = await snapshot(send);
  if (page.href.includes('/auth/login')) {
    throw new Error(`Route ${path} resolved to login after authenticated navigation.`);
  }
}

async function fillSafeInputs(send) {
  return evaluate(
    send,
    `(() => {
      let touched = 0;
      const values = {
        title: '\\u539f\\u751f\\u6309\\u94ae\\u5ba1\\u8ba1\\u8bb0\\u5f55',
        content: '\\u8fd9\\u662f\\u4e00\\u6761\\u7528\\u4e8e\\u9a8c\\u8bc1\\u539f\\u751f APK \\u6309\\u94ae\\u53ef\\u70b9\\u51fb\\u7684\\u6d4b\\u8bd5\\u5185\\u5bb9\\u3002',
        generic: '\\u539f\\u751f\\u5ba1\\u8ba1'
      };
      document.querySelectorAll('input, textarea').forEach((element) => {
        const input = element;
        const type = (input.type || '').toLowerCase();
        if (input.disabled || input.readOnly || type === 'file' || type === 'hidden' || type === 'checkbox' || type === 'radio') return;
        const label = [input.getAttribute('aria-label') || '', input.placeholder || '', input.name || ''].join(' ');
        if (type === 'datetime-local' && !input.value) input.value = '2026-05-30T09:30';
        else if (type === 'date' && !input.value) input.value = '2026-05-30';
        else if (/\\u6807\\u9898|title/i.test(label) && !input.value) input.value = values.title;
        else if (input.tagName.toLowerCase() === 'textarea' && !input.value) input.value = values.content;
        else if (!input.value && !/\\u8d26\\u53f7|\\u5bc6\\u7801|\\u9080\\u8bf7|\\u6ce8\\u9500/i.test(label)) input.value = values.generic;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        touched += 1;
      });
      return touched;
    })()`,
  );
}

async function buttons(send) {
  return evaluate(
    send,
    `(() => {
      const visible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      };
      const elements = Array.from(document.querySelectorAll('button, [role="button"], a[href]'));
      return elements.map((element, index) => {
        const rect = element.getBoundingClientRect();
        const text = (element.getAttribute('aria-label') || element.getAttribute('title') || element.innerText || element.textContent || '').replace(/\\s+/g, ' ').trim();
        const href = element instanceof HTMLAnchorElement ? element.href : '';
        return {
          index,
          text,
          href,
          tagName: element.tagName.toLowerCase(),
          disabled: !!element.disabled || element.getAttribute('aria-disabled') === 'true',
          visible: visible(element),
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height
        };
      }).filter((button) => button.visible);
    })()`,
  );
}

async function clickButton(send, index, label) {
  return evaluate(
    send,
    `(async () => {
      const elements = Array.from(document.querySelectorAll('button, [role="button"], a[href]'));
      const label = ${JSON.stringify(label)};
      const tagOptions = new Set([
        '\\u751f\\u65e5\\u7eaa\\u5ff5',
        '\\u6237\\u5916\\u65e5\\u5e38',
        '\\u8bed\\u8a00\\u53d1\\u80b2',
        '\\u5927\\u52a8\\u4f5c\\u53d1\\u5c55',
        '\\u7761\\u524d\\u65f6\\u5149',
        '\\u4eb2\\u5b50\\u966a\\u4f34',
        '\\u7b2c\\u4e00\\u6b21',
        '\\u5bb6\\u5ead\\u65e5\\u5e38',
      ]);
      const visible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      };
      const textOf = (element) => (element.getAttribute('aria-label') || element.getAttribute('title') || element.innerText || element.textContent || '').replace(/\\s+/g, ' ').trim();
      let element = elements[${index}];
      if (!element || (label && textOf(element) !== label)) {
        element = elements.find((candidate) => textOf(candidate) === label);
      }
      if (!element && tagOptions.has(label)) {
        const combo = Array.from(document.querySelectorAll('[role="combobox"]'))
          .filter(visible)
          .find((candidate) => candidate.getAttribute('aria-label') === '\\u9009\\u62e9\\u6807\\u7b7e' || textOf(candidate).includes('\\u6dfb\\u52a0\\u6807\\u7b7e'));
        if (!combo) return { ok: false, reason: 'tag-combobox-missing' };
        combo.scrollIntoView({ block: 'center', inline: 'nearest' });
        if (combo.getAttribute('aria-expanded') !== 'true') combo.click();
        await new Promise((resolve) => setTimeout(resolve, 250));
        element = Array.from(document.querySelectorAll('[role="option"]'))
          .filter(visible)
          .find((candidate) => textOf(candidate) === label && !candidate.disabled && candidate.getAttribute('aria-disabled') !== 'true');
      }
      if (!element && label.startsWith('#')) return { ok: true, skippedDynamic: true, reason: 'dynamic-label-not-visible' };
      if (!element) return { ok: false, reason: 'missing' };
      element.scrollIntoView({ block: 'center', inline: 'nearest' });
      element.click();
      return { ok: true };
    })()`,
  );
}

async function snapshot(send) {
  return evaluate(
    send,
    `(() => ({
      href: window.location.href,
      text: document.body.innerText.slice(0, 900),
      buttons: Array.from(document.querySelectorAll('button, [role="button"], a[href]')).map((element) => ({
        text: (element.getAttribute('aria-label') || element.getAttribute('title') || element.innerText || element.textContent || '').replace(/\\s+/g, ' ').trim(),
        disabled: !!element.disabled || element.getAttribute('aria-disabled') === 'true'
      }))
    }))()`,
  );
}

function classify(button) {
  const text = button.text || '';
  if (!text) return 'empty-label';
  if (button.disabled) return 'disabled';
  if (/(\u5220\u9664|\u6ce8\u9500|\u79fb\u51fa|\u9000\u51fa|\u786e\u8ba4\u6ce8\u9500)/.test(text)) return 'destructive';
  if (/(\u62cd\u7167\u8bb0\u5f55|\u62cd\u6444\u89c6\u9891|\u4ece\u76f8\u518c|\u5f55\u5236\u8bed\u97f3|\u4e0a\u4f20\u8bed\u97f3|\u624b\u673a\u5b9a\u4f4d)/.test(text)) return 'system-picker';
  if (text.length > 80) return 'content-card';
  return 'click';
}

async function main() {
  mkdirSync(outputDir, { recursive: true });
  launchApp();
  await wait(3500);

  const session = await connect();
  const result = {
    device,
    appPackage,
    startedAt: new Date().toISOString(),
    login: null,
    routes: [],
    totals: {
      clicked: 0,
      skipped: 0,
      failed: 0,
      routeScreenshots: 0,
    },
  };

  try {
    result.login = await login(session.send);
    if (!result.login.ok) throw new Error(`Login failed: ${JSON.stringify(result.login)}`);

    for (const route of routes) {
      await gotoRoute(session.send, route.path);
      await fillSafeInputs(session.send);
      capture(`${route.name}-before`);

      const initialButtons = await buttons(session.send);
      const routeResult = {
        name: route.name,
        path: route.path,
        href: (await snapshot(session.send)).href,
        buttons: [],
        screenshot: `${outputDir}/${route.name}-before.png`,
      };

      for (const button of initialButtons) {
        const action = classify(button);
        const record = {
          label: button.text,
          index: button.index,
          action,
          ok: false,
          hrefAfter: '',
          responseText: '',
        };

        if (action !== 'click') {
          record.ok = true;
          routeResult.buttons.push(record);
          result.totals.skipped += 1;
          continue;
        }

        await gotoRoute(session.send, route.path);
        await fillSafeInputs(session.send);
        try {
          const clickResult = await clickButton(session.send, button.index, button.text);
          await wait(1300);
          const after = await snapshot(session.send);
          record.ok = !!clickResult.ok;
          if (!record.ok) {
            result.totals.failed += 1;
          }
          if (clickResult.reason) record.reason = clickResult.reason;
          if (clickResult.skippedDynamic) record.action = 'dynamic-state';
          record.hrefAfter = after.href;
          record.responseText = after.text.slice(0, 260);
          result.totals.clicked += 1;
        } catch (error) {
          record.ok = false;
          record.responseText = error instanceof Error ? error.message : String(error);
          result.totals.failed += 1;
        }

        routeResult.buttons.push(record);
      }

      await gotoRoute(session.send, route.path);
      capture(`${route.name}-after`);
      result.totals.routeScreenshots += 2;
      result.routes.push(routeResult);
      console.log(
        `[native-apk-audit] ${route.path}: buttons=${routeResult.buttons.length}, clicked=${routeResult.buttons.filter((item) => item.action === 'click').length}, skipped=${routeResult.buttons.filter((item) => item.action !== 'click').length}`,
      );
    }

    result.finishedAt = new Date().toISOString();
    writeFileSync(`${outputDir}/result.json`, JSON.stringify(result, null, 2));

    if (result.totals.failed > 0) {
      throw new Error(`Native APK button audit found ${result.totals.failed} failed clicks.`);
    }
  } finally {
    session.ws.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
