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
const listUsersMock = vi.mocked(adminApi.listUsers);
const listFamiliesMock = vi.mocked(adminApi.listFamilies);
const getFamilyDetailMock = vi.mocked(adminApi.getFamilyDetail);
const listInvitesMock = vi.mocked(adminApi.listInvites);
const createInviteMock = vi.mocked(adminApi.createInvite);
const resetUserPasswordMock = vi.mocked(adminApi.resetUserPassword);
const updateUserMembershipMock = vi.mocked(adminApi.updateUserMembership);
const listContentRisksMock = vi.mocked(adminApi.listContentRisks);
const listSupportTicketsMock = vi.mocked(adminApi.listSupportTickets);
const listArchiveExportRequestsMock = vi.mocked(adminApi.listArchiveExportRequests);

const renderWithRouter = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]} future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <App />
    </MemoryRouter>,
  );

describe('App', () => {
  beforeEach(() => {
    clearAccessTokenMemory();
    loginMock.mockReset();
    dashboardMock.mockReset();
    opsReadinessMock.mockReset();
    listSystemConfigsMock.mockReset();
    updateSystemConfigMock.mockReset();
    listUsersMock.mockReset();
    listFamiliesMock.mockReset();
    getFamilyDetailMock.mockReset();
    listInvitesMock.mockReset();
    createInviteMock.mockReset();
    resetUserPasswordMock.mockReset();
    updateUserMembershipMock.mockReset();
    listContentRisksMock.mockReset();
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
      total: 5,
      list: [
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
      ],
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

    const usersLink = (await screen.findAllByRole('link')).find((link) => link.getAttribute('href') === '/users');
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

    const familiesLink = (await screen.findAllByRole('link')).find((link) => link.getAttribute('href') === '/families');
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

    const usersLink = (await screen.findAllByRole('link')).find((link) => link.getAttribute('href') === '/users');
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

    const usersLink = (await screen.findAllByRole('link')).find((link) => link.getAttribute('href') === '/users');
    expect(usersLink).toBeTruthy();
    fireEvent.click(usersLink!);

    fireEvent.click(await screen.findByRole('button', { name: '调整权益' }));
    fireEvent.change(screen.getByLabelText('权益类型'), { target: { value: 'ai_plus' } });
    fireEvent.change(screen.getByLabelText('到期日期'), { target: { value: '2099-12-31' } });
    fireEvent.change(screen.getByLabelText('操作原因'), { target: { value: '年付套餐开通' } });
    fireEvent.click(screen.getByRole('button', { name: '确认调整' }));

    await waitFor(() => {
      expect(updateUserMembershipMock).toHaveBeenCalledWith('u_001', {
        membership_type: 'ai_plus',
        membership_expire_at: '2099-12-31T23:59:59.000Z',
        reason: '年付套餐开通',
      });
    });
    expect(await screen.findByText('已将 测试用户 的套餐权益调整为 AI 增强会员。')).toBeInTheDocument();
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

    const invitesLink = (await screen.findAllByRole('link')).find((link) => link.getAttribute('href') === '/invites');
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

    const archiveLink = (await screen.findAllByRole('link')).find((link) => link.getAttribute('href') === '/archive-export-requests');
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

    const supportLink = (await screen.findAllByRole('link')).find((link) => link.getAttribute('href') === '/support-tickets');
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

  it('opens the content risk queue from the admin navigation', async () => {
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

    const riskLink = (await screen.findAllByRole('link')).find((link) => link.getAttribute('href') === '/content-risks');
    expect(riskLink).toBeTruthy();
    fireEvent.click(riskLink!);

    expect(await screen.findByRole('heading', { name: '内容风险' })).toBeInTheDocument();
    await waitFor(() => {
      expect(listContentRisksMock).toHaveBeenCalledWith({
        keyword: undefined,
        category: undefined,
        severity: undefined,
        status: undefined,
        page: 1,
        page_size: 10,
      });
    });
    expect(await screen.findByText('第一次骑车')).toBeInTheDocument();
    expect(screen.getAllByText('P0 阻塞').length).toBeGreaterThan(0);
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

    const opsLink = (await screen.findAllByRole('link')).find((link) => link.getAttribute('href') === '/ops-readiness');
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

    const configLink = (await screen.findAllByRole('link')).find((link) => link.getAttribute('href') === '/system-config');
    expect(configLink).toBeTruthy();
    fireEvent.click(configLink!);

    expect(await screen.findByRole('heading', { name: '系统配置' })).toBeInTheDocument();
    await waitFor(() => {
      expect(listSystemConfigsMock).toHaveBeenCalled();
    });
    expect(await screen.findByText('备份保留周期')).toBeInTheDocument();
    expect(screen.getByText('环境变量')).toBeInTheDocument();

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
    expect(await screen.findByText('已更新备份保留周期，系统运维页会使用新的后台配置。')).toBeInTheDocument();
  });
});
