// 清理 E2E / 联调在本地库里留下的测试数据，让后台列表恢复成可演示的状态。
//
//   node scripts/e2e-cleanup-data.cjs            # 预演：只打印将要处理的数量
//   node scripts/e2e-cleanup-data.cjs --apply    # 真正执行
//
// 判定标记（都很保守，宁可少删）：
//   1) 用户：nickname 以 standalone_ 开头 —— E2E 注册流程生成的账号，不拥有任何家庭/孩子/记录，做软删除
//   2) 客服反馈：content 以 "E2E " 开头
//   3) 档案交付申请：演示家长（u_demo_parent_001）发起的申请 —— E2E 每次运行都会造一条
//   4) 邀请码：未绑定手机号且未被使用的注册邀请码 —— E2E 生成后不会使用
// 审计日志一律保留（它是只追加的留痕，不属于"污染"）。
const { PrismaClient } = require('@prisma/client');

const { apiEnv } = require('./e2e-env.cjs');

const apply = process.argv.includes('--apply');
const prisma = new PrismaClient({ datasources: { db: { url: apiEnv.DATABASE_URL } } });

const report = (label, count) => console.log(`${apply ? '已处理' : '将处理'} ${String(count).padStart(5)} 条  ${label}`);

(async () => {
  console.log(`数据库：${apiEnv.DATABASE_URL.replace(/:[^:@/]+@/, ':***@')}`);
  console.log(apply ? '模式：执行（--apply）' : '模式：预演（加 --apply 才会真正执行）');
  console.log('');

  const standaloneUsers = await prisma.user.findMany({
    where: { nickname: { startsWith: 'standalone_' }, deletedAt: null },
    select: { id: true },
  });
  report('测试用户（standalone_* 昵称，软删除）', standaloneUsers.length);

  const e2eTickets = await prisma.supportTicket.findMany({
    where: { content: { startsWith: 'E2E ' } },
    select: { id: true },
  });
  report('E2E 客服反馈', e2eTickets.length);

  const demoHandoffs = await prisma.archiveExportRequest.findMany({
    where: { user: { userNo: 'u_demo_parent_001' } },
    select: { id: true },
  });
  report('演示家长的档案交付申请', demoHandoffs.length);

  const staleInvites = await prisma.registrationInvite.findMany({
    where: { acceptedAt: null, inviteeMobile: null },
    select: { id: true },
  });
  report('未绑定手机号且未使用的邀请码', staleInvites.length);

  if (!apply) {
    const auditCount = await prisma.auditLog.count();
    console.log('');
    console.log(`审计日志保留：${auditCount} 条`);
    console.log('预演结束，未改动任何数据。');
    return;
  }

  const [users, tickets, handoffs, invites] = await prisma.$transaction([
    prisma.user.updateMany({
      where: { id: { in: standaloneUsers.map((item) => item.id) } },
      data: { deletedAt: new Date() },
    }),
    prisma.supportTicket.deleteMany({ where: { id: { in: e2eTickets.map((item) => item.id) } } }),
    prisma.archiveExportRequest.deleteMany({ where: { id: { in: demoHandoffs.map((item) => item.id) } } }),
    prisma.registrationInvite.deleteMany({ where: { id: { in: staleInvites.map((item) => item.id) } } }),
  ]);

  console.log('');
  console.log(`实际处理：用户 ${users.count} / 客服反馈 ${tickets.count} / 档案交付 ${handoffs.count} / 邀请码 ${invites.count}`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
