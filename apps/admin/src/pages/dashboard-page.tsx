import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
  ShieldCheck,
  Users,
} from 'lucide-react';

import { adminApi, type AdminDashboardResponse } from '../shared/request';
import { aiJobStatusLabel, auditActionLabel, auditTargetTypeLabel } from '../shared/labels';
import { EmptyState, PageShell } from '../shared/ui';
import { secondaryButtonStyle, tableStyle, thTdStyle } from '../shared/uiStyles';

const formatDateTime = (value: string | null | undefined) => (value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-');

const dashboardButtonStyle = {
  ...secondaryButtonStyle,
  minHeight: '40px',
  borderRadius: '8px',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
};

const SectionTitle = ({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) => (
  <div className="admin-dashboard-section-title">
    <span className="admin-dashboard-section-eyebrow">{eyebrow}</span>
    <h2>{title}</h2>
    <p>{description}</p>
  </div>
);

const OverviewMetric = ({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: number | string;
  helper: string;
  icon: ReactNode;
}) => (
  <article className="admin-dashboard-metric-card">
    <div className="admin-dashboard-metric-head">
      <span>{label}</span>
      <i>{icon}</i>
    </div>
    <strong>{value}</strong>
    <p>{helper}</p>
  </article>
);

const WorkbenchMetric = ({
  label,
  value,
  helper,
  tone,
  to,
}: {
  label: string;
  value: number | string;
  helper: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
  to: string;
}) => (
  <Link to={to} className={`admin-dashboard-workbench-metric admin-dashboard-workbench-metric-${tone}`}>
    <span>{label}</span>
    <strong>{value}</strong>
    <p>{helper}</p>
  </Link>
);

const SignalRow = ({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string;
  helper: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
}) => (
  <div className={`admin-dashboard-signal admin-dashboard-signal-${tone}`}>
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
    <p>{helper}</p>
  </div>
);

const RadarRow = ({
  label,
  value,
  helper,
  ratio,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  helper: string;
  ratio: number;
  tone?: 'neutral' | 'warning' | 'danger' | 'success';
}) => (
  <div className="admin-dashboard-radar-row">
    <div className="admin-dashboard-radar-copy">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{helper}</p>
    </div>
    <div className="admin-dashboard-radar-bar-shell">
      <div className={`admin-dashboard-radar-bar admin-dashboard-radar-bar-${tone}`} style={{ width: `${Math.max(12, Math.min(100, ratio))}%` }} />
    </div>
  </div>
);

const ProcessStep = ({
  order,
  title,
  description,
  value,
  to,
  icon,
  tone,
}: {
  order: string;
  title: string;
  description: string;
  value: string | number;
  to: string;
  icon: ReactNode;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
}) => (
  <Link to={to} className={`admin-dashboard-process-step admin-dashboard-process-step-${tone}`}>
    <span className="admin-dashboard-process-order">{order}</span>
    <i>{icon}</i>
    <strong>{title}</strong>
    <p>{description}</p>
    <b>{value}</b>
  </Link>
);

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
  const successAiCount = aiStats.find((item) => item.status === 'success')?.count ?? 0;
  const cancelledAiCount = aiStats.find((item) => item.status === 'cancelled')?.count ?? 0;
  const activeAiCount = processingAiCount + pendingAiCount;
  const auditCount = dashboard?.recent_audit_logs.length ?? 0;
  const userTotal = dashboard?.totals.users ?? 0;
  const childTotal = dashboard?.totals.children ?? 0;
  const recordTotal = dashboard?.totals.records ?? 0;
  const mediaTotal = dashboard?.totals.media ?? 0;
  const contentTotal = recordTotal + mediaTotal;
  const aiTotal = aiStats.reduce((sum, item) => sum + item.count, 0);
  const aiSuccessRate = aiTotal > 0 ? Math.round((successAiCount / aiTotal) * 100) : 0;
  const mediaRatio = contentTotal > 0 ? Math.round((mediaTotal / contentTotal) * 100) : 0;
  const familyCoverage = userTotal > 0 ? Math.min(100, Math.round((childTotal / userTotal) * 100)) : 0;
  const contentShare = contentTotal > 0 ? Math.round((recordTotal / contentTotal) * 100) : 0;
  const mediaShare = contentTotal > 0 ? Math.round((mediaTotal / contentTotal) * 100) : 0;
  const aiActiveShare = aiTotal > 0 ? Math.round((activeAiCount / aiTotal) * 100) : 0;
  const aiFailedShare = aiTotal > 0 ? Math.round((failedAiCount / aiTotal) * 100) : 0;
  const aiSuccessShare = aiTotal > 0 ? Math.round((successAiCount / aiTotal) * 100) : 0;

  const heroSummary = useMemo(() => {
    if (failedAiCount > 0) {
      return {
        badge: `${failedAiCount} 个 AI 失败任务`,
        title: '先修复生成链路，再谈内容效率。',
        description: '当前存在失败任务，会直接影响成长记录摘要、标签和报告产出。总览页先帮助值班人员判断风险，不再把注意力浪费在无关指标上。',
        primaryText: '处理 AI 任务',
        primaryTo: '/ai-jobs',
        secondaryText: '查看审计留痕',
        secondaryTo: '/audit-logs',
        tone: 'danger' as const,
      };
    }

    if (activeAiCount > 0) {
      return {
        badge: `${activeAiCount} 个任务处理中`,
        title: '队列在跑，盯住积压，不要盲目翻页。',
        description: '这时最重要的是确认 AI 队列没有长时间停滞，同时抽检内容和媒体状态，确保用户端可见信息完整。',
        primaryText: '查看 AI 队列',
        primaryTo: '/ai-jobs',
        secondaryText: '开始内容抽检',
        secondaryTo: '/records',
        tone: 'warning' as const,
      };
    }

    return {
      badge: '值班状态稳定',
      title: '今天先处理阻塞项。',
      description: 'AI、内容、媒体和审计集中到同一屏，值班人员先处理会影响用户体验的事项。',
      primaryText: '开始内容抽检',
      primaryTo: '/records',
      secondaryText: '查看审计留痕',
      secondaryTo: '/audit-logs',
      tone: 'success' as const,
    };
  }, [activeAiCount, failedAiCount]);

  const signalRows = useMemo(
    () => [
      {
        label: '家庭覆盖',
        value: loading ? '-' : `${userTotal} 位家长 / ${childTotal} 个孩子`,
        helper: '用来判断档案体量和家庭协作规模。',
        tone: 'neutral' as const,
      },
      {
        label: '内容压力',
        value: loading ? '-' : `${recordTotal} 条记录待持续抽检`,
        helper: '记录越多，越要优先检查标题、可见范围和发布状态。',
        tone: recordTotal > 20 ? ('warning' as const) : ('success' as const),
      },
      {
        label: '媒体结构',
        value: loading ? '-' : `${mediaRatio}% 内容带媒体`,
        helper: '媒体比重高时，要更关注访问失败、异常和下架动作。',
        tone: mediaRatio >= 50 ? ('warning' as const) : ('neutral' as const),
      },
    ],
    [childTotal, loading, mediaRatio, recordTotal, userTotal],
  );

  const workbenchMetrics = useMemo(
    () => [
      {
        label: '待处理 AI',
        value: loading ? '-' : activeAiCount,
        helper: activeAiCount > 0 ? '先确认队列是否停滞' : '队列稳定',
        tone: activeAiCount > 0 ? ('warning' as const) : ('success' as const),
        to: '/ai-jobs',
      },
      {
        label: '失败任务',
        value: loading ? '-' : failedAiCount,
        helper: failedAiCount > 0 ? '会影响摘要和报告产出' : '暂无失败链路',
        tone: failedAiCount > 0 ? ('danger' as const) : ('success' as const),
        to: '/ai-jobs',
      },
      {
        label: '媒体占比',
        value: loading ? '-' : `${mediaRatio}%`,
        helper: mediaRatio >= 50 ? '优先抽检图片和音视频' : '内容结构正常',
        tone: mediaRatio >= 50 ? ('warning' as const) : ('neutral' as const),
        to: '/media',
      },
      {
        label: '最近审计',
        value: loading ? '-' : auditCount,
        helper: auditCount > 0 ? '可追踪后台动作' : '建议先查询审计',
        tone: auditCount > 0 ? ('neutral' as const) : ('warning' as const),
        to: '/audit-logs',
      },
    ],
    [activeAiCount, auditCount, failedAiCount, loading, mediaRatio],
  );

  const processSteps = useMemo(
    () => [
      {
        order: '01',
        title: '看 AI 队列',
        description: activeAiCount > 0 || failedAiCount > 0 ? '先处理阻塞产出的任务，避免摘要和报告继续积压。' : '队列稳定，只需确认是否有新的失败任务。',
        value: loading ? '-' : activeAiCount + failedAiCount,
        to: '/ai-jobs',
        icon: <Bot size={18} />,
        tone: failedAiCount > 0 ? ('danger' as const) : activeAiCount > 0 ? ('warning' as const) : ('success' as const),
      },
      {
        order: '02',
        title: '审成长记录',
        description: '检查标题、正文、可见范围与发布状态，避免用户端出现半成品内容。',
        value: loading ? '-' : recordTotal,
        to: '/records',
        icon: <FileText size={18} />,
        tone: recordTotal >= 10 ? ('warning' as const) : ('neutral' as const),
      },
      {
        order: '03',
        title: '巡媒体素材',
        description: '优先看上传中、异常、未关联媒体，减少图片和音视频断链。',
        value: loading ? '-' : mediaTotal,
        to: '/media',
        icon: <Image size={18} />,
        tone: mediaRatio >= 50 ? ('warning' as const) : ('neutral' as const),
      },
      {
        order: '04',
        title: '复盘审计',
        description: '确认后台操作已经留痕，必要时回溯是谁在什么时间处理。',
        value: loading ? '-' : auditCount,
        to: '/audit-logs',
        icon: <ShieldCheck size={18} />,
        tone: auditCount > 0 ? ('success' as const) : ('neutral' as const),
      },
    ],
    [activeAiCount, auditCount, failedAiCount, loading, mediaRatio, mediaTotal, recordTotal],
  );

  return (
    <PageShell title="后台总览" description="给值班运营看的处理台：先看阻塞项，再进入用户、内容、媒体、AI 或审计。">
      {error ? <div className="admin-dashboard-error">{`加载失败：${error}`}</div> : null}

      <section className="admin-dashboard-hero-grid">
        <article className={`admin-dashboard-hero-card admin-dashboard-hero-${heroSummary.tone}`}>
          <div className="admin-dashboard-workbench">
            <div className="admin-dashboard-hero-status">
              <span className="admin-dashboard-chip">{heroSummary.badge}</span>
              <span className="admin-dashboard-hero-note">当前判断</span>
            </div>
            <div className="admin-dashboard-hero-body">
              <h2>值班工作台</h2>
              <p>{heroSummary.title} {heroSummary.description}</p>
            </div>
            <div className="admin-dashboard-workbench-metrics">
              {workbenchMetrics.map((item) => (
                <WorkbenchMetric key={item.label} {...item} />
              ))}
            </div>
            <div className="admin-dashboard-hero-actions">
              <Link to={heroSummary.primaryTo} style={{ ...dashboardButtonStyle, border: 'none', background: '#fff6ea', color: '#12322d' }}>
                {heroSummary.primaryText}
              </Link>
              <Link
                to={heroSummary.secondaryTo}
                style={{ ...dashboardButtonStyle, borderColor: 'rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.1)', color: '#f8fbf8' }}
              >
                {heroSummary.secondaryText}
              </Link>
            </div>
          </div>
        </article>

        <aside className="admin-dashboard-side-card">
          <SectionTitle eyebrow="今日优先级" title="今日处置顺序" description="按值班风险排序，不再把总览做成展示型页面。" />
          <div className="admin-dashboard-signals">
            {signalRows.map((item) => (
              <SignalRow key={item.label} {...item} />
            ))}
          </div>
        </aside>
      </section>

      <section className="admin-dashboard-metrics-grid">
        <OverviewMetric label="用户" value={loading ? '-' : userTotal} helper="重点关注冻结、异常注册、会员状态和家庭协作。" icon={<Users size={18} />} />
        <OverviewMetric label="孩子档案" value={loading ? '-' : childTotal} helper="用于判断档案完整度、归属关系和后续回访范围。" icon={<Database size={18} />} />
        <OverviewMetric label="内容资产" value={loading ? '-' : contentTotal} helper="成长记录和媒体素材的总量，是今天抽检工作的基本盘。" icon={<FileText size={18} />} />
        <OverviewMetric label="媒体素材" value={loading ? '-' : mediaTotal} helper="优先排查上传失败、断链和下架素材。" icon={<Image size={18} />} />
      </section>

      <section className="admin-dashboard-process-card">
        <SectionTitle eyebrow="处理路径" title="下一步去哪" description="按值班顺序给出四个入口，减少在后台页面之间来回找功能的成本。" />
        <div className="admin-dashboard-process-grid">
          {processSteps.map((item) => (
            <ProcessStep key={item.order} {...item} />
          ))}
        </div>
      </section>

      <section className="admin-dashboard-core-grid">
        <article className="admin-dashboard-radar-card">
          <SectionTitle eyebrow="运营雷达" title="值班判断" description="不是把数据堆满，而是把四个最需要理解的信号直接翻译成判断。" />
          <div className="admin-dashboard-radar-list">
            <RadarRow label="档案覆盖度" value={loading ? '-' : `${familyCoverage}%`} helper="孩子档案与家长规模的对应关系。" ratio={familyCoverage} tone="success" />
            <RadarRow
              label="内容抽检压力"
              value={loading ? '-' : `${recordTotal} 条`}
              helper="记录总量越大，人工抽检压力越高。"
              ratio={Math.min(100, recordTotal * 8)}
              tone={recordTotal >= 10 ? 'warning' : 'neutral'}
            />
            <RadarRow
              label="媒体占比"
              value={loading ? '-' : `${mediaRatio}%`}
              helper="媒体占比高时，要优先盯访问成功率和异常动作。"
              ratio={mediaRatio}
              tone={mediaRatio >= 50 ? 'warning' : 'neutral'}
            />
            <RadarRow
              label="AI 完成率"
              value={loading ? '-' : `${aiSuccessRate}%`}
              helper="完成率下降会直接影响摘要、标签和报告可用性。"
              ratio={aiTotal > 0 ? aiSuccessRate : 16}
              tone={failedAiCount > 0 ? 'danger' : activeAiCount > 0 ? 'warning' : 'success'}
            />
          </div>
        </article>

        <article className="admin-dashboard-ai-card">
          <SectionTitle eyebrow="AI 任务健康" title="链路状态" description="把会影响用户端输出的状态直接拉出来，方便快速确认是否需要介入。" />
          <div className="admin-dashboard-ai-summary">
            <strong>{loading ? '-' : `${aiSuccessRate}%`}</strong>
            <span>成功率</span>
          </div>
          <div className="admin-dashboard-ai-list">
            {aiStats.length ? (
              aiStats.map((item) => (
                <div key={item.status} className={`admin-dashboard-ai-row admin-dashboard-ai-row-${item.status}`}>
                  <span>
                    {item.status === 'failed' ? (
                      <AlertTriangle size={16} color="#bf3b2b" />
                    ) : item.status === 'processing' || item.status === 'pending' ? (
                      <Clock3 size={16} color="#9a5f1a" />
                    ) : (
                      <CheckCircle2 size={16} color="#0d7f56" />
                    )}
                    {aiJobStatusLabel(item.status)}
                  </span>
                  <strong>{item.count}</strong>
                </div>
              ))
            ) : (
              <EmptyState message={loading ? '加载中...' : '暂无 AI 任务统计。'} />
            )}
          </div>
          <div className="admin-dashboard-ai-foot">
            <div>
              <span>处理中与待处理</span>
              <strong>{loading ? '-' : activeAiCount}</strong>
            </div>
            <div>
              <span>已取消</span>
              <strong>{loading ? '-' : cancelledAiCount}</strong>
            </div>
          </div>
          <Link to="/ai-jobs" style={{ ...dashboardButtonStyle, width: '100%' }}>
            <Bot size={16} />
            进入 AI 任务列表
          </Link>
        </article>
      </section>

      <section className="admin-dashboard-actions-grid">
        <article className="admin-dashboard-charts-card">
          <SectionTitle eyebrow="运营分布" title="统计图" description="用结构分布替代动作卡，让总览页先展示体量、占比和风险落点。" />
          <div className="admin-dashboard-charts-grid">
            <section className="admin-dashboard-chart-panel">
              <div className="admin-dashboard-chart-head">
                <strong>内容结构</strong>
                <Link to="/records" className="admin-dashboard-chart-link">
                  查看内容
                  <ArrowUpRight size={14} />
                </Link>
              </div>
              <div className="admin-dashboard-chart-stack">
                <div className="admin-dashboard-chart-stack-bar">
                  <span className="admin-dashboard-chart-stack-segment admin-dashboard-chart-stack-records" style={{ width: `${Math.max(contentShare, contentTotal > 0 ? 18 : 0)}%` }} />
                  <span className="admin-dashboard-chart-stack-segment admin-dashboard-chart-stack-media" style={{ width: `${Math.max(mediaShare, contentTotal > 0 ? 18 : 0)}%` }} />
                </div>
                <div className="admin-dashboard-chart-legend">
                  <div>
                    <i className="admin-dashboard-chart-dot admin-dashboard-chart-dot-records" />
                    <span>成长记录</span>
                    <strong>{loading ? '-' : `${recordTotal} / ${contentShare}%`}</strong>
                  </div>
                  <div>
                    <i className="admin-dashboard-chart-dot admin-dashboard-chart-dot-media" />
                    <span>媒体素材</span>
                    <strong>{loading ? '-' : `${mediaTotal} / ${mediaShare}%`}</strong>
                  </div>
                </div>
              </div>
            </section>

            <section className="admin-dashboard-chart-panel">
              <div className="admin-dashboard-chart-head">
                <strong>AI 状态分布</strong>
                <Link to="/ai-jobs" className="admin-dashboard-chart-link">
                  查看队列
                  <ArrowUpRight size={14} />
                </Link>
              </div>
              <div className="admin-dashboard-chart-bars">
                <div className="admin-dashboard-chart-bar-row">
                  <div className="admin-dashboard-chart-bar-copy">
                    <span>成功</span>
                    <strong>{loading ? '-' : `${successAiCount} / ${aiSuccessShare}%`}</strong>
                  </div>
                  <div className="admin-dashboard-chart-bar-track">
                    <span className="admin-dashboard-chart-bar-fill admin-dashboard-chart-bar-success" style={{ width: `${Math.max(aiSuccessShare, aiTotal > 0 ? 10 : 0)}%` }} />
                  </div>
                </div>
                <div className="admin-dashboard-chart-bar-row">
                  <div className="admin-dashboard-chart-bar-copy">
                    <span>处理中</span>
                    <strong>{loading ? '-' : `${activeAiCount} / ${aiActiveShare}%`}</strong>
                  </div>
                  <div className="admin-dashboard-chart-bar-track">
                    <span className="admin-dashboard-chart-bar-fill admin-dashboard-chart-bar-warning" style={{ width: `${Math.max(aiActiveShare, aiTotal > 0 ? 10 : 0)}%` }} />
                  </div>
                </div>
                <div className="admin-dashboard-chart-bar-row">
                  <div className="admin-dashboard-chart-bar-copy">
                    <span>失败</span>
                    <strong>{loading ? '-' : `${failedAiCount} / ${aiFailedShare}%`}</strong>
                  </div>
                  <div className="admin-dashboard-chart-bar-track">
                    <span className="admin-dashboard-chart-bar-fill admin-dashboard-chart-bar-danger" style={{ width: `${Math.max(aiFailedShare, aiTotal > 0 ? 10 : 0)}%` }} />
                  </div>
                </div>
              </div>
            </section>

            <section className="admin-dashboard-chart-panel">
              <div className="admin-dashboard-chart-head">
                <strong>覆盖与留痕</strong>
                <Link to="/audit-logs" className="admin-dashboard-chart-link">
                  查看审计
                  <ArrowUpRight size={14} />
                </Link>
              </div>
              <div className="admin-dashboard-kpi-grid">
                <div>
                  <span>家庭覆盖</span>
                  <strong>{loading ? '-' : `${familyCoverage}%`}</strong>
                  <p>{loading ? '-' : `${userTotal} 位家长对应 ${childTotal} 个孩子`}</p>
                </div>
                <div>
                  <span>最近审计</span>
                  <strong>{loading ? '-' : auditCount}</strong>
                  <p>{auditCount > 0 ? '最近后台动作已有留痕。' : '当前暂无近期后台留痕。'}</p>
                </div>
              </div>
            </section>
          </div>
        </article>
      </section>

      <article className="admin-dashboard-audit-card">
        <div className="admin-dashboard-audit-head">
          <SectionTitle eyebrow="审计留痕" title="最近审计日志" description="用来确认后台关键动作是否按预期发生，也方便在处置后做复盘。" />
          <Link to="/audit-logs" style={dashboardButtonStyle}>
            <ShieldCheck size={16} />
            查看全部
          </Link>
        </div>
        {dashboard?.recent_audit_logs.length ? (
          <div className="admin-table-scroll" style={{ overflowX: 'auto' }}>
            <table className="admin-responsive-table admin-dashboard-audit-table" style={tableStyle}>
              <thead>
                <tr>
                  {['动作', '目标类型', '目标编号', 'IP 地址', '发生时间'].map((column) => (
                    <th key={column} style={{ ...thTdStyle, color: '#66736f', fontSize: '13px', background: '#f5f0e8' }}>
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dashboard.recent_audit_logs.map((item) => (
                  <tr key={`${item.action}-${item.created_at}`}>
                    <td data-label="动作" style={thTdStyle}>
                      {auditActionLabel(item.action)}
                    </td>
                    <td data-label="目标类型" style={thTdStyle}>
                      {auditTargetTypeLabel(item.target_type)}
                    </td>
                    <td data-label="目标编号" style={thTdStyle}>
                      {item.target_id ?? '-'}
                    </td>
                    <td data-label="IP 地址" style={thTdStyle}>
                      {item.ip_address ?? '-'}
                    </td>
                    <td data-label="发生时间" style={thTdStyle}>
                      {formatDateTime(item.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message={loading ? '加载中...' : '暂无审计日志。'} />
        )}
      </article>
    </PageShell>
  );
};
