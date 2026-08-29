import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Settings2 } from 'lucide-react';

import { adminApi, type AdminOpsReadinessResponse } from '../shared/request';
import { formatDateTime } from '../shared/format';
import { AdminButton, Badge, EmptyState, PageShell, Panel } from '../shared/ui';
import {mutedTextStyle} from '../shared/uiStyles';

const statusLabel = (status: 'ready' | 'warning' | 'blocked') => {
  if (status === 'ready') return '就绪';
  if (status === 'warning') return '需复核';
  return '阻塞';
};

const statusTone = (status: 'ready' | 'warning' | 'blocked') => {
  if (status === 'ready') return 'success';
  if (status === 'warning') return 'warning';
  return 'danger';
};

const reportStatusLabel = (status: AdminOpsReadinessResponse['release_gates']['report']['status']) => {
  if (status === 'passed') return '已通过';
  if (status === 'conditional_pass') return '条件通过';
  if (status === 'failed') return '未通过';
  if (status === 'stale') return '已过期';
  if (status === 'invalid') return '格式异常';
  return '未生成';
};

const reportStatusTone = (status: AdminOpsReadinessResponse['release_gates']['report']['status']) => {
  if (status === 'passed') return 'success';
  if (status === 'failed' || status === 'invalid') return 'danger';
  return 'warning';
};

const compactText = (value: string) => (value.length > 150 ? `${value.slice(0, 150)}...` : value);

const StatCard = ({ label, value, helper }: { label: string; value: number | string; helper: string }) => (
  <article className="admin-ops-stat-card">
  <span className="admin-ops-stat-label">{label}</span>
  <strong className="admin-ops-stat-num">{value}</strong>
    <p className="admin-text-muted">{helper}</p>
  </article>
);

const StatusRow = ({
  item,
}: {
  item:
    | AdminOpsReadinessResponse['providers'][number]
    | AdminOpsReadinessResponse['release_gates']['checks'][number];
}) => (
  <tr className="admin-ops-status-row">
    <td className="admin-ops-label-cell">
      <strong>{item.label}</strong>
    </td>
    <td>{item.value}</td>
    <td>
      <Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
    </td>
    <td>{item.helper}</td>
  </tr>
);

export const OpsReadinessPage = () => {
  const [readiness, setReadiness] = useState<AdminOpsReadinessResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const next = await adminApi.opsReadiness();
        if (active) setReadiness(next);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : '系统运维状态加载失败');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const stats = readiness?.data_statistics;

  return (
    <PageShell title="系统运维" description="集中查看运行配置、数据体量、待处理风险和上线验收门禁，支撑日常运维判断。">
      {error ? <EmptyState title="加载失败" message={error} /> : null}
      {loading ? <EmptyState title="正在加载" message="正在读取系统配置和运营统计。" /> : null}

      {readiness && stats ? (
        <>
          <div className="admin-ops-stat-grid admin-ops-stat-grid-auto">
            <StatCard label="家庭与档案" value={`${stats.families} / ${stats.children}`} helper="家庭数 / 孩子档案数，用于判断长期托管规模。" />
            <StatCard label="成长资产" value={`${stats.records} / ${stats.media}`} helper="记录数 / 媒体数，用于判断存储和审核压力。" />
            <StatCard label="运营待办" value={stats.pending_archive_export_requests + stats.open_support_tickets} helper="档案交付和客服反馈中仍需人工处理的数量。" />
            <StatCard label="内容风险" value={stats.content_risks} helper="敏感文本、异常媒体、儿童安全反馈和失败 AI 任务需要集中复核。" />
          </div>

          <Panel>
            <div className="admin-ops-panel-head">
              <div>
        <h2 className="admin-ops-section-title">运行配置</h2>
                <p style={mutedTextStyle}>环境：{readiness.environment.app_env}，端口：{readiness.environment.app_port}，检查时间：{formatDateTime(readiness.generated_at)}</p>
              </div>
              <Badge tone="info">运行状态</Badge>
            </div>
            <div className="admin-ops-table-scroll admin-ops-table-scroll-auto">
              <table className="admin-ops-readiness-table admin-ops-provider-table admin-data-table">
                <thead>
                  <tr>
                    <th>配置项</th>
                    <th>当前值</th>
                    <th>状态</th>
                    <th>运营判断</th>
                  </tr>
                </thead>
                <tbody>{readiness.providers.map((item) => <StatusRow key={item.key} item={item} />)}</tbody>
              </table>
            </div>
          </Panel>

          <Panel>
            <div className="admin-ops-panel-head">
              <div>
        <h2 className="admin-ops-section-title">上线验收门禁</h2>
                <p style={mutedTextStyle}>真实 AI 和地点 POI 必须以登录后的 live readiness 结果为准，不能只看 provider 名称。</p>
              </div>
              <Badge tone={statusTone(readiness.release_gates.status)}>线上复验{statusLabel(readiness.release_gates.status)}</Badge>
            </div>
            <div className="admin-ops-table-scroll admin-ops-table-scroll-auto">
              <table className="admin-ops-readiness-table admin-ops-release-table admin-data-table">
                <thead>
                  <tr>
                    <th>门禁项</th>
                    <th>证据</th>
                    <th>状态</th>
                    <th>运营判断</th>
                  </tr>
                </thead>
                <tbody>{readiness.release_gates.checks.map((item) => <StatusRow key={item.key} item={item} />)}</tbody>
              </table>
            </div>
          <div className="admin-ops-report-block">
              <div className="admin-ops-report-head">
                <div>
                <h3 className="admin-ops-report-title">复验报告</h3>
                  <p style={mutedTextStyle}>
                    {readiness.release_gates.report.path}，检查时间：{formatDateTime(readiness.release_gates.report.checked_at)}
                    {readiness.release_gates.report.age_hours === null ? '' : `，距现在 ${readiness.release_gates.report.age_hours} 小时`}
                  </p>
                </div>
                <Badge tone={reportStatusTone(readiness.release_gates.report.status)}>{reportStatusLabel(readiness.release_gates.report.status)}</Badge>
              </div>

              {readiness.release_gates.report.failures.length ? (
                <div className="admin-ops-report-list">
                  {readiness.release_gates.report.blocked_requirements.length ? (
                    <p className="admin-text-muted">
                      <strong className={readiness.release_gates.report.blocked_requirement_details.some((item) => item.severity === 'P0') ? 'admin-ops-sev-p0' : 'admin-ops-sev-p1'}>
                        {readiness.release_gates.report.blocked_requirement_details.some((item) => item.severity === 'P0') ? '阻塞验收项' : '延期验收项'}
                      </strong>
                      ：{readiness.release_gates.report.blocked_requirements.join('、')}
                    </p>
                  ) : null}
                  {readiness.release_gates.report.blocked_requirement_details.map((item) => (
                    <p key={item.requirement} style={{ ...mutedTextStyle, margin: 0 }}>
                      <strong className={item.severity === 'P0' ? 'admin-ops-sev-p0' : 'admin-ops-sev-p1'}>
                        {item.severity} / {item.requirement}
                      </strong>
                      ：{item.owner} 负责；证据为 {item.evidence}；下一步：{compactText(item.next_action)}
                    </p>
                  ))}
                  {readiness.release_gates.report.failures.map((failure) => (
                    <p key={`${failure.name}-${failure.error}`} style={{ ...mutedTextStyle, margin: 0 }}>
                      <strong className="admin-ops-sev-p0">{failure.name}</strong>：{compactText(failure.error)}
                    </p>
                  ))}
                </div>
              ) : null}

              {readiness.release_gates.report.next_actions.length ? (
                <div className="admin-ops-report-list">
                  {readiness.release_gates.report.next_actions.map((action) => (
                    <p key={action} style={{ ...mutedTextStyle, margin: 0 }}>
                      {action}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          </Panel>

          <Panel>
            <div className="admin-ops-panel-head">
              <div>
        <h2 className="admin-ops-section-title">技术入口</h2>
              </div>
              <div className="admin-ops-entry-actions">
                <Link to="/media" className="admin-button admin-button-secondary admin-technical-entry">技术媒体库</Link>
                <Link to="/content-risks" className="admin-button admin-button-secondary admin-technical-entry">风险队列</Link>
              </div>
            </div>
          </Panel>

          <Panel>
        <h2 className="admin-ops-section-title admin-ops-section-title-tight">运营动作</h2>
            <div className="admin-ops-action-list">
              {readiness.action_items.map((item) => (
                <Link
                  key={`${item.priority}-${item.label}`}
                  to={item.to}
                  className="admin-ops-action-link"
                >
                  <span className="admin-ops-action-label">
                    <Settings2 size={17} />
                    <span>{item.label}</span>
                  </span>
                  <span className="admin-ops-action-helper">{item.helper}</span>
                </Link>
              ))}
            </div>
          </Panel>
        </>
      ) : null}

      {!loading && !readiness && !error ? (
        <EmptyState title="暂无运维数据" message="系统暂未返回运维检查结果。">
          <AdminButton
            type="button"
            tone="secondary"
            onClick={() => {
              setLoading(true);
              setError(null);
              void adminApi
                .opsReadiness()
                .then(setReadiness)
                .catch((err) => setError(err instanceof Error ? err.message : '系统运维状态加载失败'))
                .finally(() => setLoading(false));
            }}
          >
            <RefreshCw size={16} />
            重新读取
          </AdminButton>
        </EmptyState>
      ) : null}
    </PageShell>
  );
};
