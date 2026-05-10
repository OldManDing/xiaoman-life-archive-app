import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { adminApi, type AdminDashboardResponse } from '../shared/request';
import { aiJobStatusLabel, auditActionLabel, auditTargetTypeLabel } from '../shared/labels';
import { Badge, EmptyState, PageShell, Panel } from '../shared/ui';
import { cardStyle, secondaryButtonStyle, tableStyle, thTdStyle } from '../shared/uiStyles';

const moduleCards = [
  {
    title: '用户运营',
    description: '用户检索、详情查看、状态冻结/解冻和会员状态查看。',
    status: '已接入操作',
    to: '/users',
  },
  {
    title: '孩子档案',
    description: '孩子资料、家庭归属、家庭成员和最近记录查询。',
    status: '已接入详情',
    to: '/children',
  },
  {
    title: '成长记录',
    description: '记录内容、媒体、AI 摘要、发布状态和下架/恢复操作。',
    status: '已接入审核',
    to: '/records',
  },
  {
    title: '媒体管理',
    description: '媒体预览、归属关系、上传者信息和审核操作。',
    status: '已接入审核',
    to: '/media',
  },
  {
    title: 'AI 任务',
    description: '异步任务详情、失败原因、输出结果和重试/取消操作。',
    status: '已接入操作',
    to: '/ai-jobs',
  },
  {
    title: '审计日志',
    description: '后台关键行为、目标对象、来源信息和高级筛选。',
    status: '超级管理员可见',
    to: '/audit-logs',
  },
];

const StatCard = ({ label, value, tone }: { label: string; value: number | string; tone: 'success' | 'warning' | 'info' | 'neutral' }) => (
  <div style={{ ...cardStyle, display: 'grid', gap: '10px' }}>
    <Badge tone={tone}>{label}</Badge>
    <strong style={{ fontSize: '30px', color: '#123c37', lineHeight: 1 }}>{value}</strong>
  </div>
);

const formatDateTime = (value: string | null | undefined) => (value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—');

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

  return (
    <PageShell title="后台总览" description="集中展示当前运营数据、关键模块入口和最近后台行为。">
      {error ? <Panel><EmptyState message={`加载失败：${error}`} /></Panel> : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
        <StatCard label="用户数" value={loading ? '—' : dashboard?.totals.users ?? 0} tone="success" />
        <StatCard label="孩子数" value={loading ? '—' : dashboard?.totals.children ?? 0} tone="success" />
        <StatCard label="记录数" value={loading ? '—' : dashboard?.totals.records ?? 0} tone="info" />
        <StatCard label="媒体数" value={loading ? '—' : dashboard?.totals.media ?? 0} tone="info" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
        {moduleCards.map((item) => (
          <Link
            key={item.title}
            to={item.to}
            style={{
              ...cardStyle,
              display: 'grid',
              gap: '10px',
              color: '#16211f',
              textDecoration: 'none',
              minHeight: '150px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
              <strong>{item.title}</strong>
              <Badge tone={item.status.includes('已接入') ? 'success' : 'info'}>{item.status}</Badge>
            </div>
            <span style={{ color: '#66736f', fontSize: '14px', lineHeight: 1.7 }}>{item.description}</span>
            <span style={{ marginTop: 'auto', color: '#123c37', fontSize: '13px', fontWeight: 800 }}>进入模块</span>
          </Link>
        ))}
      </div>

      <Panel>
        <div style={{ display: 'grid', gap: '14px' }}>
          <h2 style={{ margin: 0, fontSize: '16px', color: '#16211f' }}>AI 任务状态分布</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
            {(dashboard?.ai_job_status_distribution ?? []).map((item) => (
              <div key={item.status} style={{ border: '1px solid #dbe3df', borderRadius: '8px', padding: '12px', background: '#f6f8f7' }}>
                <div style={{ color: '#66736f', fontSize: '12px', fontWeight: 800 }}>{aiJobStatusLabel(item.status)}</div>
                <strong style={{ display: 'block', marginTop: '6px', color: '#123c37', fontSize: '24px' }}>{item.count}</strong>
              </div>
            ))}
            {!dashboard?.ai_job_status_distribution.length ? <EmptyState message={loading ? '加载中…' : '暂无 AI 任务统计。'} /> : null}
          </div>
        </div>
      </Panel>

      <Panel>
        <div style={{ display: 'grid', gap: '14px' }}>
          <h2 style={{ margin: 0, fontSize: '16px', color: '#16211f' }}>最近审计日志</h2>
          {dashboard?.recent_audit_logs.length ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
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
                      <td style={thTdStyle}>{auditActionLabel(item.action)}</td>
                      <td style={thTdStyle}>{auditTargetTypeLabel(item.target_type)}</td>
                      <td style={thTdStyle}>{item.target_id ?? '—'}</td>
                      <td style={thTdStyle}>{item.ip_address ?? '—'}</td>
                      <td style={thTdStyle}>{formatDateTime(item.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message={loading ? '加载中…' : '暂无审计日志。'} />
          )}
          <Link to="/audit-logs" style={{ ...secondaryButtonStyle, display: 'inline-flex', width: 'fit-content', textDecoration: 'none' }}>
            查看审计日志
          </Link>
        </div>
      </Panel>
    </PageShell>
  );
};
