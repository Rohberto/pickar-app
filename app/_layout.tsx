import { useAuth } from '@/hooks/useAuth';
import { useFonts } from '@/hooks/useFonts';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { isAuthenticated, userType, hasSeenOnboarding, loadStoredAuth, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [appIsReady, setAppIsReady] = useState(false);
  const fontsLoaded = useFonts();

  // Load stored auth state on app start
  useEffect(() => {
    async function prepare() {
      try {
        await loadStoredAuth();
      } catch (e) {
        console.warn(e);
      }
    }
    prepare();
  }, []);

  // App is ready when fonts are loaded and auth state is loaded
  useEffect(() => {
    if (fontsLoaded && !isLoading) {
      setAppIsReady(true);
    }
  }, [fontsLoaded, isLoading]);

  // Hide native splash and show custom splash when ready
  useEffect(() => {
    if (appIsReady) {
      SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  // Don't render anything until app is ready
  if (!appIsReady) {
    return null;
  }

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
      <Stack.Screen name="(user)" />
      <Stack.Screen name="(driver)" />
    </Stack>
  );
}