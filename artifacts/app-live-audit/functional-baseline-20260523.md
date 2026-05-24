# 功能验收基线 2026-05-23

## 结论

当前版本可以作为发布前“功能验收基线”继续验收。此基线不再追求 `iamges2` 的 100% 像素复刻，验收重点切回：账号登录/注销、记录创建与编辑、家庭/个人中心关键路径、后台操作、API 删除链路、原生壳安装和模拟器内页面可用性。

## 本轮补齐

- 记录创建页媒体区标题从 `MEDIA` 改回 `影像与声音`，保持中文产品基线，也恢复 E2E 对当前媒体能力的断言。
- 后台总览 E2E 从旧版 `处理路径` 断言更新为当前基线中的 `统计图` 与 `最近审计日志`，不再依赖已移除的旧模块文案。
- 线上 `users/me/deletion-check` 与 `users/me/delete` 无登录请求均返回鉴权接口的 `401 未登录`，确认路由已在线且不是 `404`。

## 质量门

| 项目 | 结果 | 说明 |
| --- | --- | --- |
| `npm.cmd run regression:baseline` | 通过 | 包含 Prisma generate、API typecheck、API 31 个测试、API smoke 21 个测试、Web typecheck、Web 14 个测试、Admin typecheck、Admin 3 个测试、Admin lint |
| `DATABASE_URL=mysql://xiaoman:password@localhost:3317/xiaoman_archive npm.cmd run test:e2e` | 通过 | Playwright 21/21，通过 App、Admin、按钮/API 连通性与视觉截图 smoke |
| `npm.cmd run sync:mobile` | 通过 | Capacitor Web 资源已同步，移动包 API 指向 `https://webapi.xmlga.top/api/v1` |
| `gradlew.bat installDebug` | 通过 | 使用 Android Studio JBR `21.0.10` 安装到 `emulator-5554` |
| 线上删除路由探测 | 通过 | `GET /api/v1/users/me/deletion-check`、`POST /api/v1/users/me/delete` 均返回 `401 未登录` |

## 原生壳证据

- 首页首屏：`artifacts/app-live-audit/native-baseline-home-20260523.png`
- 记录创建首屏：`artifacts/app-live-audit/native-baseline-record-create-20260523.png`
- 记录编辑首屏：`artifacts/app-live-audit/native-baseline-record-edit-20260523.png`
- 记录创建模拟器 WebView 全页：`artifacts/app-live-audit/native-baseline-record-create-cdp-full-20260523.png`
- 记录编辑模拟器 WebView 全页：`artifacts/app-live-audit/native-baseline-record-edit-cdp-full-20260523.png`
- 物理滚动拼接长图：`artifacts/app-live-audit/native-baseline-record-create-long-20260523.png`、`artifacts/app-live-audit/native-baseline-record-edit-long-20260523.png`

## 删除链路证据

- API smoke 覆盖：
  - `GET /api/v1/users/me/deletion-check` 返回可删除判断。
  - `POST /api/v1/users/me/delete` 成功后撤销会话、写入 `user.account_deleted` 审计、软删除用户、打散 auth key。
  - 删除后旧 token 访问 `users/me` 返回 `401`。
  - 删除后使用原账号密码登录返回 `401` 且前端文案归一为 `账号或密码错误`。
- 线上原生壳网络证据：`artifacts/app-live-audit/android-delete-relogin-network.json`

## 环境说明

- 本机默认 `docker-compose` MySQL `3307` 的旧 volume 仍有 `Bad message` 腐坏，本轮 E2E 使用健康的 `xiaoman-e2e-mysql`，端口 `3317`。
- 本机默认 Java 是 17；Android/Capacitor 安装需要 Java 21。本轮用 `C:\Program Files\Android\Android Studio\jbr` 临时设置 `JAVA_HOME` 后安装成功。
- 物理滚动拼接长图在表单区域有重复段，最终验收以同一模拟器 WebView 的 CDP 全页图为更干净的长图证据。

## 剩余验收

- 用户可在原生壳上做最后一轮真实账号手工验收：注销账号后，用同一账号密码重新登录应失败。
- 后续如果要继续提升视觉，不建议在本基线上继续微调，应另开 UI 重设计迭代，避免影响当前功能验收闭环。
