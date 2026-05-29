# nianlun App 2026-05-29 质量修复版

## 安装包

- 文件：`nianlun-debug-20260529-app-quality-camera-session.apk`
- 大小：`10089780` bytes
- SHA256：`CEBECF745D25AC9E1C72766243422F5349EFA0D9934808A1E2D4FEE0D30108BC`

## 本版重点

- 修复 App 重启后反复要求登录的问题：本地只保存非敏感会话标记，启动后通过 refresh cookie 恢复登录。
- 修复拍照体验异常：拍照和相册入口改为系统相机/系统相册，不再出现 App 内局部采集窗口。
- 优化记录发布页标题层级，去掉重复标题。
- 修复底部固定发布条遮挡按钮的问题。
- 增加 App 全路由输入框/按钮点击审计和媒体入口 E2E 测试。

## 验证

- `npm.cmd run regression:baseline` 通过。
- `npm.cmd run test:e2e -- e2e/app-interaction-audit.spec.ts` 通过。
- `npm.cmd run test:e2e -- e2e/app.spec.ts` 通过。
- `npm.cmd run test:e2e -- e2e/admin-interaction-audit.spec.ts` 通过。
- `npm.cmd run build:web`、`npm.cmd run build:admin`、`npm.cmd run build:mobile` 通过。
- `npm.cmd run sync:mobile` 通过。
- `apps/mobile/android/gradlew.bat assembleDebug` 通过。

## 真机注意

安装后重点复验：登录保持、拍照、相册多选、录像、录音/音频选择、定位权限、记录发布和时间轴回看。
