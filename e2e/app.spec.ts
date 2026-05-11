import { expect, test } from '@playwright/test';

import { expectNoEnglishSeedCopy, expectNoUnfinishedCopy, loginWeb, webBaseURL } from './helpers';

test.describe('App critical journeys', () => {
  test('logs in with password and renders localized home data', async ({ page }) => {
    await page.goto(`${webBaseURL}/auth/login`);
    await expect(page.getByRole('button', { name: '进入年轮' })).toBeDisabled();

    await page.getByPlaceholder('请输入账号').fill('xiaoman_parent');
    await page.getByPlaceholder('请输入密码').fill('DemoUser123!');
    await page.getByRole('checkbox', { name: '我已阅读并同意《用户协议》和《隐私政策》' }).check();
    await page.getByRole('button', { name: '进入年轮' }).click();

    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByText('小满', { exact: true })).toBeVisible();
    await expect(page.getByText('学会说谢谢').first()).toBeVisible();
    await expect(page.getByText('第一次自己吃饭').first()).toBeVisible();
    await expectNoEnglishSeedCopy(page);
    await expectNoUnfinishedCopy(page);
  });

  test('record creation page matches current media capability', async ({ page }) => {
    await loginWeb(page);
    await page.getByRole('link', { name: '记录' }).click();

    await expect(page).toHaveURL(/\/record\/create$/);
    await expect(page.getByText('记录时光')).toBeVisible();
    await expect(page.getByText('添加照片')).toBeVisible();
    await expect(page.getByText('支持 JPG、PNG、WebP 照片')).toBeVisible();
    await expect(page.getByPlaceholder('给这一刻起个名字')).toBeVisible();
    await expect(page.getByText(/语音|待接入|准备中|规划中/)).toHaveCount(0);
  });

  test('uploads a mock image and publishes a localized record', async ({ page }) => {
    await loginWeb(page);
    await page.getByRole('link', { name: '记录' }).click();

    await page.locator('input[type="file"]').setInputFiles({
      name: '成长照片.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
        'base64',
      ),
    });
    await expect(page.getByText('已选择 1 个媒体，将随记录一起保存。')).toBeVisible();

    await page.getByPlaceholder('给这一刻起个名字').fill('自动化上传记录');
    await page.getByPlaceholder('在想什么呢？记录一下这一刻发生的故事…').fill('这是一条包含照片上传的自动化记录，用来验证本地 mock 存储闭环。');
    await page.getByRole('button', { name: '发布' }).click();

    await expect(page).toHaveURL(/\/record\/r_/);
    await expect(page.getByRole('heading', { name: '记录详情' })).toBeVisible();
    await expect(page.getByText('媒体数量：1')).toBeVisible();
    await expect(page.getByText('自动化上传记录')).toBeVisible();
    await expectNoUnfinishedCopy(page);
  });

  test('profile hub pages are navigable and localized', async ({ page }) => {
    await loginWeb(page);
    await page.getByRole('link', { name: '我的' }).click();

    await expect(page.getByText('月报与纪念册')).toBeVisible();
    await expect(page.getByText('帮助与反馈')).toBeVisible();
    await expect(page.getByText('隐私设置')).toBeVisible();
    await expect(page.getByText('关于与协议')).toBeVisible();
    await expectNoUnfinishedCopy(page);

    await page.getByRole('button', { name: /月报与纪念册/ }).click();
    await expect(page).toHaveURL(/\/profile\/reports$/);
    await expect(page.getByRole('heading', { name: '月报与纪念册' })).toBeVisible();
    await expect(page.getByText('本月回顾')).toBeVisible();
    await expectNoEnglishSeedCopy(page);

    await page.goto(`${webBaseURL}/profile/help`);
    await expect(page.getByRole('heading', { name: '帮助与反馈' })).toBeVisible();
    await page.getByRole('button', { name: '保存反馈' }).click();
    await expect(page.getByText('请至少输入 6 个字，方便定位问题。')).toBeVisible();
    await page.getByPlaceholder('请描述遇到的问题、页面位置和操作步骤').fill('页面显示没有问题，记录一条自动化反馈。');
    await page.getByRole('button', { name: '保存反馈' }).click();
    await expect(page.getByText('反馈已保存在本机，感谢补充信息。')).toBeVisible();

    await page.goto(`${webBaseURL}/profile/settings`);
    await expect(page.getByRole('heading', { name: '隐私设置' })).toBeVisible();
    await page.getByRole('button', { name: '隐藏手机号' }).click();
    await expect(page.getByText('设置已保存')).toBeVisible();

    await page.goto(`${webBaseURL}/profile/legal`);
    await expect(page.getByRole('heading', { name: '关于与协议' })).toBeVisible();
    await expect(page.getByText('儿童信息保护摘要')).toBeVisible();
    await expectNoUnfinishedCopy(page);
  });

  test('family invite flow uses registration invite code only', async ({ page }) => {
    await loginWeb(page);
    await page.getByRole('link', { name: '家庭' }).click();
    await page.getByRole('link', { name: '邀请成员' }).click();

    await expect(page.getByRole('heading', { name: '邀请家庭成员' })).toBeVisible();
    await expect(page.getByText('创建邀请码后，被邀请人可用它注册账号并加入家庭。')).toBeVisible();

    await page.getByRole('button', { name: '生成邀请码' }).click();

    await expect(page.getByText('邀请码已生成', { exact: true })).toBeVisible();
    await expect(page.getByText('对方在注册页填写后会自动加入家庭')).toBeVisible();
    await expect(page.getByRole('button', { name: '复制邀请码' })).toBeVisible();
    await expect(page.getByText(/接受邀请|邀请链接|打开接受邀请页/)).toHaveCount(0);
  });
});
