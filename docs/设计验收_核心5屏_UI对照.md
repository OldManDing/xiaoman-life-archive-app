# 设计验收：核心 5 屏 UI 对照

更新时间：2026-05-12

## 验收范围

- 登录页
- 首页
- 时间轴
- 新增记录
- 我的页

本轮在 UI 对齐基础上补齐记录媒体能力和关键子页面交互。Playwright 截图使用本地 E2E 服务和种子数据完成，仍需在真实对象存储和真实移动设备上复验。

## 截图产物

| 页面 | Before | After |
| --- | --- | --- |
| 登录 | `figma/src/imports` 无独立登录导出 | `artifacts/visual-review-current/app-login-mobile.png` |
| 首页 | `figma/src/imports/screen.png` | `artifacts/visual-review-current/app-home-mobile.png` |
| 时间轴 | `figma/src/imports/screen-1.png` | `artifacts/visual-review-current/app-timeline-mobile.png` |
| 新增记录 | `figma/src/imports/screen-2.png` / `screen-4.png` | `artifacts/visual-review-current/app-record-create-mobile.png` |
| 我的页 | Figma Make `MyPage.tsx` / 参考导出 | `artifacts/visual-review-current/app-profile-mobile.png` |

## 本轮已修正

1. 用户端底部导航改为固定移动端 Tab，使用图标、文字和中间圆形记录入口；新增记录页作为沉浸式发布页隐藏底部导航。
2. 首页取消“验收卡片页”结构，改为 Figma 的白底移动 App 层级：孩子信息头部、4 个快捷入口、今日记录卡、最近更新、影像回看、进度和家庭动态。
3. 时间轴取消外层大面板，改为顶部标题/筛选条 + 月份分组 + 左侧时间线 + 记录卡。
4. 新增记录页取消外层大卡片，媒体区改为“添加照片/视频 / 录制语音”双入口，并补回“可见范围”行。
5. 我的页改为个人中心结构：顶部资料区、草稿箱、我的孩子、管理中心、设置区，并补齐可访问的月报、设置、协议和反馈子页面。
6. 记录发布已支持图片、视频、语音三类媒体上传；文字模式会隐藏媒体区。
7. 标签输入已从手填改为下拉选择；地点支持搜索、常用地点选择和浏览器定位写入。
8. 孩子资料页和个人资料页已补头像上传入口。

## 2026-05-12 继续精修

1. 首页补回 Figma 的“生命档案”顶部品牌栏、个人头像入口、放大孩子头像与编辑浮层。
2. 首页 4 个快捷入口从小型表单卡调整为 2×2 深灰行动卡，更贴近 Figma 首屏节奏。
3. 首页最近更新优先展示真实媒体缩略图；无媒体时降级为日期块，避免假图片。
4. 时间轴补齐同款“生命档案”顶部品牌栏，并新增 `app-timeline-mobile.png` 截图门禁。
5. 新增记录页把“记录给”和“记录类型”合并为一个轻量信息卡，下拉框样式与移动端发布页保持一致。
6. E2E 准备流程在 Prisma Client 已存在时使用 `db push --skip-generate`，避免 Windows 下运行中 API 锁定 DLL 造成门禁噪音。

## 2026-05-13 95% 接近度精修

1. 发布页按 Figma 的纵向节奏重新拉开归属卡、媒体区、标题正文区和元信息区，首屏不再过早露出后台式表单。
2. 发布页标题字号、正文高度、媒体框高度和主区间距继续贴近 Figma `screen-2/screen-3/screen-4`。
3. 日期、地点、标签区域从卡片式表单改为轻量元信息区，输入和下拉统一为胶囊样式，保留必填校验、标签下拉、定位和地点搜索。
4. App 核心卡片圆角恢复到 Figma 移动端设计语言：首页快捷入口、发布页信息卡、发布媒体区、我的页列表卡都不再偏后台硬边。
5. 视觉截图继续覆盖 `app-home-mobile.png`、`app-timeline-mobile.png`、`app-record-create-mobile.png`、`app-record-selects-mobile.png`、`app-profile-mobile.png` 和后台关键页。

## 2026-05-13 精修三轮

1. 第一轮：首页快捷入口文案对齐 Figma 的“抓拍瞬间 / 影像动态 / 成长日记 / 里程碑”，时间轴筛选顺序调整为 `全部 / 里程碑 / 照片 / 视频 / 文字 / 语音`。
2. 第二轮：发布页媒体上传区由整块虚线框改为横向媒体方块，上传后的预览、继续添加和语音入口保持同一视觉语言。
3. 第三轮：家庭、月报、导出、会员等子页面圆角和卡片节奏统一到移动端 16-20px 体系，发布页格式提示不再挤压标题区。
4. 本轮截图已刷新：`app-home-mobile.png`、`app-record-create-mobile.png`、`app-reports-mobile.png`、`app-family-invite-mobile.png`、`app-record-detail-mobile.png`。

## 2026-05-13 UI 图再精修三轮

本轮按仓库 `images/*.png` 中的 UI 参考图复核，不再以 Figma 代码为判断标准。

1. 第一轮：发布页“记录给”卡片恢复为参考图的单行动作结构，记录类型移到下方信息区；媒体区恢复为单个虚线 `MEDIA` 容器和左右分区入口。
2. 第二轮：“我的”页按参考图弱化说明文案，列表回归移动端设置项节奏；头像恢复圆形，家庭页主卡片的邀请入口放大并去除偏后台的信息胶囊。
3. 第三轮：截图复核后收紧发布页媒体框与标题区之间的留白，并新增家庭主页 `app-family-mobile.png` 视觉门禁，避免只检查邀请子页。
4. 本轮截图刷新：`app-home-mobile.png`、`app-timeline-mobile.png`、`app-record-create-mobile.png`、`app-family-mobile.png`、`app-profile-mobile.png`、后台总览/媒体/审计截图。

三轮复验：

- `npm run typecheck:web`：通过。
- `npm run test:web`：6/6 通过。
- `npm run test:e2e -- e2e/visual.spec.ts`：2/2 通过并刷新截图。
- `npm run build:web`：通过。
- `npm run test:e2e`：14/14 通过。

## 本轮验证

- `npm run regression:baseline`：通过。
- `npm run test:e2e`：14/14 通过，覆盖登录、上传发布、文字模式隐藏上传、必填校验、记录详情、时间轴、我的子页面、家庭邀请码、后台总览/媒体/审计。
- `npm run build:web`：通过。
- `npm run build:admin`：通过。
- `npm run verify:production-template`：通过。
- 当前本地服务：API `http://127.0.0.1:3001/api/v1/health`、Web `http://127.0.0.1:5176`、Admin `http://127.0.0.1:5177` 均已恢复可访问。

2026-05-13 复验：

- `npm run test:e2e`：14/14 通过。
- `npm run regression:baseline`：通过。
- `npm run build:web`：通过。
- `npm run build:admin`：通过。
- `npm run verify:production-template`：通过。
- API、App Web、Admin 本地服务均已恢复可访问。

2026-05-13 上传与后台表格补强复验：

- mock 上传图片会生成可持久化本地预览；上传后进入详情、返回时间轴并刷新页面后，时间轴图片仍优先显示本地预览。
- 前后端上传白名单补齐移动端常见 `image/heic`、`image/heif`、`audio/m4a`、`audio/x-m4a`；API 烟测覆盖对象后缀生成。
- 后台媒体列表长字段改为省略展示并保留悬停完整标题，避免关联记录、上传者或文件名挤压操作列。
- `npm run regression:baseline`：通过。
- `npm run test:e2e`：14/14 通过并刷新截图。
- `npm run build:api`、`npm run build:web`、`npm run build:admin`：通过。
- `npm run verify:production-template`：通过。
- 当前本地服务：API `http://127.0.0.1:3001/api/v1/health`、Web `http://127.0.0.1:5176`、Admin `http://127.0.0.1:5177` 均可访问。

2026-05-13 最终收口复验：

- 发布页“记录给”区域已收敛为单行移动端动作卡，右侧保留 `切换孩子` 可访问入口。
- 家庭页去掉成员卡底部的后台式双按钮，邀请入口保留为顶部圆形图标，并补齐 `邀请成员` 可访问名称。
- 家庭动态改为读取真实成长记录流展示图片/视频/语音/文字，不再用静态成员占位假装动态。
- 后台通用表格按列数撑开内部表格并保留固定操作列，媒体库宽表不再强行压缩长字段。
- API 单测补齐严格环境下 `MAP_PROVIDER=amap` / `MAP_API_KEY`，JWT 配置校验用例已恢复到预期断言。
- `npm run regression:baseline`：通过。
- `npm run test:e2e`：14/14 通过。
- `npm run build:api`、`npm run build:web`、`npm run build:admin`：通过。
- `npm run verify:production-template`：通过。
- 当前本地服务：API `http://127.0.0.1:3001/api/v1/health`、Web `http://127.0.0.1:5176`、Admin `http://127.0.0.1:5177` 均可访问；健康检查显示数据库正常，短信/存储/AI/地图为本地 mock provider。

2026-05-14 专业级收口复验：

- E2E 上传记录不再使用“自动化 / mock / E2E”等测试味文案；上传用例在验证详情页、时间轴图片回显和刷新持久化后会删除临时记录，避免污染视觉截图。
- 视觉烟测新增 `expectNoTechnicalTestCopy`，首页和时间轴截图中禁止出现自动化、mock、E2E 等技术测试文案。
- `artifacts/visual-review-current/ui-reference-current-sheet.png` 已用最新首页、时间轴、发布页、家庭页和我的页截图重生成，验收材料不再残留旧测试记录。
- `npm run test:e2e`：14/14 通过，覆盖 App 登录、发布必填、文字模式隐藏上传、图片上传回显、按钮响应、子页面导航、邀请码注册语义、后台媒体/审计联动和视觉截图。
- `npm run regression:baseline`：通过。
- `npm run build:api`、`npm run build:web`、`npm run build:admin`：通过。
- `npm run verify:production-template`：通过。
- `docker compose -f deploy/docker-compose.prod.yml --env-file .env.example config --quiet`：通过。

## 仍不一致项

### 登录页

- 仓库内没有独立 Figma 登录页导出代码，本页按现有产品样式和协议勾选要求对齐。
- 《用户协议》《隐私政策》仍未链接正式合规文本，需等合规内容确认后接入。

### 首页

- 设计图使用真实头像和真实照片；当前无头像/无真实媒体时以首字头像和真实数据空态降级。
- After 截图是移动视口首屏，影像回看、进度、家庭动态在首屏下方，需要滚动查看。

### 时间轴

- 时间轴筛选已开放 `全部 / 照片 / 视频 / 文字 / 语音 / 里程碑`，并按记录类型展示视频/语音样式。

### 新增记录

- Figma 中“切换孩子”是单行动作；当前为了保留可用性，仍直接显示孩子选择和记录类型选择。
- “录制语音”入口已接入移动端音频文件选择/录制能力；浏览器是否直接打开录音器取决于设备和权限。
- 下方时间、地点、标签、发布状态字段保留现有表单能力；地点暂未接入第三方地图 POI 服务。

### 我的页

- 月报与纪念册已改为封面、统计、影像墙和记录清单结构；真实数据为空时显示空态。
- 无真实头像时使用首字头像；个人资料页和孩子资料页支持上传头像。

## 下一步

1. 若继续精修：接入真实地图 POI 服务，让地点搜索从本地候选升级为真实地理位置检索。
2. 若进入真实设备验收：在 Android/iOS 浏览器或 WebView 中验证 `capture` 是否直接打开录音器/相机。
3. 若进入正式验收：用真实对象存储、真实地图 POI、真实媒体数据和真机权限流重跑截图，替换本轮 mock 数据截图。
