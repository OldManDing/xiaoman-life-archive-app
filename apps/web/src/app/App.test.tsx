import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';
import { clearLoginFormDraft } from '../pages/auth-pages';
import { clearAccessToken } from '../shared/auth/tokenMemory';
import { clearMediaAccessUrlCache } from '../shared/hooks';

vi.mock('../shared/api/webApi', () => ({
  webApi: {
    refresh: vi.fn(),
    sendCode: vi.fn(),
    listChildren: vi.fn(),
    logout: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    updateMe: vi.fn(),
    requestArchiveExport: vi.fn(),
    listArchiveExportRequests: vi.fn(),
    archiveExportSummary: vi.fn(),
    createChild: vi.fn(),
    createRecord: vi.fn(),
    listRecords: vi.fn(),
    detailRecord: vi.fn(),
    updateRecord: vi.fn(),
    deleteRecord: vi.fn(),
    createAiJob: vi.fn(),
    detailAiJob: vi.fn(),
    createUploadToken: vi.fn(),
    confirmUpload: vi.fn(),
    mediaAccessUrl: vi.fn(),
    searchLocations: vi.fn(),
    me: vi.fn(),
    preferences: vi.fn(),
    updatePreferences: vi.fn(),
    submitFeedback: vi.fn(),
    requestMembershipBook: vi.fn(),
    deletionCheck: vi.fn(),
    deleteMe: vi.fn(),
    detailChild: vi.fn(),
    listFamilyMembers: vi.fn(),
    updateFamilyMemberRole: vi.fn(),
    createFamilyInvite: vi.fn(),
  },
}));

vi.mock('../shared/deviceLocation', () => ({
  getCurrentDeviceLocation: vi.fn(),
}));

import { webApi } from '../shared/api/webApi';
import { getCurrentDeviceLocation } from '../shared/deviceLocation';

const refreshMock = vi.mocked(webApi.refresh);
const listChildrenMock = vi.mocked(webApi.listChildren);
const loginMock = vi.mocked(webApi.login);
const registerMock = vi.mocked(webApi.register);
const createChildMock = vi.mocked(webApi.createChild);
const logoutMock = vi.mocked(webApi.logout);
const detailChildMock = vi.mocked(webApi.detailChild);
const listRecordsMock = vi.mocked(webApi.listRecords);
const createRecordMock = vi.mocked(webApi.createRecord);
const detailRecordMock = vi.mocked(webApi.detailRecord);
const deleteRecordMock = vi.mocked(webApi.deleteRecord);
const createAiJobMock = vi.mocked(webApi.createAiJob);
const detailAiJobMock = vi.mocked(webApi.detailAiJob);
const searchLocationsMock = vi.mocked(webApi.searchLocations);
const updateMeMock = vi.mocked(webApi.updateMe);
const meMock = vi.mocked(webApi.me);
const preferencesMock = vi.mocked(webApi.preferences);
const updatePreferencesMock = vi.mocked(webApi.updatePreferences);
const submitFeedbackMock = vi.mocked(webApi.submitFeedback);
const requestMembershipBookMock = vi.mocked(webApi.requestMembershipBook);
const deletionCheckMock = vi.mocked(webApi.deletionCheck);
const deleteMeMock = vi.mocked(webApi.deleteMe);
const createUploadTokenMock = vi.mocked(webApi.createUploadToken);
const confirmUploadMock = vi.mocked(webApi.confirmUpload);
const mediaAccessUrlMock = vi.mocked(webApi.mediaAccessUrl);
const listFamilyMembersMock = vi.mocked(webApi.listFamilyMembers);
const updateFamilyMemberRoleMock = vi.mocked(webApi.updateFamilyMemberRole);
const createFamilyInviteMock = vi.mocked(webApi.createFamilyInvite);
const getCurrentDeviceLocationMock = vi.mocked(getCurrentDeviceLocation);
const optionalInvitePlaceholder = '已有家庭邀请码可填写，没有也能注册';

const demoChild = {
  child_no: 'c_001',
  family_no: 'f_001',
  owner_user_no: 'u_001',
  name: '小满',
  avatar_url: null,
  birthday: '2025-01-01',
  gender: 'female',
  birth_place: '上海',
  remark: null,
  current_age_display: '1岁4个月',
  status: 'normal',
  created_at: '2026-04-21T00:00:00.000Z',
  updated_at: '2026-04-21T00:00:00.000Z',
};

const mockAuthenticatedSession = (userOverrides: Partial<{ membership_type: string; membership_expire_at: string | null }> = {}) => {
  refreshMock.mockResolvedValue({
    access_token: 'token-123',
    expires_in: 7200,
    user: {
      user_no: 'u_001',
      nickname: '测试用户',
      avatar_url: null,
      membership_type: 'free',
      ...userOverrides,
    },
    need_create_child: false,
  });
  listChildrenMock.mockResolvedValue([demoChild]);
  detailChildMock.mockResolvedValue(demoChild);
};

describe('App Shell', () => {
  beforeEach(() => {
    clearAccessToken();
    clearLoginFormDraft();
    refreshMock.mockReset();
    listChildrenMock.mockReset();
    loginMock.mockReset();
    registerMock.mockReset();
    createChildMock.mockReset();
    logoutMock.mockReset();
    detailChildMock.mockReset();
    listRecordsMock.mockReset();
    createRecordMock.mockReset();
    detailRecordMock.mockReset();
    deleteRecordMock.mockReset();
    createAiJobMock.mockReset();
    detailAiJobMock.mockReset();
    searchLocationsMock.mockReset();
    updateMeMock.mockReset();
    meMock.mockReset();
    preferencesMock.mockReset();
    updatePreferencesMock.mockReset();
    submitFeedbackMock.mockReset();
    requestMembershipBookMock.mockReset();
    deletionCheckMock.mockReset();
    deleteMeMock.mockReset();
    createUploadTokenMock.mockReset();
    confirmUploadMock.mockReset();
    mediaAccessUrlMock.mockReset();
    listFamilyMembersMock.mockReset();
    updateFamilyMemberRoleMock.mockReset();
    createFamilyInviteMock.mockReset();
    clearMediaAccessUrlCache();
    getCurrentDeviceLocationMock.mockReset();
    window.history.pushState({}, '', '/auth/login');
  });

  afterEach(() => {
    clearAccessToken();
    clearLoginFormDraft();
    vi.clearAllMocks();
  });

  it('shows bootstrap loading state before auth resolves', () => {
    window.history.pushState({}, '', '/home');
    refreshMock.mockReturnValue(new Promise(() => undefined));
    render(<App />);
    expect(screen.getByLabelText('正在进入年轮')).toBeDefined();
    expect(screen.getByText('正在进入家庭时间线')).toBeDefined();
  });

  it('redirects to login if unauthenticated after bootstrap', async () => {
    refreshMock.mockRejectedValue(new Error('unauthorized'));
    render(<App />);
    expect(await screen.findByText('登录注册')).toBeDefined();
    expect(screen.queryByText('使用账号密码进入年轮。')).toBeNull();
    expect(screen.queryByText('一家人的成长年轮，慢慢沉淀成档案。')).toBeNull();
  });

  it('renders auth submit button with a clear disabled style', async () => {
    refreshMock.mockRejectedValue(new Error('unauthorized'));
    render(<App />);

    const submitButton = (await screen.findByRole('button', { name: '进入年轮' })) as HTMLButtonElement;

    expect(submitButton.disabled).toBe(true);
    expect(submitButton.style.cursor).toBe('not-allowed');
    expect(submitButton.style.boxShadow).toBe('none');
    expect(submitButton.style.opacity).toBe('1');
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
    fireEvent.change(screen.getByPlaceholderText(optionalInvitePlaceholder), { target: { value: 'NL-REG001-REG002' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '查看完整协议与隐私政策' }));

    expect(await screen.findByText('关于与协议')).toBeDefined();
    fireEvent.click(screen.getByLabelText('返回'));

    expect(await screen.findByText('登录注册')).toBeDefined();
    expect((screen.getByPlaceholderText('请输入账号') as HTMLInputElement).value).toBe('new_parent');
    expect((screen.getByPlaceholderText('请输入密码') as HTMLInputElement).value).toBe('Parent123!');
    expect((screen.getByPlaceholderText('请再次输入密码') as HTMLInputElement).value).toBe('Parent123!');
    expect((screen.getByPlaceholderText(optionalInvitePlaceholder) as HTMLInputElement).value).toBe('NL-REG001-REG002');
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

  it('uses the app session hint to refresh on the login route after restart', async () => {
    window.localStorage.setItem('nianlun:session-hint', '1');
    refreshMock.mockResolvedValue({
      access_token: 'token-restored',
      expires_in: 7200,
      user: {
        user_no: 'u_restored',
        nickname: '恢复用户',
        avatar_url: null,
        membership_type: 'free',
      },
      need_create_child: false,
    });
    const child = {
      child_no: 'c_restored',
      family_no: 'f_001',
      owner_user_no: 'u_restored',
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
    };
    listChildrenMock.mockResolvedValue([child]);
    detailChildMock.mockResolvedValue(child);
    listRecordsMock.mockResolvedValue({
      list: [],
      page: 1,
      page_size: 5,
      total: 0,
      has_more: false,
    });

    render(<App />);

    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalled();
    });
    expect(await screen.findByText('今日值得记录')).toBeDefined();
  });

  it('registers with password without invite code after agreement is accepted', async () => {
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
    fireEvent.change(screen.getByPlaceholderText('请输入账号'), { target: { value: 'standalone_parent' } });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), { target: { value: 'Parent123!' } });
    fireEvent.change(screen.getByPlaceholderText('请再次输入密码'), { target: { value: 'Parent123!' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '注册并进入' }));

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith({
        credential: 'standalone_parent',
        password: 'Parent123!',
        password_confirm: 'Parent123!',
      });
    });
  });

  it('registers with password and optional invite code after agreement is accepted', async () => {
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
    fireEvent.change(screen.getByPlaceholderText(optionalInvitePlaceholder), { target: { value: 'join-family-001' } });
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
    fireEvent.change(screen.getByPlaceholderText(optionalInvitePlaceholder), { target: { value: 'NL-ABC123-DEF456' } });
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
    fireEvent.change(screen.getByPlaceholderText(optionalInvitePlaceholder), { target: { value: 'NL-REG001-REG002' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '注册并进入' }));

    expect(await screen.findByText('请检查账号、密码和确认密码是否完整')).toBeDefined();
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
    window.history.pushState({}, '', '/home');
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

  it('does not show the one-year-ago card without a real anniversary record', async () => {
    window.history.pushState({}, '', '/home');
    mockAuthenticatedSession();
    listRecordsMock.mockImplementation(async (query) => {
      if (query.start_time || query.end_time) {
        return { list: [], page: 1, page_size: 1, total: 0, has_more: false };
      }
      return {
        list: [
          {
            record_no: 'r_recent',
            cover_media_no: null,
            cover_media_type: null,
            cover_url: null,
            title: '最近真实记录',
            summary: '这是最近发布的真实记录。',
            event_time: '2026-05-28T10:00:00.000Z',
            location_text: null,
            tags: [],
            creator_name: '测试用户',
            is_milestone: false,
            record_type: 'text',
            status: 'published' as const,
          },
        ],
        page: 1,
        page_size: 5,
        total: 1,
        has_more: false,
      };
    });

    render(<App />);

    expect(await screen.findByText('最近真实记录')).toBeDefined();
    expect(screen.queryByText('一年前的今天')).toBeNull();
    expect(screen.queryByText('第一次在草地上奔跑')).toBeNull();
  });

  it('shows the one-year-ago card only from the anniversary records API result', async () => {
    window.history.pushState({}, '', '/home');
    mockAuthenticatedSession();
    const anniversaryRecord = {
      record_no: 'r_anniversary',
      cover_media_no: null,
      cover_media_type: null,
      cover_url: null,
      title: '一年前真实记录',
      summary: '这是从接口返回的一年前记录。',
      event_time: '2025-05-30T10:00:00.000Z',
      location_text: null,
      tags: [],
      creator_name: '测试用户',
      is_milestone: false,
      record_type: 'text',
      status: 'published' as const,
    };
    listRecordsMock.mockImplementation(async (query) => {
      if (query.start_time || query.end_time) {
        return { list: [anniversaryRecord], page: 1, page_size: 1, total: 1, has_more: false };
      }
      return { list: [], page: 1, page_size: 5, total: 0, has_more: false };
    });

    render(<App />);

    expect(await screen.findByText('一年前的今天')).toBeDefined();
    expect(screen.getByText('一年前真实记录')).toBeDefined();
  });

  it('shows a clear empty state when timeline filters have no matching records', async () => {
    window.history.pushState({}, '', '/timeline');
    mockAuthenticatedSession();
    listRecordsMock.mockResolvedValue({
      list: [
        {
          record_no: 'r_text_only',
          cover_media_no: null,
          cover_media_type: null,
          cover_url: null,
          title: '普通文字记录',
          summary: '这是一条普通记录。',
          event_time: '2026-05-28T10:00:00.000Z',
          location_text: null,
          tags: ['日常'],
          creator_name: '测试用户',
          is_milestone: false,
          record_type: 'text',
          status: 'published' as const,
        },
      ],
      page: 1,
      page_size: 40,
      total: 1,
      has_more: false,
    });

    render(<App />);

    expect(await screen.findByText('普通文字记录')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '筛选记录' }));
    fireEvent.click(screen.getByRole('button', { name: '里程碑' }));

    expect(await screen.findByText('没有符合「里程碑」的记录。')).toBeDefined();
    expect(screen.queryByText('当前孩子还没有已发布记录。')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '清除筛选' }));
    expect(await screen.findByText('普通文字记录')).toBeDefined();
  });

  it('opens height recording route without duplicating the timeline label', async () => {
    window.history.pushState({}, '', '/record/create?type=height');
    mockAuthenticatedSession();
    listRecordsMock.mockImplementation(async (query) => {
      if (query.start_time || query.end_time) {
        return { list: [], page: 1, page_size: 1, total: 0, has_more: false };
      }
      return { list: [], page: 1, page_size: 5, total: 0, has_more: false };
    });
    const createdRecord = {
      record_no: 'r_height',
      child_no: 'c_001',
      creator_user_no: 'u_001',
      creator_name: '测试用户',
      record_type: 'text',
      title: '小满身高 92.5cm',
      content_text: '身高：92.5 cm\n体重：12.8 kg\n备注：早晨测量',
      media_list: [],
      tags: ['身高记录', '体重记录'],
      event_time: '2026-05-28T10:00:00.000Z',
      location_text: null,
      visibility_scope: 'family',
      is_milestone: false,
      ai_generated_title: null,
      ai_summary: null,
      ai_status: null,
      status: 'published',
      created_at: '2026-05-28T10:00:00.000Z',
      updated_at: '2026-05-28T10:00:00.000Z',
    };
    createRecordMock.mockResolvedValue(createdRecord);
    detailRecordMock.mockResolvedValue(createdRecord);

    render(<App />);

    expect(await screen.findByRole('heading', { name: '记录身高' })).toBeDefined();
    expect(screen.queryByText('成长时间线')).toBeNull();
    fireEvent.change(screen.getByLabelText('身高 cm'), { target: { value: '92.5' } });
    fireEvent.change(screen.getByLabelText('体重 kg'), { target: { value: '12.8' } });
    fireEvent.change(screen.getByLabelText('身高记录备注'), { target: { value: '早晨测量' } });
    fireEvent.click(screen.getByRole('button', { name: '发布' }));

    await waitFor(() => {
      expect(createRecordMock).toHaveBeenCalledWith(expect.objectContaining({
        child_no: 'c_001',
        record_type: 'text',
        title: '小满身高 92.5cm',
        content_text: '身高：92.5 cm\n体重：12.8 kg\n备注：早晨测量',
        tags: ['身高记录', '体重记录'],
        is_milestone: false,
        status: 'published',
      }));
    });
  });

  it('publishes a default record as text when no media is attached', async () => {
    window.history.pushState({}, '', '/record/create');
    mockAuthenticatedSession();
    const createdRecord = {
      record_no: 'r_text_only',
      child_no: 'c_001',
      creator_user_no: 'u_001',
      creator_name: '测试用户',
      record_type: 'text',
      title: '今天会自己收玩具',
      content_text: '小满睡前把积木都放回盒子里，还认真说了晚安。',
      media_list: [],
      tags: [],
      event_time: '2026-05-28T10:00:00.000Z',
      location_text: null,
      visibility_scope: 'family',
      is_milestone: false,
      ai_generated_title: null,
      ai_summary: null,
      ai_status: null,
      status: 'published',
      created_at: '2026-05-28T10:00:00.000Z',
      updated_at: '2026-05-28T10:00:00.000Z',
    };
    createRecordMock.mockResolvedValue(createdRecord);
    detailRecordMock.mockResolvedValue(createdRecord);

    render(<App />);

    fireEvent.change(await screen.findByPlaceholderText('给这一刻起个名字'), {
      target: { value: '今天会自己收玩具' },
    });
    fireEvent.change(screen.getByPlaceholderText('在想什么呢？记录一下这一刻发生的故事…'), {
      target: { value: '小满睡前把积木都放回盒子里，还认真说了晚安。' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发布' }));

    await waitFor(() => {
      expect(createRecordMock).toHaveBeenCalledWith(expect.objectContaining({
        child_no: 'c_001',
        record_type: 'text',
        title: '今天会自己收玩具',
        content_text: '小满睡前把积木都放回盒子里，还认真说了晚安。',
        media_nos: [],
        status: 'published',
      }));
    });
  });

  it('keeps manual location available when map provider search fails', async () => {
    window.history.pushState({}, '', '/record/create?type=text');
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
    detailChildMock.mockResolvedValue({
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
    const createdRecord = {
      record_no: 'r_manual_location',
      child_no: 'c_001',
      creator_user_no: 'u_001',
      creator_name: '测试用户',
      record_type: 'text',
      title: '今天去新的营地',
      content_text: '我们在营地玩了很久。',
      media_list: [],
      tags: [],
      event_time: '2026-05-28T10:00:00.000Z',
      location_text: '迪士尼营地',
      visibility_scope: 'family',
      is_milestone: false,
      ai_generated_title: null,
      ai_summary: null,
      ai_status: null,
      status: 'published',
      created_at: '2026-05-28T10:00:00.000Z',
      updated_at: '2026-05-28T10:00:00.000Z',
    };
    searchLocationsMock.mockRejectedValue(new Error('地图服务返回异常：INVALID_USER_KEY'));
    createRecordMock.mockResolvedValue(createdRecord);
    detailRecordMock.mockResolvedValue(createdRecord);

    render(<App />);

    fireEvent.change(await screen.findByPlaceholderText('给这一刻起个名字'), {
      target: { value: '今天去新的营地' },
    });
    fireEvent.change(screen.getByPlaceholderText('在想什么呢？记录一下这一刻发生的故事…'), {
      target: { value: '我们在营地玩了很久。' },
    });
    fireEvent.change(screen.getByLabelText('搜索地点'), {
      target: { value: '迪士尼营地' },
    });

    expect(await screen.findByText('地点搜索暂时不可用，可继续手动填写或选择常用地点。')).toBeDefined();
    fireEvent.click(await screen.findByRole('button', { name: '使用手动地点：迪士尼营地' }));
    expect(screen.getByText('已使用手动填写的地点「迪士尼营地」，地图恢复后可再搜索更精确地址。')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: '发布' }));

    await waitFor(() => {
      expect(createRecordMock).toHaveBeenCalledWith(expect.objectContaining({
        child_no: 'c_001',
        record_type: 'text',
        title: '今天去新的营地',
        content_text: '我们在营地玩了很久。',
        location_text: '迪士尼营地',
        status: 'published',
      }));
    });
  });

  it('shows phone location failures in a dialog without raw Google Play wording', async () => {
    window.history.pushState({}, '', '/record/create?type=text');
    mockAuthenticatedSession();
    getCurrentDeviceLocationMock.mockRejectedValue(new Error('Google Play services are not available'));

    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: '手机定位' }));

    const dialog = await screen.findByRole('dialog', { name: '操作提示' });
    expect(dialog.textContent).toContain('当前手机定位服务不可用，可手动填写地点或选择常用地点。');
    expect(dialog.textContent).not.toMatch(/Google Play/i);
  });

  it('shows a fixed preview area before capturing media', async () => {
    window.history.pushState({}, '', '/record/create?type=mixed&focus=media');
    mockAuthenticatedSession();

    render(<App />);

    expect(await screen.findByLabelText('媒体预览')).toBeDefined();
    expect(screen.getByTestId('record-media-preview-empty')).toBeDefined();
    expect(screen.getByRole('button', { name: '拍照记录' })).toBeDefined();
    expect(screen.getByRole('button', { name: '拍摄视频' })).toBeDefined();
  });

  it('hides AI controls on the record editor for non AI members', async () => {
    window.history.pushState({}, '', '/record/create?type=text');
    mockAuthenticatedSession();

    render(<App />);

    expect(await screen.findByPlaceholderText('给这一刻起个名字')).toBeDefined();
    expect(screen.queryByRole('button', { name: '会员整理建议' })).toBeNull();
    expect(screen.queryByText('AI 会员可生成标题、摘要和标签建议；发布前内容始终由你确认。')).toBeNull();
  });

  it('shows the empty media preview immediately for video and audio capture routes', async () => {
    mockAuthenticatedSession();

    for (const route of ['/record/create?type=video&focus=media', '/record/create?type=audio&focus=media']) {
      window.history.pushState({}, '', route);
      const view = render(<App />);
      expect(await screen.findByLabelText('媒体预览')).toBeDefined();
      expect(screen.getByTestId('record-media-preview-empty')).toBeDefined();
      view.unmount();
    }
  });

  it('shows selected video preview immediately while upload is still pending', async () => {
    window.history.pushState({}, '', '/record/create?type=video&focus=media');
    mockAuthenticatedSession();
    createUploadTokenMock.mockReturnValue(new Promise(() => undefined));
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:record-video-preview') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });

    try {
      render(<App />);
      const videoInput = await waitFor(() => {
        const input = document.querySelector('input[aria-label="拍摄视频"]');
        expect(input).not.toBeNull();
        return input as HTMLInputElement;
      });

      fireEvent.change(videoInput, {
        target: { files: [new File(['video'], 'clip.mp4', { type: 'video/mp4' })] },
      });

      const preview = await screen.findByLabelText('视频预览');
      expect(preview.querySelector('video')?.getAttribute('src')).toBe('blob:record-video-preview');
      expect(screen.getByText('上传中')).toBeDefined();
      expect(createUploadTokenMock).toHaveBeenCalled();
    } finally {
      if (originalCreateObjectURL) {
        Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectURL });
      } else {
        Reflect.deleteProperty(URL, 'createObjectURL');
      }
      if (originalRevokeObjectURL) {
        Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeObjectURL });
      } else {
        Reflect.deleteProperty(URL, 'revokeObjectURL');
      }
    }
  });

  it('shows an account avatar preview before the upload finishes', async () => {
    window.history.pushState({}, '', '/profile/account');
    mockAuthenticatedSession();
    createUploadTokenMock.mockReturnValue(new Promise(() => undefined));
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:avatar-preview') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });

    try {
      render(<App />);
      const avatarInput = await waitFor(() => {
        const input = document.querySelector('input[type="file"]');
        expect(input).not.toBeNull();
        return input as HTMLInputElement;
      });

      fireEvent.change(avatarInput, {
        target: { files: [new File(['avatar'], 'avatar.JPG', { type: 'image/png' })] },
      });

      await waitFor(() => {
        expect((screen.getByRole('img') as HTMLImageElement).src).toBe('blob:avatar-preview');
      });
      expect(screen.getByText('头像本地预览已显示，正在保存到账号…')).toBeDefined();
      expect(createUploadTokenMock).toHaveBeenCalled();
    } finally {
      if (originalCreateObjectURL) {
        Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectURL });
      } else {
        Reflect.deleteProperty(URL, 'createObjectURL');
      }
      if (originalRevokeObjectURL) {
        Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeObjectURL });
      } else {
        Reflect.deleteProperty(URL, 'revokeObjectURL');
      }
    }
  });

  it('keeps the account avatar visible after a successful upload', async () => {
    window.history.pushState({}, '', '/profile/account');
    mockAuthenticatedSession();
    createUploadTokenMock.mockResolvedValue({
      media_no: 'm_account_avatar_success',
      object_key: 'mock/avatar.png',
      upload_url: 'https://upload.example/avatar.png',
      method: 'PUT',
      headers: {},
      mock_upload: true,
      expires_in: 600,
    });
    confirmUploadMock.mockResolvedValue({
      media_no: 'm_account_avatar_success',
      status: 'ready',
      width: null,
      height: null,
      duration_seconds: null,
      created_at: '2026-05-28T10:00:00.000Z',
      updated_at: '2026-05-28T10:00:00.000Z',
    });
    updateMeMock.mockResolvedValue({
      user_no: 'u_001',
      nickname: 'Avatar user',
      avatar_url: 'media:m_account_avatar_success',
      membership_type: 'free',
    });
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:avatar-success-preview') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });

    try {
      render(<App />);
      const avatarInput = await waitFor(() => {
        const input = document.querySelector('input[type="file"]');
        expect(input).not.toBeNull();
        return input as HTMLInputElement;
      });

      fireEvent.change(avatarInput, {
        target: { files: [new File(['avatar'], 'avatar.png', { type: 'image/png' })] },
      });

      await waitFor(() => {
        expect(updateMeMock).toHaveBeenCalledWith({ avatar_url: 'media:m_account_avatar_success' });
      });
      await waitFor(() => {
        expect((screen.getByRole('img', { name: 'Avatar user' }) as HTMLImageElement).src).toMatch(/^data:image\/png;base64,/);
      });
      expect(mediaAccessUrlMock).not.toHaveBeenCalledWith('m_account_avatar_success');
    } finally {
      if (originalCreateObjectURL) {
        Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectURL });
      } else {
        Reflect.deleteProperty(URL, 'createObjectURL');
      }
      if (originalRevokeObjectURL) {
        Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeObjectURL });
      } else {
        Reflect.deleteProperty(URL, 'revokeObjectURL');
      }
    }
  });

  it('resolves account avatar media references when the local preview cache is missing', async () => {
    window.history.pushState({}, '', '/profile/account');
    window.localStorage.clear();
    refreshMock.mockResolvedValue({
      access_token: 'token-123',
      expires_in: 7200,
      user: {
        user_no: 'u_avatar',
        nickname: '测试用户',
        avatar_url: 'media:m_remote_avatar',
        membership_type: 'free',
      },
      need_create_child: false,
    });
    listChildrenMock.mockResolvedValue([demoChild]);
    detailChildMock.mockResolvedValue(demoChild);
    mediaAccessUrlMock.mockResolvedValue({
      media_no: 'm_remote_avatar',
      access_url: 'https://cdn.example.test/avatar.jpg',
      expires_in: 3600,
    });

    render(<App />);

    await waitFor(() => {
      expect((screen.getByRole('img', { name: '测试用户' }) as HTMLImageElement).src).toBe('https://cdn.example.test/avatar.jpg');
    });
    expect(mediaAccessUrlMock).toHaveBeenCalledWith('m_remote_avatar');
  });

  it('keeps uploaded media preview available after publishing before the server has an access URL', async () => {
    window.history.pushState({}, '', '/record/create?type=mixed&focus=media');
    mockAuthenticatedSession();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const originalFetch = globalThis.fetch;
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:record-photo-preview') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    Object.defineProperty(globalThis, 'fetch', { configurable: true, value: vi.fn().mockResolvedValue({ ok: true }) });

    const createdRecord = {
      record_no: 'r_published_preview',
      child_no: 'c_001',
      creator_user_no: 'u_001',
      creator_name: '测试用户',
      record_type: 'mixed',
      title: '发布后预览',
      content_text: '发布后马上应该看到刚上传的照片。',
      media_list: [
        {
          media_no: 'm_preview_after_publish',
          media_type: 'image',
          access_url: '',
          original_name: 'photo.png',
          mime_type: 'image/png',
          size_bytes: 12,
          width: null,
          height: null,
          duration_seconds: null,
        },
      ],
      tags: [],
      event_time: '2026-05-28T10:00:00.000Z',
      location_text: null,
      visibility_scope: 'family',
      is_milestone: false,
      ai_generated_title: null,
      ai_summary: null,
      ai_status: null,
      status: 'published',
      created_at: '2026-05-28T10:00:00.000Z',
      updated_at: '2026-05-28T10:00:00.000Z',
    };

    createUploadTokenMock.mockResolvedValue({
      media_no: 'm_preview_after_publish',
      object_key: 'mock/photo.png',
      upload_url: 'https://upload.example/photo.png',
      method: 'PUT',
      headers: {},
      mock_upload: false,
      expires_in: 600,
    });
    confirmUploadMock.mockResolvedValue({
      media_no: 'm_preview_after_publish',
      status: 'ready',
      width: null,
      height: null,
      duration_seconds: null,
      created_at: '2026-05-28T10:00:00.000Z',
      updated_at: '2026-05-28T10:00:00.000Z',
    });
    createRecordMock.mockResolvedValue(createdRecord);
    detailRecordMock.mockResolvedValue(createdRecord);

    try {
      render(<App />);
      const fileInput = await waitFor(() => {
        const input = document.querySelector('input[aria-label="拍照记录"]');
        expect(input).not.toBeNull();
        return input as HTMLInputElement;
      });
      fireEvent.change(fileInput, {
        target: { files: [new File(['photo'], 'photo.png', { type: 'image/png' })] },
      });
      await waitFor(() => expect(confirmUploadMock).toHaveBeenCalled());

      fireEvent.change(screen.getByPlaceholderText('给这一刻起个名字'), { target: { value: '发布后预览' } });
      fireEvent.change(screen.getByPlaceholderText('在想什么呢？记录一下这一刻发生的故事…'), { target: { value: '发布后马上应该看到刚上传的照片。' } });
      fireEvent.click(screen.getByRole('button', { name: '发布' }));

      const primaryPreview = await screen.findByTestId('record-primary-media-preview');
      expect(primaryPreview.querySelector('img')?.getAttribute('src')).toMatch(/^(data:image\/png;base64,|blob:record-photo-preview$)/);
    } finally {
      if (originalCreateObjectURL) {
        Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectURL });
      } else {
        Reflect.deleteProperty(URL, 'createObjectURL');
      }
      if (originalRevokeObjectURL) {
        Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeObjectURL });
      } else {
        Reflect.deleteProperty(URL, 'revokeObjectURL');
      }
      if (originalFetch) {
        Object.defineProperty(globalThis, 'fetch', { configurable: true, value: originalFetch });
      } else {
        Reflect.deleteProperty(globalThis, 'fetch');
      }
    }
  });

  it('keeps uploaded video preview available after publishing before the server has an access URL', async () => {
    window.history.pushState({}, '', '/record/create?type=video&focus=media');
    mockAuthenticatedSession();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const originalFetch = globalThis.fetch;
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:record-video-preview') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    Object.defineProperty(globalThis, 'fetch', { configurable: true, value: vi.fn().mockResolvedValue({ ok: true }) });

    const createdRecord = {
      record_no: 'r_published_video_preview',
      child_no: 'c_001',
      creator_user_no: 'u_001',
      creator_name: '测试用户',
      record_type: 'video',
      title: '发布后视频预览',
      content_text: '发布后马上应该看到刚上传的视频。',
      media_list: [
        {
          media_no: 'm_video_after_publish',
          media_type: 'video',
          access_url: '',
          original_name: 'clip.mp4',
          mime_type: 'video/mp4',
          size_bytes: 4_300_001,
          width: null,
          height: null,
          duration_seconds: null,
        },
      ],
      tags: [],
      event_time: '2026-05-28T10:00:00.000Z',
      location_text: null,
      visibility_scope: 'family',
      is_milestone: false,
      ai_generated_title: null,
      ai_summary: null,
      ai_status: null,
      status: 'published',
      created_at: '2026-05-28T10:00:00.000Z',
      updated_at: '2026-05-28T10:00:00.000Z',
    };

    createUploadTokenMock.mockResolvedValue({
      media_no: 'm_video_after_publish',
      object_key: 'mock/clip.mp4',
      upload_url: 'https://upload.example/clip.mp4',
      method: 'PUT',
      headers: {},
      mock_upload: false,
      expires_in: 600,
    });
    confirmUploadMock.mockResolvedValue({
      media_no: 'm_video_after_publish',
      status: 'ready',
      width: null,
      height: null,
      duration_seconds: null,
      created_at: '2026-05-28T10:00:00.000Z',
      updated_at: '2026-05-28T10:00:00.000Z',
    });
    createRecordMock.mockResolvedValue(createdRecord);
    detailRecordMock.mockResolvedValue(createdRecord);

    try {
      render(<App />);
      const videoInput = await waitFor(() => {
        const input = document.querySelector('input[aria-label="拍摄视频"]');
        expect(input).not.toBeNull();
        return input as HTMLInputElement;
      });
      fireEvent.change(videoInput, {
        target: { files: [new File([new Uint8Array(4_300_001)], 'clip.mp4', { type: 'video/mp4' })] },
      });
      await waitFor(() => expect(confirmUploadMock).toHaveBeenCalled());

      fireEvent.change(screen.getByPlaceholderText('给这一刻起个名字'), { target: { value: '发布后视频预览' } });
      fireEvent.change(screen.getByPlaceholderText('在想什么呢？记录一下这一刻发生的故事…'), { target: { value: '发布后马上应该看到刚上传的视频。' } });
      const publishButtons = screen.getAllByRole('button', { name: /发布|完成发布/ });
      fireEvent.click(publishButtons[publishButtons.length - 1]);

      const primaryPreview = await screen.findByTestId('record-primary-media-preview');
      expect(primaryPreview.querySelector('video')?.getAttribute('src')).toBe('blob:record-video-preview');
      expect(primaryPreview.querySelector('video')?.getAttribute('preload')).toBe('none');
      const fullscreenButton = primaryPreview.querySelector('button') as HTMLButtonElement | null;
      expect(fullscreenButton).not.toBeNull();
      fireEvent.click(fullscreenButton!);
      const fullscreenDialog = await screen.findByRole('dialog');
      expect(fullscreenDialog.querySelector('video')?.getAttribute('src')).toBe('blob:record-video-preview');
      expect(fullscreenDialog.querySelector('video')?.getAttribute('preload')).toBe('auto');
    } finally {
      if (originalCreateObjectURL) {
        Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectURL });
      } else {
        Reflect.deleteProperty(URL, 'createObjectURL');
      }
      if (originalRevokeObjectURL) {
        Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeObjectURL });
      } else {
        Reflect.deleteProperty(URL, 'revokeObjectURL');
      }
      if (originalFetch) {
        Object.defineProperty(globalThis, 'fetch', { configurable: true, value: originalFetch });
      } else {
        Reflect.deleteProperty(globalThis, 'fetch');
      }
    }
  });

  it('shows audio records in the primary media preview', async () => {
    window.history.pushState({}, '', '/record/r_audio_preview');
    mockAuthenticatedSession();
    detailRecordMock.mockResolvedValue({
      record_no: 'r_audio_preview',
      child_no: 'c_001',
      creator_user_no: 'u_001',
      creator_name: '测试用户',
      record_type: 'audio',
      title: '睡前故事',
      content_text: '今晚讲了一个很长的故事。',
      media_list: [
        {
          media_no: 'm_audio_001',
          media_type: 'audio',
          access_url: 'https://example.com/audio/story.m4a',
          original_name: 'story.m4a',
          mime_type: 'audio/x-m4a',
          size_bytes: 1200,
          width: null,
          height: null,
          duration_seconds: 8,
        },
      ],
      tags: [],
      event_time: '2026-05-28T10:00:00.000Z',
      location_text: '家里',
      visibility_scope: 'family',
      is_milestone: false,
      ai_generated_title: null,
      ai_summary: null,
      ai_status: null,
      status: 'published',
      created_at: '2026-05-28T10:00:00.000Z',
      updated_at: '2026-05-28T10:00:00.000Z',
    });

    render(<App />);

    const primaryPreview = await screen.findByTestId('record-primary-media-preview');
    expect(screen.getAllByLabelText('语音预览').length).toBeGreaterThan(0);
    expect(primaryPreview.querySelector('audio')?.getAttribute('src')).toBe('https://example.com/audio/story.m4a');
  });

  it('shows AI generated titles on record details', async () => {
    window.history.pushState({}, '', '/record/r_ai_title');
    mockAuthenticatedSession({ membership_type: 'ai_plus' });
    detailRecordMock.mockResolvedValue({
      record_no: 'r_ai_title',
      child_no: 'c_001',
      creator_user_no: 'u_001',
      creator_name: '测试用户',
      record_type: 'text',
      title: null,
      content_text: '今天第一次自己整理玩具。',
      media_list: [],
      tags: [],
      event_time: '2026-05-28T10:00:00.000Z',
      location_text: '家里',
      visibility_scope: 'family',
      is_milestone: false,
      ai_generated_title: '第一次主动整理玩具',
      ai_summary: null,
      ai_status: 'success',
      status: 'published',
      created_at: '2026-05-28T10:00:00.000Z',
      updated_at: '2026-05-28T10:00:00.000Z',
    });

    render(<App />);

    expect(await screen.findByRole('heading', { name: '第一次主动整理玩具' })).toBeDefined();
    expect(screen.getByText('建议标题：第一次主动整理玩具')).toBeDefined();
    expect(screen.queryByText('当前还没有整理摘要，可以点击下方按钮生成标题、摘要或标签。')).toBeNull();
  });

  it('hides AI extraction on record details for non AI members', async () => {
    window.history.pushState({}, '', '/record/r_ai_hidden');
    mockAuthenticatedSession();
    detailRecordMock.mockResolvedValue({
      record_no: 'r_ai_hidden',
      child_no: 'c_001',
      creator_user_no: 'u_001',
      creator_name: '测试用户',
      record_type: 'text',
      title: null,
      content_text: '今天第一次自己整理玩具。',
      media_list: [],
      tags: [],
      event_time: '2026-05-28T10:00:00.000Z',
      location_text: '家里',
      visibility_scope: 'family',
      is_milestone: false,
      ai_generated_title: '第一次主动整理玩具',
      ai_summary: '孩子主动整理玩具。',
      ai_status: 'success',
      status: 'published',
      created_at: '2026-05-28T10:00:00.000Z',
      updated_at: '2026-05-28T10:00:00.000Z',
    });

    render(<App />);

    expect(await screen.findByRole('heading', { name: '未命名记录' })).toBeDefined();
    expect(screen.queryByText('智能整理')).toBeNull();
    expect(screen.queryByText('建议标题：第一次主动整理玩具')).toBeNull();
  });

  it('uses neutral home prompts when the child profile has no display name', async () => {
    window.history.pushState({}, '', '/home');
    refreshMock.mockResolvedValue({
      access_token: 'token-123',
      expires_in: 7200,
      user: {
        user_no: 'u_no_child',
        nickname: '测试用户',
        avatar_url: null,
        membership_type: 'free',
      },
      need_create_child: false,
    });
    const blankNameChild = {
      child_no: 'c_blank',
      family_no: 'f_001',
      owner_user_no: 'u_no_child',
      name: '   ',
      avatar_url: null,
      birthday: '2025-01-01',
      gender: 'female',
      birth_place: '上海',
      remark: null,
      current_age_display: '1岁2月',
      status: 'normal',
      created_at: '2026-04-21T00:00:00.000Z',
      updated_at: '2026-04-21T00:00:00.000Z',
    };
    listChildrenMock.mockResolvedValue([blankNameChild]);
    detailChildMock.mockResolvedValue(blankNameChild);
    listRecordsMock.mockResolvedValue({
      list: [],
      page: 1,
      page_size: 5,
      total: 0,
      has_more: false,
    });

    render(<App />);

    expect((await screen.findAllByText('今天想和我聊聊孩子的什么趣事呢?')).length).toBeGreaterThan(0);
    expect(screen.queryAllByText('今天想和我聊聊小满的什么趣事呢?')).toHaveLength(0);
  });

  it('uses real profile context and nianlun branding without placeholder copy', async () => {
    window.history.pushState({}, '', '/profile');
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
    detailChildMock.mockResolvedValue({
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
    listRecordsMock.mockResolvedValue({
      list: [],
      page: 1,
      page_size: 3,
      total: 0,
      has_more: false,
    });

    render(<App />);

    expect(await screen.findByText('当前档案：小满')).toBeDefined();
    expect(screen.queryByText('ID: 00000001')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /关于我们/ }));

    expect(await screen.findByRole('heading', { name: 'nianlun' })).toBeDefined();
    expect(screen.getByText('版本 1.0.0（构建 20260514）')).toBeDefined();
    expect(screen.queryByRole('heading', { name: '孩子的人生档案馆' })).toBeNull();
    expect(screen.queryByText(/familyarchive\.com/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /服务说明/ }));

    expect(screen.getByText('当前版本已覆盖成长记录、家庭协作、时间轴回看、档案导出和运营后台管理。')).toBeDefined();
    expect(screen.queryByText(/官网信息将随服务发布节奏同步更新/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /联系我们/ }));

    expect(await screen.findByRole('heading', { name: '帮助与反馈' })).toBeDefined();
    expect(screen.queryByText(/familyarchive\.com/)).toBeNull();
  });

  it('opens family member management from the profile family management row', async () => {
    window.history.pushState({}, '', '/profile');
    mockAuthenticatedSession();
    listRecordsMock.mockResolvedValue({
      list: [],
      page: 1,
      page_size: 3,
      total: 0,
      has_more: false,
    });
    listFamilyMembersMock.mockResolvedValue({
      family_no: 'f_001',
      list: [
        {
          user_no: 'u_001',
          nickname: '测试用户',
          mobile_masked: '138****0000',
          role: 'owner',
          status: 1,
          joined_at: '2026-04-21T00:00:00.000Z',
          invited_by_user_no: null,
        },
      ],
    });

    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: /家庭管理/ }));

    await waitFor(() => expect(window.location.pathname).toBe('/family/members'));
    expect(listFamilyMembersMock).toHaveBeenCalledWith('f_001');
  });

  it('does not fall back to another member when a family member URL is invalid', async () => {
    window.history.pushState({}, '', '/family/members/u_missing');
    mockAuthenticatedSession();
    listFamilyMembersMock.mockResolvedValue({
      family_no: 'f_001',
      list: [
        {
          user_no: 'u_001',
          nickname: '测试用户',
          mobile_masked: '138****0000',
          role: 'owner',
          status: 1,
          joined_at: '2026-04-21T00:00:00.000Z',
          invited_by_user_no: null,
        },
      ],
    });
    listRecordsMock.mockResolvedValue({
      list: [
        {
          record_no: 'r_owner',
          cover_media_no: null,
          cover_media_type: null,
          cover_url: null,
          title: '管理员的记录',
          summary: '不应该出现在错误成员页',
          ai_summary: null,
          event_time: '2026-05-28T10:00:00.000Z',
          location_text: null,
          tags: [],
          creator_user_no: 'u_001',
          creator_name: '测试用户',
          is_milestone: false,
          record_type: 'text',
          status: 'published',
        },
      ],
      page: 1,
      page_size: 30,
      total: 1,
      has_more: false,
    });

    render(<App />);

    expect(await screen.findByText('未找到该家庭成员。')).toBeDefined();
    expect(screen.queryByText('管理员的记录')).toBeNull();
  });

  it('opens a prefilled help request from the family member remove action', async () => {
    window.history.pushState({}, '', '/family/members/u_member');
    mockAuthenticatedSession();
    listFamilyMembersMock.mockResolvedValue({
      family_no: 'f_001',
      list: [
        {
          user_no: 'u_member',
          nickname: '家庭成员',
          mobile_masked: '139****0000',
          role: 'editor',
          status: 1,
          joined_at: '2026-04-22T00:00:00.000Z',
          invited_by_user_no: 'u_001',
        },
      ],
    });
    listRecordsMock.mockResolvedValue({
      list: [],
      page: 1,
      page_size: 30,
      total: 0,
      has_more: false,
    });

    render(<App />);

    expect(await screen.findByRole('heading', { name: '家人资料' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /移出家庭/ }));

    expect(await screen.findByRole('heading', { name: '帮助与反馈' })).toBeDefined();
    expect(screen.getByRole('combobox', { name: '问题类型' }).textContent).toContain('数据异常');
    expect((screen.getByLabelText('反馈内容') as HTMLTextAreaElement).value).toContain('u_member');
  });

  it('clears search history without clearing the active keyword or results', async () => {
    window.history.pushState({}, '', '/search');
    window.localStorage.setItem('nianlun.search.history.v1', JSON.stringify(['公园', '星星']));
    mockAuthenticatedSession();
    listRecordsMock.mockResolvedValue({
      list: [
        {
          record_no: 'r_search',
          cover_media_no: null,
          cover_media_type: null,
          cover_url: null,
          title: '公园里追光的小跑步',
          summary: '在社区公园完成第一次独立跑步。',
          ai_summary: null,
          event_time: '2026-05-28T10:00:00.000Z',
          location_text: '社区公园',
          tags: ['跑步'],
          creator_user_no: 'u_001',
          creator_name: '测试用户',
          is_milestone: false,
          record_type: 'text',
          status: 'published',
        },
      ],
      page: 1,
      page_size: 50,
      total: 1,
      has_more: false,
    });

    try {
      render(<App />);

      const keywordInput = (await screen.findByLabelText('搜索关键词')) as HTMLInputElement;
      fireEvent.change(keywordInput, { target: { value: '公园' } });
      fireEvent.click(screen.getByRole('button', { name: '搜索' }));

      expect(await screen.findByText('公园里追光的小跑步')).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: '清空' }));

      expect(keywordInput.value).toBe('公园');
      expect(screen.getByText('公园里追光的小跑步')).toBeDefined();
      expect(screen.queryByRole('button', { name: '星星' })).toBeNull();
    } finally {
      window.localStorage.removeItem('nianlun.search.history.v1');
    }
  });

  it('keeps basic membership copy and security binding status truthful', async () => {
    window.history.pushState({}, '', '/profile/membership');
    mockAuthenticatedSession();

    const { unmount } = render(<App />);

    expect(await screen.findByRole('heading', { name: '会员中心' })).toBeDefined();
    expect(screen.getByText('BASIC')).toBeDefined();
    expect(screen.getByText(/当前账号为基础会员/)).toBeDefined();
    expect(screen.queryByText('VIP PRO')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '咨询会员权益' }));
    expect(await screen.findByRole('heading', { name: '帮助与反馈' })).toBeDefined();
    expect(screen.getByRole('combobox', { name: '问题类型' }).textContent).toContain('功能建议');
    expect((screen.getByLabelText('反馈内容') as HTMLTextAreaElement).value).toContain('咨询会员权益');

    unmount();
    window.history.pushState({}, '', '/profile/security');
    render(<App />);
    expect(await screen.findByRole('heading', { name: '账号与安全' })).toBeDefined();
    expect(screen.getByText('暂未接入')).toBeDefined();
    expect(screen.queryByText('已绑定微信')).toBeNull();
  });

  it('offers a help fallback when premium membership book requests fail', async () => {
    window.history.pushState({}, '', '/profile/membership');
    refreshMock.mockResolvedValue({
      access_token: 'token-premium',
      expires_in: 7200,
      user: {
        user_no: 'u_premium',
        nickname: '高级会员',
        avatar_url: null,
        mobile: '138****0000',
        membership_type: 'premium',
      },
      need_create_child: false,
    });
    listChildrenMock.mockResolvedValue([demoChild]);
    detailChildMock.mockResolvedValue(demoChild);
    requestMembershipBookMock.mockRejectedValue(new Error('offline'));

    render(<App />);

    expect(await screen.findByRole('heading', { name: '会员中心' })).toBeDefined();
    expect(screen.getByText('VIP PRO')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '免费申领本年度纪念册' }));

    expect(await screen.findByText('申领暂时无法同步服务器，请通过帮助与反馈提交申请。')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '打开帮助与反馈' }));

    expect(await screen.findByRole('heading', { name: '帮助与反馈' })).toBeDefined();
    expect(screen.getByRole('combobox', { name: '问题类型' }).textContent).toContain('功能建议');
    expect((screen.getByLabelText('反馈内容') as HTMLTextAreaElement).value).toContain('成长纪念册申领');
  });

  it('marks short feedback validation as an error without submitting', async () => {
    window.history.pushState({}, '', '/profile/help');
    mockAuthenticatedSession();

    render(<App />);

    expect(await screen.findByRole('heading', { name: '帮助与反馈' })).toBeDefined();
    fireEvent.change(screen.getByLabelText('反馈内容'), { target: { value: '太短' } });
    fireEvent.click(screen.getByRole('button', { name: '提交反馈' }));

    const validation = await screen.findByText('请至少输入 6 个字，方便定位问题。');
    expect(validation.getAttribute('style')).toContain('var(--nl-danger)');
    expect(submitFeedbackMock).not.toHaveBeenCalled();
  });

  it('keeps feedback content when offline local save is blocked', async () => {
    window.history.pushState({}, '', '/profile/help?topic=membership');
    mockAuthenticatedSession();
    submitFeedbackMock.mockRejectedValue(new Error('offline'));

    render(<App />);

    expect(await screen.findByRole('heading', { name: '帮助与反馈' })).toBeDefined();
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    try {
      fireEvent.click(screen.getByRole('button', { name: '提交反馈' }));

      expect(await screen.findByText('暂时无法同步服务器，本机也无法保存，请稍后重试或复制内容后联系支持。')).toBeDefined();
      expect((screen.getByLabelText('反馈内容') as HTMLTextAreaElement).value).toContain('咨询会员权益');
    } finally {
      setItemSpy.mockRestore();
    }
  });

  it('validates account deletion password length before submitting', async () => {
    window.history.pushState({}, '', '/profile/account-delete');
    mockAuthenticatedSession();
    deletionCheckMock.mockResolvedValue({
      can_delete: true,
      requires_password: true,
      confirm_text: '确认注销',
      blockers: [],
      summary: {
        owned_family_count: 0,
        joined_family_count: 0,
        active_child_count: 0,
        active_record_count: 0,
      },
    });

    render(<App />);

    expect(await screen.findByRole('heading', { name: '注销账号' })).toBeDefined();
    fireEvent.change(screen.getByLabelText('登录密码'), { target: { value: '123' } });
    fireEvent.change(screen.getByLabelText(/确认文案/), { target: { value: '确认注销' } });
    fireEvent.click(screen.getByRole('button', { name: '确认注销账号' }));

    expect(await screen.findByText('登录密码至少 8 位')).toBeDefined();
    expect(deleteMeMock).not.toHaveBeenCalled();
  });

  it('uses real home entry points instead of unavailable shortcuts', async () => {
    window.history.pushState({}, '', '/home');
    mockAuthenticatedSession();
    listRecordsMock.mockResolvedValue({
      list: [],
      page: 1,
      page_size: 5,
      total: 0,
      has_more: false,
    });

    render(<App />);

    expect(await screen.findByRole('button', { name: /成长星球/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /记录此刻/ })).toBeDefined();
    expect(screen.queryByRole('button', { name: /月报/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /未来信箱/ })).toBeNull();
  });

  it('keeps monthly report empty state based on real records only', async () => {
    window.history.pushState({}, '', '/profile/reports');
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
    detailChildMock.mockResolvedValue({
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
    listRecordsMock.mockResolvedValue({
      list: [],
      page: 1,
      page_size: 100,
      total: 0,
      has_more: false,
    });

    render(<App />);

    expect(await screen.findByRole('heading', { name: '月报与纪念册' })).toBeDefined();
    expect(screen.getByText('月度故事摘要')).toBeDefined();
    expect(screen.getByText('月报空状态')).toBeDefined();
    expect(screen.getByText('本月还没有记录')).toBeDefined();
    expect(screen.getByText('该月还没有可生成月报的真实记录。添加记录后，这里会按实际内容整理故事摘要、里程碑和影像回顾。')).toBeDefined();
    expect(screen.getByText('添加记录')).toBeDefined();
    expect(screen.queryByText('本月故事摘要')).toBeNull();
    expect(screen.queryByText('记录本月第一条')).toBeNull();
    expect(screen.queryByText(/小满完成了第一次独立走路/)).toBeNull();
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(2);
    const latestReportDate = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
    const latestBookLabel = `${latestReportDate.getFullYear()}年${latestReportDate.getMonth() + 1}月纪念册`;
    expect(Array.from(document.querySelectorAll('button strong')).map((node) => node.textContent)).not.toContain(latestBookLabel);
  });
});
