import axios from 'axios';

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

export interface AdminUserStatusUpdateResponse {
  user_no: string;
  status: 'active' | 'disabled';
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
  creator_user_no: string;
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
  uploader_user_no: string;
  media_type: string;
  mime_type: string | null;
  size_bytes: number | null;
  object_key: string;
  created_at: string;
}

export interface AdminAiJobItem {
  job_no: string;
  record_no: string | null;
  requester_user_no: string;
  job_type: string;
  status: string;
  error_message: string | null;
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
  created_at: string;
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

const unwrap = <T,>(response: { data: ApiEnvelope<T> }) => response.data.data;

export const adminApi = {
  async login(payload: { username: string; password: string }) {
    const response = await request.post<ApiEnvelope<AdminLoginResponse>>('/admin/auth/login', payload);
    return unwrap(response);
  },

  async listUsers(params: { keyword?: string; page?: number; page_size?: number }) {
    const response = await request.get<ApiEnvelope<AdminListResponse<AdminUserItem>>>('/admin/users', { params });
    return unwrap(response);
  },

  async updateUserStatus(userNo: string, payload: { status: 'active' | 'disabled'; reason?: string }) {
    const response = await request.patch<ApiEnvelope<AdminUserStatusUpdateResponse>>(`/admin/users/${userNo}/status`, payload);
    return unwrap(response);
  },

  async listChildren(params: { keyword?: string; page?: number; page_size?: number }) {
    const response = await request.get<ApiEnvelope<AdminListResponse<AdminChildItem>>>('/admin/children', { params });
    return unwrap(response);
  },

  async listRecords(params: { keyword?: string; page?: number; page_size?: number }) {
    const response = await request.get<ApiEnvelope<AdminListResponse<AdminRecordItem>>>('/admin/records', { params });
    return unwrap(response);
  },

  async listMedia(params: { keyword?: string; page?: number; page_size?: number }) {
    const response = await request.get<ApiEnvelope<AdminListResponse<AdminMediaItem>>>('/admin/media', { params });
    return unwrap(response);
  },

  async listAiJobs(params: { keyword?: string; page?: number; page_size?: number }) {
    const response = await request.get<ApiEnvelope<AdminListResponse<AdminAiJobItem>>>('/admin/ai-jobs', { params });
    return unwrap(response);
  },

  async listAuditLogs(params: { keyword?: string; page?: number; page_size?: number }) {
    const response = await request.get<ApiEnvelope<AdminListResponse<AdminAuditLogItem>>>('/admin/audit-logs', { params });
    return unwrap(response);
  },
};
