import type { CSSProperties, ReactNode } from 'react';

import { Panel } from '../shared/ui';

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 40,
  background: 'rgba(11, 18, 17, 0.42)',
  display: 'flex',
  justifyContent: 'flex-end',
};

const drawerStyle: CSSProperties = {
  width: 'min(780px, 100vw)',
  height: '100%',
  overflow: 'auto',
  background: '#f5f8f7',
  padding: '18px',
  display: 'grid',
  gap: '14px',
};

const sectionStyle: CSSProperties = {
  display: 'grid',
  gap: '10px',
};

const labelValueGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '10px',
};

const itemStyle: CSSProperties = {
  border: '1px solid #d6dedb',
  borderRadius: '8px',
  background: '#ffffff',
  padding: '12px',
  display: 'grid',
  gap: '4px',
};

const labelStyle: CSSProperties = {
  color: '#66736f',
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: 0,
};

const valueStyle: CSSProperties = {
  color: '#16211f',
  fontSize: '14px',
  lineHeight: 1.65,
  wordBreak: 'break-word',
};

const sectionHeadingStyle: CSSProperties = {
  fontSize: '15px',
  fontWeight: 800,
  color: '#16211f',
  margin: 0,
};

const jsonKeyLabels: Record<string, string> = {
  action: '动作',
  after_status: '变更后状态',
  before_status: '变更前状态',
  child_no: '孩子编号',
  content_text: '正文',
  error_message: '错误信息',
  existing_tags: '已有标签',
  input_snapshot: '输入快照',
  job_no: '任务编号',
  media_no: '媒体编号',
  output_json: '输出结果',
  reason: '操作原因',
  record_no: '记录编号',
  requested_status: '请求状态',
  retry_count: '重试次数',
  source: '来源',
  status: '状态',
  summary: '摘要',
  suggested_title: '建议标题',
  tags: '标签',
  target_id: '目标编号',
  target_type: '目标类型',
  title: '标题',
  user_no: '用户编号',
};

const localizeJsonValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(localizeJsonValue);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      jsonKeyLabels[key] ?? key,
      localizeJsonValue(item),
    ]),
  );
};

export const DetailDrawer = ({
  open,
  title,
  subtitle,
  loading,
  error,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  children: ReactNode;
}) => {
  if (!open) return null;

  return (
    <div className="admin-drawer-overlay" style={overlayStyle} onClick={onClose} role="presentation">
      <div
        className="admin-detail-drawer"
        style={drawerStyle}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <Panel>
          <div className="admin-drawer-header" style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
            <div style={{ display: 'grid', gap: '4px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', color: '#123c37' }}>{title}</h2>
              {subtitle ? <p style={{ margin: 0, color: '#66736f', fontSize: '13px', lineHeight: 1.6 }}>{subtitle}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                border: '1px solid #cbd5d1',
                background: '#fff',
                color: '#123c37',
                borderRadius: '8px',
                padding: '8px 12px',
                fontWeight: 700,
                cursor: 'pointer',
                minHeight: '44px',
              }}
            >
              关闭
            </button>
          </div>
        </Panel>

        {loading ? <Panel><p style={{ margin: 0, color: '#66736f' }}>加载中…</p></Panel> : null}
        {error ? <Panel><p style={{ margin: 0, color: '#b91c1c', fontWeight: 700 }}>{error}</p></Panel> : null}
        {!loading && !error ? children : null}
      </div>
    </div>
  );
};

export const DetailSection = ({ title, children }: { title: string; children: ReactNode }) => (
  <Panel>
    <section style={sectionStyle}>
      <h3 style={sectionHeadingStyle}>{title}</h3>
      {children}
    </section>
  </Panel>
);

export const DetailGrid = ({ items }: { items: Array<{ label: string; value: ReactNode }> }) => (
  <dl className="admin-detail-grid" style={labelValueGridStyle}>
    {items.map((item) => (
      <div key={item.label} style={itemStyle}>
        <dt style={labelStyle}>{item.label}</dt>
        <dd style={{ ...valueStyle, margin: 0 }}>{item.value ?? '—'}</dd>
      </div>
    ))}
  </dl>
);

export const DetailList = ({ items }: { items: Array<{ label: string; value: ReactNode }> }) => (
  <div style={{ display: 'grid', gap: '8px' }}>
    {items.map((item) => (
      <div key={item.label} style={itemStyle}>
        <div style={labelStyle}>{item.label}</div>
        <div style={{ ...valueStyle, whiteSpace: 'pre-wrap' }}>{item.value ?? '—'}</div>
      </div>
    ))}
  </div>
);

export const JsonBlock = ({ value }: { value: unknown }) => (
  <pre
    style={{
      margin: 0,
      padding: '12px',
      borderRadius: '8px',
      background: '#0f1720',
      color: '#d1fae5',
      fontSize: '12px',
      lineHeight: 1.6,
      overflowX: 'auto',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    }}
  >
    {JSON.stringify(localizeJsonValue(value ?? null), null, 2)}
  </pre>
);

export const MediaPreview = ({ src, alt }: { src: string | null; alt: string }) =>
  src ? (
    <img
      src={src}
      alt={alt}
      style={{
        width: '100%',
        maxHeight: '280px',
        objectFit: 'cover',
        borderRadius: '8px',
        border: '1px solid #d6dedb',
        background: '#fff',
      }}
    />
  ) : (
    <div
      style={{
        borderRadius: '8px',
        border: '1px dashed #cbd5d1',
        padding: '18px',
        color: '#66736f',
        background: '#fff',
      }}
    >
      暂无预览
    </div>
  );
