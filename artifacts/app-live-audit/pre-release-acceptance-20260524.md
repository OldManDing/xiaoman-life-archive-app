# 发布前验收记录 2026-05-24

## 结论

本轮按发布前验收顺序完成四步：功能/API、后台真实浏览器 UI、工程门禁、发布风险与回滚边界。

当前代码可以继续作为“功能验收基线”推进人工验收与发布前收口；但线上健康检查仍显示 `app_env=local`、`storage=mock`、`map=mock`，因此不能宣称正式生产 provider 全链路已经完成。

## 1. 功能/API 验收

| 验收项 | 结果 | 证据 |
| --- | --- | --- |
| 账号注销专项 | 通过 | `npm.cmd run smoke:test -w apps/api -- --runTestsByPath test/smoke/auth.e2e.spec.ts`，6/6 |
| 删除后旧 token 失效 | 通过 | `GET /api/v1/users/me` 返回 401 |
| 删除后同账号密码重新登录 | 通过 | `POST /api/v1/auth/login` 返回 401，message 为 `账号或密码错误` |
| 线上删除路由探测 | 通过 | `GET /api/v1/users/me/deletion-check` 返回 401，`POST /api/v1/users/me/delete` 返回 401，均不是 404 |
| 线上 API 健康检查 | 通过但有风险 | `GET https://webapi.xmlga.top/api/v1/health` 返回 200 |

线上健康检查返回的 provider 状态：`sms=disabled`、`storage=mock`、`ai=openai-compatible`、`map=mock`。

## 2. 后台真实浏览器 UI 验收

已修复后台总览“值班工作台”移动端卡片高度不足问题：移动端 `.admin-dashboard-workbench-metric` 固定最小高度为 `112px`，并保持内容上下分布。

| 验收项 | 结果 | 证据 |
| --- | --- | --- |
| 后台类型检查 | 通过 | `npm.cmd run typecheck:admin` |
| 后台桌面/移动视觉 E2E | 通过 | `DATABASE_URL=mysql://xiaoman:password@localhost:3317/xiaoman_archive npm.cmd run test:e2e -- e2e/visual.spec.ts --grep Admin`，2/2 |
| 桌面总览截图 | 通过 | `artifacts/visual-review-current/admin-dashboard.png` |
| 移动总览长图 | 通过 | `artifacts/visual-review-current/admin-dashboard-mobile-long.png` |

人工肉眼复核：桌面信息层级清楚；移动端值班工作台四个卡片不再压扁；长图未发现横向溢出、重叠或不可读按钮。

## 3. 工程门禁

| 命令 | 结果 |
| --- | --- |
| `npm.cmd run verify:production-template` | 通过 |
| `npm.cmd audit --omit=dev --audit-level=moderate` | 通过，0 vulnerabilities |
| `npm.cmd run regression:baseline` | 通过 |
| `npm.cmd run build:api` | 通过 |
| `npm.cmd run build:web` | 通过 |
| `npm.cmd run build:admin` | 通过 |
| `DATABASE_URL=mysql://xiaoman:password@localhost:3317/xiaoman_archive npm.cmd run test:e2e` | 通过，20/20 |

`npm audit` 首次被 `qs` moderate 漏洞拦截，已将 lockfile 中 `qs` 从 `6.14.2` 升级到 `6.15.2`，生产依赖审计已恢复为 0 漏洞。

`regression:baseline` 覆盖结果：

- API 测试：33/33
- API smoke：22/22
- Web 测试：14/14
- Admin 测试：3/3
- Admin lint：通过

完整 E2E 覆盖结果：20/20，通过 App、后台、按钮/API 连通性和视觉截图 smoke。

## 4. 发布风险与回滚边界

### 当前可判定

- 当前版本可作为功能验收基线继续发布前人工验收。
- 后台总览与值班工作台 UI 已重新截图验证。
- 账号注销后同账号密码重新登录失败，错误文案为 `账号或密码错误`。
- 删除 API 已在线，未登录访问返回 401，不是路由缺失。
- 本地发布前门禁已全绿。

### 当前不可宣称

- 不能宣称正式生产 provider 已全部完成，因为线上健康检查仍显示 `storage=mock`、`map=mock`。
- 不能宣称生产环境变量完全切换完成，因为线上 `runtime.app_env` 仍返回 `local`。
- 真机侧相机、录音、定位、真实 POI、真实对象存储上传仍需要最终人工验收确认。

### 回滚边界

- 若仅回滚前端或 API 代码，按 `docs/实施版_生产部署运行手册.md` 的上一版本 commit/tag 回滚。
- 若涉及数据库结构回滚，必须先确认发布前备份，再恢复备份并启动上一版本镜像。
- 回滚后必须重新检查健康检查、登录、记录创建、上传、AI 任务和后台审计。
