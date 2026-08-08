import { useEffect, useState, type FormEvent } from 'react';
import { Save, Settings2, ShieldCheck } from 'lucide-react';

import { adminApi, type AdminSystemConfigItem } from '../shared/request';
import { AdminButton, AdminDateInput, AdminSelect, Badge, EmptyState, PageShell, Panel } from '../shared/ui';
import { inputStyle, mutedTextStyle } from '../shared/uiStyles';
import { useAdminAuth } from '../shared/useAdminAuth';
import { TableShell } from './shared';

const formatDateTime = (value: string | null | undefined) => (value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—');

const categoryLabel = (value: AdminSystemConfigItem['category']) =>
  ({
    ai_provider: 'AI 服务',
    backup_recovery: '备份恢复',
    alerting: '告警值班',
    mobile_release: '版本更新',
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
  const configuredCount = visibleConfigs.filter((item) => displayValue(item) !== '未配置').length;
  const adminManagedCount = visibleConfigs.filter((item) => item.source === 'admin').length;

  const rows = visibleConfigs.map((item) => [
    <span key={`${item.config_key}-label`} className="admin-system-config-name">
      <strong>{item.label}</strong>
      <span>{item.description}</span>
    </span>,
    <span key={`${item.config_key}-status`} className="admin-system-config-status-cell">
      <Badge tone="info">{categoryLabel(item.category)}</Badge>
      <strong>{displayValue(item)}</strong>
      <small>
        <span>{item.source === 'admin' ? '后台配置' : '环境变量'}</span>
        <span> · {valueTypeLabel(item.value_type)}</span>
      </small>
    </span>,
    item.updated_by_name ? `${item.updated_by_name} / ${formatDateTime(item.updated_at)}` : '—',
    <AdminButton key={`${item.config_key}-action`} type="button" tone="secondary" disabled={!canEdit} onClick={() => startEdit(item)}>
      调整
    </AdminButton>,
  ]);

  return (
    <PageShell title="系统配置" description="维护备份恢复和告警值班等通用运维配置。AI 供应商、模型和 Key 请在「AI 设置」中集中管理。">
      {error ? <Panel><EmptyState title="操作失败" message={error} /></Panel> : null}
      {message ? <Panel><p style={{ ...mutedTextStyle, margin: 0 }}>{message}</p></Panel> : null}

      <section className="admin-system-config-hero">
        <div>
          <span className="admin-system-config-eyebrow">
            <Settings2 size={16} />
            配置工作台
          </span>
          <h2>只保留运维必须修改的配置。</h2>
          <p>备份、告警和值班参数集中在这里；AI 供应商相关内容继续放在 AI 设置，避免系统配置页变成杂项堆叠。</p>
        </div>
        <div className="admin-system-config-status">
          <div>
            <span>可见配置</span>
            <strong>{loading ? '—' : visibleConfigs.length}</strong>
          </div>
          <div>
            <span>已配置</span>
            <strong>{loading ? '—' : configuredCount}</strong>
          </div>
          <div>
            <span>后台接管</span>
            <strong>{loading ? '—' : adminManagedCount}</strong>
          </div>
        </div>
        <Badge tone={canEdit ? 'success' : 'warning'}>{canEdit ? '可调整' : '只读'}</Badge>
      </section>

      <section className="admin-system-config-grid">
        <div className="admin-system-config-list">
          <TableShell columns={['配置项', '当前状态', '最后调整', '操作']} rows={rows} emptyMessage="暂无系统配置项。" loading={loading} />
        </div>

        <Panel className="admin-system-config-editor">
          {editing ? (
          <form onSubmit={onSubmit} className="admin-system-config-form">
            <div className="admin-system-config-form-head">
              <span>
                <ShieldCheck size={16} />
                正在调整
              </span>
              <h2>{editing.label}</h2>
              <p>{editing.description}</p>
            </div>
            <label className="admin-system-config-field">
              <span>配置值</span>
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
                <small>
                  当前状态：{editing.secret_configured ? '已配置密钥' : '未配置密钥'}。保存时必须输入完整新密钥。
                </small>
              ) : null}
            </label>
            <label className="admin-system-config-field">
              <span>操作原因</span>
              <textarea
                style={{ ...inputStyle, minHeight: '92px', resize: 'vertical' }}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="写清楚为什么调整该配置，便于审计复盘"
                disabled={!canEdit || saving}
              />
            </label>
            <div className="admin-system-config-actions">
              <AdminButton type="submit" tone="primary" disabled={!canEdit || saving || reason.trim().length < 2 || (editing.value_type === 'secret' && !value.trim())}>
                <Save size={16} />
                {saving ? '保存中…' : '保存配置'}
              </AdminButton>
              <AdminButton type="button" tone="ghost" disabled={saving} onClick={() => setEditing(null)}>
                取消
              </AdminButton>
            </div>
          </form>
          ) : (
            <div className="admin-system-config-empty-editor">
              <Settings2 size={22} />
              <strong>选择一个配置项</strong>
              <p>点击列表中的“调整”，右侧会显示编辑区。未选择前保持页面干净，避免表格和表单同时抢焦点。</p>
            </div>
          )}
        </Panel>
      </section>
    </PageShell>
  );
};
