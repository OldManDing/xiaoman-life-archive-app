import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useRef } from 'react';
import { Camera, Check, ChevronDown, ChevronRight, Clipboard, Clock, Copy, FileText, Image as ImageIcon, MessageCircle, MessageCircleMore, Mic, Pencil, PlayCircle, Plus, QrCode, UserMinus, UserPlus } from 'lucide-react';

import { useAuth } from '../shared/AuthContext';
import { webApi } from '../shared/api/webApi';
import type { ChildRecord, FamilyInviteResponse, FamilyMemberItem, FamilyMemberOperationItem, RecordSummary } from '../shared/api/types';
import { useAsyncData, useStoredMediaUrl } from '../shared/hooks';
import { childStatusLabel, familyMemberStatusLabel, familyRoleLabel, genderLabel, recordTypeLabel } from '../shared/labels';
import { createPersistableAvatarPreview, saveLocalMediaPreview, saveRuntimeMediaPreview, toStoredMediaReference } from '../shared/localMediaPreview';
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
    return <img src={resolvedSrc} alt={label} decoding="async" onError={() => setFailedSrc(resolvedSrc)} style={{ width: '132px', height: '132px', borderRadius: '999px', objectFit: 'cover', border: '4px solid rgba(255, 255, 255, 0.9)', background: 'var(--nl-surface-soft)', boxShadow: '0 14px 30px rgba(var(--nl-shadow-rgb),0.18)' }} />;
  }

  return <img src={referenceAssets.childAvatar} alt={label} decoding="async" style={{ width: '132px', height: '132px', borderRadius: '999px', objectFit: 'cover', border: '4px solid rgba(255, 255, 255, 0.9)', background: 'var(--nl-surface-soft)', boxShadow: '0 14px 30px rgba(var(--nl-shadow-rgb),0.18)' }} />;
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
  { role: '可管理', detail: '添加成员、修改档案、调整权限' },
  { role: '可查看·可补充', detail: '查看记录、补充记录、参与整理' },
  { role: '可查看', detail: '查看家庭可见内容，不修改档案' },
];

const memberRoleDescriptor = (role: string) =>
  role === 'owner' ? '家庭的守护者' : role === 'editor' ? '家庭的记录伙伴' : '家庭的关注者';

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
          <strong style={{ fontSize: 12, lineHeight: 1.16, fontWeight: 700, color: 'var(--nl-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{creatorName} {getFamilyRecordActionLabel(record)}</strong>
          <span style={{ color: 'var(--nl-muted)', fontSize: 12, fontWeight: 520 }}>{formatAppDateTime(record.event_time)}</span>
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
          <span style={{ fontSize: 12, fontWeight: 700 }}>语音记录</span>
        </div>
      ) : (
        <div style={{ minHeight: 116, borderTop: '1px solid var(--nl-border-muted)', borderBottom: '1px solid var(--nl-border-muted)', background: 'transparent', padding: '16px 0', display: 'grid', gap: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--nl-primary-2)', fontSize: 12, fontWeight: 680 }}>
            <FileText size={15} />
            {recordTypeLabel(record.record_type, record.is_milestone)}
          </span>
          <strong style={{ color: 'var(--nl-ink)', fontSize: 15, lineHeight: 1.28, fontWeight: 780, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{record.title ?? '未命名记录'}</strong>
          <span style={{ color: 'var(--nl-muted-strong)', fontSize: 12, lineHeight: 1.6, fontWeight: 460, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{record.summary ?? '这条记录还没有正文。'}</span>
        </div>
      )}
    </button>
  );
};

const FamilyMemberOperations = ({ operations }: { operations: FamilyMemberOperationItem[] }) => {
  if (!operations.length) return null;

  return (
    <section style={{ borderTop: '1px solid var(--nl-border-muted)', paddingTop: 12, display: 'grid', gap: 8 }}>
      <strong style={{ color: 'var(--nl-ink)', fontSize: 12, fontWeight: 660 }}>最近操作</strong>
      <div style={{ display: 'grid', gap: 0, borderTop: '1px solid var(--nl-border-muted)' }}>
        {operations.slice(0, 4).map((operation) => (
          <div key={operation.operation_no} style={{ minHeight: 44, borderBottom: '1px solid var(--nl-border-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '9px 0' }}>
            <span style={{ minWidth: 0, color: 'var(--nl-ink)', fontSize: 12, fontWeight: 560, lineHeight: 1.45, overflowWrap: 'anywhere' }}>{getFamilyMemberOperationText(operation)}</span>
            <span style={{ flexShrink: 0, color: 'var(--nl-muted)', fontSize: 12, fontWeight: 600 }}>{formatAppDate(operation.created_at)}</span>
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
  const visibleFamilyMembers = membersResponse?.list.filter(isVisibleFamilyMember) ?? [];
  const memberCount = visibleFamilyMembers.length;
  const recentMembers = visibleFamilyMembers.slice(0, 4);
  const activeChildName = normalizeDisplayName(activeChild?.name, '孩子');

  const birthdayMeta = (() => {
    if (!activeChild?.birthday) return null;
    const [year, month] = activeChild.birthday.split('-');
    if (!year || !month) return null;
    return `${year}年${Number(month)}月出生`;
  })();
  const heroMeta = [activeChild?.current_age_display, birthdayMeta].filter(Boolean).join(' · ');
  const roleChipLabel = (role: string) => (role === 'owner' ? '可管理' : role === 'editor' ? '可查看·可补充' : '可查看');
  const roleChipClass = (role: string) => (role === 'owner' ? 'is-owner' : role === 'editor' ? 'is-editor' : 'is-viewer');

  return (
    <div className="fam-page">
      <header className="fam-head">
        <h1 className="fam-title">家庭</h1>
        <Link to="/family/invite" className="fam-invite-btn is-round" aria-label="邀请家人" title="邀请家人">
          <Plus size={24} strokeWidth={2} />
        </Link>
      </header>

      <main className="fam-main">
        <section className="fam-hero">
          <FamilyAvatar
            src={activeChild?.avatar_url}
            mediaNo={activeChild?.avatar_media_no}
            label={activeChildName}
            size={84}
            fallbackSrc={referenceAssets.childAvatar}
          />
          <div className="fam-hero-body">
            <h2 className="fam-hero-name">{activeChildName}</h2>
            <p className="fam-hero-meta">
              {activeChild ? (
                <>
                  <span>{activeChild.current_age_display || '成长档案'}</span>
                  {birthdayMeta ? <span className="fam-hero-meta-birth">{birthdayMeta}</span> : null}
                </>
              ) : '还没有建立孩子档案'}
            </p>
          </div>
          <Link to="/family/child" className="fam-hero-cta">查看档案</Link>
        </section>
        {membersError ? <p style={{ ...helperTextStyle, color: 'var(--nl-danger)', margin: 0 }}>成员信息加载失败：{membersError}</p> : null}

        <section>
          <div className="fam-section-head">
            <h2 className="fam-section-title">家庭成员</h2>
            <Link to="/family/members" className="fam-section-link">管理 <ChevronRight size={15} /></Link>
          </div>
          {membersLoading && !recentMembers.length ? (
            <p style={{ ...helperTextStyle, margin: 0, padding: '10px 0' }}>正在加载家庭成员…</p>
          ) : recentMembers.length ? (
            <div className="fam-member-list">
              {recentMembers.map((member) => {
                const normalizedNickname = normalizeDisplayName(member.nickname, '家人');
                const memberName = member.user_no === user?.user_no && isTechnicalFamilyMemberName(member.nickname)
                  ? '我'
                  : getFamilyMemberDisplayName(member);
                return (
                  <button
                    key={member.user_no}
                    type="button"
                    onClick={() => navigate(`/family/members/${member.user_no}`)}
                    className="fam-member-row"
                  >
                    <FamilyAvatar
                      src={resolveFamilyMemberAvatarSrc(member, user)}
                      mediaNo={resolveFamilyMemberAvatarMediaNo(member, user)}
                      label={memberName || normalizedNickname}
                      size={56}
                    />
                    <span className="fam-member-body">
                      <span className="fam-member-name">{memberName}</span>
                      <span className="fam-member-role-sub">{member.role === 'owner' ? '家庭的守护者' : member.role === 'editor' ? '可以一起记录' : '只能查看'}</span>
                    </span>
                    <span className={`fam-role ${roleChipClass(member.role)}`}>{roleChipLabel(member.role)}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: 18, display: 'grid', gap: 12, justifyItems: 'center' }}>
              <EmptyState message="暂无家庭成员信息。" />
              <button type="button" onClick={() => navigate('/family/invite')} style={compactPrimaryButtonStyle}>邀请家人</button>
            </div>
          )}
        </section>

        <Link to="/family/invite" className="fam-invite-row">
          <UserPlus size={22} strokeWidth={1.7} />
          邀请家人一起记录
        </Link>

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
    birth_time: null as string | null,
    remark: '',
  });
  const [genderPickerOpen, setGenderPickerOpen] = useState(false);
  const [birthTimeOpen, setBirthTimeOpen] = useState(false);
  const [birthHour, setBirthHour] = useState('12');
  const [birthMinute, setBirthMinute] = useState('00');
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
        birth_time: data.birth_time ?? null,
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
    if (avatarUploading) {
      setMessage('头像还在上传，请稍候再保存');
      return;
    }
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setMessage('请填写孩子姓名');
      return;
    }
    const birthdayDate = new Date(`${form.birthday}T00:00:00`);
    if (!form.birthday || Number.isNaN(birthdayDate.getTime())) {
      setMessage('请选择有效的出生日期');
      return;
    }
    if (birthdayDate.getTime() > Date.now()) {
      setMessage('出生日期不能晚于今天');
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const updated = await webApi.updateChild(activeChild.child_no, { ...form, name: trimmedName });
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

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!formDirtyRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

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
    <PageShell title="孩子档案" backTo="/family" className="archive-shell">
      <Panel style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }}>
        {loading ? <EmptyState message="正在加载孩子资料…" /> : null}
        {error ? <EmptyState message={`加载失败：${error}`} /> : null}
        {!loading && !error && data ? (
          <form onSubmit={onSubmit} style={rowStyle}>
            <div className="ac-hero" style={{ display: 'grid', justifyItems: 'center', gap: 10, background: 'transparent', border: 'none', boxShadow: 'none' }}>
              <label
                aria-label="更换孩子头像"
                style={{ position: 'relative', display: 'block', flexShrink: 0, cursor: avatarUploading ? 'not-allowed' : 'pointer', opacity: avatarUploading ? 0.7 : 1 }}
              >
                <ChildAvatarPreview src={avatarPreviewUrl ?? (form.avatar_url || data.avatar_url)} mediaNo={data.avatar_media_no} label={form.name || data.name} />
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    right: -2,
                    bottom: -2,
                    width: 26,
                    height: 26,
                    borderRadius: 999,
                    background: '#fff',
                    border: 'none',
                    color: 'var(--nl-accent)',
                    display: 'grid',
                    placeItems: 'center',
                    boxShadow: '0 6px 14px rgba(var(--nl-shadow-rgb),0.2)',
                  }}
                >
                  <Camera size={18} strokeWidth={1.8} />
                </span>
                <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" disabled={avatarUploading} onChange={(event) => void onAvatarChange(event)} style={{ display: 'none' }} />
              </label>
              <span style={{ color: 'var(--nl-accent)', fontSize: 12, fontWeight: 500 }}>
                {avatarUploading ? '头像上传中…' : '更换头像'}
              </span>
            </div>
            <div className="ac-card" style={{ display: 'grid' }}>
              <div className="ac-row">
                <span className="ac-label">名字</span>
                <input className="ac-input" value={form.name} onChange={(event) => { formDirtyRef.current = true; setForm((current) => ({ ...current, name: event.target.value })); }} aria-label="孩子姓名" />
                <Pencil size={18} strokeWidth={1.8} aria-hidden="true" color="#8b7160" />
              </div>
              <div className="ac-row ac-row-date" style={{ position: 'relative' }}>
                <span className="ac-label">出生日期</span>
                <span className="ac-value">
                  {form.birthday ? (() => {
                    const [y, m, d] = form.birthday.split('-');
                    return y && m && d ? `${Number(y)}年${Number(m)}月${Number(d)}日` : form.birthday;
                  })() : '未设置'}
                </span>
                <ChevronRight size={18} strokeWidth={1.8} aria-hidden="true" color="#8b7160" />
                <div className="ac-date-ghost" aria-hidden="true">
                  <AppDateInput
                    aria-label="生日"
                    variant="line"
                    value={form.birthday}
                    displayValue={form.birthday ? (() => {
                      const [y, m, d] = form.birthday.split('-');
                      return y && m && d ? `${Number(y)}年${Number(m)}月${Number(d)}日` : form.birthday;
                    })() : undefined}
                    placeholder="年/月/日"
                    onChange={(event) => { formDirtyRef.current = true; setForm((current) => ({ ...current, birthday: event.target.value })); }}
                  />
                </div>
              </div>
              <div
                className="ac-row ac-row-time"
                style={{ position: 'relative' }}
                role="button"
                tabIndex={0}
                onClick={() => {
                  const [h, m] = (form.birth_time || '12:00').split(':');
                  setBirthHour(h || '12');
                  setBirthMinute(m || '00');
                  setBirthTimeOpen(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    const [h, m] = (form.birth_time || '12:00').split(':');
                    setBirthHour(h || '12');
                    setBirthMinute(m || '00');
                    setBirthTimeOpen(true);
                  }
                }}
              >
                <span className="ac-label">出生时间</span>
                <button
                  type="button"
                  className="ac-value ac-time-trigger"
                  aria-label="选择出生时间"
                  onClick={() => {
                    const [h, m] = (form.birth_time || '12:00').split(':');
                    setBirthHour(h || '12');
                    setBirthMinute(m || '00');
                    setBirthTimeOpen(true);
                  }}
                >
                  {form.birth_time ? form.birth_time : '未设置'}
                </button>
                <ChevronRight size={18} strokeWidth={1.8} aria-hidden="true" color="#8b7160" />
                {birthTimeOpen ? createPortal(
                  <div
                    className="ac-time-backdrop"
                    role="presentation"
                    onClick={() => setBirthTimeOpen(false)}
                  >
                    <div className="ac-time-sheet" role="dialog" aria-modal="true" aria-label="选择出生时间" onClick={(event) => event.stopPropagation()}>
                      <strong className="ac-time-title">选择出生时间</strong>
                      <p className="ac-time-preview">{birthHour}:{birthMinute}</p>
                      <div className="ac-time-cols">
                        <div className="ac-time-col">
                          {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map((h) => (
                            <button
                              key={`h-${h}`}
                              type="button"
                              className={h === birthHour ? 'is-on' : ''}
                              onClick={() => setBirthHour(h)}
                            >
                              {h}
                            </button>
                          ))}
                        </div>
                        <div className="ac-time-col">
                          {Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0')).map((m) => (
                            <button
                              key={`m-${m}`}
                              type="button"
                              className={m === birthMinute ? 'is-on' : ''}
                              onClick={() => setBirthMinute(m)}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="ac-time-actions">
                        <button type="button" onClick={() => setBirthTimeOpen(false)}>取消</button>
                        <button
                          type="button"
                          className="is-primary"
                          onClick={() => {
                            formDirtyRef.current = true;
                            setForm((current) => ({ ...current, birth_time: `${birthHour}:${birthMinute}` }));
                            setBirthTimeOpen(false);
                          }}
                        >
                          确定
                        </button>
                      </div>
                    </div>
                  </div>,
                  document.body,
                ) : null}
              </div>
              <div
                className="ac-row ac-row-gender"
                style={{ position: 'relative' }}
                role="button"
                tabIndex={0}
                onClick={() => setGenderPickerOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setGenderPickerOpen(true);
                  }
                }}
              >
                <span className="ac-label">性别</span>
                <span className="ac-value">{form.gender === 'female' ? '女' : form.gender === 'male' ? '男' : '未设置'}</span>
                <button
                  type="button"
                  aria-label="选择性别"
                  aria-expanded={genderPickerOpen}
                  onClick={() => setGenderPickerOpen((current) => !current)}
                  style={{ display: 'inline-flex', alignItems: 'center', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: '#8b7160' }}
                >
                  <ChevronRight size={18} strokeWidth={1.8} aria-hidden="true" />
                </button>
                {genderPickerOpen ? createPortal(
                  <div
                    className="ac-gender-backdrop"
                    role="presentation"
                    onClick={() => setGenderPickerOpen(false)}
                  >
                    <div
                      className="ac-gender-sheet"
                      role="dialog"
                      aria-modal="true"
                      aria-label="选择性别"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <strong className="ac-gender-title">选择性别</strong>
                      <div className="ac-gender-options">
                        {[
                          { value: 'female', label: '女' },
                          { value: 'male', label: '男' },
                          { value: 'unknown', label: '不透露' },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className={form.gender === option.value ? 'is-on' : ''}
                            onClick={() => {
                              formDirtyRef.current = true;
                              setForm((current) => ({ ...current, gender: option.value }));
                              setGenderPickerOpen(false);
                            }}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <button type="button" className="ac-gender-cancel" onClick={() => setGenderPickerOpen(false)}>
                        取消
                      </button>
                    </div>
                  </div>,
                  document.body,
                ) : null}
              </div>
              <details className="ac-more" style={{ padding: '0 18px 12px' }}>
                <summary style={{ listStyle: 'none', cursor: 'pointer', color: 'var(--nl-muted)', fontSize: 12, fontWeight: 500, minHeight: 44, display: 'flex', alignItems: 'center', gap: 6 }}>
                  更多信息 <ChevronDown size={15} strokeWidth={1.8} aria-hidden="true" />
                </summary>
                <div style={{ display: 'grid', marginTop: 4 }}>
                  <div className="ac-row" style={{ paddingLeft: 0, paddingRight: 0 }}>
                    <span className="ac-label">出生地</span>
                    <input className="ac-input" value={form.birth_place} onChange={(event) => { formDirtyRef.current = true; setForm((current) => ({ ...current, birth_place: event.target.value })); }} aria-label="出生地" />
                  </div>
                  <div className="ac-row" style={{ paddingLeft: 0, paddingRight: 0 }}>
                    <span className="ac-label">备注</span>
                    <input className="ac-input" value={form.remark} onChange={(event) => { formDirtyRef.current = true; setForm((current) => ({ ...current, remark: event.target.value })); }} aria-label="备注" />
                  </div>
                </div>
              </details>
            </div>
            <p className="archive-hint">月龄按出生日期自动计算</p>
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
  const navigate = useNavigate();
  const { activeChild, user } = useAuth();
  const [members, setMembers] = useState<FamilyMemberItem[]>([]);
  const [operations, setOperations] = useState<FamilyMemberOperationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [updatingUserNo, setUpdatingUserNo] = useState<string | null>(null);
  const [showAllMembers, setShowAllMembers] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadMembers = async () => {
      const familyNo = activeChild?.family_no;
      if (!familyNo) return;
      setLoading(true);
      setError(null);
      setMessage(null);
      setMembers([]);
      setOperations([]);
      try {
        const [membersResponse, operationsResponse] = await Promise.all([
          webApi.listFamilyMembers(familyNo),
          webApi.listFamilyMemberOperations(familyNo).catch(() => emptyFamilyOperations(familyNo)),
        ]);
        if (cancelled) return;
        setMembers(membersResponse.list.filter((member) => (member.status === 0 || member.status === 1) && !/^native_delete_/i.test(member.nickname.trim())));
        setOperations(operationsResponse.list);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : '加载成员失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadMembers();
    return () => {
      cancelled = true;
    };
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
  const selfMember = members.find((item) => item.user_no === user?.user_no) ?? null;
  const canManageMembers = selfMember?.role === 'owner';
  const visibleMembers = showAllMembers ? members : members.slice(0, 6);
  const hiddenMemberCount = Math.max(members.length - visibleMembers.length, 0);

  return (
    <PageShell title="家庭成员" backTo="/family" className="account-shell">
      <Panel style={{ padding: 0, background: 'transparent', border: 'none', boxShadow: 'none' }}>
        {!activeChild?.family_no ? <EmptyState message="当前孩子尚未关联家庭编号。" /> : null}
        {loading ? <EmptyState message="正在加载家庭成员…" /> : null}
        {error ? <EmptyState message={`加载失败：${error}`} /> : null}
        {message ? <p style={{ ...helperTextStyle, color: message === '成员角色已更新' ? 'var(--nl-success)' : 'var(--nl-danger)' }}>{message}</p> : null}
        {members.length ? (
          <div style={{ display: 'grid', gap: '12px' }}>
            <p className="fam-members-summary" style={{ margin: 0, color: 'var(--nl-muted-strong)', fontSize: 13, lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: 6 }}>
              {members.filter((member) => member.status !== 0).length} 位家人
              {members.filter((member) => member.status === 0).length ? (
                <>
                  ·
                  <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: '#e9a05a', display: 'inline-block' }} />
                  {members.filter((member) => member.status === 0).length} 位待接受（共 {members.length} 人）
                </>
              ) : null}
            </p>

            {hiddenMemberCount || (showAllMembers && members.length > 6) ? (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', alignItems: 'center' }}>
                {hiddenMemberCount ? (
                  <button type="button" style={{ ...compactSecondaryButtonStyle, minHeight: '36px', padding: '7px 12px', fontSize: '12px', flexShrink: 0 }} onClick={() => setShowAllMembers(true)}>
                    展开全部
                  </button>
                ) : (
                  <button type="button" style={{ ...compactSecondaryButtonStyle, minHeight: '36px', padding: '7px 12px', fontSize: '12px', flexShrink: 0 }} onClick={() => setShowAllMembers(false)}>
                    收起
                  </button>
                )}
              </div>
            ) : null}
            {visibleMembers.map((member) => {
              const pending = member.status === 0;
              return (
                <section
                  key={member.user_no}
                  className="member-row-card"
                  style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: 10 }}
                >
                  <button
                    type="button"
                    onClick={() => navigate(`/family/members/${member.user_no}`)}
                    style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0, border: 'none', background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer' }}
                    aria-label={`查看${getFamilyMemberDisplayName(member)}的资料与权限`}
                  >
                    <FamilyAvatar src={member.avatar_url} mediaNo={member.avatar_media_no} label={getFamilyMemberDisplayName(member)} size={48} radius="999px" />
                    <span style={{ minWidth: 0, display: 'grid', gap: 2 }}>
                      <strong style={{ minWidth: 0, maxWidth: '100%', fontSize: '17px', lineHeight: 1.5, color: 'var(--nl-ink)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflowWrap: 'anywhere' }}>{getFamilyMemberDisplayName(member)}</strong>
                      <span style={{ fontSize: '13px', color: '#6f5745', lineHeight: 1.4 }}>{pending ? '邀请中 · 加入后可查看' : memberRoleDescriptor(member.role)}</span>
                    </span>
                  </button>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, justifySelf: 'end' }}>
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: pending || member.role === 'owner' ? '#8a4e14' : '#8a4e14',
                        background: pending || member.role === 'owner' ? '#E9A05A' : '#F3E4D0',
                        border: 'none',
                        padding: '5px 10px',
                        borderRadius: '10px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {pending ? '待接受' : familyRoleLabel(member.role)}
                    </span>
                    {pending ? (
                      <>
                        <span aria-hidden="true" style={{ width: 1, height: 14, background: 'rgba(58, 42, 28, 0.16)' }} />
                        <button type="button" onClick={() => navigate('/family/invite')} style={{ border: 'none', background: 'transparent', color: 'var(--nl-accent)', fontSize: 12, fontWeight: 500, textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer', padding: 0 }}>
                          重发
                        </button>
                      </>
                    ) : null}
                  </span>
                </section>
              );
            })}
            <section style={{ display: 'grid', gap: 8, padding: '6px 2px 0' }}>
              <strong style={{ color: 'var(--nl-ink)', fontSize: '15px', fontWeight: 600 }}>权限说明</strong>
              {rolePermissionItems.map((item) => (
                <p key={item.role} style={{ margin: 0, color: '#6f5745', fontSize: '15px', lineHeight: 1.75 }}>
                  <strong style={{ color: 'var(--nl-ink)', fontWeight: 600 }}>{item.role}</strong>
                  ：{item.detail}
                </p>
              ))}
            </section>
            <Link
              to="/family/invite"
              className="members-invite-cta"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                minHeight: 64,
                borderRadius: 26,
                border: '1px dashed rgba(169, 88, 27, 0.32)',
                background: 'rgba(255, 255, 255, 0.26)',
                color: 'var(--nl-ink)',
                fontSize: 13,
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              <UserPlus size={28} strokeWidth={1.8} aria-hidden="true" />
              邀请家人加入
            </Link>
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
  const [recordTotal, setRecordTotal] = useState(0);
  const [operations, setOperations] = useState<FamilyMemberOperationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [pendingRole, setPendingRole] = useState<'viewer' | 'editor' | 'owner' | null>(null);

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
          setRecordTotal(recordsResponse.total ?? recordsResponse.list.length);
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
        .slice()
        .sort((a, b) => new Date(b.event_time).getTime() - new Date(a.event_time).getTime())
        .slice(0, 3)
    : [];
  const selfMember = user?.user_no ? members.find((item) => item.user_no === user.user_no) ?? null : null;
  const isFamilyOwner = selfMember?.role === 'owner';
  const canEditRole = Boolean(member && member.role !== 'owner' && activeChild?.family_no && isFamilyOwner);
  useEffect(() => {
    if (member && (member.role === 'viewer' || member.role === 'editor' || member.role === 'owner')) setPendingRole(member.role);
  }, [member?.user_no, member?.role]);
  const memberJoinedDays = (() => {
    if (!member?.joined_at) return null;
    const joined = new Date(member.joined_at).getTime();
    if (!Number.isFinite(joined)) return null;
    return Math.max(1, Math.ceil((Date.now() - joined) / (24 * 60 * 60 * 1000)));
  })();

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

  const memberLatestRecordTime = memberRecords[0]?.event_time ?? null;
  const memberLatestRecordLabel = (() => {
    if (!memberLatestRecordTime) return null;
    const time = new Date(memberLatestRecordTime).getTime();
    if (!Number.isFinite(time)) return null;
    const days = Math.floor((Date.now() - time) / (24 * 60 * 60 * 1000));
    if (days <= 0) return '最近 1 天内';
    if (days < 30) return `最近 ${days} 天前`;
    const months = Math.floor(days / 30);
    return `最近 ${months} 个月前`;
  })();
  const memberJoinedLabel = (() => {
    if (!member?.joined_at) return null;
    const joined = new Date(member.joined_at);
    if (Number.isNaN(joined.getTime())) return null;
    return `加入于 ${joined.getFullYear()}年${joined.getMonth() + 1}月${joined.getDate()}日`;
  })();
  return (
    <PageShell title="家庭成员" backTo="/family" className="account-shell">
      {loading ? <Panel><EmptyState message="正在加载家人资料…" /></Panel> : null}
      {!loading && !member ? <Panel><EmptyState message="未找到该家庭成员。" /></Panel> : null}
      {member ? (
        <>
          <header style={{ display: 'grid', gap: 8, justifyItems: 'center', padding: '18px 0 6px', background: 'transparent', border: 'none', boxShadow: 'none' }}>
            <FamilyAvatar src={resolveFamilyMemberAvatarSrc(member, user)} mediaNo={resolveFamilyMemberAvatarMediaNo(member, user)} label={memberName} size={150} />
            <h2 title={memberName} style={{ margin: 0, maxWidth: '100%', color: 'var(--nl-ink)', fontFamily: 'var(--nl-font-display)', fontSize: '30px', lineHeight: 1.15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{memberName}</h2>
            <span style={{ color: '#6f5745', fontSize: 15, fontWeight: 500 }}>
              {memberJoinedLabel ?? `已加入 ${memberJoinedDays ?? '-'} 天`}
            </span>
          </header>

          <section>
            <h2 className="fam-detail-title">权限设置</h2>
            <div role="radiogroup" aria-label="成员权限" style={{ display: 'grid', gap: 8 }}>
              {([
                { value: 'viewer' as const, title: '仅浏览', detail: '可以查看记录，但不能新增' },
                { value: 'editor' as const, title: '可补充', detail: '可以查看并新增记录' },
                { value: 'owner' as const, title: '管理员', detail: '可以添加成员、修改档案、调整权限' },
              ]).map((option) => {
                const selected = (pendingRole ?? member.role) === option.value;
                const disabled = !canEditRole || updating;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`perm-option${selected ? ' is-selected' : ''}`}
                    role="radio"
                    aria-checked={selected}
                    disabled={disabled}
                    onClick={() => setPendingRole(option.value)}
                    style={{
                      width: '100%',
                      minHeight: 68,
                      border: 'none',
                      borderRadius: 14,
                      background: selected ? 'rgba(233, 160, 90, 0.22)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 12px',
                      textAlign: 'left',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      opacity: !canEditRole ? 0.6 : 1,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 999,
                        border: selected ? 'none' : '1.5px solid #8b7160',
                        background: selected ? 'var(--nl-primary)' : 'transparent',
                        color: 'var(--nl-on-primary)',
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {selected ? <Check size={12} strokeWidth={3} /> : null}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <strong style={{ display: 'block', color: 'var(--nl-ink)', fontSize: 13, fontWeight: 600 }}>{option.title}</strong>
                      <span style={{ color: '#6f5745', fontSize: 12, lineHeight: 1.5 }}>{option.detail}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="perm-hint">{canEditRole ? '修改权限后点下方保存生效' : '只有家庭管理员可以修改权限'}</p>
          </section>

          <section aria-label="记录贡献" style={{ display: 'grid', gap: 10 }}>
            <h2 className="fam-detail-title">记录贡献</h2>
            <div style={{ minHeight: 64, display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(58, 42, 28, 0.08)' }}>
              <span style={{ width: 24, height: 24, display: 'grid', placeItems: 'center', color: '#8a4e14', flexShrink: 0 }}>
                <FileText size={24} strokeWidth={1.8} />
              </span>
              <span style={{ flex: 1, minWidth: 0, color: 'var(--nl-ink)', fontSize: 13, fontWeight: 500 }}>
                {recordTotal} 条记录
              </span>
              {memberLatestRecordLabel ? (
                <span style={{ color: '#6f5745', fontSize: 12 }}>· {memberLatestRecordLabel}</span>
              ) : null}
            </div>
          </section>

          {canEditRole ? (
            <button
              type="button"
              className="fam-detail-save"
              onClick={() => pendingRole && void changeRole(pendingRole as 'viewer' | 'editor')}
              disabled={updating || !pendingRole || pendingRole === member.role}
              style={{ ...primaryButtonStyle, width: '100%', opacity: updating || !pendingRole || pendingRole === member.role ? 0.6 : 1 }}
            >
              {updating ? '保存中…' : '保存权限'}
            </button>
          ) : null}

          {member.role !== 'owner' && isFamilyOwner ? (
            <section aria-label="危险操作" style={{ display: 'grid', gap: 8 }}>
              {confirmingRemove ? (
                <Panel style={{ padding: 14, borderRadius: 'var(--nl-radius-row, 18px)' }}>
                  <div style={{ display: 'grid', gap: 10 }}>
                    <span style={{ color: 'var(--nl-danger)', fontSize: 12, fontWeight: 600 }}>确认把 {memberName} 移除出家庭？</span>
                    <span style={{ color: '#6f5745', fontSize: 12, lineHeight: 1.6 }}>移出后 TA 将看不到小满的记录，之后需要重新邀请。</span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                      <button type="button" onClick={() => setConfirmingRemove(false)} disabled={removing} style={{ ...secondaryButtonStyle, minHeight: 44 }}>取消</button>
                      <button type="button" onClick={() => void removeMember()} disabled={removing} style={{ ...secondaryButtonStyle, minHeight: 44, borderColor: 'var(--nl-danger-border)', color: 'var(--nl-danger)' }}>
                        {removing ? '处理中…' : '确认移出'}
                      </button>
                    </div>
                  </div>
                </Panel>
              ) : (
                <Panel style={{ padding: 0, borderRadius: 'var(--nl-radius-row, 18px)' }}>
                  <button type="button" onClick={() => setConfirmingRemove(true)} disabled={removing} style={{ width: '100%', minHeight: 64, border: 'none', background: 'transparent', padding: '14px', display: 'grid', gap: 4, textAlign: 'left', cursor: 'pointer' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--nl-danger)', fontSize: 13, fontWeight: 500 }}>
                      <UserMinus size={24} strokeWidth={1.8} aria-hidden="true" />
                      移除这位家人
                    </span>
                    <span style={{ color: '#6f5745', fontSize: 12, lineHeight: 1.5, paddingLeft: 36 }}>移出后 TA 将看不到小满的记录</span>
                  </button>
                </Panel>
              )}
            </section>
          ) : null}
          <FamilyMemberOperations operations={operations} />
        </>
      ) : null}
      {message ? <p style={{ ...helperTextStyle, color: isPositiveStatusMessage(message) ? 'var(--nl-success)' : 'var(--nl-danger)' }}>{message}</p> : null}
    </PageShell>
  );
};

const inviteCacheKey = (familyNo: string) => `nianlun.invite:${familyNo}`;
const inviteInFlight = new Map<string, Promise<FamilyInviteResponse>>();

const readCachedInvite = (familyNo: string): FamilyInviteResponse | null => {
  try {
    const raw = window.sessionStorage.getItem(inviteCacheKey(familyNo));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { invite: FamilyInviteResponse; expiresAt: number };
    if (!parsed?.invite || !parsed.expiresAt || parsed.expiresAt < Date.now()) return null;
    return parsed.invite;
  } catch {
    return null;
  }
};

const writeCachedInvite = (familyNo: string, invite: FamilyInviteResponse) => {
  try {
    const expiresAt = invite.expires_at ? new Date(invite.expires_at).getTime() : Date.now() + 6 * 60 * 60 * 1000;
    window.sessionStorage.setItem(inviteCacheKey(familyNo), JSON.stringify({ invite, expiresAt }));
  } catch {
    /* storage may be unavailable */
  }
};

const getOrCreateInvite = (familyNo: string) => {
  const cached = readCachedInvite(familyNo);
  if (cached) return Promise.resolve(cached);
  const inFlight = inviteInFlight.get(familyNo);
  if (inFlight) return inFlight;
  const request = webApi
    .createFamilyInvite(familyNo, { role: 'viewer' })
    .then((invite) => {
      writeCachedInvite(familyNo, invite);
      return invite;
    })
    .finally(() => inviteInFlight.delete(familyNo));
  inviteInFlight.set(familyNo, request);
  return request;
};

export const FamilyInvitePage = () => {
  const { activeChild } = useAuth();
  const [inviteResult, setInviteResult] = useState<FamilyInviteResponse | null>(null);
  const [members, setMembers] = useState<FamilyMemberItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const familyNo = activeChild?.family_no;

  const copyText = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(successMessage);
    } catch {
      setMessage('复制失败，请手动复制');
    }
  };

  useEffect(() => {
    if (!familyNo) return undefined;
    let cancelled = false;
    void (async () => {
      try {
        const [memberResult, invite] = await Promise.all([
          webApi.listFamilyMembers(familyNo),
          getOrCreateInvite(familyNo),
        ]);
        if (cancelled) return;
        setMembers(memberResult.list);
        setInviteResult(invite);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '邀请信息加载失败');
      }
    })();
    return () => { cancelled = true; };
  }, [familyNo]);

  const inviteCode = inviteResult?.invite_token ?? '';
  const inviteText = inviteCode
    ? `我在「年轮」记录${activeChild?.name ?? '孩子'}的成长，邀请你一起看。邀请码：${inviteCode}`
    : '我在「年轮」记录孩子的成长，邀请你一起看。';
  const inviteLink = inviteCode ? `${window.location.origin}/auth/login?invite=${inviteCode}` : window.location.origin;

  const inviteByWechat = () => {
    void copyText(inviteText, '邀请信息已复制，去微信粘贴给家人');
  };

  const inviteBySms = () => {
    window.location.href = `sms:?&body=${encodeURIComponent(inviteText)}`;
  };

  
const formatRelativeJoinedAt = (value?: string | null) => {
  if (!value) return '';
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return '';
  const minutes = Math.floor((Date.now() - time) / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return `${Math.floor(days / 30)} 个月前`;
};

const invitedMembers = members.filter((member) => member.role !== 'owner');

  return (
    <PageShell title="邀请家人" backTo="/family" className="invite-shell">
      <Panel style={{ padding: '20px 20px 22px' }} className="invite-card">
        <div className="invite-qr">
          <img src="/photos/invite-qr.png" alt="邀请二维码" />
          <span className="invite-qr-dot" aria-hidden="true" />
        </div>
        <h2 className="invite-title">扫码加入{activeChild?.name ?? ''}的档案</h2>
        <p className="invite-sub">有效期 7 天{inviteResult?.expires_at ? ` · ${new Date(inviteResult.expires_at).getFullYear()}年${new Date(inviteResult.expires_at).getMonth() + 1}月${new Date(inviteResult.expires_at).getDate()}日前有效` : ''}</p>

        <div className="invite-code-pill">
          <strong className="invite-code-value">{inviteCode || (activeChild?.family_no ? '生成中…' : '暂无邀请码')}</strong>
          <button
            type="button"
            aria-label="复制邀请码"
            className="invite-code-copy"
            onClick={() => void copyText(inviteCode, '邀请码已复制')}
            disabled={!inviteCode}
          >
            复制
          </button>
        </div>

        <button
          type="button"
          className="invite-share"
          onClick={() => void copyText(inviteLink, '邀请链接已复制')}
          disabled={!inviteCode}
        >
          分享邀请链接
        </button>

        {error ? <p style={{ ...helperTextStyle, margin: 0, color: 'var(--nl-danger)' }}>{error}</p> : null}
        {message ? <p style={{ ...helperTextStyle, margin: 0, color: isPositiveStatusMessage(message) ? 'var(--nl-success)' : 'var(--nl-danger)' }}>{message}</p> : null}
      </Panel>

      <section aria-label="已邀请" 
style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <strong className="invite-section-title">已邀请</strong>
          <span aria-hidden="true" style={{ flex: 1, height: 1, background: 'var(--nl-border-soft)' }} />
        </div>
        {invitedMembers.length ? invitedMembers.map((member) => {
          const pending = member.status === 0;
          return (
            <div
              key={member.user_no}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                minHeight: 52,
                padding: '8px 14px',
                borderRadius: 'var(--nl-radius-row, 18px)',
                background: 'rgba(255, 255, 255, 0.78)',
                border: 'none',
              }}
            >
              <span style={{
                width: 40,
                height: 40,
                borderRadius: 999,
                overflow: 'hidden',
                flexShrink: 0,
                background: 'var(--nl-primary-soft)',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--nl-accent)',
                fontWeight: 700,
              }}>
                {member.avatar_url ? (
                  <img src={member.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : member.nickname.slice(0, 1)}
              </span>
              <div style={{ minWidth: 0, flex: '1 1 auto', display: 'flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap' }}>
                <strong style={{ color: 'var(--nl-ink)', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {normalizeDisplayName(member.nickname, '家人')}
                </strong>
                <span aria-hidden="true" style={{ color: 'var(--nl-muted)', fontSize: 12 }}>·</span>
                <span style={{ color: 'var(--nl-muted)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {pending ? `已发送${formatRelativeJoinedAt(member.joined_at) ? ` ${formatRelativeJoinedAt(member.joined_at)}` : ''}` : (member.joined_at ? `${new Date(member.joined_at).getFullYear()}年${new Date(member.joined_at).getMonth() + 1}月${new Date(member.joined_at).getDate()}日加入` : '已加入')}
                </span>
              </div>
              <span style={{
                flexShrink: 0,
                padding: '7px 14px',
                borderRadius: 999,
                background: pending ? 'rgba(111, 87, 69, 0.12)' : '#E9A05A',
                color: pending ? 'var(--nl-muted-strong)' : '#8a4e14',
                fontSize: 12,
                fontWeight: 600,
                lineHeight: 1,
              }}>
                {pending ? '待接受' : '已加入'}
              </span>
            </div>
          );
        }) : <EmptyState message="还没有邀请其他家人。" />}
        {invitedMembers.some((member) => member.status === 0) ? (
          <button
            type="button"
            onClick={() => void copyText(inviteLink, '邀请链接已复制，可再次发送给家人')}
            style={{ border: 'none', background: 'transparent', color: 'var(--nl-accent)', fontSize: 12, fontWeight: 500, textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer', justifySelf: 'center', padding: '6px 0' }}
          >
            对方没收到？重新发送
          </button>
        ) : null}
      </section>

      <p className="invite-footer">家人可以看见并一起记录{activeChild?.name ?? ''}的成长</p>
    </PageShell>
  );
};
