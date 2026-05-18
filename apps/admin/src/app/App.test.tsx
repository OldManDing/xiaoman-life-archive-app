import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { App } from './App';
import { clearAccessTokenMemory } from '../shared/authMemory';

vi.mock('../shared/request', () => ({
  adminApi: {
    login: vi.fn(),
    dashboard: vi.fn(),
    listUsers: vi.fn(),
    updateUserStatus: vi.fn(),
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
    listAuditLogs: vi.fn(),
  },
}));

import { adminApi } from '../shared/request';

const loginMock = vi.mocked(adminApi.login);
const dashboardMock = vi.mocked(adminApi.dashboard);
const listUsersMock = vi.mocked(adminApi.listUsers);

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
    listUsersMock.mockReset();
    dashboardMock.mockResolvedValue({
      totals: { users: 1, children: 1, records: 1, media: 1 },
      ai_job_status_distribution: [],
      recent_audit_logs: [],
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
    expect(screen.getByText('年轮运营中枢')).toBeInTheDocument();
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
});
