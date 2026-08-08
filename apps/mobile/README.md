# 原生 App 壳

这个目录承载 `年轮` 的 Capacitor 原生壳，用来把 `apps/web` 构建产物同步到 Android / iOS 工程。

## 本地初始化

```bash
npm install
npm run add:android -w apps/mobile
npm run add:ios -w apps/mobile
```

## 同步最新前端

```bash
npm run build:web
npm run build:mobile -w apps/mobile
npm run sync:mobile
```

Android 同步脚本会从 `apps/mobile/native/android` 恢复 HMS Push Kit 原生桥接。首次构建前，将 AppGallery Connect 下载的 `agconnect-services.json` 放到 `apps/mobile/android/app/`；该文件与签名配置不会提交到 Git。服务端推送所需的 App Secret 只能配置在 API 环境变量中，不能放进 App 包。

## 上架前最少检查

- iOS: 账户删除页 `profile/account-delete` 可访问并可完成删除
- Android / iOS: 登录、创建记录、上传图片、家庭邀请、注销账号
- Huawei Android: HMS Token 注册、后台系统通知、通知点击跳记录详情、退出账号后 Token 解绑
- 域名与 API 使用正式 HTTPS：`https://nianlun.xmlga.top` / `https://webapi.xmlga.top`
- 隐私政策、儿童信息保护规则、用户协议与应用市场材料一致
