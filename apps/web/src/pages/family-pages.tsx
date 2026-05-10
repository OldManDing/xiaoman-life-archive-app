import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '../shared/AuthContext';
import { webApi } from '../shared/api/webApi';
import type { ChildRecord, FamilyInviteResponse, FamilyMemberItem } from '../shared/api/types';
import { useAsyncData } from '../shared/hooks';
import { loadLocalSettings } from '../shared/localSettings';
import { Field, PageShell, Panel, helperTextStyle, inputStyle, primaryButtonStyle, secondaryButtonStyle, textareaStyle } from '../shared/ui';
import { EmptyState, buttonRowStyle, formSubmitSpacingStyle, rowStyle } from './shared';

export const FamilyPage = () => {
  const { activeChild, user } = useAuth();
  const { data: membersResponse, loading, error } = useAsyncData(
    async () => {
      if (!activeChild?.family_no) return null;
      return webApi.listFamilyMembers(activeChild.family_no);
    },
    [activeChild?.family_no],
  );

  const currentMember = membersResponse?.list.find((member) => member.user_no === user?.user_no) ?? null;
  const memberCount = membersResponse?.list.length ?? 0;
  const recentMembers = membersResponse?.list.slice(0, 4) ?? [];

  return (
    <PageShell title="家庭">
      <Panel style={{ background: 'linear-gradient(135deg, #fafaf9 0%, #f5f5f4 100%)' }}>
        {activeChild ? (
          <div style={{ ...rowStyle, position: 'relative', overflow: 'hidden', gap: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '18px',
                    background: '#ffffff',
                    border: '2px solid #ffffff',
                    display: 'grid',
                    placeItems: 'center',
                    boxShadow: '0 4px 12px rgba(15,23,42,0.06)',
                    color: '#57534e',
                    fontSize: '20px',
                    fontWeight: 700,
                  }}
                >
                  {activeChild.name.slice(0, 1)}
                </div>
                <div style={{ display: 'grid', gap: '4px' }}>
                  <strong style={{ fontSize: '18px', color: '#292524' }}>{activeChild.name}的家庭</strong>
                  <span style={{ fontSize: '13px', color: '#78716c', fontWeight: 500 }}>已有 {loading ? '…' : memberCount} 位家人加入记录</span>
                </div>
              </div>
              <Link
                to="/family/invite"
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '999px',
                  background: '#292524',
                  color: '#ffffff',
                  display: 'grid',
                  placeItems: 'center',
                  textDecoration: 'none',
                  boxShadow: '0 2px 8px rgba(41,37,36,0.18)',
                }}
              >
                ＋
              </Link>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#78716c', padding: '6px 10px', borderRadius: '999px', background: '#ffffff', border: '1px solid #e7e5e4' }}>
                家庭编号：{activeChild.family_no ?? '未返回'}
              </span>
              <span style={{ fontSize: '12px', color: '#78716c', padding: '6px 10px', borderRadius: '999px', background: '#ffffff', border: '1px solid #e7e5e4' }}>
                我的角色：{currentMember?.role ?? '暂未识别'}
              </span>
            </div>
            {error ? <p style={{ ...helperTextStyle, color: '#dc2626' }}>成员信息加载失败：{error}</p> : null}
          </div>
        ) : (
          <EmptyState message="请先完成建档或选择一个孩子。" />
        )}
      </Panel>

      <Panel>
        <h2 style={{ margin: '0 0 14px', fontSize: '16px', fontWeight: 600, color: '#292524' }}>家庭成员</h2>
        {recentMembers.length ? (
          <div style={{ display: 'grid', gap: '12px' }}>
            {recentMembers.map((member) => (
              <div key={member.user_no} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '999px',
                      background: '#f5f5f4',
                      display: 'grid',
                      placeItems: 'center',
                      color: '#57534e',
                      fontWeight: 700,
                    }}
                  >
                    {member.nickname.slice(0, 1)}
                  </div>
                  <div style={{ display: 'grid', gap: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 600, color: '#292524' }}>{member.nickname}</span>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          color: member.role === 'owner' ? '#d97706' : member.role === 'editor' ? '#2563eb' : '#78716c',
                          background: member.role === 'owner' ? '#fef3c7' : member.role === 'editor' ? '#eff6ff' : '#f5f5f4',
                          border: '1px solid #e7e5e4',
                          padding: '2px 8px',
                          borderRadius: '8px',
                        }}
                      >
                        {member.role === 'owner' ? '管理员' : member.role === 'editor' ? '编辑者' : '浏览者'}
                      </span>
                    </div>
                    <span style={{ fontSize: '12px', color: '#a8a29e' }}>
                      {member.invited_by_user_no ? `邀请人：${member.invited_by_user_no}` : '系统创建 / 当前 owner'}
                    </span>
                  </div>
                </div>
                <span style={{ color: '#d6d3d1', fontSize: '18px' }}>›</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="暂无家庭成员信息。" />
        )}
        <div style={{ ...buttonRowStyle, marginTop: '16px' }}>
          <Link to="/family/members" style={secondaryButtonStyle as never}>
            家庭成员管理
          </Link>
          <Link to="/family/invite" style={secondaryButtonStyle as never}>
            邀请成员
          </Link>
        </div>
      </Panel>

      <Panel>
        <h2 style={{ margin: '0 0 14px', fontSize: '16px', fontWeight: 600, color: '#292524' }}>最近家庭动态</h2>
        {recentMembers.length ? (
          <div style={{ display: 'grid', gap: '16px' }}>
            {recentMembers.map((member) => (
              <div key={member.user_no} style={{ display: 'flex', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '999px', background: '#f5f5f4', display: 'grid', placeItems: 'center', color: '#57534e', fontWeight: 700 }}>
                  {member.nickname.slice(0, 1)}
                </div>
                <div style={{ flex: 1, borderBottom: '1px solid #f1f5f9', paddingBottom: '14px' }}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '2px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#44403c' }}>{member.nickname}</span>
                    <span style={{ fontSize: '13px', color: '#57534e' }}>已加入家庭协作</span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#a8a29e', fontWeight: 600 }}>
                    {member.joined_at ? new Date(member.joined_at).toLocaleString() : '等待加入时间同步'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="还没有可展示的真实家庭动态。邀请家人加入后，这里会显示协作进展。" />
        )}
      </Panel>

      <Panel style={{ background: '#faf8f5', border: '1px solid #f2efe9' }}>
        <h2 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 600, color: '#292524' }}>家人寄语</h2>
        <EmptyState message="寄语能力已在设计中预留，当前版本先以成长记录和家庭成员协作为主。" />
      </Panel>
    </PageShell>
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
    birthday: '',
    gender: 'unknown',
    birth_place: '',
    remark: '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      setForm({
        name: data.name,
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

  return (
    <PageShell title="孩子资料" description="查看并编辑当前孩子的基础资料。">
      <Panel>
        {loading ? <EmptyState message="正在加载孩子资料…" /> : null}
        {error ? <EmptyState message={`加载失败：${error}`} /> : null}
        {!loading && !error && data ? (
          <form onSubmit={onSubmit} style={rowStyle}>
            <Field label="孩子姓名">
              <input style={inputStyle} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </Field>
            <Field label="生日">
              <input style={inputStyle} type="date" value={form.birthday} onChange={(event) => setForm((current) => ({ ...current, birthday: event.target.value }))} />
            </Field>
            <Field label="性别">
              <select style={inputStyle} value={form.gender} onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))}>
                <option value="female">女</option>
                <option value="male">男</option>
                <option value="unknown">未知</option>
              </select>
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
    <PageShell title="家庭成员管理" description="查看成员、邀请来源和角色信息。">
      <Panel>
        {!activeChild?.family_no ? <EmptyState message="当前孩子尚未关联家庭编号。" /> : null}
        {loading ? <EmptyState message="正在加载家庭成员…" /> : null}
        {error ? <EmptyState message={`加载失败：${error}`} /> : null}
        {message ? <p style={{ ...helperTextStyle, color: message === '成员角色已更新' ? '#0f766e' : '#dc2626' }}>{message}</p> : null}
        {members.length ? (
          <div style={rowStyle}>
            {members.map((member) => (
              <div key={member.user_no} style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '12px' }}>
                <strong>{member.nickname}</strong>
                <p style={helperTextStyle}>用户编号：{member.user_no}</p>
                <p style={helperTextStyle}>手机号：{settings.hideMobileMask ? '已隐藏' : member.mobile_masked ?? '未提供'}</p>
                <p style={helperTextStyle}>角色：{member.role}</p>
                <p style={helperTextStyle}>邀请人：{member.invited_by_user_no ?? '系统创建 / 当前 owner'}</p>
                {member.role !== 'owner' ? (
                  <div style={{ ...buttonRowStyle, marginTop: '8px' }}>
                    <button style={secondaryButtonStyle} onClick={() => void onChangeRole(member.user_no, 'viewer')} disabled={updatingUserNo === member.user_no}>
                      {updatingUserNo === member.user_no && member.role !== 'viewer' ? '处理中…' : '设为 viewer'}
                    </button>
                    <button style={secondaryButtonStyle} onClick={() => void onChangeRole(member.user_no, 'editor')} disabled={updatingUserNo === member.user_no}>
                      {updatingUserNo === member.user_no && member.role !== 'editor' ? '处理中…' : '设为 editor'}
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
        {!loading && !error && !members.length && activeChild?.family_no ? <EmptyState message="当前家庭还没有更多成员。" /> : null}
      </Panel>
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
      const result = await webApi.createFamilyInvite(activeChild.family_no, form);
      setInviteResult(result);
      setMessage('邀请码已生成，可直接复制后发送给家人。');
    } catch (err) {
      setError(err instanceof Error ? err.message : '邀请创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell title="邀请家庭成员" description="创建邀请码后，被邀请人登录并接受邀请即可加入家庭。">
      <Panel>
        <form onSubmit={onSubmit} style={rowStyle}>
          <Field label="邀请手机号">
            <input style={inputStyle} value={form.mobile} onChange={(event) => setForm((current) => ({ ...current, mobile: event.target.value }))} />
          </Field>
          <Field label="邀请角色">
            <select style={inputStyle} value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as 'viewer' | 'editor' }))}>
              <option value="viewer">viewer</option>
              <option value="editor">editor</option>
            </select>
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
            <p style={helperTextStyle}>邀请码：{inviteResult.invite_token}</p>
            <p style={helperTextStyle}>失效时间：{new Date(inviteResult.expires_at).toLocaleString()}</p>
            <div style={buttonRowStyle}>
              <button type="button" style={secondaryButtonStyle} onClick={() => void copyText(inviteResult.invite_token, '邀请码已复制')}>
                复制邀请码
              </button>
              <button
                type="button"
                style={secondaryButtonStyle}
                onClick={() => void copyText(`${window.location.origin}/family/invite/${inviteResult.invite_token}/accept`, '邀请链接已复制')}
              >
                复制邀请链接
              </button>
              <Link to={`/family/invite/${inviteResult.invite_token}/accept`} style={secondaryButtonStyle as never}>
                打开接受邀请页
              </Link>
            </div>
          </div>
        </Panel>
      ) : null}
    </PageShell>
  );
};

export const FamilyInviteAcceptPage = () => {
  const navigate = useNavigate();
  const params = useParams<{ token: string }>();
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [error, setError] = useState<string | null>(null);

  const onAccept = async () => {
    if (!params.token) return;
    setStatus('submitting');
    setError(null);
    try {
      await webApi.acceptInvite(params.token);
      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : '接受邀请失败');
      setStatus('idle');
    }
  };

  return (
    <PageShell title="接受邀请" description="被邀请人登录后可通过此页加入家庭。">
      <Panel>
        <div style={rowStyle}>
          <p style={helperTextStyle}>当前邀请码：{params.token ?? '未提供'}</p>
          {error ? <p style={{ ...helperTextStyle, color: '#dc2626' }}>{error}</p> : null}
          {status === 'success' ? <p style={{ ...helperTextStyle, color: '#0f766e' }}>接受成功，已加入家庭。</p> : null}
          <div style={buttonRowStyle}>
            <button type="button" style={primaryButtonStyle} onClick={() => void onAccept()} disabled={status === 'submitting'}>
              {status === 'submitting' ? '提交中…' : '接受邀请'}
            </button>
            {status === 'success' ? (
              <button type="button" style={secondaryButtonStyle} onClick={() => navigate('/family', { replace: true })}>
                查看家庭页
              </button>
            ) : null}
            <button type="button" style={secondaryButtonStyle} onClick={() => navigate('/family')}>
              返回家庭页
            </button>
          </div>
        </div>
      </Panel>
    </PageShell>
  );
};
