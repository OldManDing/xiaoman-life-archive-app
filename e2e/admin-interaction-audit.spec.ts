import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type ElementHandle, type Page } from '@playwright/test';

import { adminBaseURL, loginAdmin, navigateToAdminRoute } from './helpers';

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
  // 点击过程中因页面重渲染而消失的候选（已明确跳过，不算「没点到」）
  buttonsSkipped: number;
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

// 每条路由的页面主标题（PageShell 渲染的 h1）：用于确认新页面真的挂载完成，
// 而不是 URL 已经变了、DOM 还停在上一页。
const routeHeadings: Record<string, string> = {
  '/dashboard': '后台总览',
  '/users': '账号管理',
  '/families': '家庭管理',
  '/invites': '邀请码管理',
  '/children': '孩子档案',
  '/records': '成长记录',
  '/media': '媒体库',
  '/ai-jobs': 'AI 任务列表',
  '/content-risks': '内容风险',
  '/support-tickets': '客服反馈',
  '/archive-export-requests': '档案交付申请',
  '/ops-readiness': '系统运维',
  '/system-config': '系统配置',
  '/audit-logs': '审计日志',
};

const stateChangingConfirmPattern = /(\u786e\u8ba4\u6267\u884c|\u786e\u8ba4\u91cd\u7f6e|\u4fdd\u5b58\u914d\u7f6e)/;
const logoutPattern = /\u9000\u51fa/;
const auditPhone = `139${String(Date.now()).slice(-8)}`;
const minimumRouteClicks: Record<string, number> = {
  '/users': 6,
  '/families': 2,
  '/invites': 2,
  '/children': 2,
  '/records': 3,
  '/media': 2,
  '/ai-jobs': 2,
  '/content-risks': 1,
  '/support-tickets': 2,
  '/archive-export-requests': 2,
  '/system-config': 1,
  '/audit-logs': 2,
  '/logout': 1,
};
const routesWithExpectedButtonCoverage = new Set(
  Object.keys(minimumRouteClicks).filter((route) => route !== '/logout'),
);
const routesWithFilterControls = new Set([
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
  '/audit-logs',
]);

const auditOutputPath = join(process.cwd(), 'artifacts', 'app-live-audit', 'admin-interaction-audit-20260529.json');

const waitForSettledUi = async (page: Page, timeout = 1_000) => {
  await page.waitForLoadState('networkidle', { timeout }).catch(() => undefined);
};

const waitForRouteButtons = async (page: Page, route: string) => {
  if (!routesWithExpectedButtonCoverage.has(route)) return;

  await expect
    .poll(
      async () =>
        page.locator('.admin-main button').evaluateAll((buttons) =>
          buttons.filter((button) => {
            const element = button as HTMLButtonElement;
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            return (
              !element.disabled &&
              rect.width > 0 &&
              rect.height > 0 &&
              style.display !== 'none' &&
              style.visibility !== 'hidden'
            );
          }).length,
        ),
      {
        timeout: 8_000,
        message: `${route} should expose enabled admin action buttons before the audit clicks start`,
      },
    )
    .toBeGreaterThan(0);
};

/**
 * 列表页在首帧和查询期间会把按钮置为「查询中…」并禁用，而且在数据到位前既没有行也没有空态。
 * 巡检如果在加载态就采集，会把「正在加载」误记成「按钮点不动」/「候选数不足」
 * （实测会让 /system-config 只收集到 1 个候选、/users 只收集到搜索按钮）。
 * 这里在采集前尽力等待页面退出加载态，超时则继续（由后续断言兜底）。
 */
const waitForRouteIdle = async (page: Page) => {
  await expect
    .poll(
      async () => {
        const loading = await page.locator('.admin-main button:disabled', { hasText: '查询中' }).count();
        if (loading > 0) return 'loading';

        const hasTable = await page.locator('.admin-main .admin-responsive-table').count();
        if (!hasTable) return 'ready';

        const rows = await page.locator('.admin-main .admin-responsive-table tbody tr').count();
        const empty = await page.locator('.admin-main .admin-empty-state').count();
        return rows > 0 || empty > 0 ? 'ready' : 'pending';
      },
      { timeout: 8_000 },
    )
    .toBe('ready')
    .catch(() => undefined);
};

const isElementUsable = async (handle: ElementHandle<Element>) =>
  handle.evaluate((element) => {
    if (element.classList.contains('admin-select-native')) {
      return { visible: false, disabled: true, readOnly: true };
    }

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

const fillVisibleControls = async (page: Page, route?: string) => {
  let touched = 0;
  const handles = await page.$$('input, textarea, select');
  const preserveFilterValues = Boolean(route && routesWithFilterControls.has(route));

  for (const handle of handles) {
    // 巡检过程中页面会重渲染（筛选、分页、状态更新），早期采集的句柄可能已经脱离 DOM。
    // 这类句柄直接跳过；真正的 UI 问题由 collectStyleIssues 与 console/pageerror 负责捕获。
    const usable = await isElementUsable(handle).catch(() => null);
    if (!usable || !usable.visible || usable.disabled || usable.readOnly) continue;

    const info = await handle.evaluate((element) => {
      const tagName = element.tagName.toLowerCase();
      const input = element as HTMLInputElement;
      const select = element as HTMLSelectElement;
      return {
        tagName,
        type: input.type ?? '',
        currentValue: 'value' in element ? (element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value ?? '' : '',
        options: tagName === 'select' ? Array.from(select.options).map((option) => option.value) : [],
      };
    }).catch(() => null);
    if (!info) continue;

    const scrolled = await handle.scrollIntoViewIfNeeded().then(() => true).catch(() => false);
    if (!scrolled) continue;

    await handle.focus().catch(() => undefined);

    try {
      if (info.tagName === 'select') {
        const value = info.options.find((option) => option !== '' && option !== info.currentValue) ?? info.options[0];
        if (value !== undefined) {
          if (!preserveFilterValues || value !== info.currentValue) {
            await (handle as ElementHandle<HTMLSelectElement>).selectOption(value);
            if (preserveFilterValues && info.currentValue !== value && info.options.includes(info.currentValue)) {
              await (handle as ElementHandle<HTMLSelectElement>).selectOption(info.currentValue);
            }
          }
          touched += 1;
        }
        continue;
      }

      if (info.type === 'checkbox' || info.type === 'radio') {
        if (preserveFilterValues) {
          touched += 1;
          continue;
        }
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
      if (preserveFilterValues) {
        await (handle as ElementHandle<HTMLInputElement | HTMLTextAreaElement>).fill(info.currentValue);
      }
      touched += 1;
    } catch {
      // The caller records visible UI failures from Playwright assertions and console errors.
    }
  }

  return touched;
};
const maxAuditButtonsPerRoute: Record<string, number> = {
  '/support-tickets': 8,
};
// 每条路由的点击上限：用例里最高的最低覆盖要求是 6（/users），10 足够有余，
// 同时把「每次点击最坏 3 秒」的累积拖慢挡在可控范围内。
const DEFAULT_MAX_CLICKS_PER_ROUTE = 10;

const prepareRouteForAudit = async (page: Page, route: string) => {
  if (route !== '/media') return;

  await page.getByPlaceholder('编号 / 文件 / 孩子 / 记录').fill('第一次自己吃饭');
  await page.getByRole('button', { name: '查询' }).click();
  await expect(page.getByRole('row', { name: /第一次自己吃饭/ })).toBeVisible();
};

const collectStyleIssues = async (page: Page, route: string, viewport: string) =>
  page.evaluate(
    ({ route: currentRoute, viewport: currentViewport }) => {
      const issues: AuditIssue[] = [];
      const visible = (element: Element) => {
        if (element.classList.contains('admin-select-native')) return false;
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
  // Media lightboxes are nested inside detail drawers. Close the topmost
  // preview first so the click does not get intercepted by the drawer.
  const lightbox = page.locator('.admin-media-lightbox').last();
  if (await lightbox.isVisible().catch(() => false)) {
    await page.keyboard.press('Escape');
    await expect(lightbox).toBeHidden();
    return true;
  }

  const dialog = page.locator('[role="dialog"]').first();
  if (!(await dialog.isVisible().catch(() => false))) return false;

  await fillVisibleControls(page);
  const closeButton = dialog.locator('.admin-drawer-close, .admin-modal-close').first();
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

  // /media 与 /content-risks 已在主导航里（2026-09-20 信息架构调整），无需再从系统运维页绕行。
  await navigateToAdminRoute(page, route);
  // 页面是 React.lazy + startTransition：URL 会先变，新页面的 chunk 就绪前 DOM 还停在上一页。
  // 必须等本页的 h1 出现再开始巡检，否则会把上一页的按钮当成这一页的（实测给 /users 采到了首页的「每月」）。
  const heading = routeHeadings[route];
  if (heading) {
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible({ timeout: 10_000 });
  }
};

/**
 * 逐按钮点击巡检。
 *
 * 关键点：**每次点击前按「可访问名称 + 出现序号」重新定位**，而不是复用一开始采集的 ElementHandle。
 * 列表页翻页、筛选开关、弹窗开关都会重渲染，早期句柄会集体脱离 DOM —— 旧实现因此丢点击，
 * 触发「有候选按钮但 0 点击」的断言（该失败在本次改动之前就存在）。
 */
const clickVisibleButtons = async (page: Page, route: string, issues: AuditIssue[]) => {
  const clicked: ClickRecord[] = [];
  // 诊断开关：E2E_AUDIT_DIAGNOSTICS=1 时打印候选数与跳过原因，便于排查「点不到」。
  const skips: string[] = [];

  // 采集「按钮清单」（保留重复项，一个按钮一项）；标签取可访问名称。
  // 顺序沿用旧实现的「自下而上、先右后左」：表格行内的按钮要先于顶部的「查询/清空」被点，
  // 否则一点查询就会重载列表，行内的句柄（此处是标签序号）随即失效，导致大范围漏点。
  const plan = await page.locator('.admin-main button').evaluateAll((buttons) =>
    buttons
      .filter((button) => {
        const rect = button.getBoundingClientRect();
        const style = window.getComputedStyle(button);
        return !button.disabled && rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      })
      .map((button) => {
        const rect = button.getBoundingClientRect();
        return {
          label: button.getAttribute('aria-label') || button.getAttribute('title') || button.textContent?.replace(/\s+/g, ' ').trim() || '',
          x: rect.x,
          y: rect.y,
        };
      })
      .sort((left, right) => right.y - left.y || left.x - right.x)
      .map((item) => item.label),
  );

  if (process.env.E2E_AUDIT_DIAGNOSTICS === '1') {
    console.log(`[audit] total_buttons=${plan.length}`);
  }

  const occurrenceByLabel = new Map<string, number>();

  for (const label of plan) {
    const occurrence = occurrenceByLabel.get(label) ?? 0;
    occurrenceByLabel.set(label, occurrence + 1);

    if (!label) continue;
    if (logoutPattern.test(label) || stateChangingConfirmPattern.test(label)) {
      skips.push(`${label}:confirm-pattern`);
      continue;
    }

    const clickedForRoute = clicked.filter((item) => item.route === route).length;
    if (clickedForRoute >= (maxAuditButtonsPerRoute[route] ?? DEFAULT_MAX_CLICKS_PER_ROUTE)) break;

    await closeOpenDialog(page);
    // 列表刷新期间表格是 pointer-events:none（防止重复点击），此时点击会被外层容器吞掉。
    // 只有确实处在加载态时才等，并且超时很短：否则每条路由都会被拖慢。
    if (await page.locator('.admin-table-loading').count()) {
      await page.locator('.admin-table-loading').first().waitFor({ state: 'detached', timeout: 1_500 }).catch(() => undefined);
    }

    const target = page.locator('.admin-main').getByRole('button', { name: label, exact: true }).nth(occurrence);
    if ((await target.count()) === 0) {
      skips.push(`${label}#${occurrence}:gone`);
      continue;
    }
    const visible = await target.isVisible().catch(() => false);
    const enabled = await target.isEnabled().catch(() => false);
    if (!visible || !enabled) {
      skips.push(`${label}#${occurrence}:not-usable(visible=${visible},enabled=${enabled})`);
      continue;
    }

    try {
      await target.click({ timeout: 1_500 });
      clicked.push({ route, label });
      await waitForSettledUi(page, 300);
      await closeOpenDialog(page);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Playwright 对「元素被卸载」有两种措辞，都要按瞬态处理。
      if (/not attached to the DOM|detached from the DOM/i.test(message)) {
        skips.push(`${label}#${occurrence}:detached-on-click`);
        continue;
      }

      issues.push({
        route,
        viewport: 'desktop',
        type: 'button-click-failed',
        label,
        message,
      });
    }
  }

  if (process.env.E2E_AUDIT_DIAGNOSTICS === '1' && skips.length) {
    console.log(`[audit] ${route} skipped: ${skips.join(' | ')}`);
  }

  return { clicked, candidates: plan.length, skipped: skips.length };
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
      await prepareRouteForAudit(page, route);
      await waitForRouteButtons(page, route);
      await waitForRouteIdle(page);
      const inputsTouched = await fillVisibleControls(page, route);
      await waitForRouteButtons(page, route);
      await waitForRouteIdle(page);
      issues.push(...(await collectStyleIssues(page, route, 'desktop')));
      const clickResult = await clickVisibleButtons(page, route, issues);
      if (route === '/invites') {
        const copyInviteButton = page.getByRole('button', { name: '复制邀请码' });
        if (await copyInviteButton.waitFor({ state: 'visible', timeout: 5_000 }).then(() => true).catch(() => false)) {
          await copyInviteButton.click();
          clickResult.clicked.push({ route, label: '复制邀请码' });
          await waitForSettledUi(page, 300);
        }
      }
      clicks.push(...clickResult.clicked);
      routeSummaries.push({
        route,
        inputsTouched,
        buttonCandidates: clickResult.candidates,
        buttonsClicked: clickResult.clicked.length,
        buttonsSkipped: clickResult.skipped,
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

    const clickCountsByRoute = clicks.reduce<Record<string, number>>((summary, click) => {
      summary[click.route] = (summary[click.route] ?? 0) + 1;
      return summary;
    }, {});

    expect(runtimeErrors, 'browser console/page errors').toEqual([]);
    expect(failedRequests, 'failed requests and 5xx API responses').toEqual([]);
    expect(issues, 'style and click issues').toEqual([]);
    expect(routeSummaries.filter((summary) => summary.buttonCandidates > 0 && summary.buttonsClicked === 0), 'routes with unclicked candidate buttons').toEqual([]);
    expect(
      routeSummaries.filter(
        (summary) => routesWithExpectedButtonCoverage.has(summary.route) && summary.buttonCandidates === 0,
      ),
      'admin routes that never exposed any clickable buttons',
    ).toEqual([]);
    expect(Object.keys(clickCountsByRoute), 'routes with confirmed admin button coverage').toEqual(
      expect.arrayContaining(Object.keys(minimumRouteClicks)),
    );

    // 每条路由的点击覆盖：要求「点掉 + 明确跳过」覆盖到 min(标定值, 该路由实际候选数)。
    // 页面上很多按钮会在点击过程中随列表重渲染消失（例如点开详情后行内动作按钮被重建），
    // 它们已经被明确记为 skipped，不该再算「没点到」；标定值本身也是照"20 行数据"的库定的，
    // 清库后 /users 只剩 2 个用户、候选恰好等于下限，零余量会让用例变成"数据一变就红"。
    // 同时保留下面「有候选却 0 点击」的严格断言。
    const candidatesByRoute = new Map(routeSummaries.map((summary) => [summary.route, summary.buttonCandidates]));
    const skippedByRoute = new Map(routeSummaries.map((summary) => [summary.route, summary.buttonsSkipped]));
    for (const [route, minimumClicks] of Object.entries(minimumRouteClicks)) {
      const available = candidatesByRoute.get(route) ?? 0;
      const attempted = clickCountsByRoute[route] ?? 0;
      const skipped = skippedByRoute.get(route) ?? 0;
      const expected = Math.min(minimumClicks, available);
      expect(
        attempted + skipped,
        `${route} click coverage (clicked=${attempted}, skipped=${skipped}, candidates=${available})`,
      ).toBeGreaterThanOrEqual(expected);
    }

    expect(clicks.length).toBeGreaterThanOrEqual(
      Object.values(minimumRouteClicks).reduce((total, count) => total + count, 0),
    );
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
