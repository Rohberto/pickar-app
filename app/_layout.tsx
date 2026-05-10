import { useAuth } from '@/hooks/useAuth';
import { useFonts } from '@/hooks/useFonts';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { loadStoredAuth, isLoading: authLoading } = useAuth();
  const fontsLoaded = useFonts();

  const [appIsReady, setAppIsReady] = useState(false);

  // Load auth once on mount
  useEffect(() => {
    async function prepare() {
      try {
        await loadStoredAuth();
      } catch (e) {
        console.warn('Auth loading failed:', e);
      }
    }
    prepare();
  }, []);

  // Mark app as ready when fonts + auth are done
useEffect(() => {
  if (fontsLoaded && !authLoading && !appIsReady) {
    setAppIsReady(true); // ✅ guard with !appIsReady to prevent repeated sets
  }
}, [fontsLoaded, authLoading]);

  // Hide splash screen only once when app is ready
  useEffect(() => {
    if (appIsReady) {
      SplashScreen.hideAsync().catch(console.warn);
    }
  }, [appIsReady]);

  // Always render Stack immediately (important for Expo Router)
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        animationDuration: 300,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="splash" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="auth" />
      <Stack.Screen name="user" />
      <Stack.Screen name="driver" />
    </Stack>
  );
}