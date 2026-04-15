
import Constants from 'expo-constants';

export const Config = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL || 'https://api.pickar.com',
  env: process.env.EXPO_PUBLIC_ENV || 'development',
  isDev: __DEV__,
  appVersion: Constants.expoConfig?.version || '1.0.0',
};
