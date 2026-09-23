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
    <span className="admin-overview-stat-label">{label}</span>
    <strong className="admin-overview-stat-value">{value}</strong>
  </article>
);

type TrendMode = 'daily' | 'monthly';
type TrendMetric = 'users' | 'records' | 'media' | 'risks' | 'ai_jobs';
type TrendPoint = AdminDashboardResponse['trend']['daily'][number] | AdminDashboardResponse['trend']['monthly'][number];

const TREND_METRICS: Array<{ key: TrendMetric; label: string; color: string }> = [
  { key: 'users', label: '新增用户', color: '#6b5633' },
  { key: 'records', label: '发布记录', color: '#a37432' },
  { key: 'media', label: '媒体', color: '#70815d' },
  { key: 'risks', label: '风险事件', color: '#b34f43' },
  { key: 'ai_jobs', label: 'AI 任务', color: '#8a6f98' },
];

const formatTrendLabel = (point: TrendPoint, mode: TrendMode) => {
  const bucket = mode === 'daily' ? ('date' in point ? point.date : '') : ('month' in point ? point.month : '');
  return mode === 'daily' ? bucket.slice(5) : bucket.slice(2);
};

const getTrendBucket = (point: TrendPoint, mode: TrendMode) =>
  mode === 'daily' ? ('date' in point ? point.date : '') : ('month' in point ? point.month : '');

const TrendChart = ({ points, mode }: { points: TrendPoint[]; mode: TrendMode }) => {
  const width = 760;
  const height = 286;
  const plot = { left: 44, right: 16, top: 18, bottom: 40 };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const maxValue = Math.max(1, ...points.flatMap((point) => TREND_METRICS.map(({ key }) => point[key])));
  const xFor = (index: number) =>
    points.length <= 1 ? plot.left + plotWidth / 2 : plot.left + (index / (points.length - 1)) * plotWidth;
  const yFor = (value: number) => plot.top + plotHeight - (value / maxValue) * plotHeight;
  const shouldShowLabel = (index: number) => mode === 'monthly' || index % 2 === 0 || index === points.length - 1;
  const linePath = (key: TrendMetric) =>
    points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${xFor(index).toFixed(2)} ${yFor(point[key]).toFixed(2)}`).join(' ');

  if (points.length === 0) {
    return (
      <div className="admin-overview-chart-empty">
        <strong>暂无趋势数据</strong>
        <span>当前时间范围内还没有可展示的统计记录。</span>
      </div>
    );
  }

  return (
    <div className="admin-overview-chart-stage">
      <svg className="admin-overview-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="dashboard-trend-title">
        <title id="dashboard-trend-title">{mode === 'daily' ? '最近十四天数据趋势' : '最近十二个月数据趋势'}</title>
        {[0, 1, 2, 3, 4].map((step) => {
          const value = Math.round((maxValue * (4 - step)) / 4);
          const y = plot.top + (step / 4) * plotHeight;
          return (
            <g key={step} className="admin-overview-chart-gridline">
              <line x1={plot.left} x2={width - plot.right} y1={y} y2={y} />
              <text x={plot.left - 10} y={y + 4} textAnchor="end">{value}</text>
            </g>
          );
        })}
        {TREND_METRICS.map(({ key, color, label }) => (
          <g key={key} className="admin-overview-chart-series">
            <path d={linePath(key)} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {points.map((point, index) => {
              const bucket = getTrendBucket(point, mode);
              const value = point[key];
              return (
                <circle
                  key={`${key}-${bucket}`}
                  cx={xFor(index)}
                  cy={yFor(value)}
                  r="4"
                  fill="#fffdf8"
                  stroke={color}
                  strokeWidth="2.5"
                  aria-label={`${label} ${bucket} ${value}`}
                >
                  <title>{`${label} · ${bucket} · ${value}`}</title>
                </circle>
              );
            })}
          </g>
        ))}
        {points.map((point, index) =>
          shouldShowLabel(index) ? (
            <text key={`label-${getTrendBucket(point, mode)}`} className="admin-overview-chart-label" x={xFor(index)} y={height - 12} textAnchor="middle">
              {formatTrendLabel(point, mode)}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
};

const TrendPanel = ({
  points,
  mode,
  onModeChange,
  loading,
  openRiskCount,
}: {
  points: TrendPoint[];
  mode: TrendMode;
  onModeChange: (mode: TrendMode) => void;
  loading: boolean;
  openRiskCount: number;
}) => {
  const current = points[points.length - 1];
  const previous = points[points.length - 2];
  const periodLabel = mode === 'daily' ? '今日' : '本月';

  return (
    <section className="admin-overview-trend" aria-labelledby="dashboard-trend-heading">
      <div className="admin-overview-trend-head">
        <div>
          <h3 id="dashboard-trend-heading">趋势分析</h3>
          <span>{mode === 'daily' ? '最近 14 天' : '最近 12 个月'} · 当前待处理风险 {loading ? '-' : openRiskCount}</span>
        </div>
        <div className="admin-overview-trend-switch" role="group" aria-label="趋势时间范围">
          {(['daily', 'monthly'] as TrendMode[]).map((item) => (
            <button key={item} type="button" aria-pressed={mode === item} onClick={() => onModeChange(item)}>
              {item === 'daily' ? '每日' : '每月'}
            </button>
          ))}
        </div>
      </div>
      <div className="admin-overview-trend-summary">
        {TREND_METRICS.map(({ key, label, color }) => {
          const value = current?.[key] ?? 0;
          const delta = current && previous ? value - previous[key] : 0;
          return (
            <article key={key} className="admin-overview-trend-stat">
              <span><i style={{ backgroundColor: color }} />{label}</span>
              <strong>{loading ? '-' : value}</strong>
              <small>{periodLabel} {delta > 0 ? `+${delta}` : delta}</small>
            </article>
          );
        })}
      </div>
      <TrendChart points={points} mode={mode} />
    </section>
  );
};

export const DashboardPage = () => {
  const [dashboard, setDashboard] = useState<AdminDashboardResponse | null>(null);
  const [readiness, setReadiness] = useState<AdminOpsReadinessResponse | null>(null);
  const [readinessError, setReadinessError] = useState<string | null>(null);
  const [trendMode, setTrendMode] = useState<TrendMode>('daily');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        // 运维数据失败必须显式提示，不能静默降级成"运行稳定"。
        const readinessResult = await adminApi.opsReadiness().catch((err: unknown) => {
          if (active) setReadinessError(err instanceof Error ? err.message : '运维数据加载失败');
          return null;
        });
        const next = await adminApi.dashboard();
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
  const recordRiskCount = readiness?.data_statistics.record_content_risks ?? 0;
  // 「待处理」总数直接用后端算好的**并集**。
  // 之前的写法是 content_risks + 媒体异常 + AI 失败 + 待处理反馈，而 content_risks 本身
  // 已包含媒体异常与 AI 失败、待处理反馈已包含儿童安全工单 —— 于是后两者被算了两遍，
  // 页面上还会出现「合计 27 项」与三张卡片相加对不上的情况。
  const issueTotal =
    readiness?.data_statistics.pending_total ??
    recordRiskCount + mediaExceptionCount + failedJobCount + openSupportCount;
  const trendPoints = dashboard?.trend?.[trendMode] ?? [];

  // 运维数据不可用时不允许声称"运行稳定"，改为中性提示。
  const headline = useMemo(() => {
    if (readinessError) {
      return {
        tone: 'neutral' as const,
        badge: '运维数据不可用',
        title: '无法确认待处理异常',
        description: `读取运维统计失败：${readinessError}。请进入系统运维页重试。`,
        primaryText: '前往系统运维',
        primaryTo: '/ops-readiness',
      };
    }

    // 数据还没回来时不能宣称「运行稳定」：此时 issueTotal 恒为 0，
    // 会给管理员一个「无异常」的假信号（移动端首屏实测会看到这句话 + 全为「-」的卡片并存）。
    if (loading) {
      return {
        tone: 'neutral' as const,
        badge: '正在读取',
        title: '正在加载运维数据',
        description: '正在汇总风险、媒体、AI 任务与用户反馈的待处理项。',
        primaryText: '前往系统运维',
        primaryTo: '/ops-readiness',
      };
    }

    if (issueTotal > 0) {
      return {
        tone: 'warning' as const,
        badge: `${issueTotal} 项待处理`,
        title: '今日先清理异常项',
        description: '按风险、媒体、AI 和用户反馈顺序处理。',
        primaryText: '开始处理',
        // 风险桶优先去聚合队列（内容风险含记录文本、媒体异常、儿童安全与 AI 失败），
        // 否则去各自的具体队列 —— 不再指向口径不同的成长记录「风险标记」筛选。
        primaryTo:
          contentRiskCount > 0
            ? '/content-risks'
            : mediaExceptionCount > 0
              ? '/media?status=failed'
              : failedJobCount > 0
                ? '/ai-jobs'
                : '/support-tickets',
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
  }, [contentRiskCount, failedJobCount, issueTotal, loading, mediaExceptionCount, readinessError]);

  // 四条**互斥**的待处理队列，相加正好等于上方「待处理」合计（并集）。
  // 之前的「内容风险」卡片用的是聚合值（已含媒体异常、AI 失败、儿童安全工单），与另外两张卡片
  // 重叠，于是会出现「合计 27 项」但卡片相加只有 17 的情况。聚合队列改从侧栏与首屏主按钮进入。
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
      // 用内容风险队列里「记录文本风险」这一类（content_safety），与媒体异常、AI 失败不重叠；
      // 带上 category 参数后跳转过去的列表数量与卡片一致。
      to: '/content-risks?category=content_safety',
      icon: <ShieldAlert size={18} />,
      label: '记录风险',
      value: loading ? '-' : recordRiskCount,
      helper: '成长记录里的敏感文本待复核',
      tone: recordRiskCount > 0 ? ('danger' as const) : ('neutral' as const),
    },
    {
      // 数字是**媒体行**口径（上传/转码失败），所以要跳到媒体库的「异常」筛选，
      // 而不是成长记录的「媒体异常」筛选（记录口径，数字对不上）。
      to: '/media?status=failed',
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
      helper: '儿童安全优先，其余按提交时间',
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
        {/* AdminLayout 已经提供了页面唯一的 <main>，这里再用 <main> 会形成重复地标
            （读屏会看到两个 main）。降级为命名 section。 */}
        <section className="admin-overview-main" aria-label="后台总览工作区">
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
            <div className="admin-overview-section-head admin-overview-scale-head">
              <h3>数据规模</h3>
            </div>
            <div className="admin-overview-stat-grid">
              <StatTile label="用户" value={loading ? '-' : userTotal} />
              <StatTile label="孩子档案" value={loading ? '-' : childTotal} />
              <StatTile label="成长记录" value={loading ? '-' : recordTotal} />
            </div>
            <TrendPanel
              points={trendPoints}
              mode={trendMode}
              onModeChange={setTrendMode}
              loading={loading}
              openRiskCount={contentRiskCount}
            />
          </section>
        </section>
      </section>
    </PageShell>
  );
};
