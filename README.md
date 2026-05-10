# 小满人生档案馆 APP

这是一个以 `apps/api`、`apps/web`、`apps/admin` 为核心的 monorepo 项目。当前仓库包含 NestJS API、用户端 H5、管理后台、Prisma 数据模型、产品/接口/验收文档和 Figma 原型资产。

## 当前目录

- `apps/api`：NestJS 后端 API，Prisma schema 真源位于 `apps/api/prisma/schema.prisma`
- `apps/web`：用户端 Web/H5 正式工程
- `apps/admin`：管理后台正式工程
- `docs`：产品、规则、接口、权限、验收、实施计划和交付文档
- `figma`：前端原型资产和 Figma 导出代码，仅作为设计参考

## 当前交付入口

本阶段交付和继续开发请优先阅读：

- `docs/实施计划_设计对齐与验收闭环.md`
- `docs/phase0-api-inventory.md`
- `docs/实施版_回归验证基线.md`
- `docs/实施版_测试环境联调与部署手册.md`
- `docs/实施版_发布执行清单.md`
- `docs/实施版_生产部署运行手册.md`
- `docs/实施版_上线闭环检查清单.md`
- `docs/孩子的人生档案馆_prd_v_1.md`
- `docs/验收标准.md`

## 本地常用命令

在项目根目录执行：

```bash
npm run dev:api
npm run dev:web
npm run dev:admin
npm run build:api
npm run build:web
npm run build:admin
npm run typecheck:api
npm run typecheck:web
npm run typecheck:admin
npm run test:api
npm run test:web
npm run test:admin
npm run smoke:test:api
npm run prisma:generate
```

统一回归基线：

```bash
npm run regression:baseline
```

## 本地基础设施

如需接近测试环境的本地运行方式，先启动：

```bash
docker compose up -d mysql redis minio minio-init
```

默认端口：

- MySQL：`3307`
- Redis：`6379`
- MinIO API：`9000`
- MinIO Console：`9001`

`minio-init` 会创建本地上传所需的 `xiaoman-archive-local` bucket。若只启动 `minio` 而未运行初始化服务，图片上传会在对象存储 PUT 阶段返回 `NoSuchBucket`。

本地开发请复制 `.env.local.example` 为 `.env`。该模板已与 Docker 暴露端口保持一致：

```env
DATABASE_URL=mysql://xiaoman:password@localhost:3307/xiaoman_archive
```

## 环境变量

1. 本地开发复制 `.env.local.example` 为 `.env`
2. 生产或预发复制 `.env.example` 为 `.env.production`
3. 生产或预发执行 `npm run verify:production-env`
4. 至少确认以下变量可用：

- `DATABASE_URL`
- `APP_PORT`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `CORS_ORIGINS`

本地开发默认可使用 mock SMS / mock AI；共享测试和生产环境必须替换默认 secret，并按部署文档接入真实 provider。生产环境禁止 `SMS_PROVIDER=mock`、`STORAGE_PROVIDER=mock`、`AI_PROVIDER=mock`。

## 快速验证

```bash
npm run prisma:generate
npm run typecheck:api
npm run typecheck:web
npm run typecheck:admin
npm run smoke:test:api
```

生产模板校验：

```bash
npm run verify:production-template
```

用户端默认开发地址：`http://localhost:5173`

管理后台默认开发地址：`http://localhost:5174`

API 默认地址：`http://localhost:3000/api/v1`
