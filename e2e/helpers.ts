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

export async function openAdminMore(page: Page) {
  const more = page.locator('.admin-nav-more');
  const trigger = more.getByRole('button', { name: '更多管理' });
  if ((await trigger.getAttribute('aria-expanded')) !== 'true') {
    await trigger.click();
  }
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
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
