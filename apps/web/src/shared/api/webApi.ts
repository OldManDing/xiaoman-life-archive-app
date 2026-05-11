import http from './http';
import type {
  ApiEnvelope,
  ChildRecord,
  CreateAiJobResponse,
  ChildrenListResponse,
  ConfirmMediaResponse,
  FamilyInviteResponse,
  FamilyMembersResponse,
  LoginResponse,
  AiJobDetail,
  RecordDetail,
  RecordsListResponse,
  SendCodeResponse,
  UploadTokenResponse,
  UserProfile,
} from './types';

export interface LoginPayload {
  login_type: 'password';
  credential: string;
  password: string;
}

export interface RegisterPayload {
  credential: string;
  password: string;
  password_confirm: string;
  invite_code: string;
}

export interface CreateChildPayload {
  name: string;
  avatar_url?: string;
  birthday: string;
  gender?: string;
  birth_place?: string;
  remark?: string;
}

export interface UpdateChildPayload {
  name?: string;
  avatar_url?: string;
  birthday?: string;
  gender?: string;
  birth_place?: string;
  remark?: string;
}

export interface UpdateMePayload {
  nickname: string;
}

export interface ListRecordsQuery {
  child_no: string;
  page?: number;
  page_size?: number;
  record_type?: string;
  tag?: string;
  start_time?: string;
  end_time?: string;
}

export interface CreateRecordPayload {
  child_no: string;
  record_type: string;
  title?: string;
  content_text?: string;
  media_nos?: string[];
  tags?: string[];
  event_time?: string;
  location_text?: string;
  visibility_scope?: string;
  is_milestone?: boolean;
  status?: string;
}

export interface UploadTokenPayload {
  child_no: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  media_type: 'image';
}

export interface ConfirmMediaPayload {
  media_no: string;
  width?: number;
  height?: number;
  duration_seconds?: number | null;
}

export interface CreateFamilyInvitePayload {
  mobile?: string;
  role: 'viewer' | 'editor';
}

export interface UpdateFamilyMemberRolePayload {
  role: 'viewer' | 'editor';
}

let refreshSessionPromise: Promise<LoginResponse> | null = null;

export const webApi = {
  async sendCode(mobile: string) {
    const response = await http.post<ApiEnvelope<SendCodeResponse>>('/auth/send-code', { mobile });
    return response.data.data;
  },

  async login(payload: LoginPayload) {
    const response = await http.post<ApiEnvelope<LoginResponse>>('/auth/login', payload);
    return response.data.data;
  },

  async register(payload: RegisterPayload) {
    const response = await http.post<ApiEnvelope<LoginResponse>>('/auth/register', payload);
    return response.data.data;
  },

  async refresh() {
    if (!refreshSessionPromise) {
      refreshSessionPromise = http
        .post<ApiEnvelope<LoginResponse>>('/auth/refresh')
        .then((response) => response.data.data)
        .finally(() => {
          refreshSessionPromise = null;
        });
    }

    return refreshSessionPromise;
  },

  async logout() {
    const response = await http.post<ApiEnvelope<{ success: boolean }>>('/auth/logout');
    return response.data.data;
  },

  async me() {
    const response = await http.get<ApiEnvelope<UserProfile>>('/users/me');
    return response.data.data;
  },

  async updateMe(payload: UpdateMePayload) {
    const response = await http.patch<ApiEnvelope<UserProfile>>('/users/me', payload);
    return response.data.data;
  },

  async listChildren() {
    const response = await http.get<ApiEnvelope<ChildrenListResponse>>('/children');
    return response.data.data.list;
  },

  async createChild(payload: CreateChildPayload) {
    const response = await http.post<ApiEnvelope<ChildRecord>>('/children', payload);
    return response.data.data;
  },

  async detailChild(childNo: string) {
    const response = await http.get<ApiEnvelope<ChildRecord>>(`/children/${childNo}`);
    return response.data.data;
  },

  async updateChild(childNo: string, payload: UpdateChildPayload) {
    const response = await http.put<ApiEnvelope<ChildRecord>>(`/children/${childNo}`, payload);
    return response.data.data;
  },

  async listRecords(query: ListRecordsQuery) {
    const response = await http.get<ApiEnvelope<RecordsListResponse>>('/records', {
      params: query,
    });
    return response.data.data;
  },

  async createRecord(payload: CreateRecordPayload) {
    const response = await http.post<ApiEnvelope<RecordDetail>>('/records', payload);
    return response.data.data;
  },

  async detailRecord(recordNo: string) {
    const response = await http.get<ApiEnvelope<RecordDetail>>(`/records/${recordNo}`);
    return response.data.data;
  },

  async updateRecord(recordNo: string, payload: Partial<CreateRecordPayload>) {
    const response = await http.put<ApiEnvelope<RecordDetail>>(`/records/${recordNo}`, payload);
    return response.data.data;
  },

  async deleteRecord(recordNo: string) {
    const response = await http.delete<ApiEnvelope<{ record_no: string; deleted: boolean }>>(`/records/${recordNo}`);
    return response.data.data;
  },

  async createAiJob(recordNo: string, payload: { job_types: Array<'record_summary'> }) {
    const response = await http.post<ApiEnvelope<CreateAiJobResponse>>(`/records/${recordNo}/ai-jobs`, payload);
    return response.data.data;
  },

  async detailAiJob(jobNo: string) {
    const response = await http.get<ApiEnvelope<AiJobDetail>>(`/ai-jobs/${jobNo}`);
    return response.data.data;
  },

  async createUploadToken(payload: UploadTokenPayload) {
    const response = await http.post<ApiEnvelope<UploadTokenResponse>>('/media/upload-token', payload);
    return response.data.data;
  },

  async confirmUpload(payload: ConfirmMediaPayload) {
    const response = await http.post<ApiEnvelope<ConfirmMediaResponse>>('/media/confirm', payload);
    return response.data.data;
  },

  async listFamilyMembers(familyNo: string) {
    const response = await http.get<ApiEnvelope<FamilyMembersResponse>>(`/families/${familyNo}/members`);
    return response.data.data;
  },

  async createFamilyInvite(familyNo: string, payload: CreateFamilyInvitePayload) {
    const response = await http.post<ApiEnvelope<FamilyInviteResponse>>(`/families/${familyNo}/invites`, payload);
    return response.data.data;
  },

  async updateFamilyMemberRole(familyNo: string, userNo: string, payload: UpdateFamilyMemberRolePayload) {
    const response = await http.put<ApiEnvelope<{ family_no: string; user_no: string; role: string; updated_at: string }>>(
      `/families/${familyNo}/members/${userNo}/role`,
      payload,
    );
    return response.data.data;
  },
};
