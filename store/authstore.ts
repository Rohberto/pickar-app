import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

type UserType = 'user' | 'driver' | null;

interface User {
  id: string;
  name: string;
  email: string;
  type: UserType;
  photo?: string | null; // profile picture URL (Cloudinary)
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  userType: UserType;
  hasSeenOnboarding: boolean;
  isLoading: boolean;

  setUser: (user: User | null) => void;
  // Update just the photo without replacing the whole user object
  setUserPhoto: (photo: string) => Promise<void>;
  setUserType: (type: UserType) => Promise<void>;
  setAuthenticated: (value: boolean) => Promise<void>;
  setHasSeenOnboarding: (value: boolean) => Promise<void>;
  logout: () => Promise<void>;
  loadStoredAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  user: null,
  userType: null,
  hasSeenOnboarding: false,
  isLoading: true,

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

  logout: async () => {
    set({ isAuthenticated: false, user: null, userType: null });
    await AsyncStorage.multiRemove(['isAuthenticated', 'userType', 'authToken', 'user']);
  },

  loadStoredAuth: async () => {
    try {
      const [isAuth, userType, hasSeenOnboarding, userData] = await AsyncStorage.multiGet([
        'isAuthenticated',
        'userType',
        'hasSeenOnboarding',
        'user',
      ]);

      set({
        isAuthenticated: isAuth[1] === 'true',
        userType: (userType[1] as UserType) || null,
        hasSeenOnboarding: hasSeenOnboarding[1] === 'true',
        user: userData[1] ? JSON.parse(userData[1]) : null,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to load auth state:', error);
      set({ isLoading: false });
    }
  },
}));