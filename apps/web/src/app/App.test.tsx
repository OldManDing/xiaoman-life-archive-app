import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';

vi.mock('../shared/api/webApi', () => ({
  webApi: {
    refresh: vi.fn(),
    sendCode: vi.fn(),
    listChildren: vi.fn(),
    logout: vi.fn(),
    login: vi.fn(),
    updateMe: vi.fn(),
    createChild: vi.fn(),
    createRecord: vi.fn(),
    listRecords: vi.fn(),
    detailRecord: vi.fn(),
    updateRecord: vi.fn(),
    createAiJob: vi.fn(),
    detailAiJob: vi.fn(),
    createUploadToken: vi.fn(),
    confirmUpload: vi.fn(),
    me: vi.fn(),
    detailChild: vi.fn(),
  },
}));

import { webApi } from '../shared/api/webApi';

const refreshMock = vi.mocked(webApi.refresh);
const sendCodeMock = vi.mocked(webApi.sendCode);
const listChildrenMock = vi.mocked(webApi.listChildren);
const loginMock = vi.mocked(webApi.login);
const createChildMock = vi.mocked(webApi.createChild);
const logoutMock = vi.mocked(webApi.logout);

describe('App Shell', () => {
  beforeEach(() => {
    refreshMock.mockReset();
    sendCodeMock.mockReset();
    listChildrenMock.mockReset();
    loginMock.mockReset();
    createChildMock.mockReset();
    logoutMock.mockReset();
    window.history.pushState({}, '', '/auth/login');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows bootstrap loading state before auth resolves', () => {
    refreshMock.mockReturnValue(new Promise(() => undefined));
    render(<App />);
    expect(screen.getByText('正在进入年轮…')).toBeDefined();
  });

  it('redirects to login if unauthenticated after bootstrap', async () => {
    refreshMock.mockRejectedValue(new Error('unauthorized'));
    render(<App />);
    expect(await screen.findByText('登录注册')).toBeDefined();
  });

  it('sends login code and logs in after agreement is accepted', async () => {
    refreshMock.mockRejectedValue(new Error('unauthorized'));
    sendCodeMock.mockResolvedValue({ success: true, expires_in: 300, next_send_in: 60 });
    loginMock.mockResolvedValue({
      access_token: 'token-login',
      expires_in: 7200,
      user: {
        user_no: 'u_login',
        nickname: '登录用户',
        avatar_url: null,
        membership_type: 'free',
      },
      need_create_child: true,
    });

    render(<App />);

    fireEvent.change(await screen.findByPlaceholderText('请输入手机号'), { target: { value: '13800000000' } });
    fireEvent.click(screen.getByText('发送验证码'));
    await waitFor(() => {
      expect(sendCodeMock).toHaveBeenCalledWith('13800000000');
    });

    fireEvent.change(screen.getByPlaceholderText('请输入验证码'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '进入年轮' }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith({
        login_type: 'mobile',
        credential: '13800000000',
        verify_code: '123456',
      });
    });
  });

  it('creates a child during onboarding', async () => {
    window.history.pushState({}, '', '/onboarding/child');
    refreshMock.mockResolvedValue({
      access_token: 'token-onboarding',
      expires_in: 7200,
      user: {
        user_no: 'u_onboarding',
        nickname: '建档用户',
        avatar_url: null,
        membership_type: 'free',
      },
      need_create_child: true,
    });
    createChildMock.mockResolvedValue({
      child_no: 'c_new',
      family_no: 'f_new',
      owner_user_no: 'u_onboarding',
      name: '小满',
      avatar_url: null,
      birthday: '2025-01-01',
      gender: 'female',
      birth_place: '上海',
      remark: null,
      current_age_display: '1岁2月',
      status: 'normal',
      created_at: '2026-04-21T00:00:00.000Z',
      updated_at: '2026-04-21T00:00:00.000Z',
    });

    render(<App />);

    fireEvent.change(await screen.findByLabelText('孩子姓名'), { target: { value: '小满' } });
    fireEvent.change(screen.getByLabelText('生日'), { target: { value: '2025-01-01' } });
    fireEvent.change(screen.getByLabelText('出生地'), { target: { value: '上海' } });
    fireEvent.click(screen.getByRole('button', { name: '完成建档' }));

    await waitFor(() => {
      expect(createChildMock).toHaveBeenCalledWith({
        name: '小满',
        birthday: '2025-01-01',
        gender: 'female',
        birth_place: '上海',
        remark: '',
      });
    });
  });

  it('renders authenticated shell after refresh succeeds', async () => {
    refreshMock.mockResolvedValue({
      access_token: 'token-123',
      expires_in: 7200,
      user: {
        user_no: 'u_001',
        nickname: '测试用户',
        avatar_url: null,
        membership_type: 'free',
      },
      need_create_child: false,
    });
    listChildrenMock.mockResolvedValue([
      {
        child_no: 'c_001',
        family_no: 'f_001',
        owner_user_no: 'u_001',
        name: '小满',
        avatar_url: null,
        birthday: '2025-01-01',
        gender: 'female',
        birth_place: '上海',
        remark: null,
        current_age_display: '1岁2月',
        status: 'normal',
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
      },
    ]);
    const { webApi } = await import('../shared/api/webApi');
    vi.mocked(webApi.detailChild).mockResolvedValue({
      child_no: 'c_001',
      family_no: 'f_001',
      owner_user_no: 'u_001',
      name: '小满',
      avatar_url: null,
      birthday: '2025-01-01',
      gender: 'female',
      birth_place: '上海',
      remark: null,
      current_age_display: '1岁2月',
      status: 'normal',
      created_at: '2026-04-21T00:00:00.000Z',
      updated_at: '2026-04-21T00:00:00.000Z',
    });
    vi.mocked(webApi.listRecords).mockResolvedValue({
      list: [],
      page: 1,
      page_size: 5,
      total: 0,
      has_more: false,
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('今日值得记录')).toBeDefined();
    });
  });
});
