# 实施版：原生 App 上架基线

更新时间：2026-05-20

## 1. 当前选型

- 采用 `Capacitor` 作为原生壳，承接现有 `apps/web`
- 原因：当前产品、路由、表单和验收体系都在 Web 端已成形，改成 React Native 等于重做，不符合当前发布优先级
- 工程目录：`apps/mobile`

## 2. 已完成

- 原生壳 workspace：`apps/mobile/package.json`
- Capacitor 配置：`apps/mobile/capacitor.config.ts`
- Web 产物同步脚本：`scripts/prepare-mobile-web.cjs`
- 根命令：
  - `npm run build:mobile`
  - `npm run sync:mobile`
  - `npm run mobile:add:android`
  - `npm run mobile:add:ios`

## 3. 初始化步骤

```bash
npm install
npm run mobile:add:android
npm run mobile:add:ios
```

说明：

- Android 可在当前 Windows 环境继续接入 Android Studio
- iOS 工程可以生成，但最终签名、构建、上传仍需要 macOS + Xcode

## 4. 每次同步原生包

```bash
npm run build:web
npm run build:mobile
npm run sync:mobile
```

## 5. 与上架直接相关的闭环

- 账户删除：已从“人工反馈申请”改成应用内真实删除链路
- 正式 API：`https://webapi.xmlga.top/api/v1`
- 帮助、后台、隐私承载域名：`https://nianlun.xmlga.top`
- AI 生产模板：
  - `AI_PROVIDER=openai-compatible`
  - `AI_BASE_URL=https://ark.cn-beijing.volces.com/api/coding/v3`
  - `AI_MODEL=gml5.1`

## 6. 提审前必须再做

- Android 真机跑通：登录、发布图文、上传图片、邀请成员、注销账号
- iPhone 真机跑通：同上，并验证键盘、安全区、图片选择与返回手势
- 准备商店材料：
  - 隐私政策 URL
  - 用户协议 URL
  - 儿童信息保护规则 URL
  - 测试账号
  - 账户删除路径说明：`我的 -> 账号与安全 -> 注销账号`
