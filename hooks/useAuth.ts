import { useAuthStore } from '../store/authstore';

export const useAuth = () => {
  const {
    isAuthenticated,
    user,
    userType,
    hasSeenOnboarding,
    rememberMe,
    setUser,
    isLoading,
    setUserType,
    setAuthenticated,
    setHasSeenOnboarding,
    setRememberMe,
    logout,
    loadStoredAuth,
    saveLoginCredentials,
    getSavedLoginCredentials,
    clearSavedLoginCredentials,
  } = useAuthStore();

  return {
    isAuthenticated,
    user,
    userType,
    hasSeenOnboarding,
    rememberMe,
    setUser,
    isLoading,
    setUserType,
    setAuthenticated,
    setHasSeenOnboarding,
    setRememberMe,
    logout,
    loadStoredAuth,
    saveLoginCredentials,
    getSavedLoginCredentials,
    clearSavedLoginCredentials,
  };
};
