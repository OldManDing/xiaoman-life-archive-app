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
  SupportTicketPriority,
  SupportTicketStatus,
  VisibilityScope,
} from '@prisma/client';
import bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createPlaceholderPhotoPng } from './placeholder-image';

const prisma = new PrismaClient();

// 演示占位图：暖色渐变 + 相机线稿。此前上传的是 1×1 像素，
// 被 object-fit: cover 拉成一块纯黑方块，比 404 兜底还难看——
// 占位图必须"看起来像一张图"。
const DEMO_MEDIA_PLACEHOLDER = createPlaceholderPhotoPng(1200, 900);
const DEMO_MEDIA_MIME = 'image/png';
const DEMO_MEDIA_EXT = 'png';

/**
 * 种子只写 recordMedia 行、不上传对象时，前端会拿到 404 的签名 URL，
 * 首页/时间轴首屏全部落到「照片暂时无法显示」占位。
 * 这里按需把占位对象补进对象存储；存储不可用时只告警，不阻断 seed。
 */
async function uploadDemoMediaObjects(objectKeys: Array<string | null | undefined>) {
  const keys = objectKeys.filter((key): key is string => Boolean(key));
  if (!keys.length) return;
  if ((process.env.STORAGE_PROVIDER ?? 'mock').toLowerCase() !== 'minio') return;

  const endpoint = process.env.STORAGE_ENDPOINT;
  const accessKeyId = process.env.STORAGE_ACCESS_KEY;
  const secretAccessKey = process.env.STORAGE_SECRET_KEY;
  const bucket = process.env.STORAGE_BUCKET ?? 'xiaoman-archive-local';
  if (!endpoint || !accessKeyId || !secretAccessKey) return;

  const client = new S3Client({
    region: process.env.STORAGE_REGION ?? 'local',
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });

  for (const key of keys) {
    try {
      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: DEMO_MEDIA_PLACEHOLDER,
        ContentType: DEMO_MEDIA_MIME,
      }));
    } catch (error) {
      console.warn(`[seed] 占位媒体上传失败（可忽略）: ${key} -> ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

const ACTIVE_STATUS = 1;
const FAMILY_MEMBER_ACTIVE_STATUS = 1;
const RECORD_PUBLISHED_STATUS = 2;
const MEDIA_READY_STATUS = 2;
const INVITE_PENDING_STATUS = 1;
const SHARE_ACTIVE_STATUS = 1;
const DEFAULT_ADMIN_PASSWORD = 'ChangeMe123!';
const DEFAULT_DEMO_USER_PASSWORD = 'DemoUser123!';
const DEMO_INVITE_CODE = 'demo-invite-001';
const FAMILY_MEMBER_OPERATION_ACTIONS = [
  'family.member_role_updated',
  'family.member_removed',
  'family.record_published',
];
const DEMO_PARENT_AVATAR_URL =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 80 80%22%3E%3Crect width=%2280%22 height=%2280%22 fill=%22%23986b55%22/%3E%3Ccircle cx=%2240%22 cy=%2230%22 r=%2217%22 fill=%22%23f0c7a7%22/%3E%3Cpath d=%22M10 80c8-24 52-24 60 0%22 fill=%22%23292524%22/%3E%3C/svg%3E';
const DEMO_CHILD_AVATAR_URL =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 80 80%22%3E%3Crect width=%2280%22 height=%2280%22 fill=%22%23b8e0d4%22/%3E%3Ccircle cx=%2240%22 cy=%2231%22 r=%2218%22 fill=%22%23f2c5a2%22/%3E%3Cpath d=%22M12 80c7-27 49-27 56 0%22 fill=%22%23fff7ed%22/%3E%3Ccircle cx=%2259%22 cy=%2219%22 r=%226%22 fill=%22%23ef7f72%22/%3E%3C/svg%3E';

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

function getDemoUserPassword(): string {
  const configured = process.env.DEMO_USER_PASSWORD?.trim();
  if (configured) {
    if (!['local', 'development', 'dev', 'test'].includes(getSeedEnvironment()) && configured === DEFAULT_DEMO_USER_PASSWORD) {
      throw new Error('DEMO_USER_PASSWORD cannot use the default value outside local/test environments');
    }

    return configured;
  }

  if (['local', 'development', 'dev', 'test'].includes(getSeedEnvironment())) {
    return DEFAULT_DEMO_USER_PASSWORD;
  }

  throw new Error('DEMO_USER_PASSWORD is required outside local/test environments');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function main() {
  const now = new Date();
  const adminPasswordHash = await bcrypt.hash(getAdminSeedPassword(), 10);
  const demoUserPasswordHash = await bcrypt.hash(getDemoUserPassword(), 10);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const nextWeek = new Date(now);
  nextWeek.setDate(now.getDate() + 7);

  const demoUser = await prisma.user.upsert({
    where: { userNo: 'u_demo_parent_001' },
    update: {
      nickname: '小满妈妈',
      avatarUrl: DEMO_PARENT_AVATAR_URL,
      mobile: '13800000000',
      email: 'parent@example.com',
      status: ACTIVE_STATUS,
      membershipType: MembershipType.free,
      lastLoginAt: now,
    },
    create: {
      userNo: 'u_demo_parent_001',
      nickname: '小满妈妈',
      avatarUrl: DEMO_PARENT_AVATAR_URL,
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
      avatarUrl: DEMO_PARENT_AVATAR_URL,
      mobile: '13900000000',
      email: 'viewer@example.com',
      status: ACTIVE_STATUS,
      membershipType: MembershipType.family_member,
    },
    create: {
      userNo: 'u_demo_viewer_001',
      nickname: '小满外婆',
      avatarUrl: DEMO_PARENT_AVATAR_URL,
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
        authType: AuthType.password,
        authKey: 'xiaoman_parent',
      },
    },
    update: {
      userId: demoUser.id,
      credentialHash: demoUserPasswordHash,
      status: ACTIVE_STATUS,
    },
    create: {
      userId: demoUser.id,
      authType: AuthType.password,
      authKey: 'xiaoman_parent',
      credentialHash: demoUserPasswordHash,
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

  await prisma.userAuthAccount.upsert({
    where: {
      authType_authKey: {
        authType: AuthType.password,
        authKey: 'xiaoman_viewer',
      },
    },
    update: {
      userId: familyViewer.id,
      credentialHash: demoUserPasswordHash,
      status: ACTIVE_STATUS,
    },
    create: {
      userId: familyViewer.id,
      authType: AuthType.password,
      authKey: 'xiaoman_viewer',
      credentialHash: demoUserPasswordHash,
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

  // 只读管理员：后台角色模型只有 super_admin / operator / viewer（见 prisma/schema.prisma）。
  // 这个账号用于验证「viewer 不应看到写操作，前端也不该把 403 留给用户去踩」，与 admin 同口令。
  await prisma.adminUser.upsert({
    where: { username: 'viewer' },
    update: {
      passwordHash: adminPasswordHash,
      displayName: '只读账号',
      role: AdminRole.viewer,
      status: ACTIVE_STATUS,
    },
    create: {
      username: 'viewer',
      passwordHash: adminPasswordHash,
      displayName: '只读账号',
      role: AdminRole.viewer,
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
      avatarUrl: DEMO_CHILD_AVATAR_URL,
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
      avatarUrl: DEMO_CHILD_AVATAR_URL,
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
    // update 里也要写对象键/mime/尺寸，否则老库里的 .jpg 旧行不会收敛到新占位图
    update: {
      recordId: firstRecord.id,
      childId: child.id,
      objectKey: `families/f_demo_001/children/c_demo_xiaoman_001/2026/04/m_demo_001.${DEMO_MEDIA_EXT}`,
      thumbnailObjectKey: `families/f_demo_001/children/c_demo_xiaoman_001/2026/04/thumb_m_demo_001.${DEMO_MEDIA_EXT}`,
      mimeType: DEMO_MEDIA_MIME,
      sizeBytes: BigInt(DEMO_MEDIA_PLACEHOLDER.length),
      width: 1200,
      height: 900,
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
      objectKey: `families/f_demo_001/children/c_demo_xiaoman_001/2026/04/m_demo_001.${DEMO_MEDIA_EXT}`,
      originalName: `第一次自己吃饭.${DEMO_MEDIA_EXT}`,
      mimeType: DEMO_MEDIA_MIME,
      sizeBytes: BigInt(DEMO_MEDIA_PLACEHOLDER.length),
      width: 1200,
      height: 900,
      thumbnailObjectKey: `families/f_demo_001/children/c_demo_xiaoman_001/2026/04/thumb_m_demo_001.${DEMO_MEDIA_EXT}`,
      status: MEDIA_READY_STATUS,
    },
  });

  await uploadDemoMediaObjects([media.objectKey, media.thumbnailObjectKey]);

  const orphanMedia = await prisma.recordMedia.upsert({
    where: { mediaNo: 'm_demo_orphan_upload_001' },
    update: {
      recordId: null,
      familyId: family.id,
      childId: child.id,
      uploaderUserId: demoUser.id,
      objectKey: `families/f_demo_001/children/c_demo_xiaoman_001/2026/04/m_demo_orphan_upload_001.${DEMO_MEDIA_EXT}`,
      mimeType: DEMO_MEDIA_MIME,
      sizeBytes: BigInt(DEMO_MEDIA_PLACEHOLDER.length),
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
      objectKey: `families/f_demo_001/children/c_demo_xiaoman_001/2026/04/m_demo_orphan_upload_001.${DEMO_MEDIA_EXT}`,
      originalName: `待确认照片.${DEMO_MEDIA_EXT}`,
      mimeType: DEMO_MEDIA_MIME,
      sizeBytes: BigInt(DEMO_MEDIA_PLACEHOLDER.length),
      status: 1,
    },
  });

  await uploadDemoMediaObjects([orphanMedia.objectKey, orphanMedia.thumbnailObjectKey]);

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

  await prisma.auditLog.deleteMany({
    where: {
      targetType: 'family',
      targetId: family.id,
      action: { in: FAMILY_MEMBER_OPERATION_ACTIONS },
    },
  });

  await prisma.auditLog.createMany({
    data: [
      {
        actorType: ActorType.user,
        actorId: demoUser.id,
        action: 'family.record_published',
        targetType: 'family',
        targetId: family.id,
        ipAddress: '127.0.0.1',
        userAgent: 'prisma-seed',
        metadata: {
          family_no: family.familyNo,
          child_no: child.childNo,
          child_name: child.name,
          record_no: secondRecord.recordNo,
          record_title: secondRecord.title,
          event_time: secondRecord.eventTime.toISOString(),
          target_user_no: demoUser.userNo,
          target_nickname: demoUser.nickname,
          operator_user_id: demoUser.id.toString(),
        },
        createdAt: now,
      },
      {
        actorType: ActorType.user,
        actorId: demoUser.id,
        action: 'family.record_published',
        targetType: 'family',
        targetId: family.id,
        ipAddress: '127.0.0.1',
        userAgent: 'prisma-seed',
        metadata: {
          family_no: family.familyNo,
          child_no: child.childNo,
          child_name: child.name,
          record_no: firstRecord.recordNo,
          record_title: firstRecord.title,
          event_time: firstRecord.eventTime.toISOString(),
          target_user_no: demoUser.userNo,
          target_nickname: demoUser.nickname,
          operator_user_id: demoUser.id.toString(),
        },
        createdAt: yesterday,
      },
    ],
  });

  await prisma.memberInvite.upsert({
    where: { inviteNo: 'inv_demo_001' },
    update: {
      familyId: family.id,
      inviterUserId: demoUser.id,
      inviteeMobile: null,
      inviteeUserId: null,
      role: FamilyMemberRole.viewer,
      tokenHash: hashToken(DEMO_INVITE_CODE),
      status: INVITE_PENDING_STATUS,
      expiresAt: nextWeek,
      acceptedAt: null,
    },
    create: {
      inviteNo: 'inv_demo_001',
      familyId: family.id,
      inviterUserId: demoUser.id,
      inviteeMobile: null,
      role: FamilyMemberRole.viewer,
      tokenHash: hashToken(DEMO_INVITE_CODE),
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

  await prisma.supportTicket.upsert({
    where: { ticketNo: 'fb_demo_001' },
    update: {
      userId: demoUser.id,
      category: '数据异常',
      topic: 'account-delete',
      content: '演示用户申请注销账号，并确认孩子档案和媒体资料的后续处理方式。',
      contact: '13800000000',
      status: SupportTicketStatus.submitted,
      priority: SupportTicketPriority.child_safety,
      assignedAdminId: null,
      handledAt: null,
      handleNote: null,
    },
    create: {
      ticketNo: 'fb_demo_001',
      userId: demoUser.id,
      category: '数据异常',
      topic: 'account-delete',
      content: '演示用户申请注销账号，并确认孩子档案和媒体资料的后续处理方式。',
      contact: '13800000000',
      status: SupportTicketStatus.submitted,
      priority: SupportTicketPriority.child_safety,
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
