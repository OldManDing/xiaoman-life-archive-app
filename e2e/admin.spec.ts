import { expect, test, type Page } from '@playwright/test';

import { adminBaseURL, apiBaseURL, expectNoEnglishSeedCopy, loginAdmin } from './helpers';

const confirmAdminAction = async (page: Page, reason: string) => {
  const dialog = page.getByRole('dialog', { name: /冻结用户|解冻用户|下架记录|恢复记录|通过媒体审核|标记媒体异常|下架媒体|受理客服反馈|解决客服反馈|关闭客服反馈|受理档案交付申请|完成档案交付申请|驳回档案交付申请/ });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('操作原因').fill(reason);
  await dialog.getByRole('button', { name: '确认执行' }).click();
  await expect(dialog).toBeHidden();
};

test.describe('Admin critical journeys', () => {
  test('rejects invalid admin password with Chinese feedback', async ({ page }) => {
    await page.goto(`${adminBaseURL}/login`);
    await page.getByPlaceholder('用户名').fill('admin');
    await page.getByPlaceholder('密码').fill('wrong-password');
    await page.getByRole('button', { name: '进入管理后台' }).click();

    await expect(page.getByText('账号或密码错误')).toBeVisible();
  });

  test('logs in and renders dashboard with localized seed data', async ({ page }) => {
    await loginAdmin(page);

    await expect(page.getByText('系统管理员')).toBeVisible();
    await expect(page.getByText('超级管理员', { exact: true })).toBeVisible();
    await expect(page.getByText('今日优先级')).toBeVisible();
    await expect(page.getByRole('heading', { name: '值班工作台' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '今日处置顺序' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '下一步去哪' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '值班判断' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '链路状态' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '统计图' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '最近审计日志' })).toBeVisible();
    await expect(page.getByText('待处理 AI')).toBeVisible();
    await expect(page.getByText('今天先处理阻塞项。')).toBeVisible();
    await expect(page.getByText('优先排查上传失败、断链和下架素材。')).toBeVisible();
    await expect(page.getByText('AI、内容、媒体和审计集中到同一屏')).toBeVisible();
    await expectNoEnglishSeedCopy(page);
  });

  test('queries accounts and opens login detail drawer', async ({ page }) => {
    await loginAdmin(page);
    await page.getByRole('link', { name: '账号管理', exact: true }).click();
    await page.getByRole('button', { name: '查询' }).click();

    const parentRow = page.getByRole('row', { name: /小满妈妈/ });
    await expect(parentRow).toContainText('基础会员');
    await expect(parentRow).toContainText('正常');
    await parentRow.getByRole('button', { name: '详情' }).click();

    const detailDialog = page.getByRole('dialog', { name: '用户详情' });
    await expect(detailDialog).toBeVisible();
    await expect(detailDialog.getByText('基础资料')).toBeVisible();
    await expect(detailDialog.getByRole('heading', { name: '登录信息' })).toBeVisible();
    await expect(detailDialog.getByText('账号密码')).toBeVisible();
    await expect(detailDialog.getByRole('button', { name: '重置密码' })).toBeVisible();
    await expect(detailDialog.getByText('关联孩子')).toBeVisible();
    await expectNoEnglishSeedCopy(page);
  });

  test('generates a registration invite code from admin', async ({ page }) => {
    await loginAdmin(page);
    await page.getByRole('link', { name: '邀请码', exact: true }).click();

    await expect(page.getByRole('heading', { name: '邀请码管理' })).toBeVisible();
    await page.getByRole('button', { name: '生成邀请码' }).click();

    await expect(page.getByText('本次生成的邀请码')).toBeVisible();
    await expect(page.getByText(/^NL-[0-9A-F]{6}-[0-9A-F]{6}$/)).toBeVisible();
    await expect(page.getByRole('button', { name: '复制邀请码' })).toBeVisible();
  });

  test('filters audit logs and opens audit detail drawer', async ({ page }) => {
    await loginAdmin(page);
    await page.getByRole('link', { name: '审计日志', exact: true }).click();
    await page.getByRole('combobox').first().selectOption('admin_login');
    await page.getByRole('button', { name: '查询' }).click();

    const auditRow = page.getByRole('row', { name: /后台登录/ }).first();
    await expect(auditRow).toContainText('后台账号');
    await auditRow.getByRole('button', { name: '详情' }).click();

    await expect(page.getByRole('dialog', { name: '审计日志详情' })).toBeVisible();
    await expect(page.getByText('审计详情')).toBeVisible();
    await expect(page.getByText('客户端标识')).toBeVisible();
  });

  test('processes support tickets from the admin queue', async ({ page }) => {
    const loginResponse = await page.request.post(`${apiBaseURL}/api/v1/auth/login`, {
      data: { login_type: 'password', credential: 'xiaoman_parent', password: 'DemoUser123!' },
    });
    expect(loginResponse.ok()).toBeTruthy();
    const loginJson = await loginResponse.json();

    const feedbackResponse = await page.request.post(`${apiBaseURL}/api/v1/users/me/feedback`, {
      headers: { Authorization: `Bearer ${loginJson.data.access_token}` },
      data: {
        category: '数据异常',
        content: 'E2E 提交儿童信息处理反馈，请客服协助核验。',
        contact: '13800000000',
        topic: 'account-delete',
      },
    });
    expect(feedbackResponse.ok()).toBeTruthy();
    const feedbackJson = await feedbackResponse.json();
    const ticketNo = feedbackJson.data.ticket_no as string;

    await loginAdmin(page);
    await page.getByRole('link', { name: '客服反馈', exact: true }).click();

    await expect(page.getByRole('heading', { name: '客服反馈' })).toBeVisible();
    const ticketRow = page.getByRole('row', { name: new RegExp(ticketNo) });
    await expect(ticketRow).toContainText('儿童安全');
    await expect(ticketRow).toContainText('待处理');
    await ticketRow.getByRole('button', { name: '受理' }).click();
    await confirmAdminAction(page, '自动化验证客服反馈受理');
    await expect(ticketRow).toContainText('处理中');
    await expectNoEnglishSeedCopy(page);
  });

  test('processes archive handoff requests from the admin queue', async ({ page }) => {
    const loginResponse = await page.request.post(`${apiBaseURL}/api/v1/auth/login`, {
      data: { login_type: 'password', credential: 'xiaoman_parent', password: 'DemoUser123!' },
    });
    expect(loginResponse.ok()).toBeTruthy();
    const loginJson = await loginResponse.json();

    const exportResponse = await page.request.post(`${apiBaseURL}/api/v1/users/me/archive-export-requests`, {
      headers: { Authorization: `Bearer ${loginJson.data.access_token}` },
      data: {
        child_no: 'c_demo_xiaoman_001',
        export_type: 'all',
        purpose: 'adult_handoff',
        note: 'E2E 创建成年移交申请',
      },
    });
    expect(exportResponse.ok()).toBeTruthy();
    const exportJson = await exportResponse.json();
    const requestNo = exportJson.data.request_no as string;

    await loginAdmin(page);
    await page.getByRole('link', { name: '档案交付', exact: true }).click();

    await expect(page.getByRole('heading', { name: '档案交付申请' })).toBeVisible();
    const requestRow = page.getByRole('row', { name: new RegExp(requestNo) });
    await expect(requestRow).toContainText('成年移交');
    await expect(requestRow).toContainText('待处理');
    await requestRow.getByRole('button', { name: '受理' }).click();
    await confirmAdminAction(page, '自动化验证档案交付受理');
    await expect(requestRow).toContainText('处理中');
    await expectNoEnglishSeedCopy(page);
  });

  test('shows system operations readiness for config statistics and backup recovery', async ({ page }) => {
    await loginAdmin(page);
    await page.getByRole('link', { name: '系统运维', exact: true }).click();

    await expect(page.getByRole('heading', { name: '系统运维' })).toBeVisible();
    await expect(page.getByText('运行配置')).toBeVisible();
    await expect(page.getByText('备份恢复与告警值班')).toBeVisible();
    await expect(page.getByText('告警联系人', { exact: true })).toBeVisible();
    await expect(page.getByText('运营动作')).toBeVisible();
    await expect(page.getByText('家庭与档案')).toBeVisible();
    await expect(page.getByText('成长资产')).toBeVisible();
    await expect(page.getByRole('row', { name: /对象存储/ })).toBeVisible();
    await expect(page.getByRole('row', { name: /备份保留周期/ })).toBeVisible();
    await expectNoEnglishSeedCopy(page);
  });

  test('media library exposes localized review actions', async ({ page }) => {
    await loginAdmin(page);
    await page.getByRole('link', { name: '媒体库', exact: true }).click();
    await page.getByRole('button', { name: '查询' }).click();

    const mediaRow = page.getByRole('row', { name: /第一次自己吃饭/ });
    await expect(mediaRow).toContainText('图片');
    await expect(mediaRow).toContainText('可用');
    await expect(mediaRow.getByRole('button', { name: '通过' })).toBeVisible();
    await expect(mediaRow.getByRole('button', { name: '异常' })).toBeVisible();
    await expect(mediaRow.getByRole('button', { name: '下架' })).toBeVisible();
    await expectNoEnglishSeedCopy(page);
  });

  test('admin inline action buttons update and restore seeded data', async ({ page }) => {
    await loginAdmin(page);

    await page.getByRole('link', { name: '账号管理', exact: true }).click();
    await page.getByRole('button', { name: '查询' }).click();
    let parentRow = page.getByRole('row', { name: /小满妈妈/ });
    await expect(parentRow).toContainText('正常');
    await parentRow.getByRole('button', { name: '冻结' }).click();
    await confirmAdminAction(page, '自动化验证冻结按钮');
    parentRow = page.getByRole('row', { name: /小满妈妈/ });
    await expect(parentRow).toContainText('已冻结');
    await parentRow.getByRole('button', { name: '解冻' }).click();
    await confirmAdminAction(page, '自动化验证解冻按钮');
    await expect(page.getByRole('row', { name: /小满妈妈/ })).toContainText('正常');

    await page.getByRole('link', { name: '成长记录', exact: true }).click();
    await page.getByRole('button', { name: '查询' }).click();
    let recordRow = page.getByRole('row', { name: /第一次自己吃饭/ });
    await expect(recordRow).toContainText('已发布');
    await recordRow.getByRole('button', { name: '下架' }).click();
    await confirmAdminAction(page, '自动化验证记录下架按钮');
    recordRow = page.getByRole('row', { name: /第一次自己吃饭/ });
    await expect(recordRow).toContainText('草稿');
    await recordRow.getByRole('button', { name: '恢复' }).click();
    await confirmAdminAction(page, '自动化验证记录恢复按钮');
    await expect(page.getByRole('row', { name: /第一次自己吃饭/ })).toContainText('已发布');

    await page.getByRole('link', { name: '媒体库', exact: true }).click();
    await page.getByRole('button', { name: '查询' }).click();
    let mediaRow = page.getByRole('row', { name: /第一次自己吃饭/ });
    await expect(mediaRow).toContainText('可用');
    await mediaRow.getByRole('button', { name: '异常' }).click();
    await confirmAdminAction(page, '自动化验证媒体异常按钮');
    mediaRow = page.getByRole('row', { name: /第一次自己吃饭/ });
    await expect(mediaRow).toContainText('异常');
    await mediaRow.getByRole('button', { name: '下架' }).click();
    await confirmAdminAction(page, '自动化验证媒体下架按钮');
    mediaRow = page.getByRole('row', { name: /第一次自己吃饭/ });
    await expect(mediaRow).toContainText('已下架');
    await mediaRow.getByRole('button', { name: '通过' }).click();
    await confirmAdminAction(page, '自动化验证媒体恢复可用按钮');
    await expect(page.getByRole('row', { name: /第一次自己吃饭/ })).toContainText('可用');
  });
});
