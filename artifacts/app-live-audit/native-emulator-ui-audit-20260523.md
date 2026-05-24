# 原生壳模拟器 UI 对比审计 2026-05-23

## 对比范围

- 参考图：`iamges2/*.png`
- 当前图：Android 模拟器 `emulator-5554`，应用包 `com.xmlga.nianlun`
- 对比方式：重新安装当前 APK 后，在原生壳 WebView 内跳转页面并截图，不使用浏览器截图替代

## 结论

当前实现不是 100% 像素级复刻。主要差异来自真实接口数据、真实头像/记录内容、正式中文产品文案、WebView 原生控件渲染，以及参考图本身是静态设计稿。

从 UI 验收角度看，当前模拟器版本已经达到发布前候选水准：主题一致、按钮层级清晰、记录编辑页不再空白、记录页按钮触控面积已补齐，未发现影响验收的错位、重叠、横向溢出或空白页。

## 本轮调整

| 区域 | 问题 | 调整 |
| --- | --- | --- |
| 记录创建/编辑 | 顶部“发布/保存”和 `AI 智能配文` 按钮高度偏小 | 调整为 44px 触控高度 |
| 记录编辑 | 媒体缩略图删除按钮只有 28px | 扩到 44px 触控面积 |
| 时间轴 | 筛选 chip 与记录卡片“编辑/查看”按钮偏小 | 统一补到 44px 触控高度 |
| 搜索页 | 搜索、清空、历史/热门标签按钮触控面积偏小 | 统一补到 44px 触控高度 |
| 会员中心 | 黑卡装饰圆在布局审计中越过右边界 | 收回卡片内部，避免模拟器边界误判 |

## 仍未 100% 复刻的点

| 页面 | 差异 |
| --- | --- |
| 首页 | 当前使用真实接口记录和当前孩子年龄，和静态参考图的条目、时间、图片不完全一致 |
| 时间轴 | 当前记录数量、记录顺序、媒体图与参考图不同；布局结构、按钮层级和主题已对齐 |
| 记录时光 | 当前使用正式中文字段和真实默认时间；参考图里的静态占位与当前业务状态不完全一致 |
| 搜索 | 热门标签/历史标签为当前产品内置状态，不逐字复刻参考图 |
| 家庭 | 成员、头像、最近动态来自当前接口数据，不逐项复刻参考图 |
| 月报与纪念册 | 当前统计和列表为业务样例数据，和参考图固定样例不同 |
| 会员中心 | 当前会员状态、到期时间、头像来自真实用户状态 |
| 账号与安全 | 当前手机号、绑定状态来自真实登录用户 |
| 我的 | 当前头像、草稿数、孩子档案来自真实账号 |
| 导出与备份 | 当前文案按正式产品语义整理，不逐字照搬参考图 |

## 证据

- 参考图 vs 当前模拟器拼板：`artifacts/app-live-audit/native-sim-rerun-reference-pairs-20260523.png`
- 模拟器全页截图：`native-sim-rerun-timeline-cdp-full-20260523.png`
- 模拟器全页截图：`native-sim-rerun-record-create-cdp-full-20260523.png`
- 模拟器全页截图：`native-sim-final-record-edit-hitarea-cdp-full-20260523.png`
- 模拟器全页截图：`native-sim-rerun-profile-cdp-full-20260523.png`
- 物理长图也已生成：`native-sim-rerun-record-create-20260523-long.png`、`native-sim-rerun-record-edit-20260523-long.png`、`native-sim-rerun-timeline-20260523-long.png`、`native-sim-rerun-profile-20260523-long.png`

## 验证

- `npm.cmd run typecheck:web`：通过
- `npm.cmd run test:web`：通过，14 个测试
- `npm.cmd run sync:mobile`：通过
- `gradlew.bat installDebug`：通过，已安装到 `emulator-5554`
- 模拟器页面重抓：home、timeline、record-create、record-detail、record-edit、search、child-add、family、family-member、profile、reports、export、membership、settings、security、about
