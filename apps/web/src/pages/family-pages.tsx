import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Calendar, Camera, ChevronRight, Clock, Copy, FileText, Heart, Image as ImageIcon, Mic, PlayCircle, Plus, ShieldAlert, UserMinus, UserPlus, UserRound } from 'lucide-react';

import { useAuth } from '../shared/AuthContext';
import { webApi } from '../shared/api/webApi';
import type { ChildRecord, FamilyInviteResponse, FamilyMemberItem, RecordSummary } from '../shared/api/types';
import { useAsyncData, useStoredMediaUrl } from '../shared/hooks';
import { childStatusLabel, familyMemberStatusLabel, familyRoleLabel, genderLabel, recordTypeLabel } from '../shared/labels';
import { createPersistableMediaPreview, resolveMediaPreviewUrl, saveLocalMediaPreview, toStoredMediaReference } from '../shared/localMediaPreview';
import { loadLocalSettings } from '../shared/localSettings';
import { isSupportedImageFile, resolveFileMimeType, withResolvedFileMimeType } from '../shared/mediaFiles';
import { AppSegmentedControl, Field, PageShell, Panel, helperTextStyle, inputStyle, primaryButtonStyle, secondaryButtonStyle, textareaStyle } from '../shared/ui';
import { EmptyState, buttonRowStyle, formSubmitSpacingStyle, rowStyle } from './shared';
import { RefAvatar, RefSectionTitle, refCardStyle, refMutedTextStyle, refPageStyle, refSoftCardStyle, referenceAssets } from './reference-ui';

const isPositiveStatusMessage = (message: string) => !/(失败|不能|请先|仅支持|无法|错误)/.test(message);

const uploadChildAvatarImage = async (childNo: string, file: File) => {
  const uploadFile = withResolvedFileMimeType(file);
  const uploadToken = await webApi.createUploadToken({
    child_no: childNo,
    file_name: uploadFile.name,
    mime_type: resolveFileMimeType(uploadFile) || uploadFile.type,
    size_bytes: uploadFile.size,
    media_type: 'image',
  });

  const preview = await createPersistableMediaPreview(uploadFile);
  saveLocalMediaPreview(uploadToken.media_no, preview);

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
  await webApi.confirmUpload({ media_no: uploadToken.media_no });
  return toStoredMediaReference(uploadToken.media_no);
};

const ChildAvatarPreview = ({ src, label }: { src?: string | null; label: string }) => {
  const resolvedSrc = useStoredMediaUrl(src);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  useEffect(() => {
    setFailedSrc(null);
  }, [resolvedSrc]);

  if (resolvedSrc && failedSrc !== resolvedSrc) {
    return <img src={resolvedSrc} alt={label} onError={() => setFailedSrc(resolvedSrc)} style={{ width: '72px', height: '72px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e7e5e4', background: '#f5f5f4' }} />;
  }

  return (
    <div style={{ width: '72px', height: '72px', borderRadius: '8px', border: '1px solid #e7e5e4', background: '#f5f5f4', display: 'grid', placeItems: 'center', color: '#57534e', fontSize: '24px', fontWeight: 700 }}>
      {label.slice(0, 1) || '宝'}
    </div>
  );
};

const isGeneratedSvgAvatar = (src?: string | null) => Boolean(src?.trim().startsWith('data:image/svg+xml'));

const resolveReferenceAvatar = (src: string | null | undefined, fallbackSrc: string) => {
  if (!src || isGeneratedSvgAvatar(src)) return fallbackSrc;
  return src;
};

const FamilyAvatar = ({ src, label, size = 42, radius = '999px', fallbackSrc }: { src?: string | null; label: string; size?: number; radius?: string; fallbackSrc?: string }) => {
  const resolvedSrc = useStoredMediaUrl(src && !isGeneratedSvgAvatar(src) ? src : null);
  const displaySrc = resolvedSrc ?? fallbackSrc;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  useEffect(() => {
    setFailedSrc(null);
  }, [displaySrc]);

  if (displaySrc && failedSrc !== displaySrc) {
    return <img src={displaySrc} alt={label} onError={() => setFailedSrc(displaySrc)} style={{ width: `${size}px`, height: `${size}px`, borderRadius: radius, objectFit: 'cover', border: '1px solid #eee9df', flexShrink: 0, boxShadow: '0 2px 8px rgba(15,23,42,0.03)' }} />;
  }

  return (
    <div style={{ width: `${size}px`, height: `${size}px`, borderRadius: radius, background: '#f5f5f4', border: '1px solid #eee9df', display: 'grid', placeItems: 'center', color: '#57534e', fontWeight: 700, flexShrink: 0, boxShadow: '0 2px 8px rgba(15,23,42,0.03)' }}>
      {label.slice(0, 1) || '?'}
    </div>
  );
};

const getFamilyRecordCoverUrl = (record: RecordSummary) => resolveMediaPreviewUrl(record.cover_media_no, record.cover_url);

const getFamilyRecordMediaKind = (record: RecordSummary) =>
  record.cover_media_type ?? (record.record_type === 'audio' || record.record_type === 'video' ? record.record_type : null);

const getFamilyRecordActionLabel = (record: RecordSummary) => {
  const mediaKind = getFamilyRecordMediaKind(record);
  if (mediaKind === 'video') return '上传了视频记录';
  if (mediaKind === 'audio') return '记录了一段语音';
  if (getFamilyRecordCoverUrl(record)) return '上传了照片';
  return `记录了${recordTypeLabel(record.record_type, record.is_milestone)}`;
};

const getFamilyMemberDisplayName = (member: FamilyMemberItem) =>
  /^native_parent_\d+$/i.test(member.nickname.trim()) ? '家人' : member.nickname;

export const FamilyPage = () => {
  const navigate = useNavigate();
  const { activeChild } = useAuth();
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

  const memberCount = membersResponse?.list.length ?? 0;
  const recentMembers = membersResponse?.list.slice(0, 4) ?? [];
  const recentFamilyRecords = familyRecords?.slice(0, 2) ?? [];
  const activeChildName = activeChild?.name?.trim() || '孩子';

  return (
    <div style={refPageStyle}>
      <header style={{ padding: 'calc(34px + env(safe-area-inset-top)) 20px 15px', background: 'transparent' }}>
        <h1 style={{ margin: 0, color: '#172033', fontSize: 26, fontWeight: 950 }}>家庭</h1>
      </header>

      <main style={{ display: 'grid', gap: 24, padding: '0 20px 28px' }}>
      <section style={{ ...refSoftCardStyle, background: 'rgba(255,255,255,0.96)', borderColor: 'rgba(126,145,170,0.2)', padding: 17, minHeight: 96 }}>
          {activeChild ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 13, alignItems: 'center', minWidth: 0 }}>
                <RefAvatar src={resolveReferenceAvatar(activeChild.avatar_url, referenceAssets.childPhoto)} label={activeChildName} size={52} radius="16px" fallbackSrc={referenceAssets.childPhoto} />
                <div style={{ minWidth: 0 }}>
                  <h2 style={{ margin: 0, color: '#172033', fontSize: 18, fontWeight: 950, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeChildName}的家庭</h2>
                  <p style={{ ...refMutedTextStyle, marginTop: 4 }}>已有 {membersLoading ? '…' : memberCount} 位家人加入记录</p>
                </div>
              </div>
          <Link to="/family/invite" aria-label="邀请成员" title="邀请成员" style={{ width: 46, height: 46, borderRadius: '17px', background: '#17342f', color: '#ffffff', display: 'grid', placeItems: 'center', textDecoration: 'none', flexShrink: 0, boxShadow: '0 14px 28px rgba(23,52,47,0.22)' }}>
                <UserPlus size={20} />
              </Link>
            </div>
          ) : <EmptyState message="请先完成建档或选择一个孩子。" />}
          {membersError ? <p style={{ ...helperTextStyle, color: '#dc2626', marginTop: 10 }}>成员信息加载失败：{membersError}</p> : null}
        </section>

        <section>
          <RefSectionTitle style={{ color: '#172033', fontSize: 16 }}>家庭成员</RefSectionTitle>
          <div style={{ ...refCardStyle, borderRadius: 20, overflow: 'hidden' }}>
            {recentMembers.length ? recentMembers.map((member, index) => {
              const memberName = getFamilyMemberDisplayName(member);
              return (
              <button key={member.user_no} type="button" onClick={() => navigate(`/family/members/${member.user_no}`)} style={{ width: '100%', minHeight: 68, border: 'none', borderBottom: index === recentMembers.length - 1 ? 'none' : '1px solid rgba(126,145,170,0.14)', background: 'rgba(255,255,255,0.76)', padding: '13px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, textAlign: 'left', cursor: 'pointer' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <FamilyAvatar label={memberName} size={42} fallbackSrc={index === 0 ? referenceAssets.momAvatar : undefined} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'flex', gap: 7, alignItems: 'center', minWidth: 0 }}>
                      <strong style={{ color: '#172033', fontSize: 14, fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{memberName}</strong>
                      <span style={{ color: member.role === 'owner' ? '#d97706' : member.role === 'editor' ? '#2563eb' : '#78716c', background: member.role === 'owner' ? '#fef3c7' : member.role === 'editor' ? '#eff6ff' : '#f5f5f4', borderRadius: 5, padding: '2px 6px', fontSize: 9, fontWeight: 900 }}>{familyRoleLabel(member.role)}</span>
                    </span>
                    <span style={{ display: 'block', marginTop: 4, color: '#9ca3af', fontSize: 11, fontWeight: 700 }}>{member.status === 1 ? '已加入家庭记录' : familyMemberStatusLabel(member.status)}</span>
                  </span>
                </span>
                <ChevronRight size={17} color="#cbd5e1" />
              </button>
              );
            }) : (
              <div style={{ padding: 18, display: 'grid', gap: 12, justifyItems: 'center' }}>
                <EmptyState message="暂无家庭成员信息。" />
                <button type="button" onClick={() => navigate('/family/invite')} style={{ minHeight: 38, border: 'none', borderRadius: '999px', background: '#292524', color: '#ffffff', padding: '8px 16px', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>邀请家人</button>
              </div>
            )}
          </div>
        </section>

        <section>
          <RefSectionTitle style={{ color: '#172033', fontSize: 16 }}>最近家庭动态</RefSectionTitle>
          {recordsLoading ? <EmptyState message="正在加载家庭动态…" /> : null}
          {recordsError ? <EmptyState message={`家庭动态加载失败：${recordsError}`} /> : null}
          {!recordsLoading && !recordsError && recentFamilyRecords.length ? (
            <div style={{ position: 'relative', display: 'grid', gap: 22, paddingLeft: 24, marginLeft: 12 }}>
              <span aria-hidden="true" style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 1, background: '#e5e7eb' }} />
              {recentFamilyRecords.map((record, index) => {
                const coverUrl = getFamilyRecordCoverUrl(record);
                const mediaKind = getFamilyRecordMediaKind(record);
                return (
                  <button key={record.record_no} type="button" aria-label={`查看家庭动态：${record.title ?? '未命名记录'}`} onClick={() => navigate(`/record/${record.record_no}`)} style={{ border: 'none', background: 'transparent', padding: 0, display: 'grid', gap: 7, textAlign: 'left', cursor: 'pointer', position: 'relative' }}>
                    <span aria-hidden="true" style={{ position: 'absolute', left: -34, top: 0, width: 28, height: 28, borderRadius: '999px', background: '#ffffff', display: 'grid', placeItems: 'center' }}>
                      <RefAvatar src={index === 0 ? referenceAssets.momAvatar : referenceAssets.childAvatar} label={record.creator_name} size={26} />
                    </span>
                    <span style={{ display: 'flex', gap: 7, alignItems: 'baseline', color: '#44403c' }}>
                      <strong style={{ fontSize: 13, fontWeight: 900 }}>{record.creator_name}</strong>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>{getFamilyRecordActionLabel(record)}</span>
                    </span>
                    <span style={{ color: '#9ca3af', fontSize: 11, fontWeight: 700 }}>{new Date(record.event_time).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                    {coverUrl && mediaKind !== 'audio' ? (
                      <span style={{ position: 'relative', display: 'block', width: 'min(100%, 232px)', height: 148 }}>
                        <img src={coverUrl} alt={record.title ?? '家庭动态图片'} style={{ width: '100%', height: '100%', borderRadius: 16, objectFit: 'cover', border: '1px solid #eee9df', display: 'block' }} />
                        {mediaKind === 'video' ? (
                          <span aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#ffffff' }}>
                            <PlayCircle size={40} fill="rgba(255,255,255,0.34)" strokeWidth={1.8} />
                          </span>
                        ) : null}
                      </span>
                    ) : mediaKind === 'audio' ? (
                      <div style={{ maxWidth: 230, borderRadius: '999px', border: '1px solid #eee9df', background: '#fafaf9', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 9, color: '#57534e' }}>
                        <Mic size={15} />
                        <span style={{ fontSize: 13, fontWeight: 700 }}>语音记录</span>
                      </div>
                    ) : (
                      <img src={index % 2 ? referenceAssets.parkPhoto : referenceAssets.childPhoto} alt={record.title ?? '家庭动态图片'} style={{ width: 'min(100%, 232px)', height: 148, borderRadius: 16, objectFit: 'cover', border: '1px solid #eee9df' }} />
                    )}
                  </button>
                );
              })}
            </div>
          ) : null}
          {!recordsLoading && !recordsError && !recentFamilyRecords.length ? <EmptyState message="还没有可展示的家庭动态。" /> : null}
        </section>

      <section style={{ ...refSoftCardStyle, background: 'rgba(255,249,235,0.94)', borderColor: 'rgba(217,119,6,0.16)', padding: 18, position: 'relative', overflow: 'hidden' }}>
          <Heart size={76} strokeWidth={1.2} style={{ position: 'absolute', right: -12, bottom: -16, color: '#f2efe9' }} />
          <div style={{ position: 'relative', display: 'grid', gap: 8 }}>
            <h2 style={{ margin: 0, color: '#172033', fontSize: 15, fontWeight: 950 }}>家人寄语</h2>
            <p style={{ margin: 0, color: '#334155', fontSize: 13, lineHeight: 1.75, fontWeight: 650 }}>“宝贝，愿你慢慢长大，全家人都会陪你，把这一段时光一件一件收好。”</p>
          </div>
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

  useEffect(() => {
    if (data) {
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
    setMessage('头像本地预览已显示，正在保存到档案…');
    try {
      const avatarUrl = await uploadChildAvatarImage(activeChild.child_no, uploadFile);
      const updated = await webApi.updateChild(activeChild.child_no, { avatar_url: avatarUrl });
      await refreshChildren();
      setActiveChild({ ...updated, avatar_url: avatarUrl });
      setForm((current) => ({ ...current, avatar_url: avatarUrl }));
      setAvatarPreviewUrl(null);
      setMessage('头像已更新');
    } catch (err) {
      setAvatarPreviewUrl(null);
      setMessage(err instanceof Error ? err.message : '头像上传失败');
    } finally {
      setAvatarUploading(false);
    }
  };

  return (
    <PageShell title="孩子资料" description="查看并编辑当前孩子的基础资料。" backTo="/family">
      <Panel>
        {loading ? <EmptyState message="正在加载孩子资料…" /> : null}
        {error ? <EmptyState message={`加载失败：${error}`} /> : null}
        {!loading && !error && data ? (
          <form onSubmit={onSubmit} style={rowStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <ChildAvatarPreview src={avatarPreviewUrl ?? (form.avatar_url || data.avatar_url)} label={form.name || data.name} />
              <label
                style={{
                  ...secondaryButtonStyle,
                  minHeight: '40px',
                  borderRadius: '999px',
                  cursor: avatarUploading ? 'not-allowed' : 'pointer',
                  opacity: avatarUploading ? 0.68 : 1,
                }}
              >
                <Camera size={15} strokeWidth={2.2} />
                {avatarUploading ? '上传中…' : '上传头像'}
                <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" disabled={avatarUploading} onChange={(event) => void onAvatarChange(event)} style={{ display: 'none' }} />
              </label>
            </div>
            <p style={helperTextStyle}>档案状态：{childStatusLabel(data.status)}</p>
            <p style={helperTextStyle}>当前性别：{genderLabel(data.gender)}</p>
            <Field label="孩子姓名">
              <input style={inputStyle} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </Field>
            <Field label="生日">
              <span style={{ ...inputStyle, position: 'relative', display: 'flex', alignItems: 'center', padding: '0 14px', color: form.birthday ? '#292524' : '#a1a1aa', fontWeight: 600 }}>
                <input
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                  type="date"
                  value={form.birthday}
                  onChange={(event) => setForm((current) => ({ ...current, birthday: event.target.value }))}
                />
                <span style={{ pointerEvents: 'none', flex: 1 }}>{form.birthday ? form.birthday.replace(/-/g, '/') : '年/月/日'}</span>
                <Calendar size={17} color="#cbd5e1" style={{ pointerEvents: 'none' }} />
              </span>
            </Field>
            <Field label="性别">
              <AppSegmentedControl
                ariaLabel="性别"
                value={form.gender}
                onChange={(value) => setForm((current) => ({ ...current, gender: value }))}
                options={[
                  { value: 'female', label: '女' },
                  { value: 'male', label: '男' },
                  { value: 'unknown', label: '未知' },
                ]}
              />
            </Field>
            <Field label="出生地">
              <input style={inputStyle} value={form.birth_place} onChange={(event) => setForm((current) => ({ ...current, birth_place: event.target.value }))} />
            </Field>
            <Field label="备注">
              <textarea style={textareaStyle} value={form.remark} onChange={(event) => setForm((current) => ({ ...current, remark: event.target.value }))} />
            </Field>
            {message ? <p style={{ ...helperTextStyle, color: isPositiveStatusMessage(message) ? '#0f766e' : '#dc2626' }}>{message}</p> : null}
            <div style={{ ...buttonRowStyle, ...formSubmitSpacingStyle }}>
              <button type="submit" style={primaryButtonStyle} disabled={saving}>
                {saving ? '保存中…' : '保存孩子资料'}
              </button>
              <button type="button" style={secondaryButtonStyle} onClick={() => navigate('/family')}>
                返回家庭页
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [updatingUserNo, setUpdatingUserNo] = useState<string | null>(null);
  const [showAllMembers, setShowAllMembers] = useState(false);
  const settings = loadLocalSettings();

  useEffect(() => {
    const loadMembers = async () => {
      if (!activeChild?.family_no) return;
      setLoading(true);
      setError(null);
      setMessage(null);
      try {
        const response = await webApi.listFamilyMembers(activeChild.family_no);
        setMembers(response.list);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载成员失败');
      } finally {
        setLoading(false);
      }
    };

    void loadMembers();
  }, [activeChild?.family_no]);

  const onChangeRole = async (userNo: string, role: 'viewer' | 'editor') => {
    if (!activeChild?.family_no) return;
    setUpdatingUserNo(userNo);
    setMessage(null);
    try {
      await webApi.updateFamilyMemberRole(activeChild.family_no, userNo, { role });
      setMembers((current) => current.map((item) => (item.user_no === userNo ? { ...item, role } : item)));
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
    <PageShell title="家庭成员管理" description="查看成员、邀请来源和角色信息。" backTo="/family">
      <Panel>
        {!activeChild?.family_no ? <EmptyState message="当前孩子尚未关联家庭编号。" /> : null}
        {loading ? <EmptyState message="正在加载家庭成员…" /> : null}
        {error ? <EmptyState message={`加载失败：${error}`} /> : null}
        {message ? <p style={{ ...helperTextStyle, color: message === '成员角色已更新' ? '#0f766e' : '#dc2626' }}>{message}</p> : null}
        {members.length ? (
          <div style={{ display: 'grid', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
              <p style={{ ...helperTextStyle, color: '#57534e' }}>共 {members.length} 位成员，优先显示最近需要管理的账号。</p>
              {hiddenMemberCount ? (
                <button type="button" style={{ ...secondaryButtonStyle, minHeight: '38px', padding: '8px 12px', borderRadius: '999px', boxShadow: 'none', flexShrink: 0 }} onClick={() => setShowAllMembers(true)}>
                  展开全部
                </button>
              ) : showAllMembers && members.length > 6 ? (
                <button type="button" style={{ ...secondaryButtonStyle, minHeight: '38px', padding: '8px 12px', borderRadius: '999px', boxShadow: 'none', flexShrink: 0 }} onClick={() => setShowAllMembers(false)}>
                  收起
                </button>
              ) : null}
            </div>
            {visibleMembers.map((member) => (
              <section key={member.user_no} style={{ border: '1px solid #ebe6dc', borderRadius: '16px', padding: '14px', background: '#fffdf9', display: 'grid', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', minWidth: 0 }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '8px', background: '#f1eee8', display: 'grid', placeItems: 'center', color: '#57534e', flexShrink: 0 }}>
                    <UserRound size={20} strokeWidth={2.1} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '15px', color: '#292524' }}>{member.nickname}</strong>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: member.role === 'owner' ? '#92400e' : '#0f766e', background: member.role === 'owner' ? '#fef3c7' : '#ecfdf5', border: '1px solid #ebe6dc', padding: '2px 8px', borderRadius: '6px' }}>
                        {familyRoleLabel(member.role)}
                      </span>
                    </div>
                    <p style={{ ...helperTextStyle, marginTop: '3px' }}>{member.role === 'owner' ? '家庭档案管理员' : '共同记录成员'}</p>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                  <p style={{ ...helperTextStyle, borderRadius: '6px', background: '#ffffff', border: '1px solid #f2efe9', padding: '8px' }}>手机号：{settings.hideMobileMask ? '已隐藏' : member.mobile_masked ?? '未提供'}</p>
                  <p style={{ ...helperTextStyle, borderRadius: '6px', background: '#ffffff', border: '1px solid #f2efe9', padding: '8px' }}>状态：{familyMemberStatusLabel(member.status)}</p>
                </div>
                <p style={helperTextStyle}>来源：{member.invited_by_user_no ? '家人邀请加入' : '系统创建 / 当前管理员'}</p>
                {member.role !== 'owner' ? (
                  <div style={{ ...buttonRowStyle, marginTop: '2px' }}>
                    <button style={secondaryButtonStyle} onClick={() => void onChangeRole(member.user_no, 'viewer')} disabled={updatingUserNo === member.user_no || member.role === 'viewer'}>
                      {updatingUserNo === member.user_no && member.role !== 'viewer' ? '处理中…' : '设为只读'}
                    </button>
                    <button style={secondaryButtonStyle} onClick={() => void onChangeRole(member.user_no, 'editor')} disabled={updatingUserNo === member.user_no || member.role === 'editor'}>
                      {updatingUserNo === member.user_no && member.role !== 'editor' ? '处理中…' : '设为可编辑'}
                    </button>
                  </div>
                ) : null}
              </section>
            ))}
            {hiddenMemberCount ? <p style={{ ...helperTextStyle, textAlign: 'center' }}>已收起 {hiddenMemberCount} 位低频成员，展开后可继续调整权限。</p> : null}
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
  const { activeChild } = useAuth();
  const [members, setMembers] = useState<FamilyMemberItem[]>([]);
  const [records, setRecords] = useState<RecordSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadDetail = async () => {
      if (!activeChild?.family_no || !activeChild?.child_no) return;
      setLoading(true);
      setMessage(null);
      try {
        const [membersResponse, recordsResponse] = await Promise.all([
          webApi.listFamilyMembers(activeChild.family_no),
          webApi.listRecords({ child_no: activeChild.child_no, page: 1, page_size: 30 }),
        ]);
        if (!cancelled) {
          setMembers(membersResponse.list);
          setRecords(recordsResponse.list);
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
  }, [activeChild?.child_no, activeChild?.family_no]);

  const member = members.find((item) => item.user_no === userNo) ?? members[0] ?? null;
  const memberRecords = member ? records.filter((record) => record.creator_name === member.nickname).slice(0, 3) : [];
  const canEditRole = Boolean(member && member.role !== 'owner' && activeChild?.family_no);
  const memberJoinedDays = member?.joined_at
    ? Math.max(1, Math.ceil((Date.now() - new Date(member.joined_at).getTime()) / (24 * 60 * 60 * 1000)))
    : null;

  const changeRole = async () => {
    if (!member || !activeChild?.family_no || member.role === 'owner') {
      setMessage('家庭创建者权限不可在这里修改。');
      return;
    }

    const nextRole = member.role === 'editor' ? 'viewer' : 'editor';
    setUpdating(true);
    setMessage(null);
    try {
      await webApi.updateFamilyMemberRole(activeChild.family_no, member.user_no, { role: nextRole });
      setMembers((current) => current.map((item) => (item.user_no === member.user_no ? { ...item, role: nextRole } : item)));
      setMessage('角色权限已更新');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '角色权限更新失败');
    } finally {
      setUpdating(false);
    }
  };

  const roleColor = member?.role === 'owner' ? '#d97706' : member?.role === 'editor' ? '#2563eb' : '#78716c';
  const roleBg = member?.role === 'owner' ? '#fef3c7' : member?.role === 'editor' ? '#eff6ff' : '#f5f5f4';

  return (
    <PageShell title="家人资料" backTo="/family">
      {loading ? <Panel><EmptyState message="正在加载家人资料…" /></Panel> : null}
      {!loading && !member ? <Panel><EmptyState message="未找到该家庭成员。" /></Panel> : null}
      {member ? (
        <>
          <Panel style={{ display: 'grid', justifyItems: 'center', gap: '13px', padding: '22px 18px', borderRadius: '18px', boxShadow: '0 2px 8px rgba(41,37,36,0.03)' }}>
            <FamilyAvatar label={member.nickname} size={72} fallbackSrc={referenceAssets.momAvatar} />
            <div style={{ display: 'grid', justifyItems: 'center', gap: '7px' }}>
              <h2 style={{ margin: 0, color: '#2c2c2c', fontSize: '20px', fontWeight: 800 }}>{member.nickname}</h2>
              <span style={{ borderRadius: '999px', background: roleBg, color: roleColor, padding: '4px 10px', fontSize: '11px', fontWeight: 800 }}>{familyRoleLabel(member.role)}</span>
            </div>
            <div style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
              <div style={{ borderRadius: '14px', border: '1px solid #eef1f4', background: '#f8f9fa', padding: '12px', textAlign: 'center' }}>
                <strong style={{ display: 'block', color: '#2c2c2c', fontSize: '19px', lineHeight: 1 }}>{memberRecords.length}</strong>
                <span style={{ display: 'block', marginTop: '7px', color: '#a1a1aa', fontSize: '11px', fontWeight: 700 }}>发布记录</span>
              </div>
              <div style={{ borderRadius: '14px', border: '1px solid #eef1f4', background: '#f8f9fa', padding: '12px', textAlign: 'center' }}>
                <strong style={{ display: 'block', color: '#2c2c2c', fontSize: '19px', lineHeight: 1 }}>{memberJoinedDays ?? '-'}</strong>
                <span style={{ display: 'block', marginTop: '7px', color: '#a1a1aa', fontSize: '11px', fontWeight: 700 }}>加入天数</span>
              </div>
            </div>
          </Panel>

          <section>
            <h2 style={{ margin: '0 0 12px 4px', color: '#2c2c2c', fontSize: '15px', fontWeight: 800 }}>TA的记录</h2>
            <div style={{ display: 'grid', gap: '10px' }}>
              {memberRecords.length ? memberRecords.map((record) => (
                <button key={record.record_no} type="button" onClick={() => navigate(`/record/${record.record_no}`)} style={{ width: '100%', minHeight: '60px', border: '1px solid #eef1f4', borderRadius: '14px', background: '#ffffff', padding: '11px 13px', display: 'flex', alignItems: 'center', gap: '11px', textAlign: 'left', cursor: 'pointer', boxShadow: '0 1px 4px rgba(41,37,36,0.02)' }}>
                  <span style={{ width: '36px', height: '36px', borderRadius: '12px', background: '#f8f9fa', color: '#94a3b8', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    {record.cover_url ? <ImageIcon size={16} /> : <FileText size={16} />}
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <strong style={{ display: 'block', color: '#2c2c2c', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record.title ?? '未命名记录'}</strong>
                    <span style={{ display: 'block', marginTop: '4px', color: '#a1a1aa', fontSize: '11px', fontWeight: 600 }}>{new Date(record.event_time).toLocaleDateString('zh-CN')}</span>
                  </span>
                </button>
              )) : <Panel><EmptyState message="TA还没有发布过记录。" /></Panel>}
            </div>
          </section>

          <section>
            <h2 style={{ margin: '0 0 12px 4px', color: '#2c2c2c', fontSize: '15px', fontWeight: 800 }}>权限管理</h2>
            <Panel style={{ padding: 0, overflow: 'hidden', borderRadius: '18px', boxShadow: '0 2px 8px rgba(41,37,36,0.03)' }}>
              <button type="button" onClick={() => void changeRole()} disabled={!canEditRole || updating} style={{ width: '100%', minHeight: '56px', border: 'none', borderBottom: '1px solid #f3f4f6', background: '#ffffff', padding: '13px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', textAlign: 'left', cursor: canEditRole ? 'pointer' : 'default', opacity: canEditRole ? 1 : 0.68 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#2c2c2c', fontSize: '14px', fontWeight: 700 }}>
                  <span style={{ width: '32px', height: '32px', borderRadius: '999px', background: '#eff6ff', color: '#3b82f6', display: 'grid', placeItems: 'center' }}><ShieldAlert size={15} /></span>
                  {updating ? '正在修改权限' : '修改角色权限'}
                </span>
                <ChevronRight size={16} color="#cbd5e1" />
              </button>
              <div style={{ minHeight: '56px', borderBottom: '1px solid #f3f4f6', padding: '13px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#2c2c2c', fontSize: '14px', fontWeight: 700 }}>
                  <span style={{ width: '32px', height: '32px', borderRadius: '999px', background: '#fff7ed', color: '#f97316', display: 'grid', placeItems: 'center' }}><Clock size={15} /></span>
                  加入时间
                </span>
                <span style={{ color: '#a1a1aa', fontSize: '12px', fontWeight: 700 }}>{member.joined_at ? new Date(member.joined_at).toLocaleDateString('zh-CN') : '未记录'}</span>
              </div>
              <button type="button" onClick={() => setMessage('移出家庭需要管理员二次确认。当前请先将角色改为只读，再通过帮助与反馈提交移出申请。')} style={{ width: '100%', minHeight: '56px', border: 'none', background: '#ffffff', padding: '13px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', textAlign: 'left', cursor: 'pointer' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#ef4444', fontSize: '14px', fontWeight: 700 }}>
                  <span style={{ width: '32px', height: '32px', borderRadius: '999px', background: '#fef2f2', color: '#ef4444', display: 'grid', placeItems: 'center' }}><UserMinus size={15} /></span>
                  移出家庭
                </span>
              </button>
            </Panel>
          </section>
        </>
      ) : null}
      {message ? <p style={{ ...helperTextStyle, color: message.includes('失败') ? '#dc2626' : '#0f766e' }}>{message}</p> : null}
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
      setMessage('邀请码已生成，可直接复制后发送给家人。');
    } catch (err) {
      setError(err instanceof Error ? err.message : '邀请创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell title="邀请家庭成员" description="创建邀请码后，被邀请人可用它注册账号并加入家庭。" backTo="/family">
      <Panel>
        <form onSubmit={onSubmit} style={rowStyle}>
          <Field label="绑定手机号（可选）">
            <input
              style={inputStyle}
              value={form.mobile}
              onChange={(event) => setForm((current) => ({ ...current, mobile: event.target.value }))}
              placeholder="不填写则生成通用邀请码"
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
          {error ? <p style={{ ...helperTextStyle, color: '#dc2626' }}>{error}</p> : null}
          {message ? <p style={{ ...helperTextStyle, color: message.includes('失败') ? '#dc2626' : '#0f766e' }}>{message}</p> : null}
          <button type="submit" style={primaryButtonStyle} disabled={submitting || !activeChild?.family_no}>
            {submitting ? '生成中…' : '生成邀请码'}
          </button>
        </form>
      </Panel>

      {inviteResult ? (
        <Panel>
          <div style={rowStyle}>
            <strong>邀请码已生成</strong>
            <p style={helperTextStyle}>邀请编号：{inviteResult.invite_no}</p>
            <div style={{ border: '1px solid #ebe6dc', borderRadius: '16px', background: '#fffdf9', padding: '14px', display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
              <div style={{ minWidth: 0 }}>
                <span style={{ display: 'block', color: '#78716c', fontSize: '12px', fontWeight: 700 }}>邀请码</span>
                <strong style={{ display: 'block', marginTop: '4px', color: '#292524', fontSize: '20px', letterSpacing: 0, wordBreak: 'break-all' }}>{inviteResult.invite_token}</strong>
              </div>
              <button type="button" aria-label="复制到剪贴板" style={{ ...secondaryButtonStyle, minWidth: '44px', padding: '10px' }} onClick={() => void copyText(inviteResult.invite_token, '邀请码已复制')}>
                <Copy size={16} strokeWidth={2.2} />
              </button>
            </div>
            <p style={helperTextStyle}>邀请角色：{familyRoleLabel(inviteResult.role)}</p>
            <p style={helperTextStyle}>失效时间：{new Date(inviteResult.expires_at).toLocaleString('zh-CN')}</p>
            <p style={helperTextStyle}>把邀请码发送给家人，对方在注册页填写后会自动加入家庭；登录时只需要账号和密码。</p>
            <div style={buttonRowStyle}>
              <button type="button" style={secondaryButtonStyle} onClick={() => void copyText(inviteResult.invite_token, '邀请码已复制')}>
                <Copy size={15} strokeWidth={2.2} />
                复制邀请码
              </button>
            </div>
          </div>
        </Panel>
      ) : null}
    </PageShell>
  );
};
