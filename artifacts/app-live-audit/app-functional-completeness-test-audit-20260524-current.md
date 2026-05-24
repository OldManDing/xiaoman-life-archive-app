# App 功能完善性测试验收报告 - 2026-05-24

## 结论

当前 App 的核心用户链路没有发现阻塞上线的功能缺陷。已通过 Web 单测、移动视口 E2E、Android 原生壳安装和原生 WebView 路由烟测。

从测试角度看，主要风险不在“能不能用”，而在“辅助功能是否算正式功能”：帮助反馈、隐私设置、会员纪念册申领等页面仍有本地化或占位式实现，发布前需要明确是降级展示、接后端，还是暂时隐藏入口。

## 本轮覆盖范围

| 模块 | 验收点 | 结果 |
| --- | --- | --- |
| 登录会话 | 密码登录、协议勾选、登录后进入首页 | 通过 |
| 首页 | 最近记录、快捷发布、时间轴入口、搜索入口 | 通过 |
| 时间轴 | 列表展示、筛选入口、查看和编辑记录 | 通过 |
| 发布记录 | 文本、图片、视频、语音入口、定位、标签、里程碑、必填校验 | 通过 |
| 媒体上传 | 图片上传、上传后详情和时间轴回显、删除记录 | 通过 |
| 定位 | Web 权限模拟、Android 权限授权、中文地点回填逻辑 | 通过 |
| AI 操作 | 详情页标题、摘要、标签生成入口和状态反馈 | 通过 |
| 家庭 | 家庭成员、成员详情、邀请入口、角色操作入口 | 通过 |
| 我的 | 个人资料、月报、导出、会员、安全、注销、帮助、关于 | 基础可用 |
| Android 原生壳 | 同步资源、安装 debug 包、启动、线上 API 路由访问 | 通过 |

## 已执行验证

| 命令 / 操作 | 结果 |
| --- | --- |
| `npm.cmd run typecheck:web` | 通过 |
| `npm.cmd run test:web` | 14/14 通过 |
| `npm.cmd run test:coverage -w apps/web` | 14/14 通过，总体语句覆盖率 27.89% |
| `DATABASE_URL=mysql://xiaoman:password@localhost:3317/xiaoman_archive npm.cmd run test:e2e -- e2e/app.spec.ts --project=chromium` | 9/9 通过 |
| `DATABASE_URL=mysql://xiaoman:password@localhost:3317/xiaoman_archive npx.cmd playwright test e2e/visual.spec.ts --grep "captures App key screens" --project=chromium` | 1/1 通过 |
| `npm.cmd run sync:mobile` | 通过，iOS 因本机缺少 CocoaPods/Xcode 跳过 pod install |
| `gradlew.bat installDebug` | 首次失败，原因是系统默认 Java 17 不满足 Java 21 toolchain |
| `JAVA_HOME=C:\Program Files\Android\Android Studio\jbr gradlew.bat installDebug` | 通过，已安装到 `emulator-5554` |
| Android WebView 路由烟测 | 首页、时间轴、发布、家庭、我的、隐私、安全、注销页均可访问 |

## 证据文件

- `artifacts/app-live-audit/app-native-after-wait-20260524-check.png`
- `artifacts/app-live-audit/native-function-completeness-20260524-home.png`
- `artifacts/app-live-audit/native-function-completeness-20260524-timeline.png`
- `artifacts/app-live-audit/native-function-completeness-20260524-record-create.png`
- `artifacts/app-live-audit/native-function-completeness-20260524-family.png`
- `artifacts/app-live-audit/native-function-completeness-20260524-profile.png`
- `artifacts/app-live-audit/android-ui-smoke.json`
- `artifacts/app-live-audit/android-ui-smoke-network.json`
- `artifacts/visual-review-current/app-login-mobile.png`
- `artifacts/visual-review-current/app-home-mobile.png`
- `artifacts/visual-review-current/app-record-create-mobile.png`
- `artifacts/visual-review-current/app-timeline-mobile.png`
- `artifacts/visual-review-current/app-profile-mobile.png`

## 待收口问题

### P1 帮助与反馈未形成服务端闭环

现状：`/profile/help` 提交后写入 `localStorage`，页面文案也提示“反馈已保存在本机”。这对测试来说不是完整反馈功能，因为换设备、清缓存、卸载重装后数据会丢失，后台和运营也无法看到用户反馈。

建议：上线前接入后端反馈接口和后台列表；如果暂不做，应把入口文案改成“本机备忘/联系客服”，避免用户误以为已经提交给服务方。

### P1 隐私设置是本机偏好，不是账号级设置

现状：`/profile/settings` 的“手机号搜索”“历史时间轴展示”等开关只保存到本机，不会同步到服务器，也不会影响真实权限策略。

建议：若这些设置会影响真实隐私，应接后端用户设置接口；若只是本机显示偏好，应调整文案，避免被理解为账号安全能力。

### P1 会员纪念册申领入口仍是占位反馈

现状：`/profile/membership` 的纪念册申领按钮只提示“暂未接入，请通过帮助与反馈提交申请”。这是可解释的降级，但如果作为正式会员权益展示，测试角度认为功能闭环不完整。

建议：发布前二选一：隐藏申领按钮，仅展示权益说明；或把申领动作接到后端/客服工单。

### P2 Android 构建依赖 Java 21，但系统默认 Java 是 17

现状：直接执行 `gradlew.bat installDebug` 会失败；临时设置 `JAVA_HOME=C:\Program Files\Android\Android Studio\jbr` 后通过。

建议：发布脚本或 README 明确 Android 构建必须使用 Android Studio JBR 21，或在本机/CI 固定 `JAVA_HOME`，否则下次打包容易复现失败。

### P2 自动化覆盖率偏低

现状：Web 总体语句覆盖率 27.89%，页面组件单测覆盖很低，主要靠 E2E 覆盖关键路径。当前对发布验收可接受，但后续改 UI/功能时回归风险偏高。

建议：优先补 `record-pages.tsx`、`profile-pages.tsx` 的组件/集成测试，覆盖发布校验、反馈提交、隐私设置、注销禁用态、会员申领降级态。

### P2 iOS 原生验收未完成

现状：`sync:mobile` 已复制 iOS 资源，但本机无 Xcode/CocoaPods，无法做 iOS 模拟器或真机验收。

建议：如果本轮只上 Android 可接受；如果同时上 iOS，必须补 iOS 构建、权限弹窗、相机/麦克风/定位、登录发布链路验证。

## 测试结论

可以进入 Android 上架前准备，但不建议把“反馈、隐私设置、会员申领”宣传为完整服务端能力。若目标是首版可发布，建议先把这些入口按降级能力改清楚；若目标是正式商业化发布，至少应先补齐帮助反馈和隐私设置的服务端闭环。
