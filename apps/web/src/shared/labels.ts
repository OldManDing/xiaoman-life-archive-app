const fallbackLabel = (value: string | number | null | undefined, labels: Record<string, string>) => {
  if (value === null || value === undefined || value === '') return '—';
  return labels[String(value)] ?? String(value);
};

export const membershipTypeLabel = (value: string | null | undefined) =>
  fallbackLabel(value, {
    free: '基础会员',
    family_member: '家庭会员',
    ai_plus: 'AI 增强会员',
    premium: '高级会员',
    family: '家庭会员',
  });

export const familyRoleLabel = (value: string | null | undefined) =>
  fallbackLabel(value, {
    owner: '管理员',
    editor: '可编辑成员',
    viewer: '只读成员',
  });

export const familyMemberStatusLabel = (value: number | string | null | undefined) =>
  fallbackLabel(value, {
    0: '已停用',
    1: '正常',
  });

export const genderLabel = (value: string | null | undefined) =>
  fallbackLabel(value, {
    female: '女',
    male: '男',
    unknown: '未知',
  });

export const childStatusLabel = (value: string | null | undefined) =>
  fallbackLabel(value, {
    normal: '正常',
    archived: '已归档',
    disabled: '已停用',
    deleted: '已删除',
  });

export const recordTypeLabel = (value: string | null | undefined, isMilestone = false) => {
  if (isMilestone) return '里程碑档案';
  return fallbackLabel(value, {
    image: '图片记录',
    video: '视频记录',
    audio: '音频记录',
    mixed: '图文档案',
    text: '文字档案',
    milestone: '里程碑档案',
  });
};

export const recordStatusLabel = (value: string | null | undefined) =>
  fallbackLabel(value, {
    draft: '草稿',
    published: '已发布',
    archived: '已归档',
  });

export const visibilityScopeLabel = (value: string | null | undefined) =>
  fallbackLabel(value, {
    family: '家庭可见',
    private: '仅自己可见',
    public: '公开可见',
  });

export const mediaTypeLabel = (value: string | null | undefined) =>
  fallbackLabel(value, {
    image: '图片',
    video: '视频',
    audio: '音频',
    file: '文件',
  });

export const aiJobStatusLabel = (value: string | null | undefined) =>
  fallbackLabel(value, {
    pending: '等待处理',
    processing: '处理中',
    success: '已完成',
    failed: '失败',
    cancelled: '已取消',
    skipped: '已跳过',
  });

export const aiJobTypeLabel = (value: string | null | undefined) =>
  fallbackLabel(value, {
    record_title: '标题生成',
    record_summary: '记录摘要',
    record_tags: '标签生成',
    monthly_report: '月报生成',
  });
