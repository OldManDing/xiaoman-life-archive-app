# Prisma 目录说明

## 当前唯一操作真源

当前项目的 Prisma **唯一操作真源**为：

```text
apps/api/prisma/schema.prisma
```

所有实际执行命令均应基于该文件，包括：

- `npm run prisma:generate`
- `npm run prisma:dbpush`
- `npm run prisma:seed`

这些命令最终都会走 `apps/api` 工作区脚本。

---

## 根目录 prisma/ 的角色

当前根目录 `prisma/` 仅保留以下用途：

1. `seed.ts`：本地开发 / 联调使用的 seed 脚本入口。
2. Prisma 相关的辅助资料与说明。

这里**不再保存可执行 schema 真源副本**，避免出现双 schema 漂移、误修改、误执行问题。

---

## 后续规则

1. 任何数据模型改动，必须修改 `apps/api/prisma/schema.prisma`。
2. 不应在根目录 `prisma/` 下重新创建第二份业务 schema。
3. 若未来需要重新调整 Prisma 目录结构，应先更新：
   - `README.md`
   - `docs/phase0-baseline-decisions.md`
   - `docs/实施版_当前开发任务计划.md`
   - 本文件

在文档未更新前，不应改变当前真源约定。
