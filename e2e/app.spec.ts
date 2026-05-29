import { expect, test, type APIRequestContext } from '@playwright/test';

import { expectNoEnglishSeedCopy, expectNoUnfinishedCopy, loginWeb, webBaseURL } from './helpers';

const apiBaseURL = process.env.E2E_API_BASE_URL ?? `http://127.0.0.1:${process.env.E2E_API_PORT ?? 3001}/api/v1`;
const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64',
);

async function createRegistrationInviteCode(request: APIRequestContext) {
  const loginResponse = await request.post(`${apiBaseURL}/admin/auth/login`, {
    data: { username: 'admin', password: 'ChangeMe123!' },
  });
  expect(loginResponse.ok()).toBe(true);
  const loginBody = await loginResponse.json();
  const accessToken = loginBody.data.access_token as string;

  const inviteResponse = await request.post(`${apiBaseURL}/admin/invites`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: { expires_in_hours: 2 },
  });
  expect(inviteResponse.ok()).toBe(true);
  const inviteBody = await inviteResponse.json();
  return inviteBody.data.invite_code as string;
}

test.describe('App critical journeys', () => {
  test('anonymous login page stays quiet and tab pages reserve bottom navigation space', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const consoleErrors: string[] = [];
    const failedApiRequests: Array<{ status: number; url: string }> = [];

    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('response', (response) => {
      if (response.url().includes('/api/')) failedApiRequests.push({ status: response.status(), url: response.url() });
    });

    await page.goto(`${webBaseURL}/auth/login`);
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/);
    await expect(page.getByRole('button', { name: '进入年轮' })).toBeVisible();

    expect(consoleErrors).toEqual([]);
    expect(failedApiRequests.filter((request) => request.status >= 400)).toEqual([]);

    await page.getByPlaceholder('请输入账号').fill('xiaoman_parent');
    await page.getByPlaceholder('请输入密码').fill('DemoUser123!');
    await page.getByRole('checkbox', { name: '我已阅读并同意《用户协议》和《隐私政策》' }).check();
    await page.getByRole('button', { name: '进入年轮' }).click();
    await expect(page).toHaveURL(/\/home$/);

    for (const route of ['/home', '/family', '/profile']) {
      await page.goto(`${webBaseURL}${route}`);
      await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible();
      const layout = await page.evaluate(() => {
        const main = document.querySelector('.app-layout > main');
        const nav = document.querySelector('nav[aria-label="主导航"]');
        const mainRect = main?.getBoundingClientRect();
        const navRect = nav?.getBoundingClientRect();

        return {
          mainBottom: mainRect?.bottom ?? 0,
          navTop: navRect?.top ?? 0,
          navHeight: navRect?.height ?? 0,
          mainOverflowY: main ? getComputedStyle(main).overflowY : '',
          overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
        };
      });

      expect(layout.overflowX).toBe(false);
      expect(layout.mainOverflowY).toBe('auto');
      expect(layout.navHeight).toBeGreaterThanOrEqual(74);
      expect(layout.mainBottom).toBeLessThanOrEqual(layout.navTop + 1);
    }

    await context.close();
  });

  test('logs in with password and renders localized home data', async ({ page }) => {
    await page.goto(`${webBaseURL}/auth/login`);
    await expect(page.getByRole('button', { name: '进入年轮' })).toBeDisabled();

    await page.getByPlaceholder('请输入账号').fill('xiaoman_parent');
    await page.getByPlaceholder('请输入密码').fill('DemoUser123!');
    await page.getByRole('checkbox', { name: '我已阅读并同意《用户协议》和《隐私政策》' }).check();
    await page.getByRole('button', { name: '进入年轮' }).click();

    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByText('小满', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('今日值得记录')).toBeVisible();
    await expect(page.getByText('最近更新')).toBeVisible();
    await expect(page.getByText('一年前的今天')).toBeVisible();
    await expectNoEnglishSeedCopy(page);
    await expectNoUnfinishedCopy(page);
  });

  test('preserves auth form input after viewing legal policy in browser', async ({ page }) => {
    await page.goto(`${webBaseURL}/auth/login`);
    await page.getByPlaceholder('请输入账号').fill('legal_return_parent');
    await page.getByPlaceholder('请输入密码').fill('DemoUser123!');
    await page.getByRole('checkbox', { name: '我已阅读并同意《用户协议》和《隐私政策》' }).check();

    await page.getByRole('button', { name: '查看完整协议与隐私政策' }).click();
    await expect(page).toHaveURL(/\/legal$/);
    await expect(page.getByRole('heading', { name: '关于与协议' })).toBeVisible();
    await page.getByLabel('返回').click();

    await expect(page).toHaveURL(/\/auth\/login$/);
    await expect(page.getByPlaceholder('请输入账号')).toHaveValue('legal_return_parent');
    await expect(page.getByPlaceholder('请输入密码')).toHaveValue('DemoUser123!');
    await expect(page.getByRole('checkbox', { name: '我已阅读并同意《用户协议》和《隐私政策》' })).toBeChecked();
    const storedDraft = await page.evaluate(() => window.sessionStorage.getItem('nianlun.auth.loginFormDraft.v1') ?? '');
    expect(storedDraft).not.toContain('DemoUser123!');
  });

  test('deleted account cannot log in again and shows password error', async ({ page, request }) => {
    const inviteCode = await createRegistrationInviteCode(request);
    const credential = `delete_accept_${Date.now().toString(36)}`;
    const password = 'DeleteUser123!';

    await page.goto(`${webBaseURL}/auth/login`);
    await page.getByRole('button', { name: '注册' }).click();
    await page.getByPlaceholder('请输入账号').fill(credential);
    await page.getByPlaceholder('请输入密码').fill(password);
    await page.getByPlaceholder('请再次输入密码').fill(password);
    await page.getByPlaceholder('请输入邀请码').fill(inviteCode);
    await page.getByRole('checkbox', { name: '我已阅读并同意《用户协议》和《隐私政策》' }).check();
    await page.getByRole('button', { name: '注册并进入' }).click();

    await expect(page).toHaveURL(/\/onboarding\/child$/);
    await page.getByLabel('宝宝小名').fill('注销验收宝宝');
    await page.getByLabel('出生日期').fill('2025-01-01');
    await page.getByRole('button', { name: '完成创建' }).click();
    await expect(page).toHaveURL(/\/home$/);

    await page.goto(`${webBaseURL}/profile/account-delete`);
    await expect(page.getByText('当前账号可以注销')).toBeVisible();
    await page.getByPlaceholder('请输入当前登录密码').fill(password);
    await page.getByPlaceholder('确认注销').fill('确认注销');
    await page.getByRole('button', { name: '确认注销账号' }).click();

    await expect(page).toHaveURL(/\/auth\/login$/);
    await page.getByPlaceholder('请输入账号').fill(credential);
    await page.getByPlaceholder('请输入密码').fill(password);
    await page.getByRole('checkbox', { name: '我已阅读并同意《用户协议》和《隐私政策》' }).check();
    await page.getByRole('button', { name: '进入年轮' }).click();
    await expect(page.getByText('账号或密码错误')).toBeVisible();
  });

  test('record creation exposes native-style media, location, and milestone controls', async ({ page }) => {
    await loginWeb(page);
    await page.getByRole('link', { name: '记录' }).click();

    await expect(page).toHaveURL(/\/record\/create$/);
    await expect(page.getByRole('heading', { name: '记录时光' })).toBeVisible();
    await expect(page.getByText('影像与声音')).toBeVisible();
    await expect(page.getByText('媒体采集')).toHaveCount(0);
    await expect(page.getByText('内容输入')).toHaveCount(0);
    await expect(page.getByText('补充信息')).toBeVisible();
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

  test('native capture buttons open the system file chooser instead of an in-page capture dialog', async ({ page }) => {
    await loginWeb(page);

    await page.goto(`${webBaseURL}/record/create?type=mixed&focus=media`);
    await expect(page.locator('input[aria-label="拍照记录"]')).toHaveAttribute('capture', 'environment');
    await expect(page.locator('input[aria-label="从相册添加"]')).toHaveAttribute('multiple', '');
    const photoChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: '拍照记录' }).click();
    const photoChooser = await photoChooserPromise;
    await photoChooser.setFiles({ name: 'camera-photo.JPG', mimeType: 'application/octet-stream', buffer: tinyPng });
    await expect(page.getByText('已选择 1 个媒体，将随记录一起保存。')).toBeVisible();
    await expect(page.getByRole('dialog', { name: '手机采集' })).toHaveCount(0);

    await page.goto(`${webBaseURL}/record/create?type=video&focus=media`);
    await expect(page.locator('input[aria-label="拍摄视频"]')).toHaveAttribute('capture', 'environment');
    const videoChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: '拍摄视频' }).click();
    const videoChooser = await videoChooserPromise;
    await videoChooser.setFiles({ name: 'camera-video.mp4', mimeType: 'video/mp4', buffer: Buffer.from([0, 0, 0, 0]) });
    await expect(page.getByText('已选择 1 个媒体，将随记录一起保存。')).toBeVisible();
    await expect(page.getByRole('dialog', { name: '手机采集' })).toHaveCount(0);

    await page.goto(`${webBaseURL}/record/create?type=audio&focus=media`);
    await expect(page.locator('input[aria-label="录制语音"]')).toHaveAttribute('capture', '');
    const audioChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: '录制语音' }).click();
    const audioChooser = await audioChooserPromise;
    await audioChooser.setFiles({ name: 'voice.wav', mimeType: 'audio/wav', buffer: Buffer.from([82, 73, 70, 70]) });
    await expect(page.getByText('已选择 1 个媒体，将随记录一起保存。')).toBeVisible();
    await expect(page.getByRole('dialog', { name: '手机采集' })).toHaveCount(0);
  });

  test('profile avatar upload stores a stable media reference when mobile picker returns generic MIME', async ({ page }) => {
    let updateMePayload: { avatar_url?: string } | null = null;
    page.on('request', (request) => {
      if (request.method() === 'PATCH' && request.url().includes('/api/v1/users/me')) {
        updateMePayload = request.postDataJSON() as { avatar_url?: string };
      }
    });

    await loginWeb(page);
    await page.goto(`${webBaseURL}/profile/account`);
    await page.locator('input[type="file"]').setInputFiles({
      name: 'avatar.JPG',
      mimeType: 'application/octet-stream',
      buffer: tinyPng,
    });

    await expect(page.getByText('头像已更新')).toBeVisible();
    expect(updateMePayload?.avatar_url).toMatch(/^media:m_/);
    await expect(page.getByRole('img', { name: '小满妈妈' })).toBeVisible();
  });

  test('record floating publish actions stay inside the app frame', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginWeb(page);
    await page.goto(`${webBaseURL}/record/create`);
    await page.evaluate(() => {
      document.documentElement.scrollTop = document.documentElement.scrollHeight;
    });

    await expect(page.locator('.record-floating-actions')).toBeVisible();
    const layout = await page.evaluate(() => {
      const actions = document.querySelector('.record-floating-actions')?.getBoundingClientRect();
      const parent = document.querySelector('.record-floating-actions')?.parentElement?.getBoundingClientRect();
      return {
        actionsLeft: actions?.left ?? 0,
        actionsRight: actions?.right ?? 0,
        parentLeft: parent?.left ?? 0,
        parentRight: parent?.right ?? 0,
      };
    });

    expect(layout.actionsLeft).toBeGreaterThanOrEqual(layout.parentLeft - 1);
    expect(layout.actionsRight).toBeLessThanOrEqual(layout.parentRight + 1);
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

    await page.getByPlaceholder('给这一刻起个名字').fill('文字记录校验');
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
    await expect(page.getByRole('heading', { name: '标签结果' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '地点结果' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '匹配记录' })).toBeVisible();
    const tagResults = page.getByRole('heading', { name: '标签结果' }).locator('..');
    const locationResults = page.getByRole('heading', { name: '地点结果' }).locator('..');
    await expect(tagResults.getByRole('button', { name: '#语言' })).toBeVisible();
    await expect(locationResults.getByRole('button', { name: /客厅/ })).toBeVisible();
    await page.getByRole('button', { name: '搜索' }).click();
    await expect(page.getByRole('button', { name: '谢谢', exact: true })).toBeVisible();
    await tagResults.getByRole('button', { name: '#语言' }).click();
    await expect(page.getByLabel('搜索关键词')).toHaveValue('语言');
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
    await expect(page.getByText('当前档案：小满')).toBeVisible();
    await expect(page.getByText('ID: 00000001')).toHaveCount(0);

    await expect(page.getByText('月报与纪念册')).toBeVisible();
    await expect(page.getByText('导出与备份')).toBeVisible();
    await expect(page.getByText('会员中心')).toBeVisible();
    await expect(page.getByText('家庭管理')).toBeVisible();
    await expect(page.getByText('帮助与反馈')).toBeVisible();
    await expect(page.getByText('隐私设置')).toBeVisible();
    await expect(page.getByText('账号与安全')).toBeVisible();
    await expect(page.getByText('关于我们')).toBeVisible();
    await expectNoUnfinishedCopy(page);

    await page.getByRole('button', { name: /关于我们/ }).click();
    await expect(page).toHaveURL(/\/profile\/about$/);
    await expect(page.getByRole('heading', { name: 'nianlun' })).toBeVisible();
    await expect(page.getByText('版本 1.0.0（构建 20260514）')).toBeVisible();
    await expect(page.getByRole('button', { name: /服务说明/ })).toBeVisible();
    await page.getByRole('button', { name: /服务说明/ }).click();
    await expect(page.getByText('当前版本已覆盖成长记录、家庭协作、时间轴回看、档案导出和运营后台管理。')).toBeVisible();
    await expect(page.getByText(/孩子的人生档案馆|官网信息将随服务发布节奏同步更新/)).toHaveCount(0);

    await page.goto(`${webBaseURL}/profile`);
    await page.getByRole('button', { name: /月报与纪念册/ }).click();
    await expect(page).toHaveURL(/\/profile\/reports$/);
    await expect(page.getByRole('heading', { name: '月报与纪念册' })).toBeVisible();
    await expect(page.getByText('AI 月报摘要')).toBeVisible();
    await expectNoEnglishSeedCopy(page);

    await page.goto(`${webBaseURL}/profile/export`);
    await expect(page.getByRole('heading', { name: '导出与备份' })).toBeVisible();
    await expect(page.getByRole('button', { name: '下载审计留痕摘要' })).toBeVisible();
    await expect(page.getByText('选择导出内容')).toBeVisible();
    await expect(page.getByText('长期交付留痕')).toBeVisible();
    await expect(page.getByText('当前账号为家庭管理员，可发起正式导出与交付申请。')).toBeVisible();
    await expect(page.getByRole('button', { name: '提交打包申请' })).toBeEnabled();
    await expect(page.getByRole('button', { name: '成年移交准备' })).toBeEnabled();
    await page.getByRole('button', { name: '提交打包申请' }).click();
    await expect(page.getByText(/档案打包申请已提交/)).toBeVisible();
    await expect(page.getByText(/当前快照：\d+ 条记录、\d+ 个媒体、\d+ 个里程碑。/)).toBeVisible();
    await expect(page.getByText('最近申请')).toBeVisible();
    await expect(page.getByText('档案打包 · 全部数据').first()).toBeVisible();
    await expect(page.getByText('待处理').first()).toBeVisible();

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

  test('limits archive export actions to the family administrator', async ({ page }) => {
    await page.goto(`${webBaseURL}/auth/login`);
    await page.getByPlaceholder('请输入账号').fill('xiaoman_viewer');
    await page.getByPlaceholder('请输入密码').fill('DemoUser123!');
    await page.getByRole('checkbox', { name: '我已阅读并同意《用户协议》和《隐私政策》' }).check();
    await page.getByRole('button', { name: '进入年轮' }).click();
    await expect(page).toHaveURL(/\/home$/);

    await page.goto(`${webBaseURL}/profile/export`);
    await expect(page.getByText('为保护家庭档案，首版仅家庭管理员可导出或发起交付申请。')).toBeVisible();
    await expect(page.getByRole('button', { name: '提交打包申请' })).toBeDisabled();
    await expect(page.getByRole('button', { name: '成年移交准备' })).toBeDisabled();
    await expect(page.getByRole('button', { name: '下载审计留痕摘要' })).toBeDisabled();
  });
});
