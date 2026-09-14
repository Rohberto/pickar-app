import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Never let a hung native call (permission prompt that never resolves,
// a push-token request against a bad/missing project id, etc.) block the
// caller forever — this is what caused the App Review "spinner never
// stops after Login" rejection: registerForPushNotifications() was
// awaited directly inside the login flow, so if it hung, login never
// finished and the loading spinner never cleared.
const withTimeout = <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Register device for push notifications.
 * Returns the Expo push token, or null if not supported / permission denied.
 * Call this once after login and save the token to your backend.
 */
export const registerForPushNotifications = async (): Promise<string | null> => {
  // Push notifications only work on real devices
  if (!Device.isDevice) {
    console.log('[Notifications] Push not available on simulator');
    return null;
  }

  // Set Android notification channel
  if (Platform.OS === 'android') {
    await withTimeout(
      Notifications.setNotificationChannelAsync('chat', {
        name: 'Chat Messages',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#861313',
        sound: 'default',
      }),
      8000,
      undefined as any
    );
  }

  const { status: existing } = await withTimeout(
    Notifications.getPermissionsAsync(),
    8000,
    { status: 'undetermined' } as Notifications.NotificationPermissionsStatus
  );
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await withTimeout(
      Notifications.requestPermissionsAsync(),
      8000,
      { status: 'undetermined' } as Notifications.NotificationPermissionsStatus
    );
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Notifications] Permission denied');
    return null;
  }

  // projectId was previously read only from EXPO_PUBLIC_PROJECT_ID, which
  // was never actually set anywhere (.env, eas.json) — so this call ran
  // with projectId: undefined on every real device, including Apple's
  // review hardware. Fall back to the project id Expo already knows about
  // from app config so this has a real value even without the env var.
  const projectId =
    process.env.EXPO_PUBLIC_PROJECT_ID ||
    Constants.expoConfig?.extra?.eas?.projectId ||
    (Constants as any)?.easConfig?.projectId;

  try {
    const { data: token } = await withTimeout(
      Notifications.getExpoPushTokenAsync({ projectId }),
      8000,
      { data: null } as any
    );
    console.log('[Notifications] Push token:', token);
    return token ?? null;
  } catch (err) {
    console.error('[Notifications] Token error:', err);
    return null;
  }
};

/**
 * Show a local notification immediately (for foreground in-app notifications)
 */
export const showLocalNotification = async (title: string, body: string, data?: Record<string, unknown>) => {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data, sound: 'default' },
    trigger: null, // show immediately
  });
};