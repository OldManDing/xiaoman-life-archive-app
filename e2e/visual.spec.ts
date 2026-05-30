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
    const authSubmitButton = page.getByRole('button', { name: '进入年轮' });
    await expect(authSubmitButton).toBeDisabled();
    await expect(authSubmitButton).toHaveCSS('cursor', 'not-allowed');
    await expect(authSubmitButton).toHaveCSS('box-shadow', 'none');
    const authSubmitBox = await authSubmitButton.boundingBox();
    expect(authSubmitBox?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(700);
    expect((authSubmitBox?.height ?? 0)).toBeGreaterThanOrEqual(44);
    await expect(page.getByText(/验证码登录|短信登录|接受邀请|邀请链接/)).toHaveCount(0);
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-login-mobile.png');

    await loginWeb(page);
    await expect(page.getByText('学会说谢谢').first()).toBeVisible();
    await expectNoEnglishSeedCopy(page);
    await expectNoTechnicalTestCopy(page);
    await expectNoUnfinishedCopy(page);
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-home-mobile.png');

    await page.goto(`${webBaseURL}/onboarding/child?mode=add`);
    await expect(page.getByRole('heading', { name: '添加宝宝档案' })).toBeVisible();
    await expect(page.getByLabel('宝宝小名')).toBeVisible();
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-child-select-mobile.png');

    await page.goto(`${webBaseURL}/search`);
    await expect(page.getByRole('heading', { name: '搜索历史' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '热门标签' })).toBeVisible();
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-search-mobile.png');

    await page.goto(`${webBaseURL}/timeline`);
    await expect(page.getByRole('heading', { name: '时间轴' })).toBeVisible();
    await expect(page.getByText('学会说谢谢').first()).toBeVisible();
    await expectNoEnglishSeedCopy(page);
    await expectNoTechnicalTestCopy(page);
    await expectNoUnfinishedCopy(page);
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-timeline-mobile.png');

    await page.goto(`${webBaseURL}/family`);
    await expect(page.getByRole('heading', { name: '家庭', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '家庭成员' })).toBeVisible();
    await expect(page.getByText('小满妈妈').first()).toBeVisible();
    await expect(page.getByText('正在加载家庭动态…')).toHaveCount(0);
    await expectNoEnglishSeedCopy(page);
    await expectNoUnfinishedCopy(page);
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-family-mobile.png');

    await page.goto(`${webBaseURL}/family/members/u_demo_parent_001`);
    await expect(page.getByRole('heading', { name: '家人资料' })).toBeVisible();
    await expect(page.getByText('权限管理')).toBeVisible();
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-family-member-mobile.png');

    await page.goto(`${webBaseURL}/family/invite`);
    await expect(page.getByRole('heading', { name: '邀请家庭成员' })).toBeVisible();
    await expect(page.getByText('创建邀请码后，被邀请人可用它注册账号并加入家庭。')).toBeVisible();
    await expect(page.getByText(/接受邀请|邀请链接|打开接受邀请页/)).toHaveCount(0);
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-family-invite-mobile.png');

    await page.goto(`${webBaseURL}/family/child`);
    await expect(page.getByRole('heading', { name: '孩子资料' })).toBeVisible();
    await expect(page.getByText('保存孩子资料')).toBeVisible();
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-family-child-mobile-long.png');

    await page.goto(`${webBaseURL}/family/members`);
    await expect(page.getByRole('heading', { name: '家庭成员管理' })).toBeVisible();
    await expect(page.getByText('查看成员、邀请来源和角色信息。')).toBeVisible();
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-family-members-mobile-long.png');

    await page.goto(`${webBaseURL}/record/create?type=milestone&focus=content`);
    await expect(page.getByRole('heading', { name: '记录时光' })).toBeVisible();
    await expect(page.getByRole('button', { name: '切换孩子：小满' })).toBeVisible();
    await expect(page.getByRole('button', { name: '切换里程碑记录' })).toHaveAttribute('aria-pressed', 'true');
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-record-create-mobile.png');
    await saveScreenshot(page, 'app-record-selects-mobile.png', true);

    await page.goto(`${webBaseURL}/record/r_demo_001`);
    await expect(page.getByRole('heading', { name: '记录详情' })).toBeVisible();
    await expect(page.getByText('媒体数量：1')).toBeVisible();
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-record-detail-mobile.png');
    await saveScreenshot(page, 'app-record-detail-mobile-long.png', true);

    await page.getByRole('button', { name: '编辑记录' }).click();
    await expect(page.getByText('编辑记录')).toBeVisible();
    await expect(page.getByPlaceholder('给这一刻起个名字')).not.toHaveValue('');
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-record-edit-mobile.png');
    await saveScreenshot(page, 'app-record-edit-mobile-long.png', true);

    await page.goto(`${webBaseURL}/profile/help`);
    await expect(page.getByRole('heading', { name: '帮助与反馈' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: '问题类型' })).toBeVisible();
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-help-select-mobile.png');

    await page.goto(`${webBaseURL}/profile`);
    await expect(page.getByText('我的孩子')).toBeVisible();
    await expect(page.getByText('管理中心')).toBeVisible();
    await expect(page.getByText('月报与纪念册')).toBeVisible();
    await expect(page.getByText('导出与备份')).toBeVisible();
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-profile-mobile.png');

    await page.goto(`${webBaseURL}/profile/account`);
    await expect(page.getByRole('heading', { name: '个人资料' })).toBeVisible();
    await expect(page.getByText('保存昵称')).toBeVisible();
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-account-mobile-long.png');

    await page.goto(`${webBaseURL}/profile/settings`);
    await expect(page.getByRole('heading', { name: '隐私设置' })).toBeVisible();
    await expect(page.getByRole('button', { name: '允许通过手机号搜索到我' })).toBeVisible();
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-settings-mobile-long.png');

    await page.goto(`${webBaseURL}/profile/reports`);
    await expect(page.getByRole('heading', { name: '月报与纪念册' })).toBeVisible();
    await expect(page.getByText('AI 月报摘要')).toBeVisible();
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-reports-mobile.png');

    await page.goto(`${webBaseURL}/profile/export`);
    await expect(page.getByRole('heading', { name: '导出与备份' })).toBeVisible();
    await expect(page.getByText('选择导出内容')).toBeVisible();
    await expect(page.getByText('正在整理档案摘要…')).toHaveCount(0);
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-export-mobile.png');

    await page.goto(`${webBaseURL}/profile/membership`);
    await expect(page.getByRole('heading', { name: '会员中心' })).toBeVisible();
    await expect(page.getByText('您的专属特权')).toBeVisible();
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-membership-mobile.png');

    await page.goto(`${webBaseURL}/profile/security`);
    await expect(page.getByRole('heading', { name: '账号与安全' })).toBeVisible();
    await expect(page.getByRole('button', { name: '注销账号' })).toBeVisible();
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-security-mobile.png');

    await page.goto(`${webBaseURL}/profile/account-delete`);
    await expect(page.getByRole('heading', { name: '注销账号' })).toBeVisible();
    await expect(page.getByText(/当前还不能直接注销|当前账号可以注销/)).toBeVisible();
    if (await page.getByText('当前还不能直接注销').count()) {
      await expect(page.getByRole('button', { name: '去处理成员' })).toBeVisible();
      await expect(page.getByRole('button', { name: '提交协助' })).toBeVisible();
    }
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-account-delete-mobile-long.png');

    await page.goto(`${webBaseURL}/profile/legal`);
    await expect(page.getByRole('heading', { name: '关于与协议' })).toBeVisible();
    await expect(page.getByText('当前版本说明', { exact: true })).toBeVisible();
    await expectNoUnfinishedCopy(page);
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-legal-mobile-long.png');

    await page.goto(`${webBaseURL}/profile/about`);
    await expect(page.getByRole('heading', { name: '关于我们' })).toBeVisible();
    await expect(page.getByText('用户服务协议')).toBeVisible();
    await expect(page.getByText(/待开放|正式上线/)).toHaveCount(0);
    await expectNoUnfinishedCopy(page);
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-about-mobile.png');

    await page.goto(`${webBaseURL}/error`);
    await expect(page.getByRole('heading', { name: '页面暂时无法打开' })).toBeVisible();
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'app-error-mobile-long.png');
  });

  test('captures Admin key screens without layout overflow', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAdmin(page);

    await expectNoEnglishSeedCopy(page);
    await expectNoUnfinishedCopy(page);
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'admin-dashboard.png');

    await page.getByRole('link', { name: '媒体库', exact: true }).click();
    await page.getByRole('button', { name: '查询' }).click();
    await expect(page.getByRole('heading', { name: '媒体列表' })).toBeVisible();
    await expect(page.getByRole('row', { name: /第一次自己吃饭/ })).toBeVisible();
    await expect(page.getByRole('button', { name: '查询', exact: true })).toBeVisible();
    await expectNoEnglishSeedCopy(page);
    await expectNoUnfinishedCopy(page);
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'admin-media.png');

    await page.getByRole('link', { name: '审计日志', exact: true }).click();
    await expect(page.getByRole('heading', { name: '审计日志' })).toBeVisible();
    await expect(page.getByRole('combobox').first()).toBeVisible();
    await expect(page.getByRole('button', { name: '查询', exact: true })).toBeVisible();
    await expectNoUnfinishedCopy(page);
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'admin-audit-log.png');
  });

  test('captures Admin mobile key screens without layout overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAdmin(page);

    await expect(page.getByRole('heading', { name: '后台总览' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '下一步去哪' })).toBeVisible();
    await expectNoUnfinishedCopy(page);
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'admin-dashboard-mobile-long.png');

    await page.getByRole('link', { name: '媒体库', exact: true }).click();
    await expect(page.getByRole('heading', { name: '媒体列表' })).toBeVisible();
    await expect(page.getByRole('button', { name: '查询', exact: true })).toBeVisible();
    await expectNoUnfinishedCopy(page);
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'admin-media-mobile-long.png');

    await page.getByRole('link', { name: '审计日志', exact: true }).click();
    await expect(page.getByRole('heading', { name: '审计日志' })).toBeVisible();
    await expect(page.getByRole('button', { name: '查询', exact: true })).toBeVisible();
    await expectNoUnfinishedCopy(page);
    await expectNoPageOverflow(page);
    await saveScreenshot(page, 'admin-audit-log-mobile-long.png');
  });
});
