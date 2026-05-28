const fallbackLabel = (value: string | number | null | undefined, labels: Record<string, string>) => {
  if (value === null || value === undefined || value === '') return '—';
  return labels[String(value)] ?? String(value);
};

export const adminRoleLabel = (value: string | null | undefined) =>
  fallbackLabel(value, {
    super_admin: '超级管理员',
    admin: '管理员',
    operator: '运营人员',
    auditor: '审核人员',
    viewer: '只读账号',
  });

export const membershipTypeLabel = (value: string | null | undefined) =>
  fallbackLabel(value, {
    free: '基础会员',
    family_member: '家庭会员',
    ai_plus: 'AI 增强会员',
  });

export const userStatusLabel = (value: string | null | undefined) =>
  fallbackLabel(value, {
    active: '正常',
    disabled: '已冻结',
  });

export const familyStatusLabel = (value: string | null | undefined) =>
  fallbackLabel(value, {
    active: '正常',
    disabled: '已停用',
    deleted: '已删除',
  });

export const inviteStatusLabel = (value: string | null | undefined) =>
  fallbackLabel(value, {
    pending: '待使用',
    accepted: '已使用',
    revoked: '已撤销',
    expired: '已过期',
  });

export const authTypeLabel = (value: string | null | undefined) =>
  fallbackLabel(value, {
    password: '账号密码',
    mobile: '手机号',
    email: '邮箱',
    wechat: '微信',
  });

export const familyRoleLabel = (value: string | null | undefined) =>
  fallbackLabel(value, {
    owner: '家庭拥有者',
    editor: '可编辑成员',
    viewer: '只读成员',
  });

export const childStatusLabel = (value: string | null | undefined) =>
  fallbackLabel(value, {
    normal: '正常',
    archived: '已归档',
    disabled: '已停用',
    deleted: '已删除',
  });

export const genderLabel = (value: string | null | undefined) =>
  fallbackLabel(value, {
    female: '女',
    male: '男',
    unknown: '未知',
  });

export const recordTypeLabel = (value: string | null | undefined) =>
  fallbackLabel(value, {
    image: '图片记录',
    video: '视频记录',
    audio: '音频记录',
    mixed: '图文记录',
    text: '文字记录',
    milestone: '里程碑',
  });

export const visibilityScopeLabel = (value: string | null | undefined) =>
  fallbackLabel(value, {
    family: '家庭可见',
    private: '仅自己可见',
    public: '公开可见',
  });

export const recordStatusLabel = (value: string | null | undefined) =>
  fallbackLabel(value, {
    draft: '草稿',
    published: '已发布',
    archived: '已归档',
  });

export const mediaTypeLabel = (value: string | null | undefined) =>
  fallbackLabel(value, {
    image: '图片',
    video: '视频',
    audio: '音频',
    file: '文件',
  });

export const mediaStatusLabel = (value: string | null | undefined) =>
  fallbackLabel(value, {
    uploading: '上传中',
    ready: '可用',
    failed: '异常',
    removed: '已下架',
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
    record_summary: '内容摘要',
    record_tags: '标签生成',
    monthly_report: '月报生成',
  });

export const aiProviderLabel = (value: string | null | undefined) =>
  fallbackLabel(value, {
    mock: '本地模拟服务',
    openai: 'OpenAI 服务',
    'openai-compatible': '兼容 OpenAI 的 AI 服务',
  });

export const archiveExportPurposeLabel = (value: string | null | undefined) =>
  fallbackLabel(value, {
    backup: '档案打包',
    adult_handoff: '成年移交',
  });

export const archiveExportTypeLabel = (value: string | null | undefined) =>
  fallbackLabel(value, {
    all: '全部数据',
    media: '仅媒体',
    text: '仅文字',
  });

export const archiveExportStatusLabel = (value: string | null | undefined) =>
  fallbackLabel(value, {
    submitted: '待处理',
    processing: '处理中',
    completed: '已完成',
    rejected: '已驳回',
  });

export const supportTicketStatusLabel = (value: string | null | undefined) =>
  fallbackLabel(value, {
    submitted: '待处理',
    processing: '处理中',
    resolved: '已解决',
    closed: '已关闭',
  });

export const supportTicketPriorityLabel = (value: string | null | undefined) =>
  fallbackLabel(value, {
    normal: '普通',
    urgent: '紧急',
    child_safety: '儿童安全',
  });

export const auditActorTypeLabel = (value: string | null | undefined) =>
  fallbackLabel(value, {
    admin: '后台账号',
    user: '用户',
    system: '系统',
  });

export const auditActionLabel = (value: string | null | undefined) =>
  fallbackLabel(value, {
    admin_login: '后台登录',
    admin_view_dashboard: '查看总览',
    admin_view_ops_readiness: '查看系统运维就绪',
    admin_view_user_detail: '查看用户详情',
    admin_view_family_detail: '查看家庭详情',
    admin_view_child_detail: '查看孩子详情',
    admin_view_record_detail: '查看记录详情',
    admin_view_media_detail: '查看媒体详情',
    admin_view_ai_job_detail: '查看 AI 任务详情',
    admin_list_users: '查询用户',
    admin_list_families: '查询家庭',
    admin_list_registration_invites: '查询注册邀请码',
    admin_create_registration_invite: '生成注册邀请码',
    admin_revoke_registration_invite: '撤销注册邀请码',
    admin_reset_user_password: '重置用户密码',
    admin_list_children: '查询孩子档案',
    admin_list_records: '查询记录',
    admin_list_media: '查询媒体',
    admin_list_ai_jobs: '查询 AI 任务',
    admin_list_content_risks: '查询内容风险',
    admin_list_support_tickets: '查询客服反馈',
    admin_list_archive_export_requests: '查询档案交付申请',
    admin_list_system_configs: '查询系统配置',
    admin_list_audit_logs: '查询审计日志',
    admin_update_system_config: '调整系统配置',
    admin_update_user_membership: '调整用户套餐权益',
    admin_disable_user: '冻结用户',
    admin_activate_user: '解冻用户',
    admin_unpublish_record: '下架记录',
    admin_restore_record: '恢复记录',
    admin_approve_media: '通过媒体审核',
    admin_reject_media: '标记媒体异常',
    admin_remove_media: '下架媒体',
    admin_retry_ai_job: '重试 AI 任务',
    admin_cancel_ai_job: '取消 AI 任务',
    admin_support_ticket_start_processing: '受理客服反馈',
    admin_support_ticket_resolve: '解决客服反馈',
    admin_support_ticket_close: '关闭客服反馈',
    admin_archive_export_start_processing: '受理档案交付',
    admin_archive_export_complete: '完成档案交付',
    admin_archive_export_reject: '驳回档案交付',
    'user.feedback_submitted': '用户提交客服反馈',
    'user.archive_export_requested': '用户申请档案打包',
    'user.adult_handoff_requested': '用户申请成年移交',
    'seed.initialized': '初始化演示数据',
  });

export const auditTargetTypeLabel = (value: string | null | undefined) =>
  fallbackLabel(value, {
    list: '列表',
    admin_user: '后台账号',
    user: '用户',
    child: '孩子档案',
    family: '家庭',
    record: '成长记录',
    media: '媒体',
    ai_job: 'AI 任务',
    content_risk: '内容风险',
    system: '系统运维',
    system_config: '系统配置',
    support_ticket: '客服反馈',
    archive_export_request: '档案交付申请',
    audit_log: '审计日志',
    registration_invite: '注册邀请码',
  });
