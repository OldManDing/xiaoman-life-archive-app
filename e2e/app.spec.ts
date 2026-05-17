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
    await expect(page.getByText('影像与声音')).toBeVisible();
    await expect(page.getByText('添加照片/视频')).toBeVisible();
    await expect(page.getByText('录制语音')).toBeVisible();
    await expect(page.getByPlaceholder('给这一刻起个名字')).toBeVisible();
    await expect(page.getByLabel('发生时间 *')).toBeVisible();
    await expect(page.getByText(/待接入|准备中|规划中/)).toHaveCount(0);
  });

  test('home quick action buttons open the matching record modes', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });

    await loginWeb(page);

    await page.getByRole('button', { name: '拍照记录' }).click();
    await expect(page).toHaveURL(/\/record\/create\?type=mixed&focus=media$/);
    await expect(page.getByText('添加照片/视频')).toBeVisible();

    await page.goto(`${webBaseURL}/home`);
    await page.getByRole('button', { name: '视频记录' }).click();
    await expect(page).toHaveURL(/\/record\/create\?type=video&focus=media$/);
    await expect(page.getByText('拍摄/上传视频')).toBeVisible();

    await page.goto(`${webBaseURL}/record/create?type=audio&focus=media`);
    await expect(page.getByText('录制/上传语音')).toBeVisible();
    await expect(page.getByText('添加照片/视频')).toHaveCount(0);
    expect(consoleErrors.join('\n')).not.toContain('style property during rerender');

    await page.goto(`${webBaseURL}/home`);
    await page.getByRole('button', { name: '写一句话' }).click();
    await expect(page).toHaveURL(/\/record\/create\?type=text&focus=content$/);
    await expect(page.getByText('影像与声音')).toHaveCount(0);
    await expect(page.getByText('添加照片')).toHaveCount(0);

    await page.goto(`${webBaseURL}/home`);
    await page.getByRole('button', { name: '里程碑' }).click();
    await expect(page).toHaveURL(/\/record\/create\?type=milestone&focus=content$/);
    await expect(page.getByRole('button', { name: '切换里程碑记录' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('published records require key fields and text mode hides upload', async ({ page }) => {
    await loginWeb(page);
    await page.goto(`${webBaseURL}/record/create?type=text&focus=content`);

    await expect(page.getByText('影像与声音')).toHaveCount(0);
    await expect(page.getByText('添加照片')).toHaveCount(0);
    await expect(page.getByLabel('发生时间 *')).not.toHaveValue('');

    await page.getByRole('button', { name: '发布' }).click();
    await expect(page.getByText('发布前请填写标题')).toBeVisible();

    await page.getByPlaceholder('给这一刻起个名字').fill('文字记录自动化校验');
    await page.getByRole('button', { name: '发布' }).click();
    await expect(page.getByText('发布前请填写正文')).toBeVisible();

    await page.getByPlaceholder('在想什么呢？记录一下这一刻发生的故事…').fill('这是一条纯文字记录，用来验证发布必填和隐藏上传区。');
    await page.locator('input[type="datetime-local"]').fill('');
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

  test('record detail exposes AI actions and refreshes generated output', async ({ page }) => {
    await loginWeb(page);
    await page.goto(`${webBaseURL}/record/r_demo_001`);

    await expect(page.getByRole('heading', { name: '记录详情' })).toBeVisible();
    await expect(page.getByText('AI 智能提取')).toBeVisible();
    await expect(page.getByText('AI 状态：已完成')).toBeVisible();

    await page.getByRole('button', { name: '摘要' }).click();
    await expect(page.getByText(/AI 摘要正在处理中|AI 摘要已生成并同步到记录详情/)).toBeVisible();
    await expect(page.getByText('AI 智能提取')).toBeVisible();
  });

  test('secondary App controls provide visible responses', async ({ page }) => {
    await loginWeb(page);

    await expect(page.getByText('小满最近最喜欢的一件玩具是什么？它有什么特别的故事吗？')).toBeVisible();
    await page.getByRole('button', { name: /换一条/ }).click();
    await expect(page.getByText('今天有没有一个小进步？比如独立完成一件事、学会一个词，或主动表达了感受。')).toBeVisible();
    await page.getByRole('button', { name: '搜索记录' }).click();
    await expect(page).toHaveURL(/\/search$/);
    await expect(page.getByRole('heading', { name: '搜索历史' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '热门标签' })).toBeVisible();
    await page.getByLabel('搜索关键词').fill('谢谢');
    await expect(page.getByText('学会说谢谢').first()).toBeVisible();
    await page.goto(`${webBaseURL}/home`);

    await page.getByRole('button', { name: '写一句话' }).click();
    await expect(page).toHaveURL(/\/record\/create\?type=text&focus=content$/);
    await expect(page.getByText('影像与声音')).toHaveCount(0);
    await expect(page.getByText('添加照片')).toHaveCount(0);

    await page.goto(`${webBaseURL}/record/create`);
    await expect(page.getByLabel('发生时间 *')).toBeVisible();
    await expect(page.getByLabel('搜索地点')).toBeVisible();
    await page.getByLabel('搜索地点').fill('公园');
    await expect(page.getByRole('button', { name: '公园' })).toBeVisible();
    await page.getByRole('button', { name: '可见范围 家庭成员可见' }).click();
    await expect(page.getByText('当前记录默认仅对家庭成员可见')).toBeVisible();
    await expect(page.getByText('与后台权限保持一致，家庭成员可查看这条记录。')).toBeVisible();

    await page.goto(`${webBaseURL}/record/create?type=audio&focus=media`);
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
    await expect(page.getByRole('button', { name: '下载摘要' })).toBeVisible();
    await expect(page.getByRole('button', { name: '复制摘要' })).toBeVisible();
    await expect(page.getByText('选择导出内容')).toBeVisible();

    await page.goto(`${webBaseURL}/profile/membership`);
    await expect(page.getByRole('heading', { name: '会员中心' })).toBeVisible();
    await expect(page.getByText('您的专属特权')).toBeVisible();

    await page.goto(`${webBaseURL}/profile/security`);
    await expect(page.getByRole('heading', { name: '账号与安全' })).toBeVisible();
    await expect(page.getByText('登录密码')).toBeVisible();
    await expect(page.getByRole('button', { name: '注销账号' })).toBeVisible();

    await page.goto(`${webBaseURL}/profile/help`);
    await expect(page.getByRole('heading', { name: '帮助与反馈' })).toBeVisible();
    await page.getByRole('button', { name: '保存反馈' }).click();
    await expect(page.getByText('请至少输入 6 个字，方便定位问题。')).toBeVisible();
    await page.getByPlaceholder('请描述遇到的问题、页面位置和操作步骤').fill('页面显示没有问题，记录一条自动化反馈。');
    await page.getByRole('button', { name: '保存反馈' }).click();
    await expect(page.getByText('反馈已保存在本机，感谢补充信息。')).toBeVisible();

    await page.goto(`${webBaseURL}/profile/settings`);
    await expect(page.getByRole('heading', { name: '隐私设置' })).toBeVisible();
    await page.getByRole('button', { name: '允许通过手机号搜索到我' }).click();
    await expect(page.getByText('设置已保存')).toBeVisible();

    await page.goto(`${webBaseURL}/profile/about`);
    await expect(page.getByRole('heading', { name: '关于我们' })).toBeVisible();
    await expect(page.getByText('孩子的人生档案馆')).toBeVisible();
    await expect(page.getByText('用户服务协议')).toBeVisible();
    await expectNoUnfinishedCopy(page);
  });

  test('family invite flow uses registration invite code only', async ({ page }) => {
    await loginWeb(page);
    await page.getByRole('link', { name: '家庭' }).click();
    await expect(page.getByText('全家一起记录')).toBeVisible();
    await expect(page.getByText('让不同家人的视角进入同一份档案')).toBeVisible();
    await page.getByRole('link', { name: '邀请成员' }).click();

    await expect(page.getByRole('heading', { name: '邀请家庭成员' })).toBeVisible();
    await expect(page.getByText('创建邀请码后，被邀请人可用它注册账号并加入家庭。')).toBeVisible();

    await page.getByRole('button', { name: '生成邀请码' }).click();

    await expect(page.getByText('邀请码已生成', { exact: true })).toBeVisible();
    await expect(page.getByText('对方在注册页填写后会自动加入家庭')).toBeVisible();
    await expect(page.getByRole('button', { name: '复制邀请码' })).toBeVisible();
    await expect(page.getByText(/接受邀请|邀请链接|打开接受邀请页/)).toHaveCount(0);
  });

  test('new invited member can register, add a child, and publish a first record', async ({ page }) => {
    await loginWeb(page);
    await page.goto(`${webBaseURL}/family/invite`);
    await page.getByRole('button', { name: '生成邀请码' }).click();
    await expect(page.getByText('邀请码已生成', { exact: true })).toBeVisible();
    const inviteCode = (await page.locator('strong').filter({ hasText: /^[A-Za-z0-9_-]{8,}$/ }).last().textContent())?.trim();
    expect(inviteCode).toBeTruthy();

    const unique = Date.now().toString().slice(-6);
    await page.goto(`${webBaseURL}/profile`);
    await page.getByRole('button', { name: '退出登录' }).click();
    await expect(page).toHaveURL(/\/auth\/login$/);
    await page.getByRole('button', { name: '注册' }).click();
    await page.getByPlaceholder('请输入账号').fill(`new_parent_${unique}`);
    await page.getByPlaceholder('请输入密码').fill('NewUser123!');
    await page.getByPlaceholder('请再次输入密码').fill('NewUser123!');
    await page.getByPlaceholder('请输入家庭邀请码').fill(inviteCode!);
    await page.getByRole('checkbox', { name: '我已阅读并同意《用户协议》和《隐私政策》' }).check();
    await page.getByRole('button', { name: '注册并进入' }).click();
    await expect(page).toHaveURL(/\/home$/);

    await page.goto(`${webBaseURL}/onboarding/child?mode=add`);
    await page.getByLabel('宝宝小名').fill(`新宝${unique}`);
    await page.getByLabel('生日').fill('2024-03-18');
    await page.getByRole('button', { name: '完成创建' }).click();
    await expect(page).toHaveURL(/\/family\/child$/);
    await page.goto(`${webBaseURL}/home`);
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole('button', { name: /切换孩子档案|查看孩子档案/ })).toContainText(`新宝${unique}`);

    await page.getByRole('button', { name: '写一句话' }).click();
    await page.getByPlaceholder('给这一刻起个名字').fill('第一条家庭记录');
    await page.getByPlaceholder('在想什么呢？记录一下这一刻发生的故事…').fill('今天完成建档，也邀请家人一起记录。');
    await page.getByRole('button', { name: '发布' }).click();
    await expect(page.getByRole('heading', { name: '记录详情' })).toBeVisible();
    await expect(page.getByText('第一条家庭记录')).toBeVisible();
  });
});
