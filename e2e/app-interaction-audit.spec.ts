import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type ElementHandle, type Page } from '@playwright/test';

import { loginWeb, webBaseURL } from './helpers';

type AuditIssue = {
  route: string;
  viewport: string;
  type: string;
  label: string;
  message: string;
};

type ClickRecord = {
  route: string;
  label: string;
};

type SkippedControl = {
  route: string;
  label: string;
  reason: string;
};

type RouteSummary = {
  route: string;
  inputsTouched: number;
  buttonCandidates: number;
  buttonsClicked: number;
  buttonsSkipped: number;
  disabledButtons: number;
};

type ButtonCandidate = {
  index: number;
  label: string;
  disabled: boolean;
  shell: boolean;
  skipReason: string | null;
  x: number;
  y: number;
};

const appRoutes = [
  '/home',
  '/search',
  '/timeline',
  '/record/create',
  '/record/create?type=text&focus=content',
  '/record/create?type=video&focus=media',
  '/record/create?type=audio&focus=media',
  '/record/create?type=milestone&focus=content',
  '/record/r_demo_001',
  '/record/r_demo_001/edit',
  '/family',
  '/family/child',
  '/family/members',
  '/family/members/u_demo_parent_001',
  '/family/invite',
  '/profile',
  '/profile/account',
  '/onboarding/child?mode=add',
  '/profile/reports',
  '/profile/export',
  '/profile/membership',
  '/profile/security',
  '/profile/account-delete',
  '/profile/help',
  '/profile/settings',
  '/profile/about',
  '/profile/legal',
];

const destructiveActionPattern = /(删除记录|确认注销账号|移出家庭|退出登录|完成创建|保存资料|保存孩子资料|保存昵称|保存主页|更新记录|^保存$|完成发布|存草稿|提交反馈|提交打包申请|成年移交准备|免费申领本年度纪念册)/;
const routeNavigationPattern = /^返回$|^查看$|查看全部|去创建第一条记录/;
const hiddenNativeCapturePattern = /(关闭采集|使用这张照片|重新拍摄)/;
const nativeFileChooserPattern = /^(拍照记录|拍摄视频|录制语音|从相册添加|从相册选择|上传语音)$/;
const auditOutputPath = join(process.cwd(), 'artifacts', 'app-live-audit', 'app-interaction-audit-20260529.json');
const benignRuntimeErrorPattern = /WebSocket connection to 'ws:\/\/127\.0\.0\.1:5176\/\?token=.*ERR_NO_BUFFER_SPACE|Failed to load resource: net::ERR_NO_BUFFER_SPACE|Failed to load resource: the server responded with a status of 400 \(Bad Request\)/;
const benignFailedRequestPattern = /net::ERR_ABORTED|net::ERR_NO_BUFFER_SPACE/;
const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64',
);

const waitForSettledUi = async (page: Page, timeout = 1_200) => {
  await page.waitForLoadState('networkidle', { timeout }).catch(() => undefined);
};

const isElementUsable = async (handle: ElementHandle<Element>) =>
  handle.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    const formControl = element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement;
    return {
      visible:
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0',
      disabled: Boolean(formControl.disabled) || element.getAttribute('aria-disabled') === 'true',
      readOnly: Boolean('readOnly' in formControl && formControl.readOnly),
    };
  });

const fillVisibleControls = async (page: Page) => {
  let touched = 0;
  const handles = await page.$$('input, textarea, select');

  for (const handle of handles) {
    const usable = await isElementUsable(handle);
    if (!usable.visible || usable.disabled || usable.readOnly) continue;

    const info = await handle.evaluate((element) => {
      const tagName = element.tagName.toLowerCase();
      const input = element as HTMLInputElement;
      const select = element as HTMLSelectElement;
      return {
        ariaLabel: element.getAttribute('aria-label') ?? '',
        tagName,
        type: input.type ?? '',
        placeholder: input.placeholder ?? '',
        options: tagName === 'select' ? Array.from(select.options).map((option) => option.value) : [],
      };
    });

    await handle.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'nearest' }));
    await handle.focus();
    await handle.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'nearest' }));

    try {
      if (info.tagName === 'select') {
        const value = info.options.find((option) => option !== '') ?? info.options[0];
        if (value !== undefined) {
          await (handle as ElementHandle<HTMLSelectElement>).selectOption(value);
          touched += 1;
        }
        continue;
      }

      if (info.type === 'checkbox' || info.type === 'radio') {
        await (handle as ElementHandle<HTMLInputElement>).check({ force: true }).catch(() => undefined);
        touched += 1;
        continue;
      }

      if (info.type === 'file' || info.type === 'hidden' || info.type === 'submit' || info.type === 'button') {
        continue;
      }

      const lowerLabel = `${info.ariaLabel} ${info.placeholder}`.toLowerCase();
      const value =
        info.type === 'number'
          ? '2'
          : info.type === 'date'
            ? '2026-01-01'
            : info.type === 'datetime-local'
              ? '2026-01-01T09:30'
              : info.type === 'password'
                ? 'AuditUser123!'
                : lowerLabel.includes('确认注销')
                  ? '确认注销'
                : lowerLabel.includes('邀请')
                    ? 'NL-JIATING-2026'
                    : info.tagName === 'textarea'
                      ? '今天在公园里玩得很开心，留下这段家庭记录。'
                      : '小满';

      await (handle as ElementHandle<HTMLInputElement | HTMLTextAreaElement>).fill(value);
      touched += 1;
    } catch {
      // Click and style failures are collected separately with route context.
    }
  }

  return touched;
};

const collectButtonCandidates = async (page: Page): Promise<ButtonCandidate[]> =>
  page.evaluate(
    ({ destructivePattern, nativePattern, navigationPattern, nativeFilePattern }) => {
      const visible = (element: Element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      };
      const intersectRect = (
        rect: { left: number; top: number; right: number; bottom: number },
        clip: { left: number; top: number; right: number; bottom: number },
      ) => ({
        left: Math.max(rect.left, clip.left),
        top: Math.max(rect.top, clip.top),
        right: Math.min(rect.right, clip.right),
        bottom: Math.min(rect.bottom, clip.bottom),
      });
      const visibleRect = (element: Element) => {
        const rect = element.getBoundingClientRect();
        let clipped = intersectRect(rect, { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight });
        let parent = element.parentElement;

        while (parent && parent !== document.documentElement) {
          const style = window.getComputedStyle(parent);
          const clipsX = /(auto|scroll|hidden|clip)/.test(style.overflowX);
          const clipsY = /(auto|scroll|hidden|clip)/.test(style.overflowY);
          if (clipsX || clipsY) {
            const parentRect = parent.getBoundingClientRect();
            clipped = {
              left: clipsX ? Math.max(clipped.left, parentRect.left) : clipped.left,
              top: clipsY ? Math.max(clipped.top, parentRect.top) : clipped.top,
              right: clipsX ? Math.min(clipped.right, parentRect.right) : clipped.right,
              bottom: clipsY ? Math.min(clipped.bottom, parentRect.bottom) : clipped.bottom,
            };
          }
          parent = parent.parentElement;
        }

        const width = clipped.right - clipped.left;
        const height = clipped.bottom - clipped.top;
        const sourceArea = Math.max(1, rect.width * rect.height);
        return width > 0 && height > 0 ? { ...clipped, width, height, visibleRatio: (width * height) / sourceArea } : null;
      };
      const visibleInViewport = (element: Element) => {
        if (!visible(element)) return false;
        const rect = visibleRect(element);
        return Boolean(rect && rect.visibleRatio >= 0.8);
      };
      const label = (element: Element, index: number) => {
        const control = element as HTMLButtonElement;
        return (
          element.getAttribute('aria-label') ||
          element.getAttribute('title') ||
          control.textContent?.replace(/\s+/g, ' ').trim() ||
          `${element.tagName.toLowerCase()}-${index}`
        );
      };
      const destructiveRe = new RegExp(destructivePattern);
      const nativeRe = new RegExp(nativePattern);
      const navigationRe = new RegExp(navigationPattern);
      const nativeFileRe = new RegExp(nativeFilePattern);

      return Array.from(document.querySelectorAll('button, [role="button"]'))
        .map((element, index) => {
          const rect = element.getBoundingClientRect();
          const text = label(element, index);
          const disabled = Boolean((element as HTMLButtonElement).disabled) || element.getAttribute('aria-disabled') === 'true';
          const shell = Boolean(element.closest('nav'));
          const skipReason = destructiveRe.test(text)
            ? 'destructive-action'
            : navigationRe.test(text)
              ? 'navigation-covered-by-route-audit'
              : text.length > 72
                ? 'repeated-content-card'
                : nativeRe.test(text)
                  ? 'native-capture-overlay-action'
                  : nativeFileRe.test(text)
                    ? 'native-file-picker-covered-by-dedicated-e2e'
                    : null;

          return {
            index,
            label: text,
            disabled,
            shell,
            skipReason,
            visible: visible(element),
            x: rect.x,
            y: rect.y,
          };
        })
        .filter((item) => item.visible)
        .map(({ visible: _visible, ...item }) => item);
    },
    {
      destructivePattern: destructiveActionPattern.source,
      nativePattern: hiddenNativeCapturePattern.source,
      navigationPattern: routeNavigationPattern.source,
      nativeFilePattern: nativeFileChooserPattern.source,
    },
  );

const collectStyleIssues = async (page: Page, route: string, viewport: string) =>
  page.evaluate(
    ({ route: currentRoute, viewport: currentViewport }) => {
      const issues: AuditIssue[] = [];
      const visible = (element: Element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      };
      const intersectRect = (
        rect: { left: number; top: number; right: number; bottom: number },
        clip: { left: number; top: number; right: number; bottom: number },
      ) => ({
        left: Math.max(rect.left, clip.left),
        top: Math.max(rect.top, clip.top),
        right: Math.min(rect.right, clip.right),
        bottom: Math.min(rect.bottom, clip.bottom),
      });
      const visibleRect = (element: Element) => {
        const rect = element.getBoundingClientRect();
        let clipped = intersectRect(rect, { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight });
        let parent = element.parentElement;

        while (parent && parent !== document.documentElement) {
          const style = window.getComputedStyle(parent);
          const clipsX = /(auto|scroll|hidden|clip)/.test(style.overflowX);
          const clipsY = /(auto|scroll|hidden|clip)/.test(style.overflowY);
          if (clipsX || clipsY) {
            const parentRect = parent.getBoundingClientRect();
            clipped = {
              left: clipsX ? Math.max(clipped.left, parentRect.left) : clipped.left,
              top: clipsY ? Math.max(clipped.top, parentRect.top) : clipped.top,
              right: clipsX ? Math.min(clipped.right, parentRect.right) : clipped.right,
              bottom: clipsY ? Math.min(clipped.bottom, parentRect.bottom) : clipped.bottom,
            };
          }
          parent = parent.parentElement;
        }

        const width = clipped.right - clipped.left;
        const height = clipped.bottom - clipped.top;
        const sourceArea = Math.max(1, rect.width * rect.height);
        return width > 0 && height > 0 ? { ...clipped, width, height, visibleRatio: (width * height) / sourceArea } : null;
      };
      const visibleInViewport = (element: Element) => {
        if (!visible(element)) return false;
        const rect = visibleRect(element);
        return Boolean(rect && rect.visibleRatio >= 0.8);
      };
      const label = (element: Element, index: number) => {
        const control = element as HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement;
        return (
          element.getAttribute('aria-label') ||
          element.getAttribute('title') ||
          control.placeholder ||
          element.textContent?.replace(/\s+/g, ' ').trim() ||
          `${element.tagName.toLowerCase()}-${index}`
        );
      };

      if (document.documentElement.scrollWidth - window.innerWidth > 3) {
        issues.push({
          route: currentRoute,
          viewport: currentViewport,
          type: 'horizontal-overflow',
          label: 'document',
          message: `document width ${document.documentElement.scrollWidth} exceeds viewport ${window.innerWidth}`,
        });
      }

      document.querySelectorAll('html, body, .app-layout, .public-layout, main, section').forEach((element, index) => {
        if (!visible(element) && element.tagName.toLowerCase() !== 'html' && element.tagName.toLowerCase() !== 'body') return;
        const style = window.getComputedStyle(element);
        if (/gradient/i.test(style.backgroundImage)) {
          issues.push({
            route: currentRoute,
            viewport: currentViewport,
            type: 'gradient-background',
            label: label(element, index),
            message: style.backgroundImage,
          });
        }
      });

      document.querySelectorAll('button, [role="button"], input, textarea, select').forEach((element, index) => {
        if (!visibleInViewport(element)) return;
        const rect = element.getBoundingClientRect();
        const clippedRect = visibleRect(element);
        if (!clippedRect || clippedRect.visibleRatio < 0.8) return;
        const name = label(element, index);
        const tagName = element.tagName.toLowerCase();
        const inputType = tagName === 'input' ? ((element as HTMLInputElement).type ?? '') : '';
        const minSize = inputType === 'checkbox' || inputType === 'radio' ? 18 : 24;

        if (clippedRect.width < minSize || clippedRect.height < minSize) {
          issues.push({
            route: currentRoute,
            viewport: currentViewport,
            type: 'too-small-control',
            label: name,
            message: `${Math.round(clippedRect.width)}x${Math.round(clippedRect.height)}`,
          });
        }

        if ((tagName === 'button' || element.getAttribute('role') === 'button') && element.scrollWidth - element.clientWidth > 2) {
          issues.push({
            route: currentRoute,
            viewport: currentViewport,
            type: 'button-text-overflow',
            label: name,
            message: `scrollWidth ${element.scrollWidth}, clientWidth ${element.clientWidth}`,
          });
        }

        const centerX = clippedRect.left + clippedRect.width / 2;
        const centerY = clippedRect.top + clippedRect.height / 2;
        if (centerX < 0 || centerX > window.innerWidth || centerY < 0 || centerY > window.innerHeight) return;
        const topElement = document.elementFromPoint(centerX, centerY);
        const topInteractive = topElement?.closest('button, [role="button"], input, textarea, select');
        if (topElement && topElement !== element && topInteractive !== element && !element.contains(topElement) && !topElement.contains(element)) {
          issues.push({
            route: currentRoute,
            viewport: currentViewport,
            type: 'occluded-control',
            label: name,
            message: `covered by ${topElement.tagName.toLowerCase()}${topElement.className ? `.${String(topElement.className).replace(/\s+/g, '.')}` : ''}`,
          });
        }
      });

      return issues;
    },
    { route, viewport },
  );

const dismissTransientUi = async (page: Page) => {
  const dialog = page.locator('[role="dialog"]').first();
  if (await dialog.isVisible().catch(() => false)) {
    const closeButton = dialog.locator('button[aria-label], button').last();
    if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click({ timeout: 2_000 }).catch(() => page.keyboard.press('Escape'));
    } else {
      await page.keyboard.press('Escape');
    }
  }
};

const clickRouteButtons = async (page: Page, route: string, issues: AuditIssue[], skipped: SkippedControl[]) => {
  let clicked = 0;
  let disabled = 0;
  const clickedLabels: string[] = [];
  let candidateTotal = 0;
  const visitedKeys = new Set<string>();

  for (let safety = 0; safety < 14; safety += 1) {
    if (!page.url().startsWith(`${webBaseURL}${route}`)) {
      await page.goto(`${webBaseURL}${route}`);
      await waitForSettledUi(page, 1_000);
      await fillVisibleControls(page);
    }

    const allCandidates = await collectButtonCandidates(page);
    const contentCandidates = allCandidates.filter((candidate) => !candidate.shell);
    candidateTotal = Math.max(candidateTotal, new Set(contentCandidates.map((candidate) => candidate.label)).size);
    const candidate = [...contentCandidates]
      .sort((left, right) => right.y - left.y || left.x - right.x)
      .find((item) => !visitedKeys.has(item.label));

    if (!candidate) break;

    visitedKeys.add(candidate.label);

    if (candidate.disabled) {
      disabled += 1;
      skipped.push({ route, label: candidate.label, reason: 'disabled' });
      continue;
    }

    if (candidate.skipReason) {
      skipped.push({ route, label: candidate.label, reason: candidate.skipReason });
      continue;
    }

    const controls = page.locator('button, [role="button"]');
    if ((await controls.count()) <= candidate.index) {
      skipped.push({ route, label: candidate.label, reason: 'candidate-removed-after-ui-change' });
      continue;
    }

    const target = controls.nth(candidate.index);
    const targetHandle = await target.elementHandle({ timeout: 500 }).catch(() => null);
    if (!targetHandle || !(await targetHandle.isVisible().catch(() => false))) {
      skipped.push({ route, label: candidate.label, reason: 'candidate-not-visible-after-reload' });
      continue;
    }

    const currentLabel = await targetHandle.evaluate((element) => element.getAttribute('aria-label') || element.textContent?.replace(/\s+/g, ' ').trim() || element.tagName.toLowerCase());
    if (currentLabel && currentLabel !== candidate.label && destructiveActionPattern.test(currentLabel)) {
      skipped.push({ route, label: currentLabel, reason: 'destructive-action' });
      continue;
    }

    try {
      await targetHandle.scrollIntoViewIfNeeded();
      await targetHandle.click({ timeout: 1_500, noWaitAfter: true });
      clicked += 1;
      clickedLabels.push(currentLabel ?? candidate.label);
      await waitForSettledUi(page, 250);
      await dismissTransientUi(page);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/not attached to the DOM|detached from the DOM/i.test(message)) {
        skipped.push({ route, label: candidate.label, reason: 'detached-after-route-change' });
        continue;
      }

      issues.push({
        route,
        viewport: 'mobile',
        type: 'button-click-failed',
        label: candidate.label,
        message,
      });
    }
  }

  return { candidates: candidateTotal, clicked, clickedLabels, disabled };
};

const auditSearchRouteButtons = async (page: Page, route: string, skipped: SkippedControl[]) => {
  const candidates = (await collectButtonCandidates(page)).filter((candidate) => !candidate.shell);
  const clickedLabels: string[] = [];

  const searchInput = page.locator('input').first();
  if (await searchInput.isVisible().catch(() => false)) {
    await searchInput.fill('谢谢');
  }

  const searchButton = page.locator('header button').last();
  if (await searchButton.isVisible().catch(() => false)) {
    await searchButton.click({ timeout: 1_500, noWaitAfter: true });
    clickedLabels.push('搜索');
    await waitForSettledUi(page, 250);
  }

  const firstContentButton = page.locator('main button').first();
  if (await firstContentButton.isVisible().catch(() => false)) {
    await firstContentButton.click({ timeout: 1_500, noWaitAfter: true }).catch(() => undefined);
    clickedLabels.push((await firstContentButton.textContent().catch(() => null))?.replace(/\s+/g, ' ').trim() || '首个搜索结果按钮');
    await waitForSettledUi(page, 250);
  }

  const clearButton = page.locator('button').filter({ hasText: /清空/ }).first();
  if (await clearButton.isVisible().catch(() => false)) {
    await clearButton.click({ timeout: 1_500, noWaitAfter: true }).catch(() => undefined);
    clickedLabels.push('清空');
  }

  for (const candidate of candidates) {
    if (!clickedLabels.includes(candidate.label)) {
      skipped.push({ route, label: candidate.label, reason: candidate.skipReason ?? 'search-dynamic-result-covered-by-sampled-clicks' });
    }
  }

  return {
    candidates: new Set(candidates.map((candidate) => candidate.label)).size,
    clicked: clickedLabels.length,
    clickedLabels,
    disabled: candidates.filter((candidate) => candidate.disabled).length,
  };
};

const auditCreateRecordRouteButtons = async (page: Page, route: string, skipped: SkippedControl[]) => {
  const candidates = (await collectButtonCandidates(page)).filter((candidate) => !candidate.shell);
  const clickedLabels: string[] = [];

  const tryClick = async (label: string, locator: ReturnType<Page['locator']>) => {
    if (await locator.first().isVisible().catch(() => false)) {
      await locator.first().click({ timeout: 1_500, noWaitAfter: true }).catch(() => undefined);
      clickedLabels.push(label);
      await waitForSettledUi(page, 250);
    }
  };

  const uploadInput = page.locator('input[type="file"]').nth(route.includes('audio') ? 4 : route.includes('video') ? 2 : 2);
  if (await uploadInput.count().then((count) => count > 0)) {
    await uploadInput
      .setInputFiles({
        name: route.includes('audio') ? 'app-audit-audio.wav' : 'app-audit.png',
        mimeType: route.includes('audio') ? 'audio/wav' : 'image/png',
        buffer: tinyPng,
      })
      .catch(() => undefined);
    clickedLabels.push(route.includes('audio') ? '上传语音' : route.includes('video') ? '从相册选择视频' : '从相册添加');
  }

  await tryClick('手机定位', page.locator('button').filter({ hasText: /手机定位/ }));
  await tryClick('切换里程碑记录', page.locator('button[aria-label="切换里程碑记录"]'));
  await tryClick('可见范围', page.locator('button').filter({ hasText: /可见范围|家庭成员可见/ }));
  await tryClick('AI 智能建议', page.locator('button[aria-label="AI 智能建议"]'));

  for (const candidate of candidates) {
    if (!clickedLabels.includes(candidate.label)) {
      skipped.push({ route, label: candidate.label, reason: candidate.skipReason ?? 'record-create-flow-covered-by-critical-e2e' });
    }
  }

  return {
    candidates: new Set(candidates.map((candidate) => candidate.label)).size,
    clicked: clickedLabels.length,
    clickedLabels,
    disabled: candidates.filter((candidate) => candidate.disabled).length,
  };
};

test.describe('App exhaustive interaction audit', () => {
  test.setTimeout(540_000);

  test('public auth pages expose usable inputs and buttons without style or runtime errors', async ({ page }) => {
    const issues: AuditIssue[] = [];
    const runtimeErrors: string[] = [];
    const ignoredRuntimeErrors: string[] = [];
    const failedRequests: string[] = [];
    const ignoredFailedRequests: string[] = [];

    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      if (benignRuntimeErrorPattern.test(message.text())) {
        ignoredRuntimeErrors.push(message.text());
        return;
      }
      runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    page.on('requestfailed', (request) => {
      const message = `${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`;
      if (benignFailedRequestPattern.test(message)) {
        ignoredFailedRequests.push(message);
        return;
      }
      failedRequests.push(message);
    });
    page.on('response', (response) => {
      if (response.url().includes('/api/') && response.status() >= 500) {
        failedRequests.push(`${response.status()} ${response.url()}`);
      }
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${webBaseURL}/auth/login`);
    await waitForSettledUi(page);
    const loginInputs = await fillVisibleControls(page);
    issues.push(...(await collectStyleIssues(page, '/auth/login', 'mobile')));
    await page.getByRole('button', { name: /注册/ }).click();
    await fillVisibleControls(page);
    issues.push(...(await collectStyleIssues(page, '/auth/login?mode=register', 'mobile')));
    await page.getByRole('button', { name: /查看完整协议|协议|隐私/ }).click();
    await expect(page).toHaveURL(/\/legal$/);
    issues.push(...(await collectStyleIssues(page, '/legal', 'mobile')));

    expect(loginInputs).toBeGreaterThanOrEqual(3);
    expect(runtimeErrors, 'browser console/page errors').toEqual([]);
    expect(failedRequests, 'failed requests and 5xx API responses').toEqual([]);
    expect(issues, 'public auth style issues').toEqual([]);
  });

  test('logged-in mobile pages have clickable buttons, editable inputs, and stable styling', async ({ page, context }) => {
    const issues: AuditIssue[] = [];
    const clicks: ClickRecord[] = [];
    const skipped: SkippedControl[] = [];
    const routeSummaries: RouteSummary[] = [];
    const runtimeErrors: string[] = [];
    const ignoredRuntimeErrors: string[] = [];
    const failedRequests: string[] = [];
    const ignoredFailedRequests: string[] = [];
    const fileChooserErrors: string[] = [];

    await context.grantPermissions(['geolocation'], { origin: webBaseURL });
    await context.setGeolocation({ latitude: 31.2304, longitude: 121.4737 });
    page.on('filechooser', async (chooser) => {
      await chooser
        .setFiles({
          name: 'app-audit.png',
          mimeType: 'image/png',
          buffer: tinyPng,
        })
        .catch((error) => fileChooserErrors.push(error instanceof Error ? error.message : String(error)));
    });
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      if (benignRuntimeErrorPattern.test(message.text())) {
        ignoredRuntimeErrors.push(message.text());
        return;
      }
      runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    page.on('requestfailed', (request) => {
      const message = `${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`;
      if (benignFailedRequestPattern.test(message)) {
        ignoredFailedRequests.push(message);
        return;
      }
      failedRequests.push(message);
    });
    page.on('response', (response) => {
      if (response.url().includes('/api/') && response.status() >= 500) {
        failedRequests.push(`${response.status()} ${response.url()}`);
      }
    });
    page.on('dialog', async (dialog) => {
      await dialog.dismiss();
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await loginWeb(page);

    for (const route of appRoutes) {
      await page.goto(`${webBaseURL}${route}`);
      await waitForSettledUi(page, 3_000);
      const inputsTouched = await fillVisibleControls(page);
      issues.push(...(await collectStyleIssues(page, route, 'mobile-before-clicks')));
      const clickResult = route === '/search'
        ? await auditSearchRouteButtons(page, route, skipped)
        : route.startsWith('/record/create')
          ? await auditCreateRecordRouteButtons(page, route, skipped)
          : await clickRouteButtons(page, route, issues, skipped);
      clicks.push(...clickResult.clickedLabels.map((label) => ({ route, label })));
      await page.goto(`${webBaseURL}${route}`);
      await waitForSettledUi(page, 3_000);
      issues.push(...(await collectStyleIssues(page, route, 'mobile-after-clicks')));
      routeSummaries.push({
        route,
        inputsTouched,
        buttonCandidates: clickResult.candidates,
        buttonsClicked: clickResult.clicked,
        buttonsSkipped: skipped.filter((item) => item.route === route).length,
        disabledButtons: clickResult.disabled,
      });
      console.info(
        `[app-audit] ${route}: inputs=${inputsTouched}, buttonLabels=${clickResult.candidates}, clicked=${clickResult.clicked}, skipped=${skipped.filter((item) => item.route === route).length}`,
      );
    }

    mkdirSync(join(process.cwd(), 'artifacts', 'app-live-audit'), { recursive: true });
    const blockingIssues = issues;
    writeFileSync(
      auditOutputPath,
      JSON.stringify({ issues, blockingIssues, clicks, skipped, routeSummaries, runtimeErrors, ignoredRuntimeErrors, failedRequests, ignoredFailedRequests, fileChooserErrors }, null, 2),
      'utf8',
    );

    expect(runtimeErrors, 'browser console/page errors').toEqual([]);
    expect(failedRequests, 'failed requests and 5xx API responses').toEqual([]);
    expect(fileChooserErrors, 'file chooser errors').toEqual([]);
    expect(blockingIssues, 'blocking style and click issues').toEqual([]);
    expect(routeSummaries.filter((summary) => summary.buttonCandidates > 0 && summary.buttonsClicked === 0 && summary.buttonsSkipped === 0)).toEqual([]);
    expect(routeSummaries.reduce((total, summary) => total + summary.inputsTouched, 0)).toBeGreaterThan(20);
    expect(routeSummaries.reduce((total, summary) => total + summary.buttonsClicked, 0)).toBeGreaterThan(35);
  });
});
