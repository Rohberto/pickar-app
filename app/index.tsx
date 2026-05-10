import { useAuth } from '@/hooks/useAuth';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const { isLoading } = useAuth();

  // Wait until auth is loaded before redirecting
  if (isLoading) {
    return <View style={{ flex: 1, backgroundColor: '#8B1538' }} />;
    // Or a spinner: <ActivityIndicator />
  }

  return <Redirect href="/splash" />;
}