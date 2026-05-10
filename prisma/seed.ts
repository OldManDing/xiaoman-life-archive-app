import {
  ActorType,
  AdminRole,
  AiJobStatus,
  AiJobType,
  AuthType,
  ChildGender,
  FamilyMemberRole,
  MediaType,
  MembershipType,
  PrismaClient,
  RecordAiStatus,
  RecordTagSource,
  RecordType,
  ShareTargetType,
  VisibilityScope,
} from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const ACTIVE_STATUS = 1;
const FAMILY_MEMBER_ACTIVE_STATUS = 1;
const RECORD_PUBLISHED_STATUS = 2;
const MEDIA_READY_STATUS = 2;
const INVITE_PENDING_STATUS = 1;
const SHARE_ACTIVE_STATUS = 1;
const DEFAULT_ADMIN_PASSWORD = 'ChangeMe123!';

function getSeedEnvironment(): string {
  return (process.env.APP_ENV ?? process.env.NODE_ENV ?? 'local').toLowerCase();
}

function getAdminSeedPassword(): string {
  const configured = process.env.ADMIN_INITIAL_PASSWORD?.trim();
  if (configured) {
    if (!['local', 'development', 'dev', 'test'].includes(getSeedEnvironment()) && configured === DEFAULT_ADMIN_PASSWORD) {
      throw new Error('ADMIN_INITIAL_PASSWORD cannot use the default value outside local/test environments');
    }

    return configured;
  }

  if (['local', 'development', 'dev', 'test'].includes(getSeedEnvironment())) {
    return DEFAULT_ADMIN_PASSWORD;
  }

  throw new Error('ADMIN_INITIAL_PASSWORD is required outside local/test environments');
}

async function main() {
  const now = new Date();
  const adminPasswordHash = await bcrypt.hash(getAdminSeedPassword(), 10);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const nextWeek = new Date(now);
  nextWeek.setDate(now.getDate() + 7);

  const demoUser = await prisma.user.upsert({
    where: { userNo: 'u_demo_parent_001' },
    update: {
      nickname: '小满妈妈',
      avatarUrl: null,
      mobile: '13800000000',
      email: 'parent@example.com',
      status: ACTIVE_STATUS,
      membershipType: MembershipType.free,
      lastLoginAt: now,
    },
    create: {
      userNo: 'u_demo_parent_001',
      nickname: '小满妈妈',
      avatarUrl: null,
      mobile: '13800000000',
      email: 'parent@example.com',
      status: ACTIVE_STATUS,
      membershipType: MembershipType.free,
      lastLoginAt: now,
    },
  });

  const familyViewer = await prisma.user.upsert({
    where: { userNo: 'u_demo_viewer_001' },
    update: {
      nickname: '小满外婆',
      avatarUrl: null,
      mobile: '13900000000',
      email: 'viewer@example.com',
      status: ACTIVE_STATUS,
      membershipType: MembershipType.family_member,
    },
    create: {
      userNo: 'u_demo_viewer_001',
      nickname: '小满外婆',
      avatarUrl: null,
      mobile: '13900000000',
      email: 'viewer@example.com',
      status: ACTIVE_STATUS,
      membershipType: MembershipType.family_member,
    },
  });

  await prisma.userAuthAccount.upsert({
    where: {
      authType_authKey: {
        authType: AuthType.mobile,
        authKey: '13800000000',
      },
    },
    update: {
      userId: demoUser.id,
      status: ACTIVE_STATUS,
    },
    create: {
      userId: demoUser.id,
      authType: AuthType.mobile,
      authKey: '13800000000',
      status: ACTIVE_STATUS,
    },
  });

  await prisma.userAuthAccount.upsert({
    where: {
      authType_authKey: {
        authType: AuthType.mobile,
        authKey: '13900000000',
      },
    },
    update: {
      userId: familyViewer.id,
      status: ACTIVE_STATUS,
    },
    create: {
      userId: familyViewer.id,
      authType: AuthType.mobile,
      authKey: '13900000000',
      status: ACTIVE_STATUS,
    },
  });

  const admin = await prisma.adminUser.upsert({
    where: { username: 'admin' },
    update: {
      passwordHash: adminPasswordHash,
      displayName: '系统管理员',
      role: AdminRole.super_admin,
      status: ACTIVE_STATUS,
    },
    create: {
      username: 'admin',
      passwordHash: adminPasswordHash,
      displayName: '系统管理员',
      role: AdminRole.super_admin,
      status: ACTIVE_STATUS,
    },
  });

  const family = await prisma.family.upsert({
    where: { familyNo: 'f_demo_001' },
    update: {
      ownerUserId: demoUser.id,
      name: '小满成长家庭',
      status: ACTIVE_STATUS,
    },
    create: {
      familyNo: 'f_demo_001',
      ownerUserId: demoUser.id,
      name: '小满成长家庭',
      status: ACTIVE_STATUS,
    },
  });

  await prisma.familyMember.upsert({
    where: {
      familyId_userId: {
        familyId: family.id,
        userId: demoUser.id,
      },
    },
    update: {
      role: FamilyMemberRole.owner,
      status: FAMILY_MEMBER_ACTIVE_STATUS,
      joinedAt: now,
    },
    create: {
      familyId: family.id,
      userId: demoUser.id,
      role: FamilyMemberRole.owner,
      status: FAMILY_MEMBER_ACTIVE_STATUS,
      joinedAt: now,
    },
  });

  await prisma.familyMember.upsert({
    where: {
      familyId_userId: {
        familyId: family.id,
        userId: familyViewer.id,
      },
    },
    update: {
      role: FamilyMemberRole.viewer,
      status: FAMILY_MEMBER_ACTIVE_STATUS,
      inviterUserId: demoUser.id,
      joinedAt: now,
    },
    create: {
      familyId: family.id,
      userId: familyViewer.id,
      role: FamilyMemberRole.viewer,
      status: FAMILY_MEMBER_ACTIVE_STATUS,
      inviterUserId: demoUser.id,
      joinedAt: now,
    },
  });

  const child = await prisma.child.upsert({
    where: { childNo: 'c_demo_xiaoman_001' },
    update: {
      familyId: family.id,
      ownerUserId: demoUser.id,
      name: '小满',
      avatarUrl: null,
      birthday: new Date('2025-01-01T00:00:00.000Z'),
      gender: ChildGender.female,
      birthPlace: '上海',
      remark: '本地开发与联调使用的演示孩子档案。',
      status: ACTIVE_STATUS,
    },
    create: {
      childNo: 'c_demo_xiaoman_001',
      familyId: family.id,
      ownerUserId: demoUser.id,
      name: '小满',
      avatarUrl: null,
      birthday: new Date('2025-01-01T00:00:00.000Z'),
      gender: ChildGender.female,
      birthPlace: '上海',
      remark: '本地开发与联调使用的演示孩子档案。',
      status: ACTIVE_STATUS,
    },
  });

  const fixedDemoRecordNos = ['r_demo_001', 'r_demo_002'];
  const fixedDemoMediaNos = ['m_demo_001', 'm_demo_orphan_upload_001'];

  const staleDemoRecords = await prisma.record.findMany({
    where: {
      familyId: family.id,
      childId: child.id,
      recordNo: { notIn: fixedDemoRecordNos },
    },
    select: { id: true },
  });
  const staleDemoRecordIds = staleDemoRecords.map((record) => record.id);

  if (staleDemoRecordIds.length) {
    await prisma.aiJob.deleteMany({
      where: { recordId: { in: staleDemoRecordIds } },
    });
    await prisma.recordTag.deleteMany({
      where: { recordId: { in: staleDemoRecordIds } },
    });
    await prisma.recordMedia.deleteMany({
      where: { recordId: { in: staleDemoRecordIds } },
    });
    await prisma.record.deleteMany({
      where: { id: { in: staleDemoRecordIds } },
    });
  }

  await prisma.recordMedia.deleteMany({
    where: {
      familyId: family.id,
      childId: child.id,
      mediaNo: { notIn: fixedDemoMediaNos },
    },
  });

  await prisma.aiJob.deleteMany({
    where: {
      familyId: family.id,
      jobNo: { notIn: ['job_demo_001'] },
    },
  });

  const firstRecord = await prisma.record.upsert({
    where: { recordNo: 'r_demo_001' },
    update: {
      childId: child.id,
      familyId: family.id,
      creatorUserId: demoUser.id,
      recordType: RecordType.mixed,
      title: '第一次自己吃饭',
      contentText: '小满第一次尝试用勺子自己吃饭，虽然洒了一点，但看起来特别自豪。',
      locationText: '家里',
      visibilityScope: VisibilityScope.family,
      isMilestone: true,
      aiGeneratedTitle: '第一次自己吃饭',
      aiSummary: '小满开始尝试独立吃饭，这是值得记录的成长瞬间。',
      aiStatus: RecordAiStatus.success,
      status: RECORD_PUBLISHED_STATUS,
      publishedAt: yesterday,
    },
    create: {
      recordNo: 'r_demo_001',
      childId: child.id,
      familyId: family.id,
      creatorUserId: demoUser.id,
      recordType: RecordType.mixed,
      title: '第一次自己吃饭',
      contentText: '小满第一次尝试用勺子自己吃饭，虽然洒了一点，但看起来特别自豪。',
      eventTime: yesterday,
      locationText: '家里',
      visibilityScope: VisibilityScope.family,
      isMilestone: true,
      aiGeneratedTitle: '第一次自己吃饭',
      aiSummary: '小满开始尝试独立吃饭，这是值得记录的成长瞬间。',
      aiStatus: RecordAiStatus.success,
      status: RECORD_PUBLISHED_STATUS,
      publishedAt: yesterday,
    },
  });

  const secondRecord = await prisma.record.upsert({
    where: { recordNo: 'r_demo_002' },
    update: {
      childId: child.id,
      familyId: family.id,
      creatorUserId: demoUser.id,
      recordType: RecordType.text,
      title: '学会说谢谢',
      contentText: '今天小满把玩具递给家人时主动说了谢谢，大家都很惊喜。',
      locationText: '客厅',
      visibilityScope: VisibilityScope.family,
      isMilestone: false,
      aiStatus: RecordAiStatus.pending,
      status: RECORD_PUBLISHED_STATUS,
      publishedAt: now,
    },
    create: {
      recordNo: 'r_demo_002',
      childId: child.id,
      familyId: family.id,
      creatorUserId: demoUser.id,
      recordType: RecordType.text,
      title: '学会说谢谢',
      contentText: '今天小满把玩具递给家人时主动说了谢谢，大家都很惊喜。',
      eventTime: now,
      locationText: '客厅',
      visibilityScope: VisibilityScope.family,
      isMilestone: false,
      aiStatus: RecordAiStatus.pending,
      status: RECORD_PUBLISHED_STATUS,
      publishedAt: now,
    },
  });

  const media = await prisma.recordMedia.upsert({
    where: { mediaNo: 'm_demo_001' },
    update: {
      recordId: firstRecord.id,
      childId: child.id,
      status: MEDIA_READY_STATUS,
    },
    create: {
      mediaNo: 'm_demo_001',
      recordId: firstRecord.id,
      familyId: family.id,
      childId: child.id,
      uploaderUserId: demoUser.id,
      mediaType: MediaType.image,
      storageProvider: 'mock',
      bucket: 'xiaoman-archive-local',
      objectKey: 'families/f_demo_001/children/c_demo_xiaoman_001/2026/04/m_demo_001.jpg',
      originalName: '第一次自己吃饭.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: BigInt(512000),
      width: 1200,
      height: 900,
      thumbnailObjectKey: 'families/f_demo_001/children/c_demo_xiaoman_001/2026/04/thumb_m_demo_001.jpg',
      status: MEDIA_READY_STATUS,
    },
  });

  await prisma.recordMedia.upsert({
    where: { mediaNo: 'm_demo_orphan_upload_001' },
    update: {
      recordId: null,
      familyId: family.id,
      childId: child.id,
      uploaderUserId: demoUser.id,
      status: 1,
    },
    create: {
      mediaNo: 'm_demo_orphan_upload_001',
      recordId: null,
      familyId: family.id,
      childId: child.id,
      uploaderUserId: demoUser.id,
      mediaType: MediaType.image,
      storageProvider: 'mock',
      bucket: 'xiaoman-archive-local',
      objectKey: 'families/f_demo_001/children/c_demo_xiaoman_001/2026/04/m_demo_orphan_upload_001.jpg',
      originalName: '待确认照片.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: BigInt(256000),
      status: 1,
    },
  });

  await prisma.recordTag.upsert({
    where: {
      recordId_tagName_source: {
        recordId: firstRecord.id,
        tagName: '第一次',
        source: RecordTagSource.user,
      },
    },
    update: {},
    create: {
      recordId: firstRecord.id,
      tagName: '第一次',
      source: RecordTagSource.user,
    },
  });

  await prisma.recordTag.upsert({
    where: {
      recordId_tagName_source: {
        recordId: firstRecord.id,
        tagName: '吃饭',
        source: RecordTagSource.ai,
      },
    },
    update: {},
    create: {
      recordId: firstRecord.id,
      tagName: '吃饭',
      source: RecordTagSource.ai,
    },
  });

  await prisma.recordTag.upsert({
    where: {
      recordId_tagName_source: {
        recordId: secondRecord.id,
        tagName: '语言',
        source: RecordTagSource.user,
      },
    },
    update: {},
    create: {
      recordId: secondRecord.id,
      tagName: '语言',
      source: RecordTagSource.user,
    },
  });

  await prisma.memberInvite.upsert({
    where: { inviteNo: 'inv_demo_001' },
    update: {
      familyId: family.id,
      inviterUserId: demoUser.id,
      inviteeMobile: '13700000000',
      inviteeUserId: null,
      role: FamilyMemberRole.viewer,
      tokenHash: 'demo_invite_token_hash_001',
      status: INVITE_PENDING_STATUS,
      expiresAt: nextWeek,
      acceptedAt: null,
    },
    create: {
      inviteNo: 'inv_demo_001',
      familyId: family.id,
      inviterUserId: demoUser.id,
      inviteeMobile: '13700000000',
      role: FamilyMemberRole.viewer,
      tokenHash: 'demo_invite_token_hash_001',
      status: INVITE_PENDING_STATUS,
      expiresAt: nextWeek,
    },
  });

  await prisma.shareLink.upsert({
    where: { shareNo: 's_demo_001' },
    update: {
      familyId: family.id,
      creatorUserId: demoUser.id,
      targetType: ShareTargetType.record,
      targetId: firstRecord.id,
      tokenHash: 'demo_share_token_hash_001',
      expiresAt: nextWeek,
      status: SHARE_ACTIVE_STATUS,
    },
    create: {
      shareNo: 's_demo_001',
      familyId: family.id,
      creatorUserId: demoUser.id,
      targetType: ShareTargetType.record,
      targetId: firstRecord.id,
      tokenHash: 'demo_share_token_hash_001',
      expiresAt: nextWeek,
      status: SHARE_ACTIVE_STATUS,
    },
  });

  await prisma.aiJob.upsert({
    where: { jobNo: 'job_demo_001' },
    update: {
      familyId: family.id,
      recordId: firstRecord.id,
      requesterUserId: demoUser.id,
      jobType: AiJobType.record_summary,
      provider: 'mock',
      status: AiJobStatus.success,
      retryCount: 0,
      startedAt: yesterday,
      finishedAt: yesterday,
    },
    create: {
      jobNo: 'job_demo_001',
      familyId: family.id,
      recordId: firstRecord.id,
      requesterUserId: demoUser.id,
      jobType: AiJobType.record_summary,
      provider: 'mock',
      status: AiJobStatus.success,
      inputSnapshot: {
        record_no: firstRecord.recordNo,
        content_text: firstRecord.contentText,
        child_age_display: '1岁3月',
      },
      outputJson: {
        suggested_title: '第一次自己吃饭',
        summary: '小满开始尝试独立吃饭，这是值得记录的成长瞬间。',
        tags: ['第一次', '吃饭', '成长'],
      },
      retryCount: 0,
      startedAt: yesterday,
      finishedAt: yesterday,
    },
  });

  const existingSeedAuditLog = await prisma.auditLog.findFirst({
    where: {
      actorType: ActorType.admin,
      actorId: admin.id,
      action: 'seed.initialized',
      targetType: 'family',
      targetId: family.id,
    },
  });

  if (!existingSeedAuditLog) {
    await prisma.auditLog.create({
      data: {
        actorType: ActorType.admin,
        actorId: admin.id,
        action: 'seed.initialized',
        targetType: 'family',
        targetId: family.id,
        ipAddress: '127.0.0.1',
        userAgent: 'prisma-seed',
        metadata: {
          user_no: demoUser.userNo,
          family_no: family.familyNo,
          child_no: child.childNo,
          media_no: media.mediaNo,
        },
      },
    });
  }

  console.info('Seed completed:', {
    admin: admin.username,
    user: demoUser.userNo,
    family: family.familyNo,
    child: child.childNo,
    records: [firstRecord.recordNo, secondRecord.recordNo],
  });
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
