
import { useAuthStore } from '../store/authstore';

export const useAuth = () => {
  const {
    isAuthenticated,
    user,
    userType,
    hasSeenOnboarding,
    setUser,
    isLoading,
    setUserType,
    setAuthenticated,
    setHasSeenOnboarding,
    logout,
    loadStoredAuth,
  } = useAuthStore();

  return {
    isAuthenticated,
    user,
    userType,
    hasSeenOnboarding,
    setUser,
    isLoading,
    setUserType,
    setAuthenticated,
    setHasSeenOnboarding,
    logout,
    loadStoredAuth,
  };
};
