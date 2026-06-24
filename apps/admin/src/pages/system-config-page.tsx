import { useEffect, useState, type FormEvent } from 'react';
import { Save, Settings2 } from 'lucide-react';

import { adminApi, type AdminSystemConfigItem } from '../shared/request';
import { AdminDateInput, AdminSelect, Badge, EmptyState, PageShell, Panel } from '../shared/ui';
import { inputStyle, mutedTextStyle, primaryButtonStyle, secondaryButtonStyle } from '../shared/uiStyles';
import { useAdminAuth } from '../shared/useAdminAuth';
import { TableShell } from './shared';

const formatDateTime = (value: string | null | undefined) => (value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—');

const categoryLabel = (value: AdminSystemConfigItem['category']) =>
  ({
    ai_provider: 'AI 服务',
    backup_recovery: '备份恢复',
    alerting: '告警值班',
  })[value];

const valueTypeLabel = (value: AdminSystemConfigItem['value_type']) =>
  ({
    number: '数字',
    url: '链接',
    datetime: '时间',
    text: '文本',
    secret: '密钥',
    select: '选项',
  })[value];

const toEditableValue = (item: AdminSystemConfigItem) => {
  if (item.value_type === 'secret') return '';
  if (item.value_type === 'datetime' && item.value) {
    return item.value.slice(0, 16);
  }
  return item.value;
};

const displayValue = (item: AdminSystemConfigItem) => {
  const value = item.display_value ?? item.value;
  return value ? value : '未配置';
};

export const SystemConfigPage = () => {
  const { admin } = useAdminAuth();
  const [configs, setConfigs] = useState<AdminSystemConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminSystemConfigItem | null>(null);
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const canEdit = admin?.role === 'super_admin' || admin?.role === 'operator';

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await adminApi.listSystemConfigs();
        if (active) setConfigs(result.list);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : '系统配置加载失败');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const startEdit = (item: AdminSystemConfigItem) => {
    setEditing(item);
    setValue(toEditableValue(item));
    setReason('');
    setError(null);
    setMessage(null);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await adminApi.updateSystemConfig(editing.config_key, { value, reason });
      setConfigs((current) => current.map((item) => (item.config_key === updated.config_key ? updated : item)));
      setEditing(updated);
      setValue(toEditableValue(updated));
      setReason('');
      setMessage(`已更新${updated.label}，后台和运行中服务会优先使用新的配置。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '系统配置保存失败');
    } finally {
      setSaving(false);
    }
  };

  const visibleConfigs = configs.filter((item) => item.category !== 'ai_provider');

  const rows = visibleConfigs.map((item) => [
    <span key={`${item.config_key}-label`} style={{ display: 'grid', gap: '5px' }}>
      <strong style={{ color: '#16211f' }}>{item.label}</strong>
      <span style={{ color: '#66736f', fontSize: '12px' }}>{item.description}</span>
    </span>,
    <Badge key={`${item.config_key}-category`} tone="info">{categoryLabel(item.category)}</Badge>,
    displayValue(item),
    <Badge key={`${item.config_key}-source`} tone={item.source === 'admin' ? 'success' : 'warning'}>{item.source === 'admin' ? '后台配置' : '环境变量'}</Badge>,
    valueTypeLabel(item.value_type),
    item.updated_by_name ? `${item.updated_by_name} / ${formatDateTime(item.updated_at)}` : '—',
    <button key={`${item.config_key}-action`} type="button" style={secondaryButtonStyle} disabled={!canEdit} onClick={() => startEdit(item)}>
      调整
    </button>,
  ]);

  return (
    <PageShell title="系统配置" description="维护备份恢复和告警值班等通用运维配置。AI 供应商、模型和 Key 请在「AI 设置」中集中管理。">
      {error ? <Panel><EmptyState title="操作失败" message={error} /></Panel> : null}
      {message ? <Panel><p style={{ ...mutedTextStyle, margin: 0 }}>{message}</p></Panel> : null}

      <Panel>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#16211f', fontWeight: 800 }}>
            <Settings2 size={17} />
            当前配置
          </span>
          <Badge tone={canEdit ? 'success' : 'warning'}>{canEdit ? '可调整' : '只读'}</Badge>
        </div>
      </Panel>

      <TableShell columns={['配置项', '分类', '当前值', '来源', '类型', '最后调整', '操作']} rows={rows} emptyMessage="暂无系统配置项。" loading={loading} />

      {editing ? (
        <Panel>
          <form onSubmit={onSubmit} style={{ display: 'grid', gap: '12px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', color: '#16211f' }}>调整{editing.label}</h2>
              <p style={mutedTextStyle}>{editing.description}</p>
            </div>
            <label style={{ display: 'grid', gap: '6px', color: '#33413d', fontWeight: 700 }}>
              配置值
              {editing.value_type === 'select' ? (
                <AdminSelect
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  disabled={!canEdit || saving}
                >
                  {(editing.options ?? []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </AdminSelect>
              ) : editing.value_type === 'datetime' ? (
                <AdminDateInput
                  type="datetime-local"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  disabled={!canEdit || saving}
                />
              ) : (
                <input
                  style={inputStyle}
                  type={editing.value_type === 'number' ? 'number' : editing.value_type === 'secret' ? 'password' : 'text'}
                  min={editing.value_type === 'number' ? 1 : undefined}
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  placeholder={editing.value_type === 'secret' ? '输入新的密钥，保存后不再回显' : undefined}
                  autoComplete={editing.value_type === 'secret' ? 'new-password' : undefined}
                  disabled={!canEdit || saving}
                />
              )}
              {editing.value_type === 'secret' ? (
                <span style={{ color: '#66736f', fontSize: '12px', fontWeight: 600 }}>
                  当前状态：{editing.secret_configured ? '已配置密钥' : '未配置密钥'}。保存时必须输入完整新密钥。
                </span>
              ) : null}
            </label>
            <label style={{ display: 'grid', gap: '6px', color: '#33413d', fontWeight: 700 }}>
              操作原因
              <textarea
                style={{ ...inputStyle, minHeight: '92px', resize: 'vertical' }}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="写清楚为什么调整该配置，便于审计复盘"
                disabled={!canEdit || saving}
              />
            </label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button type="submit" style={primaryButtonStyle} disabled={!canEdit || saving || reason.trim().length < 2 || (editing.value_type === 'secret' && !value.trim())}>
                <Save size={16} />
                {saving ? '保存中…' : '保存配置'}
              </button>
              <button type="button" style={secondaryButtonStyle} disabled={saving} onClick={() => setEditing(null)}>
                取消
              </button>
            </div>
          </form>
        </Panel>
      ) : null}
    </PageShell>
  );
};
