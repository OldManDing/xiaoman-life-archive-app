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
  LocationsSearchResponse,
  FeedbackResponse,
  FeedbackTicketsListResponse,
  FamilyMemberOperationsResponse,
  DeletionCheckResponse,
  DeviceTokenMutationResponse,
  MembershipBookRequestResponse,
  MembershipBookRequestsListResponse,
  ArchiveExportRequestResponse,
  ArchiveExportRequestsListResponse,
  ArchiveExportSummaryResponse,
  AiJobDetail,
  AiPreviewResponse,
  AiJobType,
  AppUpdateCheckResponse,
  MediaAccessUrlResponse,
  NotificationMutationResponse,
  NotificationUnreadCountResponse,
  RecordDetail,
  RecordsListResponse,
  SendCodeResponse,
  UploadTokenResponse,
  UserNotificationsResponse,
  UserPreferencesResponse,
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
  invite_code?: string;
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
  nickname?: string;
  avatar_url?: string;
  mobile?: string;
}

export interface DeleteMePayload {
  password: string;
  confirm_text: string;
}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
  new_password_confirm: string;
}

export interface DeviceTokenPayload {
  platform: 'android' | 'ios';
  provider: 'hms' | 'fcm' | 'apns' | 'local';
  push_token: string;
  device_label?: string;
}

export interface UpdatePreferencesPayload {
  allow_mobile_search?: boolean;
  show_history_to_new_members?: boolean;
}

export interface SubmitFeedbackPayload {
  category: string;
  content: string;
  contact?: string;
  topic?: string;
}

export interface ArchiveExportRequestPayload {
  child_no: string;
  export_type?: 'all' | 'media' | 'text';
  purpose?: 'backup' | 'adult_handoff';
  contact?: string;
  note?: string;
}

export interface MembershipBookRequestPayload {
  year?: number;
  contact?: string;
  note?: string;
}

export interface ListRecordsQuery {
  child_no: string;
  page?: number;
  page_size?: number;
  keyword?: string;
  record_type?: string;
  tag?: string;
  start_time?: string;
  end_time?: string;
  status?: 'published' | 'draft';
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
  media_type: 'image' | 'video' | 'audio';
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

export interface SearchLocationsQuery {
  keyword: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

let refreshSessionPromise: Promise<LoginResponse> | null = null;

const isMissingEndpointError = (error: unknown, pathHint: string) =>
  error instanceof Error && /Cannot\s+(GET|POST|PUT|DELETE|PATCH)\s+/i.test(error.message) && error.message.includes(pathHint);

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

  async deletionCheck() {
    const response = await http.get<ApiEnvelope<DeletionCheckResponse>>('/users/me/deletion-check');
    return response.data.data;
  },

  async deleteMe(payload: DeleteMePayload) {
    const response = await http.post<ApiEnvelope<{ success: boolean; deleted_at: string; message: string }>>('/users/me/delete', payload);
    return response.data.data;
  },

  async changePassword(payload: ChangePasswordPayload) {
    const response = await http.post<ApiEnvelope<{ success: boolean; updated_at: string; message: string }>>('/users/me/password', payload);
    return response.data.data;
  },

  async preferences() {
    const response = await http.get<ApiEnvelope<UserPreferencesResponse>>('/users/me/preferences');
    return response.data.data;
  },

  async updatePreferences(payload: UpdatePreferencesPayload) {
    const response = await http.put<ApiEnvelope<UserPreferencesResponse>>('/users/me/preferences', payload);
    return response.data.data;
  },

  async listNotifications(params?: { page?: number; page_size?: number }) {
    const response = await http.get<ApiEnvelope<UserNotificationsResponse>>('/users/me/notifications', { params });
    return response.data.data;
  },

  async notificationUnreadCount() {
    const response = await http.get<ApiEnvelope<NotificationUnreadCountResponse>>('/users/me/notifications/unread-count');
    return response.data.data;
  },

  async markNotificationRead(notificationNo: string) {
    const response = await http.patch<ApiEnvelope<NotificationMutationResponse>>(
      `/users/me/notifications/${encodeURIComponent(notificationNo)}/read`,
    );
    return response.data.data;
  },

  async markAllNotificationsRead() {
    const response = await http.patch<ApiEnvelope<NotificationMutationResponse>>('/users/me/notifications/read-all');
    return response.data.data;
  },

  async registerDeviceToken(payload: DeviceTokenPayload) {
    const response = await http.post<ApiEnvelope<DeviceTokenMutationResponse>>('/users/me/device-tokens', payload);
    return response.data.data;
  },

  async unregisterDeviceToken(payload: DeviceTokenPayload) {
    const response = await http.delete<ApiEnvelope<DeviceTokenMutationResponse>>('/users/me/device-tokens', { data: payload });
    return response.data.data;
  },

  async checkAppUpdate(params: { platform: 'android'; version: string; build_number: number }) {
    const response = await http.get<ApiEnvelope<AppUpdateCheckResponse>>('/users/me/app-update', { params });
    return response.data.data;
  },

  async submitFeedback(payload: SubmitFeedbackPayload) {
    const response = await http.post<ApiEnvelope<FeedbackResponse>>('/users/me/feedback', payload);
    return response.data.data;
  },

  async listFeedback() {
    try {
      const response = await http.get<ApiEnvelope<FeedbackTicketsListResponse>>('/users/me/feedback');
      return response.data.data;
    } catch (error) {
      if (isMissingEndpointError(error, '/users/me/feedback')) {
        return { list: [] };
      }
      throw error;
    }
  },

  async requestMembershipBook(payload: MembershipBookRequestPayload) {
    const response = await http.post<ApiEnvelope<MembershipBookRequestResponse>>('/users/me/membership-book-requests', payload);
    return response.data.data;
  },

  async listMembershipBookRequests() {
    try {
      const response = await http.get<ApiEnvelope<MembershipBookRequestsListResponse>>('/users/me/membership-book-requests');
      return response.data.data;
    } catch (error) {
      if (isMissingEndpointError(error, '/users/me/membership-book-requests')) {
        return { list: [] };
      }
      throw error;
    }
  },

  async requestArchiveExport(payload: ArchiveExportRequestPayload) {
    const response = await http.post<ApiEnvelope<ArchiveExportRequestResponse>>('/users/me/archive-export-requests', payload);
    return response.data.data;
  },

  async listArchiveExportRequests(params?: { child_no?: string }) {
    const response = await http.get<ApiEnvelope<ArchiveExportRequestsListResponse>>('/users/me/archive-export-requests', { params });
    return response.data.data;
  },

  async archiveExportSummary(params: { child_no: string }) {
    const response = await http.get<ApiEnvelope<ArchiveExportSummaryResponse>>('/users/me/archive-export-summary', { params });
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

  async createAiJob(recordNo: string, payload: { job_types: AiJobType[] }) {
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

  async previewAi(payload: { title?: string; content_text?: string; tags?: string[] }) {
    const response = await http.post<ApiEnvelope<AiPreviewResponse>>('/ai-jobs/preview', payload);
    return response.data.data;
  },

  async mediaAccessUrl(mediaNo: string) {
    const response = await http.get<ApiEnvelope<MediaAccessUrlResponse>>(`/media/${mediaNo}/access-url`);
    return response.data.data;
  },

  async searchLocations(query: SearchLocationsQuery) {
    const response = await http.get<ApiEnvelope<LocationsSearchResponse>>('/locations/search', {
      params: query,
    });
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

  async listFamilyMemberOperations(familyNo: string, params?: { user_no?: string }) {
    try {
      const response = await http.get<ApiEnvelope<FamilyMemberOperationsResponse>>(`/families/${familyNo}/member-operations`, { params });
      return response.data.data;
    } catch (error) {
      if (isMissingEndpointError(error, 'member-operations')) {
        return { family_no: familyNo, list: [] };
      }
      throw error;
    }
  },

  async deleteFamilyMember(familyNo: string, userNo: string) {
    const response = await http.delete<ApiEnvelope<{ family_no: string; user_no: string; removed: boolean; removed_at: string }>>(
      `/families/${familyNo}/members/${userNo}`,
    );
    return response.data.data;
  },
};
