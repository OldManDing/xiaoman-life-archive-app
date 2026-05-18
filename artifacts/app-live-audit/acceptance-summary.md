# App 与后台真实交互验收记录

验收时间：2026-05-18

## 本轮发现并已修复

| 范围 | 问题 | 修复结果 |
| --- | --- | --- |
| App 记录页 | `/record/create` 空表单时“发布”被禁用，用户无法触发“请填写标题/正文/时间”的明确反馈。 | 恢复发布按钮可点击，仅在提交中或上传中禁用；继续通过表单校验给出缺项提示。 |
| App 导航 | `/family/invite` 等二级页仍显示底部 Tab，和页面顶部“返回”操作冲突。 | 底部 Tab 仅在 `/home`、`/timeline`、`/family`、`/profile` 一级页显示。 |
| App 触控 | 记录页“取消”文字按钮实际宽度不足 44px。 | 文本返回按钮增加 `minWidth: 44px`，满足移动端触控尺寸。 |
| 后台总览 | 手机端指标卡单列堆叠过长，运营入口下沉明显。 | 手机端指标改为 2x2，压缩卡片高度与标题字号，减少总览滚动成本。 |
| 后台 E2E | 总览重做后测试仍断言旧文案“用户数/孩子数/记录数/媒体数”。 | 更新为新版运营指标说明断言。 |

## 浏览器验收截图

- `app-home-mobile-long.png`
- `app-record-create-mobile-long.png`
- `app-timeline-mobile-long.png`
- `app-family-mobile-long.png`
- `admin-dashboard-mobile-long.png`
- `admin-dashboard-desktop.png`

## 已通过验证

- `npm.cmd run typecheck:web`
- `npm.cmd run typecheck:admin`
- `npm.cmd run test:web`
- `npm.cmd run test:admin`
- `npm.cmd run test:e2e -- e2e/app.spec.ts e2e/admin.spec.ts`
- `npm.cmd run test:e2e -- e2e/visual.spec.ts`
- `npm.cmd run build:web`
- `npm.cmd run build:admin`

## 2026-05-19 线上收口

- 已发布后台静态包到 `nianlun.xmlga.top`，服务器 release：`/opt/xiaoman-life/admin/releases/20260519063500-admin-dashboard-mobile-qa`。
- 已验证 Nginx 配置通过并 reload，`https://nianlun.xmlga.top` 返回 200。
- 已用真实浏览器登录线上后台，进入 `https://nianlun.xmlga.top/dashboard`，确认新版总览文案存在且控制台无错误。
- 线上截图：`online-admin-dashboard-mobile.png`。

## 仍阻塞正式 production 切换

- 当前线上 API 健康检查仍返回 `app_env: local`，这是为了让已有 `STORAGE_PROVIDER=mock`、`MAP_PROVIDER=mock` 配置继续可用。
- 尝试切到 `APP_ENV=production` 后，运行时保护正确阻止启动：`STORAGE_PROVIDER=mock is not allowed outside local/test environments`。
- 因此正式生产上线前必须补齐真实对象存储和地图服务配置；否则只能作为线上联调环境运行，不能标记为正式生产环境。
