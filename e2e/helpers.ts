import { expect, type Page } from '@playwright/test';

export const webBaseURL = process.env.E2E_WEB_BASE_URL ?? `http://127.0.0.1:${process.env.E2E_WEB_PORT ?? 5176}`;
export const adminBaseURL = process.env.E2E_ADMIN_BASE_URL ?? `http://127.0.0.1:${process.env.E2E_ADMIN_PORT ?? 5177}`;
export const apiBaseURL = process.env.E2E_API_BASE_URL ?? `http://127.0.0.1:${process.env.E2E_API_PORT ?? 3001}`;

export async function loginWeb(page: Page) {
  await page.goto(`${webBaseURL}/auth/login`);
  await page.getByPlaceholder('请输入账号').fill('xiaoman_parent');
  await page.getByPlaceholder('请输入密码').fill('DemoUser123!');
  await page.getByRole('checkbox', { name: '我已阅读并同意《用户协议》和《隐私政策》' }).check();
  await page.getByRole('button', { name: '进入年轮' }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByText('最近更新')).toBeVisible();
}

export async function loginAdmin(page: Page) {
  await page.goto(`${adminBaseURL}/login`);
  await page.getByPlaceholder('用户名').fill('admin');
  await page.getByPlaceholder('密码').fill('ChangeMe123!');
  await page.getByRole('button', { name: '进入管理后台' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: '后台总览' })).toBeVisible();
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
