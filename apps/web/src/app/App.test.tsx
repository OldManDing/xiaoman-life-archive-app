import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';
import { clearLoginFormDraft } from '../pages/auth-pages';
import { clearAccessToken } from '../shared/auth/tokenMemory';

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
    createAiJob: vi.fn(),
    detailAiJob: vi.fn(),
    createUploadToken: vi.fn(),
    confirmUpload: vi.fn(),
    mediaAccessUrl: vi.fn(),
    searchLocations: vi.fn(),
    me: vi.fn(),
    detailChild: vi.fn(),
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
const searchLocationsMock = vi.mocked(webApi.searchLocations);
const updateMeMock = vi.mocked(webApi.updateMe);
const createUploadTokenMock = vi.mocked(webApi.createUploadToken);
const confirmUploadMock = vi.mocked(webApi.confirmUpload);
const mediaAccessUrlMock = vi.mocked(webApi.mediaAccessUrl);
const getCurrentDeviceLocationMock = vi.mocked(getCurrentDeviceLocation);

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

const mockAuthenticatedSession = () => {
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
    searchLocationsMock.mockReset();
    updateMeMock.mockReset();
    createUploadTokenMock.mockReset();
    confirmUploadMock.mockReset();
    mediaAccessUrlMock.mockReset();
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
    expect(screen.getByText('正在进入年轮…')).toBeDefined();
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
      expect(primaryPreview.querySelector('img')?.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
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

    expect(await screen.findByText('孩子最近最喜欢的一件玩具是什么？它有什么特别的故事吗？')).toBeDefined();
    expect(screen.queryByText('小满最近最喜欢的一件玩具是什么？它有什么特别的故事吗？')).toBeNull();
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
    expect(screen.getByText('这个月还没有可生成月报的真实记录。发布第一条记录后，这里会按实际内容整理故事摘要、里程碑和影像回顾。')).toBeDefined();
    expect(screen.getByText('记录本月第一条')).toBeDefined();
    expect(screen.queryByText(/小满完成了第一次独立走路/)).toBeNull();
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(2);
  });
});
