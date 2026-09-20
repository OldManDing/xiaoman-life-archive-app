import { expect, test, type Page } from '@playwright/test';

import { adminBaseURL, loginAdmin, openAdminMore } from './helpers';

/**
 * 后台无障碍审计（不引入 axe 依赖，覆盖最关键、最容易回归的几条规则）：
 *   1) 交互元素（button / a[href] / [role=button] / [role=combobox] / [role=option]）必须有可访问名称；
 *   2) 表单控件必须有名称（aria-label / aria-labelledby / 关联 label）；
 *   3) img 必须有 alt；
 *   4) 不允许重复 id；
 *   5) html 必须有 lang；
 *   6) 每页有且只有一个 h1；
 *   7) 不允许正的 tabindex（tabindex > 0 会打乱焦点顺序）。
 * 已从无障碍树移除的元素（aria-hidden 子树、tabindex=-1）不参与判定，
 * 例如 AdminSelect 刻意隐藏的原生 select。
 */

const adminRoutes = [
  '/dashboard',
  '/users',
  '/families',
  '/invites',
  '/children',
  '/records',
  '/media',
  '/ai-jobs',
  '/ai-settings',
  '/content-risks',
  '/notifications',
  '/support-tickets',
  '/archive-export-requests',
  '/ops-readiness',
  '/system-config',
  '/audit-logs',
];

const secondaryRoutes = new Set(['/users', '/invites', '/notifications', '/ai-settings', '/ai-jobs', '/ops-readiness', '/system-config', '/audit-logs']);

type Violation = { rule: string; detail: string };

const collectViolations = (page: Page, route: string) =>
  page.evaluate(
    ({ route: currentRoute }) => {
      const violations: Array<{ rule: string; detail: string }> = [];

      const isHiddenFromA11y = (element: Element) => {
        let node: Element | null = element;
        while (node) {
          if (node.getAttribute('aria-hidden') === 'true') return true;
          if ((node as HTMLElement).tabIndex === -1 && node !== document.body) return true;
          node = node.parentElement;
        }
        return false;
      };

      const hasVisibleBox = (element: Element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };

      const accessibleNameOf = (element: Element) => {
        const ariaLabel = element.getAttribute('aria-label')?.trim();
        if (ariaLabel) return ariaLabel;

        const labelledBy = element.getAttribute('aria-labelledby');
        if (labelledBy) {
          const text = labelledBy
            .split(/\s+/)
            .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
            .join(' ')
            .trim();
          if (text) return text;
        }

        const id = element.getAttribute('id');
        if (id) {
          const explicit = document.querySelector(`label[for="${CSS.escape(id)}"]`);
          const text = explicit?.textContent?.trim();
          if (text) return text;
        }

        const wrappingLabel = element.closest('label');
        const wrappingText = wrappingLabel?.textContent?.trim();
        if (wrappingText) return wrappingText;

        const title = element.getAttribute('title')?.trim();
        if (title) return title;

        if (element instanceof HTMLImageElement) return element.getAttribute('alt')?.trim() ?? '';

        return element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
      };

      for (const element of Array.from(document.querySelectorAll('button, a[href], [role="button"], [role="combobox"], [role="option"], [role="tab"]'))) {
        if (isHiddenFromA11y(element) || !hasVisibleBox(element)) continue;
        if (!accessibleNameOf(element)) {
          violations.push({ rule: 'interactive-name', detail: `${element.tagName.toLowerCase()}.${element.className || '(no class)'} 缺少可访问名称` });
        }
      }

      for (const element of Array.from(document.querySelectorAll('input, select, textarea'))) {
        const input = element as HTMLInputElement;
        if (input.type === 'hidden') continue;
        if (isHiddenFromA11y(element) || !hasVisibleBox(element)) continue;
        if (!accessibleNameOf(element)) {
          violations.push({ rule: 'control-name', detail: `${element.tagName.toLowerCase()}[type=${input.type}] placeholder=${input.placeholder || '(none)'} 缺少名称` });
        }
      }

      for (const image of Array.from(document.querySelectorAll('img'))) {
        if (image.getAttribute('alt') === null) {
          violations.push({ rule: 'img-alt', detail: `img src=${image.getAttribute('src') ?? '(none)'} 缺少 alt` });
        }
      }

      const seenIds = new Map<string, number>();
      for (const element of Array.from(document.querySelectorAll('[id]'))) {
        const id = element.getAttribute('id') ?? '';
        if (!id) continue;
        seenIds.set(id, (seenIds.get(id) ?? 0) + 1);
      }
      for (const [id, count] of seenIds) {
        if (count > 1) violations.push({ rule: 'duplicate-id', detail: `id="${id}" 出现 ${count} 次` });
      }

      if (!document.documentElement.getAttribute('lang')) {
        violations.push({ rule: 'html-lang', detail: '<html> 缺少 lang' });
      }

      const h1Count = document.querySelectorAll('h1').length;
      if (h1Count !== 1) {
        violations.push({ rule: 'single-h1', detail: `${currentRoute} 有 ${h1Count} 个 h1` });
      }

      for (const element of Array.from(document.querySelectorAll('[tabindex]'))) {
        const value = Number(element.getAttribute('tabindex'));
        if (Number.isFinite(value) && value > 0) {
          violations.push({ rule: 'positive-tabindex', detail: `${element.tagName.toLowerCase()} tabindex=${value}` });
        }
      }

      return violations;
    },
    { route },
  );

const formatViolations = (route: string, violations: Violation[]) =>
  `${route}:\n${violations.map((item) => `  [${item.rule}] ${item.detail}`).join('\n')}`;

test.describe('Admin accessibility audit', () => {
  test('public admin login page has accessible controls', async ({ page }) => {
    await page.goto(`${adminBaseURL}/login`);
    await expect(page.getByRole('button', { name: '进入管理后台' })).toBeVisible();

    const violations = await collectViolations(page, '/login');
    expect(violations.length === 0 ? [] : [formatViolations('/login', violations)]).toEqual([]);
  });

  test('every admin route exposes named controls without duplicate ids', async ({ page }) => {
    await loginAdmin(page);
    const failures: string[] = [];

    for (const route of adminRoutes) {
      if (secondaryRoutes.has(route)) await openAdminMore(page);
      const link = page.locator(`aside a[href="${route}"]`).first();
      await expect(link).toBeVisible();
      await link.click();
      await expect(page).toHaveURL(new RegExp(`${route.replace('/', '\\/')}$`));
      await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => undefined);

      const violations = await collectViolations(page, route);
      if (violations.length) failures.push(formatViolations(route, violations));
    }

    expect(failures).toEqual([]);
  });
});
