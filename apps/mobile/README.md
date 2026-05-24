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

## 上架前最少检查

- iOS: 账户删除页 `profile/account-delete` 可访问并可完成删除
- Android / iOS: 登录、创建记录、上传图片、家庭邀请、注销账号
- 域名与 API 使用正式 HTTPS：`https://nianlun.xmlga.top` / `https://webapi.xmlga.top`
- 隐私政策、儿童信息保护规则、用户协议与应用市场材料一致
