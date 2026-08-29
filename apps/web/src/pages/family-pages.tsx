import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useRef } from 'react';
import { Camera, ChevronRight, Clock, Copy, FileText, Image as ImageIcon, Mic, PlayCircle, Plus, UserMinus, UserPlus } from 'lucide-react';

import { useAuth } from '../shared/AuthContext';
import { webApi } from '../shared/api/webApi';
import type { ChildRecord, FamilyInviteResponse, FamilyMemberItem, FamilyMemberOperationItem, RecordSummary } from '../shared/api/types';
import { useAsyncData, useStoredMediaUrl } from '../shared/hooks';
import { childStatusLabel, familyMemberStatusLabel, familyRoleLabel, genderLabel, recordTypeLabel } from '../shared/labels';
import { createPersistableAvatarPreview, saveLocalMediaPreview, saveRuntimeMediaPreview, toStoredMediaReference } from '../shared/localMediaPreview';
import { loadLocalSettings } from '../shared/localSettings';
import { isSupportedImageFile, resolveFileMimeType, withResolvedFileMimeType } from '../shared/mediaFiles';
import { normalizeUploadErrorMessage, readUploadMetadata } from '../shared/mediaMetadata';
import { useCachedMediaUrl } from '../shared/useCachedMediaUrl';
import { AppDateInput, AppSegmentedControl, Field, PageShell, Panel, compactPrimaryButtonStyle, compactSecondaryButtonStyle, helperTextStyle, inputStyle, primaryButtonStyle, secondaryButtonStyle, textareaStyle } from '../shared/ui';
import { EmptyState, buttonRowStyle, formatAppDate, formatAppDateTime, formSubmitSpacingStyle, normalizeDisplayName, rowStyle } from './shared';
import { RefSectionTitle, isReferencePlaceholderAvatar, refCardStyle, refMutedTextStyle, refPageStyle, refSoftCardStyle, referenceAssets } from './reference-ui';

const isPositiveStatusMessage = (message: string) => !/(失败|不能|请先|请至少|请输入|仅支持|无法|错误|暂时)/.test(message);

const uploadChildAvatarImage = async (childNo: string, file: File, previewUrl?: string | null) => {
  const uploadFile = withResolvedFileMimeType(file);
  const metadata = await readUploadMetadata('image', previewUrl);
  const uploadToken = await webApi.createUploadToken({
    child_no: childNo,
    file_name: uploadFile.name,
    mime_type: resolveFileMimeType(uploadFile) || uploadFile.type,
    size_bytes: uploadFile.size,
    media_type: 'image',
  });

  if (previewUrl) saveRuntimeMediaPreview(uploadToken.media_no, previewUrl);

  if (!uploadToken.mock_upload) {
    const uploadResponse = await fetch(uploadToken.upload_url, {
      method: uploadToken.method,
      headers: uploadToken.headers,
      body: uploadFile,
    });
    if (!uploadResponse.ok) {
      throw new Error(`头像上传失败：HTTP ${uploadResponse.status}`);
    }
  }
  await webApi.confirmUpload({ media_no: uploadToken.media_no, ...metadata });
  try {
    const preview = await createPersistableAvatarPreview(uploadFile);
    if (preview) {
      saveLocalMediaPreview(uploadToken.media_no, preview);
      saveRuntimeMediaPreview(uploadToken.media_no, preview);
    }
  } catch {
    // The runtime blob preview still keeps the avatar visible in the current app session.
  }
  return toStoredMediaReference(uploadToken.media_no);
};

const ChildAvatarPreview = ({ src, mediaNo, label }: { src?: string | null; mediaNo?: string | null; label: string }) => {
  const resolvedSrc = useStoredMediaUrl(src, mediaNo);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  useEffect(() => {
    setFailedSrc(null);
  }, [resolvedSrc]);

  if (resolvedSrc && failedSrc !== resolvedSrc) {
    return <img src={resolvedSrc} alt={label} decoding="async" onError={() => setFailedSrc(resolvedSrc)} style={{ width: '72px', height: '72px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--nl-border-image)', background: 'var(--nl-surface-soft)', boxShadow: '0 12px 26px rgba(var(--nl-shadow-rgb),0.18)' }} />;
  }

  return <img src={referenceAssets.childAvatar} alt={label} decoding="async" style={{ width: '72px', height: '72px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--nl-border-image)', background: 'var(--nl-surface-soft)', boxShadow: '0 12px 26px rgba(var(--nl-shadow-rgb),0.18)' }} />;
};

const FamilyAvatar = ({ src, mediaNo, label, size = 42, radius = '999px', fallbackSrc = null }: { src?: string | null; mediaNo?: string | null; label: string; size?: number; radius?: string; fallbackSrc?: string | null }) => {
  const resolvedSrc = useStoredMediaUrl(src && !isReferencePlaceholderAvatar(src) ? src : null, mediaNo);
  const displaySrc = resolvedSrc && !isReferencePlaceholderAvatar(resolvedSrc) ? resolvedSrc : fallbackSrc;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  useEffect(() => {
    setFailedSrc(null);
  }, [displaySrc]);

  if (displaySrc && failedSrc !== displaySrc) {
    return <img src={displaySrc} alt={label} decoding="async" onError={() => setFailedSrc(displaySrc)} style={{ width: `${size}px`, height: `${size}px`, borderRadius: radius, objectFit: 'cover', border: '2px solid var(--nl-border-image)', outline: '1px solid rgba(var(--nl-accent-rgb),0.1)', background: 'var(--nl-surface-soft)', flexShrink: 0, boxShadow: '0 10px 22px rgba(var(--nl-shadow-rgb),0.14)' }} />;
  }

  return (
    <span
      role="img"
      aria-label={`${label}的头像`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: radius,
        border: '2px solid var(--nl-border-image)',
        outline: '1px solid rgba(var(--nl-accent-rgb),0.1)',
        background: 'var(--nl-surface-soft)',
        color: 'var(--nl-primary-2)',
        display: 'grid',
        placeItems: 'center',
        fontSize: `${Math.max(14, Math.round(size * 0.38))}px`,
        fontWeight: 760,
        lineHeight: 1,
        flexShrink: 0,
        boxShadow: '0 10px 22px rgba(var(--nl-shadow-rgb),0.12)',
      }}
    >
      {label.trim().slice(0, 1).toUpperCase() || '家'}
    </span>
  );
};

const resolveFamilyMemberAvatarSrc = (member: FamilyMemberItem, currentUser: { user_no: string; avatar_url: string | null; avatar_media_no?: string | null } | null) => {
  const avatarUrl = member.avatar_url && !isReferencePlaceholderAvatar(member.avatar_url) ? member.avatar_url : null;
  if (avatarUrl) return avatarUrl;
  if (currentUser?.user_no === member.user_no && currentUser.avatar_url && !isReferencePlaceholderAvatar(currentUser.avatar_url)) {
    return currentUser.avatar_url;
  }
  return null;
};

const resolveFamilyMemberAvatarMediaNo = (member: FamilyMemberItem, currentUser: { user_no: string; avatar_media_no?: string | null } | null) => {
  if (member.avatar_media_no) return member.avatar_media_no;
  if (currentUser?.user_no === member.user_no) return currentUser.avatar_media_no ?? null;
  return null;
};

const findRecordCreatorMember = (record: RecordSummary, members: FamilyMemberItem[]) =>
  record.creator_user_no ? members.find((member) => member.user_no === record.creator_user_no) ?? null : null;

const resolveRecordCreatorAvatarSrc = (record: RecordSummary, members: FamilyMemberItem[], currentUser: { user_no: string; avatar_url: string | null; avatar_media_no?: string | null } | null) => {
  const avatarUrl = record.creator_avatar_url && !isReferencePlaceholderAvatar(record.creator_avatar_url) ? record.creator_avatar_url : null;
  if (avatarUrl) return avatarUrl;
  const member = findRecordCreatorMember(record, members);
  return member ? resolveFamilyMemberAvatarSrc(member, currentUser) : null;
};

const resolveRecordCreatorAvatarMediaNo = (record: RecordSummary, members: FamilyMemberItem[], currentUser: { user_no: string; avatar_media_no?: string | null } | null) => {
  if (record.creator_avatar_media_no) return record.creator_avatar_media_no;
  const member = findRecordCreatorMember(record, members);
  return member ? resolveFamilyMemberAvatarMediaNo(member, currentUser) : null;
};

const getFamilyRecordMediaKind = (record: RecordSummary) =>
  record.cover_media_type ?? (record.record_type === 'audio' || record.record_type === 'video' ? record.record_type : null);

const getFamilyRecordActionLabel = (record: RecordSummary) => {
  const mediaKind = getFamilyRecordMediaKind(record);
  if (mediaKind === 'video') return '上传了视频记录';
  if (mediaKind === 'audio') return '记录了一段语音';
  if (record.cover_media_no || record.cover_url) return '上传了照片';
  return `记录了${recordTypeLabel(record.record_type, record.is_milestone)}`;
};

const hasFamilyRecordVisualCover = (record: RecordSummary) => {
  const mediaKind = getFamilyRecordMediaKind(record);
  return mediaKind !== 'audio' && Boolean(record.cover_media_no || record.cover_url);
};

const isTechnicalFamilyMemberName = (value: string) => /^(?:codex(?:ui)?\d[a-z0-9]*|native_[a-z0-9_]+|1\d{10})$/i.test(value.trim());

const getFamilyMemberDisplayName = (member: FamilyMemberItem) => {
  const trimmedNickname = member.nickname.trim();
  if (/^native_delete_/i.test(trimmedNickname)) return '已移除成员';
  if (isTechnicalFamilyMemberName(trimmedNickname)) return '家人';
  return normalizeDisplayName(trimmedNickname, '家人');
};

const isVisibleFamilyMember = (member: FamilyMemberItem) =>
  member.status === 1 && !/^native_delete_/i.test(member.nickname.trim());

const emptyFamilyOperations = (familyNo: string) => ({ family_no: familyNo, list: [] as FamilyMemberOperationItem[] });

const getFamilyMemberOperationTargetName = (operation: FamilyMemberOperationItem) => normalizeDisplayName(operation.target_nickname, operation.target_user_no || '成员');

const getFamilyMemberOperationRoleText = (role: string | null) => {
  if (!role) return '未知';
  if (role === 'owner') return '创建者';
  return familyRoleLabel(role);
};

const getFamilyMemberOperationText = (operation: FamilyMemberOperationItem) => {
  const targetName = getFamilyMemberOperationTargetName(operation);
  if (operation.action === 'family.member_removed') {
    return `${targetName} 已被移出家庭`;
  }
  if (operation.action === 'family.member_role_updated') {
    return `${targetName} 权限从 ${getFamilyMemberOperationRoleText(operation.before_role)} 调整为 ${getFamilyMemberOperationRoleText(operation.after_role)}`;
  }
  if (operation.action === 'family.record_published') {
    return `${targetName} 发布了「${operation.record_title?.trim() || '未命名记录'}」`;
  }
  return `${targetName} 的成员操作已记录`;
};

const rolePermissionItems = [
  { role: '管理员', detail: '管理成员、维护档案、调整权限' },
  { role: '可编辑', detail: '查看记录、补充记录、参与整理' },
  { role: '只读', detail: '查看家庭可见内容，不修改档案' },
];

const RecentFamilyRecord = ({ record, creatorAvatarSrc, creatorAvatarMediaNo, currentUserNo, onClick }: { record: RecordSummary; creatorAvatarSrc?: string | null; creatorAvatarMediaNo?: string | null; currentUserNo?: string | null; onClick: () => void }) => {
  const mediaKind = getFamilyRecordMediaKind(record);
  const cachedCoverUrl = useCachedMediaUrl(record.cover_media_no, record.cover_url, mediaKind ?? 'image', {
    cacheRemote: mediaKind !== 'audio',
  });
  const hasCover = hasFamilyRecordVisualCover(record);
  const normalizedCreatorName = normalizeDisplayName(record.creator_name, '家人');
  const creatorName = record.creator_user_no && record.creator_user_no === currentUserNo
    ? '我'
    : isTechnicalFamilyMemberName(normalizedCreatorName) ? '家人' : normalizedCreatorName;

  return (
    <button type="button" aria-label={`查看家庭动态：${record.title ?? '未命名记录'}`} onClick={onClick} style={{ border: 'none', background: 'transparent', padding: 0, display: 'grid', gap: 10, textAlign: 'left', cursor: 'pointer', position: 'relative' }}>
      <span style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'var(--nl-ink)', minWidth: 0 }}>
        <FamilyAvatar src={creatorAvatarSrc} mediaNo={creatorAvatarMediaNo} label={creatorName} size={32} />
        <span style={{ minWidth: 0, display: 'grid', gap: 2 }}>
          <strong style={{ fontSize: 14, lineHeight: 1.16, fontWeight: 700, color: 'var(--nl-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{creatorName} {getFamilyRecordActionLabel(record)}</strong>
          <span style={{ color: 'var(--nl-muted)', fontSize: 11, fontWeight: 520 }}>{formatAppDateTime(record.event_time)}</span>
        </span>
      </span>
      {hasCover && mediaKind !== 'audio' ? (
        <span style={{ position: 'relative', display: 'block', width: '100%', height: 158 }}>
          {cachedCoverUrl ? (
            <img src={cachedCoverUrl} alt={record.title ?? '家庭动态图片'} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', borderRadius: 8, objectFit: 'cover', border: '1px solid var(--nl-border-muted)', display: 'block', boxShadow: '0 18px 42px rgba(var(--nl-shadow-rgb),0.2)' }} />
          ) : (
            <span style={{ width: '100%', height: '100%', borderRadius: 8, border: '1px solid var(--nl-border-muted)', background: 'var(--nl-surface-soft)', color: 'var(--nl-muted)', display: 'grid', placeItems: 'center' }}>
              <ImageIcon size={24} />
            </span>
          )}
          {cachedCoverUrl && mediaKind === 'video' ? (
            <span aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--nl-on-primary)' }}>
              <PlayCircle size={40} fill="var(--nl-on-dark-soft)" strokeWidth={1.8} />
            </span>
          ) : null}
        </span>
      ) : mediaKind === 'audio' ? (
        <div style={{ maxWidth: 230, borderRadius: '8px', border: '1px solid var(--nl-border-muted)', background: 'transparent', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 9, color: 'var(--nl-muted-strong)' }}>
          <Mic size={15} />
          <span style={{ fontSize: 13, fontWeight: 700 }}>语音记录</span>
        </div>
      ) : (
        <div style={{ minHeight: 116, borderTop: '1px solid var(--nl-border-muted)', borderBottom: '1px solid var(--nl-border-muted)', background: 'transparent', padding: '16px 0', display: 'grid', gap: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--nl-primary-2)', fontSize: 12, fontWeight: 680 }}>
            <FileText size={15} />
            {recordTypeLabel(record.record_type, record.is_milestone)}
          </span>
          <strong style={{ color: 'var(--nl-ink)', fontSize: 17, lineHeight: 1.28, fontWeight: 780, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{record.title ?? '未命名记录'}</strong>
          <span style={{ color: 'var(--nl-muted-strong)', fontSize: 13, lineHeight: 1.6, fontWeight: 460, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{record.summary ?? '这条记录还没有正文。'}</span>
        </div>
      )}
    </button>
  );
};

const FamilyMemberOperations = ({ operations }: { operations: FamilyMemberOperationItem[] }) => {
  if (!operations.length) return null;

  return (
    <section style={{ borderTop: '1px solid var(--nl-border-muted)', paddingTop: 12, display: 'grid', gap: 8 }}>
      <strong style={{ color: 'var(--nl-ink)', fontSize: 14, fontWeight: 660 }}>最近操作</strong>
      <div style={{ display: 'grid', gap: 0, borderTop: '1px solid var(--nl-border-muted)' }}>
        {operations.slice(0, 4).map((operation) => (
          <div key={operation.operation_no} style={{ minHeight: 44, borderBottom: '1px solid var(--nl-border-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '9px 0' }}>
            <span style={{ minWidth: 0, color: 'var(--nl-ink)', fontSize: 12, fontWeight: 560, lineHeight: 1.45, overflowWrap: 'anywhere' }}>{getFamilyMemberOperationText(operation)}</span>
            <span style={{ flexShrink: 0, color: 'var(--nl-muted)', fontSize: 10, fontWeight: 600 }}>{formatAppDate(operation.created_at)}</span>
          </div>
        ))}
      </div>
    </section>
  );
};

export const FamilyPage = () => {
  const navigate = useNavigate();
  const { activeChild, user } = useAuth();
  const { data: membersResponse, loading: membersLoading, error: membersError } = useAsyncData(
    async () => {
      if (!activeChild?.family_no) return null;
      return webApi.listFamilyMembers(activeChild.family_no);
    },
    [activeChild?.family_no],
  );
  const { data: familyRecords, loading: recordsLoading, error: recordsError } = useAsyncData<RecordSummary[]>(
    async () => {
      if (!activeChild) return [];
      const result = await webApi.listRecords({ child_no: activeChild.child_no, page: 1, page_size: 3, status: 'published' });
      return result.list;
    },
    [activeChild?.child_no],
  );

  const visibleFamilyMembers = membersResponse?.list.filter(isVisibleFamilyMember) ?? [];
  const memberCount = visibleFamilyMembers.length;
  const recentMembers = visibleFamilyMembers.slice(0, 4);
  const recentFamilyRecords = familyRecords?.slice(0, 1) ?? [];
  const activeChildName = normalizeDisplayName(activeChild?.name, '孩子');

  return (
    <div style={refPageStyle}>
      <header style={{ padding: 'calc(var(--nl-statusbar-top) + 12px) var(--nl-content-inline) 8px', background: 'transparent' }}>
        <h1 style={{ margin: 0, color: 'var(--nl-ink)', fontFamily: 'var(--nl-font-display)', fontSize: 'var(--nl-title-page-size)', lineHeight: 1.12, fontWeight: 780 }}>家庭</h1>
      </header>

      <main style={{ display: 'flex', flexDirection: 'column', gap: 'var(--nl-section-gap)', minHeight: 'calc(var(--nl-page-min-height, 100dvh) - 68px)', boxSizing: 'border-box', padding: '0 var(--nl-content-inline) 48px' }}>
      <section style={{ padding: '12px 0 24px', minHeight: 112, borderBottom: '1px solid var(--nl-border-soft)' }}>
          {activeChild ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', minWidth: 0, flex: '1 1 auto' }}>
                <FamilyAvatar src={activeChild.avatar_url} mediaNo={activeChild.avatar_media_no} label={activeChildName} size={76} radius="8px" />
                <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                  <span style={{ display: 'block', width: 26, height: 2, marginBottom: 9, background: 'var(--nl-primary-2)' }} />
                  <h2 style={{ margin: 0, color: 'var(--nl-ink)', fontFamily: 'var(--nl-font-display)', fontSize: 28, lineHeight: 1.08, fontWeight: 780, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeChildName}的家庭</h2>
                  <p style={{ ...refMutedTextStyle, marginTop: 7, fontSize: 12 }}>{membersLoading ? '家庭档案' : `${memberCount} 位家人共同记录`}</p>
                </div>
              </div>
          <Link to="/family/invite" aria-label="邀请成员" title="邀请成员" style={{ width: 42, height: 42, border: 'none', borderRadius: 0, background: 'transparent', color: 'var(--nl-primary-2)', display: 'grid', placeItems: 'center', textDecoration: 'none', flexShrink: 0, boxShadow: 'none' }}>
                <UserPlus size={19} />
              </Link>
            </div>
          ) : <EmptyState message="请先完成建档或选择一个孩子。" />}
          {membersError ? <p style={{ ...helperTextStyle, color: 'var(--nl-danger)', marginTop: 10 }}>成员信息加载失败：{membersError}</p> : null}
        </section>

        <section>
          <RefSectionTitle>家庭成员</RefSectionTitle>
          <div style={{ borderTop: '1px solid var(--nl-border-muted)' }}>
            {recentMembers.length ? recentMembers.map((member) => {
              const normalizedNickname = normalizeDisplayName(member.nickname, '家人');
              const memberName = member.user_no === user?.user_no && isTechnicalFamilyMemberName(member.nickname)
                ? '我'
                : getFamilyMemberDisplayName(member);
              const memberSecondary = memberName !== normalizedNickname ? normalizedNickname : member.mobile_masked;
              return (
                <button key={member.user_no} type="button" onClick={() => navigate(`/family/members/${member.user_no}`)} style={{ width: '100%', minWidth: 0, minHeight: 78, border: 'none', borderBottom: '1px solid var(--nl-border-muted)', background: 'transparent', padding: '12px 0', display: 'flex', alignItems: 'center', gap: 13, textAlign: 'left', cursor: 'pointer' }}>
                  <FamilyAvatar src={resolveFamilyMemberAvatarSrc(member, user)} mediaNo={resolveFamilyMemberAvatarMediaNo(member, user)} label={memberName} size={48} />
                  <span style={{ width: '100%', minWidth: 0, display: 'grid', gap: 4 }}>
                    <strong style={{ maxWidth: '100%', color: 'var(--nl-ink)', fontSize: 15, lineHeight: 1.18, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{memberName}</strong>
                    <span style={{ maxWidth: '100%', color: 'var(--nl-muted)', fontSize: 11, lineHeight: 1.2, fontWeight: 520, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[familyRoleLabel(member.role), memberSecondary, member.status !== 1 ? familyMemberStatusLabel(member.status) : null].filter(Boolean).join(' · ')}</span>
                  </span>
                  <ChevronRight size={17} color="var(--nl-muted)" strokeWidth={2.1} />
                </button>
              );
            }) : (
              <div style={{ gridColumn: '1 / -1', padding: 18, display: 'grid', gap: 12, justifyItems: 'center' }}>
                <EmptyState message="暂无家庭成员信息。" />
                <button type="button" onClick={() => navigate('/family/invite')} style={compactPrimaryButtonStyle}>邀请家人</button>
              </div>
            )}
          </div>
        </section>

        <section>
          <RefSectionTitle>家庭动态</RefSectionTitle>
          {recordsLoading ? <EmptyState message="正在加载家庭动态…" /> : null}
          {recordsError ? <EmptyState message={`家庭动态加载失败：${recordsError}`} /> : null}
          {!recordsLoading && !recordsError && recentFamilyRecords.length ? (
            <div style={{ position: 'relative', display: 'grid', gap: 9, paddingLeft: 0, marginLeft: 0 }}>
              {recentFamilyRecords.map((record) => (
                <RecentFamilyRecord
                  key={record.record_no}
                  record={record}
                  creatorAvatarSrc={resolveRecordCreatorAvatarSrc(record, visibleFamilyMembers, user)}
                  creatorAvatarMediaNo={resolveRecordCreatorAvatarMediaNo(record, visibleFamilyMembers, user)}
                  currentUserNo={user?.user_no}
                  onClick={() => navigate(`/record/${record.record_no}`)}
                />
              ))}
            </div>
          ) : null}
          {!recordsLoading && !recordsError && !recentFamilyRecords.length ? (
            <section style={{ borderTop: '1px solid var(--nl-border-muted)', padding: '14px 0 0', display: 'grid', gap: 10 }}>
              <strong style={{ color: 'var(--nl-ink)', fontSize: 14, fontWeight: 600 }}>还没有家庭动态</strong>
              <button type="button" onClick={() => navigate('/record/create')} style={{ ...compactSecondaryButtonStyle, width: 'fit-content' }}>去记录一刻</button>
            </section>
          ) : null}
        </section>

      </main>
    </div>
  );
};

export const FamilyChildPage = () => {
  const navigate = useNavigate();
  const { activeChild, refreshChildren, setActiveChild } = useAuth();
  const { data, loading, error } = useAsyncData<ChildRecord | null>(
    async () => {
      if (!activeChild?.child_no) return null;
      return webApi.detailChild(activeChild.child_no);
    },
    [activeChild?.child_no],
  );
  const [form, setForm] = useState({
    name: '',
    avatar_url: '',
    birthday: '',
    gender: 'unknown',
    birth_place: '',
    remark: '',
  });
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const formDirtyRef = useRef(false);
  const loadedChildNoRef = useRef<string | null>(null);

  useEffect(() => {
    if (data) {
      if (loadedChildNoRef.current !== data.child_no) {
        loadedChildNoRef.current = data.child_no;
        formDirtyRef.current = false;
      }
      if (formDirtyRef.current) return;
      setForm({
        name: data.name,
        avatar_url: data.avatar_url ?? '',
        birthday: data.birthday,
        gender: data.gender,
        birth_place: data.birth_place ?? '',
        remark: data.remark ?? '',
      });
    }
  }, [data]);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl?.startsWith('blob:') && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(avatarPreviewUrl);
    };
  }, [avatarPreviewUrl]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeChild?.child_no) return;
    setSaving(true);
    setMessage(null);
    try {
      const updated = await webApi.updateChild(activeChild.child_no, form);
      await refreshChildren();
      setActiveChild(updated);
      formDirtyRef.current = false;
      setMessage('保存成功');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const onAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !activeChild?.child_no) return;
    if (!isSupportedImageFile(file)) {
      setMessage('头像仅支持 JPG、PNG、WebP、HEIC 图片');
      return;
    }

    const uploadFile = withResolvedFileMimeType(file);
    const previewUrl = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(uploadFile) : null;
    setAvatarPreviewUrl(previewUrl);
    setAvatarUploading(true);
    setMessage('头像保存中…');
    try {
      const avatarUrl = await uploadChildAvatarImage(activeChild.child_no, uploadFile, previewUrl);
      const updated = await webApi.updateChild(activeChild.child_no, { avatar_url: avatarUrl });
      await refreshChildren();
      setActiveChild({ ...updated, avatar_url: avatarUrl });
      setForm((current) => ({ ...current, avatar_url: avatarUrl }));
      setAvatarPreviewUrl(null);
      setMessage('头像已更新');
    } catch (err) {
      setAvatarPreviewUrl(null);
      setMessage(normalizeUploadErrorMessage(err instanceof Error ? err.message : '头像上传失败', 'image'));
    } finally {
      setAvatarUploading(false);
    }
  };

  return (
    <PageShell title="孩子资料" backTo="/family">
      <Panel style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }}>
        {loading ? <EmptyState message="正在加载孩子资料…" /> : null}
        {error ? <EmptyState message={`加载失败：${error}`} /> : null}
        {!loading && !error && data ? (
          <form onSubmit={onSubmit} style={rowStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <ChildAvatarPreview src={avatarPreviewUrl ?? (form.avatar_url || data.avatar_url)} mediaNo={data.avatar_media_no} label={form.name || data.name} />
              <label
                style={{
                  ...compactSecondaryButtonStyle,
                  cursor: avatarUploading ? 'not-allowed' : 'pointer',
                  opacity: avatarUploading ? 0.68 : 1,
                }}
              >
                <Camera size={15} strokeWidth={2.2} />
                {avatarUploading ? '上传中…' : '上传头像'}
                <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" disabled={avatarUploading} onChange={(event) => void onAvatarChange(event)} style={{ display: 'none' }} />
              </label>
            </div>
            <p style={helperTextStyle}>状态：{childStatusLabel(data.status)} · 性别：{genderLabel(data.gender)}</p>
            <Field label="孩子姓名">
              <input style={inputStyle} value={form.name} onChange={(event) => { formDirtyRef.current = true; setForm((current) => ({ ...current, name: event.target.value })); }} />
            </Field>
            <Field label="生日">
              <AppDateInput
                aria-label="生日"
                value={form.birthday}
                displayValue={form.birthday ? form.birthday.replace(/-/g, '/') : undefined}
                placeholder="年/月/日"
                 onChange={(event) => { formDirtyRef.current = true; setForm((current) => ({ ...current, birthday: event.target.value })); }}
              />
            </Field>
            <Field label="性别">
              <AppSegmentedControl
                ariaLabel="性别"
                value={form.gender}
                 onChange={(value) => { formDirtyRef.current = true; setForm((current) => ({ ...current, gender: value })); }}
                options={[
                  { value: 'female', label: '女' },
                  { value: 'male', label: '男' },
                  { value: 'unknown', label: '未知' },
                ]}
              />
            </Field>
            <Field label="出生地">
              <input style={inputStyle} value={form.birth_place} onChange={(event) => { formDirtyRef.current = true; setForm((current) => ({ ...current, birth_place: event.target.value })); }} />
            </Field>
            <Field label="备注">
              <textarea style={textareaStyle} value={form.remark} onChange={(event) => { formDirtyRef.current = true; setForm((current) => ({ ...current, remark: event.target.value })); }} />
            </Field>
      {message ? <p style={{ ...helperTextStyle, color: isPositiveStatusMessage(message) ? 'var(--nl-success)' : 'var(--nl-danger)' }}>{message}</p> : null}
            <div style={{ ...buttonRowStyle, ...formSubmitSpacingStyle }}>
              <button type="submit" style={primaryButtonStyle} disabled={saving}>
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </form>
        ) : null}
      </Panel>
    </PageShell>
  );
};

export const FamilyMembersPage = () => {
  const { activeChild } = useAuth();
  const [members, setMembers] = useState<FamilyMemberItem[]>([]);
  const [operations, setOperations] = useState<FamilyMemberOperationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [updatingUserNo, setUpdatingUserNo] = useState<string | null>(null);
  const [showAllMembers, setShowAllMembers] = useState(false);
  const settings = loadLocalSettings();

  useEffect(() => {
    const loadMembers = async () => {
      const familyNo = activeChild?.family_no;
      if (!familyNo) return;
      setLoading(true);
      setError(null);
      setMessage(null);
      try {
        const [membersResponse, operationsResponse] = await Promise.all([
          webApi.listFamilyMembers(familyNo),
          webApi.listFamilyMemberOperations(familyNo).catch(() => emptyFamilyOperations(familyNo)),
        ]);
        setMembers(membersResponse.list.filter(isVisibleFamilyMember));
        setOperations(operationsResponse.list);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载成员失败');
      } finally {
        setLoading(false);
      }
    };

    void loadMembers();
  }, [activeChild?.family_no]);

  const onChangeRole = async (userNo: string, role: 'viewer' | 'editor') => {
    const familyNo = activeChild?.family_no;
    if (!familyNo) return;
    setUpdatingUserNo(userNo);
    setMessage(null);
    try {
      await webApi.updateFamilyMemberRole(familyNo, userNo, { role });
      setMembers((current) => current.map((item) => (item.user_no === userNo ? { ...item, role } : item)));
      const operationsResponse = await webApi.listFamilyMemberOperations(familyNo).catch(() => emptyFamilyOperations(familyNo));
      setOperations(operationsResponse.list);
      setMessage('成员角色已更新');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '角色更新失败');
    } finally {
      setUpdatingUserNo(null);
    }
  };
  const visibleMembers = showAllMembers ? members : members.slice(0, 6);
  const hiddenMemberCount = Math.max(members.length - visibleMembers.length, 0);

  return (
    <PageShell title="家庭成员" backTo="/family">
      <Panel style={{ padding: 0, background: 'transparent', border: 'none', boxShadow: 'none' }}>
        {!activeChild?.family_no ? <EmptyState message="当前孩子尚未关联家庭编号。" /> : null}
        {loading ? <EmptyState message="正在加载家庭成员…" /> : null}
        {error ? <EmptyState message={`加载失败：${error}`} /> : null}
        {message ? <p style={{ ...helperTextStyle, color: message === '成员角色已更新' ? 'var(--nl-success)' : 'var(--nl-danger)' }}>{message}</p> : null}
        {members.length ? (
          <div style={{ display: 'grid', gap: '16px' }}>
            <section style={{ borderRadius: 0, border: 'none', borderBottom: '1px solid var(--nl-border-muted)', background: 'transparent', padding: '0 0 14px', display: 'grid', gap: '10px' }}>
              <strong style={{ color: 'var(--nl-ink)', fontSize: '14px', fontWeight: 700 }}>权限说明</strong>
              <div style={{ display: 'grid', gap: '10px' }}>
                {rolePermissionItems.map((item) => (
                  <div key={item.role} style={{ display: 'grid', gridTemplateColumns: '70px minmax(0, 1fr)', gap: '10px', alignItems: 'start' }}>
                    <span style={{ borderLeft: '2px solid rgba(var(--nl-primary-rgb),0.28)', color: 'var(--nl-muted-strong)', padding: '2px 0 2px 9px', fontSize: '11px', fontWeight: 620, textAlign: 'left' }}>{item.role}</span>
                    <span style={{ color: 'var(--nl-muted-strong)', fontSize: '12px', lineHeight: 1.58, fontWeight: 500 }}>{item.detail}</span>
                  </div>
                ))}
              </div>
            </section>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', alignItems: 'center' }}>
              {hiddenMemberCount ? (
                <button type="button" style={{ ...compactSecondaryButtonStyle, minHeight: '36px', padding: '7px 12px', fontSize: '12px', flexShrink: 0 }} onClick={() => setShowAllMembers(true)}>
                  展开全部
                </button>
              ) : showAllMembers && members.length > 6 ? (
                <button type="button" style={{ ...compactSecondaryButtonStyle, minHeight: '36px', padding: '7px 12px', fontSize: '12px', flexShrink: 0 }} onClick={() => setShowAllMembers(false)}>
                  收起
                </button>
              ) : null}
            </div>
            {visibleMembers.map((member) => (
              <section key={member.user_no} style={{ border: 'none', borderBottom: '1px solid var(--nl-border-muted)', borderRadius: 0, padding: '0 0 16px', background: 'transparent', display: 'grid', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '13px', alignItems: 'center', minWidth: 0 }}>
                  <FamilyAvatar src={member.avatar_url} mediaNo={member.avatar_media_no} label={getFamilyMemberDisplayName(member)} size={48} radius="8px" />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <strong style={{ minWidth: 0, maxWidth: '100%', fontSize: '16px', color: 'var(--nl-ink)', fontWeight: 720, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflowWrap: 'anywhere' }}>{getFamilyMemberDisplayName(member)}</strong>
                      <span style={{ fontSize: '11px', fontWeight: 660, color: member.role === 'owner' ? 'var(--nl-primary-2)' : 'var(--nl-muted-strong)', background: 'transparent', border: '1px solid var(--nl-border-soft)', padding: '3px 8px', borderRadius: '7px', whiteSpace: 'nowrap' }}>
                        {familyRoleLabel(member.role)}
                      </span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', padding: '1px 0 0' }}>
                  <p style={{ ...helperTextStyle, margin: 0, fontSize: '12px', fontWeight: 560 }}>手机号：{settings.hideMobileMask ? '已隐藏' : member.mobile_masked ?? '未提供'}</p>
                  <p style={{ ...helperTextStyle, margin: 0, fontSize: '12px', fontWeight: 560 }}>状态：{familyMemberStatusLabel(member.status)}</p>
                </div>
                {member.role !== 'owner' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px', marginTop: '2px', borderTop: '1px solid var(--nl-border-soft)', paddingTop: '10px' }}>
                    <button type="button" style={{ ...compactSecondaryButtonStyle, minHeight: '36px', padding: '7px 10px', fontSize: '12px', borderColor: member.role === 'viewer' ? 'var(--nl-primary-border)' : 'var(--nl-border-soft)', background: member.role === 'viewer' ? 'var(--nl-primary-soft)' : 'var(--nl-control-bg)', color: member.role === 'viewer' ? 'var(--nl-primary-2)' : 'var(--nl-muted-strong)', cursor: updatingUserNo === member.user_no || member.role === 'viewer' ? 'not-allowed' : 'pointer', opacity: updatingUserNo === member.user_no ? 0.64 : 1 }} onClick={() => void onChangeRole(member.user_no, 'viewer')} disabled={updatingUserNo === member.user_no || member.role === 'viewer'}>
                      {updatingUserNo === member.user_no && member.role !== 'viewer' ? '处理中…' : '设为只读'}
                    </button>
                    <button type="button" style={{ ...compactSecondaryButtonStyle, minHeight: '36px', padding: '7px 10px', fontSize: '12px', borderColor: member.role === 'editor' ? 'var(--nl-primary-border)' : 'var(--nl-border-soft)', background: member.role === 'editor' ? 'var(--nl-primary-soft)' : 'var(--nl-control-bg)', color: member.role === 'editor' ? 'var(--nl-primary-2)' : 'var(--nl-muted-strong)', cursor: updatingUserNo === member.user_no || member.role === 'editor' ? 'not-allowed' : 'pointer', opacity: updatingUserNo === member.user_no ? 0.64 : 1 }} onClick={() => void onChangeRole(member.user_no, 'editor')} disabled={updatingUserNo === member.user_no || member.role === 'editor'}>
                      {updatingUserNo === member.user_no && member.role !== 'editor' ? '处理中…' : '设为可编辑'}
                    </button>
                  </div>
                ) : null}
              </section>
            ))}
            <FamilyMemberOperations operations={operations} />
          </div>
        ) : null}
        {!loading && !error && !members.length && activeChild?.family_no ? <EmptyState message="当前家庭还没有更多成员。" /> : null}
      </Panel>
    </PageShell>
  );
};

export const FamilyMemberDetailPage = () => {
  const navigate = useNavigate();
  const { user_no: userNo } = useParams();
  const { activeChild, user } = useAuth();
  const [members, setMembers] = useState<FamilyMemberItem[]>([]);
  const [records, setRecords] = useState<RecordSummary[]>([]);
  const [operations, setOperations] = useState<FamilyMemberOperationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadDetail = async () => {
      const familyNo = activeChild?.family_no;
      const childNo = activeChild?.child_no;
      if (!familyNo || !childNo) return;
      setLoading(true);
      setMessage(null);
      try {
        const [membersResponse, recordsResponse, operationsResponse] = await Promise.all([
          webApi.listFamilyMembers(familyNo),
          webApi.listRecords({ child_no: childNo, page: 1, page_size: 30 }),
          webApi
            .listFamilyMemberOperations(familyNo, userNo ? { user_no: userNo } : undefined)
            .catch(() => emptyFamilyOperations(familyNo)),
        ]);
        if (!cancelled) {
          setMembers(membersResponse.list.filter(isVisibleFamilyMember));
          setRecords(recordsResponse.list);
          setOperations(operationsResponse.list);
        }
      } catch (err) {
        if (!cancelled) setMessage(err instanceof Error ? err.message : '家人资料加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [activeChild?.child_no, activeChild?.family_no, userNo]);

  const member = userNo ? members.find((item) => item.user_no === userNo) ?? null : null;
  const memberName = member ? getFamilyMemberDisplayName(member) : '';
  const memberRecords = member
    ? records
        .filter((record) => (record.creator_user_no ? record.creator_user_no === member.user_no : record.creator_name === member.nickname))
        .slice(0, 3)
    : [];
  const canEditRole = Boolean(member && member.role !== 'owner' && activeChild?.family_no);
  const memberJoinedDays = member?.joined_at
    ? Math.max(1, Math.ceil((Date.now() - new Date(member.joined_at).getTime()) / (24 * 60 * 60 * 1000)))
    : null;

  const changeRole = async (nextRole: 'viewer' | 'editor') => {
    const familyNo = activeChild?.family_no;
    if (!member || !familyNo || member.role === 'owner') {
      setMessage('家庭创建者权限不可在这里修改。');
      return;
    }
    if (member.role === nextRole) return;

    setUpdating(true);
    setMessage(null);
    try {
      await webApi.updateFamilyMemberRole(familyNo, member.user_no, { role: nextRole });
      setMembers((current) => current.map((item) => (item.user_no === member.user_no ? { ...item, role: nextRole } : item)));
      const operationsResponse = await webApi
        .listFamilyMemberOperations(familyNo, { user_no: member.user_no })
        .catch(() => emptyFamilyOperations(familyNo));
      setOperations(operationsResponse.list);
      setMessage('角色权限已更新');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '角色权限更新失败');
    } finally {
      setUpdating(false);
    }
  };

  const removeMember = async () => {
    const familyNo = activeChild?.family_no;
    if (!member || !familyNo || member.role === 'owner') {
      setMessage('家庭创建者不能被移出。');
      return;
    }

    setRemoving(true);
    setMessage(null);
    try {
      await webApi.deleteFamilyMember(familyNo, member.user_no);
      const operationsResponse = await webApi
        .listFamilyMemberOperations(familyNo, { user_no: member.user_no })
        .catch(() => emptyFamilyOperations(familyNo));
      setOperations(operationsResponse.list);
      setMembers((current) => current.filter((item) => item.user_no !== member.user_no));
      setMessage('成员已移出家庭');
      navigate('/family/members');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '移出家庭失败');
    } finally {
      setRemoving(false);
      setConfirmingRemove(false);
    }
  };

  const roleColor = member?.role === 'owner' ? 'var(--nl-primary-2)' : member?.role === 'editor' ? 'var(--nl-muted-strong)' : 'var(--nl-muted-strong)';
  const roleBg = 'transparent';
  return (
    <PageShell title="家人资料" backTo="/family">
      {loading ? <Panel><EmptyState message="正在加载家人资料…" /></Panel> : null}
      {!loading && !member ? <Panel><EmptyState message="未找到该家庭成员。" /></Panel> : null}
      {member ? (
        <>
          <Panel style={{ display: 'grid', gap: '18px', padding: '8px 0 22px', borderRadius: 0, background: 'transparent', border: 'none', boxShadow: 'none' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '72px minmax(0, 1fr)', gap: '16px', alignItems: 'center' }}>
              <FamilyAvatar src={resolveFamilyMemberAvatarSrc(member, user)} mediaNo={resolveFamilyMemberAvatarMediaNo(member, user)} label={memberName} size={72} />
              <div style={{ minWidth: 0, display: 'grid', gap: '7px', justifyItems: 'start' }}>
                <h2 title={memberName} style={{ margin: 0, width: '100%', color: 'var(--nl-ink)', fontFamily: 'var(--nl-font-display)', fontSize: '22px', lineHeight: 1.12, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{memberName}</h2>
                <span style={{ borderRadius: '6px', background: roleBg, color: roleColor, border: '1px solid var(--nl-border-muted)', padding: '4px 8px', fontSize: '11px', fontWeight: 650, whiteSpace: 'nowrap' }}>{familyRoleLabel(member.role)}</span>
              </div>
            </div>
            <div style={{ width: '100%', minHeight: '56px', display: 'flex', alignItems: 'center', gap: '28px', borderTop: '1px solid var(--nl-border-muted)', borderBottom: '1px solid var(--nl-border-muted)', padding: '12px 2px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '7px' }}>
                <strong style={{ color: 'var(--nl-ink)', fontSize: '20px', lineHeight: 1, fontWeight: 760 }}>{memberRecords.length}</strong>
                <span style={{ color: 'var(--nl-muted)', fontSize: '11px', fontWeight: 620 }}>发布记录</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '7px' }}>
                <strong style={{ color: 'var(--nl-ink)', fontSize: '20px', lineHeight: 1, fontWeight: 760 }}>{memberJoinedDays ?? '-'}</strong>
                <span style={{ color: 'var(--nl-muted)', fontSize: '11px', fontWeight: 620 }}>加入天数</span>
              </div>
            </div>
          </Panel>

          <section>
            <h2 style={{ margin: '0 0 12px 2px', color: 'var(--nl-ink)', fontSize: '15px', fontWeight: 720 }}>记录</h2>
            <div style={{ display: 'grid', gap: '10px' }}>
              {memberRecords.length ? memberRecords.map((record) => (
                <button key={record.record_no} type="button" onClick={() => navigate(`/record/${record.record_no}`)} style={{ width: '100%', minHeight: '62px', border: 'none', borderBottom: '1px solid var(--nl-border-muted)', borderRadius: 0, background: 'transparent', padding: '11px 0', display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left', cursor: 'pointer', boxShadow: 'none' }}>
                  <span style={{ width: '38px', height: '38px', borderRadius: '8px', background: 'transparent', color: 'var(--nl-primary-2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    {record.cover_url ? <ImageIcon size={16} /> : <FileText size={16} />}
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <strong style={{ display: 'block', color: 'var(--nl-ink)', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record.title ?? '未命名记录'}</strong>
                    <span style={{ display: 'block', marginTop: '4px', color: 'var(--nl-muted)', fontSize: '11px', fontWeight: 600 }}>{formatAppDate(record.event_time)}</span>
                  </span>
                </button>
              )) : <Panel><EmptyState message="TA还没有发布过记录。" /></Panel>}
            </div>
          </section>

          <section>
            <h2 style={{ margin: '0 0 12px 2px', color: 'var(--nl-ink)', fontSize: '15px', fontWeight: 720 }}>权限</h2>
            <Panel style={{ padding: 0, overflow: 'hidden', borderRadius: 0, background: 'transparent', border: 'none', borderTop: '1px solid var(--nl-border-muted)', boxShadow: 'none' }}>
              <div style={{ borderBottom: '1px solid var(--nl-border-muted)', background: 'transparent', padding: '13px 0', display: 'grid', gap: '10px' }}>
                <span style={{ color: 'var(--nl-muted)', fontSize: '12px', lineHeight: 1.55 }}>只读成员可查看家庭档案；可编辑成员可发布和修改记录。</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px', borderTop: '1px solid var(--nl-border-soft)', paddingTop: '10px' }}>
                  <button type="button" onClick={() => void changeRole('viewer')} disabled={!canEditRole || updating || member.role === 'viewer'} style={{ ...compactSecondaryButtonStyle, minHeight: 38, padding: '8px 10px', borderColor: member.role === 'viewer' ? 'var(--nl-primary-border)' : 'var(--nl-border-soft)', background: member.role === 'viewer' ? 'var(--nl-primary-soft)' : 'var(--nl-control-bg)', color: member.role === 'viewer' ? 'var(--nl-primary-2)' : 'var(--nl-muted-strong)', cursor: !canEditRole || updating || member.role === 'viewer' ? 'not-allowed' : 'pointer', opacity: !canEditRole ? 0.56 : 1 }}>
                    {updating && member.role !== 'viewer' ? '处理中…' : '设为只读'}
                  </button>
                  <button type="button" onClick={() => void changeRole('editor')} disabled={!canEditRole || updating || member.role === 'editor'} style={{ ...compactSecondaryButtonStyle, minHeight: 38, padding: '8px 10px', borderColor: member.role === 'editor' ? 'var(--nl-primary-border)' : 'var(--nl-border-soft)', background: member.role === 'editor' ? 'var(--nl-primary-soft)' : 'var(--nl-control-bg)', color: member.role === 'editor' ? 'var(--nl-primary-2)' : 'var(--nl-muted-strong)', cursor: !canEditRole || updating || member.role === 'editor' ? 'not-allowed' : 'pointer', opacity: !canEditRole ? 0.56 : 1 }}>
                    {updating && member.role !== 'editor' ? '处理中…' : '设为可编辑'}
                  </button>
                </div>
              </div>
              <div style={{ minHeight: '56px', borderBottom: '1px solid var(--nl-border-muted)', padding: '13px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', background: 'transparent' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--nl-ink)', fontSize: '14px', fontWeight: 700 }}>
                  <span style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'transparent', color: 'var(--nl-primary-2)', display: 'grid', placeItems: 'center' }}><Clock size={15} /></span>
                  加入时间
                </span>
                <span style={{ color: 'var(--nl-muted)', fontSize: '12px', fontWeight: 700 }}>{formatAppDate(member.joined_at, '未记录')}</span>
              </div>
              {member.role !== 'owner' ? (
                confirmingRemove ? (
                  <div style={{ padding: '13px 0', display: 'grid', gap: 10, background: 'transparent' }}>
                    <span style={{ color: 'var(--nl-danger)', fontSize: 13, fontWeight: 700 }}>确认移出 {memberName}</span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                      <button type="button" onClick={() => setConfirmingRemove(false)} disabled={removing} style={{ ...secondaryButtonStyle, minHeight: 40, borderRadius: '8px' }}>取消</button>
                      <button type="button" onClick={() => void removeMember()} disabled={removing} style={{ ...secondaryButtonStyle, minHeight: 40, borderRadius: '8px', borderColor: 'var(--nl-danger-border)', color: 'var(--nl-danger)' }}>
                        {removing ? '处理中…' : '确认移出'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setConfirmingRemove(true)} disabled={removing} style={{ width: '100%', minHeight: '56px', border: 'none', background: 'transparent', padding: '13px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', textAlign: 'left', cursor: 'pointer' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--nl-danger)', fontSize: '14px', fontWeight: 700 }}>
                      <span style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--nl-danger-soft)', color: 'var(--nl-danger)', display: 'grid', placeItems: 'center' }}><UserMinus size={15} /></span>
                      移出家庭
                    </span>
                  </button>
                )
              ) : null}
            </Panel>
          </section>
          <FamilyMemberOperations operations={operations} />
        </>
      ) : null}
      {message ? <p style={{ ...helperTextStyle, color: isPositiveStatusMessage(message) ? 'var(--nl-success)' : 'var(--nl-danger)' }}>{message}</p> : null}
    </PageShell>
  );
};

export const FamilyInvitePage = () => {
  const { activeChild } = useAuth();
  const [form, setForm] = useState({ mobile: '', role: 'viewer' as 'viewer' | 'editor' });
  const [inviteResult, setInviteResult] = useState<FamilyInviteResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const copyText = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(successMessage);
    } catch {
      setMessage('复制失败，请手动复制');
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeChild?.family_no) {
      setError('当前孩子尚未关联家庭编号');
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const mobile = form.mobile.trim();
      const result = await webApi.createFamilyInvite(activeChild.family_no, {
        role: form.role,
        ...(mobile ? { mobile } : {}),
      });
      setInviteResult(result);
      setMessage('邀请码已生成。');
    } catch (err) {
      setError(err instanceof Error ? err.message : '邀请创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell title="邀请家庭成员" backTo="/family">
      <Panel style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }}>
        <form onSubmit={onSubmit} style={rowStyle}>
          <Field label="绑定手机号">
            <input
              style={inputStyle}
              value={form.mobile}
              onChange={(event) => setForm((current) => ({ ...current, mobile: event.target.value }))}
              placeholder="手机号"
            />
          </Field>
          <Field label="邀请角色">
            <AppSegmentedControl
              ariaLabel="邀请角色"
              value={form.role}
              onChange={(value) => setForm((current) => ({ ...current, role: value as 'viewer' | 'editor' }))}
              options={[
                { value: 'viewer', label: '只读成员' },
                { value: 'editor', label: '可编辑成员' },
              ]}
            />
          </Field>
          <section aria-label="邀请权限说明" style={{ borderRadius: 0, border: 'none', borderTop: '1px solid var(--nl-border-muted)', borderBottom: '1px solid var(--nl-border-muted)', background: 'transparent', padding: '12px 0', display: 'grid', gap: '8px' }}>
            <strong style={{ color: 'var(--nl-ink)', fontSize: '13px', fontWeight: 700 }}>权限说明</strong>
            {rolePermissionItems.filter((item) => item.role !== '管理员').map((item) => (
              <p key={item.role} style={{ ...helperTextStyle, margin: 0, lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--nl-muted-strong)' }}>{item.role}：</strong>{item.detail}
              </p>
            ))}
          </section>
        {error ? <p style={{ ...helperTextStyle, color: 'var(--nl-danger)' }}>{error}</p> : null}
        {message ? <p style={{ ...helperTextStyle, color: isPositiveStatusMessage(message) ? 'var(--nl-success)' : 'var(--nl-danger)' }}>{message}</p> : null}
          <button type="submit" style={primaryButtonStyle} disabled={submitting || !activeChild?.family_no}>
            {submitting ? '生成中…' : '生成邀请码'}
          </button>
        </form>
      </Panel>

      {inviteResult ? (
        <Panel style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }}>
          <div style={rowStyle}>
            <strong>邀请码已生成</strong>
            <div style={{ border: '1px solid var(--nl-border-muted)', borderRadius: '8px', background: 'rgba(var(--nl-surface-rgb),0.14)', padding: '14px', display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
              <div style={{ minWidth: 0 }}>
                <span style={{ display: 'block', color: 'var(--nl-muted)', fontSize: '12px', fontWeight: 700 }}>邀请码</span>
                <strong style={{ display: 'block', marginTop: '4px', color: 'var(--nl-ink)', fontFamily: 'var(--nl-font-display)', fontSize: '22px', lineHeight: 1.1, letterSpacing: 0, wordBreak: 'break-all' }}>{inviteResult.invite_token}</strong>
              </div>
              <button type="button" aria-label="复制到剪贴板" style={{ ...secondaryButtonStyle, minWidth: '44px', padding: '10px' }} onClick={() => void copyText(inviteResult.invite_token, '邀请码已复制')}>
                <Copy size={16} strokeWidth={2.2} />
              </button>
            </div>
            <p style={helperTextStyle}>邀请角色：{familyRoleLabel(inviteResult.role)}</p>
            <p style={helperTextStyle}>失效时间：{formatAppDateTime(inviteResult.expires_at)}</p>
          </div>
        </Panel>
      ) : null}
    </PageShell>
  );
};
