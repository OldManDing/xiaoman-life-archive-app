import { expect, test } from '@playwright/test';

import { loginAdmin, loginAdminAs, openAdminMore, openAdminSection } from './helpers';

/**
 * 补齐此前只有 jsdom 单测（mock API）覆盖、缺少真实后端联调的页面：
 * AI 设置（保存 + 测试连接）、通知管理、家庭详情抽屉、内容风险处置跳转、只读角色界面。
 */

test.describe('Admin console coverage', () => {
  test('AI settings save takes effect and the mock provider reports a skipped connection test', async ({ page }) => {
    await loginAdmin(page);
    await openAdminSection(page, 'AI 设置');

    await expect(page.getByRole('heading', { name: 'AI 服务设置' })).toBeVisible();
    await expect(page.getByText('Key 已配置').or(page.getByText('Key 未配置'))).toBeVisible();

    await page.getByRole('button', { name: '修改 AI 设置' }).click();
    const editor = page.getByRole('dialog', { name: '修改 AI 设置' });
    await expect(editor).toBeVisible();

    // 只动「请求超时」这种纯数值配置，并在跑完后还原，保证用例可重复执行。
    const originalTimeout = await editor.getByLabel('请求超时（毫秒）').inputValue();
    const parsed = Number(originalTimeout);
    const nextTimeout = Number.isFinite(parsed) && parsed >= 120_000 ? String(parsed - 1_000) : String((Number.isFinite(parsed) ? parsed : 30_000) + 1_000);

    await editor.getByLabel('请求超时（毫秒）').fill(nextTimeout);
    await editor.getByLabel('操作原因').fill('自动化验证 AI 设置保存链路');
    await editor.getByRole('button', { name: '保存 AI 设置' }).click();
    await expect(page.getByText(/AI 服务设置已保存/)).toBeVisible();

    // E2E 环境是 mock 供应商：连接测试必须如实说明「未发起真实调用」，不能报成连接失败。
    await page.getByRole('button', { name: '测试连接' }).click();
    const testDialog = page.getByRole('dialog', { name: '未执行真实测试' });
    await expect(testDialog).toBeVisible();
    await expect(testDialog).toContainText('mock');
    await testDialog.getByRole('button', { name: '知道了' }).click();
    await expect(testDialog).toBeHidden();

    // 还原
    await page.getByRole('button', { name: '修改 AI 设置' }).click();
    const restoreEditor = page.getByRole('dialog', { name: '修改 AI 设置' });
    await restoreEditor.getByLabel('请求超时（毫秒）').fill(originalTimeout);
    await restoreEditor.getByLabel('操作原因').fill('自动化验证后还原超时配置');
    await restoreEditor.getByRole('button', { name: '保存 AI 设置' }).click();
    await expect(page.getByText(/AI 服务设置已保存/)).toBeVisible();
  });

  test('notification management filters by read state and opens the delivery detail', async ({ page }) => {
    await loginAdmin(page);
    await openAdminSection(page, '通知管理');

    await expect(page.getByRole('heading', { name: '通知管理' })).toBeVisible();
    const firstRow = page.locator('.admin-responsive-table tbody tr').first();
    await expect(firstRow).toBeVisible();

    // 打开一条通知的详情，确认接收人/家庭/投递三段都在
    await firstRow.getByRole('button', { name: '详情' }).click();
    const drawer = page.getByRole('dialog', { name: '通知详情' });
    await expect(drawer).toBeVisible();
    // 用 heading 角色定位：正文里的「暂无投递记录」会与标题同名，纯文本定位会命中两个元素
    for (const section of ['通知内容', '接收人与家庭', '标题与正文', '投递记录']) {
      await expect(drawer.getByRole('heading', { name: section })).toBeVisible();
    }
    await page.getByRole('button', { name: '关闭详情' }).click();
    await expect(drawer).toBeHidden();

    // 已读状态筛选：选中「未读」后，已读列的每一格都必须是未读。
    // 注意查询期间旧数据仍留在表格里，必须等筛选真正生效再断言。
    await page.getByRole('combobox', { name: '已读状态' }).click();
    await page.getByRole('option', { name: '未读' }).click();
    await page.getByRole('button', { name: '查询' }).click();

    await expect
      .poll(
        async () => {
          const cells = await page.locator('.admin-responsive-table tbody td[data-label="已读"]').allInnerTexts();
          return cells.length > 0 && cells.every((text) => text.includes('未读'));
        },
        { timeout: 10_000 },
      )
      .toBe(true);
  });

  test('family detail drawer exposes members, children, records and handoff requests', async ({ page }) => {
    await loginAdmin(page);
    await page.getByRole('link', { name: '家庭管理', exact: true }).click();

    await expect(page.getByRole('heading', { name: '家庭管理' })).toBeVisible();
    await page.getByRole('button', { name: '查询' }).click();
    const familyRow = page.locator('.admin-responsive-table tbody tr').first();
    await expect(familyRow).toBeVisible();
    await familyRow.getByRole('button', { name: '详情' }).click();

    const drawer = page.getByRole('dialog', { name: '家庭详情' });
    await expect(drawer).toBeVisible();
    // 同样用 heading 定位：「档案交付申请」既是概览里的字段名，也是下方小节标题
    for (const section of ['家庭概览', '家庭成员', '孩子档案', '最近成长记录', '档案交付申请']) {
      await expect(drawer.getByRole('heading', { name: section })).toBeVisible();
    }
  });

  test('content risk queue hands off to the owning console', async ({ page }) => {
    await loginAdmin(page);
    await page.getByRole('link', { name: '内容风险', exact: true }).click();

    await expect(page.getByRole('heading', { name: '内容风险' })).toBeVisible();
    const riskRow = page.locator('.admin-responsive-table tbody tr').first();
    await expect(riskRow).toBeVisible();

    // 风险页只做归集，处置入口必须跳到真正的处理队列
    const handoff = riskRow.getByRole('link').first();
    await expect(handoff).toBeVisible();
    await handoff.click();
    await expect(page).toHaveURL(/\/(records|media|support-tickets|ai-jobs)(\?|$)/);
  });

  test('read-only admin sees no write actions anywhere', async ({ page }) => {
    await loginAdminAs(page, 'viewer', 'ChangeMe123!');
    await expect(page.getByText('只读账号').first()).toBeVisible();

    // 账号管理：行内只剩「详情」，冻结/重置密码/调整权益都不应出现
    await openAdminMore(page);
    await page.getByRole('link', { name: '账号管理', exact: true }).click();
    await expect(page.getByRole('heading', { name: '账号管理' })).toBeVisible();
    await expect(page.getByRole('button', { name: '详情' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /冻结|解冻/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '重置密码' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '调整权益' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '更多操作' })).toHaveCount(0);

    // 媒体审核：没有审核动作
    await page.getByRole('link', { name: '媒体审核', exact: true }).click();
    await expect(page.getByRole('heading', { name: '媒体库' })).toBeVisible();
    await expect(page.getByRole('button', { name: '更多操作' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '通过' })).toHaveCount(0);

    // 邀请码：表单禁用并说明原因
    await openAdminSection(page, '邀请码');
    await expect(page.getByRole('heading', { name: '邀请码管理' })).toBeVisible();
    await expect(page.getByRole('button', { name: '生成邀请码' })).toBeDisabled();
    await expect(page.getByText('当前账号为只读权限，无法生成或撤销邀请码。')).toBeVisible();

    // 审计日志：非超管直接访问会被重定向走
    await page.goto(`${new URL(page.url()).origin}/audit-logs`);
    await expect(page).toHaveURL(/\/users$/);
  });
});
