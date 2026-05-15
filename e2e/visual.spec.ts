import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { adminBaseURL, expectNoEnglishSeedCopy, expectNoTechnicalTestCopy, expectNoUnfinishedCopy, loginAdmin, loginWeb, webBaseURL } from './helpers';

const visualDir = resolve(process.cwd(), 'artifacts', 'visual-review-current');

async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(() => Math.ceil(document.documentElement.scrollWidth - window.innerWidth));
  expect(overflow).toBeLessThanOrEqual(2);
}

async function saveScreenshot(page: Page, name: string, fullPage = true) {
  await mkdir(visualDir, { recursive: true });
  await page.screenshot({ path: resolve(visualDir, name), fullPage });
}

test.describe('Visual review smoke', () => {
  test('captures App key screens without localized-copy regressions', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${webBaseURL}/auth/login`);

    await expect(page.getByRole('heading', { name: '登录注册' })).toBeVisible();
    await expect(page.getByText(/验证码登录|短信登录|接受邀请|邀请链接/)).toHaveCount(0);
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-login-mobile.png', false);

    await loginWeb(page);
    await expect(page.getByText('学会说谢谢').first()).toBeVisible();
    await expectNoEnglishSeedCopy(page);
    await expectNoTechnicalTestCopy(page);
    await expectNoUnfinishedCopy(page);
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-home-mobile.png', false);

    await page.goto(`${webBaseURL}/onboarding/child?mode=add`);
    await expect(page.getByRole('heading', { name: '添加宝宝档案' })).toBeVisible();
    await expect(page.getByLabel('宝宝小名')).toBeVisible();
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-child-select-mobile.png', false);

    await page.goto(`${webBaseURL}/search`);
    await expect(page.getByRole('heading', { name: '搜索历史' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '热门标签' })).toBeVisible();
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-search-mobile.png', false);

    await page.goto(`${webBaseURL}/timeline`);
    await expect(page.getByRole('heading', { name: '时间轴' })).toBeVisible();
    await expect(page.getByText('学会说谢谢').first()).toBeVisible();
    await expectNoEnglishSeedCopy(page);
    await expectNoTechnicalTestCopy(page);
    await expectNoUnfinishedCopy(page);
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-timeline-mobile.png', false);

    await page.goto(`${webBaseURL}/family`);
    await expect(page.getByRole('heading', { name: '家庭', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '家庭成员' })).toBeVisible();
    await expect(page.getByText('小满妈妈').first()).toBeVisible();
    await expect(page.getByText('正在加载家庭动态…')).toHaveCount(0);
    await expectNoEnglishSeedCopy(page);
    await expectNoUnfinishedCopy(page);
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-family-mobile.png', false);

    await page.goto(`${webBaseURL}/family/members/u_demo_parent_001`);
    await expect(page.getByRole('heading', { name: '家人资料' })).toBeVisible();
    await expect(page.getByText('权限管理')).toBeVisible();
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-family-member-mobile.png', false);

    await page.goto(`${webBaseURL}/family/invite`);
    await expect(page.getByRole('heading', { name: '邀请家庭成员' })).toBeVisible();
    await expect(page.getByText('创建邀请码后，被邀请人可用它注册账号并加入家庭。')).toBeVisible();
    await expect(page.getByText(/接受邀请|邀请链接|打开接受邀请页/)).toHaveCount(0);
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-family-invite-mobile.png', false);

    await page.goto(`${webBaseURL}/record/create?type=milestone&focus=content`);
    await expect(page.getByRole('heading', { name: '记录时光' })).toBeVisible();
    await expect(page.getByRole('button', { name: /切换孩子|孩子资料/ })).toBeVisible();
    await expect(page.getByRole('button', { name: '切换里程碑记录' })).toHaveAttribute('aria-pressed', 'true');
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-record-create-mobile.png', false);
    await saveScreenshot(page, 'app-record-selects-mobile.png', true);

    await page.goto(`${webBaseURL}/record/r_demo_001`);
    await expect(page.getByRole('heading', { name: '记录详情' })).toBeVisible();
    await expect(page.getByText('媒体数量：1')).toBeVisible();
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-record-detail-mobile.png', false);

    await page.goto(`${webBaseURL}/profile/help`);
    await expect(page.getByRole('heading', { name: '帮助与反馈' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: '问题类型' })).toBeVisible();
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-help-select-mobile.png', false);

    await page.goto(`${webBaseURL}/profile`);
    await expect(page.getByText('我的孩子')).toBeVisible();
    await expect(page.getByText('管理中心')).toBeVisible();
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-profile-mobile.png', false);

    await page.goto(`${webBaseURL}/profile/reports`);
    await expect(page.getByRole('heading', { name: '月报与纪念册' })).toBeVisible();
    await expect(page.getByText('AI 月报摘要')).toBeVisible();
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-reports-mobile.png', false);

    await page.goto(`${webBaseURL}/profile/export`);
    await expect(page.getByRole('heading', { name: '导出与备份' })).toBeVisible();
    await expect(page.getByText('选择导出内容')).toBeVisible();
    await expect(page.getByText('正在整理档案摘要…')).toHaveCount(0);
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-export-mobile.png', false);

    await page.goto(`${webBaseURL}/profile/membership`);
    await expect(page.getByRole('heading', { name: '会员中心' })).toBeVisible();
    await expect(page.getByText('您的专属特权')).toBeVisible();
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-membership-mobile.png', false);

    await page.goto(`${webBaseURL}/profile/security`);
    await expect(page.getByRole('heading', { name: '账号与安全' })).toBeVisible();
    await expect(page.getByRole('button', { name: '注销账号' })).toBeVisible();
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-security-mobile.png', false);

    await page.goto(`${webBaseURL}/profile/about`);
    await expect(page.getByRole('heading', { name: '关于我们' })).toBeVisible();
    await expect(page.getByText('用户服务协议')).toBeVisible();
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-about-mobile.png', false);
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

    await page.getByRole('link', { name: '审计日志', exact: true }).click();
    await expect(page.getByRole('heading', { name: '审计日志' })).toBeVisible();
    await expect(page.getByRole('combobox').first()).toBeVisible();
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'admin-audit-log.png');
  });
});
