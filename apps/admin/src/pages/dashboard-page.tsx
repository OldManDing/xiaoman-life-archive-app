import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Image, MessageSquareText, ShieldAlert } from 'lucide-react';

import { adminApi, type AdminDashboardResponse, type AdminOpsReadinessResponse } from '../shared/request';
import { PageShell } from '../shared/ui';

const PriorityLink = ({
  to,
  icon,
  label,
  value,
  helper,
  tone,
}: {
  to: string;
  icon: ReactNode;
  label: string;
  value: string | number;
  helper: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
}) => (
  <Link to={to} className={`admin-overview-task admin-overview-task-${tone}`}>
    <span className="admin-overview-task-icon">{icon}</span>
    <span className="admin-overview-task-copy">
      <strong>{label}</strong>
      <small>{helper}</small>
    </span>
    <b>{value}</b>
  </Link>
);

const StatTile = ({ label, value }: { label: string; value: string | number }) => (
  <article className="admin-overview-stat">
    <span>{label}</span>
    <strong>{value}</strong>
  </article>
);

export const DashboardPage = () => {
  const [dashboard, setDashboard] = useState<AdminDashboardResponse | null>(null);
  const [readiness, setReadiness] = useState<AdminOpsReadinessResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [next, readinessResult] = await Promise.all([
          adminApi.dashboard(),
          adminApi.opsReadiness().catch(() => null),
        ]);
        if (active) {
          setDashboard(next);
          setReadiness(readinessResult);
        }
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
  const successAiCount = aiStats.find((item) => item.status === 'success')?.count ?? 0;
  const aiTotal = aiStats.reduce((sum, item) => sum + item.count, 0);
  const aiSuccessRate = aiTotal > 0 ? Math.round((successAiCount / aiTotal) * 100) : 0;
  const userTotal = dashboard?.totals.users ?? 0;
  const childTotal = dashboard?.totals.children ?? 0;
  const recordTotal = dashboard?.totals.records ?? 0;
  const contentRiskCount = readiness?.data_statistics.content_risks ?? 0;
  const mediaExceptionCount = readiness?.data_statistics.media_exceptions ?? 0;
  const failedJobCount = readiness?.data_statistics.failed_ai_jobs ?? failedAiCount;
  const openSupportCount = readiness?.data_statistics.open_support_tickets ?? 0;
  const issueTotal = contentRiskCount + mediaExceptionCount + failedJobCount + openSupportCount;

  const headline = useMemo(() => {
    if (issueTotal > 0) {
      return {
        tone: 'warning' as const,
        badge: `${issueTotal} 项待处理`,
        title: '今日先清理异常项',
        description: '按风险、媒体、AI 和用户反馈顺序处理。',
        primaryText: '开始处理',
        primaryTo: contentRiskCount || mediaExceptionCount ? '/records' : failedJobCount ? '/ai-jobs' : '/support-tickets',
      };
    }

    return {
      tone: 'success' as const,
      badge: '运行稳定',
      title: '当前没有待处理异常',
      description: '可进入成长记录进行日常抽检。',
      primaryText: '开始内容抽检',
      primaryTo: '/records',
    };
  }, [contentRiskCount, failedJobCount, issueTotal, mediaExceptionCount]);

  const priorityTasks = [
    {
      to: '/ai-jobs',
      icon: failedJobCount > 0 ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />,
      label: failedJobCount > 0 ? 'AI 失败任务' : 'AI 链路正常',
      value: loading ? '-' : failedJobCount,
      helper: failedJobCount > 0 ? '检查供应商响应与任务重试' : `${aiSuccessRate}% 成功率`,
      tone: failedJobCount > 0 ? ('danger' as const) : ('success' as const),
    },
    {
      to: '/records?record_filter=risk',
      icon: <ShieldAlert size={18} />,
      label: '内容风险',
      value: loading ? '-' : contentRiskCount,
      helper: '查看已标记的成长记录',
      tone: contentRiskCount > 0 ? ('danger' as const) : ('neutral' as const),
    },
    {
      to: '/records?record_filter=media_exception',
      icon: <Image size={18} />,
      label: '媒体异常',
      value: loading ? '-' : mediaExceptionCount,
      helper: '检查上传、转码与播放状态',
      tone: mediaExceptionCount > 0 ? ('warning' as const) : ('neutral' as const),
    },
    {
      to: '/support-tickets',
      icon: <MessageSquareText size={18} />,
      label: '待处理反馈',
      value: loading ? '-' : openSupportCount,
      helper: '回复用户提交的问题',
      tone: openSupportCount > 0 ? ('warning' as const) : ('neutral' as const),
    },
  ];

  return (
    <PageShell title="后台总览">
      {error ? <div className="admin-overview-error">{`加载失败：${error}`}</div> : null}

      <section className={`admin-overview-hero admin-overview-hero-${headline.tone}`}>
        <div className="admin-overview-hero-copy">
          <span>{headline.badge}</span>
          <h2>{headline.title}</h2>
          <p>{headline.description}</p>
        </div>
        <div className="admin-overview-hero-actions">
          <Link className="admin-overview-primary-action" to={headline.primaryTo}>{headline.primaryText}</Link>
        </div>
      </section>

      <section className="admin-overview-grid">
        <main className="admin-overview-main">
          <section className="admin-overview-section admin-overview-workbench">
            <div className="admin-overview-section-head">
              <h3>待处理</h3>
              <span>{loading ? '正在同步' : issueTotal > 0 ? `${issueTotal} 项` : '已清空'}</span>
            </div>
            <div className="admin-overview-task-list">
              {priorityTasks.map((task) => (
                <PriorityLink key={task.label} {...task} />
              ))}
            </div>
            <div className="admin-overview-section-head">
              <h3>数据规模</h3>
              <span>当前总量</span>
            </div>
            <div className="admin-overview-stat-grid">
              <StatTile label="用户" value={loading ? '-' : userTotal} />
              <StatTile label="孩子档案" value={loading ? '-' : childTotal} />
              <StatTile label="成长记录" value={loading ? '-' : recordTotal} />
            </div>
          </section>
        </main>
      </section>
    </PageShell>
  );
};
