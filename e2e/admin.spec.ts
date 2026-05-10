import { expect, test } from '@playwright/test';

import { adminBaseURL, expectNoEnglishSeedCopy, loginAdmin } from './helpers';

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
    await expect(page.getByText('用户数')).toBeVisible();
    await expect(page.getByText('孩子数')).toBeVisible();
    await expect(page.getByText('记录数')).toBeVisible();
    await expect(page.getByText('媒体数')).toBeVisible();
    await expectNoEnglishSeedCopy(page);
  });

  test('queries users and opens detail drawer', async ({ page }) => {
    await loginAdmin(page);
    await page.getByRole('link', { name: '用户运营', exact: true }).click();
    await page.getByRole('button', { name: '查询' }).click();

    const parentRow = page.getByRole('row', { name: /小满妈妈/ });
    await expect(parentRow).toContainText('基础会员');
    await expect(parentRow).toContainText('正常');
    await parentRow.getByRole('button', { name: '详情' }).click();

    await expect(page.getByRole('dialog', { name: '用户详情' })).toBeVisible();
    await expect(page.getByText('基础资料')).toBeVisible();
    await expect(page.getByText('关联孩子')).toBeVisible();
    await expectNoEnglishSeedCopy(page);
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

  test('media library exposes localized review actions', async ({ page }) => {
    await loginAdmin(page);
    await page.getByRole('link', { name: '媒体库', exact: true }).click();
    await page.getByRole('button', { name: '查询' }).click();

    const mediaRow = page.getByRole('row', { name: /m_demo_001/ });
    await expect(mediaRow).toContainText('图片');
    await expect(mediaRow).toContainText('可用');
    await expect(mediaRow.getByRole('button', { name: '通过' })).toBeVisible();
    await expect(mediaRow.getByRole('button', { name: '异常' })).toBeVisible();
    await expect(mediaRow.getByRole('button', { name: '下架' })).toBeVisible();
    await expectNoEnglishSeedCopy(page);
  });
});
