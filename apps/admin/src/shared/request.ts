import axios, { AxiosError } from 'axios';

import { getAccessToken } from './authMemory';

export interface AdminListResponse<T> {
  list: T[];
  page: number;
  page_size: number;
  total: number;
  has_more: boolean;
}

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

type ErrorEnvelope = { message?: unknown };

const toUserFacingError = (error: AxiosError) => {
  const responseMessage = (error.response?.data as ErrorEnvelope | undefined)?.message;
  if (typeof responseMessage === 'string' && responseMessage.trim()) {
    return new Error(responseMessage);
  }

  if (error.message === 'Network Error') {
    return new Error('网络连接失败，请稍后重试');
  }

  if (error.code === 'ECONNABORTED') {
    return new Error('请求超时，请稍后重试');
  }

  return new Error('请求失败，请稍后重试');
};

export interface AdminUserItem {
  user_no: string;
  nickname: string;
  avatar_url: string | null;
  mobile: string | null;
  membership_type: string;
  status: 'active' | 'disabled';
  last_login_at: string | null;
  created_at: string;
}

export interface AdminDashboardResponse {
  totals: {
    users: number;
    children: number;
    records: number;
    media: number;
  };
  ai_job_status_distribution: Array<{ status: string; count: number }>;
  recent_audit_logs: AdminAuditLogItem[];
}

export interface AdminUserStatusUpdateResponse {
  user_no: string;
  status: 'active' | 'disabled';
  changed: boolean;
}

export interface AdminUserPasswordResetResponse {
  user_no: string;
  auth_key: string;
  revoked_sessions: number;
  changed: boolean;
  reset_at: string;
}

export interface AdminInviteItem {
  invite_no: string;
  invitee_mobile: string | null;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  created_by_username: string;
  created_by_name: string;
  accepted_by_user_no: string | null;
  accepted_by_name: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface AdminInviteCreateResponse {
  invite_no: string;
  invite_code: string;
  invitee_mobile: string | null;
  status: AdminInviteItem['status'];
  expires_at: string;
  created_at: string;
}

export interface AdminInviteRevokeResponse {
  invite_no: string;
  status: AdminInviteItem['status'];
  changed: boolean;
}

export interface AdminChildItem {
  child_no: string;
  family_no: string;
  owner_user_no: string;
  name: string;
  birthday: string;
  gender: string;
  status: string;
  created_at: string;
}

export interface AdminRecordItem {
  record_no: string;
  child_no: string;
  child_name?: string | null;
  creator_user_no: string;
  creator_name?: string | null;
  title: string | null;
  record_type: string;
  visibility_scope: string;
  status: string;
  created_at: string;
}

export interface AdminMediaItem {
  media_no: string;
  family_no: string;
  child_no: string | null;
  child_name?: string | null;
  uploader_user_no: string;
  uploader_name?: string | null;
  media_type: string;
  status: string;
  original_name?: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  object_key: string;
  record_no?: string | null;
  record_title?: string | null;
  created_at: string;
}

export interface AdminAiJobItem {
  job_no: string;
  record_no: string | null;
  requester_user_no: string;
  job_type: string;
  status: string;
  error_message: string | null;
  retry_count: number;
  created_at: string;
}

export interface AdminAuditLogItem {
  actor_type: string;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: unknown;
  created_at: string;
}

export interface AdminUserDetail extends AdminUserItem {
  email: string | null;
  membership_expire_at: string | null;
  updated_at: string;
  auth_accounts: Array<{
    auth_type: string;
    auth_key: string;
    status: 'active' | 'disabled';
    created_at: string;
    updated_at: string;
  }>;
  children: Array<{
    child_no: string;
    name: string;
    birthday: string | null;
    gender: string;
    status: string;
  }>;
  families: Array<{
    family_no: string;
    family_name: string | null;
    role: string;
    status: string;
    joined_at: string | null;
  }>;
}

export interface AdminChildDetail extends AdminChildItem {
  family_name: string | null;
  owner_name: string;
  avatar_url: string | null;
  birth_place: string | null;
  remark: string | null;
  updated_at: string;
  family_members: Array<{
    user_no: string;
    nickname: string;
    mobile: string | null;
    role: string;
    status: string;
    joined_at: string | null;
  }>;
  recent_records: Array<{
    record_no: string;
    title: string | null;
    record_type: string;
    status: string;
    event_time: string;
  }>;
}

export interface AdminMediaDetail extends AdminMediaItem {
  storage_provider: string;
  bucket: string;
  access_url: string | null;
  original_name: string | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  child_name: string | null;
  record_no: string | null;
  record_title: string | null;
  uploader_name: string;
  uploader_mobile: string | null;
  updated_at: string;
}

export interface AdminRecordDetail extends AdminRecordItem {
  child_name: string;
  family_no: string;
  creator_name: string;
  content_text: string | null;
  tags: Array<{ tag_name: string; source: string }>;
  media_list: AdminMediaDetail[];
  ai_jobs: AdminAiJobItem[];
  event_time: string;
  location_text: string | null;
  is_milestone: boolean;
  ai_generated_title: string | null;
  ai_summary: string | null;
  ai_status: string | null;
  published_at: string | null;
  updated_at: string;
}

export interface AdminAiJobDetail extends AdminAiJobItem {
  family_no: string;
  requester_name: string;
  requester_mobile: string | null;
  record_title: string | null;
  provider: string | null;
  input_snapshot: unknown;
  output_json: unknown;
  retry_count: number;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
}

export interface AdminStatusActionResponse {
  record_no?: string;
  media_no?: string;
  job_no?: string;
  status: string;
  retry_count?: number;
  changed: boolean;
}

export interface AdminLoginResponse {
  access_token: string;
  expires_in: number;
  admin: {
    username: string;
    display_name: string;
    role: string;
  };
}

const request = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
});

request.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

request.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => Promise.reject(toUserFacingError(error)),
);

const unwrap = <T,>(response: { data: ApiEnvelope<T> }) => response.data.data;

export const adminApi = {
  async login(payload: { username: string; password: string }) {
    const response = await request.post<ApiEnvelope<AdminLoginResponse>>('/admin/auth/login', payload);
    return unwrap(response);
  },

  async dashboard() {
    const response = await request.get<ApiEnvelope<AdminDashboardResponse>>('/admin/dashboard');
    return unwrap(response);
  },

  async listUsers(params: { keyword?: string; page?: number; page_size?: number }) {
    const response = await request.get<ApiEnvelope<AdminListResponse<AdminUserItem>>>('/admin/users', { params });
    return unwrap(response);
  },

  async listInvites(params: { keyword?: string; page?: number; page_size?: number }) {
    const response = await request.get<ApiEnvelope<AdminListResponse<AdminInviteItem>>>('/admin/invites', { params });
    return unwrap(response);
  },

  async createInvite(payload: { mobile?: string; expires_in_hours?: number }) {
    const response = await request.post<ApiEnvelope<AdminInviteCreateResponse>>('/admin/invites', payload);
    return unwrap(response);
  },

  async revokeInvite(inviteNo: string) {
    const response = await request.post<ApiEnvelope<AdminInviteRevokeResponse>>(`/admin/invites/${inviteNo}/revoke`);
    return unwrap(response);
  },

  async updateUserStatus(userNo: string, payload: { status: 'active' | 'disabled'; reason?: string }) {
    const response = await request.patch<ApiEnvelope<AdminUserStatusUpdateResponse>>(`/admin/users/${userNo}/status`, payload);
    return unwrap(response);
  },

  async resetUserPassword(userNo: string, payload: { new_password: string; password_confirm: string; reason: string }) {
    const response = await request.patch<ApiEnvelope<AdminUserPasswordResetResponse>>(`/admin/users/${userNo}/password`, payload);
    return unwrap(response);
  },

  async getUserDetail(userNo: string) {
    const response = await request.get<ApiEnvelope<AdminUserDetail>>(`/admin/users/${userNo}`);
    return unwrap(response);
  },

  async listChildren(params: { keyword?: string; page?: number; page_size?: number }) {
    const response = await request.get<ApiEnvelope<AdminListResponse<AdminChildItem>>>('/admin/children', { params });
    return unwrap(response);
  },

  async getChildDetail(childNo: string) {
    const response = await request.get<ApiEnvelope<AdminChildDetail>>(`/admin/children/${childNo}`);
    return unwrap(response);
  },

  async listRecords(params: { keyword?: string; page?: number; page_size?: number }) {
    const response = await request.get<ApiEnvelope<AdminListResponse<AdminRecordItem>>>('/admin/records', { params });
    return unwrap(response);
  },

  async getRecordDetail(recordNo: string) {
    const response = await request.get<ApiEnvelope<AdminRecordDetail>>(`/admin/records/${recordNo}`);
    return unwrap(response);
  },

  async updateRecordStatus(recordNo: string, payload: { status: 'published' | 'draft'; reason?: string }) {
    const response = await request.patch<ApiEnvelope<AdminStatusActionResponse>>(`/admin/records/${recordNo}/status`, payload);
    return unwrap(response);
  },

  async listMedia(params: { keyword?: string; page?: number; page_size?: number }) {
    const response = await request.get<ApiEnvelope<AdminListResponse<AdminMediaItem>>>('/admin/media', { params });
    return unwrap(response);
  },

  async getMediaDetail(mediaNo: string) {
    const response = await request.get<ApiEnvelope<AdminMediaDetail>>(`/admin/media/${mediaNo}`);
    return unwrap(response);
  },

  async updateMediaStatus(mediaNo: string, payload: { status: 'ready' | 'failed' | 'removed'; reason?: string }) {
    const response = await request.patch<ApiEnvelope<AdminStatusActionResponse>>(`/admin/media/${mediaNo}/status`, payload);
    return unwrap(response);
  },

  async listAiJobs(params: { keyword?: string; page?: number; page_size?: number }) {
    const response = await request.get<ApiEnvelope<AdminListResponse<AdminAiJobItem>>>('/admin/ai-jobs', { params });
    return unwrap(response);
  },

  async getAiJobDetail(jobNo: string) {
    const response = await request.get<ApiEnvelope<AdminAiJobDetail>>(`/admin/ai-jobs/${jobNo}`);
    return unwrap(response);
  },

  async retryAiJob(jobNo: string, payload: { reason?: string }) {
    const response = await request.post<ApiEnvelope<AdminStatusActionResponse>>(`/admin/ai-jobs/${jobNo}/retry`, payload);
    return unwrap(response);
  },

  async cancelAiJob(jobNo: string, payload: { reason?: string }) {
    const response = await request.post<ApiEnvelope<AdminStatusActionResponse>>(`/admin/ai-jobs/${jobNo}/cancel`, payload);
    return unwrap(response);
  },

  async listAuditLogs(params: { keyword?: string; page?: number; page_size?: number; action?: string; target_type?: string; start_time?: string; end_time?: string }) {
    const response = await request.get<ApiEnvelope<AdminListResponse<AdminAuditLogItem>>>('/admin/audit-logs', { params });
    return unwrap(response);
  },
};
