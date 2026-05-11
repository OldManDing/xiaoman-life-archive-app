import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { adminBaseURL, expectNoEnglishSeedCopy, expectNoUnfinishedCopy, loginAdmin, loginWeb, webBaseURL } from './helpers';

const visualDir = resolve(process.cwd(), 'artifacts', 'visual-review-current');

async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(() => Math.ceil(document.documentElement.scrollWidth - window.innerWidth));
  expect(overflow).toBeLessThanOrEqual(2);
}

async function saveScreenshot(page: Page, name: string) {
  await mkdir(visualDir, { recursive: true });
  await page.screenshot({ path: resolve(visualDir, name), fullPage: true });
}

test.describe('Visual review smoke', () => {
  test('captures App key screens without localized-copy regressions', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${webBaseURL}/auth/login`);

    await expect(page.getByRole('heading', { name: '登录注册' })).toBeVisible();
    await expect(page.getByText(/验证码登录|短信登录|接受邀请|邀请链接/)).toHaveCount(0);
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-login-mobile.png');

    await loginWeb(page);
    await expectNoEnglishSeedCopy(page);
    await expectNoUnfinishedCopy(page);
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-home-mobile.png');

    await page.goto(`${webBaseURL}/family/invite`);
    await expect(page.getByRole('heading', { name: '邀请家庭成员' })).toBeVisible();
    await expect(page.getByText('创建邀请码后，被邀请人可用它注册账号并加入家庭。')).toBeVisible();
    await expect(page.getByText(/接受邀请|邀请链接|打开接受邀请页/)).toHaveCount(0);
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-family-invite-mobile.png');
  });

  test('captures Admin key screens without layout overflow', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAdmin(page);

    await expectNoEnglishSeedCopy(page);
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'admin-dashboard.png');

    await page.getByRole('link', { name: '媒体库', exact: true }).click();
    await page.getByRole('button', { name: '查询' }).click();
    await expect(page.getByRole('heading', { name: '媒体列表' })).toBeVisible();
    await expect(page.getByRole('row', { name: /m_demo_001/ })).toBeVisible();
    await expectNoEnglishSeedCopy(page);
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'admin-media.png');
  });
});
