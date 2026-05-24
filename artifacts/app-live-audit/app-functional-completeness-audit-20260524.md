# App 功能完善性测试验收记录 2026-05-24

## 结论

当前 App 核心功能链路在本地浏览器 E2E 与 Android 模拟器上已通过本轮验收。测试中发现 1 个发布页原生录音缺口：Android WebView 录音生成 `audio/webm;codecs=opus`，上传接口按完整 MIME 判断导致“音频格式不支持”。已修复前端 MIME 规范化、后端 MIME 规范化与移动端常见媒体白名单，并完成复测。

## 本轮覆盖

| 模块 | 覆盖内容 | 状态 |
| --- | --- | --- |
| 登录与会话 | 密码登录、协议勾选、登录后进入首页 | 通过 |
| 首页 | 快捷发布入口、最近记录、时间轴跳转 | 通过 |
| 发布页 | 文本、图片、视频、语音、定位、里程碑、必填校验、发布后详情和时间轴回显 | 通过 |
| 媒体上传 | 图片上传、本地预览、原生拍照、原生录音、MIME 白名单 | 通过 |
| 定位 | 浏览器地理位置、Android 模拟器定位权限、中文地点回填 | 通过 |
| 记录详情与编辑 | AI 操作反馈、编辑页打开、非空数据回填 | 通过 |
| 搜索与时间轴 | 关键词搜索、记录卡片展示、详情进入 | 通过 |
| 家庭 | 家庭成员、成员详情、邀请码生成 | 通过 |
| 我的 | 个人资料、设置、导出、会员、安全、注销入口、帮助反馈、关于与协议 | 通过 |

## 发现并修复的问题

### P0 原生录音无法完成上传

- 现象：Android 模拟器中打开发布页，点击“录制语音”后能出现录音面板，但点击“开始录制”后显示“音频格式不支持”。
- 原因：`MediaRecorder` 返回的 MIME 为 `audio/webm;codecs=opus`，前端原样传入上传接口；后端只允许 `audio/webm`，没有去除 MIME 参数。
- 修复：前端上传前规范化 MIME；原生录制生成文件时也使用规范化 MIME；后端上传策略同样规范化 MIME，并补齐 `video/3gpp`、`audio/3gpp`、`audio/amr`。
- 复测：Android 模拟器重新同步和安装后，点击“录制语音 -> 开始录制”，页面生成 `nianlun-audio-*.webm`，并显示“已选择 1 个媒体，将随记录一起保存。”

## 验证命令

| 命令 | 结果 |
| --- | --- |
| `npm.cmd run typecheck:web` | 通过 |
| `npm.cmd run typecheck:api` | 通过 |
| `npm.cmd run test:web` | 14/14 通过 |
| `npx.cmd jest --runInBand --testPathPattern=apps/api/test/smoke/admin-media.e2e.spec.ts --config apps/api/jest.config.js` | 4/4 通过 |
| `DATABASE_URL=mysql://xiaoman:password@localhost:3317/xiaoman_archive npm.cmd run test:e2e -- e2e/app.spec.ts --project=chromium` | 9/9 通过 |
| `DATABASE_URL=mysql://xiaoman:password@localhost:3317/xiaoman_archive npx.cmd playwright test e2e/visual.spec.ts --grep "captures App key screens" --project=chromium` | 1/1 通过 |
| `npm.cmd run sync:mobile` | 通过 |
| `gradlew.bat installDebug` | 通过，已安装到 `emulator-5554` |

## 证据文件

- `artifacts/app-live-audit/native-function-check-home-20260524.json`
- `artifacts/app-live-audit/native-function-check-record-create-post-audiofix-20260524.json`
- `artifacts/app-live-audit/native-function-check-audio-modal-postfix-20260524.png`
- `artifacts/app-live-audit/native-function-check-audio-start-postfix-20260524.png`
- `artifacts/visual-review-current/app-home-mobile.png`
- `artifacts/visual-review-current/app-record-create-mobile.png`
- `artifacts/visual-review-current/app-timeline-mobile.png`
- `artifacts/visual-review-current/app-profile-mobile.png`

## 剩余风险

- 本地 API 健康检查显示 `storage/ai/map` 仍为 `mock`，本地通过不能等价于真实对象存储、AI、地图供应商在线通过。
- Android 模拟器已完成安装和核心原生能力 smoke；iOS 只完成 Capacitor 资源同步，本机缺少 Xcode/CocoaPods，未做 iOS 真机或模拟器验收。
- 应用商店发布前还需要正式签名包、隐私权限文案、素材、软著/合规材料与至少一轮真实手机回归。
