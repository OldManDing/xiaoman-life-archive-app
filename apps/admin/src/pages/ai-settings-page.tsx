import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Bot, CheckCircle2, FlaskConical, KeyRound, Save, ShieldCheck, XCircle } from 'lucide-react';

import { adminApi, type AdminAiSettingsTestResponse, type AdminSystemConfigItem } from '../shared/request';
import { AdminSelect, Badge, EmptyState, PageShell, Panel } from '../shared/ui';
import { inputStyle, mutedTextStyle, primaryButtonStyle, secondaryButtonStyle } from '../shared/uiStyles';
import { useAdminAuth } from '../shared/useAdminAuth';

const AI_CONFIG_KEYS = [
  'ai_provider',
  'ai_base_url',
  'ai_model',
  'ai_api_key',
  'ai_timeout_ms',
  'ai_daily_limit_per_user',
] as const;

type AiConfigKey = (typeof AI_CONFIG_KEYS)[number];

type AiSettingsForm = {
  provider: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  timeoutMs: string;
  dailyLimitPerUser: string;
  reason: string;
};

const providerLabel: Record<string, string> = {
  'openai-compatible': 'OpenAI 兼容服务',
  openai: 'OpenAI 服务',
  mock: '本地模拟服务',
};

const getConfig = (configs: AdminSystemConfigItem[], key: AiConfigKey) => configs.find((item) => item.config_key === key);

const editableValue = (item: AdminSystemConfigItem | undefined) => {
  if (!item || item.value_type === 'secret') return '';
  return item.value;
};

const buildForm = (configs: AdminSystemConfigItem[]): AiSettingsForm => ({
  provider: editableValue(getConfig(configs, 'ai_provider')) || 'openai-compatible',
  baseUrl: editableValue(getConfig(configs, 'ai_base_url')),
  model: editableValue(getConfig(configs, 'ai_model')),
  apiKey: '',
  timeoutMs: editableValue(getConfig(configs, 'ai_timeout_ms')) || '30000',
  dailyLimitPerUser: editableValue(getConfig(configs, 'ai_daily_limit_per_user')) || '20',
  reason: '',
});

const sourceLabel = (source: AdminSystemConfigItem['source'] | undefined) => (source === 'admin' ? '后台配置' : '环境变量');

const formatDateTime = (value: string | null | undefined) => (value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-');

const isPositiveIntegerInRange = (value: string, min: number, max: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max;
};

const isHttpUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const ConfigSignal = ({
  label,
  value,
  helper,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  helper: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}) => (
  <article className={`admin-ai-settings-signal admin-ai-settings-signal-${tone}`}>
    <span>{label}</span>
    <strong>{value}</strong>
    <p>{helper}</p>
  </article>
);

const Field = ({
  label,
  helper,
  required = false,
  children,
}: {
  label: string;
  helper?: string;
  required?: boolean;
  children: ReactNode;
}) => (
  <label className="admin-ai-settings-field">
    <span className="admin-ai-settings-field-label">
      {label}
      {required ? <em>必填</em> : null}
    </span>
    {children}
    {helper ? <small>{helper}</small> : null}
  </label>
);

export const AiSettingsPage = () => {
  const { admin } = useAdminAuth();
  const canEdit = admin?.role === 'super_admin' || admin?.role === 'operator';
  const [configs, setConfigs] = useState<AdminSystemConfigItem[]>([]);
  const [form, setForm] = useState<AiSettingsForm>(() => buildForm([]));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<AdminAiSettingsTestResponse | null>(null);

  const aiConfigs = useMemo(
    () => AI_CONFIG_KEYS.map((key) => getConfig(configs, key)).filter((item): item is AdminSystemConfigItem => Boolean(item)),
    [configs],
  );
  const keyConfig = getConfig(configs, 'ai_api_key');
  const providerConfig = getConfig(configs, 'ai_provider');
  const baseUrlConfig = getConfig(configs, 'ai_base_url');
  const modelConfig = getConfig(configs, 'ai_model');
  const timeoutConfig = getConfig(configs, 'ai_timeout_ms');
  const dailyLimitConfig = getConfig(configs, 'ai_daily_limit_per_user');
  const hasSecret = Boolean(keyConfig?.secret_configured);

  const currentForm = useMemo(() => buildForm(configs), [configs]);
  const updates = useMemo(() => {
    const next: Array<{ key: AiConfigKey; value: string }> = [];
    if (form.provider !== currentForm.provider) next.push({ key: 'ai_provider', value: form.provider });
    if (form.baseUrl.trim() !== currentForm.baseUrl) next.push({ key: 'ai_base_url', value: form.baseUrl.trim() });
    if (form.model.trim() !== currentForm.model) next.push({ key: 'ai_model', value: form.model.trim() });
    if (form.timeoutMs.trim() !== currentForm.timeoutMs) next.push({ key: 'ai_timeout_ms', value: form.timeoutMs.trim() });
    if (form.dailyLimitPerUser.trim() !== currentForm.dailyLimitPerUser) {
      next.push({ key: 'ai_daily_limit_per_user', value: form.dailyLimitPerUser.trim() });
    }
    if (form.apiKey.trim()) next.push({ key: 'ai_api_key', value: form.apiKey.trim() });
    return next;
  }, [currentForm, form]);
  const hasChanges = updates.length > 0;

  const patchForm = (key: keyof AiSettingsForm) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setMessage(null);
    setError(null);
    setFormError(null);
    setTestResult(null);
  };

  const openEditor = () => {
    setForm(buildForm(configs));
    setFormError(null);
    setError(null);
    setMessage(null);
    setTestResult(null);
    setIsEditing(true);
  };

  const closeEditor = () => {
    if (saving) return;
    setForm(buildForm(configs));
    setFormError(null);
    setIsEditing(false);
  };

  useEffect(() => {
    let active = true;

    const loadInitial = async () => {
      try {
        const result = await adminApi.listSystemConfigs();
        if (!active) return;
        const nextConfigs = result.list.filter((item) => AI_CONFIG_KEYS.includes(item.config_key as AiConfigKey));
        setConfigs(nextConfigs);
        setForm(buildForm(nextConfigs));
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'AI 设置加载失败');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadInitial();

    return () => {
      active = false;
    };
  }, []);

  const validateForm = () => {
    if (!hasChanges) return '没有需要保存的修改';
    if (form.reason.trim().length < 2) return '请填写至少 2 个字的操作原因';
    if (form.provider !== 'mock') {
      if (!form.baseUrl.trim() || !isHttpUrl(form.baseUrl.trim())) return 'AI 接口地址必须是有效的 http 或 https 地址';
      if (!form.model.trim()) return '请填写 AI 模型名称';
      if (!hasSecret && !form.apiKey.trim()) return '当前没有可用 API Key，请填写新的 Key';
    }
    if (!isPositiveIntegerInRange(form.timeoutMs.trim(), 1000, 120000)) return '超时时间必须是 1000 到 120000 之间的整数';
    if (!isPositiveIntegerInRange(form.dailyLimitPerUser.trim(), 1, 1000)) return '每日额度必须是 1 到 1000 之间的整数';
    return null;
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    setFormError(null);
    setMessage(null);
    setTestResult(null);
    try {
      const saved = await adminApi.updateAiSettings({
        provider: form.provider as 'openai-compatible' | 'openai' | 'mock',
        base_url: form.baseUrl.trim(),
        model: form.model.trim(),
        api_key: form.apiKey.trim() || undefined,
        timeout_ms: Number(form.timeoutMs.trim()),
        daily_limit_per_user: Number(form.dailyLimitPerUser.trim()),
        reason: form.reason.trim(),
      });
      const nextConfigs = configs.map((item) => saved.list.find((updated) => updated.config_key === item.config_key) ?? item);
      setConfigs(nextConfigs);
      setForm(buildForm(nextConfigs));
      setIsEditing(false);
      setMessage('AI 服务设置已保存。新的配置会被后台和运行中服务优先使用，请继续执行连接测试。');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'AI 设置保存失败，请刷新后确认是否有部分配置已保存');
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    if (hasChanges) {
      setError('当前有未保存修改，请先保存后再测试连接');
      return;
    }

    setTesting(true);
    setError(null);
    setMessage(null);
    try {
      const result = await adminApi.testAiSettings();
      setTestResult(result);
      setMessage(result.status === 'success' ? 'AI 服务连接测试通过' : `AI 服务连接测试未通过：${result.message}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 服务连接测试失败');
    } finally {
      setTesting(false);
    }
  };

  return (
    <PageShell title="AI 服务设置" description="集中管理 AI 供应商、接口地址、模型、API Key、超时和额度。密钥只允许覆盖保存，不会明文回显。">
      {error ? (
        <Panel>
          <EmptyState title="操作未完成" message={error} />
        </Panel>
      ) : null}

      {message ? (
        <Panel>
          {testResult ? (
            <div className={`admin-ai-settings-inline-result admin-ai-settings-inline-result-${testResult.status}`}>
              {testResult.status === 'success' ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
              <div>
                <strong>{testResult.status === 'success' ? '连接成功' : '连接失败'}</strong>
                <p>{testResult.message}</p>
                <span>
                  {testResult.provider} / {testResult.model ?? '-'} / {testResult.latency_ms}ms
                </span>
              </div>
            </div>
          ) : (
            <p style={{ ...mutedTextStyle, margin: 0 }}>{message}</p>
          )}
        </Panel>
      ) : null}

      <section className="admin-ai-settings-grid">
        <Panel>
          <div className="admin-ai-settings-hero">
            <div>
              <span className="admin-ai-settings-eyebrow">
                <Bot size={15} />
                当前 AI 通道
              </span>
              <h2>{providerLabel[form.provider] ?? form.provider}</h2>
              <p>这里管理的是实际运行时读取的 AI 配置。后台保存后，服务会优先使用数据库配置，未覆盖的字段继续使用环境变量。</p>
            </div>
            <div className="admin-ai-settings-status">
              <Badge tone={canEdit ? 'success' : 'warning'}>{canEdit ? '可编辑' : '只读'}</Badge>
              <Badge tone={hasSecret ? 'success' : 'danger'}>{hasSecret ? 'Key 已配置' : 'Key 未配置'}</Badge>
            </div>
          </div>
        </Panel>

        <div className="admin-ai-settings-signals">
          <ConfigSignal
            label="供应商"
            value={providerLabel[editableValue(providerConfig)] ?? (editableValue(providerConfig) || '-')}
            helper={`来源：${sourceLabel(providerConfig?.source)}`}
            tone={providerConfig?.source === 'admin' ? 'success' : 'neutral'}
          />
          <ConfigSignal
            label="模型"
            value={editableValue(modelConfig) || '-'}
            helper={`来源：${sourceLabel(modelConfig?.source)}`}
            tone={modelConfig?.source === 'admin' ? 'success' : 'neutral'}
          />
          <ConfigSignal
            label="API Key"
            value={hasSecret ? '已配置' : '未配置'}
            helper="密钥不会回显，只能覆盖保存"
            tone={hasSecret ? 'success' : 'danger'}
          />
          <ConfigSignal
            label="最近调整"
            value={formatDateTime(aiConfigs.find((item) => item.source === 'admin')?.updated_at)}
            helper="所有保存动作都会写入审计日志"
            tone="neutral"
          />
        </div>
      </section>

      <Panel>
        <div className="admin-ai-settings-form">
          <div className="admin-ai-settings-form-head">
            <div>
              <h2>运行配置</h2>
              <p>这里只展示当前已保存配置。修改供应商、模型或 Key 时会进入弹框，并要求填写必填项和操作原因。</p>
            </div>
            <Badge tone="success">配置已同步</Badge>
          </div>

          <div className="admin-ai-settings-readonly-grid">
            <ConfigSignal
              label="接口地址"
              value={editableValue(baseUrlConfig) || '-'}
              helper={`来源：${sourceLabel(baseUrlConfig?.source)}`}
              tone={baseUrlConfig?.source === 'admin' ? 'success' : 'neutral'}
            />
            <ConfigSignal
              label="请求超时"
              value={`${editableValue(timeoutConfig) || '30000'} ms`}
              helper={`来源：${sourceLabel(timeoutConfig?.source)}`}
              tone={timeoutConfig?.source === 'admin' ? 'success' : 'neutral'}
            />
            <ConfigSignal
              label="每日额度"
              value={editableValue(dailyLimitConfig) || '20'}
              helper={`来源：${sourceLabel(dailyLimitConfig?.source)}`}
              tone={dailyLimitConfig?.source === 'admin' ? 'success' : 'neutral'}
            />
          </div>

          <div className="admin-ai-settings-actions">
            <button type="button" style={primaryButtonStyle} disabled={!canEdit || loading} onClick={openEditor}>
              <Save size={16} />
              修改 AI 设置
            </button>
            <button type="button" style={secondaryButtonStyle} disabled={!canEdit || saving || testing || isEditing || loading} onClick={testConnection}>
              <FlaskConical size={16} />
              {testing ? '测试中...' : '测试连接'}
            </button>
          </div>
        </div>
      </Panel>

      <section className="admin-ai-settings-bottom-grid">
        <Panel>
          <div className="admin-ai-settings-test-card">
            <div>
              <span className="admin-ai-settings-eyebrow">
                <FlaskConical size={15} />
                连接测试
              </span>
              <h2>测试当前已保存配置</h2>
              <p>测试会让后端按当前运行时配置发起一次轻量 Chat Completions 调用，不会把 API Key 写入日志或返回给前端。</p>
            </div>
            {testResult ? (
              <div className={`admin-ai-settings-test-result admin-ai-settings-test-result-${testResult.status}`}>
                {testResult.status === 'success' ? <CheckCircle2 size={22} /> : <XCircle size={22} />}
                <div>
                  <strong>{testResult.status === 'success' ? '连接成功' : '连接失败'}</strong>
                  <p>{testResult.message}</p>
                  <span>
                    {testResult.provider} / {testResult.model ?? '-'} / {testResult.latency_ms}ms
                  </span>
                </div>
              </div>
            ) : (
              <EmptyState title="尚未测试" message={hasChanges ? '当前存在未保存修改，请先保存后再测试。' : '保存配置后点击“测试连接”确认供应商、模型和 Key 可用。'} />
            )}
          </div>
        </Panel>

        <Panel>
          <div className="admin-ai-settings-safety">
            <span className="admin-ai-settings-eyebrow">
              <ShieldCheck size={15} />
              安全边界
            </span>
            <ul>
              <li>
                <KeyRound size={16} />
                <span>API Key 不回显，保存时只允许覆盖。</span>
              </li>
              <li>
                <ShieldCheck size={16} />
                <span>只有超级管理员和运营人员可以修改或测试。</span>
              </li>
              <li>
                <Bot size={16} />
                <span>运行时优先读取后台配置，未覆盖字段继续使用环境变量。</span>
              </li>
            </ul>
          </div>
        </Panel>
      </section>

      {isEditing ? (
        <div className="admin-modal-overlay" role="presentation">
          <section className="admin-modal admin-ai-settings-modal" role="dialog" aria-modal="true" aria-labelledby="admin-ai-settings-dialog-title">
            <form className="admin-ai-settings-form" onSubmit={onSubmit}>
              <div className="admin-modal-header">
                <div>
                  <span>AI 服务管理</span>
                  <h2 id="admin-ai-settings-dialog-title">修改 AI 设置</h2>
                  <p className="admin-ai-settings-dialog-copy">带“必填”的字段保存前必须完整填写；API Key 留空会保留当前密钥。</p>
                </div>
                <button type="button" className="admin-modal-close" onClick={closeEditor} aria-label="关闭 AI 设置弹窗">
                  ×
                </button>
              </div>

              <div className="admin-ai-settings-required-note">
                <span>*</span>
                所有必填项都会在保存前校验，操作原因会写入审计日志。
              </div>

              <div className="admin-ai-settings-fields">
                <Field label="AI 供应商" required>
                  <AdminSelect aria-label="AI 供应商" value={form.provider} onChange={patchForm('provider')} disabled={!canEdit || saving} required>
                    <option value="openai-compatible">OpenAI 兼容服务</option>
                    <option value="openai">OpenAI 服务</option>
                    <option value="mock">本地模拟服务</option>
                  </AdminSelect>
                </Field>
                <Field label="接口地址" helper={`当前来源：${sourceLabel(baseUrlConfig?.source)}`} required={form.provider !== 'mock'}>
                  <input
                    aria-label="接口地址"
                    aria-required={form.provider !== 'mock'}
                    required={form.provider !== 'mock'}
                    style={inputStyle}
                    value={form.baseUrl}
                    onChange={patchForm('baseUrl')}
                    placeholder="https://api.example.com/v1"
                    disabled={!canEdit || saving}
                  />
                </Field>
                <Field label="模型名称" helper={`当前来源：${sourceLabel(modelConfig?.source)}`} required={form.provider !== 'mock'}>
                  <input
                    aria-label="模型名称"
                    aria-required={form.provider !== 'mock'}
                    required={form.provider !== 'mock'}
                    style={inputStyle}
                    value={form.model}
                    onChange={patchForm('model')}
                    placeholder="gpt-5-mini"
                    disabled={!canEdit || saving}
                  />
                </Field>
                <Field label="API Key" helper={hasSecret ? '留空表示保留当前密钥；填写后会覆盖保存。' : '当前未配置 Key，请填写完整密钥。'} required={!hasSecret && form.provider !== 'mock'}>
                  <input
                    style={inputStyle}
                    aria-label="API Key"
                    aria-required={!hasSecret && form.provider !== 'mock'}
                    required={!hasSecret && form.provider !== 'mock'}
                    type="password"
                    value={form.apiKey}
                    onChange={patchForm('apiKey')}
                    placeholder={hasSecret ? '留空保留当前密钥' : '请输入 API Key'}
                    autoComplete="new-password"
                    disabled={!canEdit || saving}
                  />
                </Field>
                <Field label="请求超时（毫秒）" helper={`当前来源：${sourceLabel(timeoutConfig?.source)}`} required>
                  <input
                    aria-label="请求超时（毫秒）"
                    aria-required="true"
                    required
                    style={inputStyle}
                    type="number"
                    min={1000}
                    max={120000}
                    value={form.timeoutMs}
                    onChange={patchForm('timeoutMs')}
                    disabled={!canEdit || saving}
                  />
                </Field>
                <Field label="单用户每日 AI 上限" helper={`当前来源：${sourceLabel(dailyLimitConfig?.source)}`} required>
                  <input
                    style={inputStyle}
                    aria-label="单用户每日 AI 上限"
                    aria-required="true"
                    required
                    type="number"
                    min={1}
                    max={1000}
                    value={form.dailyLimitPerUser}
                    onChange={patchForm('dailyLimitPerUser')}
                    disabled={!canEdit || saving}
                  />
                </Field>
              </div>

              <Field label="操作原因" helper="会写入审计日志，便于之后追踪是谁因为什么调整了 AI 服务。" required>
                <textarea
                  style={{ ...inputStyle, minHeight: '86px', resize: 'vertical' }}
                  aria-label="操作原因"
                  aria-required="true"
                  required
                  value={form.reason}
                  onChange={patchForm('reason')}
                  placeholder="例如：切换供应商或更新过期 Key"
                  disabled={!canEdit || saving}
                />
              </Field>

              {formError ? <p className="admin-modal-error">{formError}</p> : null}

              <div className="admin-modal-actions">
                <button type="button" style={secondaryButtonStyle} disabled={saving} onClick={closeEditor}>
                  取消
                </button>
                <button type="submit" style={primaryButtonStyle} disabled={!canEdit || saving || !hasChanges}>
                  <Save size={16} />
                  {saving ? '保存中...' : '保存 AI 设置'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </PageShell>
  );
};
