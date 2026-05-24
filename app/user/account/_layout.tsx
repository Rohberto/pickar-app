import { Stack } from 'expo-router';

export default function AccountLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="your-profile" />
      <Stack.Screen name="security" />
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="delete-account" />
    </Stack>
  );
}