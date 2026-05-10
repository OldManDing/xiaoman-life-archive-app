import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Eye, Image, ImagePlus, Mic, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '../shared/AuthContext';
import { webApi } from '../shared/api/webApi';
import type { AiJobDetail, RecordDetail } from '../shared/api/types';
import { useAsyncData } from '../shared/hooks';
import { Field, PageShell, Panel, helperTextStyle, inputStyle, primaryButtonStyle, secondaryButtonStyle, textareaStyle } from '../shared/ui';
import { EmptyState, buttonRowStyle, formSubmitSpacingStyle, formatDateTimeLocal, mutedChipStyle, recordTypes, rowStyle } from './shared';

type MediaPreview = {
  media_no: string;
  preview_url: string;
  original_name?: string | null;
  is_local?: boolean;
};

const RecordForm = ({
  mode,
  initialValue,
  onSubmit,
}: {
  mode: 'create' | 'edit';
  initialValue: {
    child_no: string;
    record_type: string;
    title: string;
    content_text: string;
    media_nos: string[];
    media_items: MediaPreview[];
    tags: string;
    location_text: string;
    event_time: string;
    status: string;
  };
  onSubmit: (value: {
    child_no: string;
    record_type: string;
    title?: string;
    content_text?: string;
    media_nos?: string[];
    tags: string[];
    location_text?: string;
    event_time?: string;
    status: string;
  }) => Promise<void>;
}) => {
  const { activeChild, children } = useAuth();
  const [form, setForm] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mediaNos, setMediaNos] = useState<string[]>(initialValue.media_nos);
  const [mediaPreviews, setMediaPreviews] = useState<MediaPreview[]>(initialValue.media_items);
  const mediaPreviewsRef = useRef<MediaPreview[]>(initialValue.media_items);

  const currentChild = children.find((child) => child.child_no === form.child_no) ?? activeChild;

  useEffect(() => {
    setForm(initialValue);
    setMediaNos(initialValue.media_nos);
    setMediaPreviews(initialValue.media_items);
  }, [initialValue]);

  useEffect(() => {
    mediaPreviewsRef.current = mediaPreviews;
  }, [mediaPreviews]);

  useEffect(() => {
    return () => {
      mediaPreviewsRef.current.forEach((item) => {
        if (item.is_local) {
          URL.revokeObjectURL(item.preview_url);
        }
      });
    };
  }, []);

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !form.child_no) return;

    setUploading(true);
    setError(null);
    const previewUrl = URL.createObjectURL(file);
    try {
      const uploadToken = await webApi.createUploadToken({
        child_no: form.child_no,
        file_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        media_type: 'image',
      });

      await fetch(uploadToken.upload_url, {
        method: uploadToken.method,
        headers: uploadToken.headers,
        body: file,
      });

      await webApi.confirmUpload({ media_no: uploadToken.media_no });
      setMediaNos((current) => [...current, uploadToken.media_no]);
      setMediaPreviews((current) => [
        ...current,
        {
          media_no: uploadToken.media_no,
          preview_url: previewUrl,
          original_name: file.name,
          is_local: true,
        },
      ]);
    } catch (err) {
      URL.revokeObjectURL(previewUrl);
      setError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const removeMedia = (mediaNo: string) => {
    setMediaNos((current) => current.filter((item) => item !== mediaNo));
    setMediaPreviews((current) => {
      const removed = current.find((item) => item.media_no === mediaNo);
      if (removed?.is_local) {
        URL.revokeObjectURL(removed.preview_url);
      }
      return current.filter((item) => item.media_no !== mediaNo);
    });
  };

  const submitRecord = async (nextStatus = form.status) => {
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        child_no: form.child_no,
        record_type: form.record_type,
        title: form.title || undefined,
        content_text: form.content_text || undefined,
        media_nos: mediaNos,
        tags: form.tags
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        location_text: form.location_text || undefined,
        event_time: form.event_time ? new Date(form.event_time).toISOString() : undefined,
        status: nextStatus,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await submitRecord('published');
  };

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#ffffff',
        color: '#292524',
        padding: 'calc(34px + env(safe-area-inset-top)) 20px 20px',
        boxSizing: 'border-box',
      }}
    >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <button
            type="button"
            style={{
              border: 'none',
              background: 'transparent',
              color: '#78716c',
              fontSize: '15px',
              fontWeight: 500,
              cursor: 'pointer',
              padding: 0,
            }}
            onClick={() => window.history.back()}
          >
            取消
          </button>
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#44403c' }}>{mode === 'create' ? '记录时光' : '编辑记录'}</span>
          <button
            type="submit"
            form="record-form"
            style={{
              border: 'none',
              borderRadius: '999px',
              padding: '8px 18px',
              background: '#292524',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(41,37,36,0.18)',
            }}
            disabled={submitting || uploading}
          >
            {submitting ? '保存中…' : mode === 'create' ? '发布' : '保存'}
          </button>
        </div>
        <form id="record-form" onSubmit={handleSubmit} style={{ ...rowStyle, gap: '24px' }}>
          <div
            style={{
              borderRadius: '20px',
              padding: '14px 16px',
              background: '#fafaf9',
              border: '1px solid #e7e5e4',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              boxShadow: '0 2px 8px rgba(15,23,42,0.03)',
            }}
          >
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '999px',
                  background: '#fff',
                  border: '1px solid #e7e5e4',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#57534e',
                  fontWeight: 600,
                  boxShadow: '0 2px 6px rgba(15,23,42,0.03)',
                }}
              >
                {currentChild?.name?.slice(0, 1) ?? '宝'}
              </div>
              <div style={{ display: 'grid', gap: '2px' }}>
                <span style={{ fontSize: '15px', color: '#44403c', fontWeight: 600 }}>记录给：{currentChild?.name ?? '请选择孩子'}</span>
                <span style={{ fontSize: '12px', color: '#a8a29e' }}>可切换孩子归属与记录类型</span>
              </div>
            </div>
            <div style={{ display: 'grid', gap: '8px', minWidth: '120px' }}>
              <select style={{ ...inputStyle, padding: '10px 12px', borderRadius: '12px', background: '#fff' }} value={form.child_no} onChange={(event) => setForm((current) => ({ ...current, child_no: event.target.value }))}>
                <option value="">请选择孩子</option>
                {children.map((child) => (
                  <option key={child.child_no} value={child.child_no}>
                    {child.name}
                  </option>
                ))}
              </select>
              <select style={{ ...inputStyle, padding: '10px 12px', borderRadius: '12px', background: '#fff' }} value={form.record_type} onChange={(event) => setForm((current) => ({ ...current, record_type: event.target.value }))}>
                {recordTypes.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
            style={{
              minHeight: '120px',
              borderRadius: '20px',
              border: '1.5px dashed #d6d3d1',
              background: '#fafaf9',
              display: 'grid',
              placeItems: 'center',
              padding: '18px',
              gap: '10px',
              position: 'relative',
            }}
          >
            <span style={{ position: 'absolute', top: '10px', left: '14px', fontSize: '11px', color: '#a8a29e', fontWeight: 600, letterSpacing: '0.08em' }}>MEDIA</span>
            <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1px 1fr', alignItems: 'center', gap: '22px' }}>
              <label
                style={{
                  display: 'grid',
                  justifyItems: 'center',
                  gap: '10px',
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  opacity: uploading ? 0.65 : 1,
                }}
              >
                <span
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '999px',
                    background: '#fff',
                    border: '1px solid #e7e5e4',
                    display: 'grid',
                    placeItems: 'center',
                    color: '#78716c',
                    boxShadow: '0 2px 6px rgba(15,23,42,0.03)',
                  }}
                >
                  <ImagePlus size={21} strokeWidth={2} />
                </span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#78716c' }}>{uploading ? '上传中…' : '添加照片/视频'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => void onFileChange(event)}
                  disabled={uploading}
                  style={{ display: 'none' }}
                />
              </label>
              <span style={{ width: '1px', height: '58px', background: '#e7e5e4' }} />
              <button
                type="button"
                disabled
                style={{
                  display: 'grid',
                  justifyItems: 'center',
                  gap: '10px',
                  border: 'none',
                  background: 'transparent',
                  color: '#78716c',
                  opacity: 0.55,
                  cursor: 'not-allowed',
                }}
              >
                <span
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '999px',
                    background: '#fff',
                    border: '1px solid #e7e5e4',
                    display: 'grid',
                    placeItems: 'center',
                    boxShadow: '0 2px 6px rgba(15,23,42,0.03)',
                  }}
                >
                  <Mic size={21} strokeWidth={2} />
                </span>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>录制语音</span>
              </button>
            </div>
            {mediaPreviews.length ? (
              <div style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
                {mediaPreviews.map((media) => (
                  <div
                    key={media.media_no}
                    style={{
                      position: 'relative',
                      aspectRatio: '1 / 1',
                      borderRadius: '16px',
                      overflow: 'hidden',
                      border: '1px solid #e7e5e4',
                      background: '#ffffff',
                    }}
                  >
                    <img
                      src={media.preview_url}
                      alt={media.original_name ?? '已上传照片'}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                    <button
                      type="button"
                      aria-label="移除照片"
                      onClick={() => removeMedia(media.media_no)}
                      style={{
                        position: 'absolute',
                        top: '6px',
                        right: '6px',
                        width: '26px',
                        height: '26px',
                        borderRadius: '999px',
                        border: '1px solid rgba(255,255,255,0.7)',
                        background: 'rgba(41,37,36,0.72)',
                        color: '#fff',
                        display: 'grid',
                        placeItems: 'center',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      <X size={14} strokeWidth={2.4} />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div style={{ display: 'grid', gap: '18px' }}>
            <input
              style={{
                width: '100%',
                border: 'none',
                borderBottom: '1px solid #e7e5e4',
                padding: '0 0 12px',
                fontSize: '20px',
                fontWeight: 600,
                color: '#292524',
                outline: 'none',
                background: 'transparent',
                boxSizing: 'border-box',
              }}
              placeholder="给这一刻起个名字"
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            />
            <textarea
              style={{
                width: '100%',
                minHeight: '260px',
                border: 'none',
                outline: 'none',
                resize: 'vertical',
                background: 'transparent',
                padding: 0,
                fontSize: '16px',
                lineHeight: 1.8,
                color: '#44403c',
                boxSizing: 'border-box',
              }}
              placeholder="在想什么呢？记录一下这一刻发生的故事..."
              value={form.content_text}
              onChange={(event) => setForm((current) => ({ ...current, content_text: event.target.value }))}
            />
          </div>

          <div style={{ display: 'grid', gap: '16px' }}>
            <div style={{ borderRadius: '18px', border: '1px solid #f2efe9', background: '#fafaf9', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', gap: '14px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#57534e' }}>
                <Eye size={18} strokeWidth={2.2} />
                <span style={{ fontSize: '15px', fontWeight: 600 }}>可见范围</span>
              </div>
              <span style={{ color: '#57534e', fontSize: '14px', fontWeight: 600 }}>家庭成员可见 ›</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              <button type="button" style={{ ...mutedChipStyle, cursor: 'default' }}>
                时间：{form.event_time ? new Date(form.event_time).toLocaleString() : '未选择'}
              </button>
              <button type="button" style={{ ...mutedChipStyle, cursor: 'default' }}>
                地点：{form.location_text || '未填写'}
              </button>
              <button type="button" style={{ ...mutedChipStyle, cursor: 'default' }}>
                标签：{form.tags || '未填写'}
              </button>
            </div>

            <Field label="发生时间">
              <input style={inputStyle} type="datetime-local" value={form.event_time} onChange={(event) => setForm((current) => ({ ...current, event_time: event.target.value }))} />
            </Field>
            <Field label="地点">
              <input style={inputStyle} value={form.location_text} onChange={(event) => setForm((current) => ({ ...current, location_text: event.target.value }))} />
            </Field>
            <Field label="标签（逗号分隔）">
              <input style={inputStyle} value={form.tags} onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))} />
            </Field>
            <Field label="发布状态">
              <select style={inputStyle} value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                <option value="published">发布</option>
                <option value="draft">草稿</option>
              </select>
            </Field>
          </div>

          <div style={{ marginTop: '8px', paddingTop: '20px', borderTop: '1px solid #e7e5e4', display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: '14px', flex: 1 }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '999px',
                  background: form.record_type === 'milestone' ? '#fef3c7' : '#fafaf9',
                  border: form.record_type === 'milestone' ? '1px solid #fde68a' : '1px solid #e7e5e4',
                  display: 'grid',
                  placeItems: 'center',
                  color: form.record_type === 'milestone' ? '#d97706' : '#78716c',
                }}
              >
                ★
              </div>
              <div style={{ display: 'grid', gap: '4px', flex: 1 }}>
                <span style={{ fontSize: '16px', fontWeight: 600, color: '#292524' }}>标记为里程碑</span>
                <span style={{ fontSize: '13px', lineHeight: 1.6, color: '#78716c' }}>选择“里程碑”记录类型时，这条内容会以更高优先级出现在时间轴中。</span>
              </div>
            </div>
            <div
              style={{
                width: '48px',
                height: '26px',
                borderRadius: '999px',
                background: form.record_type === 'milestone' ? '#a16207' : '#d6d3d1',
                padding: '2px',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              onClick={() => setForm((current) => ({ ...current, record_type: current.record_type === 'milestone' ? 'mixed' : 'milestone' }))}
            >
              <div
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '999px',
                  background: '#fff',
                  transform: form.record_type === 'milestone' ? 'translateX(22px)' : 'translateX(0)',
                  transition: 'transform 0.2s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                }}
              />
            </div>
          </div>

          {mediaNos.length ? <p style={helperTextStyle}>已选择 {mediaNos.length} 个媒体，将随记录一起保存。</p> : null}
          {activeChild ? <p style={helperTextStyle}>当前默认孩子：{activeChild.name}</p> : null}
          {uploading ? <p style={helperTextStyle}>正在上传图片…</p> : null}
          {error ? <p style={{ ...helperTextStyle, color: '#dc2626' }}>{error}</p> : null}

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
            <button
              type="button"
              style={{
                borderRadius: '999px',
                border: '1px solid #e7e5e4',
                background: '#fff',
                color: '#78716c',
                fontSize: '14px',
                fontWeight: 600,
                padding: '10px 20px',
                cursor: 'pointer',
              }}
              onClick={() => {
                setForm((current) => ({ ...current, status: 'draft' }));
                void submitRecord('draft');
              }}
              disabled={submitting || uploading}
            >
              {submitting && form.status === 'draft' ? '保存中…' : '存为草稿'}
            </button>
          </div>
        </form>
    </div>
  );
};

export const CreateRecordPage = () => {
  const navigate = useNavigate();
  const { activeChild } = useAuth();

  return (
    <RecordForm
      mode="create"
      initialValue={{
        child_no: activeChild?.child_no ?? '',
        record_type: 'mixed',
        title: '',
        content_text: '',
        media_nos: [],
        media_items: [],
        tags: '',
        location_text: '',
        event_time: '',
        status: 'published',
      }}
      onSubmit={async (value) => {
        const record = await webApi.createRecord(value);
        navigate(`/record/${record.record_no}`);
      }}
    />
  );
};

export const ViewRecordPage = () => {
  const navigate = useNavigate();
  const params = useParams<{ record_no: string }>();
  const { data, loading, error, setData } = useAsyncData<RecordDetail | null>(
    async () => {
      if (!params.record_no) return null;
      return webApi.detailRecord(params.record_no);
    },
    [params.record_no],
  );
  const [aiJob, setAiJob] = useState<AiJobDetail | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!aiJob || !['pending', 'processing'].includes(aiJob.status)) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const next = await webApi.detailAiJob(aiJob.job_no);
        if (cancelled) return;
        setAiJob(next);
        if (next.status === 'success' && params.record_no) {
          const refreshed = await webApi.detailRecord(params.record_no);
          if (!cancelled) {
            setData(refreshed);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setAiError(err instanceof Error ? err.message : 'AI 状态查询失败');
        }
      }
    }, 1500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [aiJob, params.record_no, setData]);

  const onGenerateSummary = async () => {
    if (!data || !params.record_no) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await webApi.createAiJob(params.record_no, { job_types: ['record_summary'] });
      setAiJob(result.list[0] ?? null);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI 摘要生成失败');
    } finally {
      setAiLoading(false);
    }
  };

  const onDelete = async () => {
    if (!data) return;
    const confirmed = window.confirm('确认删除这条记录吗？删除后将从时间轴中移除。');
    if (!confirmed) return;

    setDeleting(true);
    setDeleteError(null);
    try {
      await webApi.deleteRecord(data.record_no);
      navigate('/timeline', { replace: true });
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <PageShell title="记录详情" description="查看完整记录内容，并可继续编辑。">
      <Panel>
        {loading ? <EmptyState message="正在加载记录详情…" /> : null}
        {error ? <EmptyState message={`加载失败：${error}`} /> : null}
        {data ? (
          <div style={rowStyle}>
            <strong>{data.title ?? '未命名记录'}</strong>
            <p style={helperTextStyle}>记录编号：{data.record_no}</p>
            <p style={helperTextStyle}>正文：{data.content_text ?? '暂无正文'}</p>
            <p style={helperTextStyle}>标签：{data.tags.join('、') || '暂无标签'}</p>
            <p style={helperTextStyle}>发生时间：{new Date(data.event_time).toLocaleString()}</p>
            <p style={helperTextStyle}>地点：{data.location_text ?? '未填写'}</p>
            <p style={helperTextStyle}>媒体数量：{data.media_list.length}</p>
            {data.media_list.length ? (
              <div style={{ display: 'grid', gap: '10px', paddingTop: '4px' }}>
                <strong>媒体</strong>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
                  {data.media_list.map((media) => (
                    <div
                      key={media.media_no}
                      style={{
                        borderRadius: '18px',
                        overflow: 'hidden',
                        border: '1px solid #e7e5e4',
                        background: '#fafaf9',
                        minHeight: '132px',
                      }}
                    >
                      {media.media_type === 'image' ? (
                        <img
                          src={media.access_url}
                          alt={media.original_name ?? '记录照片'}
                          style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', display: 'block' }}
                        />
                      ) : (
                        <div style={{ minHeight: '132px', display: 'grid', placeItems: 'center', color: '#78716c' }}>
                          <Image size={28} strokeWidth={1.8} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '12px', display: 'grid', gap: '8px' }}>
              <strong>AI 摘要</strong>
              <p style={helperTextStyle}>{data.ai_summary ?? '当前还没有 AI 生成的摘要。'}</p>
              {aiJob?.status === 'pending' || aiJob?.status === 'processing' ? <p style={helperTextStyle}>AI 正在处理中，请稍候…</p> : null}
              {aiJob?.status === 'success' ? <p style={{ ...helperTextStyle, color: '#0f766e' }}>AI 摘要已生成并同步到记录详情。</p> : null}
              {aiJob?.status === 'failed' ? <p style={{ ...helperTextStyle, color: '#dc2626' }}>AI 处理失败：{aiJob.error_message ?? '未知错误'}</p> : null}
              {aiError ? <p style={{ ...helperTextStyle, color: '#dc2626' }}>{aiError}</p> : null}
              {deleteError ? <p style={{ ...helperTextStyle, color: '#dc2626' }}>{deleteError}</p> : null}
            </div>
            <div style={buttonRowStyle}>
              <button style={secondaryButtonStyle} onClick={() => void onGenerateSummary()} disabled={aiLoading || aiJob?.status === 'pending' || aiJob?.status === 'processing'}>
                {aiLoading || aiJob?.status === 'pending' || aiJob?.status === 'processing' ? 'AI 生成中…' : '生成 AI 摘要'}
              </button>
              <button style={secondaryButtonStyle} onClick={() => void onDelete()} disabled={deleting}>
                {deleting ? '删除中…' : '删除记录'}
              </button>
              <button style={primaryButtonStyle} onClick={() => navigate(`/record/${data.record_no}/edit`)}>
                编辑记录
              </button>
              <button style={secondaryButtonStyle} onClick={() => navigate('/timeline')}>
                返回时间轴
              </button>
            </div>
          </div>
        ) : null}
      </Panel>
    </PageShell>
  );
};

export const EditRecordPage = () => {
  const navigate = useNavigate();
  const params = useParams<{ record_no: string }>();
  const { data, loading, error } = useAsyncData<RecordDetail | null>(
    async () => {
      if (!params.record_no) return null;
      return webApi.detailRecord(params.record_no);
    },
    [params.record_no],
  );

  if (loading) {
    return (
      <PageShell title="编辑记录" description="正在加载记录详情。">
        <Panel>
          <EmptyState message="加载中…" />
        </Panel>
      </PageShell>
    );
  }

  if (error || !data) {
    return (
      <PageShell title="编辑记录" description="记录加载失败。">
        <Panel>
          <EmptyState message={error ?? '记录不存在'} />
        </Panel>
      </PageShell>
    );
  }

  return (
    <RecordForm
      mode="edit"
      initialValue={{
        child_no: data.child_no,
        record_type: data.record_type,
        title: data.title ?? '',
        content_text: data.content_text ?? '',
        media_nos: data.media_list.map((item) => item.media_no),
        media_items: data.media_list.map((item) => ({
          media_no: item.media_no,
          preview_url: item.access_url,
          original_name: item.original_name,
        })),
        tags: data.tags.join(', '),
        location_text: data.location_text ?? '',
        event_time: formatDateTimeLocal(data.event_time),
        status: data.status,
      }}
      onSubmit={async (value) => {
        if (!params.record_no) return;
        const record = await webApi.updateRecord(params.record_no, value);
        navigate(`/record/${record.record_no}`);
      }}
    />
  );
};
