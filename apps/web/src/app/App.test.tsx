import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';
import { clearLoginFormDraft } from '../pages/auth-pages';
import { clearAccessToken } from '../shared/auth/tokenMemory';
import { clearMediaAccessUrlCache } from '../shared/hooks';
import { clearWelcomeIntroSeen } from '../shared/welcome';

vi.mock('../shared/api/webApi', () => ({
  webApi: {
    refresh: vi.fn(),
    sendCode: vi.fn(),
    listChildren: vi.fn(),
    logout: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    updateMe: vi.fn(),
    changePassword: vi.fn(),
    requestArchiveExport: vi.fn(),
    listArchiveExportRequests: vi.fn(),
    archiveExportSummary: vi.fn(),
    createChild: vi.fn(),
    createRecord: vi.fn(),
    listRecords: vi.fn(),
    detailRecord: vi.fn(),
    updateRecord: vi.fn(),
    deleteRecord: vi.fn(),
    previewAi: vi.fn(),
    createAiJob: vi.fn(),
    detailAiJob: vi.fn(),
    createUploadToken: vi.fn(),
    confirmUpload: vi.fn(),
    mediaAccessUrl: vi.fn(),
    searchLocations: vi.fn(),
    me: vi.fn(),
    preferences: vi.fn(),
    updatePreferences: vi.fn(),
    listNotifications: vi.fn(),
    notificationUnreadCount: vi.fn(),
    markNotificationRead: vi.fn(),
    markAllNotificationsRead: vi.fn(),
    checkAppUpdate: vi.fn(),
    submitFeedback: vi.fn(),
    listFeedback: vi.fn(),
    requestMembershipBook: vi.fn(),
    listMembershipBookRequests: vi.fn(),
    deletionCheck: vi.fn(),
    deleteMe: vi.fn(),
    detailChild: vi.fn(),
    listFamilyMembers: vi.fn(),
    listFamilyMemberOperations: vi.fn(),
    deleteFamilyMember: vi.fn(),
    updateFamilyMemberRole: vi.fn(),
    createFamilyInvite: vi.fn(),
  },
}));

vi.mock('../shared/deviceLocation', () => ({
  getCurrentDeviceLocation: vi.fn(),
}));

vi.mock('../shared/nativeNotifications', () => ({
  getNativeNotificationPermissionStatus: vi.fn(),
  requestNativeNotificationPermission: vi.fn(),
  registerNativeNotificationTapHandler: vi.fn(() => () => undefined),
  scheduleNativeNotificationsForNewItems: vi.fn(),
}));

import { webApi } from '../shared/api/webApi';
import { getCurrentDeviceLocation } from '../shared/deviceLocation';
import { getNativeNotificationPermissionStatus, requestNativeNotificationPermission } from '../shared/nativeNotifications';

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
const previewAiMock = vi.mocked(webApi.previewAi);
const createAiJobMock = vi.mocked(webApi.createAiJob);
const detailAiJobMock = vi.mocked(webApi.detailAiJob);
const searchLocationsMock = vi.mocked(webApi.searchLocations);
const updateMeMock = vi.mocked(webApi.updateMe);
const changePasswordMock = vi.mocked(webApi.changePassword);
const requestArchiveExportMock = vi.mocked(webApi.requestArchiveExport);
const listArchiveExportRequestsMock = vi.mocked(webApi.listArchiveExportRequests);
const archiveExportSummaryMock = vi.mocked(webApi.archiveExportSummary);
const meMock = vi.mocked(webApi.me);
const preferencesMock = vi.mocked(webApi.preferences);
const updatePreferencesMock = vi.mocked(webApi.updatePreferences);
const listNotificationsMock = vi.mocked(webApi.listNotifications);
const notificationUnreadCountMock = vi.mocked(webApi.notificationUnreadCount);
const markNotificationReadMock = vi.mocked(webApi.markNotificationRead);
const markAllNotificationsReadMock = vi.mocked(webApi.markAllNotificationsRead);
const checkAppUpdateMock = vi.mocked(webApi.checkAppUpdate);
const submitFeedbackMock = vi.mocked(webApi.submitFeedback);
const listFeedbackMock = vi.mocked(webApi.listFeedback);
const requestMembershipBookMock = vi.mocked(webApi.requestMembershipBook);
const listMembershipBookRequestsMock = vi.mocked(webApi.listMembershipBookRequests);
const deletionCheckMock = vi.mocked(webApi.deletionCheck);
const deleteMeMock = vi.mocked(webApi.deleteMe);
const createUploadTokenMock = vi.mocked(webApi.createUploadToken);
const confirmUploadMock = vi.mocked(webApi.confirmUpload);
const mediaAccessUrlMock = vi.mocked(webApi.mediaAccessUrl);
const listFamilyMembersMock = vi.mocked(webApi.listFamilyMembers);
const listFamilyMemberOperationsMock = vi.mocked(webApi.listFamilyMemberOperations);
const deleteFamilyMemberMock = vi.mocked(webApi.deleteFamilyMember);
const updateFamilyMemberRoleMock = vi.mocked(webApi.updateFamilyMemberRole);
const createFamilyInviteMock = vi.mocked(webApi.createFamilyInvite);
const getCurrentDeviceLocationMock = vi.mocked(getCurrentDeviceLocation);
const getNativeNotificationPermissionStatusMock = vi.mocked(getNativeNotificationPermissionStatus);
const requestNativeNotificationPermissionMock = vi.mocked(requestNativeNotificationPermission);
const optionalInvitePlaceholder = '邀请码';

const installMediaMetadataMocks = ({
  imageWidth = 1200,
  imageHeight = 900,
  videoWidth = 1280,
  videoHeight = 720,
  duration = 8,
}: {
  imageWidth?: number;
  imageHeight?: number;
  videoWidth?: number;
  videoHeight?: number;
  duration?: number;
} = {}) => {
  const originalImage = window.Image;
  const originalCreateElement = document.createElement.bind(document);

  class MockImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    naturalWidth = imageWidth;
    naturalHeight = imageHeight;
    width = imageWidth;
    height = imageHeight;

    set src(_value: string) {
      window.setTimeout(() => this.onload?.(), 0);
    }
  }

  Object.defineProperty(window, 'Image', { configurable: true, value: MockImage as unknown as typeof Image });
  const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
    const element = originalCreateElement(tagName, options);
    if (tagName.toLowerCase() === 'video') {
      Object.defineProperty(element, 'videoWidth', { configurable: true, value: videoWidth });
      Object.defineProperty(element, 'videoHeight', { configurable: true, value: videoHeight });
      Object.defineProperty(element, 'duration', { configurable: true, value: duration });
      Object.defineProperty(element, 'load', { configurable: true, value: vi.fn(() => {
        window.setTimeout(() => element.dispatchEvent(new Event('loadedmetadata')), 0);
      }) });
    }
    if (tagName.toLowerCase() === 'audio') {
      Object.defineProperty(element, 'duration', { configurable: true, value: duration });
      Object.defineProperty(element, 'load', { configurable: true, value: vi.fn(() => {
        window.setTimeout(() => element.dispatchEvent(new Event('loadedmetadata')), 0);
      }) });
      vi.spyOn(element as HTMLAudioElement, 'canPlayType').mockReturnValue('probably');
    }
    return element;
  }) as typeof document.createElement);

  return () => {
    Object.defineProperty(window, 'Image', { configurable: true, value: originalImage });
    createElementSpy.mockRestore();
  };
};

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

const mockAuthenticatedSession = (
  userOverrides: Partial<{
    nickname: string;
    avatar_url: string | null;
    avatar_media_no: string | null;
    mobile: string | null;
    membership_type: string;
    membership_expire_at: string | null;
  }> = {},
) => {
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
    previewAiMock.mockReset();
    createAiJobMock.mockReset();
    detailAiJobMock.mockReset();
    searchLocationsMock.mockReset();
    updateMeMock.mockReset();
    changePasswordMock.mockReset();
    changePasswordMock.mockResolvedValue({ success: true, updated_at: '2026-06-22T00:00:00.000Z', message: '登录密码已更新' });
    requestArchiveExportMock.mockReset();
    listArchiveExportRequestsMock.mockReset();
    listArchiveExportRequestsMock.mockResolvedValue({ list: [] });
    archiveExportSummaryMock.mockReset();
    meMock.mockReset();
    preferencesMock.mockReset();
    updatePreferencesMock.mockReset();
    listNotificationsMock.mockReset();
    listNotificationsMock.mockResolvedValue({ list: [], page: 1, page_size: 20, total: 0, has_more: false });
    notificationUnreadCountMock.mockReset();
    notificationUnreadCountMock.mockResolvedValue({ unread_count: 0 });
    markNotificationReadMock.mockReset();
    markNotificationReadMock.mockResolvedValue({ success: true, notification_no: 'msg_001', read_at: '2026-06-22T00:00:00.000Z' });
    markAllNotificationsReadMock.mockReset();
    markAllNotificationsReadMock.mockResolvedValue({ success: true, updated_count: 0 });
    checkAppUpdateMock.mockReset();
    checkAppUpdateMock.mockResolvedValue({
      platform: 'android',
      current_version: '2.0.3',
      current_build_number: 0,
      latest_version: '2.0.3',
      latest_build_number: 0,
      release_notes: '暂无更新说明。',
      apk_url: null,
      update_available: false,
      force_update: false,
      checked_at: '2026-06-22T00:00:00.000Z',
    });
    submitFeedbackMock.mockReset();
    listFeedbackMock.mockReset();
    listFeedbackMock.mockResolvedValue({ list: [] });
    requestMembershipBookMock.mockReset();
    listMembershipBookRequestsMock.mockReset();
    listMembershipBookRequestsMock.mockResolvedValue({ list: [] });
    deletionCheckMock.mockReset();
    deleteMeMock.mockReset();
    createUploadTokenMock.mockReset();
    confirmUploadMock.mockReset();
    mediaAccessUrlMock.mockReset();
    listFamilyMembersMock.mockReset();
    listFamilyMemberOperationsMock.mockReset();
    listFamilyMemberOperationsMock.mockResolvedValue({ family_no: 'f_001', list: [] });
    deleteFamilyMemberMock.mockReset();
    updateFamilyMemberRoleMock.mockReset();
    createFamilyInviteMock.mockReset();
    clearMediaAccessUrlCache();
    clearWelcomeIntroSeen();
    getCurrentDeviceLocationMock.mockReset();
    getNativeNotificationPermissionStatusMock.mockReset();
    getNativeNotificationPermissionStatusMock.mockResolvedValue('granted');
    requestNativeNotificationPermissionMock.mockReset();
    requestNativeNotificationPermissionMock.mockResolvedValue('granted');
    window.localStorage.removeItem('xiaoman-web-local-settings');
    window.history.pushState({}, '', '/auth/login');
  });

  afterEach(() => {
    vi.useRealTimers();
    clearAccessToken();
    clearLoginFormDraft();
    vi.clearAllMocks();
  });

  it('shows bootstrap loading state before auth resolves', () => {
    window.history.pushState({}, '', '/home');
    refreshMock.mockReturnValue(new Promise(() => undefined));
    render(<App />);
    expect(screen.getByLabelText('正在进入年轮')).toBeDefined();
    expect(screen.getByText('家庭影像档案')).toBeDefined();
  });

  it('offers a login exit when bootstrap takes too long', async () => {
    window.history.pushState({}, '', '/home');
    vi.useFakeTimers();
    refreshMock.mockReturnValue(new Promise(() => undefined));

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(8000);
    });
    expect(screen.getByRole('status', { name: '启动恢复' })).toBeDefined();
    expect(screen.getByText('启动时间较长')).toBeDefined();

    vi.useRealTimers();
    fireEvent.click(screen.getByRole('button', { name: '回到登录' }));

    expect(await screen.findByRole('heading', { name: '登录注册' })).toBeDefined();
  });

  it('redirects to login if unauthenticated after bootstrap', async () => {
    refreshMock.mockRejectedValue(new Error('unauthorized'));
    render(<App />);
    expect(await screen.findByText('登录注册')).toBeDefined();
    expect(screen.queryByText('使用账号密码进入年轮。')).toBeNull();
    expect(screen.queryByText('一家人的成长年轮，慢慢沉淀成档案。')).toBeNull();
  });

  it('shows the welcome intro before login on the first protected entry', async () => {
    window.history.pushState({}, '', '/home');
    refreshMock.mockRejectedValue(new Error('unauthorized'));

    render(<App />);

    expect(await screen.findByRole('button', { name: '开始使用' })).toBeDefined();
    expect(screen.getByAltText('年轮成长时间线介绍海报').getAttribute('src')).toBe('/posters/welcome-growth-timeline.png');
    expect(screen.getByAltText('年轮影像归档介绍海报').getAttribute('src')).toBe('/posters/welcome-media-archive.png');
    expect(screen.getByAltText('年轮家庭协作介绍海报').getAttribute('src')).toBe('/posters/welcome-family-notice.png');
    expect(window.location.pathname).toBe('/welcome');

    fireEvent.click(screen.getByRole('button', { name: '开始使用' }));

    await waitFor(() => expect(window.location.pathname).toBe('/auth/login'));
    expect(await screen.findByLabelText('账号')).toBeDefined();
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

  it('sets mobile-friendly login keyboard hints and exposes a back action', async () => {
    refreshMock.mockRejectedValue(new Error('unauthorized'));
    render(<App />);

    const accountInput = await screen.findByLabelText('账号');
    expect(accountInput.getAttribute('inputmode')).toBe('email');
    expect(accountInput.getAttribute('enterkeyhint')).toBe('next');
    expect(accountInput.getAttribute('autocomplete')).toBe('username');
    expect(screen.getByLabelText('密码').getAttribute('enterkeyhint')).toBe('done');
    expect(screen.getByRole('button', { name: '返回' })).toBeDefined();
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

    fireEvent.change(await screen.findByPlaceholderText('账号'), { target: { value: 'parent_account' } });
    fireEvent.change(screen.getByPlaceholderText('密码'), { target: { value: 'Parent123!' } });
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

    fireEvent.change(await screen.findByPlaceholderText('账号'), { target: { value: 'parent_account' } });
    fireEvent.change(screen.getByPlaceholderText('密码'), { target: { value: 'Parent123!' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '协议与隐私' }));

    expect(await screen.findByText('关于与协议')).toBeDefined();
    fireEvent.click(screen.getByLabelText('返回'));

    expect(await screen.findByText('登录注册')).toBeDefined();
    expect((screen.getByPlaceholderText('账号') as HTMLInputElement).value).toBe('parent_account');
    expect((screen.getByPlaceholderText('密码') as HTMLInputElement).value).toBe('Parent123!');
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
  });

  it('preserves registration form input after viewing legal content', async () => {
    refreshMock.mockRejectedValue(new Error('unauthorized'));

    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: '注册' }));
    fireEvent.change(screen.getByPlaceholderText('账号'), { target: { value: 'new_parent' } });
    fireEvent.change(screen.getByPlaceholderText('密码'), { target: { value: 'Parent123!' } });
    fireEvent.change(screen.getByPlaceholderText('确认密码'), { target: { value: 'Parent123!' } });
    fireEvent.change(screen.getByPlaceholderText(optionalInvitePlaceholder), { target: { value: 'NL-REG001-REG002' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '协议与隐私' }));

    expect(await screen.findByText('关于与协议')).toBeDefined();
    fireEvent.click(screen.getByLabelText('返回'));

    expect(await screen.findByText('登录注册')).toBeDefined();
    expect((screen.getByPlaceholderText('账号') as HTMLInputElement).value).toBe('new_parent');
    expect((screen.getByPlaceholderText('密码') as HTMLInputElement).value).toBe('Parent123!');
    expect((screen.getByPlaceholderText('确认密码') as HTMLInputElement).value).toBe('Parent123!');
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

    expect((await screen.findByPlaceholderText('账号') as HTMLInputElement).value).toBe('cached_parent');
    expect((screen.getByPlaceholderText('密码') as HTMLInputElement).value).toBe('');
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
    expect(await screen.findByText('成长封面')).toBeDefined();
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
    fireEvent.change(screen.getByPlaceholderText('账号'), { target: { value: 'standalone_parent' } });
    fireEvent.change(screen.getByPlaceholderText('密码'), { target: { value: 'Parent123!' } });
    fireEvent.change(screen.getByPlaceholderText('确认密码'), { target: { value: 'Parent123!' } });
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
    fireEvent.change(screen.getByPlaceholderText('账号'), { target: { value: 'new_parent' } });
    fireEvent.change(screen.getByPlaceholderText('密码'), { target: { value: 'Parent123!' } });
    fireEvent.change(screen.getByPlaceholderText('确认密码'), { target: { value: 'Parent123!' } });
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
    fireEvent.change(screen.getByPlaceholderText('账号'), { target: { value: 'new_parent' } });
    fireEvent.change(screen.getByPlaceholderText('密码'), { target: { value: '123456' } });
    fireEvent.change(screen.getByPlaceholderText('确认密码'), { target: { value: '123456' } });
    fireEvent.change(screen.getByPlaceholderText(optionalInvitePlaceholder), { target: { value: 'NL-ABC123-DEF456' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '注册并进入' }));

    expect(await screen.findByText('密码需为 8 到 12 位')).toBeDefined();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('shows a usable registration message when the backend returns generic validation text', async () => {
    refreshMock.mockRejectedValue(new Error('unauthorized'));
    registerMock.mockRejectedValue(new Error('参数校验失败'));

    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: '注册' }));
    fireEvent.change(screen.getByPlaceholderText('账号'), { target: { value: 'new_parent' } });
    fireEvent.change(screen.getByPlaceholderText('密码'), { target: { value: 'Parent123!' } });
    fireEvent.change(screen.getByPlaceholderText('确认密码'), { target: { value: 'Parent123!' } });
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
      expect(screen.getByText('成长封面')).toBeDefined();
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

    expect(await screen.findByText('成长封面')).toBeDefined();
    expect(screen.queryByText('一年前的今天')).toBeNull();
    expect(screen.queryByText('第一次在草地上奔跑')).toBeNull();
  });

  it('does not render default photos for text-only records on home', async () => {
    window.history.pushState({}, '', '/home');
    mockAuthenticatedSession();
    listRecordsMock.mockImplementation(async (query) => {
      if (query.start_time || query.end_time) {
        return { list: [], page: 1, page_size: 1, total: 0, has_more: false };
      }
      return {
        list: [
          {
            record_no: 'r_text_only_home',
            cover_media_no: null,
            cover_media_type: null,
            cover_url: null,
            title: '只写了一段文字',
            summary: '今天记录了一件小事。',
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

    expect(await screen.findByText('成长封面')).toBeDefined();
    expect(screen.queryByAltText('只写了一段文字')).toBeNull();
    expect(screen.queryByAltText('成长记录')).toBeNull();
    const emptyCarousel = screen.getByLabelText('最近照片');
    expect(emptyCarousel.getAttribute('data-photo-layout')).toBe('empty');
    expect(emptyCarousel.querySelector('[data-photo-drawer="true"]')).toBeNull();
  });

  it('does not render a standalone one-year-ago module on the home cover page', async () => {
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

    expect(await screen.findByText('成长封面')).toBeDefined();
    expect(screen.queryByText('一年前的今天')).toBeNull();
    expect(screen.queryByText('一年前真实记录')).toBeNull();
  });

  it('shows only real recent and anniversary media without placeholder slides', async () => {
    window.history.pushState({}, '', '/home');
    mockAuthenticatedSession();
    const recentRecord = {
      record_no: 'r_recent_photo',
      cover_media_no: null,
      cover_media_type: 'image',
      cover_url: 'https://cdn.example.test/recent.jpg',
      title: '最近照片',
      summary: '最近真实照片。',
      event_time: '2026-05-28T10:00:00.000Z',
      location_text: null,
      tags: [],
      creator_name: '测试用户',
      is_milestone: false,
      record_type: 'mixed',
      status: 'published' as const,
    };
    const anniversaryRecord = {
      record_no: 'r_anniversary_photo',
      cover_media_no: null,
      cover_media_type: 'image',
      cover_url: 'https://cdn.example.test/anniversary.jpg',
      title: '一年前照片',
      summary: '一年前真实照片。',
      event_time: '2025-05-30T10:00:00.000Z',
      location_text: null,
      tags: [],
      creator_name: '测试用户',
      is_milestone: false,
      record_type: 'mixed',
      status: 'published' as const,
    };
    listRecordsMock.mockImplementation(async (query) => {
      if (query.start_time || query.end_time) {
        return { list: [anniversaryRecord], page: 1, page_size: 1, total: 1, has_more: false };
      }
      return { list: [recentRecord], page: 1, page_size: 5, total: 1, has_more: false };
    });

    render(<App />);

    const recentPhotoSection = await screen.findByLabelText('最近照片');
    await waitFor(() => {
      const srcs = Array.from(recentPhotoSection.querySelectorAll('img')).map((image) => image.getAttribute('src'));
      expect(srcs).toContain('https://cdn.example.test/recent.jpg');
      expect(srcs).toContain('https://cdn.example.test/anniversary.jpg');
    });
    const drawer = recentPhotoSection.querySelector('[data-photo-drawer="true"]') as HTMLElement;
    expect(recentPhotoSection.getAttribute('data-photo-layout')).toBe('sparse');
    expect(drawer.style.overflowX).toBe('hidden');
    expect(drawer.style.display).toBe('grid');
    const rail = recentPhotoSection.querySelector('[data-photo-index-rail="true"]') as HTMLElement;
    expect(rail).toBeDefined();
    expect(rail.style.width).toBe('146px');
    expect((recentPhotoSection.querySelector('[data-photo-index="0"]') as HTMLElement).style.transform).toContain('translate3d(-17px');
    expect((recentPhotoSection.querySelector('[data-photo-index="1"]') as HTMLElement).style.transform).toContain('translate3d(17px');
    expect(recentPhotoSection.querySelectorAll('[data-photo-index]').length).toBe(2);
  });

  it('uses the cover alone when the home has one visual record', async () => {
    window.history.pushState({}, '', '/home');
    mockAuthenticatedSession();
    const singleRecord = {
      record_no: 'r_single_photo',
      cover_media_no: null,
      cover_media_type: 'image' as const,
      cover_url: 'https://cdn.example.test/single.jpg',
      title: '唯一照片',
      summary: '一张真实照片。',
      event_time: '2026-05-28T10:00:00.000Z',
      location_text: null,
      tags: [],
      creator_name: '测试用户',
      is_milestone: false,
      record_type: 'mixed',
      status: 'published' as const,
    };
    listRecordsMock.mockImplementation(async (query) => {
      if (query.start_time || query.end_time) {
        return { list: [], page: 1, page_size: 1, total: 0, has_more: false };
      }
      return { list: [singleRecord], page: 1, page_size: 12, total: 1, has_more: false };
    });

    render(<App />);

    const carousel = await screen.findByLabelText('最近照片');
    expect(carousel.getAttribute('data-photo-layout')).toBe('single');
    expect(carousel.querySelector('[data-photo-drawer="true"]')).toBeNull();
    expect(screen.queryByText('01 / 01')).toBeNull();
  });

  it('uses the generated thumbnail instead of a video payload on the home cover', async () => {
    window.history.pushState({}, '', '/home');
    mockAuthenticatedSession();
    const videoRecord = {
      record_no: 'r_home_video',
      cover_media_no: 'm_home_video',
      cover_media_type: 'video' as const,
      cover_url: 'data:video/mp4;base64,AAAA',
      title: '视频记录',
      summary: '一段真实视频。',
      event_time: '2026-05-28T10:00:00.000Z',
      location_text: null,
      tags: [],
      creator_name: '测试用户',
      is_milestone: false,
      record_type: 'video',
      status: 'published' as const,
    };
    listRecordsMock.mockImplementation(async (query) => {
      if (query.start_time || query.end_time) {
        return { list: [], page: 1, page_size: 1, total: 0, has_more: false };
      }
      return { list: [videoRecord], page: 1, page_size: 12, total: 1, has_more: false };
    });
    mediaAccessUrlMock.mockResolvedValue({
      media_no: 'm_home_video',
      access_url: 'https://cdn.example.test/video.mp4',
      thumbnail_url: 'https://cdn.example.test/video-thumbnail.jpg',
      expires_in: 3600,
    });

    render(<App />);

    const carousel = await screen.findByLabelText('最近照片');
    await waitFor(() => {
      expect((carousel.querySelector('img[alt="视频记录"]') as HTMLImageElement)?.getAttribute('src')).toBe('https://cdn.example.test/video-thumbnail.jpg');
    });
    expect(Array.from(carousel.querySelectorAll('img')).some((image) => image.getAttribute('src')?.startsWith('data:video/'))).toBe(false);
    expect(carousel.querySelector('video')).toBeNull();
  });

  it('renders the signed video frame when a video has no generated thumbnail', async () => {
    window.history.pushState({}, '', '/home');
    mockAuthenticatedSession();
    const videoRecord = {
      record_no: 'r_home_video_legacy',
      cover_media_no: 'm_home_video_legacy',
      cover_media_type: 'video' as const,
      cover_url: 'data:video/mp4;base64,BBBB',
      title: '旧视频记录',
      summary: '一段本地视频。',
      event_time: '2026-05-28T10:00:00.000Z',
      location_text: null,
      tags: [],
      creator_name: '测试用户',
      is_milestone: false,
      record_type: 'video',
      status: 'published' as const,
    };
    listRecordsMock.mockImplementation(async (query) => query.start_time || query.end_time
      ? { list: [], page: 1, page_size: 1, total: 0, has_more: false }
      : { list: [videoRecord], page: 1, page_size: 12, total: 1, has_more: false });
    mediaAccessUrlMock.mockResolvedValue({
      media_no: 'm_home_video_legacy',
      access_url: 'https://cdn.example.test/legacy-video.mp4',
      thumbnail_url: null,
      expires_in: 3600,
    });

    render(<App />);

    const carousel = await screen.findByLabelText('最近照片');
    await waitFor(() => {
      expect((carousel.querySelector('video') as HTMLVideoElement)?.getAttribute('src')).toBe('https://cdn.example.test/legacy-video.mp4');
    });
    expect(carousel.querySelector('img[alt="旧视频记录"]')).toBeNull();
    expect(Array.from(carousel.querySelectorAll('img')).some((image) => image.getAttribute('src')?.startsWith('data:video/'))).toBe(false);
  });

  it('shows the backend total for the home record count', async () => {
    window.history.pushState({}, '', '/home');
    mockAuthenticatedSession();

    const visibleRecords = ['最近一条', '第二条'].map((title, index) => ({
      record_no: `r_visible_${index + 1}`,
      cover_media_no: null,
      cover_media_type: 'image' as const,
      cover_url: `https://cdn.example.test/visible-${index + 1}.jpg`,
      title,
      summary: `${title}真实照片。`,
      event_time: `2026-05-${28 - index}T10:00:00.000Z`,
      location_text: null,
      tags: [],
      creator_name: '测试用户',
      is_milestone: false,
      record_type: 'mixed',
      status: 'published' as const,
    }));

    listRecordsMock.mockImplementation(async (query) => {
      if (query.start_time || query.end_time) {
        return { list: [], page: 1, page_size: 1, total: 0, has_more: false };
      }
      return { list: visibleRecords, page: 1, page_size: 12, total: 18, has_more: true };
    });

    render(<App />);

    expect(await screen.findByText('成长封面')).toBeDefined();
    expect(screen.getByText(/18 条记录/)).toBeDefined();
    expect(screen.queryByText(/2 条记录/)).toBeNull();
  });

  it('autoplays the home photo carousel', async () => {
    window.history.pushState({}, '', '/home');
    mockAuthenticatedSession();

    const photoRecords = ['第一张', '第二张', '第三张'].map((title, index) => ({
      record_no: `r_autoplay_photo_${index + 1}`,
      cover_media_no: null,
      cover_media_type: 'image' as const,
      cover_url: `https://cdn.example.test/autoplay-${index + 1}.jpg`,
      title,
      summary: `${title}真实照片。`,
      event_time: `2026-05-${28 - index}T10:00:00.000Z`,
      location_text: null,
      tags: [],
      creator_name: '测试用户',
      is_milestone: false,
      record_type: 'mixed',
      status: 'published' as const,
    }));

    listRecordsMock.mockImplementation(async (query) => {
      if (query.start_time || query.end_time) {
        return { list: [], page: 1, page_size: 1, total: 0, has_more: false };
      }
      return { list: photoRecords, page: 1, page_size: 12, total: photoRecords.length, has_more: false };
    });

    render(<App />);

    const recentPhotoSection = await screen.findByLabelText('最近照片');
    expect(recentPhotoSection.getAttribute('data-photo-active-index')).toBe('0');

    await waitFor(
      () => {
        expect(recentPhotoSection.getAttribute('data-photo-active-index')).toBe('1');
      },
      { timeout: 3200 },
    );
  });

  it('uses a manual looping carousel for home photos', async () => {
    window.history.pushState({}, '', '/home');
    mockAuthenticatedSession();
    const photoRecords = ['第一张', '第二张', '第三张', '第四张'].map((title, index) => ({
      record_no: `r_photo_${index + 1}`,
      cover_media_no: null,
      cover_media_type: 'image',
      cover_url: `https://cdn.example.test/photo-${index + 1}.jpg`,
      title,
      summary: `${title}真实照片。`,
      event_time: `2026-05-${28 - index}T10:00:00.000Z`,
      location_text: null,
      tags: [],
      creator_name: '测试用户',
      is_milestone: false,
      record_type: 'mixed',
      status: 'published' as const,
    }));
    listRecordsMock.mockImplementation(async (query) => {
      if (query.start_time || query.end_time) {
        return { list: [], page: 1, page_size: 1, total: 0, has_more: false };
      }
      return { list: photoRecords, page: 1, page_size: 5, total: photoRecords.length, has_more: false };
    });

    render(<App />);

    const recentPhotoSection = await screen.findByLabelText('最近照片');
    const stage = recentPhotoSection.querySelector('[data-photo-stage="true"]') as HTMLElement;
    const drawer = recentPhotoSection.querySelector('[data-photo-drawer="true"]') as HTMLElement;

    await waitFor(() => expect(recentPhotoSection.querySelectorAll('[data-photo-index]').length).toBe(4));
    expect(recentPhotoSection.getAttribute('data-photo-layout')).toBe('drawer');
    expect(stage.style.touchAction).toBe('pan-y');
    expect(drawer.style.overflowX).toBe('hidden');
    expect((recentPhotoSection.querySelector('[data-photo-index="1"]') as HTMLElement).style.transform).toContain('translate3d(31px');
    expect((recentPhotoSection.querySelector('[data-photo-index="2"]') as HTMLElement).style.transform).toContain('translate3d(62px');

    fireEvent.click(screen.getByRole('button', { name: '选择照片：第四张' }));

    await waitFor(() => {
      const mainImage = recentPhotoSection.querySelector('[data-photo-stage="true"] img[alt="第四张"]');
      expect(mainImage).not.toBeNull();
    });

    const mainImage = recentPhotoSection.querySelector('[data-photo-stage="true"] img[alt="第四张"]') as HTMLImageElement;
    fireEvent.error(mainImage);

    await waitFor(() => {
      expect((recentPhotoSection.querySelector('[data-photo-stage="true"] img[alt="第四张"]') as HTMLImageElement).getAttribute('src')).toBe('/reference-ui/timeline-child.png');
    });

    fireEvent.pointerDown(stage, { clientX: 330, clientY: 160, pointerId: 1 });
    fireEvent.pointerMove(stage, { clientX: 220, clientY: 160, pointerId: 1 });
    fireEvent.pointerUp(stage, { clientX: 170, clientY: 160, pointerId: 1 });

    await waitFor(() => {
      const firstImage = recentPhotoSection.querySelector('[data-photo-stage="true"] img[alt="第一张"]');
      expect(firstImage).not.toBeNull();
    });

    await new Promise((resolve) => window.setTimeout(resolve, 300));
    fireEvent.click(stage);
    expect(window.location.pathname).toBe('/home');

    fireEvent.pointerDown(stage, { clientX: 330, clientY: 160, pointerId: 2 });
    fireEvent.pointerUp(stage, { clientX: 170, clientY: 160, pointerId: 2 });

    for (const pointerId of [3, 4]) {
      fireEvent.pointerDown(stage, { clientX: 330, clientY: 160, pointerId });
      fireEvent.pointerMove(stage, { clientX: 220, clientY: 160, pointerId });
      fireEvent.pointerUp(stage, { clientX: 170, clientY: 160, pointerId });
    }

    await waitFor(() => {
      expect(recentPhotoSection.getAttribute('data-photo-active-index')).toBe('3');
      expect(recentPhotoSection.getAttribute('data-photo-turning')).toBe('false');
    }, { timeout: 1800 });
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
    expect(screen.queryByText('暂无记录。')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '清除筛选' }));
    expect(await screen.findByText('普通文字记录')).toBeDefined();
  });

  it('keeps an empty timeline year selected instead of snapping back', async () => {
    window.history.pushState({}, '', '/timeline');
    mockAuthenticatedSession();
    const currentYear = new Date().getFullYear();
    const emptyYear = String(currentYear - 1);
    listRecordsMock.mockResolvedValue({
      list: [
        {
          record_no: 'r_current_year',
          cover_media_no: null,
          cover_media_type: null,
          cover_url: null,
          title: '今年记录',
          summary: '今年的真实记录。',
          event_time: `${currentYear}-05-28T10:00:00.000Z`,
          location_text: null,
          tags: [],
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

    fireEvent.click(await screen.findByRole('button', { name: new RegExp(`${emptyYear}年`) }));

    expect(await screen.findByText(`${emptyYear}年还没有记录。`)).toBeDefined();
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

    fireEvent.change(await screen.findByPlaceholderText('标题'), {
      target: { value: '今天会自己收玩具' },
    });
    fireEvent.change(screen.getByPlaceholderText('正文'), {
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

  it('keeps the default text create route free of media actions', async () => {
    window.history.pushState({}, '', '/record/create?type=text');
    mockAuthenticatedSession();

    render(<App />);

    expect(await screen.findByPlaceholderText('标题')).toBeDefined();
    expect(screen.queryByRole('button', { name: '拍照记录' })).toBeNull();
    expect(screen.queryByRole('button', { name: '从相册添加' })).toBeNull();
    expect(screen.queryByRole('button', { name: '拍摄视频' })).toBeNull();
  });

  it('allows editing a text record by adding media and saving it as mixed', async () => {
    window.history.pushState({}, '', '/record/r_text_edit/edit');
    mockAuthenticatedSession();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const originalFetch = globalThis.fetch;
    const restoreMediaMetadataMocks = installMediaMetadataMocks({ imageWidth: 1024, imageHeight: 768 });
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:text-edit-photo') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    Object.defineProperty(globalThis, 'fetch', { configurable: true, value: vi.fn().mockResolvedValue({ ok: true }) });

    const textRecord = {
      record_no: 'r_text_edit',
      child_no: 'c_001',
      creator_user_no: 'u_001',
      creator_name: '测试用户',
      record_type: 'text',
      title: '原文字记录',
      content_text: '原来只有文字，现在要补一张照片。',
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
    detailRecordMock.mockResolvedValue(textRecord);
    createUploadTokenMock.mockResolvedValue({
      media_no: 'm_text_edit_photo',
      object_key: 'mock/text-edit-photo.png',
      upload_url: 'https://upload.example/text-edit-photo.png',
      method: 'PUT',
      headers: {},
      mock_upload: false,
      expires_in: 600,
    });
    confirmUploadMock.mockResolvedValue({
      media_no: 'm_text_edit_photo',
      status: 'ready',
      width: null,
      height: null,
      duration_seconds: null,
      created_at: '2026-05-28T10:00:00.000Z',
      updated_at: '2026-05-28T10:00:00.000Z',
    });
    vi.mocked(webApi.updateRecord).mockResolvedValue({
      ...textRecord,
      record_type: 'mixed',
      media_list: [
        {
          media_no: 'm_text_edit_photo',
          media_type: 'image',
          access_url: '',
          original_name: 'text-edit-photo.png',
          mime_type: 'image/png',
          size_bytes: 8,
          width: null,
          height: null,
          duration_seconds: null,
        },
      ],
    });

    try {
      render(<App />);
      const fileInput = await waitFor(() => {
        const input = document.querySelector('input[aria-label="拍照记录"]');
        expect(input).not.toBeNull();
        return input as HTMLInputElement;
      });

      fireEvent.change(fileInput, {
        target: { files: [new File(['photo'], 'text-edit-photo.png', { type: 'image/png' })] },
      });
      await waitFor(() => expect(confirmUploadMock).toHaveBeenCalledWith({
        media_no: 'm_text_edit_photo',
        width: 1024,
        height: 768,
      }));
      fireEvent.click(screen.getByRole('button', { name: '保存' }));

      await waitFor(() => {
        expect(webApi.updateRecord).toHaveBeenCalledWith('r_text_edit', expect.objectContaining({
          record_type: 'mixed',
          media_nos: ['m_text_edit_photo'],
          status: 'published',
        }));
      });
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
      restoreMediaMetadataMocks();
    }
  });

  it('repeatedly opens the selected photo from a multi-photo record editor in a body-level preview', async () => {
    window.history.pushState({}, '', '/record/r_multi_photo_edit/edit');
    mockAuthenticatedSession();
    const photoUrls = [
      'data:image/png;base64,Zmlyc3Q=',
      'data:image/png;base64,c2Vjb25k',
      'data:image/png;base64,dGhpcmQ=',
      'data:image/png;base64,Zm91cnRo',
    ];
    detailRecordMock.mockResolvedValue({
      record_no: 'r_multi_photo_edit',
      child_no: 'c_001',
      creator_user_no: 'u_001',
      creator_name: '测试用户',
      record_type: 'mixed',
      title: '多图编辑预览',
      content_text: '进入编辑后可以逐张查看。',
      media_list: photoUrls.map((accessUrl, index) => (
        {
          media_no: `m_multi_photo_${index + 1}`,
          media_type: 'image',
          access_url: accessUrl,
          original_name: `photo-${index + 1}.png`,
          mime_type: 'image/png',
          size_bytes: index + 5,
          width: 100,
          height: 100,
          duration_seconds: null,
        }
      )),
      tags: [],
      event_time: '2026-07-27T08:00:00.000Z',
      location_text: null,
      visibility_scope: 'family',
      is_milestone: false,
      ai_generated_title: null,
      ai_summary: null,
      ai_status: null,
      status: 'published',
      created_at: '2026-07-27T08:00:00.000Z',
      updated_at: '2026-07-27T08:00:00.000Z',
    });

    render(<App />);

    const photoPreviews = await screen.findAllByRole('button', { name: '照片预览' });
    expect(photoPreviews).toHaveLength(4);

    for (const index of [0, 2, 3, 1, 3, 0]) {
      fireEvent.click(photoPreviews[index]);

      const fullscreenDialog = await screen.findByRole('dialog', { name: '全屏照片预览' });
      expect(fullscreenDialog.parentElement).toBe(document.body);
      expect(fullscreenDialog.querySelector('img')?.getAttribute('src')).toBe(photoUrls[index]);

      if (index === 0) {
        const firstImage = fullscreenDialog.querySelector('img')!;
        fireEvent.pointerDown(firstImage, { pointerId: 101, pointerType: 'touch', clientX: 320, clientY: 180 });
        fireEvent.pointerMove(firstImage, { pointerId: 101, pointerType: 'touch', clientX: 190, clientY: 184 });
        fireEvent.pointerUp(firstImage, { pointerId: 101, pointerType: 'touch', clientX: 90, clientY: 184 });

        await waitFor(() => {
          expect(fullscreenDialog.getAttribute('data-media-index')).toBe('1');
          expect(fullscreenDialog.querySelector('img')?.getAttribute('src')).toBe(photoUrls[1]);
        });

        const secondImage = fullscreenDialog.querySelector('img')!;
        fireEvent.pointerDown(secondImage, { pointerId: 102, pointerType: 'touch', clientX: 80, clientY: 180 });
        fireEvent.pointerMove(secondImage, { pointerId: 102, pointerType: 'touch', clientX: 210, clientY: 182 });
        fireEvent.pointerUp(secondImage, { pointerId: 102, pointerType: 'touch', clientX: 320, clientY: 182 });

        await waitFor(() => {
          expect(fullscreenDialog.getAttribute('data-media-index')).toBe('0');
          expect(fullscreenDialog.querySelector('img')?.getAttribute('src')).toBe(photoUrls[0]);
        });
      }

      fireEvent.click(fullscreenDialog);
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: '全屏照片预览' })).toBeNull();
      });
    }
  });

  it('swipes through mixed image and video media in record detail and loops at the edges', async () => {
    window.history.pushState({}, '', '/record/r_mixed_media_gallery');
    mockAuthenticatedSession();
    const imageOne = 'data:image/png;base64,aW1hZ2Utb25l';
    const videoOne = 'data:video/mp4;base64,dmlkZW8tb25l';
    const imageTwo = 'data:image/png;base64,aW1hZ2UtdHdv';
    detailRecordMock.mockResolvedValue({
      record_no: 'r_mixed_media_gallery',
      child_no: 'c_001',
      creator_user_no: 'u_001',
      creator_name: '测试用户',
      record_type: 'mixed',
      title: '混合媒体滑页',
      content_text: '图片和视频可以连续查看。',
      media_list: [
        { media_no: 'm_gallery_image_1', media_type: 'image', access_url: imageOne, original_name: 'image-1.png', mime_type: 'image/png', size_bytes: 10, width: 100, height: 100, duration_seconds: null },
        { media_no: 'm_gallery_video_1', media_type: 'video', access_url: videoOne, original_name: 'video-1.mp4', mime_type: 'video/mp4', size_bytes: 20, width: 100, height: 100, duration_seconds: 8 },
        { media_no: 'm_gallery_image_2', media_type: 'image', access_url: imageTwo, original_name: 'image-2.png', mime_type: 'image/png', size_bytes: 10, width: 100, height: 100, duration_seconds: null },
      ],
      tags: [],
      event_time: '2026-07-31T08:00:00.000Z',
      location_text: null,
      visibility_scope: 'family',
      is_milestone: false,
      ai_generated_title: null,
      ai_summary: null,
      ai_status: null,
      status: 'published',
      created_at: '2026-07-31T08:00:00.000Z',
      updated_at: '2026-07-31T08:00:00.000Z',
    });

    render(<App />);

    const primaryPreview = await screen.findByTestId('record-primary-media-preview');
    fireEvent.click(primaryPreview);
    const fullscreenDialog = await screen.findByRole('dialog', { name: '全屏照片预览' });
    expect(fullscreenDialog.getAttribute('data-media-total')).toBe('3');

    const firstImage = fullscreenDialog.querySelector('img')!;
    fireEvent.pointerDown(firstImage, { pointerId: 201, pointerType: 'touch', clientX: 320, clientY: 160 });
    fireEvent.pointerUp(firstImage, { pointerId: 201, pointerType: 'touch', clientX: 70, clientY: 162 });

    const fullscreenVideo = await waitFor(() => {
      const video = fullscreenDialog.querySelector('video');
      expect(fullscreenDialog.getAttribute('data-media-index')).toBe('1');
      expect(video?.getAttribute('src')).toBe(videoOne);
      return video as HTMLVideoElement;
    });

    fireEvent.pointerDown(fullscreenVideo, { pointerId: 202, pointerType: 'touch', clientX: 320, clientY: 80 });
    fireEvent.pointerMove(fullscreenVideo, { pointerId: 202, pointerType: 'touch', clientX: 180, clientY: 82 });
    fireEvent.pointerUp(fullscreenVideo, { pointerId: 202, pointerType: 'touch', clientX: 70, clientY: 82 });

    await waitFor(() => {
      expect(fullscreenDialog.getAttribute('data-media-index')).toBe('2');
      expect(fullscreenDialog.querySelector('img')?.getAttribute('src')).toBe(imageTwo);
    });

    const lastImage = fullscreenDialog.querySelector('img')!;
    fireEvent.pointerDown(lastImage, { pointerId: 203, pointerType: 'touch', clientX: 320, clientY: 160 });
    fireEvent.pointerUp(lastImage, { pointerId: 203, pointerType: 'touch', clientX: 70, clientY: 162 });

    await waitFor(() => {
      expect(fullscreenDialog.getAttribute('data-media-index')).toBe('0');
      expect(fullscreenDialog.querySelector('img')?.getAttribute('src')).toBe(imageOne);
    });

    fireEvent.pointerDown(fullscreenDialog, { pointerId: 204, pointerType: 'touch', clientX: 320, clientY: 400 });
    fireEvent.pointerUp(fullscreenDialog, { pointerId: 204, pointerType: 'touch', clientX: 70, clientY: 400 });

    await waitFor(() => {
      expect(fullscreenDialog.getAttribute('data-media-index')).toBe('1');
      expect(fullscreenDialog.querySelector('video')?.getAttribute('src')).toBe(videoOne);
    });
  });

  it('saves a record draft without requiring publish fields', async () => {
    window.history.pushState({}, '', '/record/create?type=text');
    mockAuthenticatedSession();
    const draftRecord = {
      record_no: 'r_draft_saved',
      child_no: 'c_001',
      creator_user_no: 'u_001',
      creator_name: '测试用户',
      record_type: 'text',
      title: null,
      content_text: null,
      media_list: [],
      tags: [],
      event_time: '2026-05-28T10:00:00.000Z',
      location_text: null,
      visibility_scope: 'family',
      is_milestone: false,
      ai_generated_title: null,
      ai_summary: null,
      ai_status: null,
      status: 'draft',
      created_at: '2026-05-28T10:00:00.000Z',
      updated_at: '2026-05-28T10:00:00.000Z',
    };
    createRecordMock.mockResolvedValue(draftRecord);
    detailRecordMock.mockResolvedValue(draftRecord);

    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: '保存草稿' }));

    await waitFor(() => {
      expect(createRecordMock).toHaveBeenCalledWith(expect.objectContaining({
        child_no: 'c_001',
        record_type: 'text',
        status: 'draft',
      }));
    });
  });

  it('confirms before leaving an unsaved record draft', async () => {
    window.history.pushState({}, '', '/record/create?type=text');
    mockAuthenticatedSession();
    const confirmSpy = vi.spyOn(window, 'confirm');

    render(<App />);

    fireEvent.change(await screen.findByPlaceholderText('标题'), {
      target: { value: '还没保存的标题' },
    });
    fireEvent.click(screen.getByRole('button', { name: '取消' }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(await screen.findByRole('dialog', { name: '离开记录编辑确认' })).toBeDefined();
    expect(screen.getByText('当前记录还没有保存')).toBeDefined();
    expect(screen.getByRole('button', { name: '直接离开' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '继续编辑' }));
    expect(window.location.pathname).toBe('/record/create');
    expect(screen.getByRole('heading', { name: '记录时光' })).toBeDefined();
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

    fireEvent.change(await screen.findByPlaceholderText('标题'), {
      target: { value: '今天去新的营地' },
    });
    fireEvent.change(screen.getByPlaceholderText('正文'), {
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

    const dialog = await screen.findByRole('dialog', { name: '状态' });
    expect(dialog.textContent).toContain('当前手机定位服务不可用，可手动填写地点或选择常用地点。');
    expect(dialog.textContent).not.toMatch(/Google Play/i);
  });

  it('shows media actions before capturing media without an empty preview area', async () => {
    window.history.pushState({}, '', '/record/create?type=mixed&focus=media');
    mockAuthenticatedSession();

    render(<App />);

    expect(await screen.findByRole('button', { name: '拍照记录' })).toBeDefined();
    expect(screen.queryByRole('button', { name: '拍摄视频' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '更多媒体' }));
    expect(screen.getByRole('button', { name: '拍摄视频' })).toBeDefined();
    expect(screen.queryByLabelText('媒体预览')).toBeNull();
    expect(screen.queryByTestId('record-media-preview-empty')).toBeNull();
  });

  it('hides AI controls on the record editor without AI access', async () => {
    window.history.pushState({}, '', '/record/create?type=text');
    mockAuthenticatedSession();

    render(<App />);

    expect(await screen.findByPlaceholderText('标题')).toBeDefined();
    expect(screen.queryByRole('button', { name: '整理建议' })).toBeNull();
    expect(screen.queryByText('整理建议仅作参考，失败不影响记录。')).toBeNull();
    expect(screen.queryByRole('button', { name: /可见范围/ })).toBeNull();
    expect(screen.queryByText('家庭成员可见')).toBeNull();
  });

  it('does not expose provider errors when AI preview fails', async () => {
    window.history.pushState({}, '', '/record/create?type=text');
    mockAuthenticatedSession({ membership_type: 'ai_plus' });
    previewAiMock.mockRejectedValue(new Error('AI 服务调用失败：HTTP 403，API Key 所属分组已删除'));

    render(<App />);

    fireEvent.change(await screen.findByPlaceholderText('标题'), {
      target: { value: '今天会自己收玩具' },
    });
    fireEvent.change(screen.getByPlaceholderText('正文'), {
      target: { value: '今天第一次主动把玩具放回盒子里。' },
    });
    fireEvent.click(screen.getByRole('button', { name: '整理建议' }));

    expect(await screen.findByText('整理建议暂时不可用，请手动填写内容后继续。')).toBeDefined();
    expect(screen.queryByText(/HTTP 403|API Key|所属分组/)).toBeNull();
  });

  it('keeps video and audio capture routes free of empty preview placeholders', async () => {
    mockAuthenticatedSession();

    for (const route of ['/record/create?type=video&focus=media', '/record/create?type=audio&focus=media']) {
      window.history.pushState({}, '', route);
      const view = render(<App />);
      expect(await screen.findByRole('button', { name: /拍摄视频|录制语音/ })).toBeDefined();
      if (route.includes('type=audio')) {
        expect(screen.getByText('支持 m4a、mp3、wav、aac、webm、ogg；AMR/部分 3GP 无法在应用内播放；语音最长支持10分钟。')).toBeDefined();
      }
      expect(screen.queryByLabelText('媒体预览')).toBeNull();
      expect(screen.queryByTestId('record-media-preview-empty')).toBeNull();
      view.unmount();
    }
  });

  it('shows selected video preview immediately while upload is still pending', async () => {
    window.history.pushState({}, '', '/record/create?type=video&focus=media');
    mockAuthenticatedSession();
    createUploadTokenMock.mockReturnValue(new Promise(() => undefined));
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const restoreMediaMetadataMocks = installMediaMetadataMocks({ videoWidth: 1280, videoHeight: 720, duration: 9 });
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
      restoreMediaMetadataMocks();
    }
  });

  it('blocks a video that exceeds the five minute limit before upload', async () => {
    window.history.pushState({}, '', '/record/create?type=video&focus=media');
    mockAuthenticatedSession();
    const restoreMediaMetadataMocks = installMediaMetadataMocks({ videoWidth: 1280, videoHeight: 720, duration: 301 });
    const originalCreateObjectURL = URL.createObjectURL;
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:too-long-video') });

    try {
      render(<App />);
      const videoInput = await waitFor(() => {
        const input = document.querySelector('input[aria-label="拍摄视频"]');
        expect(input).not.toBeNull();
        return input as HTMLInputElement;
      });

      fireEvent.change(videoInput, {
        target: { files: [new File(['video'], 'too-long.mp4', { type: 'video/mp4' })] },
      });

      expect(await screen.findByText('视频最长支持5分钟，请重新选择较短的文件。')).toBeDefined();
      expect(createUploadTokenMock).not.toHaveBeenCalled();
    } finally {
      if (originalCreateObjectURL) {
        Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectURL });
      } else {
        Reflect.deleteProperty(URL, 'createObjectURL');
      }
      restoreMediaMetadataMocks();
    }
  });

  it('uploads playable audio with duration metadata', async () => {
    window.history.pushState({}, '', '/record/create?type=audio&focus=media');
    mockAuthenticatedSession();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const restoreMediaMetadataMocks = installMediaMetadataMocks({ duration: 11 });
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:record-audio-preview') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    createUploadTokenMock.mockResolvedValue({
      media_no: 'm_audio_upload',
      object_key: 'mock/audio.m4a',
      upload_url: 'https://upload.example/audio.m4a',
      method: 'PUT',
      headers: {},
      mock_upload: true,
      expires_in: 600,
    });
    confirmUploadMock.mockResolvedValue({
      media_no: 'm_audio_upload',
      status: 'ready',
      width: null,
      height: null,
      duration_seconds: 11,
      created_at: '2026-05-28T10:00:00.000Z',
      updated_at: '2026-05-28T10:00:00.000Z',
    });

    try {
      render(<App />);
      const audioInput = await waitFor(() => {
        const input = document.querySelector('input[aria-label="上传语音"]');
        expect(input).not.toBeNull();
        return input as HTMLInputElement;
      });

      fireEvent.change(audioInput, {
        target: { files: [new File(['audio'], 'story.m4a', { type: 'audio/mp4' })] },
      });

      await waitFor(() => expect(confirmUploadMock).toHaveBeenCalledWith({
        media_no: 'm_audio_upload',
        duration_seconds: 11,
      }));
      expect(screen.getByLabelText('语音预览').querySelector('audio')?.getAttribute('src')).toMatch(/^(data:audio\/mp4;base64,|blob:record-audio-preview$)/);
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
      restoreMediaMetadataMocks();
    }
  });

  it('records audio in the app and uploads the generated voice file', async () => {
    window.history.pushState({}, '', '/record/create?type=audio&focus=media');
    mockAuthenticatedSession();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const originalMediaRecorder = globalThis.MediaRecorder;
    const originalMediaDevices = navigator.mediaDevices;
    const restoreMediaMetadataMocks = installMediaMetadataMocks({ duration: 6 });
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:recorded-audio-preview') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    const stopTrack = vi.fn();
    const stream = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue(stream),
      },
    });

    class MockMediaRecorder extends EventTarget {
      static isTypeSupported = vi.fn((mimeType: string) => mimeType === 'audio/webm;codecs=opus');
      mimeType = 'audio/webm;codecs=opus';
      state: RecordingState = 'inactive';
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onstop: (() => void) | null = null;
      onerror: (() => void) | null = null;

      constructor(public stream: MediaStream, public options?: MediaRecorderOptions) {
        super();
      }

      start() {
        this.state = 'recording';
      }

      requestData() {
        this.ondataavailable?.({ data: new Blob(['voice'], { type: this.mimeType }) } as BlobEvent);
      }

      stop() {
        this.state = 'inactive';
        this.onstop?.();
      }
    }

    Object.defineProperty(globalThis, 'MediaRecorder', { configurable: true, value: MockMediaRecorder });
    createUploadTokenMock.mockResolvedValue({
      media_no: 'm_recorded_audio_upload',
      object_key: 'mock/recorded.webm',
      upload_url: 'https://upload.example/recorded.webm',
      method: 'PUT',
      headers: {},
      mock_upload: true,
      expires_in: 600,
    });
    confirmUploadMock.mockResolvedValue({
      media_no: 'm_recorded_audio_upload',
      status: 'ready',
      width: null,
      height: null,
      duration_seconds: 6,
      created_at: '2026-05-28T10:00:00.000Z',
      updated_at: '2026-05-28T10:00:00.000Z',
    });

    try {
      render(<App />);
      fireEvent.click(await screen.findByRole('button', { name: '录制语音' }));
      const stopButton = await screen.findByRole('button', { name: '停止录音' });
      fireEvent.click(stopButton);

      await waitFor(() => expect(confirmUploadMock).toHaveBeenCalledWith({
        media_no: 'm_recorded_audio_upload',
        duration_seconds: 6,
      }));
      expect(createUploadTokenMock).toHaveBeenCalledWith(expect.objectContaining({
        file_name: expect.stringMatching(/^voice-\d+\.webm$/),
        mime_type: 'audio/webm',
        media_type: 'audio',
      }));
      expect(stopTrack).toHaveBeenCalled();
      expect(screen.getByLabelText('语音预览').querySelector('audio')?.getAttribute('src')).toMatch(/^(data:audio\/webm;base64,|blob:recorded-audio-preview$)/);
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
      if (originalMediaRecorder) {
        Object.defineProperty(globalThis, 'MediaRecorder', { configurable: true, value: originalMediaRecorder });
      } else {
        Reflect.deleteProperty(globalThis, 'MediaRecorder');
      }
      if (originalMediaDevices) {
        Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: originalMediaDevices });
      } else {
        Reflect.deleteProperty(navigator, 'mediaDevices');
      }
      restoreMediaMetadataMocks();
    }
  });

  it('blocks unsupported voice files before upload', async () => {
    window.history.pushState({}, '', '/record/create?type=audio&focus=media');
    mockAuthenticatedSession();

    render(<App />);
    const audioInput = await waitFor(() => {
      const input = document.querySelector('input[aria-label="上传语音"]');
      expect(input).not.toBeNull();
      return input as HTMLInputElement;
    });

    fireEvent.change(audioInput, {
      target: { files: [new File(['amr'], 'voice.amr', { type: 'audio/amr' })] },
    });

    expect(await screen.findByText('当前录音格式在手机内置播放器中无法播放，请选择 m4a、mp3、wav 或 aac 格式的语音文件。')).toBeDefined();
    expect(createUploadTokenMock).not.toHaveBeenCalled();
    expect(confirmUploadMock).not.toHaveBeenCalled();
  });

  it('shows an account avatar preview before the upload finishes', async () => {
    window.history.pushState({}, '', '/profile/account');
    mockAuthenticatedSession();
    createUploadTokenMock.mockReturnValue(new Promise(() => undefined));
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const restoreMediaMetadataMocks = installMediaMetadataMocks({ imageWidth: 640, imageHeight: 640 });
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
      expect(screen.getByText('头像保存中…')).toBeDefined();
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
      restoreMediaMetadataMocks();
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
    const restoreMediaMetadataMocks = installMediaMetadataMocks({ imageWidth: 720, imageHeight: 720 });
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
        expect(confirmUploadMock).toHaveBeenCalledWith({
          media_no: 'm_account_avatar_success',
          width: 720,
          height: 720,
        });
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
      restoreMediaMetadataMocks();
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

  it('updates mobile number from the account profile page', async () => {
    window.history.pushState({}, '', '/profile/account');
    mockAuthenticatedSession({ mobile: '138****0000' });
    updateMeMock.mockResolvedValue({
      user_no: 'u_001',
      nickname: '测试用户',
      avatar_url: null,
      mobile: '139****5678',
      membership_type: 'free',
    });

    render(<App />);

    expect(await screen.findByRole('heading', { name: '个人资料' })).toBeDefined();
    fireEvent.change(screen.getByLabelText('手机号'), { target: { value: '13912345678' } });
    fireEvent.click(screen.getByRole('button', { name: '保存资料' }));

    await waitFor(() => {
      expect(updateMeMock).toHaveBeenCalledWith({ nickname: '测试用户', mobile: '13912345678' });
    });
    expect(await screen.findByText('资料保存成功')).toBeDefined();
    expect(screen.getByText('当前手机号：139****5678')).toBeDefined();
  });

  it('keeps uploaded media preview available after publishing before the server has an access URL', async () => {
    window.history.pushState({}, '', '/record/create?type=mixed&focus=media');
    mockAuthenticatedSession();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const originalFetch = globalThis.fetch;
    const restoreMediaMetadataMocks = installMediaMetadataMocks({ imageWidth: 1600, imageHeight: 1200 });
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
      await waitFor(() => expect(confirmUploadMock).toHaveBeenCalledWith({
        media_no: 'm_preview_after_publish',
        width: 1600,
        height: 1200,
      }));

      fireEvent.change(screen.getByPlaceholderText('标题'), { target: { value: '发布后预览' } });
      fireEvent.change(screen.getByPlaceholderText('正文'), { target: { value: '发布后马上应该看到刚上传的照片。' } });
      fireEvent.click(screen.getByRole('button', { name: '发布' }));

      const primaryPreview = await screen.findByTestId('record-primary-media-preview');
      expect(primaryPreview.querySelector('img')?.getAttribute('src')).toMatch(/^(data:image\/png;base64,|blob:record-photo-preview$)/);
      expect(primaryPreview.querySelector('button')).toBeNull();
      fireEvent.click(primaryPreview);
      const fullscreenDialog = await screen.findByRole('dialog');
      expect(fullscreenDialog.querySelector('img')?.getAttribute('src')).toMatch(/^(data:image\/png;base64,|blob:record-photo-preview$)/);
      expect(screen.queryByRole('button', { name: '关闭全屏预览' })).toBeNull();
      const fullscreenImage = fullscreenDialog.querySelector('img')!;
      fireEvent.pointerDown(fullscreenImage, { pointerId: 1, pointerType: 'touch', clientX: 20, clientY: 20 });
      fireEvent.pointerUp(fullscreenImage, { pointerId: 1, pointerType: 'touch', clientX: 20, clientY: 20 });
      fireEvent.pointerDown(fullscreenImage, { pointerId: 2, pointerType: 'touch', clientX: 20, clientY: 20 });
      fireEvent.pointerUp(fullscreenImage, { pointerId: 2, pointerType: 'touch', clientX: 20, clientY: 20 });
      expect(fullscreenImage.getAttribute('data-zoomed')).toBe('true');
      expect(screen.getByRole('dialog')).toBeDefined();
      fireEvent.pointerDown(fullscreenImage, { pointerId: 20, pointerType: 'touch', clientX: 20, clientY: 20 });
      fireEvent.pointerMove(fullscreenImage, { pointerId: 20, pointerType: 'touch', clientX: 88, clientY: 42 });
      fireEvent.pointerUp(fullscreenImage, { pointerId: 20, pointerType: 'touch', clientX: 88, clientY: 42 });
      expect(Number(fullscreenImage.getAttribute('data-pan-x'))).not.toBe(0);
      expect(Number(fullscreenImage.getAttribute('data-pan-y'))).not.toBe(0);
      fireEvent.pointerDown(fullscreenImage, { pointerId: 3, pointerType: 'touch', clientX: 20, clientY: 20 });
      fireEvent.pointerUp(fullscreenImage, { pointerId: 3, pointerType: 'touch', clientX: 20, clientY: 20 });
      fireEvent.pointerDown(fullscreenImage, { pointerId: 4, pointerType: 'touch', clientX: 20, clientY: 20 });
      fireEvent.pointerUp(fullscreenImage, { pointerId: 4, pointerType: 'touch', clientX: 20, clientY: 20 });
      expect(fullscreenImage.getAttribute('data-zoomed')).toBe('false');
      fireEvent.pointerDown(fullscreenImage, { pointerId: 5, pointerType: 'touch', clientX: 20, clientY: 20 });
      fireEvent.pointerMove(fullscreenImage, { pointerId: 5, pointerType: 'touch', clientX: 48, clientY: 20 });
      fireEvent.pointerUp(fullscreenImage, { pointerId: 5, pointerType: 'touch', clientX: 48, clientY: 20 });
      await new Promise((resolve) => window.setTimeout(resolve, 300));
      expect(screen.getByRole('dialog')).toBeDefined();
      fireEvent.pointerDown(fullscreenImage, { pointerId: 6, pointerType: 'touch', clientX: 20, clientY: 20 });
      fireEvent.pointerUp(fullscreenImage, { pointerId: 6, pointerType: 'touch', clientX: 20, clientY: 20 });
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
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
      restoreMediaMetadataMocks();
    }
  });

  it('keeps uploaded video preview available after publishing before the server has an access URL', async () => {
    window.history.pushState({}, '', '/record/create?type=video&focus=media');
    mockAuthenticatedSession();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const originalFetch = globalThis.fetch;
    const restoreMediaMetadataMocks = installMediaMetadataMocks({ videoWidth: 1920, videoHeight: 1080, duration: 14 });
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
      await waitFor(() => expect(confirmUploadMock).toHaveBeenCalledWith({
        media_no: 'm_video_after_publish',
        width: 1920,
        height: 1080,
        duration_seconds: 14,
      }));

      fireEvent.change(screen.getByPlaceholderText('标题'), { target: { value: '发布后视频预览' } });
      fireEvent.change(screen.getByPlaceholderText('正文'), { target: { value: '发布后马上应该看到刚上传的视频。' } });
      const publishButtons = screen.getAllByRole('button', { name: /发布|完成发布/ });
      fireEvent.click(publishButtons[publishButtons.length - 1]);

      const primaryPreview = await screen.findByTestId('record-primary-media-preview');
      expect(primaryPreview.querySelector('video')?.getAttribute('src')).toBe('blob:record-video-preview');
      expect(primaryPreview.querySelector('video')?.getAttribute('preload')).toBe('metadata');
      expect(primaryPreview.querySelector('button')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: '视频预览' }));
      const fullscreenDialog = await screen.findByRole('dialog');
      expect(fullscreenDialog.querySelector('video')?.getAttribute('src')).toBe('blob:record-video-preview');
      expect(fullscreenDialog.querySelector('video')?.getAttribute('preload')).toBe('auto');
      expect(screen.queryByRole('button', { name: '关闭全屏预览' })).toBeNull();
      fireEvent.click(fullscreenDialog.querySelector('video')!);
      expect(screen.getByRole('dialog')).toBeDefined();
      fireEvent.click(fullscreenDialog);
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
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
      restoreMediaMetadataMocks();
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
    expect(screen.queryByText('整理建议')).toBeNull();
    expect(screen.queryByText('建议标题：第一次主动整理玩具')).toBeNull();
  });

  it('asks for in-app confirmation before deleting a record detail', async () => {
    window.history.pushState({}, '', '/record/r_delete');
    mockAuthenticatedSession();
    const record = {
      record_no: 'r_delete',
      child_no: 'c_001',
      creator_user_no: 'u_001',
      creator_name: '测试用户',
      record_type: 'text',
      title: '准备删除的记录',
      content_text: '这条记录需要确认后删除。',
      media_list: [],
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
    };
    detailRecordMock.mockResolvedValue(record);
    deleteRecordMock.mockResolvedValue({ record_no: 'r_delete', deleted: true });
    listRecordsMock.mockResolvedValue({ list: [], page: 1, page_size: 100, total: 0, has_more: false });

    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: '删除记录' }));
    expect(deleteRecordMock).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: '删除记录确认' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(screen.queryByRole('dialog', { name: '删除记录确认' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '删除记录' }));
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }));

    await waitFor(() => expect(deleteRecordMock).toHaveBeenCalledWith('r_delete'));
    await waitFor(() => expect(window.location.pathname).toBe('/timeline'));
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

    expect(await screen.findByText('成长封面')).toBeDefined();
    expect(screen.queryByText(/今天想和我聊聊/)).toBeNull();
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

    expect(await screen.findByText('测试用户')).toBeDefined();
    expect(screen.queryByText('当前档案：小满')).toBeNull();
    expect(screen.queryByText('ID: 00000001')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /关于我们/ }));

    expect(await screen.findByRole('heading', { name: 'nianlun' })).toBeDefined();
    expect(screen.getByText(/版本 2\.0\.4（构建/)).toBeDefined();
    expect(screen.queryByRole('button', { name: /应用反馈/ })).toBeNull();
    expect(screen.queryByRole('heading', { name: '孩子的人生档案馆' })).toBeNull();
    expect(screen.queryByText(/familyarchive\.com/)).toBeNull();

    expect(screen.queryByRole('button', { name: /服务说明/ })).toBeNull();
    expect(screen.queryByText(/官网信息将随服务发布节奏同步更新/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /联系我们/ }));

    expect(await screen.findByRole('heading', { name: '联系我们' })).toBeDefined();
    expect(screen.getByText('support@xmlga.top')).toBeDefined();
    expect(screen.getByText('privacy@xmlga.top')).toBeDefined();
    expect(screen.queryByRole('heading', { name: '帮助与反馈' })).toBeNull();
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
          avatar_url: null,
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

  it('keeps family member management usable when operation history is unavailable', async () => {
    window.history.pushState({}, '', '/family/members');
    mockAuthenticatedSession();
    listFamilyMembersMock.mockResolvedValue({
      family_no: 'f_001',
      list: [
        {
          user_no: 'u_001',
          nickname: '测试用户',
          avatar_url: null,
          mobile_masked: '138****0000',
          role: 'owner',
          status: 1,
          joined_at: '2026-04-21T00:00:00.000Z',
          invited_by_user_no: null,
        },
      ],
    });
    listFamilyMemberOperationsMock.mockRejectedValue(new Error('Cannot GET /api/v1/families/f_001/member-operations'));

    render(<App />);

    expect(await screen.findByText('测试用户')).toBeDefined();
    expect(screen.queryByText(/加载失败/)).toBeNull();
  });

  it('shows family record publish operations to members', async () => {
    window.history.pushState({}, '', '/family/members');
    mockAuthenticatedSession();
    listFamilyMembersMock.mockResolvedValue({
      family_no: 'f_001',
      list: [
        {
          user_no: 'u_001',
          nickname: '测试用户',
          avatar_url: null,
          mobile_masked: '138****0000',
          role: 'owner',
          status: 1,
          joined_at: '2026-04-21T00:00:00.000Z',
          invited_by_user_no: null,
        },
      ],
    });
    listFamilyMemberOperationsMock.mockResolvedValue({
      family_no: 'f_001',
      list: [
        {
          operation_no: 'op_record_1',
          action: 'family.record_published',
          family_no: 'f_001',
          target_user_no: 'u_001',
          target_nickname: '测试用户',
          before_role: null,
          after_role: null,
          operator_user_id: '1',
          record_no: 'r_001',
          record_title: '第一次独立骑车',
          created_at: '2026-06-21T10:00:00.000Z',
        },
      ],
    });

    render(<App />);

    expect(await screen.findByText('测试用户 发布了「第一次独立骑车」')).toBeDefined();
  });

  it('does not render default photos for text-only records in family activity', async () => {
    window.history.pushState({}, '', '/family');
    mockAuthenticatedSession();
    listFamilyMembersMock.mockResolvedValue({
      family_no: 'f_001',
      list: [
        {
          user_no: 'u_001',
          nickname: '测试用户',
          avatar_url: null,
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
          record_no: 'r_text_family',
          cover_media_no: null,
          cover_media_type: null,
          cover_url: null,
          title: '家庭里的文字记录',
          summary: '这是一条没有图片的家庭动态。',
          event_time: '2026-06-21T10:00:00.000Z',
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
      page_size: 3,
      total: 1,
      has_more: false,
    });

    render(<App />);

    expect(await screen.findByText('家庭里的文字记录')).toBeDefined();
    expect(screen.queryByAltText('家庭里的文字记录')).toBeNull();
    expect(screen.queryByAltText('家庭动态图片')).toBeNull();
  });

  it('loads the creator avatar in family activity from media references', async () => {
    window.history.pushState({}, '', '/family');
    mockAuthenticatedSession();
    listFamilyMembersMock.mockResolvedValue({
      family_no: 'f_001',
      list: [
        {
          user_no: 'u_001',
          nickname: '测试用户',
          avatar_url: null,
          avatar_media_no: null,
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
          record_no: 'r_avatar_family',
          cover_media_no: null,
          cover_media_type: null,
          cover_url: null,
          title: '带头像的记录',
          summary: '家庭动态应该显示发布者头像。',
          event_time: '2026-06-21T10:00:00.000Z',
          location_text: null,
          tags: [],
          creator_user_no: 'u_001',
          creator_name: '测试用户',
          creator_avatar_url: null,
          creator_avatar_media_no: 'm_creator_avatar',
          is_milestone: false,
          record_type: 'text',
          status: 'published',
        },
      ],
      page: 1,
      page_size: 3,
      total: 1,
      has_more: false,
    });
    mediaAccessUrlMock.mockResolvedValue({
      media_no: 'm_creator_avatar',
      access_url: 'https://cdn.example.test/avatar.jpg',
      thumbnail_url: 'https://cdn.example.test/avatar-thumb.jpg',
      expires_in: 3600,
    });

    render(<App />);

    const activity = await screen.findByRole('button', { name: /查看家庭动态：带头像的记录/ });
    const avatar = activity.querySelector('img[alt="我"]') as HTMLImageElement | null;
    expect(avatar).not.toBeNull();
    await waitFor(() => expect(avatar?.getAttribute('src')).toBe('https://cdn.example.test/avatar-thumb.jpg'));
    expect(mediaAccessUrlMock).toHaveBeenCalledWith('m_creator_avatar');
  });

  it('explains invite role permissions before creating a family invite', async () => {
    window.history.pushState({}, '', '/family/invite');
    mockAuthenticatedSession();

    render(<App />);

    expect(await screen.findByRole('heading', { name: '邀请家庭成员' })).toBeDefined();
    expect(screen.getByLabelText('邀请权限说明')).toBeDefined();
    expect(screen.getByText('查看记录、补充记录、参与整理')).toBeDefined();
    expect(screen.getByText('查看家庭可见内容，不修改档案')).toBeDefined();
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
          avatar_url: null,
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

  it('updates a family member role from the member detail page', async () => {
    window.history.pushState({}, '', '/family/members/u_member');
    mockAuthenticatedSession();
    listFamilyMembersMock.mockResolvedValue({
      family_no: 'f_001',
      list: [
        {
          user_no: 'u_member',
          nickname: '家庭成员',
          avatar_url: null,
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
    updateFamilyMemberRoleMock.mockResolvedValue({
      family_no: 'f_001',
      user_no: 'u_member',
      role: 'viewer',
      updated_at: '2026-06-21T10:00:00.000Z',
    });
    listFamilyMemberOperationsMock
      .mockResolvedValueOnce({ family_no: 'f_001', list: [] })
      .mockResolvedValueOnce({
        family_no: 'f_001',
        list: [
          {
            operation_no: '1',
            action: 'family.member_role_updated',
            family_no: 'f_001',
            target_user_no: 'u_member',
            target_nickname: '家庭成员',
            before_role: 'editor',
            after_role: 'viewer',
            operator_user_id: '1',
            created_at: '2026-06-21T10:00:00.000Z',
          },
        ],
      });

    render(<App />);

    expect(await screen.findByRole('heading', { name: '家人资料' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '设为只读' }));

    await waitFor(() => expect(updateFamilyMemberRoleMock).toHaveBeenCalledWith('f_001', 'u_member', { role: 'viewer' }));
    expect(await screen.findByText('家庭成员 权限从 可编辑成员 调整为 只读成员')).toBeDefined();
  });

  it('removes a family member after confirmation', async () => {
    window.history.pushState({}, '', '/family/members/u_member');
    mockAuthenticatedSession();
    listFamilyMembersMock.mockResolvedValue({
      family_no: 'f_001',
      list: [
        {
          user_no: 'u_member',
          nickname: '家庭成员',
          avatar_url: null,
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
    deleteFamilyMemberMock.mockResolvedValue({
      family_no: 'f_001',
      user_no: 'u_member',
      removed: true,
      removed_at: '2026-06-21T10:00:00.000Z',
    });
    listFamilyMemberOperationsMock.mockResolvedValue({
      family_no: 'f_001',
      list: [
        {
          operation_no: '1',
          action: 'family.member_removed',
          family_no: 'f_001',
          target_user_no: 'u_member',
          target_nickname: '家庭成员',
          before_role: 'editor',
          after_role: null,
          operator_user_id: '1',
          created_at: '2026-06-21T10:00:00.000Z',
        },
      ],
    });

    render(<App />);

    expect(await screen.findByRole('heading', { name: '家人资料' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /移出家庭/ }));

    expect(await screen.findByText('确认移出 家庭成员')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '确认移出' }));

    await waitFor(() => expect(deleteFamilyMemberMock).toHaveBeenCalledWith('f_001', 'u_member'));
    await waitFor(() => expect(window.location.pathname).toBe('/family/members'));
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

  it('hides paused management entries and exposes password change controls', async () => {
    window.history.pushState({}, '', '/profile/membership');
    mockAuthenticatedSession();

    const { unmount } = render(<App />);

    await waitFor(() => expect(window.location.pathname).toBe('/profile'));
    expect(await screen.findByText('隐私设置')).toBeDefined();
    expect(screen.queryByText('月报与纪念册')).toBeNull();
    expect(screen.queryByText('导出与备份')).toBeNull();
    expect(screen.queryByText('服务状态')).toBeNull();
    expect(screen.queryByRole('heading', { name: '服务状态' })).toBeNull();
    expect(screen.queryByRole('button', { name: '咨询会员权益' })).toBeNull();
    expect(screen.queryByRole('button', { name: '免费申领本年度纪念册' })).toBeNull();

    unmount();
    window.history.pushState({}, '', '/profile/security');
    render(<App />);
    expect(await screen.findByRole('heading', { name: '账号与安全' })).toBeDefined();
    expect(screen.queryByText('第三方账号绑定')).toBeNull();
    expect(screen.queryByText('暂未接入')).toBeNull();
    expect(screen.queryByText('已绑定微信')).toBeNull();
    expect(screen.getAllByRole('button', { name: '修改' }).length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByLabelText('当前密码')).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: '修改' })[1]);
    expect(screen.getByLabelText('当前密码')).toBeDefined();
    expect(screen.getByLabelText('新密码')).toBeDefined();
    expect(screen.getByLabelText('确认新密码')).toBeDefined();
  });

  it('redirects paused management routes back to the profile page', async () => {
    window.history.pushState({}, '', '/profile/reports');
    mockAuthenticatedSession();
    const { unmount } = render(<App />);

    await waitFor(() => expect(window.location.pathname).toBe('/profile'));
    expect(screen.queryByRole('heading', { name: '月报与纪念册' })).toBeNull();

    unmount();
    window.history.pushState({}, '', '/profile/export');
    render(<App />);

    await waitFor(() => expect(window.location.pathname).toBe('/profile'));
    expect(screen.queryByRole('heading', { name: '导出与备份' })).toBeNull();
  });

  it('submits account password changes from the security page', async () => {
    window.history.pushState({}, '', '/profile/security');
    mockAuthenticatedSession();

    render(<App />);

    expect(await screen.findByRole('heading', { name: '账号与安全' })).toBeDefined();
    fireEvent.click(screen.getAllByRole('button', { name: '修改' })[1]);
    fireEvent.change(screen.getByLabelText('当前密码'), { target: { value: 'OldPass123' } });
    fireEvent.change(screen.getByLabelText('新密码'), { target: { value: 'NewPass123' } });
    fireEvent.change(screen.getByLabelText('确认新密码'), { target: { value: 'NewPass123' } });
    fireEvent.click(screen.getByRole('button', { name: '修改密码' }));

    await waitFor(() => {
      expect(changePasswordMock).toHaveBeenCalledWith({
        current_password: 'OldPass123',
        new_password: 'NewPass123',
        new_password_confirm: 'NewPass123',
      });
    });
    expect(await screen.findByText('登录密码已更新')).toBeDefined();
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

  it('shows recent feedback status and admin notes', async () => {
    window.history.pushState({}, '', '/profile/help');
    mockAuthenticatedSession();
    listFeedbackMock.mockResolvedValue({
      list: [
        {
          feedback_no: 'fb_001',
          ticket_no: 'fb_001',
          category: '使用问题',
          topic: 'membership',
          content: '服务状态显示有问题',
          contact: '138****0000',
          status: 'processing',
          priority: 'normal',
          handled_at: '2026-06-21T09:00:00.000Z',
          handle_note: '已转人工处理',
          created_at: '2026-06-21T08:00:00.000Z',
          updated_at: '2026-06-21T09:10:00.000Z',
        },
      ],
    });

    render(<App />);

    expect(await screen.findByRole('heading', { name: '帮助与反馈' })).toBeDefined();
    expect(await screen.findByText('最近反馈')).toBeDefined();
    expect(screen.getByText('处理中')).toBeDefined();
    expect(screen.getByText((content) => content.includes('处理备注：已转人工处理'))).toBeDefined();
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
      expect((screen.getByLabelText('反馈内容') as HTMLTextAreaElement).value).toContain('账号服务状态显示问题');
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

    expect(await screen.findByText('成长封面')).toBeDefined();
    expect(screen.getByRole('button', { name: '记录' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /月报/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /未来信箱/ })).toBeNull();
  });

  it('does not open the paused monthly report page', async () => {
    window.history.pushState({}, '', '/profile/reports');
    mockAuthenticatedSession();

    render(<App />);

    await waitFor(() => expect(window.location.pathname).toBe('/profile'));
    expect(screen.queryByRole('heading', { name: '月报与纪念册' })).toBeNull();
    expect(screen.queryByText('纪念册同步')).toBeNull();
  });

  it('opens family notifications and jumps to the target record detail', async () => {
    window.history.pushState({}, '', '/profile/messages');
    mockAuthenticatedSession();
    notificationUnreadCountMock.mockResolvedValue({ unread_count: 1 });
    listNotificationsMock.mockResolvedValue({
      page: 1,
      page_size: 20,
      total: 1,
      has_more: false,
      list: [
        {
          notification_no: 'msg_001',
          notification_type: 'family.record_published',
          title: '新的家庭记录',
          body: '小满爸爸 发布了《第一次骑车》',
          family_no: 'f_001',
          actor_user_no: 'u_dad',
          actor_nickname: '小满爸爸',
          target_type: 'record',
          target_no: 'r_001',
          read_at: null,
          created_at: '2026-06-22T08:00:00.000Z',
          updated_at: '2026-06-22T08:00:00.000Z',
        },
      ],
    });
    detailRecordMock.mockResolvedValue({
      record_no: 'r_001',
      child_no: 'c_001',
      creator_user_no: 'u_dad',
      creator_name: '小满爸爸',
      record_type: 'text',
      title: '第一次骑车',
      content_text: '今天第一次自己骑车。',
      media_list: [],
      tags: [],
      event_time: '2026-06-22T08:00:00.000Z',
      location_text: null,
      visibility_scope: 'family',
      is_milestone: false,
      ai_generated_title: null,
      ai_summary: null,
      ai_status: null,
      status: 'published',
      created_at: '2026-06-22T08:00:00.000Z',
      updated_at: '2026-06-22T08:00:00.000Z',
    });

    render(<App />);

    expect(await screen.findByRole('heading', { name: '消息' })).toBeDefined();
    fireEvent.click(await screen.findByText('小满爸爸 发布了《第一次骑车》'));

    await waitFor(() => expect(markNotificationReadMock).toHaveBeenCalledWith('msg_001'));
    await waitFor(() => expect(detailRecordMock).toHaveBeenCalledWith('r_001'));
    expect(window.location.pathname).toBe('/record/r_001');
  });

  it('cleans placeholder question marks from notification copy', async () => {
    window.history.pushState({}, '', '/profile/messages');
    mockAuthenticatedSession();
    listNotificationsMock.mockResolvedValue({
      page: 1,
      page_size: 20,
      total: 1,
      has_more: false,
      list: [
        {
          notification_no: 'msg_dirty',
          notification_type: 'family.record_published',
          title: '新的家庭记录',
          body: '小满妈妈 发布了《?????? 124557》',
          family_no: 'f_001',
          actor_user_no: 'u_mom',
          actor_nickname: '小满妈妈',
          target_type: 'record',
          target_no: 'r_002',
          read_at: null,
          created_at: '2026-06-22T08:00:00.000Z',
          updated_at: '2026-06-22T08:00:00.000Z',
        },
      ],
    });

    render(<App />);

    expect(await screen.findByText('小满妈妈 发布了《一条记录》')).toBeDefined();
    expect(screen.queryByText(/\?{3,}/)).toBeNull();
  });

  it('keeps the messages page quiet when notification sync fails', async () => {
    window.history.pushState({}, '', '/profile/messages');
    mockAuthenticatedSession();
    listNotificationsMock.mockRejectedValue(new Error('Network error'));

    render(<App />);

    expect(await screen.findByRole('heading', { name: '消息' })).toBeDefined();
    await waitFor(() => expect(listNotificationsMock).toHaveBeenCalled());
    expect(await screen.findByText('暂无消息')).toBeDefined();
    expect(screen.queryByText(/同步失败/)).toBeNull();
  });

  it('opens app notification management and saves local notification preferences', async () => {
    window.history.pushState({}, '', '/profile/notifications');
    mockAuthenticatedSession();
    notificationUnreadCountMock.mockResolvedValue({ unread_count: 2 });
    getNativeNotificationPermissionStatusMock.mockResolvedValue('denied');
    requestNativeNotificationPermissionMock.mockResolvedValue('granted');

    render(<App />);

    expect(await screen.findByRole('heading', { name: '通知管理' })).toBeDefined();
    expect(await screen.findByText('系统通知未开启')).toBeDefined();
    expect(screen.getByText(/2 条未读/)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: '开启通知' }));
    await waitFor(() => expect(requestNativeNotificationPermissionMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('系统通知已开启，消息仍可在 App 内查看。')).toBeDefined();

    fireEvent.click(screen.getByRole('switch', { name: '家庭动态通知' }));
    const stored = JSON.parse(window.localStorage.getItem('xiaoman-web-local-settings') ?? '{}');
    expect(stored.notificationFamilyEnabled).toBe(false);
  });

  it('checks app updates from the about page and shows the APK download link', async () => {
    window.history.pushState({}, '', '/profile/about');
    mockAuthenticatedSession();

    render(<App />);

    expect(await screen.findByRole('heading', { name: '关于我们' })).toBeDefined();
    await waitFor(() => expect(checkAppUpdateMock).toHaveBeenCalledTimes(1));
    checkAppUpdateMock.mockResolvedValueOnce({
      platform: 'android',
      current_version: '2.0.2',
      current_build_number: 4,
      latest_version: '2.0.3',
      latest_build_number: 5,
      release_notes: '新增家庭消息与版本更新。',
      apk_url: 'https://download.example.com/nianlun-2.0.3.apk',
      update_available: true,
      force_update: false,
      checked_at: '2026-06-22T08:10:00.000Z',
    });

    fireEvent.click(screen.getByRole('button', { name: /检查更新/ }));

    expect(await screen.findByText('发现新版本')).toBeDefined();
    expect(screen.getByText('最新版本 2.0.3（构建 5）')).toBeDefined();
    const downloadLink = screen.getByRole('link', { name: '下载 APK' }) as HTMLAnchorElement;
    expect(downloadLink.href).toBe('https://download.example.com/nianlun-2.0.3.apk');
  });
});
