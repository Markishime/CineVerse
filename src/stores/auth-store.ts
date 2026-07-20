"use client";

import { create } from "zustand";
import type { User } from "firebase/auth";
import type { UserProfile, UserSettings } from "@/types/content";

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  settings: UserSettings | null;
  loading: boolean;
  isAdmin: boolean;
  setUser: (user: User | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setSettings: (settings: UserSettings | null) => void;
  setLoading: (loading: boolean) => void;
  setIsAdmin: (isAdmin: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  settings: null,
  loading: true,
  isAdmin: false,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setSettings: (settings) => set({ settings }),
  setLoading: (loading) => set({ loading }),
  setIsAdmin: (isAdmin) => set({ isAdmin }),
  reset: () =>
    set({
      user: null,
      profile: null,
      settings: null,
      isAdmin: false,
      loading: false,
    }),
}));
