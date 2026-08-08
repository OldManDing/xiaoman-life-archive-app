import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { App } from './App';
import { clearAccessTokenMemory } from '../shared/authMemory';

vi.mock('../shared/request', () => ({
  adminApi: {
    login: vi.fn(),
    dashboard: vi.fn(),
    opsReadiness: vi.fn(),
    listSystemConfigs: vi.fn(),
    updateSystemConfig: vi.fn(),
    updateAiSettings: vi.fn(),
    testAiSettings: vi.fn(),
    listUsers: vi.fn(),
    listFamilies: vi.fn(),
    getFamilyDetail: vi.fn(),
    listInvites: vi.fn(),
    createInvite: vi.fn(),
    revokeInvite: vi.fn(),
    updateUserStatus: vi.fn(),
    resetUserPassword: vi.fn(),
    updateUserMembership: vi.fn(),
    getUserDetail: vi.fn(),
    listChildren: vi.fn(),
    getChildDetail: vi.fn(),
    listRecords: vi.fn(),
    getRecordDetail: vi.fn(),
    updateRecordStatus: vi.fn(),
    listMedia: vi.fn(),
    getMediaDetail: vi.fn(),
    updateMediaStatus: vi.fn(),
    listAiJobs: vi.fn(),
    getAiJobDetail: vi.fn(),
    retryAiJob: vi.fn(),
    cancelAiJob: vi.fn(),
    listContentRisks: vi.fn(),
    listNotifications: vi.fn(),
    listSupportTickets: vi.fn(),
    updateSupportTicketStatus: vi.fn(),
    listArchiveExportRequests: vi.fn(),
    updateArchiveExportRequestStatus: vi.fn(),
    listAuditLogs: vi.fn(),
  },
}));

import { adminApi } from '../shared/request';

const loginMock = vi.mocked(adminApi.login);
const dashboardMock = vi.mocked(adminApi.dashboard);
const opsReadinessMock = vi.mocked(adminApi.opsReadiness);
const listSystemConfigsMock = vi.mocked(adminApi.listSystemConfigs);
const updateSystemConfigMock = vi.mocked(adminApi.updateSystemConfig);
const updateAiSettingsMock = vi.mocked(adminApi.updateAiSettings);
const testAiSettingsMock = vi.mocked(adminApi.testAiSettings);
const listUsersMock = vi.mocked(adminApi.listUsers);
const listFamiliesMock = vi.mocked(adminApi.listFamilies);
const getFamilyDetailMock = vi.mocked(adminApi.getFamilyDetail);
const listRecordsMock = vi.mocked(adminApi.listRecords);
const getRecordDetailMock = vi.mocked(adminApi.getRecordDetail);
const listInvitesMock = vi.mocked(adminApi.listInvites);
const createInviteMock = vi.mocked(adminApi.createInvite);
const resetUserPasswordMock = vi.mocked(adminApi.resetUserPassword);
const updateUserMembershipMock = vi.mocked(adminApi.updateUserMembership);
const listContentRisksMock = vi.mocked(adminApi.listContentRisks);
const listNotificationsMock = vi.mocked(adminApi.listNotifications);
const listSupportTicketsMock = vi.mocked(adminApi.listSupportTickets);
const listArchiveExportRequestsMock = vi.mocked(adminApi.listArchiveExportRequests);

const renderWithRouter = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]} future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <App />
    </MemoryRouter>,
  );

const findAdminLink = async (href: string) => {
  const find = async () => (await screen.findAllByRole('link')).find((link) => link.getAttribute('href') === href);
  let link = await find();
  if (!link) {
    const moreButton = await screen.findByRole('button', { name: '更多管理' });
    if (moreButton.getAttribute('aria-expanded') !== 'true') fireEvent.click(moreButton);
    link = await find();
  }
  return link;
};

describe('App', () => {
  beforeEach(() => {
    clearAccessTokenMemory();
    loginMock.mockReset();
    dashboardMock.mockReset();
    opsReadinessMock.mockReset();
    listSystemConfigsMock.mockReset();
    updateSystemConfigMock.mockReset();
    updateAiSettingsMock.mockReset();
    testAiSettingsMock.mockReset();
    listUsersMock.mockReset();
    listFamiliesMock.mockReset();
    getFamilyDetailMock.mockReset();
    listRecordsMock.mockReset();
    getRecordDetailMock.mockReset();
    listInvitesMock.mockReset();
    createInviteMock.mockReset();
    resetUserPasswordMock.mockReset();
    updateUserMembershipMock.mockReset();
    listContentRisksMock.mockReset();
    listNotificationsMock.mockReset();
    listSupportTicketsMock.mockReset();
    listArchiveExportRequestsMock.mockReset();
    dashboardMock.mockResolvedValue({
      totals: { users: 1, children: 1, records: 1, media: 1 },
      ai_job_status_distribution: [],
      recent_audit_logs: [],
    });
    opsReadinessMock.mockResolvedValue({
      generated_at: '2026-05-27T00:00:00.000Z',
      environment: {
        app_env: 'local',
        node_env: 'test',
        app_port: 3000,
        secure_cookie: false,
        admin_bootstrap_enabled: true,
        cors_origins: ['本地开发放开'],
      },
      providers: [
        { key: 'storage', label: '对象存储', value: 'minio', status: 'ready', helper: '对象存储 provider 已启用，仍需生产上传探针通过。' },
        { key: 'ai', label: 'AI 服务', value: 'openai-compatible', status: 'ready', helper: 'AI provider 已启用，以上线复验报告为准。' },
        { key: 'map', label: '地图服务', value: 'amap', status: 'ready', helper: '地图 provider 已启用，仍需真实 POI 搜索通过。' },
      ],
      data_statistics: {
        users: 1,
        families: 1,
        children: 1,
        records: 2,
        media: 3,
        audit_logs: 4,
        archive_export_requests: 1,
        support_tickets: 1,
        pending_archive_export_requests: 1,
        open_support_tickets: 1,
        content_risks: 2,
        media_exceptions: 0,
        failed_media: 0,
        failed_ai_jobs: 0,
      },
      backup_recovery: {
        status: 'warning',
        checks: [
          { key: 'retention', label: '备份保留周期', value: '30 天', status: 'warning', helper: '建议至少保留 90 天。' },
          { key: 'runbook', label: '恢复手册', value: '未配置', status: 'warning', helper: '缺少恢复手册地址，运营无法独立处理。' },
        ],
      },
      release_gates: {
        status: 'warning',
        report: {
          path: 'artifacts/app-live-audit/live-readiness-latest.json',
          status: 'conditional_pass',
          checked_at: '2026-05-27T00:00:00.000Z',
          age_hours: 2,
          providers: { ai: 'openai-compatible', map: 'amap' },
          checks: [
            { name: 'aiPreview', status: 'passed' },
            { name: 'poi', status: 'failed', error: 'INVALID_USER_KEY' },
          ],
          failures: [{ name: 'poi', error: 'INVALID_USER_KEY' }],
          blocked_requirements: ['P1-03 地点真实 POI'],
          blocked_requirement_details: [
            {
              requirement: 'P1-03 地点真实 POI',
              severity: 'P1',
              owner: '地图服务配置负责人',
              evidence: '登录后 /locations/search 返回 source=amap 的文本 POI 候选',
              next_action: '确认高德 Web 服务 Key、API 开通、服务器出口限制和配额后，按 map-only 路径重新执行 verify:live-readiness。',
            },
          ],
          next_actions: ['确认高德 Web 服务 Key、API 开通、服务器出口限制和配额后，按 map-only 路径重新执行 verify:live-readiness。'],
        },
        checks: [
          {
            key: 'ai_live_readiness',
            label: 'AI 真实调用',
            value: 'openai-compatible / 2026-05-27T00:00:00.000Z',
            status: 'ready',
            helper: '最新 live readiness 报告已验证 AI 预览真实返回标题、摘要或标签。',
          },
          {
            key: 'poi_live_readiness',
            label: '地点 POI 真实搜索',
            value: 'amap / 2026-05-27T00:00:00.000Z',
            status: 'warning',
            helper: 'INVALID_USER_KEY',
          },
          {
            key: 'live_readiness_report',
            label: '上线复验报告',
            value: 'artifacts/app-live-audit/live-readiness-latest.json',
            status: 'warning',
            helper: '修复 provider 后必须重新执行 verify:live-readiness，保留 JSON 报告用于发布决策和交接。',
          },
        ],
      },
      action_items: [
        { priority: 'P1', label: '复验真实 provider', helper: 'P1 P1-03 地点真实 POI：修复后执行带测试账号的 verify:live-readiness。', to: '/ops-readiness' },
        { priority: 'P0', label: '处理内容风险', helper: '2 个内容风险项需要复核。', to: '/content-risks' },
        { priority: 'P0', label: '处理档案交付申请', helper: '1 个导出或成年移交申请仍在处理中。', to: '/archive-export-requests' },
      ],
    });
    listSystemConfigsMock.mockResolvedValue({
      total: 8,
      list: [
        {
          config_key: 'ai_provider',
          category: 'ai_provider',
          label: 'AI 供应商',
          value: 'openai-compatible',
          display_value: 'openai-compatible',
          value_type: 'select',
          description: '控制标题、摘要和标签生成使用的 AI provider。',
          source: 'environment',
          options: [
            { value: 'openai-compatible', label: 'OpenAI 兼容服务' },
            { value: 'openai', label: 'OpenAI 服务' },
            { value: 'mock', label: '本地模拟服务' },
          ],
          updated_by_name: null,
          updated_at: null,
        },
        {
          config_key: 'ai_base_url',
          category: 'ai_provider',
          label: 'AI 接口地址',
          value: 'https://api.example.com/v1',
          display_value: 'https://api.example.com/v1',
          value_type: 'url',
          description: '兼容 /chat/completions 的 API 根地址。',
          source: 'environment',
          updated_by_name: null,
          updated_at: null,
        },
        {
          config_key: 'ai_model',
          category: 'ai_provider',
          label: 'AI 模型',
          value: 'gpt-5-mini',
          display_value: 'gpt-5-mini',
          value_type: 'text',
          description: '用于成长记录标题、摘要和标签生成的模型名称。',
          source: 'environment',
          updated_by_name: null,
          updated_at: null,
        },
        {
          config_key: 'backup_retention_days',
          category: 'backup_recovery',
          label: '备份保留周期',
          value: '30',
          value_type: 'number',
          description: '生产备份至少建议保留 90 天，用于长期家庭档案恢复窗口。',
          source: 'environment',
          updated_by_name: null,
          updated_at: null,
        },
        {
          config_key: 'alert_contact_name',
          category: 'alerting',
          label: '告警联系人',
          value: '值班同学',
          value_type: 'text',
          description: '线上异常、备份失败或 provider 门禁失败时的第一责任人。',
          source: 'admin',
          updated_by_name: '系统管理员',
          updated_at: '2026-05-27T00:00:00.000Z',
        },
        {
          config_key: 'ai_api_key',
          category: 'ai_provider',
          label: 'AI API Key',
          value: '',
          display_value: '已配置（不回显）',
          value_type: 'secret',
          description: 'AI 服务调用密钥。后台只允许覆盖保存，不会明文回显。',
          source: 'environment',
          secret_configured: true,
          updated_by_name: null,
          updated_at: null,
        },
        {
          config_key: 'ai_timeout_ms',
          category: 'ai_provider',
          label: 'AI 超时时间',
          value: '30000',
          display_value: '30000',
          value_type: 'number',
          description: 'AI 请求超时时间，单位毫秒。',
          source: 'environment',
          updated_by_name: null,
          updated_at: null,
        },
        {
          config_key: 'ai_daily_limit_per_user',
          category: 'ai_provider',
          label: '单用户每日 AI 上限',
          value: '20',
          display_value: '20',
          value_type: 'number',
          description: '每个用户每天最多触发的 AI 任务数。',
          source: 'environment',
          updated_by_name: null,
          updated_at: null,
        },
      ],
    });
    testAiSettingsMock.mockResolvedValue({
      status: 'success',
      provider: 'openai-compatible',
      model: 'gpt-5-mini',
      base_url: 'https://api.example.com/v1',
      latency_ms: 420,
      checked_at: '2026-05-27T00:00:00.000Z',
      message: 'AI 服务连接成功，当前供应商、模型和 Key 可以完成一次轻量调用。',
    });
  });

  afterEach(() => {
    clearAccessTokenMemory();
    vi.clearAllMocks();
  });

  it('redirects to login when not authenticated', () => {
    renderWithRouter('/');
    expect(screen.getByText('管理员登录')).toBeInTheDocument();
  });

  it('renders the redesigned login page', () => {
    renderWithRouter('/login');
    expect(screen.getByRole('heading', { name: '管理员登录' })).toBeInTheDocument();
    expect(screen.queryByText('年轮运营中枢')).not.toBeInTheDocument();
    expect(screen.queryByText('管理入口')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '进入管理后台' })).toBeInTheDocument();
  });

  it('logs in and loads the user list page', async () => {
    loginMock.mockResolvedValue({
      access_token: 'admin-token',
      expires_in: 7200,
      admin: {
        username: 'admin',
        display_name: '系统管理员',
        role: 'super_admin',
      },
    });
    listUsersMock.mockResolvedValue({
      list: [
        {
          user_no: 'u_001',
          nickname: '测试用户',
          avatar_url: null,
          mobile: '13800000000',
          membership_type: 'free',
          status: 'active',
          last_login_at: null,
          created_at: '2026-04-21T00:00:00.000Z',
        },
      ],
      page: 1,
      page_size: 20,
      total: 1,
      has_more: false,
    });

    renderWithRouter('/login');

    fireEvent.change(screen.getByPlaceholderText('请输入用户名'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), { target: { value: 'ChangeMe123!' } });
    fireEvent.click(screen.getByRole('button', { name: '进入管理后台' }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith({ username: 'admin', password: 'ChangeMe123!' });
    });

    const usersLink = await findAdminLink('/users');
    expect(usersLink).toBeTruthy();
    fireEvent.click(usersLink!);
    fireEvent.click(await screen.findByRole('button', { name: /查询/ }));

    await waitFor(() => {
      expect(listUsersMock).toHaveBeenCalledWith({ keyword: undefined, page: 1, page_size: 20 });
    });
    expect(await screen.findByText('测试用户')).toBeInTheDocument();
  });

  it('opens family management and loads family detail', async () => {
    loginMock.mockResolvedValue({
      access_token: 'admin-token',
      expires_in: 7200,
      admin: {
        username: 'admin',
        display_name: '系统管理员',
        role: 'super_admin',
      },
    });
    listFamiliesMock.mockResolvedValue({
      list: [
        {
          family_no: 'f_001',
          family_name: '小满家庭',
          owner_user_no: 'u_001',
          owner_name: '测试家长',
          owner_mobile: '13800000000',
          status: 'active',
          members_count: 2,
          children_count: 1,
          records_count: 18,
          media_count: 27,
          archive_export_requests_count: 1,
          created_at: '2026-05-27T00:00:00.000Z',
        },
      ],
      page: 1,
      page_size: 20,
      total: 1,
      has_more: false,
    });
    getFamilyDetailMock.mockResolvedValue({
      family_no: 'f_001',
      family_name: '小满家庭',
      owner_user_no: 'u_001',
      owner_name: '测试家长',
      owner_mobile: '13800000000',
      status: 'active',
      members_count: 2,
      children_count: 1,
      records_count: 18,
      media_count: 27,
      archive_export_requests_count: 1,
      created_at: '2026-05-27T00:00:00.000Z',
      updated_at: '2026-05-27T01:00:00.000Z',
      members: [
        {
          user_no: 'u_001',
          nickname: '测试家长',
          mobile: '13800000000',
          role: 'owner',
          status: 'active',
          joined_at: '2026-05-27T00:00:00.000Z',
        },
      ],
      children: [
        {
          child_no: 'c_001',
          name: '小满',
          birthday: '2022-01-01',
          gender: 'female',
          status: 'normal',
        },
      ],
      recent_records: [
        {
          record_no: 'r_001',
          child_no: 'c_001',
          child_name: '小满',
          title: '第一次骑车',
          record_type: 'mixed',
          status: 'published',
          creator_name: '测试家长',
          event_time: '2026-05-27T00:00:00.000Z',
        },
      ],
      archive_export_requests: [
        {
          request_no: 'handoff_001',
          child_no: 'c_001',
          child_name: '小满',
          user_no: 'u_001',
          user_name: '测试家长',
          purpose: 'adult_handoff',
          status: 'submitted',
          created_at: '2026-05-27T00:00:00.000Z',
        },
      ],
    });

    renderWithRouter('/login');

    fireEvent.change(screen.getByPlaceholderText('请输入用户名'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), { target: { value: 'ChangeMe123!' } });
    fireEvent.click(screen.getByRole('button', { name: '进入管理后台' }));

    const familiesLink = await findAdminLink('/families');
    expect(familiesLink).toBeTruthy();
    fireEvent.click(familiesLink!);

    expect(await screen.findByRole('heading', { name: '家庭管理' })).toBeInTheDocument();
    await waitFor(() => {
      expect(listFamiliesMock).toHaveBeenCalledWith({ keyword: undefined, page: 1, page_size: 20 });
    });
    expect(await screen.findByText('小满家庭')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '详情' }));

    await waitFor(() => {
      expect(getFamilyDetailMock).toHaveBeenCalledWith('f_001');
    });
    expect(await screen.findByText('家庭成员')).toBeInTheDocument();
    expect(screen.getByText('第一次骑车')).toBeInTheDocument();
    expect(screen.getByText('handoff_001')).toBeInTheDocument();
  });

  it('keeps record media previews unloaded until requested', async () => {
    loginMock.mockResolvedValue({
      access_token: 'admin-token',
      expires_in: 7200,
      admin: {
        username: 'admin',
        display_name: '系统管理员',
        role: 'super_admin',
      },
    });
    listRecordsMock.mockResolvedValue({
      list: [
        {
          record_no: 'r_001',
          child_no: 'c_001',
          child_name: '小满',
          creator_user_no: 'u_001',
          creator_name: '测试家长',
          title: '第一次自己吃饭',
          record_type: 'image',
          visibility_scope: 'family',
          status: 'published',
          created_at: '2026-05-27T00:00:00.000Z',
        },
      ],
      page: 1,
      page_size: 20,
      total: 1,
      has_more: false,
    });
    getRecordDetailMock.mockResolvedValue({
      record_no: 'r_001',
      child_no: 'c_001',
      child_name: '小满',
      creator_user_no: 'u_001',
      creator_name: '测试家长',
      title: '第一次自己吃饭',
      record_type: 'image',
      visibility_scope: 'family',
      status: 'published',
      created_at: '2026-05-27T00:00:00.000Z',
      family_no: 'f_001',
      content_text: '今天自己吃饭很认真。',
      tags: [],
      media_list: [
        {
          media_no: 'm_001',
          family_no: 'f_001',
          child_no: 'c_001',
          child_name: '小满',
          uploader_user_no: 'u_001',
          uploader_name: '测试家长',
          uploader_mobile: null,
          media_type: 'image',
          status: 'ready',
          original_name: 'photo.jpg',
          mime_type: 'image/jpeg',
          size_bytes: 128000,
          object_key: 'records/photo.jpg',
          record_no: 'r_001',
          record_title: '第一次自己吃饭',
          created_at: '2026-05-27T00:00:00.000Z',
          storage_provider: 'minio',
          bucket: 'xiaoman-local',
          access_url: 'https://cdn.example.com/photo.jpg',
          width: 1200,
          height: 900,
          duration_seconds: null,
          updated_at: '2026-05-27T01:00:00.000Z',
        },
      ],
      ai_jobs: [],
      event_time: '2026-05-27T00:00:00.000Z',
      location_text: null,
      is_milestone: false,
      ai_generated_title: null,
      ai_summary: null,
      ai_status: null,
      published_at: '2026-05-27T00:10:00.000Z',
      updated_at: '2026-05-27T01:00:00.000Z',
    });

    renderWithRouter('/login');

    fireEvent.change(screen.getByPlaceholderText('请输入用户名'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), { target: { value: 'ChangeMe123!' } });
    fireEvent.click(screen.getByRole('button', { name: '进入管理后台' }));

    const recordsLink = await findAdminLink('/records');
    expect(recordsLink).toBeTruthy();
    fireEvent.click(recordsLink!);

    expect(await screen.findByRole('heading', { name: '成长记录' })).toBeInTheDocument();
    await waitFor(() => {
      expect(listRecordsMock).toHaveBeenCalledWith({ keyword: undefined, page: 1, page_size: 20, record_filter: 'all' });
    });
    fireEvent.click(screen.getByRole('button', { name: '详情' }));

    await waitFor(() => {
      expect(getRecordDetailMock).toHaveBeenCalledWith('r_001');
    });
    expect(await screen.findByText('内容预览')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'photo.jpg' })).toHaveAttribute('src', 'https://cdn.example.com/photo.jpg');
  });

  it('resets a user password from account management', async () => {
    loginMock.mockResolvedValue({
      access_token: 'admin-token',
      expires_in: 7200,
      admin: {
        username: 'admin',
        display_name: '系统管理员',
        role: 'super_admin',
      },
    });
    listUsersMock.mockResolvedValue({
      list: [
        {
          user_no: 'u_001',
          nickname: '测试用户',
          avatar_url: null,
          mobile: '13800000000',
          membership_type: 'free',
          status: 'active',
          last_login_at: null,
          created_at: '2026-04-21T00:00:00.000Z',
        },
      ],
      page: 1,
      page_size: 20,
      total: 1,
      has_more: false,
    });
    resetUserPasswordMock.mockResolvedValue({
      user_no: 'u_001',
      auth_key: '13800000000',
      revoked_sessions: 2,
      changed: true,
      reset_at: '2026-05-26T00:00:00.000Z',
    });

    renderWithRouter('/login');

    fireEvent.change(screen.getByPlaceholderText('请输入用户名'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), { target: { value: 'ChangeMe123!' } });
    fireEvent.click(screen.getByRole('button', { name: '进入管理后台' }));

    const usersLink = await findAdminLink('/users');
    expect(usersLink).toBeTruthy();
    fireEvent.click(usersLink!);

    fireEvent.click(await screen.findByRole('button', { name: '重置密码' }));
    fireEvent.change(screen.getByLabelText('新密码'), { target: { value: 'NewPass123!' } });
    fireEvent.change(screen.getByLabelText('确认新密码'), { target: { value: 'NewPass123!' } });
    fireEvent.change(screen.getByLabelText('操作原因'), { target: { value: '用户本人申请重置' } });
    fireEvent.click(screen.getByRole('button', { name: '确认重置' }));

    await waitFor(() => {
      expect(resetUserPasswordMock).toHaveBeenCalledWith('u_001', {
        new_password: 'NewPass123!',
        password_confirm: 'NewPass123!',
        reason: '用户本人申请重置',
      });
    });
    expect(await screen.findByText('已重置 测试用户 的登录密码，并撤销 2 个登录会话。')).toBeInTheDocument();
  });

  it('updates user membership from account management', async () => {
    loginMock.mockResolvedValue({
      access_token: 'admin-token',
      expires_in: 7200,
      admin: {
        username: 'admin',
        display_name: '系统管理员',
        role: 'super_admin',
      },
    });
    listUsersMock.mockResolvedValue({
      list: [
        {
          user_no: 'u_001',
          nickname: '测试用户',
          avatar_url: null,
          mobile: '13800000000',
          membership_type: 'free',
          status: 'active',
          last_login_at: null,
          created_at: '2026-04-21T00:00:00.000Z',
        },
      ],
      page: 1,
      page_size: 20,
      total: 1,
      has_more: false,
    });
    updateUserMembershipMock.mockResolvedValue({
      user_no: 'u_001',
      membership_type: 'ai_plus',
      membership_expire_at: '2099-12-31T23:59:59.000Z',
      changed: true,
    });

    renderWithRouter('/login');

    fireEvent.change(screen.getByPlaceholderText('请输入用户名'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), { target: { value: 'ChangeMe123!' } });
    fireEvent.click(screen.getByRole('button', { name: '进入管理后台' }));

    const usersLink = await findAdminLink('/users');
    expect(usersLink).toBeTruthy();
    fireEvent.click(usersLink!);

    fireEvent.click(await screen.findByRole('button', { name: '调整权益' }));
    fireEvent.change(screen.getByLabelText('权益类型'), { target: { value: 'ai_plus' } });
    fireEvent.change(await screen.findByLabelText('到期日期'), { target: { value: '2099-12-31' } });
    fireEvent.change(screen.getByLabelText('操作原因'), { target: { value: '年付套餐开通' } });
    fireEvent.click(screen.getByRole('button', { name: '确认调整' }));

    await waitFor(() => {
      expect(updateUserMembershipMock).toHaveBeenCalledWith('u_001', {
        membership_type: 'ai_plus',
        membership_expire_at: '2099-12-31T23:59:59.000Z',
        reason: '年付套餐开通',
      });
    });
    expect(await screen.findByText('已将 测试用户 的套餐权益调整为 增强整理会员。')).toBeInTheDocument();
  });

  it('generates a registration invite from the admin invite page', async () => {
    loginMock.mockResolvedValue({
      access_token: 'admin-token',
      expires_in: 7200,
      admin: {
        username: 'admin',
        display_name: '系统管理员',
        role: 'super_admin',
      },
    });
    listInvitesMock.mockResolvedValue({
      list: [],
      page: 1,
      page_size: 20,
      total: 0,
      has_more: false,
    });
    createInviteMock.mockResolvedValue({
      invite_no: 'reg_invite_001',
      invite_code: 'NL-ABC123-DEF456',
      invitee_mobile: null,
      status: 'pending',
      expires_at: '2026-05-26T00:00:00.000Z',
      created_at: '2026-05-25T00:00:00.000Z',
    });

    renderWithRouter('/login');

    fireEvent.change(screen.getByPlaceholderText('请输入用户名'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), { target: { value: 'ChangeMe123!' } });
    fireEvent.click(screen.getByRole('button', { name: '进入管理后台' }));

    const invitesLink = await findAdminLink('/invites');
    expect(invitesLink).toBeTruthy();
    fireEvent.click(invitesLink!);

    expect(await screen.findByRole('heading', { name: '邀请码管理' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '生成邀请码' }));

    await waitFor(() => {
      expect(createInviteMock).toHaveBeenCalledWith({ mobile: undefined, expires_in_hours: 168 });
    });
    expect(await screen.findByText('NL-ABC123-DEF456')).toBeInTheDocument();
    expect(screen.getByText('本次生成的邀请码')).toBeInTheDocument();
  });

  it('opens the archive handoff queue from the admin navigation', async () => {
    loginMock.mockResolvedValue({
      access_token: 'admin-token',
      expires_in: 7200,
      admin: {
        username: 'admin',
        display_name: '系统管理员',
        role: 'super_admin',
      },
    });
    listArchiveExportRequestsMock.mockResolvedValue({
      list: [
        {
          request_no: 'handoff_001',
          user_no: 'u_001',
          user_name: '测试用户',
          user_mobile: '13800000000',
          family_no: 'f_001',
          family_name: '测试家庭',
          child_no: 'c_001',
          child_name: '小满',
          export_type: 'all',
          purpose: 'adult_handoff',
          status: 'submitted',
          contact: null,
          note: null,
          record_count: 18,
          milestone_count: 3,
          media_count: 27,
          first_record_time: '2026-01-01T00:00:00.000Z',
          latest_record_time: '2026-05-27T00:00:00.000Z',
          processed_by_name: null,
          processed_at: null,
          process_note: null,
          created_at: '2026-05-27T00:00:00.000Z',
          updated_at: '2026-05-27T00:00:00.000Z',
        },
      ],
      page: 1,
      page_size: 20,
      total: 1,
      has_more: false,
    });

    renderWithRouter('/login');

    fireEvent.change(screen.getByPlaceholderText('请输入用户名'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), { target: { value: 'ChangeMe123!' } });
    fireEvent.click(screen.getByRole('button', { name: '进入管理后台' }));

    const archiveLink = await findAdminLink('/archive-export-requests');
    expect(archiveLink).toBeTruthy();
    fireEvent.click(archiveLink!);

    expect(await screen.findByRole('heading', { name: '档案交付申请' })).toBeInTheDocument();
    await waitFor(() => {
      expect(listArchiveExportRequestsMock).toHaveBeenCalledWith({
        keyword: undefined,
        purpose: undefined,
        status: undefined,
        page: 1,
        page_size: 20,
      });
    });
    expect(await screen.findByText('handoff_001')).toBeInTheDocument();
    expect(screen.getAllByText('成年移交').length).toBeGreaterThan(0);
  });

  it('opens the support ticket queue from the admin navigation', async () => {
    loginMock.mockResolvedValue({
      access_token: 'admin-token',
      expires_in: 7200,
      admin: {
        username: 'admin',
        display_name: '系统管理员',
        role: 'super_admin',
      },
    });
    listSupportTicketsMock.mockResolvedValue({
      list: [
        {
          ticket_no: 'fb_001',
          user_no: 'u_001',
          user_name: '测试用户',
          user_mobile: '13800000000',
          category: '数据异常',
          topic: 'account-delete',
          content: '申请注销账号，并确认儿童档案后续处理。',
          contact: '13800000000',
          status: 'submitted',
          priority: 'child_safety',
          assigned_admin_name: null,
          handled_at: null,
          handle_note: null,
          created_at: '2026-05-27T00:00:00.000Z',
          updated_at: '2026-05-27T00:00:00.000Z',
        },
      ],
      page: 1,
      page_size: 20,
      total: 1,
      has_more: false,
    });

    renderWithRouter('/login');

    fireEvent.change(screen.getByPlaceholderText('请输入用户名'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), { target: { value: 'ChangeMe123!' } });
    fireEvent.click(screen.getByRole('button', { name: '进入管理后台' }));

    const supportLink = await findAdminLink('/support-tickets');
    expect(supportLink).toBeTruthy();
    fireEvent.click(supportLink!);

    expect(await screen.findByRole('heading', { name: '客服反馈' })).toBeInTheDocument();
    await waitFor(() => {
      expect(listSupportTicketsMock).toHaveBeenCalledWith({
        keyword: undefined,
        category: undefined,
        status: undefined,
        priority: undefined,
        page: 1,
        page_size: 20,
      });
    });
    expect(await screen.findByText('fb_001')).toBeInTheDocument();
    expect(screen.getAllByText('儿童安全').length).toBeGreaterThan(0);
  });

  it('filters risk-marked records from the growth records page', async () => {
    loginMock.mockResolvedValue({
      access_token: 'admin-token',
      expires_in: 7200,
      admin: {
        username: 'admin',
        display_name: '系统管理员',
        role: 'super_admin',
      },
    });
    listContentRisksMock.mockResolvedValue({
      list: [
        {
          risk_no: 'record:r_001',
          category: 'content_safety',
          severity: 'p0',
          status: 'open',
          title: '第一次骑车',
          subject_no: 'c_001',
          subject_name: '小满',
          source_type: 'record',
          source_no: 'r_001',
          source_status: 'published',
          reason: '疑似儿童安全或伤害内容',
          action_label: '进入成长记录下架或复核',
          action_to: '/records',
          created_at: '2026-05-27T00:00:00.000Z',
        },
      ],
      page: 1,
      page_size: 10,
      total: 1,
      has_more: false,
    });

    renderWithRouter('/login');

    fireEvent.change(screen.getByPlaceholderText('请输入用户名'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), { target: { value: 'ChangeMe123!' } });
    fireEvent.click(screen.getByRole('button', { name: '进入管理后台' }));

    const recordsLink = await findAdminLink('/records');
    expect(recordsLink).toBeTruthy();
    fireEvent.click(recordsLink!);

    expect(await screen.findByRole('heading', { name: '成长记录' })).toBeInTheDocument();
    const riskFilter = await screen.findByRole('button', { name: '风险标记' });
    expect(riskFilter).toBeTruthy();
    fireEvent.click(riskFilter);

    expect(await screen.findByRole('heading', { name: '成长记录' })).toBeInTheDocument();
    await waitFor(() => {
      expect(listRecordsMock).toHaveBeenLastCalledWith({ keyword: undefined, page: 1, page_size: 20, record_filter: 'risk' });
    });
    expect(window.location.pathname + window.location.search).toBe('/records?record_filter=risk');
  });

  it('opens notification management from the admin navigation', async () => {
    loginMock.mockResolvedValue({
      access_token: 'admin-token',
      expires_in: 7200,
      admin: {
        username: 'admin',
        display_name: '系统管理员',
        role: 'super_admin',
      },
    });
    listNotificationsMock.mockResolvedValue({
      list: [
        {
          notification_no: 'msg_001',
          notification_type: 'family.record_published',
          title: '小满发布了新记录',
          body: '测试家长发布了「第一次骑车」。',
          user_no: 'u_002',
          user_name: '家庭成员',
          user_mobile: '13900000000',
          family_no: 'f_001',
          family_name: '小满家庭',
          actor_user_no: 'u_001',
          actor_name: '测试家长',
          target_type: 'record',
          target_no: 'r_001',
          read_at: null,
          created_at: '2026-05-27T00:00:00.000Z',
          delivery_total: 1,
          delivery_status_counts: { queued: 1 },
          latest_delivery: {
            channel: 'push',
            provider: 'local',
            status: 'queued',
            attempts: 0,
            last_error: null,
            delivered_at: null,
            created_at: '2026-05-27T00:00:00.000Z',
          },
          deliveries: [
            {
              channel: 'push',
              provider: 'local',
              status: 'queued',
              attempts: 0,
              next_retry_at: null,
              last_error: null,
              delivered_at: null,
              created_at: '2026-05-27T00:00:00.000Z',
              updated_at: '2026-05-27T00:00:00.000Z',
            },
          ],
        },
      ],
      page: 1,
      page_size: 20,
      total: 1,
      has_more: false,
    });

    renderWithRouter('/login');

    fireEvent.change(screen.getByPlaceholderText('请输入用户名'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), { target: { value: 'ChangeMe123!' } });
    fireEvent.click(screen.getByRole('button', { name: '进入管理后台' }));

    const notificationLink = await findAdminLink('/notifications');
    expect(notificationLink).toBeTruthy();
    fireEvent.click(notificationLink!);

    expect(await screen.findByRole('heading', { name: '通知管理' })).toBeInTheDocument();
    await waitFor(() => {
      expect(listNotificationsMock).toHaveBeenCalledWith({
        keyword: undefined,
        read_state: undefined,
        notification_type: undefined,
        delivery_status: undefined,
        start_time: undefined,
        end_time: undefined,
        page: 1,
        page_size: 20,
      });
    });
    expect(await screen.findByText('小满发布了新记录')).toBeInTheDocument();
    expect(screen.getByText('家庭成员')).toBeInTheDocument();
    expect(screen.getAllByText('未读').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/待投递/).length).toBeGreaterThan(0);
  });

  it('opens the system operations readiness page from the admin navigation', async () => {
    loginMock.mockResolvedValue({
      access_token: 'admin-token',
      expires_in: 7200,
      admin: {
        username: 'admin',
        display_name: '系统管理员',
        role: 'super_admin',
      },
    });

    renderWithRouter('/login');

    fireEvent.change(screen.getByPlaceholderText('请输入用户名'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), { target: { value: 'ChangeMe123!' } });
    fireEvent.click(screen.getByRole('button', { name: '进入管理后台' }));

    const opsLink = await findAdminLink('/ops-readiness');
    expect(opsLink).toBeTruthy();
    fireEvent.click(opsLink!);

    expect(await screen.findByRole('heading', { name: '系统运维' })).toBeInTheDocument();
    await waitFor(() => {
      expect(opsReadinessMock).toHaveBeenCalled();
    });
    expect(screen.getByText('运行配置')).toBeInTheDocument();
    expect(screen.getByText('上线验收门禁')).toBeInTheDocument();
    expect(screen.getByText('复验报告')).toBeInTheDocument();
    expect(screen.getByText('延期验收项')).toBeInTheDocument();
    expect(screen.getByText('条件通过')).toBeInTheDocument();
    expect(screen.getAllByText(/P1-03 地点真实 POI/).length).toBeGreaterThan(0);
    expect(screen.getByText(/地图服务配置负责人/)).toBeInTheDocument();
    expect(screen.getByText('AI 真实调用')).toBeInTheDocument();
    expect(screen.getAllByText(/INVALID_USER_KEY/).length).toBeGreaterThan(0);
    expect(screen.getByText('备份恢复与告警值班')).toBeInTheDocument();
    expect(screen.getByText('复验真实 provider')).toBeInTheDocument();
    expect(screen.getByText('处理档案交付申请')).toBeInTheDocument();
  });

  it('updates audited system configuration from the admin navigation', async () => {
    loginMock.mockResolvedValue({
      access_token: 'admin-token',
      expires_in: 7200,
      admin: {
        username: 'admin',
        display_name: '系统管理员',
        role: 'super_admin',
      },
    });
    updateSystemConfigMock.mockResolvedValue({
      config_key: 'backup_retention_days',
      category: 'backup_recovery',
      label: '备份保留周期',
      value: '120',
      value_type: 'number',
      description: '生产备份至少建议保留 90 天，用于长期家庭档案恢复窗口。',
      source: 'admin',
      updated_by_name: '系统管理员',
      updated_at: '2026-05-27T01:00:00.000Z',
      changed: true,
    });

    renderWithRouter('/login');

    fireEvent.change(screen.getByPlaceholderText('请输入用户名'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), { target: { value: 'ChangeMe123!' } });
    fireEvent.click(screen.getByRole('button', { name: '进入管理后台' }));

    const configLink = await findAdminLink('/system-config');
    expect(configLink).toBeTruthy();
    fireEvent.click(configLink!);

    expect(await screen.findByRole('heading', { name: '系统配置' })).toBeInTheDocument();
    await waitFor(() => {
      expect(listSystemConfigsMock).toHaveBeenCalled();
    });
    expect(await screen.findByText('备份保留周期')).toBeInTheDocument();
    expect(screen.queryByText('AI API Key')).not.toBeInTheDocument();
    expect(screen.getAllByText('环境变量').length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole('button', { name: '调整' })[0]);
    fireEvent.change(screen.getByLabelText('配置值'), { target: { value: '120' } });
    fireEvent.change(screen.getByLabelText('操作原因'), { target: { value: '上线前把备份保留周期提高到 120 天' } });
    fireEvent.click(screen.getByRole('button', { name: '保存配置' }));

    await waitFor(() => {
      expect(updateSystemConfigMock).toHaveBeenCalledWith('backup_retention_days', {
        value: '120',
        reason: '上线前把备份保留周期提高到 120 天',
      });
    });
    expect(await screen.findByText('已更新备份保留周期，后台和运行中服务会优先使用新的配置。')).toBeInTheDocument();
  });

  it('manages AI settings from a dedicated page', async () => {
    loginMock.mockResolvedValue({
      access_token: 'admin-token',
      expires_in: 7200,
      admin: {
        username: 'admin',
        display_name: 'Smoke Test',
        role: 'operator',
      },
    });
    updateAiSettingsMock.mockImplementation(async (payload) => ({
      changed: true,
      list: [
        {
          config_key: 'ai_provider',
          category: 'ai_provider',
          label: 'AI 供应商',
          value: payload.provider,
          display_value: 'OpenAI 兼容服务',
          value_type: 'select',
          description: 'AI 设置',
          source: 'admin',
          updated_by_name: 'Smoke Test',
          updated_at: '2026-05-27T00:00:00.000Z',
        },
        {
          config_key: 'ai_base_url',
          category: 'ai_provider',
          label: 'AI 接口地址',
          value: payload.base_url,
          display_value: payload.base_url,
          value_type: 'url',
          description: 'AI 设置',
          source: 'admin',
          updated_by_name: 'Smoke Test',
          updated_at: '2026-05-27T00:00:00.000Z',
        },
        {
          config_key: 'ai_model',
          category: 'ai_provider',
          label: 'AI 模型',
          value: payload.model,
          display_value: payload.model,
          value_type: 'text',
          description: 'AI 设置',
          source: 'admin',
          updated_by_name: 'Smoke Test',
          updated_at: '2026-05-27T00:00:00.000Z',
        },
        {
          config_key: 'ai_api_key',
          category: 'ai_provider',
          label: 'AI API Key',
          value: '',
          display_value: '已配置（加密保存，不回显）',
          value_type: 'secret',
          description: 'AI 设置',
          source: 'admin',
          secret_configured: true,
          updated_by_name: 'Smoke Test',
          updated_at: '2026-05-27T00:00:00.000Z',
        },
        {
          config_key: 'ai_timeout_ms',
          category: 'ai_provider',
          label: 'AI 超时时间',
          value: String(payload.timeout_ms),
          display_value: String(payload.timeout_ms),
          value_type: 'number',
          description: 'AI 设置',
          source: 'admin',
          updated_by_name: 'Smoke Test',
          updated_at: '2026-05-27T00:00:00.000Z',
        },
        {
          config_key: 'ai_daily_limit_per_user',
          category: 'ai_provider',
          label: '单用户每日 AI 上限',
          value: String(payload.daily_limit_per_user),
          display_value: String(payload.daily_limit_per_user),
          value_type: 'number',
          description: 'AI 设置',
          source: 'admin',
          updated_by_name: 'Smoke Test',
          updated_at: '2026-05-27T00:00:00.000Z',
        },
      ],
    }));

    renderWithRouter('/login');

    fireEvent.change(screen.getByPlaceholderText('请输入用户名'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), { target: { value: 'ChangeMe123!' } });
    fireEvent.click(screen.getByRole('button', { name: '进入管理后台' }));

    const aiSettingsLink = await findAdminLink('/ai-settings');
    expect(aiSettingsLink).toBeTruthy();
    fireEvent.click(aiSettingsLink!);

    expect(await screen.findByRole('heading', { name: 'AI 服务设置' })).toBeInTheDocument();
    await waitFor(() => {
      expect(listSystemConfigsMock).toHaveBeenCalled();
    });
    expect(screen.getAllByText('OpenAI 兼容服务').length).toBeGreaterThan(0);
    expect(screen.getByText('Key 已配置')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: '修改 AI 设置' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '修改 AI 设置' }));

    expect(await screen.findByRole('dialog', { name: '修改 AI 设置' })).toBeInTheDocument();
    expect(screen.getAllByText('必填').length).toBeGreaterThanOrEqual(6);
    expect(screen.getByPlaceholderText('留空保留当前密钥')).toHaveValue('');

    fireEvent.change(screen.getByLabelText('模型名称'), { target: { value: 'gpt-5.4-mini' } });
    fireEvent.change(screen.getByLabelText('操作原因'), { target: { value: '线上切换模型验证' } });
    fireEvent.click(screen.getByRole('button', { name: '保存 AI 设置' }));

    await waitFor(() => {
      expect(updateAiSettingsMock).toHaveBeenCalledWith({
        provider: 'openai-compatible',
        base_url: 'https://api.example.com/v1',
        model: 'gpt-5.4-mini',
        api_key: undefined,
        timeout_ms: 30000,
        daily_limit_per_user: 20,
        reason: '线上切换模型验证',
      });
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '修改 AI 设置' })).not.toBeInTheDocument();
    });

    fireEvent.click(await screen.findByRole('button', { name: '测试连接' }));
    await waitFor(() => {
      expect(testAiSettingsMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getAllByText('连接成功').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('AI 服务连接成功，当前供应商、模型和 Key 可以完成一次轻量调用。').length).toBeGreaterThan(0);
  });
});
