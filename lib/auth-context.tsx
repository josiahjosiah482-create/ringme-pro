import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export type AppUser = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  avatarColor: string | null;
  subscriptionTier: "free" | "pro" | "max";
  phoneNumber?: string;
};

type AuthState = {
  user: AppUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasCompletedOnboarding: boolean;
  hasSelectedNumber: boolean;
};

type AuthContextType = AuthState & {
  signIn: (user: AppUser) => Promise<void>;
  signOut: () => Promise<void>;
  setOnboardingComplete: () => Promise<void>;
  setNumberSelected: (phoneNumber: string) => Promise<void>;
  updateUser: (updates: Partial<AppUser>) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEYS = {
  USER: "@ringme:user",
  ONBOARDING: "@ringme:onboarding_complete",
  NUMBER: "@ringme:selected_number",
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    hasCompletedOnboarding: false,
    hasSelectedNumber: false,
  });

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const [userJson, onboarding, numberStr] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.USER),
        AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING),
        AsyncStorage.getItem(STORAGE_KEYS.NUMBER),
      ]);
      const user = userJson ? (JSON.parse(userJson) as AppUser) : null;
      setState({
        user,
        isLoading: false,
        isAuthenticated: !!user,
        hasCompletedOnboarding: onboarding === "true",
        hasSelectedNumber: !!numberStr,
      });
    } catch {
      setState((s) => ({ ...s, isLoading: false }));
    }
  };

  const signIn = useCallback(async (user: AppUser) => {
    await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    setState((s) => ({ ...s, user, isAuthenticated: true }));
  }, []);

  const signOut = useCallback(async () => {
    await AsyncStorage.multiRemove([STORAGE_KEYS.USER, STORAGE_KEYS.NUMBER]);
    setState((s) => ({ ...s, user: null, isAuthenticated: false, hasSelectedNumber: false }));
  }, []);

  const setOnboardingComplete = useCallback(async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING, "true");
    setState((s) => ({ ...s, hasCompletedOnboarding: true }));
  }, []);

  const setNumberSelected = useCallback(async (phoneNumber: string) => {
    await AsyncStorage.setItem(STORAGE_KEYS.NUMBER, phoneNumber);
    setState((s) => ({
      ...s,
      hasSelectedNumber: true,
      user: s.user ? { ...s.user, phoneNumber } : s.user,
    }));
  }, []);

  const updateUser = useCallback(async (updates: Partial<AppUser>) => {
    setState((s) => {
      const updated = s.user ? { ...s.user, ...updates } : s.user;
      if (updated) AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updated));
      return { ...s, user: updated };
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{ ...state, signIn, signOut, setOnboardingComplete, setNumberSelected, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
