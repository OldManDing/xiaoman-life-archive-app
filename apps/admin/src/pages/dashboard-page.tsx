import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
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
  background: 'rgba(255, 255, 255, 0.96)',
  boxShadow: '0 18px 50px rgba(15, 23, 42, 0.07)',
};

const mutedStyle: CSSProperties = {
  margin: 0,
  color: '#60706b',
  fontSize: '13px',
  lineHeight: 1.65,
};

const dashboardButtonStyle: CSSProperties = {
  ...secondaryButtonStyle,
  minHeight: '44px',
  borderRadius: '999px',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
};

const formatDateTime = (value: string | null | undefined) => (value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-');

const DashboardCard = ({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) => (
  <section className={className} style={{ ...surfaceStyle, minWidth: 0, ...style }}>
    {children}
  </section>
);

const SectionTitle = ({ title, description, icon }: { title: string; description: string; icon: ReactNode }) => (
  <div className="admin-dashboard-section-title">
    <div>
      <h2 style={{ margin: 0, color: '#15211f', fontSize: '19px', letterSpacing: '-0.025em' }}>{title}</h2>
      <p style={{ ...mutedStyle, marginTop: '6px' }}>{description}</p>
    </div>
    <span className="admin-dashboard-section-icon">{icon}</span>
  </div>
);

const StatTile = ({ label, value, helper, icon }: { label: string; value: number | string; helper: string; icon: ReactNode }) => (
  <div className="admin-dashboard-stat" style={{ ...surfaceStyle, padding: '18px', display: 'grid', gap: '12px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center' }}>
      <span style={{ color: '#60706b', fontSize: '13px', fontWeight: 800 }}>{label}</span>
      <span className="admin-dashboard-stat-icon">{icon}</span>
    </div>
    <strong style={{ color: '#0d312c', fontSize: '34px', lineHeight: 1, letterSpacing: '-0.055em' }}>{value}</strong>
    <span style={{ color: '#60706b', fontSize: '12px', lineHeight: 1.55 }}>{helper}</span>
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
    <Link className="admin-dashboard-priority-item" to={to} style={{ borderColor: styles.border, background: styles.background }}>
      <strong style={{ color: styles.color }}>{count}</strong>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: '14px', fontWeight: 900 }}>{title}</span>
        <span style={{ display: 'block', marginTop: '4px', color: '#60706b', fontSize: '12px', lineHeight: 1.55 }}>{description}</span>
      </span>
      <ArrowUpRight size={17} color={styles.color} />
    </Link>
  );
};

const InsightItem = ({ label, value, helper, tone = 'neutral' }: { label: string; value: string; helper: string; tone?: 'neutral' | 'success' | 'warning' }) => {
  const toneStyle = {
    neutral: { background: '#f8faf9', border: '#e1e8e4', value: '#123c37' },
    success: { background: '#effaf3', border: '#c8f0d5', value: '#087443' },
    warning: { background: '#fff8e8', border: '#ffe2a8', value: '#9a5b00' },
  }[tone];

  return (
    <div className="admin-dashboard-insight-item" style={{ background: toneStyle.background, borderColor: toneStyle.border }}>
      <span>{label}</span>
      <strong style={{ color: toneStyle.value }}>{value}</strong>
      <p>{helper}</p>
    </div>
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
  const recordTotal = dashboard?.totals.records ?? 0;
  const mediaTotal = dashboard?.totals.media ?? 0;
  const aiTotal = aiStats.reduce((sum, item) => sum + item.count, 0);
  const successAiCount = aiStats.find((item) => item.status === 'success')?.count ?? 0;
  const aiSuccessRate = aiTotal > 0 ? `${Math.round((successAiCount / aiTotal) * 100)}%` : '-';
  const mediaRatio = contentTotal > 0 ? `${Math.round((mediaTotal / contentTotal) * 100)}%` : '-';

  const workbenchTone = useMemo(() => {
    if (failedAiCount > 0) {
      return {
        label: `${failedAiCount} 个 AI 任务失败`,
        tone: 'danger' as const,
        title: '先恢复 AI 生成链路，再审核内容。',
        description: '失败任务会影响成长记录摘要、标签和报告生成。今天的第一步应先进入 AI 任务列表，定位供应商、参数或素材问题。',
        primaryText: '处理 AI 任务',
        primaryTo: '/ai-jobs',
      };
    }
    if (activeAiCount > 0) {
      return {
        label: `${activeAiCount} 个 AI 任务处理中`,
        tone: 'warning' as const,
        title: '队列正在运行，边看积压边做内容抽检。',
        description: '当前仍有任务排队或生成中，需要关注是否长时间停留；同时可以检查成长记录和媒体素材，确保用户端内容完整。',
        primaryText: '查看队列',
        primaryTo: '/ai-jobs',
      };
    }
    return {
      label: '运营状态稳定',
      tone: 'success' as const,
      title: '今天先处理风险，再看增长。',
      description: '当前没有明显阻塞项。总览页聚焦风险、内容、AI 和审计状态，避免把指标堆成无法执行的报表。',
      primaryText: '开始内容抽检',
      primaryTo: '/records',
    };
  }, [activeAiCount, failedAiCount]);

  return (
    <PageShell title="后台总览" description="面向日常运营的工作台：先判断风险，再进入用户、内容、媒体、AI 和审计处理。">
      {error ? (
        <Panel>
          <EmptyState message={`加载失败：${error}`} />
        </Panel>
      ) : null}

      <section className="admin-dashboard-workbench">
        <DashboardCard className="admin-dashboard-command" style={{ padding: '26px', color: '#f8fbf8' }}>
          <div className="admin-dashboard-command-inner">
            <Badge tone={workbenchTone.tone}>{workbenchTone.label}</Badge>
            <div>
              <h2>{workbenchTone.title}</h2>
              <p>{workbenchTone.description}</p>
            </div>
            <div className="admin-dashboard-command-actions">
              <Link to={workbenchTone.primaryTo} style={{ ...dashboardButtonStyle, border: 'none', background: '#ffffff', color: '#123c37' }}>
                {workbenchTone.primaryText}
              </Link>
              <Link to="/audit-logs" style={{ ...dashboardButtonStyle, borderColor: 'rgba(255,255,255,0.32)', background: 'rgba(255,255,255,0.12)', color: '#ffffff' }}>
                查看审计留痕
              </Link>
            </div>
          </div>
        </DashboardCard>

        <DashboardCard className="admin-dashboard-priority" style={{ padding: '18px', display: 'grid', gap: '12px' }}>
          <SectionTitle title="今日优先级" description="按影响面排序，帮助运营先处理最可能影响用户体验的问题。" icon={<ListChecks size={20} />} />
          <PriorityItem title="AI 失败任务" count={loading ? '-' : failedAiCount} description="优先恢复摘要、标签、报告生成链路。" to="/ai-jobs" tone={failedAiCount > 0 ? 'danger' : 'success'} />
          <PriorityItem title="AI 排队/处理中" count={loading ? '-' : activeAiCount} description="观察是否积压、超时或重复重试。" to="/ai-jobs" tone={activeAiCount > 0 ? 'warning' : 'success'} />
          <PriorityItem title="最近审计动作" count={loading ? '-' : auditCount} description="确认关键操作有记录、能追踪。" to="/audit-logs" tone={auditCount > 0 ? 'info' : 'warning'} />
        </DashboardCard>
      </section>

      <div className="admin-dashboard-stats">
        <StatTile label="用户" value={loading ? '-' : dashboard?.totals.users ?? 0} helper="重点关注冻结、异常注册、会员状态和家庭协作。" icon={<Users size={19} />} />
        <StatTile label="孩子档案" value={loading ? '-' : dashboard?.totals.children ?? 0} helper="用于核对档案完整度、家庭归属和成员关系。" icon={<Database size={19} />} />
        <StatTile label="内容资产" value={loading ? '-' : contentTotal} helper="成长记录与媒体素材合计，是内容抽检的主范围。" icon={<FileText size={19} />} />
        <StatTile label="媒体素材" value={loading ? '-' : dashboard?.totals.media ?? 0} helper="图片、音视频异常会直接影响档案观感。" icon={<Image size={19} />} />
      </div>

      <div className="admin-dashboard-main-grid">
        <DashboardCard style={{ padding: '20px', display: 'grid', gap: '16px' }}>
          <SectionTitle title="运营判断" description="总览页只保留能辅助判断的状态，不重复侧边栏导航。" icon={<CheckCircle2 size={20} />} />
          <div className="admin-dashboard-insights">
            <InsightItem label="内容体量" value={loading ? '-' : `${recordTotal} 条记录`} helper="记录数量决定内容审核压力，媒体只是其中一类支撑素材。" />
            <InsightItem label="媒体占比" value={loading ? '-' : mediaRatio} helper="媒体占比过高时，优先关注访问失败、异常标记和下架处理。" tone={mediaTotal > recordTotal ? 'warning' : 'neutral'} />
            <InsightItem label="AI 完成率" value={loading ? '-' : aiSuccessRate} helper="失败率或处理中比例升高，会直接影响智能摘要、标签和报告。" tone={failedAiCount > 0 || activeAiCount > 0 ? 'warning' : 'success'} />
            <InsightItem label="审计活跃" value={loading ? '-' : `${auditCount} 条`} helper="近期后台动作越多，越需要复盘关键操作是否符合预期。" tone={auditCount > 0 ? 'neutral' : 'warning'} />
          </div>
        </DashboardCard>

        <DashboardCard style={{ padding: '20px', display: 'grid', gap: '16px' }}>
          <SectionTitle title="AI 任务健康" description="只展示会影响用户端智能内容的状态。" icon={<Sparkles size={20} />} />
          <div style={{ display: 'grid', gap: '10px' }}>
            {aiStats.length ? (
              aiStats.map((item) => (
                <div key={item.status} className={`admin-dashboard-ai-row admin-dashboard-ai-row-${item.status}`}>
                  <span>
                    {item.status === 'failed' ? <AlertTriangle size={16} color="#b91c1c" /> : item.status === 'processing' ? <Clock3 size={16} color="#9a5b00" /> : <CheckCircle2 size={16} color="#047857" />}
                    {aiJobStatusLabel(item.status)}
                  </span>
                  <strong>{item.count}</strong>
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
        <div className="admin-dashboard-audit-header">
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
