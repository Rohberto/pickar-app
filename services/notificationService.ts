import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

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
    await Notifications.setNotificationChannelAsync('chat', {
      name: 'Chat Messages',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#861313',
      sound: 'default',
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Notifications] Permission denied');
    return null;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID, // add this to your .env
    });
    console.log('[Notifications] Push token:', token);
    return token;
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