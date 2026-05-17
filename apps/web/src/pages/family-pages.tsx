import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Camera, ChevronRight, Clock, Copy, FileText, Heart, Image as ImageIcon, Mic, PlayCircle, Plus, ShieldAlert, UserMinus, UserPlus, UserRound } from 'lucide-react';

import { useAuth } from '../shared/AuthContext';
import { webApi } from '../shared/api/webApi';
import type { ChildRecord, FamilyInviteResponse, FamilyMemberItem, RecordSummary } from '../shared/api/types';
import { useAsyncData } from '../shared/hooks';
import { childStatusLabel, familyMemberStatusLabel, familyRoleLabel, genderLabel, recordTypeLabel } from '../shared/labels';
import { createPersistableMediaPreview, resolveMediaPreviewUrl, resolveStoredMediaUrl, saveLocalMediaPreview, toLocalMediaReference } from '../shared/localMediaPreview';
import { loadLocalSettings } from '../shared/localSettings';
import { AppSegmentedControl, Field, PageShell, Panel, helperTextStyle, inputStyle, primaryButtonStyle, secondaryButtonStyle, textareaStyle } from '../shared/ui';
import { EmptyState, buttonRowStyle, formSubmitSpacingStyle, rowStyle } from './shared';

const uploadChildAvatarImage = async (childNo: string, file: File) => {
  const uploadToken = await webApi.createUploadToken({
    child_no: childNo,
    file_name: file.name,
    mime_type: file.type,
    size_bytes: file.size,
    media_type: 'image',
  });

  if (uploadToken.mock_upload) {
    const preview = await createPersistableMediaPreview(file);
    saveLocalMediaPreview(uploadToken.media_no, preview);
    await webApi.confirmUpload({ media_no: uploadToken.media_no });
    return toLocalMediaReference(uploadToken.media_no);
  }

  await fetch(uploadToken.upload_url, {
    method: uploadToken.method,
    headers: uploadToken.headers,
    body: file,
  });
  await webApi.confirmUpload({ media_no: uploadToken.media_no });
  const access = await webApi.mediaAccessUrl(uploadToken.media_no);
  return access.access_url;
};

const ChildAvatarPreview = ({ src, label }: { src?: string | null; label: string }) => {
  const resolvedSrc = resolveStoredMediaUrl(src);
  if (resolvedSrc) {
    return <img src={resolvedSrc} alt={label} style={{ width: '72px', height: '72px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e7e5e4', background: '#f5f5f4' }} />;
  }

  return (
    <div style={{ width: '72px', height: '72px', borderRadius: '8px', border: '1px solid #e7e5e4', background: '#f5f5f4', display: 'grid', placeItems: 'center', color: '#57534e', fontSize: '24px', fontWeight: 700 }}>
      {label.slice(0, 1) || '宝'}
    </div>
  );
};

const FamilyAvatar = ({ src, label, size = 42, radius = '999px' }: { src?: string | null; label: string; size?: number; radius?: string }) => {
  const resolvedSrc = resolveStoredMediaUrl(src);
  if (resolvedSrc) {
    return <img src={resolvedSrc} alt={label} style={{ width: `${size}px`, height: `${size}px`, borderRadius: radius, objectFit: 'cover', border: '1px solid #eee9df', flexShrink: 0, boxShadow: '0 2px 8px rgba(15,23,42,0.03)' }} />;
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

  return (
    <div style={{ minHeight: '100dvh', background: '#f8f9fa', color: '#292524', overflowX: 'hidden' }}>
      <header style={{ padding: 'calc(38px + env(safe-area-inset-top)) 20px 18px', position: 'sticky', top: 0, zIndex: 3, background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(16px)' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#292524', letterSpacing: 0 }}>家庭</h1>
      </header>

      <main style={{ display: 'grid', gap: '26px', padding: '0 20px 28px' }}>
        <section style={{ borderRadius: '28px', border: '1px solid #f5f1e6', background: '#fcfaf5', padding: '22px 20px', minHeight: '132px', display: 'grid', alignItems: 'center', boxShadow: '0 5px 18px rgba(15,23,42,0.04)' }}>
          {activeChild ? (
            <div style={{ display: 'grid', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px' }}>
                <div style={{ display: 'flex', gap: '18px', alignItems: 'center', minWidth: 0 }}>
                  <FamilyAvatar src={activeChild.avatar_url} label={activeChild.name} size={62} radius="18px" />
                  <div style={{ minWidth: 0 }}>
                    <h2 style={{ margin: 0, fontSize: '21px', fontWeight: 800, color: '#292524', letterSpacing: 0 }}>{activeChild.name}的家庭</h2>
                    <span style={{ display: 'block', marginTop: '7px', fontSize: '14px', color: '#78716c', fontWeight: 500 }}>已有 {membersLoading ? '…' : memberCount} 位家人加入记录</span>
                  </div>
                </div>
                <Link to="/family/invite" aria-label="邀请成员" title="邀请成员" style={{ width: '48px', height: '48px', borderRadius: '999px', background: '#57534e', color: '#ffffff', display: 'grid', placeItems: 'center', textDecoration: 'none', boxShadow: '0 10px 22px rgba(41,37,36,0.18)', flexShrink: 0, marginTop: '2px' }}>
                  <UserPlus size={22} strokeWidth={2.4} />
                </Link>
              </div>
              {membersError ? <p style={{ ...helperTextStyle, color: '#dc2626' }}>成员信息加载失败：{membersError}</p> : null}
            </div>
          ) : (
            <EmptyState message="请先完成建档或选择一个孩子。" />
          )}
        </section>

        {activeChild ? (
          <section style={{ borderRadius: '26px', border: '1px solid #eef0f2', background: '#ffffff', padding: '18px', display: 'grid', gap: '14px', boxShadow: '0 3px 12px rgba(15,23,42,0.035)' }}>
            <div style={{ display: 'grid', gap: '5px' }}>
              <span style={{ color: '#a16207', fontSize: '12px', fontWeight: 800 }}>全家一起记录</span>
              <h2 style={{ margin: 0, color: '#292524', fontSize: '18px', fontWeight: 800 }}>让不同家人的视角进入同一份档案</h2>
              <p style={{ margin: 0, color: '#78716c', fontSize: '13px', lineHeight: 1.75 }}>邀请家人不是为了多一个账号，而是让照片、语音、寄语和日常观察都沉淀到 {activeChild.name} 的成长时间轴里。</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
              {[
                { title: '父母', desc: '记录日常' },
                { title: '祖辈', desc: '补充陪伴' },
                { title: '亲友', desc: '留下寄语' },
              ].map((item) => (
                <div key={item.title} style={{ minHeight: '70px', borderRadius: '16px', border: '1px solid #f1eee8', background: '#fcfaf5', padding: '11px 9px', display: 'grid', alignContent: 'center', gap: '5px', textAlign: 'center' }}>
                  <strong style={{ color: '#292524', fontSize: '13px' }}>{item.title}</strong>
                  <span style={{ color: '#78716c', fontSize: '11px', fontWeight: 700 }}>{item.desc}</span>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => navigate('/family/invite')} style={{ width: '100%', minHeight: '44px', border: 'none', borderRadius: '999px', background: '#292524', color: '#ffffff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px', fontWeight: 800, cursor: 'pointer' }}>
              <UserPlus size={16} strokeWidth={2.4} />
              邀请家人共写
            </button>
          </section>
        ) : null}

        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#292524' }}>家庭成员</h2>
          </div>
          <div style={{ borderRadius: '24px', border: '1px solid #eef0f2', background: '#ffffff', overflow: 'hidden', boxShadow: '0 3px 12px rgba(15,23,42,0.035)' }}>
            {recentMembers.length ? (
              recentMembers.map((member, index) => (
                <button key={member.user_no} type="button" onClick={() => navigate(`/family/members/${member.user_no}`)} style={{ width: '100%', minHeight: '84px', border: 'none', borderBottom: index === recentMembers.length - 1 ? 'none' : '1px solid #f7f4ef', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center', minWidth: 0 }}>
                    <FamilyAvatar label={member.nickname} size={46} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '15px', fontWeight: 700, color: '#292524' }}>{member.nickname}</span>
                        <span style={{ fontSize: '10px', fontWeight: 800, color: member.role === 'owner' ? '#d97706' : member.role === 'editor' ? '#2563eb' : '#78716c', background: member.role === 'owner' ? '#fef3c7' : member.role === 'editor' ? '#eff6ff' : '#f5f5f4', border: '1px solid #e7e5e4', padding: '2px 8px', borderRadius: '6px' }}>
                          {familyRoleLabel(member.role)}
                        </span>
                      </div>
                      <span style={{ display: 'block', marginTop: '5px', fontSize: '13px', color: '#a8a29e', fontWeight: 500 }}>{member.status === 1 ? '已加入家庭记录' : familyMemberStatusLabel(member.status)}</span>
                    </div>
                  </div>
                  <ChevronRight size={18} color="#d6d3d1" strokeWidth={2.2} />
                </button>
              ))
            ) : (
              <div style={{ padding: '18px', display: 'grid', gap: '12px', justifyItems: 'center' }}>
                <EmptyState message="暂无家庭成员信息。先邀请一位家人，让这份档案不只来自一个视角。" />
                <button type="button" onClick={() => navigate('/family/invite')} style={{ minHeight: '38px', border: 'none', borderRadius: '999px', background: '#292524', color: '#ffffff', padding: '8px 16px', fontSize: '13px', fontWeight: 800, cursor: 'pointer' }}>
                  生成邀请码
                </button>
              </div>
            )}
          </div>
        </section>

        <section>
          <h2 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 700, color: '#292524' }}>最近家庭动态</h2>
          {recordsLoading ? <EmptyState message="正在加载家庭动态…" /> : null}
          {recordsError ? <EmptyState message={`家庭动态加载失败：${recordsError}`} /> : null}
          {!recordsLoading && !recordsError && recentFamilyRecords.length ? (
            <div style={{ position: 'relative', display: 'grid', gap: '28px', paddingLeft: '26px', marginLeft: '16px' }}>
              <span aria-hidden="true" style={{ position: 'absolute', left: 0, top: '10px', bottom: '10px', width: '1px', background: '#e7eaf0' }} />
              {recentFamilyRecords.map((record, index) => {
                const coverUrl = getFamilyRecordCoverUrl(record);
                const mediaKind = getFamilyRecordMediaKind(record);
                return (
                  <button key={record.record_no} type="button" aria-label={`查看家庭动态：${record.title ?? '未命名记录'}`} onClick={() => navigate(`/record/${record.record_no}`)} style={{ width: '100%', border: 'none', background: 'transparent', padding: 0, display: 'flex', gap: '14px', textAlign: 'left', cursor: 'pointer', position: 'relative' }}>
                    <span aria-hidden="true" style={{ position: 'absolute', left: '-43px', top: 0, width: '34px', height: '34px', borderRadius: '999px', background: '#ffffff', border: '4px solid #f8f9fa', display: 'grid', placeItems: 'center', boxSizing: 'border-box' }}>
                      <span style={{ width: '22px', height: '22px', borderRadius: '999px', background: '#f5f5f4', border: '1px solid #eee9df', display: 'grid', placeItems: 'center', color: '#57534e', fontSize: '11px', fontWeight: 800 }}>{record.creator_name.slice(0, 1)}</span>
                    </span>
                    <div style={{ flex: 1, minWidth: 0, borderBottom: index === recentFamilyRecords.length - 1 ? 'none' : '1px solid #f3f0ea', paddingBottom: index === recentFamilyRecords.length - 1 ? 0 : '22px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#44403c' }}>{record.creator_name}</span>
                      <span style={{ fontSize: '13px', color: '#57534e' }}>{getFamilyRecordActionLabel(record)}</span>
                    </div>
                    <span style={{ display: 'block', marginTop: '4px', fontSize: '11px', color: '#a8a29e', fontWeight: 700 }}>{new Date(record.event_time).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                    {coverUrl && mediaKind !== 'audio' ? (
                      <div style={{ marginTop: '12px', width: '150px', height: '128px', borderRadius: '18px', border: '1px solid #eee9df', background: '#fafaf9', position: 'relative', overflow: 'hidden' }}>
                        {mediaKind === 'video' ? (
                          <>
                            <video src={coverUrl} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', background: '#292524' }} />
                            <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fff', background: 'rgba(41,37,36,0.16)' }}>
                              <PlayCircle size={30} strokeWidth={2.2} />
                            </span>
                          </>
                        ) : (
                          <img src={coverUrl} alt={record.title ?? '家庭动态图片'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        )}
                      </div>
                    ) : mediaKind === 'audio' ? (
                      <div style={{ marginTop: '12px', maxWidth: '230px', borderRadius: '999px', border: '1px solid #eee9df', background: '#fafaf9', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '9px', color: '#57534e' }}>
                        <span style={{ width: '30px', height: '30px', borderRadius: '999px', background: '#292524', color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                          <Mic size={15} />
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: 700 }}>语音记录</span>
                      </div>
                    ) : (
                      <div style={{ marginTop: '12px', borderRadius: '16px', border: '1px solid #eee9df', background: '#fafaf9', padding: '12px', color: '#57534e', fontSize: '13px', lineHeight: 1.7 }}>
                        {record.title ?? record.summary ?? '这条记录暂无标题'}
                      </div>
                    )}
                  </div>
                </button>
                );
              })}
            </div>
          ) : null}
          {!recordsLoading && !recordsError && !recentFamilyRecords.length ? (
            <div style={{ display: 'grid', gap: '12px', justifyItems: 'center' }}>
              <EmptyState message="还没有可展示的真实家庭动态。发布记录或邀请家人后，这里会显示协作进展。" />
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button type="button" onClick={() => navigate('/record/create')} style={{ minHeight: '38px', border: '1px solid #292524', borderRadius: '999px', background: '#292524', color: '#ffffff', padding: '8px 14px', fontSize: '13px', fontWeight: 800, cursor: 'pointer' }}>
                  去记录
                </button>
                <button type="button" onClick={() => navigate('/family/invite')} style={{ minHeight: '38px', border: '1px solid #e7e5e4', borderRadius: '999px', background: '#ffffff', color: '#57534e', padding: '8px 14px', fontSize: '13px', fontWeight: 800, cursor: 'pointer' }}>
                  邀请家人
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <section style={{ borderRadius: '24px', border: '1px solid #f5f1e6', background: '#fcfaf5', padding: '22px', position: 'relative', overflow: 'hidden', minHeight: '134px' }}>
          <Heart size={88} strokeWidth={1.2} style={{ position: 'absolute', right: '-18px', bottom: '-18px', color: '#f2efe9' }} />
          <div style={{ position: 'relative', zIndex: 1, display: 'grid', gap: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#292524' }}>家人寄语</h2>
            <p style={{ margin: 0, color: '#57534e', fontSize: '14px', lineHeight: 1.8 }}>家庭成员可以通过邀请码注册加入，并按角色查看或编辑孩子的成长记录。</p>
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
    if (!file.type.startsWith('image/')) {
      setMessage('头像仅支持 JPG、PNG、WebP、HEIC 图片');
      return;
    }

    setAvatarUploading(true);
    setMessage(null);
    try {
      const avatarUrl = await uploadChildAvatarImage(activeChild.child_no, file);
      const updated = await webApi.updateChild(activeChild.child_no, { avatar_url: avatarUrl });
      await refreshChildren();
      setActiveChild(updated);
      setForm((current) => ({ ...current, avatar_url: updated.avatar_url ?? avatarUrl }));
      setMessage('头像已更新');
    } catch (err) {
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
              <ChildAvatarPreview src={form.avatar_url || data.avatar_url} label={form.name || data.name} />
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
              <input style={inputStyle} type="date" value={form.birthday} onChange={(event) => setForm((current) => ({ ...current, birthday: event.target.value }))} />
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
            {message ? <p style={{ ...helperTextStyle, color: message === '保存成功' ? '#0f766e' : '#dc2626' }}>{message}</p> : null}
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

  return (
    <PageShell title="家庭成员管理" description="查看成员、邀请来源和角色信息。" backTo="/family">
      <Panel>
        {!activeChild?.family_no ? <EmptyState message="当前孩子尚未关联家庭编号。" /> : null}
        {loading ? <EmptyState message="正在加载家庭成员…" /> : null}
        {error ? <EmptyState message={`加载失败：${error}`} /> : null}
        {message ? <p style={{ ...helperTextStyle, color: message === '成员角色已更新' ? '#0f766e' : '#dc2626' }}>{message}</p> : null}
        {members.length ? (
          <div style={{ display: 'grid', gap: '12px' }}>
            {members.map((member) => (
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
            <FamilyAvatar label={member.nickname} size={72} />
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
