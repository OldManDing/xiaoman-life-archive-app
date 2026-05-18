import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Clock3,
  Database,
  FileText,
  Image,
  ListChecks,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

import { adminApi, type AdminDashboardResponse } from '../shared/request';
import { aiJobStatusLabel, auditActionLabel, auditTargetTypeLabel } from '../shared/labels';
import { Badge, EmptyState, PageShell, Panel } from '../shared/ui';
import { secondaryButtonStyle, tableStyle, thTdStyle } from '../shared/uiStyles';

const surfaceStyle: CSSProperties = {
  border: '1px solid rgba(28, 65, 57, 0.1)',
  borderRadius: '24px',
  background: 'rgba(255, 255, 255, 0.94)',
  boxShadow: '0 18px 50px rgba(15, 23, 42, 0.07)',
};

const mutedStyle: CSSProperties = {
  margin: 0,
  color: '#65736f',
  fontSize: '13px',
  lineHeight: 1.65,
};

const dashboardButtonStyle: CSSProperties = {
  ...secondaryButtonStyle,
  minHeight: '42px',
  borderRadius: '999px',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
};

const moduleCards = [
  {
    title: '用户运营',
    description: '处理异常账号、会员状态和家庭协作入口。',
    action: '查看用户',
    to: '/users',
    icon: Users,
    tone: '#dff5ff',
  },
  {
    title: '孩子档案',
    description: '核对档案归属、家庭成员和最近成长记录。',
    action: '查看档案',
    to: '/children',
    icon: Database,
    tone: '#e7f8ee',
  },
  {
    title: '成长记录',
    description: '优先处理内容质量、发布状态和上下架审核。',
    action: '审核记录',
    to: '/records',
    icon: FileText,
    tone: '#fff2d6',
  },
  {
    title: '媒体素材',
    description: '检查图片、音视频异常和素材可访问性。',
    action: '检查媒体',
    to: '/media',
    icon: Image,
    tone: '#ffe8e8',
  },
];

const formatDateTime = (value: string | null | undefined) => (value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-');

const DashboardCard = ({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) => (
  <section className={className} style={{ ...surfaceStyle, minWidth: 0, ...style }}>
    {children}
  </section>
);

const SectionTitle = ({ title, description, icon }: { title: string; description: string; icon: ReactNode }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
    <div>
      <h2 style={{ margin: 0, color: '#15211f', fontSize: '18px', letterSpacing: '-0.02em' }}>{title}</h2>
      <p style={{ ...mutedStyle, marginTop: '6px' }}>{description}</p>
    </div>
    <span
      style={{
        width: '40px',
        height: '40px',
        borderRadius: '16px',
        display: 'grid',
        placeItems: 'center',
        color: '#123c37',
        background: '#eef5f2',
        flex: '0 0 auto',
      }}
    >
      {icon}
    </span>
  </div>
);

const StatTile = ({ label, value, helper, icon }: { label: string; value: number | string; helper: string; icon: ReactNode }) => (
  <div className="admin-dashboard-stat" style={{ ...surfaceStyle, padding: '17px', display: 'grid', gap: '12px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center' }}>
      <span style={{ color: '#65736f', fontSize: '13px', fontWeight: 800 }}>{label}</span>
      <span style={{ color: '#123c37', width: '34px', height: '34px', borderRadius: '13px', display: 'grid', placeItems: 'center', background: '#f1f6f4' }}>
        {icon}
      </span>
    </div>
    <strong style={{ color: '#102b27', fontSize: '32px', lineHeight: 1, letterSpacing: '-0.05em' }}>{value}</strong>
    <span style={{ color: '#65736f', fontSize: '12px', lineHeight: 1.55 }}>{helper}</span>
  </div>
);

const PriorityItem = ({
  title,
  count,
  description,
  to,
  tone,
}: {
  title: string;
  count: number | string;
  description: string;
  to: string;
  tone: 'danger' | 'warning' | 'success' | 'info';
}) => {
  const styles = {
    danger: { background: '#fff1f1', color: '#b42318', border: '#ffd6d6' },
    warning: { background: '#fff8e8', color: '#9a5b00', border: '#ffe2a8' },
    success: { background: '#effaf3', color: '#087443', border: '#c8f0d5' },
    info: { background: '#eef6ff', color: '#195aa5', border: '#cfe5ff' },
  }[tone];

  return (
    <Link
      to={to}
      style={{
        border: `1px solid ${styles.border}`,
        borderRadius: '18px',
        padding: '15px',
        display: 'grid',
        gridTemplateColumns: 'auto minmax(0, 1fr) auto',
        gap: '12px',
        alignItems: 'center',
        textDecoration: 'none',
        color: '#16211f',
        background: styles.background,
      }}
    >
      <strong style={{ color: styles.color, fontSize: '26px', lineHeight: 1, minWidth: '32px', textAlign: 'center' }}>{count}</strong>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: '14px', fontWeight: 900 }}>{title}</span>
        <span style={{ display: 'block', marginTop: '4px', color: '#60706b', fontSize: '12px', lineHeight: 1.55 }}>{description}</span>
      </span>
      <ArrowUpRight size={17} color={styles.color} />
    </Link>
  );
};

export const DashboardPage = () => {
  const [dashboard, setDashboard] = useState<AdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const next = await adminApi.dashboard();
        if (active) setDashboard(next);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : '总览加载失败');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const aiStats = dashboard?.ai_job_status_distribution ?? [];
  const failedAiCount = aiStats.find((item) => item.status === 'failed')?.count ?? 0;
  const processingAiCount = aiStats.find((item) => item.status === 'processing')?.count ?? 0;
  const pendingAiCount = aiStats.find((item) => item.status === 'pending')?.count ?? 0;
  const activeAiCount = processingAiCount + pendingAiCount;
  const auditCount = dashboard?.recent_audit_logs.length ?? 0;
  const contentTotal = (dashboard?.totals.records ?? 0) + (dashboard?.totals.media ?? 0);

  const workbenchTone = useMemo(() => {
    if (failedAiCount > 0) {
      return {
        label: `${failedAiCount} 个 AI 任务失败`,
        tone: 'danger' as const,
        title: '先处理失败任务，再做内容巡检',
        description: '失败任务会影响记录标题、摘要和标签生成，建议运营先进入 AI 任务页定位供应商或输入问题。',
      };
    }
    if (activeAiCount > 0) {
      return {
        label: `${activeAiCount} 个 AI 任务处理中`,
        tone: 'warning' as const,
        title: 'AI 队列运行中，关注是否积压',
        description: '当前有任务在排队或生成中，适合同时抽查成长记录与媒体素材，确认用户侧内容可读可看。',
      };
    }
    return {
      label: '今日暂无明显阻塞',
      tone: 'success' as const,
      title: '运营状态平稳，优先做内容抽检',
      description: '当前没有失败或积压的 AI 任务，可以把重点放在成长记录质量、媒体可访问性和审计留痕上。',
    };
  }, [activeAiCount, failedAiCount]);

  return (
    <PageShell title="后台总览" description="把风险、内容、AI 和审计放到同一个可执行工作台。">
      {error ? (
        <Panel>
          <EmptyState message={`加载失败：${error}`} />
        </Panel>
      ) : null}

      <section className="admin-dashboard-workbench">
        <DashboardCard className="admin-dashboard-command" style={{ padding: '24px', color: '#f8fbf8' }}>
          <div style={{ position: 'relative', zIndex: 1, display: 'grid', gap: '18px', alignContent: 'space-between', minHeight: '100%' }}>
            <Badge tone={workbenchTone.tone}>{workbenchTone.label}</Badge>
            <div>
              <h2 style={{ margin: 0, maxWidth: '760px', fontSize: 'clamp(30px, 4.2vw, 52px)', lineHeight: 1.02, letterSpacing: '-0.065em' }}>
                {workbenchTone.title}
              </h2>
              <p style={{ margin: '14px 0 0', maxWidth: '700px', color: 'rgba(248, 251, 248, 0.82)', fontSize: '15px', lineHeight: 1.8 }}>
                {workbenchTone.description}
              </p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              <Link to={failedAiCount > 0 || activeAiCount > 0 ? '/ai-jobs' : '/records'} style={{ ...dashboardButtonStyle, border: 'none', background: '#ffffff', color: '#123c37' }}>
                {failedAiCount > 0 || activeAiCount > 0 ? '处理 AI 任务' : '开始内容抽检'}
              </Link>
              <Link to="/audit-logs" style={{ ...dashboardButtonStyle, borderColor: 'rgba(255,255,255,0.32)', background: 'rgba(255,255,255,0.12)', color: '#ffffff' }}>
                查看审计留痕
              </Link>
            </div>
          </div>
        </DashboardCard>

        <DashboardCard className="admin-dashboard-priority" style={{ padding: '18px', display: 'grid', gap: '12px' }}>
          <SectionTitle title="今日处置优先级" description="按影响面排序，不再把入口平均摊开。" icon={<ListChecks size={20} />} />
          <PriorityItem title="AI 失败任务" count={loading ? '-' : failedAiCount} description="失败会直接影响记录智能生成结果。" to="/ai-jobs" tone={failedAiCount > 0 ? 'danger' : 'success'} />
          <PriorityItem title="AI 排队/处理中" count={loading ? '-' : activeAiCount} description="观察是否长时间积压或重复重试。" to="/ai-jobs" tone={activeAiCount > 0 ? 'warning' : 'success'} />
          <PriorityItem title="最近审计动作" count={loading ? '-' : auditCount} description="确认后台关键操作是否可追踪。" to="/audit-logs" tone={auditCount > 0 ? 'info' : 'warning'} />
        </DashboardCard>
      </section>

      <div className="admin-dashboard-stats">
        <StatTile label="用户" value={loading ? '-' : dashboard?.totals.users ?? 0} helper="账号、会员状态和异常注册的运营基础。" icon={<Users size={19} />} />
        <StatTile label="孩子档案" value={loading ? '-' : dashboard?.totals.children ?? 0} helper="决定家庭协作和成长记录归属是否清晰。" icon={<Database size={19} />} />
        <StatTile label="内容资产" value={loading ? '-' : contentTotal} helper="成长记录与媒体素材合计，需要持续抽检。" icon={<FileText size={19} />} />
        <StatTile label="媒体素材" value={loading ? '-' : dashboard?.totals.media ?? 0} helper="图片、音视频异常会直接影响档案观感。" icon={<Image size={19} />} />
      </div>

      <div className="admin-dashboard-main-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.05fr) minmax(340px, 0.95fr)', gap: '16px', alignItems: 'start' }}>
        <DashboardCard style={{ padding: '20px', display: 'grid', gap: '16px' }}>
          <SectionTitle title="运营路径" description="按日常处理顺序组织，不再只是模块导航。" icon={<Activity size={20} />} />
          <div className="admin-dashboard-modules" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
            {moduleCards.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.title}
                  to={item.to}
                  style={{
                    border: '1px solid #e1e8e4',
                    borderRadius: '18px',
                    padding: '16px',
                    color: '#16211f',
                    textDecoration: 'none',
                    display: 'grid',
                    gap: '12px',
                    minHeight: '158px',
                    background: 'linear-gradient(180deg, #ffffff 0%, #fbfcfb 100%)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start' }}>
                    <span style={{ width: '42px', height: '42px', borderRadius: '16px', display: 'grid', placeItems: 'center', background: item.tone, color: '#123c37' }}>
                      <Icon size={20} />
                    </span>
                    <ArrowUpRight size={17} color="#8a9894" />
                  </div>
                  <div>
                    <strong style={{ display: 'block', fontSize: '15px' }}>{item.title}</strong>
                    <span style={{ display: 'block', marginTop: '6px', color: '#66736f', fontSize: '13px', lineHeight: 1.55 }}>{item.description}</span>
                  </div>
                  <span style={{ marginTop: 'auto', color: '#123c37', fontSize: '13px', fontWeight: 900 }}>{item.action}</span>
                </Link>
              );
            })}
          </div>
        </DashboardCard>

        <DashboardCard style={{ padding: '20px', display: 'grid', gap: '16px' }}>
          <SectionTitle title="AI 与系统状态" description="只展示会影响用户体验的状态。" icon={<Sparkles size={20} />} />
          <div style={{ display: 'grid', gap: '10px' }}>
            {aiStats.length ? (
              aiStats.map((item) => (
                <div
                  key={item.status}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    gap: '12px',
                    alignItems: 'center',
                    border: '1px solid #e1e8e4',
                    borderRadius: '15px',
                    padding: '12px 14px',
                    background: item.status === 'failed' ? '#fff7f7' : '#f8faf9',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#263532', fontSize: '14px', fontWeight: 800 }}>
                    {item.status === 'failed' ? <AlertTriangle size={16} color="#b91c1c" /> : item.status === 'processing' ? <Clock3 size={16} color="#9a5b00" /> : <CheckCircle2 size={16} color="#047857" />}
                    {aiJobStatusLabel(item.status)}
                  </span>
                  <strong style={{ color: item.status === 'failed' ? '#b91c1c' : '#123c37', fontSize: '20px' }}>{item.count}</strong>
                </div>
              ))
            ) : (
              <EmptyState message={loading ? '加载中...' : '暂无 AI 任务统计。'} />
            )}
          </div>
          <Link to="/ai-jobs" style={{ ...dashboardButtonStyle, width: '100%' }}>
            <Bot size={16} />
            进入 AI 任务列表
          </Link>
        </DashboardCard>
      </div>

      <DashboardCard style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
          <SectionTitle title="最近审计日志" description="快速确认后台关键动作是否符合预期。" icon={<ShieldCheck size={20} />} />
          <Link to="/audit-logs" style={dashboardButtonStyle}>
            查看全部
          </Link>
        </div>
        {dashboard?.recent_audit_logs.length ? (
          <div className="admin-table-scroll" style={{ overflowX: 'auto' }}>
            <table className="admin-responsive-table admin-dashboard-audit-table" style={tableStyle}>
              <thead>
                <tr>
                  {['动作', '目标类型', '目标编号', 'IP 地址', '发生时间'].map((column) => (
                    <th key={column} style={{ ...thTdStyle, color: '#66736f', fontSize: '13px', background: '#f6f8f7' }}>
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dashboard.recent_audit_logs.map((item) => (
                  <tr key={`${item.action}-${item.created_at}`}>
                    <td data-label="动作" style={thTdStyle}>{auditActionLabel(item.action)}</td>
                    <td data-label="目标类型" style={thTdStyle}>{auditTargetTypeLabel(item.target_type)}</td>
                    <td data-label="目标编号" style={thTdStyle}>{item.target_id ?? '-'}</td>
                    <td data-label="IP 地址" style={thTdStyle}>{item.ip_address ?? '-'}</td>
                    <td data-label="发生时间" style={thTdStyle}>{formatDateTime(item.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message={loading ? '加载中...' : '暂无审计日志。'} />
        )}
      </DashboardCard>
    </PageShell>
  );
};
