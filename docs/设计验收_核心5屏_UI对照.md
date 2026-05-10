# 设计验收：核心 5 屏 UI 对照

更新时间：2026-05-09

## 验收范围

- 登录页
- 首页
- 时间轴
- 新增记录
- 我的页

本轮仅做 UI 对齐，不做 Docker/API 数据联调。Playwright 截图通过拦截 `/api/v1/*` 返回固定验收数据完成，避免依赖本地数据库、Redis、MinIO。

## 截图产物

| 页面 | Before | After |
| --- | --- | --- |
| 登录 | `artifacts/design-acceptance/before/login.png` | `artifacts/design-acceptance/after/login.png` |
| 首页 | `artifacts/design-acceptance/before/home.png` | `artifacts/design-acceptance/after/home.png` |
| 时间轴 | `artifacts/design-acceptance/before/timeline.png` | `artifacts/design-acceptance/after/timeline.png` |
| 新增记录 | `artifacts/design-acceptance/before/record-create.png` | `artifacts/design-acceptance/after/record-create.png` |
| 我的页 | `artifacts/design-acceptance/before/profile.png` | `artifacts/design-acceptance/after/profile.png` |

## 本轮已修正

1. 用户端底部导航改为固定移动端 Tab，使用图标、文字和中间圆形记录入口；新增记录页作为沉浸式发布页隐藏底部导航。
2. 首页取消“验收卡片页”结构，改为 Figma 的白底移动 App 层级：孩子信息头部、4 个快捷入口、今日记录卡、最近更新、影像回看、进度和家庭动态。
3. 时间轴取消外层大面板，改为顶部标题/筛选条 + 月份分组 + 左侧时间线 + 记录卡。
4. 新增记录页取消外层大卡片，媒体区改为“添加照片/视频 / 录制语音”双入口，并补回“可见范围”行。
5. 我的页改为个人中心结构：顶部资料区、草稿箱、我的孩子、管理中心、设置区；未实现能力继续以“规划中/未开放/待接入”降级展示。

## 仍不一致项

### 登录页

- 仓库内没有独立 Figma 登录页导出代码，本页按现有产品样式和协议勾选要求对齐。
- 《用户协议》《隐私政策》仍未链接正式合规文本，需等合规内容确认后接入。

### 首页

- 设计图使用真实头像和真实照片；当前无头像/无真实媒体时以首字头像和真实数据空态降级。
- After 截图是移动视口首屏，影像回看、进度、家庭动态在首屏下方，需要滚动查看。

### 时间轴

- Figma 展示照片、视频、文字、语音、里程碑等筛选；当前前端仍只开放后端已支持的 `全部 / 图文 / 文字 / 里程碑`。
- 语音记录样式尚未接入真实录音/播放能力。

### 新增记录

- Figma 中“切换孩子”是单行动作；当前为了保留可用性，仍直接显示孩子选择和记录类型选择。
- “录制语音”只做禁用态视觉入口，真实语音录制不属于本轮 UI 调整。
- 下方时间、地点、标签、发布状态字段保留现有表单能力，视觉上比 Figma 更多可编辑项。

### 我的页

- 月报与纪念册、隐私设置、关于/协议、帮助反馈仍是禁用/待接入状态，符合当前功能边界，但与 Figma 中完整入口样式略有差异。
- 无真实头像时使用首字头像，和设计图真实图片头像不完全一致。

## 下一步

1. 若继续 UI 精修：优先处理新增记录页的“切换孩子”交互形式和时间/地点/标签字段展示密度。
2. 若进入功能补齐：优先补语音/视频媒体能力，随后扩展时间轴筛选类型。
3. 若进入正式验收：用真实测试账号和真实媒体数据重跑截图，替换本轮 mock 数据截图。
