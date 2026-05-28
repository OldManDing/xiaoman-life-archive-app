export interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

export interface UserProfile {
  user_no: string;
  nickname: string;
  avatar_url: string | null;
  mobile?: string | null;
  membership_type: string;
  membership_expire_at?: string | null;
  created_at?: string;
}

export interface DeletionCheckResponse {
  can_delete: boolean;
  requires_password: boolean;
  confirm_text: string;
  blockers: string[];
  summary: {
    owned_family_count: number;
    joined_family_count: number;
    active_child_count: number;
    active_record_count: number;
  };
}

export interface UserPreferencesResponse {
  allow_mobile_search: boolean;
  show_history_to_new_members: boolean;
  updated_at: string | null;
}

export interface FeedbackResponse {
  feedback_no: string;
  ticket_no?: string;
  status: 'submitted';
  message: string;
  created_at: string;
}

export interface MembershipBookRequestResponse {
  request_no: string;
  status: 'submitted';
  message: string;
  created_at: string;
}

export interface ArchiveExportRequestResponse {
  request_no: string;
  status: 'submitted';
  message: string;
  created_at: string;
  summary: {
    child_no: string;
    child_name: string;
    export_type: 'all' | 'media' | 'text';
    purpose: 'backup' | 'adult_handoff';
    record_count: number;
    milestone_count: number;
    media_count: number;
    first_record_time: string | null;
    latest_record_time: string | null;
  };
}

export interface ArchiveExportRequestItem {
  request_no: string;
  child_no: string;
  child_name: string;
  export_type: 'all' | 'media' | 'text';
  purpose: 'backup' | 'adult_handoff';
  status: 'submitted' | 'processing' | 'completed' | 'rejected';
  record_count: number;
  milestone_count: number;
  media_count: number;
  first_record_time: string | null;
  latest_record_time: string | null;
  processed_at: string | null;
  process_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface ArchiveExportRequestsListResponse {
  list: ArchiveExportRequestItem[];
}

export interface ArchiveExportSummaryResponse {
  file_name: string;
  mime_type: string;
  generated_at: string;
  summary: {
    child_no: string;
    child_name: string;
    record_count: number;
    milestone_count: number;
    media_count: number;
    first_record_time: string | null;
    latest_record_time: string | null;
  };
  content: string;
}

export interface LoginResponse {
  access_token: string;
  expires_in: number;
  user: UserProfile;
  need_create_child: boolean;
}

export interface SendCodeResponse {
  success: boolean;
  expires_in: number;
  next_send_in: number;
}

export interface ChildRecord {
  child_no: string;
  family_no?: string;
  owner_user_no?: string;
  name: string;
  avatar_url: string | null;
  birthday: string;
  gender: string;
  birth_place?: string | null;
  remark?: string | null;
  current_age_display: string;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface ChildrenListResponse {
  list: ChildRecord[];
}

export interface RecordSummary {
  record_no: string;
  cover_media_no: string | null;
  cover_media_type?: string | null;
  cover_url: string | null;
  title: string | null;
  summary: string | null;
  ai_summary?: string | null;
  event_time: string;
  location_text: string | null;
  tags: string[];
  creator_name: string;
  is_milestone: boolean;
  record_type: string;
  status: 'draft' | 'published';
}

export interface RecordsListResponse {
  list: RecordSummary[];
  page: number;
  page_size: number;
  total: number;
  has_more: boolean;
}

export interface RecordMediaItem {
  media_no: string;
  media_type: string;
  access_url: string;
  original_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  duration_seconds?: number | null;
}

export interface RecordDetail {
  record_no: string;
  child_no: string;
  creator_user_no: string;
  creator_name: string;
  record_type: string;
  title: string | null;
  content_text: string | null;
  media_list: RecordMediaItem[];
  tags: string[];
  event_time: string;
  location_text: string | null;
  visibility_scope: string;
  is_milestone: boolean;
  ai_generated_title: string | null;
  ai_summary: string | null;
  ai_status: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface UploadTokenResponse {
  media_no: string;
  object_key: string;
  upload_url: string;
  method: string;
  headers: Record<string, string>;
  mock_upload?: boolean;
  expires_in: number;
  expire_at?: string;
}

export interface MediaAccessUrlResponse {
  media_no: string;
  access_url: string;
  expires_in: number;
  expire_at?: string;
}

export interface ConfirmMediaResponse {
  media_no: string;
  status: string;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  created_at: string;
  updated_at: string;
}

export interface LocationSuggestion {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  source: string;
}

export interface LocationsSearchResponse {
  provider: string;
  list: LocationSuggestion[];
}

export interface FamilyMemberItem {
  user_no: string;
  nickname: string;
  mobile_masked: string | null;
  role: string;
  status: number;
  joined_at: string | null;
  invited_by_user_no: string | null;
}

export interface FamilyMembersResponse {
  family_no: string;
  list: FamilyMemberItem[];
}

export interface FamilyInviteResponse {
  invite_no: string;
  family_no: string;
  role: string;
  invitee_mobile: string | null;
  invite_token: string;
  expires_at: string;
}

export interface CreateAiJobResponse {
  list: AiJobDetail[];
}

export interface AiPreviewResponse {
  suggested_title: string | null;
  summary: string | null;
  tags: string[];
  provider: string;
}

export type AiJobType = 'record_title' | 'record_summary' | 'record_tags' | 'monthly_report';

export interface AiJobDetail {
  job_no: string;
  record_no: string | null;
  job_type: string;
  status: 'pending' | 'processing' | 'success' | 'failed' | 'cancelled';
  provider: string;
  input_snapshot: Record<string, unknown> | null;
  output_json: Record<string, unknown> | null;
  error_message: string | null;
  retry_count: number;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}
