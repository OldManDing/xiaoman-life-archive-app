import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type ElementHandle, type Page } from '@playwright/test';

import { adminBaseURL, loginAdmin } from './helpers';

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

type RouteSummary = {
  route: string;
  inputsTouched: number;
  buttonCandidates: number;
  buttonsClicked: number;
};

const adminRoutes = [
  '/dashboard',
  '/users',
  '/families',
  '/invites',
  '/children',
  '/records',
  '/media',
  '/ai-jobs',
  '/content-risks',
  '/support-tickets',
  '/archive-export-requests',
  '/ops-readiness',
  '/system-config',
  '/audit-logs',
];

const stateChangingConfirmPattern = /(\u786e\u8ba4\u6267\u884c|\u786e\u8ba4\u91cd\u7f6e|\u4fdd\u5b58\u914d\u7f6e)/;
const logoutPattern = /\u9000\u51fa/;
const auditPhone = `139${String(Date.now()).slice(-8)}`;

const auditOutputPath = join(process.cwd(), 'artifacts', 'app-live-audit', 'admin-interaction-audit-20260529.json');

const waitForSettledUi = async (page: Page, timeout = 1_000) => {
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
      disabled: Boolean(formControl.disabled),
      readOnly: Boolean('readOnly' in formControl && formControl.readOnly),
    };
  });

const labelFor = async (handle: ElementHandle<Element>) =>
  handle.evaluate((element) => {
    const formControl = element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement;
    return (
      element.getAttribute('aria-label') ||
      element.getAttribute('title') ||
      formControl.placeholder ||
      element.textContent?.replace(/\s+/g, ' ').trim() ||
      element.tagName.toLowerCase()
    );
  });

const isShellButton = async (handle: ElementHandle<Element>) =>
  handle.evaluate((element) => Boolean(element.closest('aside'))).catch(() => false);

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
        tagName,
        type: input.type ?? '',
        options: tagName === 'select' ? Array.from(select.options).map((option) => option.value) : [],
      };
    });

    await handle.scrollIntoViewIfNeeded();
    await handle.focus();

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

      const value =
        info.type === 'number'
          ? '2'
          : info.type === 'date'
            ? '2026-01-01'
            : info.type === 'datetime-local'
              ? '2026-01-01T00:00'
              : info.tagName === 'textarea'
                ? '自动化巡检：验证输入框可编辑、不会溢出，并检查取消路径。'
                : auditPhone;

      await (handle as ElementHandle<HTMLInputElement | HTMLTextAreaElement>).fill(value);
      touched += 1;
    } catch {
      // The caller records visible UI failures from Playwright assertions and console errors.
    }
  }

  return touched;
};

const collectStyleIssues = async (page: Page, route: string, viewport: string) =>
  page.evaluate(
    ({ route: currentRoute, viewport: currentViewport }) => {
      const issues: AuditIssue[] = [];
      const visible = (element: Element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      const label = (element: Element) => {
        const control = element as HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement;
        return (
          element.getAttribute('aria-label') ||
          element.getAttribute('title') ||
          control.placeholder ||
          element.textContent?.replace(/\s+/g, ' ').trim() ||
          element.tagName.toLowerCase()
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

      for (const element of [document.body, document.querySelector('.admin-layout'), document.querySelector('.admin-main')]) {
        if (!element) continue;
        const style = window.getComputedStyle(element);
        if (/gradient/i.test(style.backgroundImage)) {
          issues.push({
            route: currentRoute,
            viewport: currentViewport,
            type: 'gradient-background',
            label: element.className || element.tagName.toLowerCase(),
            message: style.backgroundImage,
          });
        }
      }

      document.querySelectorAll('button, input, textarea, select').forEach((element, index) => {
        if (!visible(element)) return;
        const rect = element.getBoundingClientRect();
        const name = label(element) || `${element.tagName.toLowerCase()}-${index}`;
        const tagName = element.tagName.toLowerCase();

        if (rect.width < 24 || rect.height < 24) {
          issues.push({
            route: currentRoute,
            viewport: currentViewport,
            type: 'too-small-control',
            label: name,
            message: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
          });
        }

        if (tagName === 'button' && element.scrollWidth - element.clientWidth > 2) {
          issues.push({
            route: currentRoute,
            viewport: currentViewport,
            type: 'button-text-overflow',
            label: name,
            message: `scrollWidth ${element.scrollWidth}, clientWidth ${element.clientWidth}`,
          });
        }
      });

      return issues;
    },
    { route, viewport },
  );

const closeOpenDialog = async (page: Page) => {
  const dialog = page.locator('[role="dialog"]').first();
  if (!(await dialog.isVisible().catch(() => false))) return false;

  await fillVisibleControls(page);
  const closeButton = dialog.locator('.admin-modal-close, button[aria-label]').first();
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  } else if (await dialog.locator('button').first().isVisible().catch(() => false)) {
    await dialog.locator('button').first().click();
  } else {
    await page.keyboard.press('Escape');
  }
  await expect(dialog).toBeHidden();
  return true;
};

const navigateWithinAdmin = async (page: Page, route: string) => {
  if (/\/login$/.test(page.url())) {
    await loginAdmin(page);
  }

  const link = page.locator(`aside a[href="${route}"]`).first();
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(new RegExp(`${route.replace('/', '\\/')}$`));
};

const clickVisibleButtons = async (page: Page, route: string, issues: AuditIssue[]) => {
  const clicked: ClickRecord[] = [];
  const buttons = await page.$$('button');
  const candidates: Array<{ handle: ElementHandle<Element>; label: string; y: number; x: number }> = [];

  for (const handle of buttons) {
    const usable = await isElementUsable(handle);
    if (!usable.visible || usable.disabled) continue;
    if (await isShellButton(handle)) continue;

    const label = await labelFor(handle);
    if (logoutPattern.test(label) || stateChangingConfirmPattern.test(label)) continue;

    const box = await handle.boundingBox();
    candidates.push({ handle, label, x: box?.x ?? 0, y: box?.y ?? 0 });
  }

  candidates.sort((left, right) => right.y - left.y || left.x - right.x);

  for (const candidate of candidates) {
    await closeOpenDialog(page);
    const attached = await candidate.handle.evaluate((element) => element.isConnected).catch(() => false);
    if (!attached) continue;

    const usable = await isElementUsable(candidate.handle).catch(() => ({ visible: false, disabled: false, readOnly: false }));
    if (!usable.visible || usable.disabled) continue;

    try {
      await candidate.handle.scrollIntoViewIfNeeded();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/not attached to the DOM/i.test(message)) continue;
      throw error;
    }

    try {
      await candidate.handle.click({ timeout: 2_000 });
      clicked.push({ route, label: candidate.label });
      await waitForSettledUi(page, 300);
      await closeOpenDialog(page);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/not attached to the DOM/i.test(message)) continue;

      issues.push({
        route,
        viewport: 'desktop',
        type: 'button-click-failed',
        label: candidate.label,
        message,
      });
    }
  }

  return { clicked, candidates: candidates.length };
};

test.describe('Admin exhaustive interaction audit', () => {
  test.setTimeout(420_000);

  test('desktop inputs and buttons are interactable without style or runtime errors', async ({ page }) => {
    const issues: AuditIssue[] = [];
    const clicks: ClickRecord[] = [];
    const routeSummaries: RouteSummary[] = [];
    const runtimeErrors: string[] = [];
    const failedRequests: string[] = [];

    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
    page.on('response', (response) => {
      if (response.url().includes('/api/') && response.status() >= 500) {
        failedRequests.push(`${response.status()} ${response.url()}`);
      }
    });
    page.on('dialog', async (dialog) => {
      await dialog.dismiss();
    });

    await page.setViewportSize({ width: 1440, height: 820 });
    await loginAdmin(page);

    for (const route of adminRoutes) {
      await navigateWithinAdmin(page, route);
      await waitForSettledUi(page, 3_000);
      const inputsTouched = await fillVisibleControls(page);
      issues.push(...(await collectStyleIssues(page, route, 'desktop')));
      const clickResult = await clickVisibleButtons(page, route, issues);
      clicks.push(...clickResult.clicked);
      routeSummaries.push({
        route,
        inputsTouched,
        buttonCandidates: clickResult.candidates,
        buttonsClicked: clickResult.clicked.length,
      });
      issues.push(...(await collectStyleIssues(page, route, 'desktop-after-clicks')));
    }

    await navigateWithinAdmin(page, '/system-config');
    await waitForSettledUi(page, 3_000);
    const firstConfigAdjustButton = page.locator('tbody tr').first().locator('button').last();
    if (await firstConfigAdjustButton.isVisible().catch(() => false)) {
      await firstConfigAdjustButton.click();
      await page.locator('textarea').last().fill('自动化巡检：保存相同配置值，验证保存按钮链路。');
      await page.locator('form').last().locator('button[type="submit"]').click();
      await expect(page.locator('text=/已更新|updated/i')).toBeVisible();
      clicks.push({ route: '/system-config', label: 'save-current-config-value' });
    }

    if (/\/login$/.test(page.url())) {
      await loginAdmin(page);
    }
    await page.locator('.admin-sidebar-footer button').click({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/login$/);
    clicks.push({ route: '/logout', label: 'logout' });

    mkdirSync(join(process.cwd(), 'artifacts', 'app-live-audit'), { recursive: true });
    writeFileSync(auditOutputPath, JSON.stringify({ issues, clicks, routeSummaries, runtimeErrors, failedRequests }, null, 2), 'utf8');

    expect(runtimeErrors, 'browser console/page errors').toEqual([]);
    expect(failedRequests, 'failed requests and 5xx API responses').toEqual([]);
    expect(issues, 'style and click issues').toEqual([]);
    expect(routeSummaries.filter((summary) => summary.buttonCandidates > 0 && summary.buttonsClicked === 0), 'routes with unclicked candidate buttons').toEqual([]);
    expect(clicks.length).toBeGreaterThan(40);
  });

  test('mobile admin pages keep controls within the viewport without gradients', async ({ page }) => {
    const issues: AuditIssue[] = [];

    await page.setViewportSize({ width: 390, height: 844 });
    await loginAdmin(page);

    for (const route of adminRoutes) {
      await navigateWithinAdmin(page, route);
      await waitForSettledUi(page, 3_000);
      issues.push(...(await collectStyleIssues(page, route, 'mobile')));
    }

    expect(issues, 'mobile style issues').toEqual([]);
  });
});
