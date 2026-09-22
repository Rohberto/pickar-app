
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

// Replace with your ngrok URL
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized - logout user
      await AsyncStorage.multiRemove(['authToken', 'user', 'isAuthenticated']);
    }

    // Our backend (Render free tier) spins down when idle and can take
    // 20-50+ seconds to wake up on the next request — the very first
    // request after a period of inactivity often fails outright with a
    // network error (no response received) rather than just being slow.
    // Auto-retry network-level failures (not real 4xx/5xx app errors) a
    // couple of times with backoff so this self-heals instead of showing
    // the user "network error" on their very first tap.
    const config = error.config;
    // No response at all (network error OR timeout) — both are symptomatic
    // of the backend still waking up, so retry either.
    const isNetworkError = !error.response;
    if (config && isNetworkError && !config._retryCount) {
      config._retryCount = 0;
    }
    if (config && isNetworkError && config._retryCount < 2) {
      config._retryCount += 1;
      const delay = config._retryCount * 3000; // 3s, then 6s
      await new Promise((resolve) => setTimeout(resolve, delay));
      return api(config);
    }

    return Promise.reject(error);
  }
);

export default api;
export { API_BASE_URL };
