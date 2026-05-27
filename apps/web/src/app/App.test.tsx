import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';
import { clearLoginFormDraft } from '../pages/auth-pages';

vi.mock('../shared/api/webApi', () => ({
  webApi: {
    refresh: vi.fn(),
    sendCode: vi.fn(),
    listChildren: vi.fn(),
    logout: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
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
    mediaAccessUrl: vi.fn(),
    me: vi.fn(),
    detailChild: vi.fn(),
  },
}));

import { webApi } from '../shared/api/webApi';

const refreshMock = vi.mocked(webApi.refresh);
const listChildrenMock = vi.mocked(webApi.listChildren);
const loginMock = vi.mocked(webApi.login);
const registerMock = vi.mocked(webApi.register);
const createChildMock = vi.mocked(webApi.createChild);
const logoutMock = vi.mocked(webApi.logout);

describe('App Shell', () => {
  beforeEach(() => {
    clearLoginFormDraft();
    refreshMock.mockReset();
    listChildrenMock.mockReset();
    loginMock.mockReset();
    registerMock.mockReset();
    createChildMock.mockReset();
    logoutMock.mockReset();
    window.history.pushState({}, '', '/auth/login');
  });

  afterEach(() => {
    clearLoginFormDraft();
    vi.clearAllMocks();
  });

  it('shows bootstrap loading state before auth resolves', () => {
    window.history.pushState({}, '', '/home');
    refreshMock.mockReturnValue(new Promise(() => undefined));
    render(<App />);
    expect(screen.getByText('正在进入年轮…')).toBeDefined();
  });

  it('redirects to login if unauthenticated after bootstrap', async () => {
    refreshMock.mockRejectedValue(new Error('unauthorized'));
    render(<App />);
    expect(await screen.findByText('登录注册')).toBeDefined();
  });

  it('logs in with password after agreement is accepted', async () => {
    refreshMock.mockRejectedValue(new Error('unauthorized'));
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

    fireEvent.change(await screen.findByPlaceholderText('请输入账号'), { target: { value: 'parent_account' } });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), { target: { value: 'Parent123!' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '进入年轮' }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith({
        login_type: 'password',
        credential: 'parent_account',
        password: 'Parent123!',
      });
    });
  });

  it('preserves login form input after viewing legal content', async () => {
    refreshMock.mockRejectedValue(new Error('unauthorized'));

    render(<App />);

    fireEvent.change(await screen.findByPlaceholderText('请输入账号'), { target: { value: 'parent_account' } });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), { target: { value: 'Parent123!' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '查看完整协议与隐私政策' }));

    expect(await screen.findByText('关于与协议')).toBeDefined();
    fireEvent.click(screen.getByLabelText('返回'));

    expect(await screen.findByText('登录注册')).toBeDefined();
    expect((screen.getByPlaceholderText('请输入账号') as HTMLInputElement).value).toBe('parent_account');
    expect((screen.getByPlaceholderText('请输入密码') as HTMLInputElement).value).toBe('Parent123!');
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
  });

  it('preserves registration form input after viewing legal content', async () => {
    refreshMock.mockRejectedValue(new Error('unauthorized'));

    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: '注册' }));
    fireEvent.change(screen.getByPlaceholderText('请输入账号'), { target: { value: 'new_parent' } });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), { target: { value: 'Parent123!' } });
    fireEvent.change(screen.getByPlaceholderText('请再次输入密码'), { target: { value: 'Parent123!' } });
    fireEvent.change(screen.getByPlaceholderText('请输入邀请码'), { target: { value: 'NL-REG001-REG002' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '查看完整协议与隐私政策' }));

    expect(await screen.findByText('关于与协议')).toBeDefined();
    fireEvent.click(screen.getByLabelText('返回'));

    expect(await screen.findByText('登录注册')).toBeDefined();
    expect((screen.getByPlaceholderText('请输入账号') as HTMLInputElement).value).toBe('new_parent');
    expect((screen.getByPlaceholderText('请输入密码') as HTMLInputElement).value).toBe('Parent123!');
    expect((screen.getByPlaceholderText('请再次输入密码') as HTMLInputElement).value).toBe('Parent123!');
    expect((screen.getByPlaceholderText('请输入邀请码') as HTMLInputElement).value).toBe('NL-REG001-REG002');
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
  });

  it('restores non-sensitive auth draft fields but removes passwords persisted by older versions', async () => {
    refreshMock.mockRejectedValue(new Error('unauthorized'));
    window.sessionStorage.setItem(
      'nianlun.auth.loginFormDraft.v1',
      JSON.stringify({
        mode: 'login',
        form: {
          credential: 'cached_parent',
          password: 'Parent123!',
          password_confirm: '',
          invite_code: '',
        },
        acceptedAgreement: true,
      }),
    );

    render(<App />);

    expect((await screen.findByPlaceholderText('请输入账号') as HTMLInputElement).value).toBe('cached_parent');
    expect((screen.getByPlaceholderText('请输入密码') as HTMLInputElement).value).toBe('');
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
    expect(window.sessionStorage.getItem('nianlun.auth.loginFormDraft.v1')).not.toContain('Parent123!');
  });

  it('registers with password and invite code after agreement is accepted', async () => {
    refreshMock.mockRejectedValue(new Error('unauthorized'));
    registerMock.mockResolvedValue({
      access_token: 'token-register',
      expires_in: 7200,
      user: {
        user_no: 'u_register',
        nickname: '注册用户',
        avatar_url: null,
        membership_type: 'free',
      },
      need_create_child: true,
    });

    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: '注册' }));
    fireEvent.change(screen.getByPlaceholderText('请输入账号'), { target: { value: 'new_parent' } });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), { target: { value: 'Parent123!' } });
    fireEvent.change(screen.getByPlaceholderText('请再次输入密码'), { target: { value: 'Parent123!' } });
    fireEvent.change(screen.getByPlaceholderText('请输入邀请码'), { target: { value: 'join-family-001' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '注册并进入' }));

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith({
        credential: 'new_parent',
        password: 'Parent123!',
        password_confirm: 'Parent123!',
        invite_code: 'join-family-001',
      });
    });
  });

  it('shows local Chinese validation before sending invalid registration payload', async () => {
    refreshMock.mockRejectedValue(new Error('unauthorized'));

    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: '注册' }));
    fireEvent.change(screen.getByPlaceholderText('请输入账号'), { target: { value: 'new_parent' } });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), { target: { value: '123456' } });
    fireEvent.change(screen.getByPlaceholderText('请再次输入密码'), { target: { value: '123456' } });
    fireEvent.change(screen.getByPlaceholderText('请输入邀请码'), { target: { value: 'NL-ABC123-DEF456' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '注册并进入' }));

    expect(await screen.findByText('密码需为 8 到 72 位')).toBeDefined();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('shows a usable registration message when the backend returns generic validation text', async () => {
    refreshMock.mockRejectedValue(new Error('unauthorized'));
    registerMock.mockRejectedValue(new Error('参数校验失败'));

    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: '注册' }));
    fireEvent.change(screen.getByPlaceholderText('请输入账号'), { target: { value: 'new_parent' } });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), { target: { value: 'Parent123!' } });
    fireEvent.change(screen.getByPlaceholderText('请再次输入密码'), { target: { value: 'Parent123!' } });
    fireEvent.change(screen.getByPlaceholderText('请输入邀请码'), { target: { value: 'NL-REG001-REG002' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '注册并进入' }));

    expect(await screen.findByText('请检查账号、密码、确认密码和邀请码是否完整')).toBeDefined();
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

    fireEvent.change(await screen.findByLabelText('宝宝小名'), { target: { value: '小满' } });
    fireEvent.change(screen.getByLabelText('出生日期'), { target: { value: '2025-01-01' } });
    fireEvent.click(screen.getByRole('button', { name: '完成创建' }));

    await waitFor(() => {
      expect(createChildMock).toHaveBeenCalledWith({
        name: '小满',
        avatar_url: '',
        birthday: '2025-01-01',
        gender: 'male',
        birth_place: '',
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
