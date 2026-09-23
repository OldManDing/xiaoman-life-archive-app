import { expect, type Page } from '@playwright/test';

export const webBaseURL = process.env.E2E_WEB_BASE_URL ?? `http://127.0.0.1:${process.env.E2E_WEB_PORT ?? 5176}`;
export const adminBaseURL = process.env.E2E_ADMIN_BASE_URL ?? `http://127.0.0.1:${process.env.E2E_ADMIN_PORT ?? 5177}`;
export const apiBaseURL = process.env.E2E_API_BASE_URL ?? `http://127.0.0.1:${process.env.E2E_API_PORT ?? 3001}`;

export async function loginWeb(page: Page) {
  await page.goto(`${webBaseURL}/auth/login`);
  await page.getByPlaceholder('账号').fill('xiaoman_parent');
  await page.getByPlaceholder('密码').fill('DemoUser123!');
  await page.getByRole('checkbox', { name: '我已阅读并同意《用户协议》和《隐私政策》' }).check();
  await page.getByRole('button', { name: '进入年轮' }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByText('成长封面')).toBeVisible();
}

export async function loginAdmin(page: Page) {
  await loginAdminAs(page, 'admin', 'ChangeMe123!');
}

/** 用任意后台账号登录（seed 里除了 admin 还有只读账号 viewer）。 */
export async function loginAdminAs(page: Page, username: string, password: string) {
  await page.goto(`${adminBaseURL}/login`);
  await page.getByPlaceholder('用户名').fill(username);
  await page.getByPlaceholder('密码').fill(password);
  await page.getByRole('button', { name: '进入管理后台' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: '后台总览' })).toBeVisible();
}

/** 打开「更多管理」面板并进入二级路由（面板在桌面端是侧栏内联展开）。 */
export async function openAdminSection(page: Page, linkName: string) {
  await openAdminMore(page);
  await page.getByRole('link', { name: linkName, exact: true }).click();
}

/** 打开「更多管理」面板（面板在桌面端是侧栏内联展开）。 */
export async function openAdminMore(page: Page) {
  const panel = page.locator('.admin-nav-more-content');
  if (await panel.isVisible().catch(() => false)) return;

  // 只点一次：点完立刻复查会因为 React 还没渲染而误判成"没打开"，
  // 再点第二次就把刚打开的面板又关上了（这正是之前 a11y 用例卡死的根因）。
  await page.locator('.admin-nav-more-trigger').click();
  await expect(panel).toBeVisible({ timeout: 5_000 });
}

/**
 * 点侧栏进入某条后台路由（一级、二级都能用）。
 *
 * 二级入口在「更多管理」面板里，而触发按钮是开关式的：从二级页跳回一级页时面板会被自动收起。
 * 这里按「有界重试」的方式导航：每轮先看链接在不在，不在就把开关点一次再重新判断，
 * 且点击本身带短超时 —— 失败会明确报错，而不是把一个 click 挂到用例超时。
 */
export async function navigateToAdminRoute(page: Page, route: string) {
  const link = page.locator(`aside a[href="${route}"]`).first();
  const expectedUrl = new RegExp(`${route.replace('/', '\\/')}$`);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    if ((await link.count()) === 0) {
      await page.locator('.admin-nav-more-trigger').click({ timeout: 5_000 }).catch(() => undefined);
      await page.waitForTimeout(150);
      continue;
    }

    if (await link.isVisible().catch(() => false)) {
      await link.click({ timeout: 5_000 }).catch(() => undefined);
      if (expectedUrl.test(page.url())) {
        await expect(page).toHaveURL(expectedUrl);
        return;
      }
    }

    await page.waitForTimeout(150);
  }

  throw new Error(`无法通过侧栏进入 ${route}（当前 URL=${page.url()}）`);
}

export async function expectNoUnfinishedCopy(page: Page) {
  await expect(page.getByText(/准备中|待接入|规划中|设计中|待开放|暂未开放|联调|验收|最小可用|正式上线后|Coming soon/)).toHaveCount(0);
}

export async function expectNoTechnicalTestCopy(page: Page) {
  await expect(page.getByText(/自动化|mock|Mock|E2E/)).toHaveCount(0);
}

export async function expectNoEnglishSeedCopy(page: Page) {
  await expect(page.getByText(/Demo Parent|Demo Viewer|Xiaoman|First independent meal|Learned to say thanks|Living room/)).toHaveCount(0);
}
