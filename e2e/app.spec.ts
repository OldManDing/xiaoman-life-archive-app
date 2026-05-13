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
    await expect(page.getByText('今日值得记录')).toBeVisible();
    await expect(page.getByText('最近更新')).toBeVisible();
    await expect(page.getByRole('heading', { name: '家庭动态' })).toBeVisible();
    await expectNoEnglishSeedCopy(page);
    await expectNoUnfinishedCopy(page);
  });

  test('record creation page matches current media capability', async ({ page }) => {
    await loginWeb(page);
    await page.getByRole('link', { name: '记录' }).click();

    await expect(page).toHaveURL(/\/record\/create$/);
    await expect(page.getByText('记录时光')).toBeVisible();
    await expect(page.getByText('MEDIA')).toBeVisible();
    await expect(page.getByText('添加照片/视频')).toBeVisible();
    await expect(page.getByText('录制语音')).toBeVisible();
    await expect(page.getByPlaceholder('给这一刻起个名字')).toBeVisible();
    await expect(page.getByLabel('发生时间 *')).toBeVisible();
    await expect(page.getByText(/待接入|准备中|规划中/)).toHaveCount(0);
  });

  test('published records require key fields and text mode hides upload', async ({ page }) => {
    await loginWeb(page);
    await page.goto(`${webBaseURL}/record/create?type=text&focus=content`);

    await expect(page.getByRole('combobox', { name: '记录类型' })).toContainText('文字记录');
    await expect(page.getByText('添加照片')).toHaveCount(0);

    await page.getByRole('button', { name: '发布' }).click();
    await expect(page.getByText('发布前请填写标题')).toBeVisible();

    await page.getByPlaceholder('给这一刻起个名字').fill('文字记录自动化校验');
    await page.getByRole('button', { name: '发布' }).click();
    await expect(page.getByText('发布前请填写正文')).toBeVisible();

    await page.getByPlaceholder('在想什么呢？记录一下这一刻发生的故事…').fill('这是一条纯文字记录，用来验证发布必填和隐藏上传区。');
    await page.getByRole('button', { name: '发布' }).click();
    await expect(page.getByText('发布前请选择发生时间')).toBeVisible();
  });

  test('uploads an image and publishes a localized record', async ({ page }) => {
    const recordTitle = `午后成长照片-${Date.now().toString().slice(-4)}`;
    await loginWeb(page);
    await page.getByRole('link', { name: '记录' }).click();

    await page.getByLabel('添加照片/视频').setInputFiles({
      name: '成长照片.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
        'base64',
      ),
    });
    await expect(page.getByText('已选择 1 个媒体，将随记录一起保存。')).toBeVisible();

    await page.getByPlaceholder('给这一刻起个名字').fill(recordTitle);
    await page.getByPlaceholder('在想什么呢？记录一下这一刻发生的故事…').fill('小满午后在公园里发现了一片会发光的叶子，想把这一刻留给以后的自己。');
    await page.locator('input[type="datetime-local"]').fill('2026-05-12T08:30');
    await page.getByRole('button', { name: '发布' }).click();

    await expect(page).toHaveURL(/\/record\/r_/);
    await expect(page.getByRole('heading', { name: '记录详情' })).toBeVisible();
    await expect(page.getByText('媒体数量：1')).toBeVisible();
    await expect(page.getByText(recordTitle)).toBeVisible();

    await page.getByRole('button', { name: '返回' }).click();
    await expect(page).toHaveURL(/\/home$/);
    await page.getByRole('link', { name: '时间轴' }).click();
    await expect(page).toHaveURL(/\/timeline$/);
    const uploadedTimelineCard = page.locator('article').filter({ hasText: recordTitle });
    await expect(uploadedTimelineCard).toBeVisible();
    await expect(uploadedTimelineCard.getByRole('img', { name: recordTitle })).toBeVisible();
    await page.reload();
    const reloadedTimelineCard = page.locator('article').filter({ hasText: recordTitle });
    await expect(reloadedTimelineCard).toBeVisible();
    await expect(reloadedTimelineCard.getByRole('img', { name: recordTitle })).toBeVisible();
    await expectNoUnfinishedCopy(page);

    await reloadedTimelineCard.getByRole('button', { name: /查看/ }).click();
    await expect(page.getByRole('heading', { name: '记录详情' })).toBeVisible();
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: '删除记录' }).click();
    await expect(page).toHaveURL(/\/timeline$/);
    await expect(page.locator('article').filter({ hasText: recordTitle })).toHaveCount(0);
  });

  test('secondary App controls provide visible responses', async ({ page }) => {
    await loginWeb(page);

    await expect(page.getByText('小满最近最喜欢的一件玩具是什么？它有什么特别的故事吗？')).toBeVisible();
    await page.getByRole('button', { name: /换一条/ }).click();
    await expect(page.getByText('今天有没有一个小进步？比如独立完成一件事、学会一个词，或主动表达了感受。')).toBeVisible();
    await page.getByRole('button', { name: '搜索记录' }).click();
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByLabel('首页搜索关键词')).toBeVisible();
    await page.getByLabel('首页搜索关键词').fill('谢谢');
    await expect(page.getByText('学会说谢谢').first()).toBeVisible();

    await page.getByRole('button', { name: '写一句话' }).click();
    await expect(page).toHaveURL(/\/record\/create\?type=text&focus=content$/);
    await expect(page.getByRole('combobox', { name: '记录类型' })).toContainText('文字记录');
    await expect(page.getByText('添加照片')).toHaveCount(0);

    await page.goto(`${webBaseURL}/record/create`);
    await expect(page.getByLabel('发生时间 *')).toBeVisible();
    await expect(page.getByLabel('搜索地点')).toBeVisible();
    await page.getByLabel('搜索地点').fill('公园');
    await expect(page.getByRole('button', { name: '公园' })).toBeVisible();
    await page.getByRole('button', { name: '可见范围 家庭成员可见' }).click();
    await expect(page.getByText('当前版本仅开放家庭内共享')).toBeVisible();
    await expect(page.getByText('与后台权限保持一致，家庭成员可查看这条记录。')).toBeVisible();
    await page.getByRole('combobox', { name: '记录类型' }).click();
    await page.getByRole('option', { name: '语音记录' }).click();
    await expect(page.getByText('录制/上传语音')).toBeVisible();
    await expect(page.getByText('添加照片/视频')).toHaveCount(0);
    await page.getByRole('combobox', { name: '选择标签' }).click();
    await page.getByRole('option', { name: '第一次' }).click();
    await expect(page.getByRole('button', { name: '#第一次' })).toBeVisible();
    await page.getByRole('button', { name: '#第一次' }).click();
    await expect(page.getByRole('button', { name: '#第一次' })).toHaveCount(0);

    await page.goto(`${webBaseURL}/timeline`);
    await page.getByRole('button', { name: '搜索记录' }).click();
    await expect(page.getByLabel('搜索关键词')).toBeVisible();
    await page.getByLabel('搜索关键词').fill('谢谢');
    await expect(page.getByText('学会说谢谢').first()).toBeVisible();
    await page.getByRole('button', { name: '筛选记录' }).click();
    await expect(page.getByText(/当前记录还没有可用标签|清除筛选|#/).first()).toBeVisible();

    await page.goto(`${webBaseURL}/profile`);
    await page.getByRole('button', { name: '+ 添加宝宝' }).click();
    await expect(page).toHaveURL(/\/onboarding\/child\?mode=add$/);
    await expect(page.getByRole('heading', { name: '添加宝宝档案' })).toBeVisible();

    await page.goto(`${webBaseURL}/family`);
    await page.getByRole('button', { name: /小满妈妈/ }).click();
    await expect(page).toHaveURL(/\/family\/members$/);
  });

  test('profile hub pages are navigable and localized', async ({ page }) => {
    await loginWeb(page);
    await page.getByRole('link', { name: '我的' }).click();

    await expect(page.getByText('月报与纪念册')).toBeVisible();
    await expect(page.getByText('导出与备份')).toBeVisible();
    await expect(page.getByText('会员中心')).toBeVisible();
    await expect(page.getByText('帮助与反馈')).toBeVisible();
    await expect(page.getByText('隐私设置')).toBeVisible();
    await expect(page.getByText('账号与安全')).toBeVisible();
    await expect(page.getByText('关于我们')).toBeVisible();
    await expectNoUnfinishedCopy(page);

    await page.getByRole('button', { name: /月报与纪念册/ }).click();
    await expect(page).toHaveURL(/\/profile\/reports$/);
    await expect(page.getByRole('heading', { name: '月报与纪念册' })).toBeVisible();
    await expect(page.getByText('本月回顾')).toBeVisible();
    await expectNoEnglishSeedCopy(page);

    await page.goto(`${webBaseURL}/profile/export`);
    await expect(page.getByRole('heading', { name: '导出与备份' })).toBeVisible();
    await expect(page.getByRole('button', { name: /复制摘要/ })).toBeVisible();
    await expect(page.getByText('导出预览')).toBeVisible();

    await page.goto(`${webBaseURL}/profile/membership`);
    await expect(page.getByRole('heading', { name: '会员中心' })).toBeVisible();
    await expect(page.getByText('已启用权益')).toBeVisible();

    await page.goto(`${webBaseURL}/profile/security`);
    await expect(page.getByRole('heading', { name: '账号与安全' })).toBeVisible();
    await expect(page.getByText('邀请码只在注册时填写')).toBeVisible();

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

    await page.goto(`${webBaseURL}/profile/about`);
    await expect(page.getByRole('heading', { name: '关于我们' })).toBeVisible();
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
