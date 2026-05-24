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
    await expect(page.getByText('一年前的今天')).toBeVisible();
    await expectNoEnglishSeedCopy(page);
    await expectNoUnfinishedCopy(page);
  });

  test('record creation exposes native-style media, location, and milestone controls', async ({ page }) => {
    await loginWeb(page);
    await page.getByRole('link', { name: '记录' }).click();

    await expect(page).toHaveURL(/\/record\/create$/);
    await expect(page.getByRole('heading', { name: '记录时光' })).toBeVisible();
    await expect(page.getByText('影像与声音')).toBeVisible();
    await expect(page.getByRole('button', { name: '拍照记录' })).toBeVisible();
    await expect(page.getByRole('button', { name: '拍摄视频' })).toBeVisible();
    await expect(page.getByRole('button', { name: '从相册添加' })).toBeVisible();
    await expect(page.getByRole('button', { name: '录制语音' })).toBeVisible();
    await expect(page.getByRole('button', { name: '上传语音' })).toBeVisible();
    await expect(page.getByRole('button', { name: '手机定位' })).toBeVisible();
    await expect(page.getByRole('button', { name: '切换里程碑记录' })).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByPlaceholder('给这一刻起个名字')).toBeVisible();
    await expect(page.getByLabel('发生时间 *')).toBeVisible();
    await expect(page.getByText(/待接入|准备中|规划中/)).toHaveCount(0);
  });

  test('home quick actions open matching record modes', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await loginWeb(page);

    await page.getByRole('button', { name: '拍照记录' }).click();
    await expect(page).toHaveURL(/\/record\/create\?type=mixed&focus=media$/);
    await expect(page.getByRole('button', { name: '拍照记录' })).toBeVisible();
    await expect(page.getByRole('button', { name: '拍摄视频' })).toBeVisible();
    await expect(page.getByRole('button', { name: '从相册添加' })).toBeVisible();

    await page.goto(`${webBaseURL}/home`);
    await page.getByRole('button', { name: '视频记录' }).click();
    await expect(page).toHaveURL(/\/record\/create\?type=video&focus=media$/);
    await expect(page.getByText('视频采集')).toBeVisible();
    await expect(page.getByRole('button', { name: '拍摄视频' })).toBeVisible();
    await expect(page.getByRole('button', { name: '从相册选择' })).toBeVisible();
    await expect(page.getByRole('button', { name: '拍照记录' })).toHaveCount(0);

    await page.goto(`${webBaseURL}/record/create?type=audio&focus=media`);
    await expect(page.getByText('语音采集')).toBeVisible();
    await expect(page.getByRole('button', { name: '录制语音' })).toBeVisible();
    await expect(page.getByRole('button', { name: '上传语音' })).toBeVisible();
    await expect(page.getByText('图片 / 视频')).toHaveCount(0);
    expect(consoleErrors.join('\n')).not.toContain('style property during rerender');

    await page.goto(`${webBaseURL}/home`);
    await page.getByRole('button', { name: '写一句话' }).click();
    await expect(page).toHaveURL(/\/record\/create\?type=text&focus=content$/);
    await expect(page.getByText('影像与声音')).toHaveCount(0);

    await page.goto(`${webBaseURL}/home`);
    await page.getByRole('button', { name: '里程碑' }).click();
    await expect(page).toHaveURL(/\/record\/create\?type=milestone&focus=content$/);
    await expect(page.getByRole('button', { name: '切换里程碑记录' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('published records require key fields and text mode hides upload', async ({ page }) => {
    await loginWeb(page);
    await page.goto(`${webBaseURL}/record/create?type=text&focus=content`);

    await expect(page.getByText('影像与声音')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '拍照记录' })).toHaveCount(0);
    await expect(page.getByLabel('发生时间 *')).not.toHaveValue('');

    await page.getByRole('button', { name: '发布', exact: true }).click();
    await expect(page.getByText('发布前请填写标题')).toBeVisible();

    await page.getByPlaceholder('给这一刻起个名字').fill('文字记录自动化校验');
    await page.getByRole('button', { name: '发布', exact: true }).click();
    await expect(page.getByText('发布前请填写正文')).toBeVisible();

    await page.getByPlaceholder('在想什么呢？记录一下这一刻发生的故事…').fill('这是一条纯文字记录，用来验证发布必填和隐藏上传区。');
    await page.locator('input[type="datetime-local"]').fill('');
    await page.getByRole('button', { name: '发布', exact: true }).click();
    await expect(page.getByText('发布前请选择发生时间')).toBeVisible();
  });

  test('phone location fills the location field with a visible response', async ({ page, context }) => {
    await context.grantPermissions(['geolocation'], { origin: webBaseURL });
    await context.setGeolocation({ latitude: 31.2304, longitude: 121.4737 });

    await loginWeb(page);
    await page.goto(`${webBaseURL}/record/create`);
    await page.getByRole('button', { name: '手机定位' }).click();

    const locationInput = page.getByLabel('搜索地点');
    await expect(locationInput).not.toHaveValue('');
    await expect(page.getByText(/已读取手机定位|已优先填入/)).toBeVisible();
  });

  test('uploads an image and publishes a localized record', async ({ page }) => {
    const recordTitle = `午后成长照片-${Date.now().toString().slice(-4)}`;
    await loginWeb(page);
    await page.getByRole('link', { name: '记录' }).click();

    await page.locator('input[aria-label="从相册添加"]').setInputFiles({
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
    await page.getByRole('button', { name: '发布', exact: true }).click();

    await expect(page).toHaveURL(/\/record\/r_/);
    await expect(page.getByRole('heading', { name: '记录详情' })).toBeVisible();
    await expect(page.getByText('媒体数量：1')).toBeVisible();
    await expect(page.getByText(recordTitle)).toBeVisible();

    await page.getByRole('button', { name: '返回' }).click();
    await expect(page).toHaveURL(/\/home$/);
    await page.getByRole('link', { name: '时间轴' }).click();
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

  test('record detail exposes AI actions and opens edit without blanking', async ({ page }) => {
    await loginWeb(page);
    await page.goto(`${webBaseURL}/record/r_demo_001`);

    await expect(page.getByRole('heading', { name: '记录详情' })).toBeVisible();
    await expect(page.getByText('AI 智能提取')).toBeVisible();
    await expect(page.getByText('AI 状态：已完成')).toBeVisible();

    await page.getByRole('button', { name: '摘要' }).click();
    await expect(page.getByText(/AI 摘要(正在处理中|已生成并同步到记录详情)/)).toBeVisible();

    await page.getByRole('button', { name: '编辑记录' }).click();
    await expect(page).toHaveURL(/\/record\/r_demo_001\/edit$/);
    await expect(page.getByText('编辑记录')).toBeVisible();
    await expect(page.getByPlaceholder('给这一刻起个名字')).not.toHaveValue('');
    await expect(page.getByRole('button', { name: '存为草稿' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '保存' })).toBeVisible();
  });

  test('secondary App controls provide visible responses', async ({ page }) => {
    await loginWeb(page);

    await expect(page.getByText('小满最近最喜欢的一件玩具是什么？它有什么特别的故事吗？')).toBeVisible();
    await page.getByRole('button', { name: /换一条/ }).click();
    await expect(page.getByText('今天有没有一个小进步？比如独立完成一件事、学会一个词，或主动表达了感受。')).toBeVisible();

    await page.getByRole('button', { name: '搜索记录' }).click();
    await expect(page).toHaveURL(/\/search$/);
    await expect(page.getByRole('heading', { name: '搜索历史' })).toBeVisible();
    await page.getByLabel('搜索关键词').fill('谢谢');
    await expect(page.getByText('学会说谢谢').first()).toBeVisible();

    await page.goto(`${webBaseURL}/record/create`);
    await expect(page.getByLabel('发生时间 *')).toBeVisible();
    await expect(page.getByLabel('搜索地点')).toBeVisible();
    await page.getByLabel('搜索地点').fill('公园');
    await expect(page.getByRole('button', { name: '公园' })).toBeVisible();
    await page.getByRole('button', { name: '可见范围 家庭成员可见' }).click();
    await expect(page.getByText('当前记录默认仅对家庭成员可见')).toBeVisible();

    await page.getByRole('button', { name: '切换里程碑记录' }).click();
    await expect(page.getByRole('button', { name: '切换里程碑记录' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: '切换里程碑记录' }).click();
    await expect(page.getByRole('button', { name: '切换里程碑记录' })).toHaveAttribute('aria-pressed', 'false');

    await page.goto(`${webBaseURL}/profile`);
    await page.getByRole('button', { name: '+ 添加宝宝' }).click();
    await expect(page).toHaveURL(/\/onboarding\/child\?mode=add$/);
    await expect(page.getByRole('heading', { name: '添加宝宝档案' })).toBeVisible();

    await page.goto(`${webBaseURL}/family`);
    await page.getByRole('button', { name: /小满妈妈/ }).click();
    await expect(page).toHaveURL(/\/family\/members\/.+$/);
    await expect(page.getByRole('heading', { name: '家人资料' })).toBeVisible();
  });

  test('profile hub pages are navigable and localized', async ({ page }) => {
    await loginWeb(page);
    await page.getByRole('link', { name: '我的' }).click();
    await expect(page.getByText(/u_demo_parent_001|用户编号/)).toHaveCount(0);

    await expect(page.getByText('月报与纪念册')).toBeVisible();
    await expect(page.getByText('导出与备份')).toBeVisible();
    await expect(page.getByText('会员中心')).toBeVisible();
    await expect(page.getByText('家庭管理')).toBeVisible();
    await expect(page.getByText('帮助与反馈')).toBeVisible();
    await expect(page.getByText('隐私设置')).toBeVisible();
    await expect(page.getByText('账号与安全')).toBeVisible();
    await expect(page.getByText('关于我们')).toBeVisible();
    await expectNoUnfinishedCopy(page);

    await page.getByRole('button', { name: /月报与纪念册/ }).click();
    await expect(page).toHaveURL(/\/profile\/reports$/);
    await expect(page.getByRole('heading', { name: '月报与纪念册' })).toBeVisible();
    await expect(page.getByText('AI 月报摘要')).toBeVisible();
    await expectNoEnglishSeedCopy(page);

    await page.goto(`${webBaseURL}/profile/export`);
    await expect(page.getByRole('heading', { name: '导出与备份' })).toBeVisible();
    await expect(page.getByRole('button', { name: '开始打包导出' })).toBeVisible();
    await expect(page.getByText('选择导出内容')).toBeVisible();

    await page.goto(`${webBaseURL}/profile/membership`);
    await expect(page.getByRole('heading', { name: '会员中心' })).toBeVisible();
    await expect(page.getByText('您的专属特权')).toBeVisible();

    await page.goto(`${webBaseURL}/profile/security`);
    await expect(page.getByRole('heading', { name: '账号与安全' })).toBeVisible();
    await expect(page.getByText('登录密码')).toBeVisible();
    await expect(page.getByText('第三方账号绑定')).toBeVisible();
    await expect(page.getByText('已绑定微信')).toBeVisible();
    await expect(page.getByRole('button', { name: '注销账号' })).toBeVisible();
    await page.getByRole('button', { name: '注销账号' }).click();
    await expect(page).toHaveURL(/\/profile\/account-delete$/);
  });
});
