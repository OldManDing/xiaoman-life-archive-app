import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { expect, test } from '@playwright/test';

import { loginAdmin, navigateToAdminRoute } from './helpers';

// CSS 收敛对照探针：只比对「被删除规则的选择器」在各路由上的计算样式。
// 关掉过渡与动画，避免抓到动画中间值；元素缺失记为 "absent"，同样参与比对。
//   BASELINE=1 npx playwright test e2e/css-parity-probe.spec.ts   → 写基线（需先还原 CSS）
//   npx playwright test e2e/css-parity-probe.spec.ts              → 与基线比对
const routes = [
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

// 被删除的 30 条冗余规则的选择器（同选择器 + 同声明的前置副本）
const selectors = [
  '.admin-date-display-empty',
  '.admin-date-input-icon',
  '.admin-detail-grid',
  '.admin-nav-section',
  '.admin-ops-action-helper',
  '.admin-ops-action-label',
  '.admin-ops-action-link',
  '.admin-ops-action-list',
  '.admin-ops-entry-actions',
  '.admin-ops-panel-head',
  '.admin-ops-report-block',
  '.admin-ops-report-head',
  '.admin-ops-report-list',
  '.admin-ops-report-title',
  '.admin-ops-section-title',
  '.admin-ops-section-title-tight',
  '.admin-ops-sev-p0',
  '.admin-ops-sev-p1',
  '.admin-ops-stat-card',
  '.admin-ops-stat-grid-auto',
  '.admin-ops-stat-label',
  '.admin-ops-stat-num',
  '.admin-ops-table-scroll-auto',
  '.admin-overview-stat strong',
  '.admin-overview-stat:last-child',
  '.admin-sidebar .admin-nav-more-content .admin-nav-section-items',
  '.admin-sidebar > .admin-nav-sections > .admin-nav-section > .admin-nav-section-items',
  '.admin-sidebar > .admin-nav-sections > .admin-nav-section > .admin-nav-section-label',
  '.admin-system-config-name strong',
];

const outputPath = resolve(process.cwd(), 'artifacts', 'css-parity', 'selector-styles.json');

test.describe('CSS 收敛对照', () => {
  test('deleted rules leave computed styles untouched', async ({ page }) => {
    // 基线放在 gitignore 的 artifacts 下，不随仓库分发：没有基线时跳过，
    // 需要时按文件头的说明先生成一次（这是做 CSS 收敛手术时的安全网）。
    test.skip(!process.env.BASELINE && !existsSync(outputPath), '未生成 CSS 对照基线，先以 BASELINE=1 跑一次');
    test.setTimeout(300_000);
    await mkdir(resolve(process.cwd(), 'artifacts', 'css-parity'), { recursive: true });
    await loginAdmin(page);

    // 关掉过渡/动画：否则会抓到动画中间值（首轮对照就出现过这种假差异）
    await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' });

    const snapshot: Record<string, Record<string, string>> = {};
    for (const route of routes) {
      await navigateToAdminRoute(page, route);
      await page.waitForTimeout(250);
      snapshot[route] = await page.evaluate((wanted: string[]) => {
        const properties = [
          'color',
          'background-color',
          'background-image',
          'border-top-color',
          'border-top-width',
          'border-radius',
          'font-size',
          'font-weight',
          'line-height',
          'letter-spacing',
          'display',
          'position',
          'flex-direction',
          'align-items',
          'justify-content',
          'gap',
          'grid-template-columns',
          'opacity',
          'box-shadow',
          'padding-top',
          'padding-left',
          'margin-top',
          'margin-bottom',
          'min-width',
          'text-overflow',
          'white-space',
          'overflow',
        ];
        const result: Record<string, string> = {};
        for (const selector of wanted) {
          const element = document.querySelector(selector);
          if (!element) {
            result[selector] = 'absent';
            continue;
          }
          const style = window.getComputedStyle(element);
          result[selector] = properties.map((property) => `${property}=${style.getPropertyValue(property)}`).join(';');
        }
        return result;
      }, selectors);
    }

    if (process.env.BASELINE === '1') {
      await writeFile(outputPath, JSON.stringify(snapshot, null, 1), 'utf8');
      console.log(`[css-parity] 已写入基线：${outputPath}`);
      return;
    }

    const baseline = JSON.parse(await readFile(outputPath, 'utf8')) as Record<string, Record<string, string>>;
    const differences: string[] = [];
    for (const route of routes) {
      const before = baseline[route] ?? {};
      const after = snapshot[route] ?? {};
      for (const selector of selectors) {
        const left = before[selector] ?? 'missing-in-baseline';
        const right = after[selector] ?? 'missing-in-snapshot';
        if (left === right) continue;
        if (left === 'absent' && right === 'absent') continue;
        const beforeProperties = new Map(left.split(';').map((item) => item.split('=')));
        const afterProperties = new Map(right.split(';').map((item) => item.split('=')));
        const changed = [...new Set([...beforeProperties.keys(), ...afterProperties.keys()])]
          .filter((property) => beforeProperties.get(property) !== afterProperties.get(property))
          .map((property) => `${property}: "${beforeProperties.get(property)}" → "${afterProperties.get(property)}"`);
        differences.push(`${route} ${selector} :: ${changed.join(' | ')}`);
      }
    }

    console.log(`[css-parity] 差异条数：${differences.length}`);
    differences.slice(0, 30).forEach((line) => console.log(`  ${line}`));
    expect(differences, '被删除规则的选择器在各路由上的计算样式差异').toEqual([]);
  });
});
