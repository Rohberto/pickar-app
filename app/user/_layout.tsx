import { useAuth } from '@/hooks/useAuth';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

export default function UserLayout() {
  const { isAuthenticated, userType, isLoading } = useAuth();
  const router = useRouter();
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || userType !== 'user') {
      if (!hasRedirectedRef.current) {
        hasRedirectedRef.current = true;
        router.replace('/auth/register-choice' as never);
      }
    }
  }, [isLoading, isAuthenticated, userType]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="finding-driver" />
      <Stack.Screen name="send-package" />
      <Stack.Screen name="choose-ride" />
      <Stack.Screen name="confirm-pickup" />
      <Stack.Screen name="delivery-instructions" />
      <Stack.Screen name="track-package" />
      <Stack.Screen name="delivery-complete" />
      <Stack.Screen name="add-funds" />
      <Stack.Screen name="chat" />
      <Stack.Screen name="ride-history" options={{ headerShown: false }} />
    </Stack>
  );
}