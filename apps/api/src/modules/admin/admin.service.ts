import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { ActorType, AdminRole, AiJobStatus, ArchiveExportRequestStatus, AuthType, MediaType, MembershipType, Prisma, SupportTicketPriority, SupportTicketStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Request } from 'express';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

import { AiJobsQueue } from '../ai-jobs/ai-jobs.queue';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { RuntimeAiConfig, RuntimeConfigService } from '../../shared/services/runtime-config.service';
import { StorageService } from '../../shared/services/storage.service';
import { decryptSystemConfigSecret, encryptSystemConfigSecret } from '../../shared/system-config-secret';
import {
  getMobileApkUrl,
  getMobileForceUpdate,
  getMobileLatestBuildNumber,
  getMobileLatestVersion,
  getMobileReleaseNotes,
  getAdminInitialPassword,
  getAdminInitialUsername,
  getAdminJwtAccessExpiresIn,
  getAdminJwtAccessSecret,
  getAiProviderName,
  getAlertContactChannel,
  getAlertContactName,
  getAppEnv,
  getAppPort,
  getAuthRateLimitMaxAttempts,
  getBackupRestoreDrillAt,
  getBackupRetentionDays,
  getBackupRunbookUrl,
  getMapProviderName,
  getSmsProviderName,
  getStorageProviderName,
  isAdminBootstrapAllowed,
  isSecureCookieEnvironment,
  isSmsEnabled,
  isStrictEnvironment,
  resolveCorsOrigins,
} from '../../shared/env-config';
import { AuthenticatedAdmin } from '../../shared/types';
import {
  ADMIN_ACTIVE_STATUS,
  MEDIA_STATUS_FAILED,
  MEDIA_STATUS_READY,
  MEDIA_STATUS_REMOVED,
  MEDIA_STATUS_UPLOADING,
  MEMBER_INVITE_STATUS_ACCEPTED,
  MEMBER_INVITE_STATUS_PENDING,
  MEMBER_INVITE_STATUS_REVOKED,
  RECORD_STATUS_DRAFT,
  RECORD_STATUS_PUBLISHED,
  USER_ACTIVE_STATUS,
} from '../../shared/constants';
import { ageDisplay, generateBizNo, generateSecureToken, hashToken, normalizePage, normalizePageSize, parseDurationToSeconds, statusToChildLabel, statusToRecordLabel, toDateOnly } from '../../shared/utils';
import { parseMediaReference } from '../../shared/media-reference';
import { AdminAiJobActionDto } from './dto/admin-ai-job-action.dto';
import { AdminArchiveExportRequestListDto } from './dto/admin-archive-export-request-list.dto';
import { AdminContentRiskListDto } from './dto/admin-content-risk-list.dto';
import { AdminChangePasswordDto } from './dto/admin-change-password.dto';
import { AdminCreateInviteDto } from './dto/admin-create-invite.dto';
import { AdminListDto, AdminRecordListDto } from './dto/admin-list.dto';
import { AdminAuditLogListDto } from './dto/admin-audit-log-list.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminMediaListDto } from './dto/admin-media-list.dto';
import { AdminNotificationListDto } from './dto/admin-notification-list.dto';
import { AdminResetUserPasswordDto } from './dto/admin-reset-user-password.dto';
import { AdminSupportTicketListDto } from './dto/admin-support-ticket-list.dto';
import { AdminUpdateArchiveExportRequestStatusDto } from './dto/admin-update-archive-export-request-status.dto';
import { AdminUpdateMediaStatusDto } from './dto/admin-update-media-status.dto';
import { AdminUpdateSystemConfigDto } from './dto/admin-update-system-config.dto';
import { AdminUpdateAiSettingsDto } from './dto/admin-update-ai-settings.dto';
import { AdminUpdateUserMembershipDto } from './dto/admin-update-user-membership.dto';
import { AdminUpdateRecordStatusDto } from './dto/admin-update-record-status.dto';
import { AdminUpdateSupportTicketStatusDto } from './dto/admin-update-support-ticket-status.dto';
import { AdminUpdateUserStatusDto } from './dto/admin-update-user-status.dto';

const USER_DISABLED_STATUS = 2;
const DEFAULT_ACCESS_TOKEN_EXPIRES_IN = '2h';
const DEFAULT_REGISTRATION_INVITE_EXPIRES_IN_HOURS = 168;
const AI_SETTING_KEYS = ['ai_provider', 'ai_base_url', 'ai_model', 'ai_api_key', 'ai_timeout_ms', 'ai_daily_limit_per_user'] as const;
const DEFAULT_LIVE_READINESS_REPORT_PATH = 'artifacts/app-live-audit/live-readiness-latest.json';
const MAX_LIVE_READINESS_REPORT_AGE_HOURS = 24;
type OpsReadinessStatus = 'ready' | 'warning' | 'blocked';
type LiveReadinessReportStatus = 'passed' | 'conditional_pass' | 'failed' | 'missing' | 'invalid' | 'stale';
type LiveReadinessProviderKey = 'ai' | 'map';
type LiveReadinessRequirementSeverity = 'P0' | 'P1' | 'P2';
type ContentRiskCategory = 'content_safety' | 'media_exception' | 'child_safety' | 'ai_exception';
type ContentRiskSeverity = 'p0' | 'p1' | 'p2';
type ContentRiskStatus = 'open' | 'processing' | 'resolved';
type LiveReadinessProviderEvidence = {
  providerKey: LiveReadinessProviderKey;
  currentProvider: string;
  label: string;
};
type LiveReadinessReportCheck = {
  name: string;
  status: 'passed' | 'failed';
  error?: string;
};
type LiveReadinessRequirementDetail = {
  requirement: string;
  severity: LiveReadinessRequirementSeverity;
  owner: string;
  evidence: string;
  next_action: string;
};
type LiveReadinessReportEvidence = {
  path: string;
  status: LiveReadinessReportStatus;
  checked_at: string | null;
  age_hours: number | null;
  providers: Record<string, string> | null;
  checks: LiveReadinessReportCheck[];
  failures: Array<{ name: string; error: string }>;
  blocked_requirements: string[];
  blocked_requirement_details: LiveReadinessRequirementDetail[];
  next_actions: string[];
};
type AdminContentRiskItem = {
  risk_no: string;
  category: ContentRiskCategory;
  severity: ContentRiskSeverity;
  status: ContentRiskStatus;
  title: string;
  subject_no: string | null;
  subject_name: string | null;
  source_type: 'record' | 'media' | 'support_ticket' | 'ai_job';
  source_no: string;
  source_status: string;
  reason: string;
  action_label: string;
  action_to: string;
  created_at: string;
};
type NotificationWithRelations = Prisma.UserNotificationGetPayload<{
  include: {
    user: true;
    family: true;
    actor: true;
    deliveries: true;
  };
}>;
type SystemConfigCategory = 'backup_recovery' | 'alerting' | 'ai_provider' | 'mobile_release';
type SystemConfigValueType = 'number' | 'url' | 'datetime' | 'text' | 'secret' | 'select';
type SystemConfigDefinition = {
  key: string;
  category: SystemConfigCategory;
  label: string;
  value_type: SystemConfigValueType;
  description: string;
  envValue: () => string;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
};
type SystemConfigWithUpdater = Prisma.SystemConfigGetPayload<{
  include: {
    updatedByAdmin: true;
  };
}>;
type AdminSystemConfigItem = {
  config_key: string;
  category: SystemConfigCategory;
  label: string;
  value: string;
  display_value: string;
  value_type: SystemConfigValueType;
  description: string;
  source: 'admin' | 'environment';
  options?: Array<{ value: string; label: string }>;
  secret_configured?: boolean;
  updated_by_name: string | null;
  updated_at: string | null;
};
type AdminAiSettingsTestResult = {
  status: 'success' | 'failed' | 'skipped';
  provider: string;
  model: string | null;
  base_url: string | null;
  latency_ms: number;
  checked_at: string;
  message: string;
};

const CONTENT_RISK_KEYWORDS: Array<{ keyword: string; severity: ContentRiskSeverity; reason: string }> = [
  { keyword: '虐待', severity: 'p0', reason: '疑似儿童安全或伤害内容' },
  { keyword: '自残', severity: 'p0', reason: '疑似自伤或危机内容' },
  { keyword: '暴力', severity: 'p0', reason: '疑似暴力内容' },
  { keyword: '裸露', severity: 'p0', reason: '疑似未成年人隐私风险' },
  { keyword: '身份证', severity: 'p1', reason: '可能包含敏感身份信息' },
  { keyword: '住址', severity: 'p1', reason: '可能包含家庭住址信息' },
  { keyword: '手机号', severity: 'p1', reason: '可能包含联系方式信息' },
  { keyword: '删除', severity: 'p2', reason: '可能涉及内容删除诉求' },
];

const readEnvString = (name: string) => process.env[name]?.trim() ?? '';
const plainSecretValue = (value: string) => decryptSystemConfigSecret(value).trim();
const secretDisplayValue = (value: string) => (plainSecretValue(value) ? '已配置（加密保存，不回显）' : '未配置');
const auditConfigValue = (definition: SystemConfigDefinition, value: string) =>
  definition.value_type === 'secret' ? secretDisplayValue(value) : value;

const SYSTEM_CONFIG_DEFINITIONS: SystemConfigDefinition[] = [
  {
    key: 'ai_provider',
    category: 'ai_provider',
    label: 'AI 供应商',
    value_type: 'select',
    description: '控制标题、摘要和标签生成使用的 AI provider。生产环境应使用 OpenAI 或 OpenAI 兼容服务。',
    envValue: () => getAiProviderName(),
    options: [
      { value: 'openai-compatible', label: 'OpenAI 兼容服务' },
      { value: 'openai', label: 'OpenAI 服务' },
      { value: 'mock', label: '本地模拟服务' },
    ],
  },
  {
    key: 'ai_base_url',
    category: 'ai_provider',
    label: 'AI 接口地址',
    value_type: 'url',
    description: '兼容 /chat/completions 的 API 根地址，例如 https://api.example.com/v1。',
    envValue: () => readEnvString('AI_BASE_URL'),
  },
  {
    key: 'ai_model',
    category: 'ai_provider',
    label: 'AI 模型',
    value_type: 'text',
    description: '用于成长记录标题、摘要和标签生成的模型名称。',
    envValue: () => readEnvString('AI_MODEL'),
  },
  {
    key: 'ai_api_key',
    category: 'ai_provider',
    label: 'AI API Key',
    value_type: 'secret',
    description: 'AI 服务调用密钥。后台只允许覆盖保存，不会明文回显。',
    envValue: () => readEnvString('AI_API_KEY'),
  },
  {
    key: 'ai_timeout_ms',
    category: 'ai_provider',
    label: 'AI 超时时间',
    value_type: 'number',
    description: 'AI 请求超时时间，单位毫秒。建议 5000 到 60000。',
    envValue: () => readEnvString('AI_TIMEOUT_MS') || '30000',
    min: 1000,
    max: 120000,
  },
  {
    key: 'ai_daily_limit_per_user',
    category: 'ai_provider',
    label: '单用户每日 AI 上限',
    value_type: 'number',
    description: '每个用户每天最多触发的 AI 任务数，用于控制成本和异常调用。',
    envValue: () => readEnvString('AI_DAILY_LIMIT_PER_USER') || '20',
    min: 1,
    max: 1000,
  },
  {
    key: 'mobile_latest_version',
    category: 'mobile_release',
    label: '移动端最新版本',
    value_type: 'text',
    description: '关于页和启动静默检查使用的最新版本号。',
    envValue: () => getMobileLatestVersion(),
  },
  {
    key: 'mobile_latest_build_number',
    category: 'mobile_release',
    label: '移动端最新构建号',
    value_type: 'number',
    description: '用于判断是否需要更新；构建号越大代表版本越新。',
    envValue: () => String(getMobileLatestBuildNumber()),
    min: 0,
    max: 1000000,
  },
  {
    key: 'mobile_release_notes',
    category: 'mobile_release',
    label: '移动端更新说明',
    value_type: 'text',
    description: '展示给用户的版本更新内容。',
    envValue: () => getMobileReleaseNotes(),
  },
  {
    key: 'mobile_apk_url',
    category: 'mobile_release',
    label: 'APK 下载地址',
    value_type: 'url',
    description: '安卓应用检查更新返回的 APK 下载地址。',
    envValue: () => getMobileApkUrl() ?? '',
  },
  {
    key: 'mobile_force_update',
    category: 'mobile_release',
    label: '是否强制更新',
    value_type: 'select',
    description: '开启后旧版本检查更新会要求用户升级后继续使用。',
    envValue: () => String(getMobileForceUpdate()),
    options: [
      { value: 'true', label: '强制更新' },
      { value: 'false', label: '普通更新' },
    ],
  },
  {
    key: 'backup_retention_days',
    category: 'backup_recovery',
    label: '备份保留周期',
    value_type: 'number',
    description: '生产备份至少建议保留 90 天，用于长期家庭档案恢复窗口。',
    envValue: () => String(getBackupRetentionDays()),
    min: 1,
    max: 3650,
  },
  {
    key: 'backup_runbook_url',
    category: 'backup_recovery',
    label: '恢复手册地址',
    value_type: 'url',
    description: '运营或值班人员执行数据库、媒体和应用恢复流程时使用的手册链接。',
    envValue: () => getBackupRunbookUrl() ?? '',
  },
  {
    key: 'backup_restore_drill_at',
    category: 'backup_recovery',
    label: '最近恢复演练时间',
    value_type: 'datetime',
    description: '最近一次完成备份恢复演练的时间，超过 180 天需要复核。',
    envValue: () => getBackupRestoreDrillAt() ?? '',
  },
  {
    key: 'alert_contact_name',
    category: 'alerting',
    label: '告警联系人',
    value_type: 'text',
    description: '线上异常、备份失败或 provider 门禁失败时的第一责任人。',
    envValue: () => getAlertContactName() ?? '',
  },
  {
    key: 'alert_contact_channel',
    category: 'alerting',
    label: '告警联系方式',
    value_type: 'text',
    description: '告警联系人可被联系到的电话、企业微信、飞书或值班群。',
    envValue: () => getAlertContactChannel() ?? '',
  },
];
const SYSTEM_CONFIG_KEYS = SYSTEM_CONFIG_DEFINITIONS.map((item) => item.key);

const contentRiskSeverityRank: Record<ContentRiskSeverity, number> = {
  p0: 0,
  p1: 1,
  p2: 2,
};
const liveReadinessSeverityRank: Record<LiveReadinessRequirementSeverity, number> = {
  P0: 0,
  P1: 1,
  P2: 2,
};

const contentRiskKeywordWhere: Prisma.RecordWhereInput[] = CONTENT_RISK_KEYWORDS.flatMap((item) => [
  { title: { contains: item.keyword } },
  { contentText: { contains: item.keyword } },
]);
const mediaExceptionCondition: Prisma.RecordMediaWhereInput = {
  OR: [{ status: { in: [MEDIA_STATUS_UPLOADING, MEDIA_STATUS_FAILED] } }, { recordId: null }],
};

type ArchiveExportRequestWithRelations = Prisma.ArchiveExportRequestGetPayload<{
  include: {
    user: true;
    family: true;
    child: true;
    processedByAdmin: true;
  };
}>;

type SupportTicketWithRelations = Prisma.SupportTicketGetPayload<{
  include: {
    user: true;
    assignedAdmin: true;
  };
}>;

const statusToUserLabel = (status: number): 'active' | 'disabled' => (status === USER_ACTIVE_STATUS ? 'active' : 'disabled');
const statusToFamilyLabel = (status: number, deletedAt?: Date | null): 'active' | 'disabled' | 'deleted' => {
  if (deletedAt) return 'deleted';
  return status === USER_ACTIVE_STATUS ? 'active' : 'disabled';
};
const statusToMediaLabel = (status: number): 'uploading' | 'ready' | 'failed' | 'removed' => {
  if (status === MEDIA_STATUS_READY) return 'ready';
  if (status === MEDIA_STATUS_FAILED) return 'failed';
  if (status === MEDIA_STATUS_REMOVED) return 'removed';
  return 'uploading';
};

const mediaStatusToNumber = (status: AdminUpdateMediaStatusDto['status']) => {
  if (status === 'ready') return MEDIA_STATUS_READY;
  if (status === 'removed') return MEDIA_STATUS_REMOVED;
  return MEDIA_STATUS_FAILED;
};

const mediaStatusFilterToNumber = (status: NonNullable<AdminMediaListDto['status']>) => {
  if (status === 'ready') return MEDIA_STATUS_READY;
  if (status === 'failed') return MEDIA_STATUS_FAILED;
  if (status === 'removed') return MEDIA_STATUS_REMOVED;
  return MEDIA_STATUS_UPLOADING;
};

const statusToInviteLabel = (status: number, expiresAt: Date): 'pending' | 'accepted' | 'revoked' | 'expired' => {
  if (status === MEMBER_INVITE_STATUS_ACCEPTED) return 'accepted';
  if (status === MEMBER_INVITE_STATUS_REVOKED) return 'revoked';
  if (expiresAt <= new Date()) return 'expired';
  return 'pending';
};

const createRegistrationInviteToken = () => `NL-${generateSecureToken(3).toUpperCase()}-${generateSecureToken(3).toUpperCase()}`;

const getSystemConfigDefinition = (key: string) => SYSTEM_CONFIG_DEFINITIONS.find((item) => item.key === key);

const systemConfigCategoryLabel = (category: SystemConfigCategory) => {
  if (category === 'ai_provider') return 'AI 服务';
  if (category === 'backup_recovery') return '备份恢复';
  if (category === 'mobile_release') return '版本更新';
  return '告警值班';
};

const archiveExportStatusAction = (status: AdminUpdateArchiveExportRequestStatusDto['status']) => {
  if (status === ArchiveExportRequestStatus.completed) return 'admin_archive_export_complete';
  if (status === ArchiveExportRequestStatus.rejected) return 'admin_archive_export_reject';
  return 'admin_archive_export_start_processing';
};

const supportTicketStatusAction = (status: AdminUpdateSupportTicketStatusDto['status']) => {
  if (status === SupportTicketStatus.resolved) return 'admin_support_ticket_resolve';
  if (status === SupportTicketStatus.closed) return 'admin_support_ticket_close';
  return 'admin_support_ticket_start_processing';
};

const toProviderStatus = (provider: string, options?: { disabledIsWarning?: boolean }): OpsReadinessStatus => {
  if (provider === 'mock') return isStrictEnvironment() ? 'blocked' : 'warning';
  if (provider === 'disabled') return options?.disabledIsWarning ? 'warning' : 'ready';
  return 'ready';
};

const newestStatus = (...statuses: OpsReadinessStatus[]): OpsReadinessStatus => {
  if (statuses.includes('blocked')) return 'blocked';
  if (statuses.includes('warning')) return 'warning';
  return 'ready';
};

const daysSince = (value: string | null, now: Date) => {
  if (!value) return null;
  return Math.floor((now.getTime() - new Date(value).getTime()) / 86_400_000);
};

const resolveLiveReadinessReportPath = () => {
  const configured = String(process.env.LIVE_READINESS_REPORT_PATH ?? '').trim();
  if (['0', 'false', 'off'].includes(configured.toLowerCase())) return null;
  return resolve(process.cwd(), configured || DEFAULT_LIVE_READINESS_REPORT_PATH);
};

const reportFailureSummary = (failure: { error?: string } | undefined) => {
  const value = failure?.error?.trim();
  if (!value) return null;
  return value.length > 180 ? `${value.slice(0, 180)}...` : value;
};

const blockedRequirementForLiveReadinessCheck = (checkName: string) => {
  if (checkName === 'aiPreview') return 'P0-26 AI 真实调用';
  if (checkName === 'poi') return 'P1-03 地点真实 POI';
  return null;
};

const severityFromRequirement = (requirement: string): LiveReadinessRequirementSeverity => {
  if (requirement.startsWith('P0-')) return 'P0';
  if (requirement.startsWith('P1-')) return 'P1';
  return 'P2';
};

const fallbackRequirementDetail = (requirement: string): LiveReadinessRequirementDetail => ({
  requirement,
  severity: severityFromRequirement(requirement),
  owner: requirement.startsWith('P1-03') ? '地图服务配置负责人' : '发布负责人',
  evidence: requirement.startsWith('P1-03')
    ? '登录后 /locations/search 返回 source=amap 的文本 POI 候选'
    : '按发布前验收清单重新执行对应自动化与线上复验',
  next_action: requirement.startsWith('P1-03')
    ? '替换真实可用的高德 Web 服务 Key 后重新执行带测试账号的 verify:live-readiness。'
    : '修复阻断项后重新执行 verify:live-readiness，并保留 JSON 报告。',
});

const normalizeRequirementDetails = (items: unknown, fallbackRequirements: string[]): LiveReadinessRequirementDetail[] => {
  const details: LiveReadinessRequirementDetail[] = [];

  if (Array.isArray(items)) {
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const value = item as Record<string, unknown>;
      const requirement = typeof value.requirement === 'string' ? value.requirement.trim() : '';
      const severity = typeof value.severity === 'string' && ['P0', 'P1', 'P2'].includes(value.severity) ? (value.severity as LiveReadinessRequirementSeverity) : severityFromRequirement(requirement);
      if (!requirement) continue;
      details.push({
        requirement,
        severity,
        owner: typeof value.owner === 'string' && value.owner.trim() ? value.owner.trim() : fallbackRequirementDetail(requirement).owner,
        evidence: typeof value.evidence === 'string' && value.evidence.trim() ? value.evidence.trim() : fallbackRequirementDetail(requirement).evidence,
        next_action: typeof value.next_action === 'string' && value.next_action.trim() ? value.next_action.trim() : fallbackRequirementDetail(requirement).next_action,
      });
    }
  }

  if (details.length) {
    return [...new Map(details.map((item) => [item.requirement, item])).values()];
  }

  return fallbackRequirements.map(fallbackRequirementDetail);
};

const liveReadinessActionPriority = (report: LiveReadinessReportEvidence, status: OpsReadinessStatus, strictEnvironment: boolean) => {
  if (status === 'ready') return null;
  if (report.blocked_requirement_details.length) {
    return report.blocked_requirement_details.reduce<LiveReadinessRequirementSeverity>(
      (current, item) => (liveReadinessSeverityRank[item.severity] < liveReadinessSeverityRank[current] ? item.severity : current),
      'P2',
    );
  }
  return strictEnvironment ? 'P0' : 'P1';
};

const liveReadinessStatusFromSeverity = (severity: LiveReadinessRequirementSeverity): OpsReadinessStatus => (severity === 'P0' ? 'blocked' : 'warning');

const liveReadinessStatusFromRequirementDetails = (details: LiveReadinessRequirementDetail[], fallback: OpsReadinessStatus): OpsReadinessStatus => {
  if (!details.length) return fallback;
  return details.some((item) => item.severity === 'P0') ? 'blocked' : 'warning';
};

const liveReadinessStatusForFailedCheck = (report: LiveReadinessReportEvidence, checkName: string): OpsReadinessStatus => {
  const requirement = blockedRequirementForLiveReadinessCheck(checkName);
  if (!requirement) return liveReadinessStatusFromRequirementDetails(report.blocked_requirement_details, 'blocked');

  const details = report.blocked_requirement_details.filter((item) => item.requirement === requirement);
  if (details.length) return liveReadinessStatusFromRequirementDetails(details, 'blocked');
  return liveReadinessStatusFromSeverity(severityFromRequirement(requirement));
};

const readLiveReadinessReport = (now: Date): LiveReadinessReportEvidence => {
  const reportPath = resolveLiveReadinessReportPath();
  if (!reportPath) {
    return {
      path: '未启用',
      status: 'missing',
      checked_at: null,
      age_hours: null,
      providers: null,
      checks: [],
      failures: [],
      blocked_requirements: [],
      blocked_requirement_details: [],
      next_actions: ['配置 LIVE_READINESS_REPORT_PATH 或使用默认路径生成 live-readiness-latest.json。'],
    };
  }

  if (!existsSync(reportPath)) {
    return {
      path: reportPath,
      status: 'missing',
      checked_at: null,
      age_hours: null,
      providers: null,
      checks: [],
      failures: [],
      blocked_requirements: [],
      blocked_requirement_details: [],
      next_actions: ['执行带测试账号的 verify:live-readiness，生成上线复验报告。'],
    };
  }

  try {
    const parsed = JSON.parse(readFileSync(reportPath, 'utf8')) as {
      status?: string;
      checkedAt?: string;
      providers?: Record<string, string>;
      checks?: LiveReadinessReportCheck[];
      failures?: Array<{ name?: string; error?: string }>;
      blockedRequirements?: unknown[];
      blockedRequirementDetails?: unknown;
      nextActions?: string[];
    };
    const checkedAt = typeof parsed.checkedAt === 'string' ? parsed.checkedAt : null;
    const checkedAtTime = checkedAt ? Date.parse(checkedAt) : Number.NaN;
    const ageHours = Number.isNaN(checkedAtTime) ? null : Math.floor((now.getTime() - checkedAtTime) / 3_600_000);
    const checks = Array.isArray(parsed.checks)
      ? parsed.checks
          .filter((item) => typeof item?.name === 'string' && ['passed', 'failed'].includes(item.status))
          .map((item) => ({
            name: item.name,
            status: item.status,
            error: typeof item.error === 'string' ? item.error : undefined,
          }))
      : [];
    const failures = Array.isArray(parsed.failures)
      ? parsed.failures
          .filter((item) => typeof item?.name === 'string' && typeof item?.error === 'string')
          .map((item) => ({ name: item.name as string, error: item.error as string }))
      : checks.filter((item) => item.status === 'failed' && item.error).map((item) => ({ name: item.name, error: item.error as string }));
    const parsedBlockedRequirements: string[] = [];
    if (Array.isArray(parsed.blockedRequirements)) {
      for (const item of parsed.blockedRequirements) {
        if (typeof item !== 'string') continue;
        const value = item.trim();
        if (value && !parsedBlockedRequirements.includes(value)) parsedBlockedRequirements.push(value);
      }
    }
    const fallbackBlockedRequirements: string[] = [];
    for (const failure of failures) {
      const requirement = blockedRequirementForLiveReadinessCheck(failure.name);
      if (requirement && !fallbackBlockedRequirements.includes(requirement)) fallbackBlockedRequirements.push(requirement);
    }
    const blockedRequirements = parsedBlockedRequirements.length ? parsedBlockedRequirements : fallbackBlockedRequirements;
    const blockedRequirementDetails = normalizeRequirementDetails(parsed.blockedRequirementDetails, blockedRequirements);
    const nextActions = Array.isArray(parsed.nextActions) ? parsed.nextActions.filter((item) => typeof item === 'string') : [];
    const base = {
      path: reportPath,
      checked_at: checkedAt,
      age_hours: ageHours,
      providers: parsed.providers && typeof parsed.providers === 'object' ? parsed.providers : null,
      checks,
      failures,
      blocked_requirements: blockedRequirements,
      blocked_requirement_details: blockedRequirementDetails,
      next_actions: nextActions,
    };

    if (parsed.status === 'failed') return { ...base, status: 'failed' };
    if (!['passed', 'conditional_pass'].includes(String(parsed.status)) || !checkedAt || ageHours === null) return { ...base, status: 'invalid' };
    if (ageHours > MAX_LIVE_READINESS_REPORT_AGE_HOURS) return { ...base, status: 'stale' };
    return { ...base, status: parsed.status as 'passed' | 'conditional_pass' };
  } catch {
    return {
      path: reportPath,
      status: 'invalid',
      checked_at: null,
      age_hours: null,
      providers: null,
      checks: [],
      failures: [{ name: 'readiness', error: 'live readiness 报告不是有效 JSON。' }],
      blocked_requirements: [],
      blocked_requirement_details: [],
      next_actions: ['重新执行 verify:live-readiness，生成有效 JSON 报告。'],
    };
  }
};

const reportProviderEvidenceStatus = (report: LiveReadinessReportEvidence, evidence: LiveReadinessProviderEvidence | undefined, strictEnvironment: boolean) => {
  if (!evidence) return 'ready';
  const reportProvider = report.providers?.[evidence.providerKey];
  if (!reportProvider) return strictEnvironment ? 'blocked' : 'warning';
  return reportProvider === evidence.currentProvider ? 'ready' : 'blocked';
};

const reportProviderEvidenceProblem = (report: LiveReadinessReportEvidence, evidence: LiveReadinessProviderEvidence | undefined) => {
  if (!evidence) return null;
  const reportProvider = report.providers?.[evidence.providerKey];
  if (!reportProvider) return `live readiness 报告未包含${evidence.label} provider 证据，需要重新执行 verify:live-readiness。`;
  if (reportProvider !== evidence.currentProvider) {
    return `live readiness 报告中的${evidence.label} provider 是 ${providerValueLabel(reportProvider)}，当前运行配置是 ${providerValueLabel(evidence.currentProvider)}，需要重新复验。`;
  }
  return null;
};

const reportCheckStatus = (
  report: LiveReadinessReportEvidence,
  checkName: string,
  providerStatus: OpsReadinessStatus,
  strictEnvironment: boolean,
  evidence?: LiveReadinessProviderEvidence,
): OpsReadinessStatus => {
  if (providerStatus !== 'ready') return providerStatus;

  const check = report.checks.find((item) => item.name === checkName);
  if (check?.status === 'passed') return reportProviderEvidenceStatus(report, evidence, strictEnvironment);
  if (check?.status === 'failed') return liveReadinessStatusForFailedCheck(report, checkName);
  if (report.status === 'failed') return liveReadinessStatusFromRequirementDetails(report.blocked_requirement_details, 'blocked');
  if (report.status === 'invalid') return 'blocked';
  return strictEnvironment ? 'blocked' : 'warning';
};

const reportHelper = (report: LiveReadinessReportEvidence, checkName: string, readyText: string, fallbackText: string, evidence?: LiveReadinessProviderEvidence) => {
  const check = report.checks.find((item) => item.name === checkName);
  const providerEvidenceProblem = reportProviderEvidenceProblem(report, evidence);
  if ((report.status === 'passed' || report.status === 'conditional_pass') && check?.status === 'passed' && providerEvidenceProblem) return providerEvidenceProblem;
  if ((report.status === 'passed' || report.status === 'conditional_pass') && check?.status === 'passed') return readyText;

  const failure = report.failures.find((item) => item.name === checkName) ?? check;
  const summary = reportFailureSummary(failure);
  if (summary) return summary;
  if (report.status === 'missing') return '未读取到 live readiness 报告，无法证明真实线上 provider 可用。';
  if (report.status === 'stale') return `live readiness 报告已超过 ${MAX_LIVE_READINESS_REPORT_AGE_HOURS} 小时，需要重新复验。`;
  if (report.status === 'invalid') return 'live readiness 报告格式异常，需要重新生成。';
  return fallbackText;
};

const providerValueLabel = (value: string) =>
  ({
    mock: '本地模拟',
    minio: 'MinIO',
    s3: 'S3',
    oss: '阿里云 OSS',
    cos: '腾讯云 COS',
    r2: 'Cloudflare R2',
    openai: 'OpenAI',
    'openai-compatible': '兼容 OpenAI',
    amap: '高德地图',
    aliyun: '阿里云短信',
    disabled: '已关闭',
  })[value] ?? value;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditLogService: AuditLogService,
    private readonly aiJobsQueue: AiJobsQueue,
    private readonly runtimeConfigService: RuntimeConfigService,
    private readonly storageService: StorageService,
  ) {}

  async login(dto: AdminLoginDto, request: Request) {
    const admin = await this.ensureBootstrapAdmin(dto.username);
    if (admin.status !== ADMIN_ACTIVE_STATUS) {
      throw new UnauthorizedException('账号或密码错误');
    }

    const valid = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('账号或密码错误');
    }

    const accessTokenJti = randomUUID();
    const accessTokenExpiresIn = getAdminJwtAccessExpiresIn() || DEFAULT_ACCESS_TOKEN_EXPIRES_IN;
    const accessTokenTtlSeconds = parseDurationToSeconds(accessTokenExpiresIn) || parseDurationToSeconds(DEFAULT_ACCESS_TOKEN_EXPIRES_IN);
    const expiresAt = new Date(Date.now() + accessTokenTtlSeconds * 1000);

    await this.prisma.$transaction([
      this.prisma.adminUser.update({
        where: { id: admin.id },
        data: { lastLoginAt: new Date() },
      }),
      this.prisma.adminSession.create({
        data: {
          adminId: admin.id,
          accessTokenJtiHash: hashToken(accessTokenJti),
          expiresAt,
          ipAddress: request.ip,
          userAgent: String(request.headers['user-agent'] ?? '').slice(0, 512) || null,
        },
      }),
    ]);

    await this.auditLogService.create({
      actor_type: ActorType.admin,
      actor_id: admin.id,
      action: 'admin_login',
      target_type: 'admin_user',
      target_id: admin.id,
      ip_address: request.ip,
      user_agent: request.headers['user-agent'] ?? null,
    });

    return {
      access_token: await this.jwtService.signAsync(
        {
          type: 'admin',
          sub: admin.id.toString(),
          username: admin.username,
          role: admin.role,
          jti: accessTokenJti,
        },
        {
          secret: getAdminJwtAccessSecret(),
          expiresIn: accessTokenExpiresIn as JwtSignOptions['expiresIn'],
        },
      ),
      expires_in: accessTokenTtlSeconds,
      admin: {
        username: admin.username,
        display_name: admin.displayName,
        role: admin.role,
      },
    };
  }

  async listUsers(admin: AuthenticatedAdmin, dto: AdminListDto, request: Request) {
    const page = normalizePage(dto.page);
    const pageSize = normalizePageSize(dto.page_size);
    const where = dto.keyword
      ? {
          OR: [
            { userNo: { contains: dto.keyword } },
            { nickname: { contains: dto.keyword } },
            { mobile: { contains: dto.keyword } },
          ],
          deletedAt: null,
        }
      : { deletedAt: null };

    const [total, list] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    await this.logListAudit(admin, 'admin_list_users', request);
    return {
      list: list.map((item) => ({
        user_no: item.userNo,
        nickname: item.nickname,
        avatar_url: item.avatarUrl,
        mobile: item.mobile,
        membership_type: item.membershipType,
        status: statusToUserLabel(item.status),
        last_login_at: item.lastLoginAt?.toISOString() ?? null,
        created_at: item.createdAt.toISOString(),
      })),
      page,
      page_size: pageSize,
      total,
      has_more: page * pageSize < total,
    };
  }

  async listFamilies(admin: AuthenticatedAdmin, dto: AdminListDto, request: Request) {
    const page = normalizePage(dto.page);
    const pageSize = normalizePageSize(dto.page_size);
    const keyword = dto.keyword?.trim();
    const where: Prisma.FamilyWhereInput = keyword
      ? {
          deletedAt: null,
          OR: [
            { familyNo: { contains: keyword } },
            { name: { contains: keyword } },
            {
              owner: {
                is: {
                  OR: [{ userNo: { contains: keyword } }, { nickname: { contains: keyword } }, { mobile: { contains: keyword } }],
                },
              },
            },
          ],
        }
      : { deletedAt: null };

    const [total, list] = await this.prisma.$transaction([
      this.prisma.family.count({ where }),
      this.prisma.family.findMany({
        where,
        include: {
          owner: true,
          _count: {
            select: {
              members: true,
              children: true,
              records: true,
              media: true,
              archiveExportRequests: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    await this.logListAudit(admin, 'admin_list_families', request);
    return {
      list: list.map((item) => ({
        family_no: item.familyNo,
        family_name: item.name,
        owner_user_no: item.owner.userNo,
        owner_name: item.owner.nickname,
        owner_mobile: item.owner.mobile,
        status: statusToFamilyLabel(item.status, item.deletedAt),
        members_count: item._count.members,
        children_count: item._count.children,
        records_count: item._count.records,
        media_count: item._count.media,
        archive_export_requests_count: item._count.archiveExportRequests,
        created_at: item.createdAt.toISOString(),
      })),
      page,
      page_size: pageSize,
      total,
      has_more: page * pageSize < total,
    };
  }

  async listInvites(admin: AuthenticatedAdmin, dto: AdminListDto, request: Request) {
    const page = normalizePage(dto.page);
    const pageSize = normalizePageSize(dto.page_size);
    const where: Prisma.RegistrationInviteWhereInput = dto.keyword
      ? {
          OR: [
            { inviteNo: { contains: dto.keyword } },
            { inviteeMobile: { contains: dto.keyword } },
            { acceptedByUser: { is: { OR: [{ userNo: { contains: dto.keyword } }, { nickname: { contains: dto.keyword } }, { mobile: { contains: dto.keyword } }] } } },
            { createdByAdmin: { is: { OR: [{ username: { contains: dto.keyword } }, { displayName: { contains: dto.keyword } }] } } },
          ],
        }
      : {};

    const [total, list] = await this.prisma.$transaction([
      this.prisma.registrationInvite.count({ where }),
      this.prisma.registrationInvite.findMany({
        where,
        include: { createdByAdmin: true, acceptedByUser: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    await this.logListAudit(admin, 'admin_list_registration_invites', request);
    return {
      list: list.map((item) => ({
        invite_no: item.inviteNo,
        invitee_mobile: item.inviteeMobile,
        status: statusToInviteLabel(item.status, item.expiresAt),
        created_by_username: item.createdByAdmin.username,
        created_by_name: item.createdByAdmin.displayName,
        accepted_by_user_no: item.acceptedByUser?.userNo ?? null,
        accepted_by_name: item.acceptedByUser?.nickname ?? null,
        expires_at: item.expiresAt.toISOString(),
        accepted_at: item.acceptedAt?.toISOString() ?? null,
        created_at: item.createdAt.toISOString(),
      })),
      page,
      page_size: pageSize,
      total,
      has_more: page * pageSize < total,
    };
  }

  async createInvite(admin: AuthenticatedAdmin, dto: AdminCreateInviteDto, request: Request) {
    if (dto.mobile) {
      const existing = await this.prisma.registrationInvite.findFirst({
        where: {
          inviteeMobile: dto.mobile,
          status: MEMBER_INVITE_STATUS_PENDING,
          expiresAt: { gt: new Date() },
        },
      });

      if (existing) {
        throw new BadRequestException('该手机号已有未使用的邀请码');
      }
    }

    const inviteToken = createRegistrationInviteToken();
    const expiresInHours = dto.expires_in_hours ?? DEFAULT_REGISTRATION_INVITE_EXPIRES_IN_HOURS;
    const invite = await this.prisma.registrationInvite.create({
      data: {
        inviteNo: generateBizNo('reg_invite'),
        tokenHash: hashToken(inviteToken),
        inviteeMobile: dto.mobile ?? null,
        createdByAdminId: admin.id,
        status: MEMBER_INVITE_STATUS_PENDING,
        expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1000),
      },
    });

    await this.auditLogService.create({
      actor_type: ActorType.admin,
      actor_id: admin.id,
      action: 'admin_create_registration_invite',
      target_type: 'registration_invite',
      target_id: invite.id,
      ip_address: request.ip,
      user_agent: request.headers['user-agent'] ?? null,
      metadata: {
        invite_no: invite.inviteNo,
        invitee_mobile: invite.inviteeMobile,
        expires_at: invite.expiresAt.toISOString(),
      },
    });

    return {
      invite_no: invite.inviteNo,
      invite_code: inviteToken,
      invitee_mobile: invite.inviteeMobile,
      status: statusToInviteLabel(invite.status, invite.expiresAt),
      expires_at: invite.expiresAt.toISOString(),
      created_at: invite.createdAt.toISOString(),
    };
  }

  async revokeInvite(admin: AuthenticatedAdmin, inviteNo: string, request: Request) {
    const invite = await this.prisma.registrationInvite.findFirst({
      where: { inviteNo },
    });

    if (!invite) {
      throw new NotFoundException('邀请码不存在');
    }

    if (invite.status === MEMBER_INVITE_STATUS_ACCEPTED) {
      throw new BadRequestException('已使用的邀请码不能撤销');
    }

    if (invite.status === MEMBER_INVITE_STATUS_REVOKED) {
      return {
        invite_no: invite.inviteNo,
        status: statusToInviteLabel(invite.status, invite.expiresAt),
        changed: false,
      };
    }

    const updated = await this.prisma.registrationInvite.update({
      where: { id: invite.id },
      data: { status: MEMBER_INVITE_STATUS_REVOKED },
    });

    await this.auditLogService.create({
      actor_type: ActorType.admin,
      actor_id: admin.id,
      action: 'admin_revoke_registration_invite',
      target_type: 'registration_invite',
      target_id: updated.id,
      ip_address: request.ip,
      user_agent: request.headers['user-agent'] ?? null,
      metadata: {
        invite_no: updated.inviteNo,
        before_status: statusToInviteLabel(invite.status, invite.expiresAt),
        after_status: statusToInviteLabel(updated.status, updated.expiresAt),
      },
    });

    return {
      invite_no: updated.inviteNo,
      status: statusToInviteLabel(updated.status, updated.expiresAt),
      changed: true,
    };
  }

  async updateUserStatus(admin: AuthenticatedAdmin, userNo: string, dto: AdminUpdateUserStatusDto, request: Request) {
    const user = await this.prisma.user.findFirst({
      where: {
        userNo,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const nextStatus = dto.status === 'active' ? USER_ACTIVE_STATUS : USER_DISABLED_STATUS;
    if (user.status === nextStatus) {
      return {
        user_no: user.userNo,
        status: dto.status,
        changed: false,
      };
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { status: nextStatus },
    });

    await this.auditLogService.create({
      actor_type: ActorType.admin,
      actor_id: admin.id,
      action: nextStatus === USER_ACTIVE_STATUS ? 'admin_activate_user' : 'admin_disable_user',
      target_type: 'user',
      target_id: updated.id,
      ip_address: request.ip,
      user_agent: request.headers['user-agent'] ?? null,
      metadata: {
        user_no: updated.userNo,
        before_status: statusToUserLabel(user.status),
        after_status: statusToUserLabel(nextStatus),
        reason: dto.reason ?? null,
      },
    });

    return {
      user_no: updated.userNo,
      status: statusToUserLabel(nextStatus),
      changed: true,
    };
  }

  async updateUserMembership(admin: AuthenticatedAdmin, userNo: string, dto: AdminUpdateUserMembershipDto, request: Request) {
    const user = await this.prisma.user.findFirst({
      where: {
        userNo,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const nextMembershipType = dto.membership_type as MembershipType;
    const nextExpireAt = this.resolveMembershipExpireAt(nextMembershipType, dto.membership_expire_at);
    const beforeMembershipType = user.membershipType;
    const beforeExpireAt = user.membershipExpireAt?.toISOString() ?? null;
    const afterExpireAt = nextExpireAt?.toISOString() ?? null;
    const changed = beforeMembershipType !== nextMembershipType || beforeExpireAt !== afterExpireAt;

    if (!changed) {
      return {
        user_no: user.userNo,
        membership_type: user.membershipType,
        membership_expire_at: beforeExpireAt,
        changed: false,
      };
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        membershipType: nextMembershipType,
        membershipExpireAt: nextExpireAt,
      },
    });

    await this.auditLogService.create({
      actor_type: ActorType.admin,
      actor_id: admin.id,
      action: 'admin_update_user_membership',
      target_type: 'user',
      target_id: updated.id,
      ip_address: request.ip,
      user_agent: request.headers['user-agent'] ?? null,
      metadata: {
        user_no: updated.userNo,
        before_membership_type: beforeMembershipType,
        after_membership_type: updated.membershipType,
        before_membership_expire_at: beforeExpireAt,
        after_membership_expire_at: updated.membershipExpireAt?.toISOString() ?? null,
        reason: dto.reason,
      },
    });

    return {
      user_no: updated.userNo,
      membership_type: updated.membershipType,
      membership_expire_at: updated.membershipExpireAt?.toISOString() ?? null,
      changed: true,
    };
  }

  async resetUserPassword(admin: AuthenticatedAdmin, userNo: string, dto: AdminResetUserPasswordDto, request: Request) {
    if (dto.new_password !== dto.password_confirm) {
      throw new BadRequestException('两次输入的密码不一致');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        userNo,
        deletedAt: null,
      },
      include: {
        authAccounts: {
          where: { authType: AuthType.password },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const passwordAccount = user.authAccounts[0];
    if (!passwordAccount) {
      throw new BadRequestException('该用户没有账号密码登录凭据');
    }

    const passwordHash = await bcrypt.hash(dto.new_password, 10);
    const now = new Date();
    const [, , revokedSessions] = await this.prisma.$transaction([
      this.prisma.userAuthAccount.update({
        where: { id: passwordAccount.id },
        data: { credentialHash: passwordHash },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { tokenInvalidBefore: now },
      }),
      this.prisma.userSession.updateMany({
        where: {
          userId: user.id,
          revokedAt: null,
        },
        data: { revokedAt: now },
      }),
    ]);

    await this.auditLogService.create({
      actor_type: ActorType.admin,
      actor_id: admin.id,
      action: 'admin_reset_user_password',
      target_type: 'user',
      target_id: user.id,
      ip_address: request.ip,
      user_agent: request.headers['user-agent'] ?? null,
      metadata: {
        user_no: user.userNo,
        auth_key: passwordAccount.authKey,
        revoked_sessions: revokedSessions.count,
        reason: dto.reason,
      },
    });

    return {
      user_no: user.userNo,
      auth_key: passwordAccount.authKey,
      revoked_sessions: revokedSessions.count,
      changed: true,
      reset_at: now.toISOString(),
    };
  }

  async listChildren(admin: AuthenticatedAdmin, dto: AdminListDto, request: Request) {
    const page = normalizePage(dto.page);
    const pageSize = normalizePageSize(dto.page_size);
    const where: Prisma.ChildWhereInput = dto.keyword
      ? {
          deletedAt: null,
          OR: [
            { childNo: { contains: dto.keyword } },
            { name: { contains: dto.keyword } },
            { birthPlace: { contains: dto.keyword } },
            { family: { is: { OR: [{ familyNo: { contains: dto.keyword } }, { name: { contains: dto.keyword } }] } } },
            { owner: { is: { OR: [{ userNo: { contains: dto.keyword } }, { nickname: { contains: dto.keyword } }, { mobile: { contains: dto.keyword } }] } } },
          ],
        }
      : { deletedAt: null };

    const [total, list] = await this.prisma.$transaction([
      this.prisma.child.count({ where }),
      this.prisma.child.findMany({
        where,
        include: { family: true, owner: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    await this.logListAudit(admin, 'admin_list_children', request);
    return {
      list: await Promise.all(list.map(async (item) => ({
        child_no: item.childNo,
        family_no: item.family.familyNo,
        family_name: item.family.name,
        owner_user_no: item.owner.userNo,
        owner_name: item.owner.nickname,
        name: item.name,
        avatar_url: await this.resolveChildAvatarUrl(item.id, item.avatarUrl),
        avatar_media_no: parseMediaReference(item.avatarUrl),
        birthday: toDateOnly(item.birthday),
        current_age_display: ageDisplay(item.birthday),
        gender: item.gender,
        birth_place: item.birthPlace,
        remark: item.remark,
        status: statusToChildLabel(item.status, item.deletedAt),
        created_at: item.createdAt.toISOString(),
        updated_at: item.updatedAt.toISOString(),
      }))),
      page,
      page_size: pageSize,
      total,
      has_more: page * pageSize < total,
    };
  }

  async listRecords(admin: AuthenticatedAdmin, dto: AdminRecordListDto, request: Request) {
    const page = normalizePage(dto.page);
    const pageSize = normalizePageSize(dto.page_size);
    const keyword = dto.keyword?.trim();
    const filter = dto.record_filter ?? 'all';
    const and: Prisma.RecordWhereInput[] = [{ deletedAt: null }];

    if (keyword) {
      and.push({
        OR: [
          { recordNo: { contains: keyword } },
          { title: { contains: keyword } },
          { contentText: { contains: keyword } },
          { child: { is: { OR: [{ childNo: { contains: keyword } }, { name: { contains: keyword } }] } } },
          { creator: { is: { OR: [{ userNo: { contains: keyword } }, { nickname: { contains: keyword } }, { mobile: { contains: keyword } }] } } },
        ],
      });
    }

    if (filter === 'image' || filter === 'video' || filter === 'audio') {
      and.push({ media: { some: { deletedAt: null, mediaType: filter as MediaType } } });
    }

    if (filter === 'media_exception') {
      and.push({ media: { some: { deletedAt: null, status: { in: [MEDIA_STATUS_UPLOADING, MEDIA_STATUS_FAILED] } } } });
    }

    if (filter === 'pending') {
      and.push({
        OR: [
          { status: RECORD_STATUS_DRAFT },
          { media: { some: { deletedAt: null, status: { in: [MEDIA_STATUS_UPLOADING, MEDIA_STATUS_FAILED] } } } },
        ],
      });
    }

    if (filter === 'risk') {
      and.push({ OR: contentRiskKeywordWhere });
    }

    const where: Prisma.RecordWhereInput = { AND: and };

    const [total, list] = await this.prisma.$transaction([
      this.prisma.record.count({ where }),
      this.prisma.record.findMany({
        where,
        include: { child: true, creator: true, media: { where: { deletedAt: null } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    await this.logListAudit(admin, 'admin_list_records', request);
    return {
      list: list.map((item) => {
        const mediaTypes = Array.from(new Set(item.media.map((media) => media.mediaType)));
        const pendingMedia = item.media.filter((media) => media.status === MEDIA_STATUS_UPLOADING || media.status === MEDIA_STATUS_FAILED);
        const hasRiskFlag = Boolean(this.detectContentRisk(`${item.title ?? ''} ${item.contentText ?? ''}`));
        return {
          record_no: item.recordNo,
          child_no: item.child.childNo,
          child_name: item.child.name,
          creator_user_no: item.creator.userNo,
          creator_name: item.creator.nickname,
          title: item.title,
          record_type: item.recordType,
          visibility_scope: item.visibilityScope,
          status: statusToRecordLabel(item.status),
          media_count: item.media.length,
          media_types: mediaTypes,
          pending_media_count: pendingMedia.length,
          has_media_exception: pendingMedia.length > 0,
          has_risk_flag: hasRiskFlag,
          created_at: item.createdAt.toISOString(),
        };
      }),
      page,
      page_size: pageSize,
      total,
      has_more: page * pageSize < total,
    };
  }

  async listMedia(admin: AuthenticatedAdmin, dto: AdminMediaListDto, request: Request) {
    const page = normalizePage(dto.page);
    const pageSize = normalizePageSize(dto.page_size);
    const createdAt: Prisma.DateTimeFilter = {};
    if (dto.start_time) createdAt.gte = new Date(dto.start_time);
    if (dto.end_time) createdAt.lte = new Date(dto.end_time);

    const where: Prisma.RecordMediaWhereInput = {
      deletedAt: null,
      ...(dto.media_type ? { mediaType: dto.media_type as MediaType } : {}),
      ...(dto.status ? { status: mediaStatusFilterToNumber(dto.status) } : {}),
      ...(dto.child_no ? { child: { is: { childNo: dto.child_no } } } : {}),
      ...(dto.family_no ? { family: { is: { familyNo: dto.family_no } } } : {}),
      ...(dto.uploader_user_no ? { uploader: { is: { userNo: dto.uploader_user_no } } } : {}),
      ...(dto.linked === 'linked' ? { recordId: { not: null } } : {}),
      ...(dto.linked === 'unlinked' ? { recordId: null } : {}),
      ...(Object.keys(createdAt).length ? { createdAt } : {}),
      ...(dto.keyword
        ? {
            OR: [
              { mediaNo: { contains: dto.keyword } },
              { originalName: { contains: dto.keyword } },
              { objectKey: { contains: dto.keyword } },
              { family: { is: { OR: [{ familyNo: { contains: dto.keyword } }, { name: { contains: dto.keyword } }] } } },
              { record: { is: { OR: [{ recordNo: { contains: dto.keyword } }, { title: { contains: dto.keyword } }, { contentText: { contains: dto.keyword } }] } } },
              { child: { is: { OR: [{ childNo: { contains: dto.keyword } }, { name: { contains: dto.keyword } }] } } },
              { uploader: { is: { OR: [{ userNo: { contains: dto.keyword } }, { nickname: { contains: dto.keyword } }, { mobile: { contains: dto.keyword } }] } } },
            ],
          }
        : {}),
    };

    const [total, list] = await this.prisma.$transaction([
      this.prisma.recordMedia.count({ where }),
      this.prisma.recordMedia.findMany({
        where,
        include: { child: true, family: true, uploader: true, record: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    await this.logListAudit(admin, 'admin_list_media', request);
    return {
      list: await Promise.all(list.map((item) => this.toMediaListItem(item, admin))),
      page,
      page_size: pageSize,
      total,
      has_more: page * pageSize < total,
    };
  }

  async listAiJobs(admin: AuthenticatedAdmin, dto: AdminListDto, request: Request) {
    const page = normalizePage(dto.page);
    const pageSize = normalizePageSize(dto.page_size);
    const where = dto.keyword
      ? {
          OR: [{ jobNo: { contains: dto.keyword } }, { errorMessage: { contains: dto.keyword } }],
        }
      : {};

    const [total, list] = await this.prisma.$transaction([
      this.prisma.aiJob.count({ where }),
      this.prisma.aiJob.findMany({
        where,
        include: { record: true, requester: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    await this.logListAudit(admin, 'admin_list_ai_jobs', request);
    return {
      list: list.map((item) => ({
        job_no: item.jobNo,
        record_no: item.record?.recordNo ?? null,
        requester_user_no: item.requester.userNo,
        job_type: item.jobType,
        status: item.status,
        error_message: item.errorMessage,
        retry_count: item.retryCount,
        created_at: item.createdAt.toISOString(),
      })),
      page,
      page_size: pageSize,
      total,
      has_more: page * pageSize < total,
    };
  }

  async listContentRisks(admin: AuthenticatedAdmin, dto: AdminContentRiskListDto, request: Request) {
    const page = normalizePage(dto.page);
    const pageSize = normalizePageSize(dto.page_size);
    const keyword = dto.keyword?.trim();
    const takeLimit = Math.min(Math.max(page * pageSize + pageSize, 80), 200);
    const includeCategory = (category: ContentRiskCategory) => !dto.category || dto.category === category;

    const recordAnd: Prisma.RecordWhereInput[] = [{ OR: contentRiskKeywordWhere }];
    if (keyword) {
      recordAnd.push({
        OR: [
          { recordNo: { contains: keyword } },
          { title: { contains: keyword } },
          { contentText: { contains: keyword } },
          { child: { is: { OR: [{ childNo: { contains: keyword } }, { name: { contains: keyword } }] } } },
          { creator: { is: { OR: [{ userNo: { contains: keyword } }, { nickname: { contains: keyword } }, { mobile: { contains: keyword } }] } } },
        ],
      });
    }

    const mediaAnd: Prisma.RecordMediaWhereInput[] = [mediaExceptionCondition];
    if (keyword) {
      mediaAnd.push({
        OR: [
          { mediaNo: { contains: keyword } },
          { originalName: { contains: keyword } },
          { objectKey: { contains: keyword } },
          { record: { is: { OR: [{ recordNo: { contains: keyword } }, { title: { contains: keyword } }] } } },
          { child: { is: { OR: [{ childNo: { contains: keyword } }, { name: { contains: keyword } }] } } },
          { uploader: { is: { OR: [{ userNo: { contains: keyword } }, { nickname: { contains: keyword } }, { mobile: { contains: keyword } }] } } },
        ],
      });
    }

    const ticketWhere: Prisma.SupportTicketWhereInput = {
      priority: SupportTicketPriority.child_safety,
      ...(keyword
        ? {
            OR: [
              { ticketNo: { contains: keyword } },
              { category: { contains: keyword } },
              { topic: { contains: keyword } },
              { content: { contains: keyword } },
              { contact: { contains: keyword } },
              { user: { is: { OR: [{ userNo: { contains: keyword } }, { nickname: { contains: keyword } }, { mobile: { contains: keyword } }] } } },
            ],
          }
        : {}),
    };

    const aiJobWhere: Prisma.AiJobWhereInput = {
      status: AiJobStatus.failed,
      ...(keyword
        ? {
            OR: [
              { jobNo: { contains: keyword } },
              { errorMessage: { contains: keyword } },
              { record: { is: { OR: [{ recordNo: { contains: keyword } }, { title: { contains: keyword } }] } } },
              { requester: { is: { OR: [{ userNo: { contains: keyword } }, { nickname: { contains: keyword } }, { mobile: { contains: keyword } }] } } },
            ],
          }
        : {}),
    };

    const [records, media, supportTickets, aiJobs] = await Promise.all([
      includeCategory('content_safety')
        ? this.prisma.record.findMany({
            where: { deletedAt: null, AND: recordAnd },
            include: { child: true, creator: true },
            orderBy: { createdAt: 'desc' },
            take: takeLimit,
          })
        : Promise.resolve([]),
      includeCategory('media_exception')
        ? this.prisma.recordMedia.findMany({
            where: { deletedAt: null, AND: mediaAnd },
            include: { child: true, uploader: true, record: true },
            orderBy: { createdAt: 'desc' },
            take: takeLimit,
          })
        : Promise.resolve([]),
      includeCategory('child_safety')
        ? this.prisma.supportTicket.findMany({
            where: ticketWhere,
            include: { user: true, assignedAdmin: true },
            orderBy: { createdAt: 'desc' },
            take: takeLimit,
          })
        : Promise.resolve([]),
      includeCategory('ai_exception')
        ? this.prisma.aiJob.findMany({
            where: aiJobWhere,
            include: { record: true, requester: true },
            orderBy: { createdAt: 'desc' },
            take: takeLimit,
          })
        : Promise.resolve([]),
    ]);

    const risks: AdminContentRiskItem[] = [
      ...records.map<AdminContentRiskItem | null>((record) => {
        const flag = this.detectContentRisk(`${record.title ?? ''} ${record.contentText ?? ''}`);
        if (!flag) return null;

        return {
          risk_no: `record:${record.recordNo}`,
          category: 'content_safety',
          severity: flag.severity,
          status: record.status === RECORD_STATUS_PUBLISHED ? 'open' : 'processing',
          title: record.title ?? '未命名成长记录',
          subject_no: record.child.childNo,
          subject_name: record.child.name,
          source_type: 'record',
          source_no: record.recordNo,
          source_status: statusToRecordLabel(record.status),
          reason: `${flag.reason}（命中：${flag.keyword}）`,
          action_label: record.status === RECORD_STATUS_PUBLISHED ? '进入成长记录下架或复核' : '进入成长记录恢复或复核',
          action_to: '/records',
          created_at: record.createdAt.toISOString(),
        };
      }),
      ...media.map<AdminContentRiskItem>((item) => {
        const isFailed = item.status === MEDIA_STATUS_FAILED;
        const isUploading = item.status === MEDIA_STATUS_UPLOADING;
        const isOrphan = !item.recordId;

        return {
          risk_no: `media:${item.mediaNo}`,
          category: 'media_exception',
          severity: isFailed ? 'p0' : 'p1',
          status: isUploading ? 'processing' : 'open',
          title: item.originalName ?? item.record?.title ?? item.mediaNo,
          subject_no: item.child?.childNo ?? null,
          subject_name: item.child?.name ?? null,
          source_type: 'media',
          source_no: item.mediaNo,
          source_status: statusToMediaLabel(item.status),
          reason: isFailed ? '媒体处理异常，需要确认是否可恢复或下架' : isOrphan ? '媒体未关联成长记录，需要确认归属' : '媒体仍在上传中，需要确认是否长期卡住',
          action_label: '进入媒体库处理',
          action_to: '/media',
          created_at: item.createdAt.toISOString(),
        };
      }),
      ...supportTickets.map<AdminContentRiskItem>((ticket) => ({
        risk_no: `support:${ticket.ticketNo}`,
        category: 'child_safety',
        severity: 'p0',
        status: this.supportTicketRiskStatus(ticket.status),
        title: ticket.topic ?? ticket.category,
        subject_no: ticket.user.userNo,
        subject_name: ticket.user.nickname,
        source_type: 'support_ticket',
        source_no: ticket.ticketNo,
        source_status: ticket.status,
        reason: '儿童安全、注销或隐私相关反馈需要优先人工处理',
        action_label: '进入客服反馈处理',
        action_to: '/support-tickets',
        created_at: ticket.createdAt.toISOString(),
      })),
      ...aiJobs.map<AdminContentRiskItem>((job) => ({
        risk_no: `ai:${job.jobNo}`,
        category: 'ai_exception',
        severity: 'p1',
        status: 'open',
        title: job.record?.title ?? job.jobType,
        subject_no: job.record?.recordNo ?? null,
        subject_name: job.requester?.nickname ?? job.requester?.userNo ?? null,
        source_type: 'ai_job',
        source_no: job.jobNo,
        source_status: job.status,
        reason: job.errorMessage ? `AI 任务失败：${job.errorMessage}` : 'AI 任务失败，可能影响摘要、标题或标签展示',
        action_label: '进入 AI 任务重试',
        action_to: '/ai-jobs',
        created_at: job.createdAt.toISOString(),
      })),
    ].filter((item): item is AdminContentRiskItem => Boolean(item));

    const filtered = risks
      .filter((item) => this.matchesContentRiskKeyword(item, keyword))
      .filter((item) => !dto.severity || item.severity === dto.severity)
      .filter((item) => !dto.status || item.status === dto.status)
      .sort((left, right) => contentRiskSeverityRank[left.severity] - contentRiskSeverityRank[right.severity] || new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
    const total = filtered.length;
    const start = (page - 1) * pageSize;

    await this.logListAudit(admin, 'admin_list_content_risks', request);
    return {
      list: filtered.slice(start, start + pageSize),
      page,
      page_size: pageSize,
      total,
      has_more: page * pageSize < total,
    };
  }

  async listNotifications(admin: AuthenticatedAdmin, dto: AdminNotificationListDto, request: Request) {
    const page = normalizePage(dto.page);
    const pageSize = normalizePageSize(dto.page_size);
    const keyword = dto.keyword?.trim();
    const createdAt: Prisma.DateTimeFilter = {};
    if (dto.start_time) createdAt.gte = new Date(dto.start_time);
    if (dto.end_time) createdAt.lte = new Date(dto.end_time);

    const where: Prisma.UserNotificationWhereInput = {
      deletedAt: null,
      ...(dto.read_state === 'read' ? { readAt: { not: null } } : {}),
      ...(dto.read_state === 'unread' ? { readAt: null } : {}),
      ...(dto.notification_type ? { notificationType: dto.notification_type } : {}),
      ...(dto.delivery_status ? { deliveries: { some: { status: dto.delivery_status } } } : {}),
      ...(Object.keys(createdAt).length ? { createdAt } : {}),
      ...(keyword
        ? {
            OR: [
              { notificationNo: { contains: keyword } },
              { notificationType: { contains: keyword } },
              { title: { contains: keyword } },
              { body: { contains: keyword } },
              { targetNo: { contains: keyword } },
              { user: { is: { OR: [{ userNo: { contains: keyword } }, { nickname: { contains: keyword } }, { mobile: { contains: keyword } }] } } },
              { actor: { is: { OR: [{ userNo: { contains: keyword } }, { nickname: { contains: keyword } }, { mobile: { contains: keyword } }] } } },
              { family: { is: { OR: [{ familyNo: { contains: keyword } }, { name: { contains: keyword } }] } } },
            ],
          }
        : {}),
    };

    const [total, list] = await this.prisma.$transaction([
      this.prisma.userNotification.count({ where }),
      this.prisma.userNotification.findMany({
        where,
        include: {
          user: true,
          family: true,
          actor: true,
          deliveries: {
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    await this.logListAudit(admin, 'admin_list_notifications', request);
    return {
      list: list.map((item) => this.toNotificationItem(item)),
      page,
      page_size: pageSize,
      total,
      has_more: page * pageSize < total,
    };
  }

  async listAuditLogs(admin: AuthenticatedAdmin, dto: AdminAuditLogListDto, request: Request) {
    const page = normalizePage(dto.page);
    const pageSize = normalizePageSize(dto.page_size);
    const where: Prisma.AuditLogWhereInput = {
      ...(dto.keyword
        ? {
            OR: [
              { action: { contains: dto.keyword } },
              { targetType: { contains: dto.keyword } },
            ],
          }
        : {}),
      ...(dto.action ? { action: dto.action } : {}),
      ...(dto.target_type ? { targetType: dto.target_type } : {}),
      ...(dto.start_time || dto.end_time
        ? {
            createdAt: {
              ...(dto.start_time ? { gte: new Date(dto.start_time) } : {}),
              ...(dto.end_time ? { lte: new Date(dto.end_time) } : {}),
            },
          }
        : {}),
    };

    const [total, list] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    await this.logListAudit(admin, 'admin_list_audit_logs', request);
    return {
      list: list.map((item) => ({
        actor_type: item.actorType,
        actor_id: item.actorId.toString(),
        action: item.action,
        target_type: item.targetType,
        target_id: item.targetId?.toString() ?? null,
        ip_address: item.ipAddress,
        user_agent: item.userAgent,
        metadata: item.metadata,
        created_at: item.createdAt.toISOString(),
      })),
      page,
      page_size: pageSize,
      total,
      has_more: page * pageSize < total,
    };
  }

  async dashboard(admin: AuthenticatedAdmin, request: Request) {
    const [userCount, childCount, recordCount, mediaCount, aiJobGroups, recentAuditLogs] = await this.prisma.$transaction([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.child.count({ where: { deletedAt: null } }),
      this.prisma.record.count({ where: { deletedAt: null } }),
      this.prisma.recordMedia.count({ where: { deletedAt: null } }),
      this.prisma.aiJob.groupBy({
        by: ['status'],
        orderBy: { status: 'asc' },
        _count: true,
      }),
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    await this.logListAudit(admin, 'admin_view_dashboard', request);

    return {
      totals: {
        users: userCount,
        children: childCount,
        records: recordCount,
        media: mediaCount,
      },
      ai_job_status_distribution: Object.values(AiJobStatus).map((status) => ({
        status,
        count: aiJobGroups.find((item) => item.status === status)?._count ?? 0,
      })),
      recent_audit_logs: recentAuditLogs.map((item) => this.toAuditLogItem(item)),
    };
  }

  async listSystemConfigs(admin: AuthenticatedAdmin, request: Request) {
    const rows = await this.prisma.systemConfig.findMany({
      where: { configKey: { in: SYSTEM_CONFIG_KEYS } },
      include: { updatedByAdmin: true },
    });

    await this.logListAudit(admin, 'admin_list_system_configs', request);

    return {
      list: SYSTEM_CONFIG_DEFINITIONS.map((definition) => this.toSystemConfigItem(definition, rows.find((item) => item.configKey === definition.key))),
      total: SYSTEM_CONFIG_DEFINITIONS.length,
    };
  }

  async updateSystemConfig(admin: AuthenticatedAdmin, configKey: string, dto: AdminUpdateSystemConfigDto, request: Request) {
    const definition = getSystemConfigDefinition(configKey);
    if (!definition) {
      throw new NotFoundException('系统配置项不存在');
    }

    const before = await this.prisma.systemConfig.findUnique({
      where: { configKey },
      include: { updatedByAdmin: true },
    });
    const normalizedValue = this.normalizeSystemConfigValue(definition, dto.value);
    const updated = await this.prisma.systemConfig.upsert({
      where: { configKey },
      update: {
        category: definition.category,
        label: definition.label,
        value: normalizedValue,
        valueType: definition.value_type,
        description: definition.description,
        updatedByAdminId: admin.id,
      },
      create: {
        configKey,
        category: definition.category,
        label: definition.label,
        value: normalizedValue,
        valueType: definition.value_type,
        description: definition.description,
        updatedByAdminId: admin.id,
      },
      include: { updatedByAdmin: true },
    });

    await this.auditLogService.create({
      actor_type: ActorType.admin,
      actor_id: admin.id,
      action: 'admin_update_system_config',
      target_type: 'system_config',
      target_id: updated.id,
      ip_address: request.ip,
      user_agent: request.headers['user-agent'] ?? null,
      metadata: {
        config_key: configKey,
        category: definition.category,
        category_label: systemConfigCategoryLabel(definition.category),
        before_value: auditConfigValue(definition, before?.value ?? definition.envValue()),
        after_value: auditConfigValue(definition, updated.value),
        reason: dto.reason,
      },
    });

    return {
      ...this.toSystemConfigItem(definition, updated),
      changed: this.systemConfigValuesDiffer(definition, before?.value ?? definition.envValue(), updated.value),
    };
  }

  async updateAiSettings(admin: AuthenticatedAdmin, dto: AdminUpdateAiSettingsDto, request: Request) {
    if (isStrictEnvironment() && dto.provider === 'mock') {
      throw new BadRequestException('生产环境不能使用 mock AI 服务');
    }
    const beforeRows = await this.prisma.systemConfig.findMany({
      where: { configKey: { in: AI_SETTING_KEYS as unknown as string[] } },
    });
    const beforeMap = new Map(beforeRows.map((item) => [item.configKey, item.value]));
    const existingApiKey = beforeMap.get('ai_api_key') ?? readEnvString('AI_API_KEY');
    const hasApiKey = Boolean(dto.api_key?.trim() || plainSecretValue(existingApiKey));
    if (dto.provider !== 'mock' && (!dto.base_url || !dto.model || !hasApiKey)) {
      throw new BadRequestException('AI 供应商、接口地址、模型和 API Key 都是必填项');
    }

    const values = new Map<(typeof AI_SETTING_KEYS)[number], string>([
      ['ai_provider', dto.provider],
      ['ai_base_url', dto.base_url],
      ['ai_model', dto.model],
      ['ai_timeout_ms', String(dto.timeout_ms)],
      ['ai_daily_limit_per_user', String(dto.daily_limit_per_user)],
    ]);
    if (dto.api_key) values.set('ai_api_key', dto.api_key);

    const definitions = AI_SETTING_KEYS.map((key) => {
      const definition = getSystemConfigDefinition(key);
      if (!definition) throw new BadRequestException(`AI 配置项缺失：${key}`);
      return definition;
    });
    const updatedRows = await this.prisma.$transaction(
      definitions
        .filter((definition) => values.has(definition.key as (typeof AI_SETTING_KEYS)[number]))
        .map((definition) => {
          const value = values.get(definition.key as (typeof AI_SETTING_KEYS)[number]) ?? '';
          const normalizedValue = this.normalizeSystemConfigValue(definition, value);
          return this.prisma.systemConfig.upsert({
            where: { configKey: definition.key },
            update: {
              category: definition.category,
              label: definition.label,
              value: normalizedValue,
              valueType: definition.value_type,
              description: definition.description,
              updatedByAdminId: admin.id,
            },
            create: {
              configKey: definition.key,
              category: definition.category,
              label: definition.label,
              value: normalizedValue,
              valueType: definition.value_type,
              description: definition.description,
              updatedByAdminId: admin.id,
            },
            include: { updatedByAdmin: true },
          });
        }),
    );

    await this.auditLogService.create({
      actor_type: ActorType.admin,
      actor_id: admin.id,
      action: 'admin_update_ai_settings',
      target_type: 'system_config',
      target_id: null,
      ip_address: request.ip,
      user_agent: request.headers['user-agent'] ?? null,
      metadata: {
        keys: updatedRows.map((item) => item.configKey),
        before: Object.fromEntries(
          definitions.map((definition) => [
            definition.key,
            auditConfigValue(definition, beforeMap.get(definition.key) ?? definition.envValue()),
          ]),
        ),
        after: Object.fromEntries(updatedRows.map((item) => [item.configKey, auditConfigValue(getSystemConfigDefinition(item.configKey)!, item.value)])),
        reason: dto.reason,
      },
    });

    const rowsByKey = new Map(updatedRows.map((item) => [item.configKey, item]));
    return {
      changed: updatedRows.some((item) => this.systemConfigValuesDiffer(getSystemConfigDefinition(item.configKey)!, beforeMap.get(item.configKey) ?? getSystemConfigDefinition(item.configKey)?.envValue() ?? '', item.value)),
      list: definitions.map((definition) => this.toSystemConfigItem(definition, rowsByKey.get(definition.key))),
    };
  }

  async logout(admin: AuthenticatedAdmin, request: Request) {
    const jti = this.readBearerJwtId(request);
    if (jti) {
      await this.prisma.adminSession.updateMany({
        where: {
          adminId: admin.id,
          accessTokenJtiHash: hashToken(jti),
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    }

    await this.auditLogService.create({
      actor_type: ActorType.admin,
      actor_id: admin.id,
      action: 'admin_logout',
      target_type: 'admin_user',
      target_id: admin.id,
      ip_address: request.ip,
      user_agent: request.headers['user-agent'] ?? null,
    });

    return { success: true };
  }

  async changePassword(admin: AuthenticatedAdmin, dto: AdminChangePasswordDto, request: Request) {
    if (dto.new_password !== dto.new_password_confirm) {
      throw new BadRequestException('两次输入的新密码不一致');
    }
    if (dto.current_password === dto.new_password) {
      throw new BadRequestException('新密码不能与当前密码相同');
    }

    const current = await this.prisma.adminUser.findFirst({
      where: { id: admin.id, status: ADMIN_ACTIVE_STATUS, deletedAt: null },
    });
    if (!current) {
      throw new UnauthorizedException('后台登录状态已失效');
    }

    const valid = await bcrypt.compare(dto.current_password, current.passwordHash);
    if (!valid) {
      throw new BadRequestException('当前密码不正确');
    }

    const now = new Date();
    const passwordHash = await bcrypt.hash(dto.new_password, 10);
    const [, revokedSessions] = await this.prisma.$transaction([
      this.prisma.adminUser.update({
        where: { id: current.id },
        data: {
          passwordHash,
          tokenInvalidBefore: now,
        },
      }),
      this.prisma.adminSession.updateMany({
        where: { adminId: current.id, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);

    await this.auditLogService.create({
      actor_type: ActorType.admin,
      actor_id: admin.id,
      action: 'admin_change_password',
      target_type: 'admin_user',
      target_id: current.id,
      ip_address: request.ip,
      user_agent: request.headers['user-agent'] ?? null,
      metadata: { revoked_sessions: revokedSessions.count },
    });

    return {
      success: true,
      revoked_sessions: revokedSessions.count,
      changed_at: now.toISOString(),
    };
  }

  async testAiSettings(admin: AuthenticatedAdmin, request: Request): Promise<AdminAiSettingsTestResult> {
    const checkedAt = new Date();
    const startedAt = Date.now();
    const config = await this.runtimeConfigService.getAiConfig();
    const result = await this.performAiSettingsTest(config, startedAt, checkedAt);

    await this.auditLogService.create({
      actor_type: ActorType.admin,
      actor_id: admin.id,
      action: 'admin_test_ai_settings',
      target_type: 'system_config',
      target_id: null,
      ip_address: request.ip,
      user_agent: request.headers['user-agent'] ?? null,
      metadata: {
        provider: result.provider,
        model: result.model,
        base_url: result.base_url,
        status: result.status,
        latency_ms: result.latency_ms,
        message: result.message,
      },
    });

    return result;
  }

  async opsReadiness(admin: AuthenticatedAdmin, request: Request) {
    const now = new Date();
    const [
      userCount,
      familyCount,
      childCount,
      recordCount,
      mediaCount,
      auditCount,
      archiveExportRequestCount,
      pendingArchiveExportRequestCount,
      supportTicketCount,
      openSupportTicketCount,
      recordContentRiskCount,
      childSafetyTicketCount,
      mediaExceptionCount,
      failedMediaCount,
      failedAiJobCount,
      systemConfigRows,
    ] = await this.prisma.$transaction([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.family.count({ where: { deletedAt: null } }),
      this.prisma.child.count({ where: { deletedAt: null } }),
      this.prisma.record.count({ where: { deletedAt: null } }),
      this.prisma.recordMedia.count({ where: { deletedAt: null } }),
      this.prisma.auditLog.count(),
      this.prisma.archiveExportRequest.count(),
      this.prisma.archiveExportRequest.count({
        where: {
          status: { in: [ArchiveExportRequestStatus.submitted, ArchiveExportRequestStatus.processing] },
        },
      }),
      this.prisma.supportTicket.count(),
      this.prisma.supportTicket.count({
        where: {
          status: { in: [SupportTicketStatus.submitted, SupportTicketStatus.processing] },
        },
      }),
      this.prisma.record.count({ where: { deletedAt: null, OR: contentRiskKeywordWhere } }),
      this.prisma.supportTicket.count({
        where: {
          priority: SupportTicketPriority.child_safety,
          status: { in: [SupportTicketStatus.submitted, SupportTicketStatus.processing] },
        },
      }),
      this.prisma.recordMedia.count({ where: { deletedAt: null, ...mediaExceptionCondition } }),
      this.prisma.recordMedia.count({ where: { deletedAt: null, status: MEDIA_STATUS_FAILED } }),
      this.prisma.aiJob.count({ where: { status: AiJobStatus.failed } }),
      this.prisma.systemConfig.findMany({ where: { configKey: { in: SYSTEM_CONFIG_KEYS } }, include: { updatedByAdmin: true } }),
    ]);

    const appEnv = getAppEnv();
    const strictEnvironment = isStrictEnvironment();
    const storageProvider = getStorageProviderName();
    const aiProvider = await this.runtimeConfigService.getAiProviderName();
    const mapProvider = getMapProviderName();
    const smsEnabled = isSmsEnabled();
    const smsProvider = smsEnabled ? getSmsProviderName() : 'disabled';
    const corsOrigins = resolveCorsOrigins();
    const operationConfig = this.resolveOperationConfig(systemConfigRows);
    const backupRetentionDays = operationConfig.backupRetentionDays;
    const backupRunbookUrl = operationConfig.backupRunbookUrl;
    const backupRestoreDrillAt = operationConfig.backupRestoreDrillAt;
    const alertContactName = operationConfig.alertContactName;
    const alertContactChannel = operationConfig.alertContactChannel;
    const backupDrillAgeDays = daysSince(backupRestoreDrillAt, now);
    const backupDrillStatus: OpsReadinessStatus = !backupRestoreDrillAt || (backupDrillAgeDays !== null && backupDrillAgeDays > 180) ? 'warning' : 'ready';
    const backupRunbookStatus: OpsReadinessStatus = backupRunbookUrl ? 'ready' : strictEnvironment ? 'blocked' : 'warning';
    const backupRetentionStatus: OpsReadinessStatus = backupRetentionDays >= 90 ? 'ready' : strictEnvironment ? 'blocked' : 'warning';
    const alertContactStatus: OpsReadinessStatus = alertContactName && alertContactChannel ? 'ready' : strictEnvironment ? 'blocked' : 'warning';
    const storageStatus = toProviderStatus(storageProvider);
    const aiStatus = toProviderStatus(aiProvider);
    const mapStatus = toProviderStatus(mapProvider, { disabledIsWarning: true });
    const smsStatus = smsProvider === 'disabled' ? 'ready' : toProviderStatus(smsProvider);
    const corsStatus: OpsReadinessStatus = corsOrigins === true ? (strictEnvironment ? 'blocked' : 'warning') : 'ready';
    const adminBootstrapStatus: OpsReadinessStatus = isAdminBootstrapAllowed() && strictEnvironment ? 'blocked' : 'ready';
    const cookieStatus: OpsReadinessStatus = isSecureCookieEnvironment() ? 'ready' : strictEnvironment ? 'blocked' : 'warning';
    const contentRiskCount = recordContentRiskCount + childSafetyTicketCount + mediaExceptionCount + failedAiJobCount;
    const liveReadinessReport = readLiveReadinessReport(now);
    const aiLiveReadinessEvidence = { providerKey: 'ai' as const, currentProvider: aiProvider, label: 'AI' };
    const poiLiveReadinessEvidence = { providerKey: 'map' as const, currentProvider: mapProvider, label: '地图' };
    const aiLiveGateStatus = reportCheckStatus(liveReadinessReport, 'aiPreview', aiStatus, strictEnvironment, aiLiveReadinessEvidence);
    const poiProviderStatus: OpsReadinessStatus = mapProvider === 'amap' ? 'ready' : strictEnvironment ? 'blocked' : 'warning';
    const poiLiveGateStatus = reportCheckStatus(liveReadinessReport, 'poi', poiProviderStatus, strictEnvironment, poiLiveReadinessEvidence);
    const reportStatus: OpsReadinessStatus =
      liveReadinessReport.status === 'passed'
        ? 'ready'
        : liveReadinessReport.status === 'conditional_pass'
          ? 'warning'
        : liveReadinessReport.status === 'failed'
          ? liveReadinessStatusFromRequirementDetails(liveReadinessReport.blocked_requirement_details, 'blocked')
          : liveReadinessReport.status === 'missing' || liveReadinessReport.status === 'stale'
          ? strictEnvironment
            ? 'blocked'
            : 'warning'
          : 'blocked';
    const liveReadinessReportStatus = newestStatus(aiLiveGateStatus, poiLiveGateStatus);
    const providerActionPriority = liveReadinessActionPriority(liveReadinessReport, liveReadinessReportStatus, strictEnvironment);
    const providerActionHelper = liveReadinessReport.blocked_requirement_details.length
      ? `${liveReadinessReport.blocked_requirement_details.map((item) => `${item.severity} ${item.requirement}`).join('、')}：修复后执行带测试账号的 verify:live-readiness。`
      : '执行带测试账号的 verify:live-readiness，并保留 live-readiness-latest.json 作为上线证据。';

    const riskItems = [
      ...(providerActionPriority
        ? [
            {
              priority: providerActionPriority,
              label: '复验真实 provider',
              helper: providerActionHelper,
              to: '/ops-readiness',
            },
          ]
        : []),
      ...(contentRiskCount > 0
        ? [{ priority: 'P0', label: '处理内容风险', helper: `${contentRiskCount} 个内容、媒体、儿童安全或 AI 风险项需要复核。`, to: '/content-risks' }]
        : []),
      ...(pendingArchiveExportRequestCount > 0
        ? [{ priority: 'P0', label: '处理档案交付申请', helper: `${pendingArchiveExportRequestCount} 个导出或成年移交申请仍在处理中。`, to: '/archive-export-requests' }]
        : []),
      ...(openSupportTicketCount > 0
        ? [{ priority: 'P0', label: '处理客服反馈', helper: `${openSupportTicketCount} 个客服反馈仍未关闭。`, to: '/support-tickets' }]
        : []),
      ...(mediaExceptionCount > 0
        ? [{ priority: 'P0', label: '复核异常媒体', helper: `${mediaExceptionCount} 个媒体对象处于失败、长期上传中或未关联记录状态。`, to: '/media' }]
        : []),
      ...(failedAiJobCount > 0
        ? [{ priority: 'P1', label: '重试失败 AI 任务', helper: `${failedAiJobCount} 个 AI 任务失败，可能影响摘要和标签。`, to: '/ai-jobs' }]
        : []),
      ...(newestStatus(backupDrillStatus, backupRunbookStatus, backupRetentionStatus) !== 'ready'
        ? [{ priority: 'P0', label: '补齐备份恢复证据', helper: '备份保留、恢复演练或运维手册还没有达到运营标准。', to: '/system-config' }]
        : []),
    ];

    await this.logListAudit(admin, 'admin_view_ops_readiness', request);

    return {
      generated_at: now.toISOString(),
      environment: {
        app_env: appEnv,
        node_env: process.env.NODE_ENV ?? null,
        app_port: getAppPort(),
        secure_cookie: isSecureCookieEnvironment(),
        admin_bootstrap_enabled: isAdminBootstrapAllowed(),
        cors_origins: corsOrigins === true ? ['本地开发放开'] : corsOrigins,
      },
      providers: [
        { key: 'storage', label: '对象存储', value: providerValueLabel(storageProvider), status: storageStatus, helper: storageStatus === 'ready' ? '媒体上传与长期归档可使用真实存储。' : '当前不是正式存储，正式环境必须切换。' },
        { key: 'ai', label: 'AI 服务', value: providerValueLabel(aiProvider), status: aiStatus, helper: aiStatus === 'ready' ? '摘要、标题和标签生成已接入正式服务。' : '当前 AI 服务配置只能用于本地验证。' },
        { key: 'map', label: '地点服务', value: providerValueLabel(mapProvider), status: mapStatus, helper: mapProvider === 'disabled' ? '地点能力已显式关闭，需在运营记录中说明。' : '用于地点搜索、定位和回看。' },
        { key: 'sms', label: '短信服务', value: providerValueLabel(smsProvider), status: smsStatus, helper: smsEnabled ? '短信服务已开启。' : '当前登录采用账号密码和邀请码，短信保持关闭。' },
        { key: 'cors', label: '跨域来源', value: corsOrigins === true ? '本地开发放开' : `${corsOrigins.length} 个来源`, status: corsStatus, helper: corsStatus === 'ready' ? '跨域来源已显式配置。' : '本地放开仅适合开发环境。' },
        { key: 'cookie', label: '会话安全', value: isSecureCookieEnvironment() ? '已开启' : '本地模式', status: cookieStatus, helper: cookieStatus === 'ready' ? '生产会话安全策略已开启。' : '非生产环境不会强制安全 Cookie。' },
        { key: 'bootstrap', label: '后台初始化', value: isAdminBootstrapAllowed() ? '允许' : '关闭', status: adminBootstrapStatus, helper: adminBootstrapStatus === 'ready' ? '生产默认关闭后台初始化入口。' : '生产环境不应长期允许后台初始化。' },
      ],
      data_statistics: {
        users: userCount,
        families: familyCount,
        children: childCount,
        records: recordCount,
        media: mediaCount,
        audit_logs: auditCount,
        archive_export_requests: archiveExportRequestCount,
        support_tickets: supportTicketCount,
        pending_archive_export_requests: pendingArchiveExportRequestCount,
        open_support_tickets: openSupportTicketCount,
        content_risks: contentRiskCount,
        media_exceptions: mediaExceptionCount,
        failed_media: failedMediaCount,
        failed_ai_jobs: failedAiJobCount,
      },
      backup_recovery: {
        status: newestStatus(backupDrillStatus, backupRunbookStatus, backupRetentionStatus, alertContactStatus),
        checks: [
          { key: 'retention', label: '备份保留周期', value: `${backupRetentionDays} 天`, status: backupRetentionStatus, helper: backupRetentionStatus === 'ready' ? '满足长期托管的最低恢复窗口。' : '建议至少保留 90 天。' },
          { key: 'runbook', label: '恢复手册', value: backupRunbookUrl ?? '未配置', status: backupRunbookStatus, helper: backupRunbookUrl ? '运营可按手册执行恢复流程。' : '缺少恢复手册地址，运营无法独立处理。' },
          { key: 'restore_drill', label: '最近恢复演练', value: backupRestoreDrillAt ?? '未记录', status: backupDrillStatus, helper: backupRestoreDrillAt ? `距离本次检查 ${backupDrillAgeDays ?? 0} 天。` : '需要留下恢复演练证据。' },
          {
            key: 'alert_contact',
            label: '告警联系人',
            value: alertContactName && alertContactChannel ? `${alertContactName} / ${alertContactChannel}` : '未配置',
            status: alertContactStatus,
            helper: alertContactStatus === 'ready' ? '异常告警和恢复值班有明确负责人。' : '缺少告警联系人，线上异常会依赖开发临时介入。',
          },
        ],
      },
      release_gates: {
        status: liveReadinessReportStatus,
        report: liveReadinessReport,
        checks: [
          {
            key: 'ai_live_readiness',
            label: 'AI 真实调用',
            value: liveReadinessReport.checked_at ? `${providerValueLabel(aiProvider)} / ${liveReadinessReport.checked_at}` : providerValueLabel(aiProvider),
            status: aiLiveGateStatus,
            helper: reportHelper(
              liveReadinessReport,
              'aiPreview',
              '最新 live readiness 报告已验证 AI 预览真实返回标题、摘要或标签。',
              aiLiveGateStatus === 'blocked'
                ? '生产不能使用 mock/disabled AI；需替换为真实兼容 /chat/completions 的 provider。'
                : 'provider 名称只说明配置存在；仍需 verify:live-readiness 登录后验证 AI 预览真实返回标题、摘要或标签。',
              aiLiveReadinessEvidence,
            ),
          },
          {
            key: 'poi_live_readiness',
            label: '地点 POI 真实搜索',
            value: liveReadinessReport.checked_at ? `${providerValueLabel(mapProvider)} / ${liveReadinessReport.checked_at}` : providerValueLabel(mapProvider),
            status: poiLiveGateStatus,
            helper: reportHelper(
              liveReadinessReport,
              'poi',
              '最新 live readiness 报告已验证 source=amap 的文本 POI 候选。',
              poiLiveGateStatus === 'blocked'
                ? '生产地点 provider 必须为 amap，并通过高德 Web 服务 Key 的真实 POI 搜索。'
                : 'amap-regeo 只能证明逆地理定位；仍需 verify:live-readiness 验证 source=amap 的文本 POI 候选。',
              poiLiveReadinessEvidence,
            ),
          },
          {
            key: 'live_readiness_report',
            label: '上线复验报告',
            value: liveReadinessReport.path,
            status: reportStatus,
            helper:
              liveReadinessReport.status === 'passed'
                ? `报告 ${liveReadinessReport.age_hours ?? 0} 小时内生成，可作为发布决策证据。`
                : liveReadinessReport.status === 'conditional_pass'
                  ? `P0 live readiness 已通过，报告含 ${liveReadinessReport.blocked_requirements.join('、') || 'P1/P2'} 延期项，需按发布清单记录后续 owner。`
                : '修复 provider 后必须重新执行 verify:live-readiness，保留 JSON 报告用于发布决策和交接。',
          },
        ],
      },
      action_items: riskItems.length
        ? riskItems
        : [{ priority: '正常', label: '暂无阻塞项', helper: '系统配置、数据统计和备份恢复检查未发现当前阻塞。', to: '/dashboard' }],
    };
  }

  async userDetail(admin: AuthenticatedAdmin, userNo: string, request: Request) {
    const user = await this.prisma.user.findFirst({
      where: { userNo, deletedAt: null },
      include: {
        ownedChildren: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        familyMemberships: {
          where: { deletedAt: null },
          include: { family: true },
          orderBy: { createdAt: 'desc' },
        },
        authAccounts: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    await this.logListAudit(admin, 'admin_view_user_detail', request);

    return {
      user_no: user.userNo,
      nickname: user.nickname,
      avatar_url: user.avatarUrl,
      mobile: user.mobile,
      email: user.email,
      membership_type: user.membershipType,
      membership_expire_at: user.membershipExpireAt?.toISOString() ?? null,
      status: statusToUserLabel(user.status),
      last_login_at: user.lastLoginAt?.toISOString() ?? null,
      created_at: user.createdAt.toISOString(),
      updated_at: user.updatedAt.toISOString(),
      auth_accounts: user.authAccounts.map((account) => ({
        auth_type: account.authType,
        auth_key: account.authKey,
        status: account.status === USER_ACTIVE_STATUS ? 'active' : 'disabled',
        created_at: account.createdAt.toISOString(),
        updated_at: account.updatedAt.toISOString(),
      })),
      children: user.ownedChildren.map((child) => ({
        child_no: child.childNo,
        name: child.name,
        birthday: toDateOnly(child.birthday),
        gender: child.gender,
        status: statusToChildLabel(child.status, child.deletedAt),
      })),
      families: user.familyMemberships.map((membership) => ({
        family_no: membership.family.familyNo,
        family_name: membership.family.name,
        role: membership.role,
        status: membership.status === USER_ACTIVE_STATUS ? 'active' : 'disabled',
        joined_at: membership.joinedAt?.toISOString() ?? null,
      })),
    };
  }

  async familyDetail(admin: AuthenticatedAdmin, familyNo: string, request: Request) {
    const family = await this.prisma.family.findFirst({
      where: { familyNo, deletedAt: null },
      include: {
        owner: true,
        members: {
          where: { deletedAt: null },
          include: { user: true },
          orderBy: { createdAt: 'desc' },
        },
        children: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
        },
        records: {
          where: { deletedAt: null },
          include: { child: true, creator: true },
          orderBy: { eventTime: 'desc' },
          take: 8,
        },
        archiveExportRequests: {
          include: { child: true, user: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!family) {
      throw new NotFoundException('家庭不存在');
    }

    await this.logListAudit(admin, 'admin_view_family_detail', request);

    return {
      family_no: family.familyNo,
      family_name: family.name,
      owner_user_no: family.owner.userNo,
      owner_name: family.owner.nickname,
      owner_mobile: family.owner.mobile,
      status: statusToFamilyLabel(family.status, family.deletedAt),
      created_at: family.createdAt.toISOString(),
      updated_at: family.updatedAt.toISOString(),
      members: family.members.map((member) => ({
        user_no: member.user.userNo,
        nickname: member.user.nickname,
        mobile: member.user.mobile,
        role: member.role,
        status: statusToUserLabel(member.status),
        joined_at: member.joinedAt?.toISOString() ?? null,
      })),
      children: family.children.map((child) => ({
        child_no: child.childNo,
        name: child.name,
        birthday: toDateOnly(child.birthday),
        gender: child.gender,
        status: statusToChildLabel(child.status, child.deletedAt),
      })),
      recent_records: family.records.map((record) => ({
        record_no: record.recordNo,
        child_no: record.child.childNo,
        child_name: record.child.name,
        title: record.title,
        record_type: record.recordType,
        status: statusToRecordLabel(record.status),
        creator_name: record.creator.nickname,
        event_time: record.eventTime.toISOString(),
      })),
      archive_export_requests: family.archiveExportRequests.map((item) => ({
        request_no: item.requestNo,
        child_no: item.child.childNo,
        child_name: item.child.name,
        user_no: item.user.userNo,
        user_name: item.user.nickname,
        purpose: item.purpose,
        status: item.status,
        created_at: item.createdAt.toISOString(),
      })),
    };
  }

  async childDetail(admin: AuthenticatedAdmin, childNo: string, request: Request) {
    const child = await this.prisma.child.findFirst({
      where: { childNo, deletedAt: null },
      include: {
        family: {
          include: {
            members: {
              where: { deletedAt: null },
              include: { user: true },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        owner: true,
        records: {
          where: { deletedAt: null },
          orderBy: { eventTime: 'desc' },
          take: 5,
          include: {
            creator: true,
            media: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 1 },
            _count: { select: { media: true } },
          },
        },
      },
    });

    if (!child) {
      throw new NotFoundException('孩子档案不存在');
    }

    await this.logListAudit(admin, 'admin_view_child_detail', request);

    return {
      child_no: child.childNo,
      family_no: child.family.familyNo,
      family_name: child.family.name,
      owner_user_no: child.owner.userNo,
      owner_name: child.owner.nickname,
      name: child.name,
      avatar_url: await this.resolveChildAvatarUrl(child.id, child.avatarUrl),
      avatar_media_no: parseMediaReference(child.avatarUrl),
      birthday: toDateOnly(child.birthday),
      current_age_display: ageDisplay(child.birthday),
      gender: child.gender,
      birth_place: child.birthPlace,
      remark: child.remark,
      status: statusToChildLabel(child.status, child.deletedAt),
      created_at: child.createdAt.toISOString(),
      updated_at: child.updatedAt.toISOString(),
      family_members: await Promise.all(child.family.members.map(async (member) => ({
        user_no: member.user.userNo,
        nickname: member.user.nickname,
        avatar_url: await this.resolveUserAvatarUrl(member.user.id, member.user.avatarUrl),
        avatar_media_no: parseMediaReference(member.user.avatarUrl),
        mobile: member.user.mobile,
        role: member.role,
        status: member.status === USER_ACTIVE_STATUS ? 'active' : 'disabled',
        joined_at: member.joinedAt?.toISOString() ?? null,
      }))),
      recent_records: await Promise.all(child.records.map(async (record) => ({
        record_no: record.recordNo,
        title: record.title,
        record_type: record.recordType,
        status: statusToRecordLabel(record.status),
        creator_user_no: record.creator.userNo,
        creator_name: record.creator.nickname,
        media_count: record._count.media,
        cover_url: await this.resolveMediaThumbnailUrl(record.media[0] ?? null),
        event_time: record.eventTime.toISOString(),
        created_at: record.createdAt.toISOString(),
        published_at: record.publishedAt?.toISOString() ?? null,
      }))),
    };
  }

  async recordDetail(admin: AuthenticatedAdmin, recordNo: string, request: Request) {
    const record = await this.prisma.record.findFirst({
      where: { recordNo, deletedAt: null },
      include: {
        child: true,
        family: true,
        creator: true,
        tags: true,
        media: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
        aiJobs: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!record) {
      throw new NotFoundException('成长记录不存在');
    }

    await this.logListAudit(admin, 'admin_view_record_detail', request);

    return {
      record_no: record.recordNo,
      child_no: record.child.childNo,
      child_name: record.child.name,
      family_no: record.family.familyNo,
      creator_user_no: record.creator.userNo,
      creator_name: record.creator.nickname,
      record_type: record.recordType,
      title: record.title,
      content_text: record.contentText,
      tags: record.tags.map((tag) => ({ tag_name: tag.tagName, source: tag.source })),
      media_list: await Promise.all(record.media.map((item) => this.toMediaItem(item, admin))),
      ai_jobs: record.aiJobs.map((job) => this.toAiJobItem(job)),
      event_time: record.eventTime.toISOString(),
      location_text: record.locationText,
      visibility_scope: record.visibilityScope,
      is_milestone: record.isMilestone,
      ai_generated_title: record.aiGeneratedTitle,
      ai_summary: record.aiSummary,
      ai_status: record.aiStatus,
      status: statusToRecordLabel(record.status),
      published_at: record.publishedAt?.toISOString() ?? null,
      created_at: record.createdAt.toISOString(),
      updated_at: record.updatedAt.toISOString(),
    };
  }

  async updateRecordStatus(admin: AuthenticatedAdmin, recordNo: string, dto: AdminUpdateRecordStatusDto, request: Request) {
    const record = await this.prisma.record.findFirst({
      where: { recordNo, deletedAt: null },
      include: {
        media: {
          where: { deletedAt: null, status: MEDIA_STATUS_READY },
          select: { id: true },
        },
      },
    });

    if (!record) {
      throw new NotFoundException('成长记录不存在');
    }

    const nextStatus = dto.status === 'published' ? RECORD_STATUS_PUBLISHED : RECORD_STATUS_DRAFT;
    if (nextStatus === RECORD_STATUS_PUBLISHED) {
      const hasText = Boolean(record.title?.trim() || record.contentText?.trim());
      if (!hasText && record.media.length === 0) {
        throw new BadRequestException('记录缺少正文、标题或可用媒体，不能发布');
      }
    }

    if (record.status === nextStatus) {
      return {
        record_no: record.recordNo,
        status: dto.status,
        changed: false,
      };
    }

    const updated = await this.prisma.record.update({
      where: { id: record.id },
      data: {
        status: nextStatus,
        publishedAt: nextStatus === RECORD_STATUS_PUBLISHED ? new Date() : null,
      },
    });

    await this.auditLogService.create({
      actor_type: ActorType.admin,
      actor_id: admin.id,
      action: nextStatus === RECORD_STATUS_PUBLISHED ? 'admin_restore_record' : 'admin_unpublish_record',
      target_type: 'record',
      target_id: updated.id,
      ip_address: request.ip,
      user_agent: request.headers['user-agent'] ?? null,
      metadata: {
        record_no: updated.recordNo,
        before_status: statusToRecordLabel(record.status),
        after_status: statusToRecordLabel(updated.status),
        reason: dto.reason ?? null,
      },
    });

    return {
      record_no: updated.recordNo,
      status: statusToRecordLabel(updated.status),
      changed: true,
    };
  }

  async mediaDetail(admin: AuthenticatedAdmin, mediaNo: string, request: Request) {
    const media = await this.prisma.recordMedia.findFirst({
      where: { mediaNo, deletedAt: null },
      include: {
        record: true,
        child: true,
        family: true,
        uploader: true,
      },
    });

    if (!media) {
      throw new NotFoundException('媒体不存在');
    }

    await this.logListAudit(admin, 'admin_view_media_detail', request);

    return {
      ...(await this.toMediaItem(media, admin)),
      family_no: media.family.familyNo,
      child_no: media.child?.childNo ?? null,
      child_name: media.child?.name ?? null,
      record_no: media.record?.recordNo ?? null,
      record_title: media.record?.title ?? null,
      uploader_user_no: media.uploader.userNo,
      uploader_name: media.uploader.nickname,
      uploader_mobile: this.canViewSensitiveMediaFields(admin) ? media.uploader.mobile : null,
    };
  }

  async updateMediaStatus(admin: AuthenticatedAdmin, mediaNo: string, dto: AdminUpdateMediaStatusDto, request: Request) {
    const media = await this.prisma.recordMedia.findFirst({
      where: { mediaNo, deletedAt: null },
    });

    if (!media) {
      throw new NotFoundException('媒体不存在');
    }

    const nextStatus = mediaStatusToNumber(dto.status);
    // Mock media is intentionally represented without a real object-store object.
    // Production-backed media must still pass the storage existence check before approval.
    if (nextStatus === MEDIA_STATUS_READY && media.storageProvider !== 'mock') {
      const uploaded = await this.storageService.headObject(media.objectKey).catch(() => null);
      if (!uploaded?.exists) {
        throw new BadRequestException('媒体文件不存在，不能标记为可用');
      }
    }

    if (media.status === nextStatus) {
      return {
        media_no: media.mediaNo,
        status: statusToMediaLabel(media.status),
        changed: false,
      };
    }

    const updated = await this.prisma.recordMedia.update({
      where: { id: media.id },
      data: {
        status: nextStatus,
        failureReason: nextStatus === MEDIA_STATUS_READY ? null : dto.reason,
        retryCount: nextStatus === MEDIA_STATUS_READY ? media.retryCount : { increment: 1 },
      },
    });

    await this.auditLogService.create({
      actor_type: ActorType.admin,
      actor_id: admin.id,
      action: nextStatus === MEDIA_STATUS_READY ? 'admin_approve_media' : nextStatus === MEDIA_STATUS_REMOVED ? 'admin_remove_media' : 'admin_reject_media',
      target_type: 'media',
      target_id: updated.id,
      ip_address: request.ip,
      user_agent: request.headers['user-agent'] ?? null,
      metadata: {
        media_no: updated.mediaNo,
        before_status: statusToMediaLabel(media.status),
        after_status: statusToMediaLabel(updated.status),
        reason: dto.reason,
      },
    });

    return {
      media_no: updated.mediaNo,
      status: statusToMediaLabel(updated.status),
      changed: true,
    };
  }

  async aiJobDetail(admin: AuthenticatedAdmin, jobNo: string, request: Request) {
    const job = await this.prisma.aiJob.findFirst({
      where: { jobNo },
      include: {
        record: true,
        family: true,
        requester: true,
      },
    });

    if (!job) {
      throw new NotFoundException('AI 任务不存在');
    }

    await this.logListAudit(admin, 'admin_view_ai_job_detail', request);

    return {
      ...this.toAiJobItem(job),
      family_no: job.family.familyNo,
      requester_name: job.requester.nickname,
      requester_mobile: job.requester.mobile,
      record_title: job.record?.title ?? null,
      input_snapshot: job.inputSnapshot,
      output_json: job.outputJson,
      started_at: job.startedAt?.toISOString() ?? null,
      finished_at: job.finishedAt?.toISOString() ?? null,
      updated_at: job.updatedAt.toISOString(),
    };
  }

  async retryAiJob(admin: AuthenticatedAdmin, jobNo: string, dto: AdminAiJobActionDto, request: Request) {
    const job = await this.prisma.aiJob.findFirst({ where: { jobNo } });
    if (!job) {
      throw new NotFoundException('AI 任务不存在');
    }

    if (job.status !== AiJobStatus.failed && job.status !== AiJobStatus.cancelled) {
      throw new BadRequestException('当前任务状态不允许重试');
    }

    const updated = await this.prisma.aiJob.update({
      where: { id: job.id },
      data: {
        status: AiJobStatus.pending,
        errorMessage: null,
        retryCount: { increment: 1 },
        startedAt: null,
        finishedAt: null,
      },
    });

    await this.auditLogService.create({
      actor_type: ActorType.admin,
      actor_id: admin.id,
      action: 'admin_retry_ai_job',
      target_type: 'ai_job',
      target_id: updated.id,
      ip_address: request.ip,
      user_agent: request.headers['user-agent'] ?? null,
      metadata: {
        job_no: updated.jobNo,
        before_status: job.status,
        after_status: updated.status,
        reason: dto.reason ?? null,
      },
    });

    await this.aiJobsQueue.enqueue(updated.id);

    return {
      job_no: updated.jobNo,
      status: updated.status,
      retry_count: updated.retryCount,
      changed: true,
    };
  }

  async cancelAiJob(admin: AuthenticatedAdmin, jobNo: string, dto: AdminAiJobActionDto, request: Request) {
    const job = await this.prisma.aiJob.findFirst({ where: { jobNo } });
    if (!job) {
      throw new NotFoundException('AI 任务不存在');
    }

    if (job.status !== AiJobStatus.pending && job.status !== AiJobStatus.processing) {
      throw new BadRequestException('当前任务状态不允许取消');
    }

    const updated = await this.prisma.aiJob.update({
      where: { id: job.id },
      data: {
        status: AiJobStatus.cancelled,
        finishedAt: new Date(),
      },
    });

    await this.auditLogService.create({
      actor_type: ActorType.admin,
      actor_id: admin.id,
      action: 'admin_cancel_ai_job',
      target_type: 'ai_job',
      target_id: updated.id,
      ip_address: request.ip,
      user_agent: request.headers['user-agent'] ?? null,
      metadata: {
        job_no: updated.jobNo,
        before_status: job.status,
        after_status: updated.status,
        reason: dto.reason ?? null,
      },
    });

    return {
      job_no: updated.jobNo,
      status: updated.status,
      changed: true,
    };
  }

  async listSupportTickets(admin: AuthenticatedAdmin, dto: AdminSupportTicketListDto, request: Request) {
    const page = normalizePage(dto.page);
    const pageSize = normalizePageSize(dto.page_size);
    const keyword = dto.keyword?.trim();
    const category = dto.category?.trim();
    const where: Prisma.SupportTicketWhereInput = {
      ...(category ? { category } : {}),
      ...(dto.status ? { status: dto.status } : {}),
      ...(dto.priority ? { priority: dto.priority } : {}),
      ...(keyword
        ? {
            OR: [
              { ticketNo: { contains: keyword } },
              { category: { contains: keyword } },
              { topic: { contains: keyword } },
              { content: { contains: keyword } },
              { contact: { contains: keyword } },
              { handleNote: { contains: keyword } },
              { user: { is: { userNo: { contains: keyword } } } },
              { user: { is: { nickname: { contains: keyword } } } },
              { user: { is: { mobile: { contains: keyword } } } },
            ],
          }
        : {}),
    };

    const [total, list] = await this.prisma.$transaction([
      this.prisma.supportTicket.count({ where }),
      this.prisma.supportTicket.findMany({
        where,
        include: { user: true, assignedAdmin: true },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    await this.logListAudit(admin, 'admin_list_support_tickets', request);

    return {
      list: list.map((item) => this.toSupportTicketItem(item)),
      page,
      page_size: pageSize,
      total,
      has_more: page * pageSize < total,
    };
  }

  async updateSupportTicketStatus(
    admin: AuthenticatedAdmin,
    ticketNo: string,
    dto: AdminUpdateSupportTicketStatusDto,
    request: Request,
  ) {
    const current = await this.prisma.supportTicket.findUnique({
      where: { ticketNo },
      include: { user: true, assignedAdmin: true },
    });

    if (!current) {
      throw new NotFoundException('客服反馈不存在');
    }

    if (current.status === SupportTicketStatus.closed && dto.status !== current.status) {
      throw new BadRequestException('已关闭的客服反馈不能回退处理状态');
    }

    const updated = await this.prisma.supportTicket.update({
      where: { id: current.id },
      data: {
        status: dto.status,
        assignedAdminId: admin.id,
        handledAt: new Date(),
        handleNote: dto.note ?? undefined,
      },
      include: { user: true, assignedAdmin: true },
    });

    await this.auditLogService.create({
      actor_type: ActorType.admin,
      actor_id: admin.id,
      action: supportTicketStatusAction(dto.status),
      target_type: 'support_ticket',
      target_id: updated.id,
      ip_address: request.ip,
      user_agent: request.headers['user-agent'] ?? null,
      metadata: {
        ticket_no: updated.ticketNo,
        before_status: current.status,
        after_status: updated.status,
        category: updated.category,
        priority: updated.priority,
        user_no: updated.user.userNo,
        note: dto.note ?? null,
      },
    });

    return {
      ...this.toSupportTicketItem(updated),
      changed: current.status !== updated.status || (dto.note ?? null) !== (current.handleNote ?? null),
    };
  }

  async listArchiveExportRequests(admin: AuthenticatedAdmin, dto: AdminArchiveExportRequestListDto, request: Request) {
    const page = normalizePage(dto.page);
    const pageSize = normalizePageSize(dto.page_size);
    const keyword = dto.keyword?.trim();
    const where: Prisma.ArchiveExportRequestWhereInput = {
      ...(dto.purpose ? { purpose: dto.purpose } : {}),
      ...(dto.status ? { status: dto.status } : {}),
      ...(keyword
        ? {
            OR: [
              { requestNo: { contains: keyword } },
              { contact: { contains: keyword } },
              { note: { contains: keyword } },
              { processNote: { contains: keyword } },
              { user: { is: { userNo: { contains: keyword } } } },
              { user: { is: { nickname: { contains: keyword } } } },
              { user: { is: { mobile: { contains: keyword } } } },
              { child: { is: { childNo: { contains: keyword } } } },
              { child: { is: { name: { contains: keyword } } } },
              { family: { is: { familyNo: { contains: keyword } } } },
            ],
          }
        : {}),
    };

    const [total, list] = await this.prisma.$transaction([
      this.prisma.archiveExportRequest.count({ where }),
      this.prisma.archiveExportRequest.findMany({
        where,
        include: {
          user: true,
          family: true,
          child: true,
          processedByAdmin: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    await this.logListAudit(admin, 'admin_list_archive_export_requests', request);

    return {
      list: list.map((item) => this.toArchiveExportRequestItem(item)),
      page,
      page_size: pageSize,
      total,
      has_more: page * pageSize < total,
    };
  }

  async updateArchiveExportRequestStatus(
    admin: AuthenticatedAdmin,
    requestNo: string,
    dto: AdminUpdateArchiveExportRequestStatusDto,
    request: Request,
  ) {
    const current = await this.prisma.archiveExportRequest.findUnique({
      where: { requestNo },
      include: {
        user: true,
        family: true,
        child: true,
        processedByAdmin: true,
      },
    });

    if (!current) {
      throw new NotFoundException('档案交付申请不存在');
    }

    if (
      (current.status === ArchiveExportRequestStatus.completed || current.status === ArchiveExportRequestStatus.rejected) &&
      dto.status !== current.status
    ) {
      throw new BadRequestException('已完结的交付申请不能回退处理状态');
    }

    if (dto.status === ArchiveExportRequestStatus.completed && (!dto.download_url || !dto.file_sha256 || !dto.delivery_evidence)) {
      throw new BadRequestException('完成交付必须填写下载地址、文件 SHA256 和交付证据');
    }

    const updated = await this.prisma.archiveExportRequest.update({
      where: { id: current.id },
      data: {
        status: dto.status,
        processedByAdminId: admin.id,
        processedAt: new Date(),
        processNote: dto.note,
        downloadUrl: dto.download_url ?? undefined,
        fileSha256: dto.file_sha256 ?? undefined,
        deliveryEvidence: dto.delivery_evidence ?? undefined,
      },
      include: {
        user: true,
        family: true,
        child: true,
        processedByAdmin: true,
      },
    });

    await this.auditLogService.create({
      actor_type: ActorType.admin,
      actor_id: admin.id,
      action: archiveExportStatusAction(dto.status),
      target_type: 'archive_export_request',
      target_id: updated.id,
      ip_address: request.ip,
      user_agent: request.headers['user-agent'] ?? null,
      metadata: {
        request_no: updated.requestNo,
        before_status: current.status,
        after_status: updated.status,
        purpose: updated.purpose,
        export_type: updated.exportType,
        child_no: updated.child.childNo,
        user_no: updated.user.userNo,
        note: dto.note,
        download_url: dto.download_url ?? null,
        file_sha256: dto.file_sha256 ?? null,
        delivery_evidence: dto.delivery_evidence ?? null,
      },
    });

    return {
      ...this.toArchiveExportRequestItem(updated),
      changed: current.status !== updated.status || (dto.note ?? null) !== (current.processNote ?? null),
    };
  }

  private resolveMembershipExpireAt(membershipType: MembershipType, expireAt: string | null | undefined) {
    if (membershipType === MembershipType.free) {
      return null;
    }

    if (!expireAt) {
      throw new BadRequestException('请选择套餐权益到期时间');
    }

    const parsed = new Date(expireAt);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('套餐权益到期时间格式不正确');
    }

    if (parsed.getTime() <= Date.now()) {
      throw new BadRequestException('套餐权益到期时间必须晚于当前时间');
    }

    return parsed;
  }

  private detectContentRisk(value: string) {
    const normalized = value.trim();
    return CONTENT_RISK_KEYWORDS.find((item) => normalized.includes(item.keyword)) ?? null;
  }

  private supportTicketRiskStatus(status: SupportTicketStatus): ContentRiskStatus {
    if (status === SupportTicketStatus.processing) return 'processing';
    if (status === SupportTicketStatus.resolved || status === SupportTicketStatus.closed) return 'resolved';
    return 'open';
  }

  private matchesContentRiskKeyword(item: AdminContentRiskItem, keyword: string | undefined) {
    if (!keyword) return true;
    const normalized = keyword.toLowerCase();
    return [item.risk_no, item.title, item.subject_no, item.subject_name, item.source_no, item.source_status, item.reason]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalized));
  }

  private async ensureBootstrapAdmin(username: string) {
    const initialUsername = getAdminInitialUsername();
    const initialPassword = getAdminInitialPassword();

    if (username === initialUsername) {
      const existingInitial = await this.prisma.adminUser.findFirst({
        where: { username: initialUsername, deletedAt: null },
      });
      if (existingInitial) {
        return existingInitial;
      }

      if (!isAdminBootstrapAllowed()) {
        throw new UnauthorizedException('账号或密码错误');
      }

      const passwordHash = await bcrypt.hash(initialPassword, 10);
      return this.prisma.adminUser.create({
        data: {
          username: initialUsername,
          passwordHash,
          displayName: '系统管理员',
          role: AdminRole.super_admin,
          status: 1,
        },
      });
    }

    const existing = await this.prisma.adminUser.findFirst({
      where: { username, deletedAt: null },
    });
    if (existing) {
      return existing;
    }

    throw new UnauthorizedException('账号或密码错误');
  }

  private normalizeSystemConfigValue(definition: SystemConfigDefinition, value: string) {
    const trimmed = value.trim();
    if (!trimmed && !['number', 'select', 'secret'].includes(definition.value_type)) {
      return '';
    }

    if (definition.value_type === 'number') {
      const parsed = Number(trimmed);
      const min = definition.min ?? 1;
      const max = definition.max ?? 3650;
      if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
        throw new BadRequestException(`${definition.label}必须是 ${min} 到 ${max} 之间的整数`);
      }
      return String(parsed);
    }

    if (definition.value_type === 'select') {
      const normalized = trimmed.toLowerCase();
      const allowed = definition.options?.map((item) => item.value) ?? [];
      if (!allowed.includes(normalized)) {
        throw new BadRequestException(`${definition.label}必须是允许的选项`);
      }
      return normalized;
    }

    if (definition.value_type === 'secret') {
      if (!trimmed) {
        throw new BadRequestException(`请填写新的${definition.label}`);
      }
      if (trimmed.length > 1000) {
        throw new BadRequestException(`${definition.label}不能超过 1000 个字符`);
      }
      return encryptSystemConfigSecret(trimmed);
    }

    if (definition.value_type === 'url') {
      let parsed: URL;
      try {
        parsed = new URL(trimmed);
      } catch {
        throw new BadRequestException(`${definition.label}必须是有效链接`);
      }
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new BadRequestException(`${definition.label}只支持 http 或 https 链接`);
      }
      return parsed.toString();
    }

    if (definition.value_type === 'datetime') {
      const parsed = Date.parse(trimmed);
      if (Number.isNaN(parsed)) {
        throw new BadRequestException(`${definition.label}必须是有效时间`);
      }
      if (parsed > Date.now() + 60_000) {
        throw new BadRequestException(`${definition.label}不能晚于当前时间`);
      }
      return new Date(parsed).toISOString();
    }

    if (trimmed.length > 200) {
      throw new BadRequestException(`${definition.label}不能超过 200 个字符`);
    }
    return trimmed;
  }

  private readBearerJwtId(request: Request) {
    const header = request.headers.authorization;
    const token = typeof header === 'string' && header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
    if (!token) return null;

    try {
      const [, payload] = token.split('.');
      if (!payload) return null;
      const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
      const decoded = JSON.parse(Buffer.from(normalizedPayload, 'base64').toString('utf8')) as { jti?: unknown };
      return typeof decoded.jti === 'string' && decoded.jti ? decoded.jti : null;
    } catch {
      return null;
    }
  }

  private systemConfigValue(rows: SystemConfigWithUpdater[], key: string) {
    const definition = getSystemConfigDefinition(key);
    if (!definition) return '';
    return rows.find((item) => item.configKey === key)?.value ?? definition.envValue();
  }

  private resolveOperationConfig(rows: SystemConfigWithUpdater[]) {
    const backupRetentionValue = this.systemConfigValue(rows, 'backup_retention_days');
    const backupRetentionDays = Number(backupRetentionValue);

    return {
      backupRetentionDays: Number.isInteger(backupRetentionDays) && backupRetentionDays > 0 ? backupRetentionDays : getBackupRetentionDays(),
      backupRunbookUrl: this.systemConfigValue(rows, 'backup_runbook_url') || null,
      backupRestoreDrillAt: this.systemConfigValue(rows, 'backup_restore_drill_at') || null,
      alertContactName: this.systemConfigValue(rows, 'alert_contact_name') || null,
      alertContactChannel: this.systemConfigValue(rows, 'alert_contact_channel') || null,
    };
  }

  private toSystemConfigItem(definition: SystemConfigDefinition, row?: SystemConfigWithUpdater | null): AdminSystemConfigItem {
    const rawValue = row?.value ?? definition.envValue();
    const isSecret = definition.value_type === 'secret';
    const secretConfigured = isSecret ? Boolean(plainSecretValue(rawValue)) : undefined;
    return {
      config_key: definition.key,
      category: definition.category,
      label: definition.label,
      value: isSecret ? '' : rawValue,
      display_value: isSecret ? secretDisplayValue(rawValue) : rawValue,
      value_type: definition.value_type,
      description: definition.description,
      source: row ? 'admin' : 'environment',
      options: definition.options,
      secret_configured: secretConfigured,
      updated_by_name: row?.updatedByAdmin?.displayName ?? null,
      updated_at: row?.updatedAt.toISOString() ?? null,
    };
  }

  private systemConfigValuesDiffer(definition: SystemConfigDefinition, beforeValue: string, afterValue: string) {
    if (definition.value_type !== 'secret') return beforeValue !== afterValue;
    return plainSecretValue(beforeValue) !== plainSecretValue(afterValue);
  }

  private async performAiSettingsTest(
    config: RuntimeAiConfig,
    startedAt: number,
    checkedAt: Date,
  ): Promise<AdminAiSettingsTestResult> {
    const baseResult = {
      provider: config.provider,
      model: config.model,
      base_url: config.baseUrl,
      checked_at: checkedAt.toISOString(),
    };

    const elapsed = () => Date.now() - startedAt;

    if (config.provider === 'mock') {
      if (isStrictEnvironment()) {
        return {
          ...baseResult,
          status: 'failed',
          latency_ms: elapsed(),
          message: '生产环境不能使用 mock AI 服务。',
        };
      }

      return {
        ...baseResult,
        status: 'skipped',
        latency_ms: elapsed(),
        message: '当前使用 mock AI 服务，未进行真实供应商连通性测试。',
      };
    }

    if (!config.apiKey || !config.baseUrl || !config.model) {
      return {
        ...baseResult,
        status: 'failed',
        latency_ms: elapsed(),
        message: 'AI 配置不完整，请确认 API Key、接口地址和模型名称都已填写。',
      };
    }

    const timeoutMs = Math.min(Math.max(config.timeoutMs, 1000), 120_000);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model,
          temperature: 0,
          max_tokens: 8,
          messages: [
            {
              role: 'system',
              content: 'Reply with the word ok.',
            },
            {
              role: 'user',
              content: 'ping',
            },
          ],
        }),
        signal: controller.signal,
      });

      const responseText = await response.text();
      if (!response.ok) {
        return {
          ...baseResult,
          status: 'failed',
          latency_ms: elapsed(),
          message: `AI 服务返回 HTTP ${response.status}${this.summarizeAiSettingsTestResponse(responseText, config.apiKey)}`,
        };
      }

      if (!this.isChatCompletionLikeResponse(responseText)) {
        return {
          ...baseResult,
          status: 'failed',
          latency_ms: elapsed(),
          message: 'AI 服务已响应，但返回结构不是 Chat Completions 格式，请检查接口地址和供应商类型。',
        };
      }

      return {
        ...baseResult,
        status: 'success',
        latency_ms: elapsed(),
        message: 'AI 服务连接成功，当前供应商、模型和 Key 可以完成一次轻量调用。',
      };
    } catch (error) {
      const isAbort = error instanceof Error && error.name === 'AbortError';
      return {
        ...baseResult,
        status: 'failed',
        latency_ms: elapsed(),
        message: isAbort ? `AI 服务测试超时，已等待 ${timeoutMs}ms。` : `AI 服务测试失败：${this.safeAiSettingsTestError(error, config.apiKey)}`,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private isChatCompletionLikeResponse(responseText: string) {
    try {
      const parsed = JSON.parse(responseText) as { choices?: Array<{ message?: { content?: unknown } }> };
      return Array.isArray(parsed.choices) && parsed.choices.some((item) => typeof item.message?.content === 'string');
    } catch {
      return false;
    }
  }

  private summarizeAiSettingsTestResponse(responseText: string, apiKey: string) {
    const sanitize = (value: string) => value.replaceAll(apiKey, '<redacted>').slice(0, 220);
    try {
      const parsed = JSON.parse(responseText) as {
        error?: {
          code?: string;
          message?: string;
          type?: string;
        };
        message?: string;
      };
      const error = parsed.error;
      const detail = [error?.code, error?.message || parsed.message || error?.type].filter(Boolean).join('：');
      return detail ? `：${sanitize(detail)}` : '';
    } catch {
      const detail = sanitize(responseText.trim());
      return detail ? `：${detail}` : '';
    }
  }

  private safeAiSettingsTestError(error: unknown, apiKey: string) {
    const message = error instanceof Error ? error.message : String(error);
    return message.replaceAll(apiKey, '<redacted>').slice(0, 220);
  }

  private async logListAudit(admin: AuthenticatedAdmin, action: string, request: Request) {
    await this.auditLogService.create({
      actor_type: ActorType.admin,
      actor_id: admin.id,
      action,
      target_type: 'list',
      target_id: null,
      ip_address: request.ip,
      user_agent: request.headers['user-agent'] ?? null,
    });
  }

  private toSupportTicketItem(item: SupportTicketWithRelations) {
    return {
      ticket_no: item.ticketNo,
      user_no: item.user.userNo,
      user_name: item.user.nickname,
      user_mobile: item.user.mobile,
      category: item.category,
      topic: item.topic,
      content: item.content,
      contact: item.contact,
      status: item.status,
      priority: item.priority,
      assigned_admin_name: item.assignedAdmin?.displayName ?? null,
      handled_at: item.handledAt?.toISOString() ?? null,
      handle_note: item.handleNote,
      created_at: item.createdAt.toISOString(),
      updated_at: item.updatedAt.toISOString(),
    };
  }

  private toArchiveExportRequestItem(item: ArchiveExportRequestWithRelations) {
    return {
      request_no: item.requestNo,
      user_no: item.user.userNo,
      user_name: item.user.nickname,
      user_mobile: item.user.mobile,
      family_no: item.family.familyNo,
      family_name: item.family.name,
      child_no: item.child.childNo,
      child_name: item.child.name,
      export_type: item.exportType,
      purpose: item.purpose,
      status: item.status,
      contact: item.contact,
      note: item.note,
      record_count: item.recordCount,
      milestone_count: item.milestoneCount,
      media_count: item.mediaCount,
      first_record_time: item.firstRecordTime?.toISOString() ?? null,
      latest_record_time: item.latestRecordTime?.toISOString() ?? null,
      processed_by_name: item.processedByAdmin?.displayName ?? null,
      processed_at: item.processedAt?.toISOString() ?? null,
      process_note: item.processNote,
      download_url: item.downloadUrl,
      file_sha256: item.fileSha256,
      delivery_evidence: item.deliveryEvidence,
      created_at: item.createdAt.toISOString(),
      updated_at: item.updatedAt.toISOString(),
    };
  }

  private toNotificationItem(item: NotificationWithRelations) {
    const deliverySummary = item.deliveries.reduce(
      (summary, delivery) => {
        summary.total += 1;
        summary.by_status[delivery.status] = (summary.by_status[delivery.status] ?? 0) + 1;
        if (!summary.latest || delivery.createdAt > summary.latest.created_at) {
          summary.latest = {
            channel: delivery.channel,
            provider: delivery.provider,
            status: delivery.status,
            attempts: delivery.attempts,
            last_error: delivery.lastError,
            delivered_at: delivery.deliveredAt?.toISOString() ?? null,
            created_at: delivery.createdAt,
          };
        }
        return summary;
      },
      {
        total: 0,
        by_status: {} as Record<string, number>,
        latest: null as null | {
          channel: string;
          provider: string | null;
          status: string;
          attempts: number;
          last_error: string | null;
          delivered_at: string | null;
          created_at: Date;
        },
      },
    );

    return {
      notification_no: item.notificationNo,
      notification_type: item.notificationType,
      title: item.title,
      body: item.body,
      user_no: item.user.userNo,
      user_name: item.user.nickname,
      user_mobile: item.user.mobile,
      family_no: item.family.familyNo,
      family_name: item.family.name,
      actor_user_no: item.actor?.userNo ?? null,
      actor_name: item.actor?.nickname ?? null,
      target_type: item.targetType,
      target_no: item.targetNo,
      read_at: item.readAt?.toISOString() ?? null,
      created_at: item.createdAt.toISOString(),
      delivery_total: deliverySummary.total,
      delivery_status_counts: deliverySummary.by_status,
      latest_delivery: deliverySummary.latest
        ? {
            channel: deliverySummary.latest.channel,
            provider: deliverySummary.latest.provider,
            status: deliverySummary.latest.status,
            attempts: deliverySummary.latest.attempts,
            last_error: deliverySummary.latest.last_error,
            delivered_at: deliverySummary.latest.delivered_at,
            created_at: deliverySummary.latest.created_at.toISOString(),
          }
        : null,
      deliveries: item.deliveries.map((delivery) => ({
        channel: delivery.channel,
        provider: delivery.provider,
        status: delivery.status,
        attempts: delivery.attempts,
        next_retry_at: delivery.nextRetryAt?.toISOString() ?? null,
        last_error: delivery.lastError,
        delivered_at: delivery.deliveredAt?.toISOString() ?? null,
        created_at: delivery.createdAt.toISOString(),
        updated_at: delivery.updatedAt.toISOString(),
      })),
    };
  }

  private toAuditLogItem(item: {
    actorType: ActorType;
    actorId: bigint;
    action: string;
    targetType: string;
    targetId: bigint | null;
    ipAddress: string | null;
    userAgent: string | null;
    metadata?: unknown;
    createdAt: Date;
  }) {
    return {
      actor_type: item.actorType,
      actor_id: item.actorId.toString(),
      action: item.action,
      target_type: item.targetType,
      target_id: item.targetId?.toString() ?? null,
      ip_address: item.ipAddress,
      user_agent: item.userAgent,
      metadata: item.metadata ?? null,
      created_at: item.createdAt.toISOString(),
    };
  }

  private async toMediaItem(item: {
    mediaNo: string;
    mediaType: string;
    storageProvider: string;
    bucket: string;
    objectKey: string;
    thumbnailObjectKey?: string | null;
    originalName: string | null;
    mimeType: string | null;
    sizeBytes: bigint | null;
    width: number | null;
    height: number | null;
    durationSeconds: number | null;
    status: number;
    uploadSessionExpiresAt?: Date | null;
    failureReason?: string | null;
    retryCount?: number | null;
    createdAt: Date;
    updatedAt: Date;
  }, admin?: AuthenticatedAdmin) {
    const canViewSensitive = admin ? this.canViewSensitiveMediaFields(admin) : true;
    const canInspectPendingMedia = Boolean(admin && canViewSensitive && item.status !== MEDIA_STATUS_REMOVED);
    const canExposeMediaAccess = item.status === MEDIA_STATUS_READY || canInspectPendingMedia;
    const access = canExposeMediaAccess ? await this.storageService.createAccessUrl(item.objectKey).catch(() => null) : null;
    const thumbnailAccess = canExposeMediaAccess ? await this.createThumbnailAccessUrl(item).catch(() => null) : null;
    const uploadExpired = item.status === MEDIA_STATUS_UPLOADING && item.uploadSessionExpiresAt ? item.uploadSessionExpiresAt < new Date() : false;
    return {
      media_no: item.mediaNo,
      media_type: item.mediaType,
      storage_provider: item.storageProvider,
      bucket: canViewSensitive ? item.bucket : null,
      object_key: canViewSensitive ? item.objectKey : null,
      access_url: access?.access_url ?? null,
      thumbnail_url: thumbnailAccess,
      original_name: item.originalName,
      mime_type: item.mimeType,
      size_bytes: item.sizeBytes ? Number(item.sizeBytes) : null,
      width: item.width,
      height: item.height,
      duration_seconds: item.durationSeconds,
      status: statusToMediaLabel(item.status),
      upload_session_expires_at: item.uploadSessionExpiresAt?.toISOString() ?? null,
      upload_expired: uploadExpired,
      failure_reason: item.failureReason ?? null,
      retry_count: item.retryCount ?? 0,
      created_at: item.createdAt.toISOString(),
      updated_at: item.updatedAt.toISOString(),
    };
  }

  private async toMediaListItem(item: {
    mediaNo: string;
    mediaType: string;
    storageProvider: string;
    bucket: string;
    objectKey: string;
    thumbnailObjectKey: string | null;
    originalName: string | null;
    mimeType: string | null;
    sizeBytes: bigint | null;
    width: number | null;
    height: number | null;
    durationSeconds: number | null;
    status: number;
    uploadSessionExpiresAt?: Date | null;
    failureReason?: string | null;
    retryCount?: number | null;
    createdAt: Date;
    updatedAt: Date;
    child?: { childNo: string; name: string } | null;
    family: { familyNo: string };
    uploader: { userNo: string; nickname: string; mobile?: string | null };
    record?: { recordNo: string; title: string | null } | null;
  }, admin?: AuthenticatedAdmin) {
    return {
      ...(await this.toMediaItem(item, admin)),
      family_no: item.family.familyNo,
      child_no: item.child?.childNo ?? null,
      child_name: item.child?.name ?? null,
      uploader_user_no: item.uploader.userNo,
      uploader_name: item.uploader.nickname,
      uploader_mobile: admin && this.canViewSensitiveMediaFields(admin) ? item.uploader.mobile ?? null : null,
      record_no: item.record?.recordNo ?? null,
      record_title: item.record?.title ?? null,
    };
  }

  private async createThumbnailAccessUrl(item: { objectKey: string; thumbnailObjectKey?: string | null; mediaType?: string | null }) {
    const objectKey = item.thumbnailObjectKey ?? item.objectKey;
    try {
      return (await this.storageService.createAccessUrl(objectKey)).access_url;
    } catch {
      if (objectKey !== item.objectKey) {
        return (await this.storageService.createAccessUrl(item.objectKey)).access_url;
      }
      return null;
    }
  }

  private canViewSensitiveMediaFields(admin: AuthenticatedAdmin) {
    return admin.role === AdminRole.super_admin || admin.role === AdminRole.operator;
  }

  private async resolveMediaThumbnailUrl(media: { objectKey: string; thumbnailObjectKey?: string | null; status?: number } | null) {
    if (!media || (media.status !== undefined && media.status !== MEDIA_STATUS_READY)) return null;
    return this.createThumbnailAccessUrl(media);
  }

  private async resolveChildAvatarUrl(childId: bigint, avatarUrl: string | null) {
    const mediaNo = parseMediaReference(avatarUrl);
    if (!mediaNo) return avatarUrl;

    const media = await this.prisma.recordMedia.findFirst({
      where: {
        mediaNo,
        childId,
        status: MEDIA_STATUS_READY,
      },
      select: { objectKey: true, thumbnailObjectKey: true },
    });
    return this.resolveMediaThumbnailUrl(media);
  }

  private async resolveUserAvatarUrl(userId: bigint, avatarUrl: string | null) {
    const mediaNo = parseMediaReference(avatarUrl);
    if (!mediaNo) return avatarUrl;

    const media = await this.prisma.recordMedia.findFirst({
      where: {
        mediaNo,
        uploaderUserId: userId,
        status: MEDIA_STATUS_READY,
      },
      select: { objectKey: true, thumbnailObjectKey: true },
    });
    return this.resolveMediaThumbnailUrl(media);
  }

  private toAiJobItem(item: {
    jobNo: string;
    record?: { recordNo: string } | null;
    requester?: { userNo: string } | null;
    jobType: string;
    provider: string | null;
    status: AiJobStatus;
    errorMessage: string | null;
    retryCount: number;
    createdAt: Date;
  }) {
    return {
      job_no: item.jobNo,
      record_no: item.record?.recordNo ?? null,
      requester_user_no: item.requester?.userNo ?? null,
      job_type: item.jobType,
      provider: item.provider,
      status: item.status,
      error_message: item.errorMessage,
      retry_count: item.retryCount,
      created_at: item.createdAt.toISOString(),
    };
  }
}
