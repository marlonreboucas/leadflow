'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  email: string;
  companyId: string;
  roleSlug: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  setSession: (s: { user: AuthUser; accessToken: string; refreshToken: string }) => void;
  clear: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setSession: ({ user, accessToken, refreshToken }) =>
        set({ user, accessToken, refreshToken }),
      clear: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    { name: 'leadflow.auth' },
  ),
);
