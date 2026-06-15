# 年轮 Android v2.0.1 华为复审版

发布日期：2026-06-16

## 版本

- 应用包名：`com.xmlga.nianlun`
- 版本名：`2.0.1`
- Version Code：`3`
- Target SDK：`35`

## 华为审核反馈修复

1. 注册流程不再强制邀请码。邀请码字段为选填，未填写也可以正常注册、登录和进入产品。
2. 免费用户触发 AI 相关能力时不再直接调用外部 provider，也不会展示 `API Key 所属分组已删除` 这类底层错误；当前统一返回会员能力提示：`AI 功能仅对 AI 会员开放`。

## 上架产物

- `nianlun-v2.0.1-3-release.aab`
  - SHA256：`9A545F0051593DFD80AB7BCC55E0B652F65DF4674CF4D53D3BAD5CC6EB8FA074`
- `nianlun-v2.0.1-3-release.apk`
  - SHA256：`5EB77D387A2224BD0039010ECCC7F66F616F94198E5687DDF8BAF4598E71D089`

## 发布前验证

- `npm.cmd run typecheck:web`：通过
- `npm.cmd run typecheck:api`：通过
- `npm.cmd run test -w apps/web -- App.test.tsx`：46 项通过
- `npm.cmd run test -w apps/api -- test/unit/ai-provider.service.spec.ts test/smoke/ai-jobs.e2e.spec.ts test/smoke/auth.e2e.spec.ts`：24 项通过
- `npm.cmd run build:web`：通过
- `npm.cmd run build:api`：通过
- `npm.cmd run sync:mobile`：通过
- `./gradlew.bat assembleDebug assembleRelease bundleRelease`：通过
- APK 签名验证：通过 v1/v2 签名校验
- 模拟器 smoke：通过，`failures: []`

## 复审验证结果

- 注册页邀请码输入框为选填，且没有 required 限制。
- 自动化临时账号可无邀请码注册，并创建宝宝档案。
- 免费用户调用 AI preview 返回 `403` 和 `AI 功能仅对 AI 会员开放`，未出现 provider 级 403 错误文案。
- 记录发布、首页、时间线、搜索、家庭、我的、月报空状态均可访问。
- 自动化测试账号已在 smoke 结束后注销清理。
