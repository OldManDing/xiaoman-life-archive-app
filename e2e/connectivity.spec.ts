import { expect, test, type Page } from '@playwright/test';

import { adminBaseURL, expectNoEnglishSeedCopy, loginWeb, openAdminMore, webBaseURL } from './helpers';

const confirmAdminAction = async (page: Page, reason: string) => {
  const dialog = page.getByRole('dialog', { name: /冻结用户|解冻用户|下架记录|恢复记录|通过媒体审核|标记媒体异常|下架媒体|重试 AI 任务|取消 AI 任务/ });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('操作原因').fill(reason);
  await dialog.getByRole('button', { name: '确认执行' }).click();
  await expect(dialog).toBeHidden();
};

const loginAdminDirectly = async (page: Page) => {
  await page.goto(`${adminBaseURL}/login`);
  await page.getByPlaceholder('用户名').fill('admin');
  await page.getByPlaceholder('密码').fill('ChangeMe123!');
  await page.getByRole('button', { name: '进入管理后台' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: '后台总览' })).toBeVisible();
};

const openAdminModule = async (page: Page, path: string) => {
  if (path === '/media' || path === '/content-risks') {
    await openAdminMore(page);
    await page.locator('aside a[href="/ops-readiness"]').click();
    await expect(page).toHaveURL(/\/ops-readiness$/);
    await page.getByRole('link', { name: path === '/media' ? '技术媒体库' : '风险队列', exact: true }).click();
  } else {
    if (['/users', '/ai-jobs', '/audit-logs'].includes(path)) await openAdminMore(page);
    await page.locator(`a[href="${path}"]`).first().click();
  }
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await expect(page.getByRole('button', { name: '查询' })).toBeVisible();
};

test.describe('Front and admin button/API connectivity', () => {
  test('App secondary buttons submit, navigate, and show visible feedback', async ({ page }) => {
    await loginWeb(page);
    await expectNoEnglishSeedCopy(page);
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: webBaseURL });

    await page.goto(`${webBaseURL}/profile/account`);
    await expect(page.getByRole('heading', { name: '个人资料' })).toBeVisible();
    const nickname = page.getByLabel('昵称');
    await nickname.fill('');
    await page.getByRole('button', { name: '保存资料' }).click();
    await expect(page.getByText('昵称不能为空')).toBeVisible();
    await nickname.fill('小满妈妈');
    await page.getByRole('button', { name: '保存资料' }).click();
    await expect(page.getByText('昵称保存成功')).toBeVisible();

    await page.goto(`${webBaseURL}/profile/settings`);
    await page.getByRole('button', { name: '手机号搜索' }).click();
    await expect(page.getByText('设置已保存')).toBeVisible();

    await page.goto(`${webBaseURL}/profile/export`);
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByText('导出与备份')).toHaveCount(0);

    await page.goto(`${webBaseURL}/profile/membership`);
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByText('服务状态')).toHaveCount(0);

    await page.goto(`${webBaseURL}/profile/security`);
    await page.getByRole('button', { name: '注销账号' }).click();
    await expect(page).toHaveURL(/\/profile\/account-delete$/);
    await expect(page.getByRole('heading', { name: '注销账号' })).toBeVisible();
    await expect(page.getByPlaceholder('请输入当前登录密码')).toBeVisible();
    await expect(page.getByPlaceholder(/确认注销/)).toBeVisible();

    await page.goto(`${webBaseURL}/profile/help`);
    await page.getByRole('button', { name: '提交反馈' }).click();
    await expect(page.getByText('请至少输入 6 个字，方便定位问题。')).toBeVisible();
    await page.getByPlaceholder('问题、页面、操作').fill('页面显示正常，按钮可点击，反馈记录用于验证保存流程。');
    await page.getByRole('button', { name: '提交反馈' }).click();
    await expect(page.getByText('反馈已提交，客服会在处理后联系你。')).toBeVisible();

    await page.goto(`${webBaseURL}/profile/about`);
    await expect(page.getByText('年轮 © 2026')).toBeVisible();
    await page.getByRole('button', { name: '用户服务协议' }).click();
    await expect(page).toHaveURL(/\/profile\/legal$/);
    await expect(page.getByText('儿童信息保护摘要')).toBeVisible();

    await page.goto(`${webBaseURL}/family/invite`);
    await page.getByRole('button', { name: '生成邀请码' }).click();
    await expect(page.getByText('邀请码已生成', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '复制到剪贴板' })).toBeVisible();

    await page.goto(`${webBaseURL}/record/r_demo_001`);
    await expect(page.getByTestId('record-primary-media-preview')).toBeVisible();
    await expect(page.getByText('第一次自己吃饭', { exact: true })).toBeVisible();
    const aiSectionVisible = await page.getByText('整理建议').isVisible().catch(() => false);
    if (aiSectionVisible) {
      await page.getByRole('button', { name: '标题' }).click();
      await expect(page.getByText(/标题(正在处理中|已生成并同步到记录详情)|调用频率(受限|超限)/)).toBeVisible();
      await page.getByRole('button', { name: '摘要' }).click();
      await expect(page.getByText(/摘要(正在处理中|已生成并同步到记录详情)|调用频率(受限|超限)/)).toBeVisible();
      await page.getByRole('button', { name: '标签' }).click();
      await expect(page.getByText(/标签(正在处理中|已生成并同步到记录详情)|调用频率(受限|超限)/)).toBeVisible();
    }
  });

  test('Admin module buttons query, open drawers, and hit mutation APIs', async ({ page }) => {
    await loginAdminDirectly(page);
    await expectNoEnglishSeedCopy(page);

    for (const path of ['/users', '/children', '/records', '/media', '/ai-jobs', '/audit-logs']) {
      await openAdminModule(page, path);
    }

    await openAdminModule(page, '/users');
    const userRow = page.getByRole('row', { name: /小满妈妈/ });
    await page.getByRole('button', { name: '查询' }).click();
    await expect(userRow).toContainText('基础会员');
    await userRow.getByRole('button', { name: '详情' }).click();
    await expect(page.getByRole('dialog', { name: '用户详情' })).toBeVisible();
    await page.getByRole('button', { name: '关闭' }).click();

    await openAdminModule(page, '/children');
    const childRow = page.getByRole('row', { name: /小满/ });
    await page.getByRole('button', { name: '查询' }).click();
    await childRow.getByRole('button', { name: '详情' }).click();
    await expect(page.getByRole('dialog', { name: '孩子档案详情' })).toBeVisible();
    await page.getByRole('button', { name: '关闭' }).click();

    await openAdminModule(page, '/records');
    const recordRow = page.getByRole('row', { name: /第一次自己吃饭/ });
    await page.getByRole('button', { name: '查询' }).click();
    await recordRow.getByRole('button', { name: '详情' }).click();
    await expect(page.getByRole('dialog', { name: '成长记录详情' })).toBeVisible();
    await page.getByRole('button', { name: '关闭' }).click();
    await recordRow.getByRole('button', { name: '更多操作' }).click();
    await recordRow.getByRole('button', { name: '下架' }).click();
    await confirmAdminAction(page, '自动化验证记录下架按钮');
    await expect(recordRow).toContainText('草稿');
    await recordRow.getByRole('button', { name: '更多操作' }).click();
    await recordRow.getByRole('button', { name: '恢复' }).click();
    await confirmAdminAction(page, '自动化验证记录恢复按钮');
    await expect(recordRow).toContainText('已发布');

    await openAdminModule(page, '/media');
    const mediaRow = page.getByRole('row', { name: /第一次自己吃饭/ });
    await page.getByPlaceholder('编号 / 文件 / 孩子 / 记录').fill('第一次自己吃饭');
    await page.getByRole('button', { name: '查询' }).click();
    await mediaRow.getByRole('button', { name: '详情' }).click();
    await expect(page.getByRole('dialog', { name: '媒体详情' })).toBeVisible();
    await page.getByRole('button', { name: '关闭' }).click();
    await mediaRow.getByRole('button', { name: '更多操作' }).click();
    await expect(page.getByRole('button', { name: '标记异常' })).toBeVisible();
    await page.getByRole('button', { name: '标记异常' }).click();
    await confirmAdminAction(page, '自动化验证媒体异常按钮');
    await expect(mediaRow).toContainText('异常');
    await mediaRow.getByRole('button', { name: '更多操作' }).click();
    await mediaRow.getByRole('button', { name: '通过' }).click();
    await confirmAdminAction(page, '自动化验证媒体通过按钮');
    await expect(mediaRow).toContainText('可用');

    await openAdminModule(page, '/ai-jobs');
    await page.getByRole('button', { name: '查询' }).click();
    await expect(page.getByRole('row').nth(1)).toBeVisible();

    await openAdminModule(page, '/audit-logs');
    await page.getByRole('button', { name: '查询' }).click();
    await expect(page.getByRole('row').first()).toBeVisible();
    await page.getByRole('button', { name: '清空' }).click();
    await page.getByRole('button', { name: '查询' }).click();
    await expect(page.getByText('审计日志概览')).toBeVisible();
  });
});
