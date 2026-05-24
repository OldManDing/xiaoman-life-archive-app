# 原生模拟器 UI 最终审计 2026-05-23

## 范围

- 设备：Android 模拟器 `emulator-5554`，720x1600，320dpi
- 包名：`com.xmlga.nianlun`
- 对比基准：`iamges2/*.png`
- 验证方式：重新构建 Capacitor Android 包，安装到模拟器后，通过 WebView/ADB 采集页面截图和物理滚动长图；本轮不使用浏览器截图替代模拟器截图。

## 已修复

1. 记录创建页/编辑页在模拟器截图中出现的黑色小点
   - 原因：移动 WebView 把文本域 resize handle 画出来，浏览器检查不明显。
   - 修复：全局禁用 `textarea` resize，并关闭 WebView 原生滚动条/过度滚动。

2. 记录创建从媒体入口进入时出现输入光标
   - 原因：`focus=media` 仍然聚焦正文文本域，模拟器长图会看到插入光标。
   - 修复：媒体入口不再自动聚焦文本输入框。

3. 记录编辑点击后空白
   - 复验：在模拟器中打开记录详情，点击“编辑记录”，最终停在 `/record/r_demo_001/edit`，页面文本和表单字段正常渲染。

## 对比结论

当前版本不是 100% 像素级复刻 `iamges2`。原因主要是参考图是静态设计稿/样例数据，而模拟器运行的是当前真实 API 数据和 Android WebView 环境。

从 UI 审核角度，当前模拟器版本已达到发布前候选水准：主视觉统一、页面间距和卡片层级稳定、记录创建/详情/编辑链路无空白、记录页按钮无异常残留、长页面没有横向溢出或明显遮挡。

## 仍未 100% 复刻的点

| 页面 | 差异 |
| --- | --- |
| 首页 | 当前使用真实账号、真实孩子年龄和线上记录数据；参考图中的数量、时间、内容和图片是固定样例。 |
| 时间轴 | 当前只有 2026 年 5 月的 2 条真实记录；参考图包含 2026 年 4 月多条静态样例。 |
| 记录创建 | 视觉结构已对齐；发生时间为当前时间，和参考图静态时间不同。 |
| 记录详情/编辑 | 当前表单内容、媒体占位图和 AI 摘要来自真实记录接口，和静态参考文案不完全一致。 |
| 家庭/家人资料 | 成员名称、角色、加入天数和动态来自当前接口数据。 |
| 月报与纪念册 | 当前月报月份、统计和往期列表为当前产品样例数据，非逐字复刻。 |
| 会员/安全/设置/关于 | Android 模拟器存在系统手势条，页面真实状态字段和参考图静态字段不完全一致。 |

## 证据

- 最终参考图 vs 模拟器拼板：`artifacts/app-live-audit/native-sim-final-reference-pairs-20260523.png`
- 记录创建最终首屏：`artifacts/app-live-audit/native-sim-final-ui-record-create-nofocus-20260523.png`
- 记录创建最终物理长图：`artifacts/app-live-audit/native-sim-final-long-record-create-nofocus-20260523.png`
- 记录编辑点击链路截图：`artifacts/app-live-audit/native-sim-final-click-edit-after-20260523.png`
- 物理长图：`native-sim-final-long-home-20260523.png`、`native-sim-final-long-timeline-20260523.png`、`native-sim-final-long-record-edit-20260523.png`、`native-sim-final-long-family-20260523.png`、`native-sim-final-long-profile-20260523.png`、`native-sim-final-long-reports-20260523.png`

## 验证

- `npm.cmd run sync:mobile`：通过
- `gradlew.bat installDebug`：通过，已安装到 `emulator-5554`
- 模拟器记录详情 -> 编辑记录：通过，渲染 `/record/r_demo_001/edit`
- 模拟器全页首屏采集：home、timeline、record-create、record-detail、record-edit、search、child-add、family、family-member、profile、reports、export、membership、settings、security、about
- 模拟器物理长图采集：home、timeline、record-create、record-edit、family、profile、reports
