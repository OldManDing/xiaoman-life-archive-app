import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

/**
 * 生产产物冒烟：用 apps/admin/dist 的真实构建结果跑一遍关键路径。
 * 前面所有 E2E 都跑在 vite dev server 上，构建产物的差异（代码分割、静态资源路径、
 * SPA 回退、CSP、跨端口 API）只有在真产物上才暴露。
 */

const port = Number(process.env.E2E_ADMIN_DIST_PORT ?? 5188);
const baseURL = `http://127.0.0.1:${port}`;

let server: ChildProcess | null = null;

test.describe('Admin production bundle smoke', () => {
  test.beforeAll(async () => {
    // 总是重新构建：冒烟必须跑在「当前源码」的产物上，用陈旧的 dist 会得到假绿。
    execFileSync('npm', ['run', 'build:admin'], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      // 显式清空 VITE_API_BASE_URL：冒烟要验证的是「同源 /api/v1 + 反代」这条链路。
      env: { ...process.env, VITE_API_BASE_URL: '' },
    });

    server = spawn(process.execPath, [join('scripts', 'serve-admin-dist.cjs')], {
      stdio: 'inherit',
      env: {
        ...process.env,
        ADMIN_DIST_PORT: String(port),
        ADMIN_DIST_API_TARGET: `http://127.0.0.1:${process.env.E2E_API_PORT ?? 3001}`,
      },
    });

    await expect
      .poll(
        async () => {
          try {
            const response = await fetch(`${baseURL}/login`);
            return response.status;
          } catch {
            return 0;
          }
        },
        { timeout: 20_000, message: '构建产物静态服务器应能在 20s 内起来' },
      )
      .toBe(200);
  });

  test.afterAll(() => {
    server?.kill();
    server = null;
  });

  test('built bundle boots, deep links fall back to the SPA, and the API proxy works', async ({ page }) => {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];

    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(error.message));
    page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
    page.on('response', (response) => {
      if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.url()}`);
    });

    // 深链直达必须回退到 index.html，再由前端路由跳到登录页
    await page.goto(`${baseURL}/audit-logs`);
    await expect(page.getByRole('heading', { name: '管理员登录' })).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);

    // 产物里的静态资源（CSS/JS/图标）都要能取到
    await expect(page.locator('img.admin-login-card-logo')).toBeVisible();

    await page.getByPlaceholder('用户名').fill('admin');
    await page.getByPlaceholder('密码').fill('ChangeMe123!');
    await page.getByRole('button', { name: '进入管理后台' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: '后台总览' })).toBeVisible();
    // 走的是反代到本地 API 的真实数据
    await expect(page.getByText('数据规模')).toBeVisible();

    expect(failedRequests, '构建产物冒烟不应有失败请求或 4xx/5xx').toEqual([]);
    expect(consoleErrors, '构建产物不应有控制台错误（含 CSP 违规）').toEqual([]);
  });
});
