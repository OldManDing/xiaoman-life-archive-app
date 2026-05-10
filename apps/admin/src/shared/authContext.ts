import { createContext } from 'react';

export interface AdminProfile {
  username: string;
  display_name: string;
  role: string;
}

export interface AuthContextValue {
  accessToken: string | null;
  admin: AdminProfile | null;
  isAuthenticated: boolean;
  login: (payload: { username: string; password: string }) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
