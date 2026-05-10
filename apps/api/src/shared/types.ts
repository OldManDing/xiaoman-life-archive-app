export interface UserJwtPayload {
  type: 'user';
  sub: string;
  user_no: string;
}

export interface AdminJwtPayload {
  type: 'admin';
  sub: string;
  username: string;
  role: string;
}

export interface AuthenticatedUser {
  id: bigint;
  user_no: string;
  nickname: string;
}

export interface AuthenticatedAdmin {
  id: bigint;
  username: string;
  role: string;
  display_name: string;
}
