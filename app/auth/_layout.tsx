import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="register-choice" />
      <Stack.Screen name="user/signup" />
      <Stack.Screen name="user/login" />
      <Stack.Screen name="driver/signup" />
      <Stack.Screen name="driver/login" />
    </Stack>
  );
}
