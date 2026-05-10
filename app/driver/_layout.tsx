import { useAuth } from '@/hooks/useAuth';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

export default function DriverLayout() {
  const { isAuthenticated, userType, isLoading } = useAuth();
  const router = useRouter();
  // Prevent multiple redirect calls if auth state changes rapidly
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || userType !== 'driver') {
      if (!hasRedirectedRef.current) {
        hasRedirectedRef.current = true;
        router.replace('/auth/register-choice' as never);
      }
    }
  }, [isLoading, isAuthenticated, userType]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="navigate-pickup" />
      <Stack.Screen name="at-pickup" />
      <Stack.Screen name="confirm-pickup" />
      <Stack.Screen name="navigate-delivery" />
      <Stack.Screen name="confirm-delivery" />
      <Stack.Screen name="delivery-complete" />
       <Stack.Screen name="withdraw" />
    </Stack>
  );
}