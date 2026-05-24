# App UI 与产品验收记录 2026-05-24

## 范围

- App Web 端移动视口全页面：登录、首页、时间轴、发布、详情、编辑、家庭、家庭成员、孩子资料、个人中心、账号、隐私、安全、月报、导出、会员、帮助、关于、协议、错误页。
- 原生 Android 壳：`emulator-5554`，包名 `com.xmlga.nianlun`。
- 重点问题：发布时间轴分类条、发布页拍照/视频/语音入口、手机定位、里程碑按钮样式、整体移动端交互质感。

## 本轮修复

1. 时间轴顶部横向分类条已移除
   - 记录类型与标签筛选统一收进右上角筛选面板。
   - 筛选项使用自动换行芯片，不再依赖横向滑动。

2. 发布页媒体入口重做
   - 图片/视频入口拆分为：拍照记录、拍摄视频、从相册添加。
   - 语音入口拆分为：录制语音、上传语音。
   - 按钮尺寸、层级、图标和说明文案重新压缩，避免“测试按钮感”。

3. 手机定位链路补齐
   - Web 端优先调用 Capacitor Geolocation，浏览器预览兜底 `navigator.geolocation`。
   - 模拟器中点击“手机定位”后可回填地点，并展示候选地点。

4. 里程碑按钮重做
   - 移除笨重开关样式，改为轻量卡片 + 状态胶囊。
   - 保留 `aria-pressed` 状态，触控区域仍满足移动端操作尺寸。

5. 移动端交互柔化
   - 增加页面轻微进场动画。
   - 增强按钮按压反馈，并尊重 `prefers-reduced-motion`。

6. Android 录音权限修复
   - `AndroidManifest.xml` 增加 `MODIFY_AUDIO_SETTINGS`。
   - 解决 WebView 音频采集权限链路不完整导致“录制语音”落到文件选择器的问题。

## 产品验收结论

- 当前 App 页面没有发现阻塞上线的 UI 问题：全页面中文文案正常，页面没有明显横向溢出，关键按钮有明确反馈，发布页的拍照、视频、录音、上传、定位和里程碑入口已对齐原生 App 使用预期。
- 时间轴不再要求用户横向滑动分类，主内容更靠前，手机端浏览压力降低。
- 发布页从“表单”更接近“采集工作台”，产品动作更清晰。

## 验证证据

- Web typecheck：`npm.cmd run typecheck:web` 通过。
- Web 单测：`npm.cmd run test:web` 通过，14/14。
- App 页面视觉验收：`DATABASE_URL=mysql://xiaoman:password@localhost:3317/xiaoman_archive npx.cmd playwright test e2e/visual.spec.ts --grep "captures App key screens" --project=chromium` 通过，1/1。
- 移动同步：`npm.cmd run sync:mobile` 通过。
- Android 安装：`gradlew.bat installDebug` 通过，安装到 `emulator-5554`。
- 当前全页面拼板：`artifacts/visual-review-current/app-all-pages-contact-sheet-current.png`。
- 原生首页：`artifacts/app-live-audit/native-ui-postfix-20260524-final-wait.png`。
- 原生发布页：`artifacts/app-live-audit/native-ui-postfix-record-create-20260524-final.png`。
- 原生拍照弹窗：`artifacts/app-live-audit/native-ui-postfix-camera-action-20260524-final.png`。
- 原生录音弹窗：`artifacts/app-live-audit/native-ui-postfix-audio-modal-after-permission-20260524.png`。
- 原生定位回填：`artifacts/app-live-audit/native-ui-postfix-location-after-wait-20260524.png`。

## 剩余非阻塞项

- iOS 只完成 Capacitor 资源同步；本机没有 Xcode/CocoaPods，未做 iOS 原生安装验证。
- 应用商店正式发布前仍需走签名、隐私权限说明、商店素材和最终真机回归。
