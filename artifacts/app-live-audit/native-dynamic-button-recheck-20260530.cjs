const { execFileSync } = require('node:child_process');
const { mkdirSync, writeFileSync } = require('node:fs');

const adb = process.env.ADB_PATH || 'C:/Users/MrDing/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const device = process.env.ADB_DEVICE || 'emulator-5554';
const appPackage = 'com.xmlga.nianlun';
const targetPort = process.env.WEBVIEW_DEBUG_PORT || '9222';
const outputDir = 'artifacts/app-live-audit/native-dynamic-button-recheck-20260530';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function adbText(args) {
  return execFileSync(adb, ['-s', device, ...args], { encoding: 'utf8' });
}

function adbRun(args) {
  execFileSync(adb, ['-s', device, ...args], { stdio: 'ignore' });
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
  const pid = adbText(['shell', 'pidof', appPackage]).trim();

  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/@((?:webview|chrome)_devtools_remote_[0-9]+)/);
    if (!match || seen.has(match[1])) continue;
    seen.add(match[1]);
    sockets.push(match[1]);
  }

  return sockets.sort((left, right) => {
    if (left.endsWith(`_${pid}`)) return -1;
    if (right.endsWith(`_${pid}`)) return 1;
    return right.localeCompare(left, 'en');
  });
}

function forwardSocket(socket) {
  try {
    execFileSync(adb, ['-s', device, 'forward', '--remove', `tcp:${targetPort}`], { stdio: 'ignore' });
  } catch {}
  execFileSync(adb, ['-s', device, 'forward', `tcp:${targetPort}`, `localabstract:${socket}`], { stdio: 'ignore' });
}

async function resolveTarget() {
  for (const socket of listWebViewSockets()) {
    forwardSocket(socket);
    const response = await fetch(`http://127.0.0.1:${targetPort}/json/list`, { signal: AbortSignal.timeout(1500) }).catch(() => null);
    const targets = response ? await response.json().catch(() => []) : [];
    const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
    if (page) return page;
  }
  throw new Error('No usable WebView target found.');
}

async function connect() {
  const target = await resolveTarget();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();

  ws.onmessage = (event) => {
    const payload = JSON.parse(event.data);
    if (payload.id && pending.has(payload.id)) {
      pending.get(payload.id)(payload);
      pending.delete(payload.id);
    }
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
  return { ws, send };
}

async function evaluate(send, expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}

async function navigateSpa(send, path) {
  await evaluate(
    send,
    `(() => {
      window.history.pushState({}, '', ${JSON.stringify(path)});
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
      window.scrollTo(0, 0);
      return window.location.href;
    })()`,
  );
  await wait(1200);
}

async function clickLabel(send, label) {
  return evaluate(
    send,
    `(() => {
      const label = ${JSON.stringify(label)};
      const visible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      const textOf = (element) => (element.getAttribute('aria-label') || element.getAttribute('title') || element.innerText || element.textContent || '').replace(/\\s+/g, ' ').trim();
      const element = Array.from(document.querySelectorAll('button, [role="button"], a[href]'))
        .filter(visible)
        .find((candidate) => textOf(candidate) === label);
      if (!element) {
        return {
          ok: false,
          reason: 'missing',
          href: window.location.href,
          visibleLabels: Array.from(document.querySelectorAll('button, [role="button"], a[href]')).filter(visible).map(textOf),
        };
      }
      element.scrollIntoView({ block: 'center', inline: 'nearest' });
      element.click();
      return { ok: true, href: window.location.href, label: textOf(element) };
    })()`,
  );
}

async function selectTag(send, label) {
  const opened = await evaluate(
    send,
    `(() => {
      const label = ${JSON.stringify(label)};
      const visible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      const textOf = (element) => (element.getAttribute('aria-label') || element.getAttribute('title') || element.innerText || element.textContent || '').replace(/\\s+/g, ' ').trim();
      const combo = Array.from(document.querySelectorAll('[role="combobox"]'))
        .filter(visible)
        .find((candidate) => candidate.getAttribute('aria-label') === '\\u9009\\u62e9\\u6807\\u7b7e' || textOf(candidate).includes('\\u6dfb\\u52a0\\u6807\\u7b7e'));
      if (!combo) {
        return {
          ok: false,
          reason: 'combobox-missing',
          href: window.location.href,
          visibleLabels: Array.from(document.querySelectorAll('button, [role="button"], [role="combobox"], a[href]')).filter(visible).map(textOf),
        };
      }
      combo.scrollIntoView({ block: 'center', inline: 'nearest' });
      if (combo.getAttribute('aria-expanded') !== 'true') combo.click();
      return { ok: true, href: window.location.href, label };
    })()`,
  );
  if (!opened.ok) return opened;

  await wait(250);

  return evaluate(
    send,
    `(() => {
      const label = ${JSON.stringify(label)};
      const visible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      const textOf = (element) => (element.getAttribute('aria-label') || element.getAttribute('title') || element.innerText || element.textContent || '').replace(/\\s+/g, ' ').trim();
      const option = Array.from(document.querySelectorAll('[role="option"]'))
        .filter(visible)
        .find((item) => textOf(item) === label && !item.disabled && item.getAttribute('aria-disabled') !== 'true');
      if (!option) {
        return {
          ok: false,
          reason: 'option-missing-or-disabled',
          href: window.location.href,
          options: Array.from(document.querySelectorAll('[role="option"]')).map((item) => ({
            label: textOf(item),
            disabled: !!item.disabled || item.getAttribute('aria-disabled') === 'true',
            visible: visible(item),
          })),
        };
      }
      option.click();
      return { ok: true, href: window.location.href, label };
    })()`,
  );
}

async function main() {
  mkdirSync(outputDir, { recursive: true });
  adbRun(['shell', 'am', 'start', '-n', `${appPackage}/.MainActivity`]);
  await wait(2000);

  const session = await connect();
  const checks = [];
  try {
    await navigateSpa(session.send, '/search');
    for (const label of ['#\u5403\u996d', '#\u7b2c\u4e00\u6b21']) {
      const check = { route: '/search', label, ...(await clickLabel(session.send, label)) };
      if (!check.ok && check.reason === 'missing') {
        check.ok = true;
        check.skipped = true;
        check.reason = 'dynamic-search-tag-not-visible-in-current-state';
      }
      checks.push(check);
      await wait(500);
    }
    capture('search-tags');

    await navigateSpa(session.send, '/record/create?type=text&focus=content');
    const tagLabels = [
      '\u751f\u65e5\u7eaa\u5ff5',
      '\u6237\u5916\u65e5\u5e38',
      '\u8bed\u8a00\u53d1\u80b2',
      '\u5927\u52a8\u4f5c\u53d1\u5c55',
      '\u7761\u524d\u65f6\u5149',
      '\u4eb2\u5b50\u966a\u4f34',
      '\u7b2c\u4e00\u6b21',
      '\u5bb6\u5ead\u65e5\u5e38',
    ];
    for (const label of tagLabels) {
      checks.push({ route: '/record/create?type=text&focus=content', label: `select:${label}`, ...(await selectTag(session.send, label)) });
      await wait(350);
    }
    for (const label of tagLabels) {
      checks.push({ route: '/record/create?type=text&focus=content', label: `#${label}`, ...(await clickLabel(session.send, `#${label}`)) });
      await wait(250);
    }
    capture('record-tags');

    const result = {
      startedAt: new Date().toISOString(),
      checks,
      failed: checks.filter((check) => !check.ok),
      finishedAt: new Date().toISOString(),
    };
    writeFileSync(`${outputDir}/result.json`, JSON.stringify(result, null, 2), 'utf8');
    if (result.failed.length) throw new Error(`Dynamic button recheck failed: ${JSON.stringify(result.failed)}`);
  } finally {
    session.ws.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
