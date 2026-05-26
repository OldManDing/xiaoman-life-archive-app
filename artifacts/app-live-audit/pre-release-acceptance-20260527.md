# 发布前验收记录 2026-05-27

## 结论

当前版本按 `docs/发布前验收标准与执行清单.md` 完成一轮发布前验收。

- P0 功能、后台、API、视觉、工程和安全基线：通过。
- P1 仍需人工确认项：Android/iOS 真机媒体格式矩阵、真实对象存储 bucket/CORS/CDN、真实 AI 额度与内容安全、高德地图配额、生产告警联系人和备份恢复演练。
- 发布判定：条件通过，可进入线上发布；发布后必须按线上健康检查和关键链路 smoke 复验。

## 本轮修复

- 新增发布前验收标准文档，补充 P0/P1/P2 分级、证据要求和执行顺序。
- 新增浏览器 E2E：
  - 登录页填写账号密码后查看协议，返回后表单和协议勾选不丢失。
  - 新账号注册、建档、注销后，同账号密码重新登录失败，并显示“账号或密码错误”。
- API 增加基础安全头并隐藏 `X-Powered-By`。
- 生产 Nginx 增加 HSTS、CSP、点击劫持防护、MIME 嗅探防护、Referrer-Policy、Permissions-Policy。
- `.gitignore` 增加本地环境文件和证书/私钥忽略规则，降低误提交风险。
- JWT 策略补充身份面校验：用户 token 只能访问用户 API，后台 token 只能访问后台 API；非法 `sub` 统一按未授权处理。
- 生产 CORS 校验收紧：生产/预发环境禁止 `*`、`null`、非 HTTPS 来源，避免携带凭证时放开跨域。

## 验收命令与结果

| 命令 | 结果 |
| --- | --- |
| `npm.cmd run verify:production-template` | 通过 |
| `npm.cmd audit --omit=dev --audit-level=moderate` | 通过，0 vulnerabilities |
| `docker compose -f deploy/docker-compose.prod.yml --env-file .env.example config --quiet` | 通过 |
| `npm.cmd run test:api -- --runTestsByPath apps/api/test/unit/env-config.spec.ts apps/api/test/smoke/auth.e2e.spec.ts apps/api/test/smoke/admin-operations.e2e.spec.ts` | 通过；32/32，覆盖 CORS 严格校验、用户/后台 token 互斥 |
| `npm.cmd run typecheck:api` | 通过 |
| `npm.cmd run smoke:test:api` | 通过；API smoke 32/32 |
| `npm.cmd run regression:baseline` | 通过；API 46/46，API smoke 32/32，Web 22/22，Admin 5/5，Admin lint 通过 |
| `npm.cmd run build:api` | 通过 |
| `npm.cmd run build:web` | 通过 |
| `npm.cmd run build:admin` | 通过 |
| `$env:DATABASE_URL='mysql://xiaoman:password@localhost:3317/xiaoman_archive'; npm.cmd run test:e2e` | 通过；Playwright 24/24 |
| `git diff --check` | 通过，无空白错误 |
| `python C:\Users\MrDing\.codex\skills\audit-code\scripts\audit_code.py F:\https-github-com-oldmanding-xiaoman-life` | 已执行；有效修复 `.env.local` 和证书/私钥忽略规则；其余高危主要为测试账号、生产模板占位、seed 数据、生成产物和 UI select 误报 |

## 重点覆盖

- App 登录、注册、协议勾选、协议页返回状态保留。
- 后台生成注册邀请码，App 注册使用邀请码；登录不要求邀请码。
- `users/me/deletion-check` 与 `users/me/delete` 链路，注销后同账号密码重新登录失败。
- 首页、记录创建、媒体上传、时间轴、详情、编辑、家庭、我的、帮助、关于与协议。
- 后台登录、总览、账号管理、邀请码、用户/孩子/记录/媒体/AI/审计列表、详情抽屉和关键操作。
- App 与后台移动/桌面视觉截图，无横向溢出、无未完成文案、无英文 seed 文案。
- API 安全头与生产 Nginx 安全头。

## 发布后必验

1. `curl -fsS https://webapi.xmlga.top/api/v1/health`
2. `curl -I https://nianlun.xmlga.top`
3. 后台登录、生成邀请码、账号管理详情、总览卡片高度。
4. App 使用新邀请码注册，建档，注销后同账号密码重新登录失败并显示“账号或密码错误”。
5. Android 真机媒体、定位、权限拒绝提示。
6. 真实对象存储、AI、地图 POI 三个 provider 线上抽检。
