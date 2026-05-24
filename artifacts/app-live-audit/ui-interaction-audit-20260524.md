# App UI 交互改造复核 - 2026-05-24

## 本轮目标

把当前版本作为功能验收基线继续打磨视觉与交互质感，重点解决“平、普通、操作反馈弱”的问题，不改动账号注销、登录、API 语义。

## 已调整

- 全局交互：补齐按钮触感、卡片入场、底部导航 active/press 状态、减少无反馈点击。
- 首页第一屏：改成“今日记忆”主体验，强化孩子档案、主 CTA、照片氛围、快捷记录入口。
- 首页快捷入口：从四个小按钮改成更有识别度的 2x2 触控卡片，文案明确到拍照/视频/文字/里程碑。
- 记录创建/编辑：发布前 3 项增加进度条和完成状态，让用户知道还差什么。
- 记录页操作：浮动发布条改为滚动后出现，避免首屏遮挡媒体采集按钮。
- 底部导航：升级为玻璃底座和中央记录入口，active 状态更明确。

## 验证

- `npm.cmd run typecheck:web`：通过。
- `npm.cmd run test:web`：14/14 通过。
- `npm.cmd run build:web`：通过。
- `DATABASE_URL=mysql://xiaoman:password@localhost:3317/xiaoman_archive npm.cmd run test:e2e -- e2e/visual.spec.ts -g "captures App key screens"`：Chromium 真实浏览器 1/1 通过。

## 截图证据

- `artifacts/visual-review-current/app-home-mobile.png`
- `artifacts/visual-review-current/app-record-create-mobile.png`
- `artifacts/visual-review-current/app-record-edit-mobile.png`
- `artifacts/visual-review-current/app-timeline-mobile.png`

## 剩余注意

- 本机 `xiaoman-mysql` 旧 Docker 卷不可用，日志包含 `Bad message`；本轮本地验证改用运行中的 `xiaoman-e2e-mysql`，端口 `3317`。
- 当前是功能验收基线上的体验增强，不是从 Stitch/Figma 重新出一整套高保真视觉系统。后续如果要做“真正有品牌辨识度”的版本，建议单独开 UI 体系迭代。
