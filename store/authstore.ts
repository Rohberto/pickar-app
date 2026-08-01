import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

type UserType = 'user' | 'driver' | null;

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;      // ← add this
  type: UserType;
  photo?: string | null;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  userType: UserType;
  hasSeenOnboarding: boolean;
  isLoading: boolean;
  rememberMe: boolean;

  setUser: (user: User | null) => void;
  // Update just the photo without replacing the whole user object
  setUserPhoto: (photo: string) => Promise<void>;
  setUserType: (type: UserType) => Promise<void>;
  setAuthenticated: (value: boolean) => Promise<void>;
  setHasSeenOnboarding: (value: boolean) => Promise<void>;
  setRememberMe: (value: boolean) => Promise<void>;
  logout: () => Promise<void>;
  loadStoredAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  user: null,
  userType: null,
  hasSeenOnboarding: false,
  isLoading: true,
  rememberMe: false,

  setUser: (user) => {
    set({ user });
    // Persist updated user so photo survives app restarts
    if (user) {
      AsyncStorage.setItem('user', JSON.stringify(user)).catch(() => {});
    }
  },

  // Call this after a successful Cloudinary upload
  setUserPhoto: async (photo: string) => {
    const current = get().user;
    if (!current) return;
    const updated = { ...current, photo };
    set({ user: updated });
    await AsyncStorage.setItem('user', JSON.stringify(updated));
  },

  setUserType: async (type) => {
    set({ userType: type });
    if (type) await AsyncStorage.setItem('userType', type);
  },

  setAuthenticated: async (value) => {
    set({ isAuthenticated: value });
    await AsyncStorage.setItem('isAuthenticated', value.toString());
  },

  setHasSeenOnboarding: async (value) => {
    set({ hasSeenOnboarding: value });
    await AsyncStorage.setItem('hasSeenOnboarding', value.toString());
  },

  // Controls whether loadStoredAuth() restores the session on the NEXT
  // cold start. true = stay logged in after closing the app.
  // false = session is only valid for the current app instance; a fresh
  // launch will find rememberMe !== 'true' and log the user out.
  setRememberMe: async (value) => {
    set({ rememberMe: value });
    await AsyncStorage.setItem('rememberMe', value.toString());
  },

  logout: async () => {
    set({ isAuthenticated: false, user: null, userType: null, rememberMe: false });
    await AsyncStorage.multiRemove([
      'isAuthenticated',
      'userType',
      'authToken',
      'user',
      'rememberMe',
    ]);
  },

  loadStoredAuth: async () => {
    try {
      const [isAuth, userType, hasSeenOnboarding, userData, rememberMeStored] =
        await AsyncStorage.multiGet([
          'isAuthenticated',
          'userType',
          'hasSeenOnboarding',
          'user',
          'rememberMe',
        ]);

      const wasAuthenticated = isAuth[1] === 'true';
      const wasRemembered = rememberMeStored[1] === 'true';

      // Logged in previously but didn't check "Remember me" — don't
      // silently restore that session on a fresh launch.
      if (wasAuthenticated && !wasRemembered) {
        await AsyncStorage.multiRemove([
          'isAuthenticated',
          'userType',
          'authToken',
          'user',
          'rememberMe',
        ]);

        set({
          isAuthenticated: false,
          user: null,
          userType: null,
          rememberMe: false,
          hasSeenOnboarding: hasSeenOnboarding[1] === 'true',
          isLoading: false,
        });
        return;
      }

      set({
        isAuthenticated: wasAuthenticated,
        userType: (userType[1] as UserType) || null,
        hasSeenOnboarding: hasSeenOnboarding[1] === 'true',
        user: userData[1] ? JSON.parse(userData[1]) : null,
        rememberMe: wasRemembered,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to load auth state:', error);
      set({ isLoading: false });
    }
  },
}));