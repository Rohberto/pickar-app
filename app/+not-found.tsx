// app/+not-found.tsx
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

export default function NotFound() {
  const router = useRouter();
  const { isAuthenticated, userType, hasSeenOnboarding } = useAuth();

  useEffect(() => {
    if (router.canGoBack()) {
      router.back();
    } else if (!hasSeenOnboarding) {
      router.replace('/onboarding');
    } else if (!isAuthenticated) {
      router.replace('/auth/register-choice');
    } else if (userType === 'user') {
      router.replace('/user/(tabs)/home' as never);
    } else {
      router.replace('/driver/(tabs)/home' as never);
    }
  }, []);

  return null;
}