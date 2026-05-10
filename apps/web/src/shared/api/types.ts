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
  cover_url: string | null;
  title: string | null;
  summary: string | null;
  event_time: string;
  tags: string[];
  creator_name: string;
  is_milestone: boolean;
  record_type: string;
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
  ai_summary: string | null;
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

export interface AcceptInviteResponse {
  family_no: string;
  role: string;
  accepted_at: string;
}

export interface CreateAiJobResponse {
  list: AiJobDetail[];
}

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
