import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getBaseUrl = (): string => {
  // 1. If explicit environment variable is defined
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '');
  }

  // 2. Web browser support
  if (Platform.OS === 'web') {
    const hostname =
      typeof window !== 'undefined' && window.location?.hostname
        ? window.location.hostname
        : 'localhost';
    return `http://${hostname}:8000`;
  }

  // 3. Dynamically detect local dev machine IP from Expo hostUri
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as any).expoGoConfig?.debuggerHost ??
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;

  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip) {
      return `http://${ip}:8000`;
    }
  }

  // 4. Android emulator fallback (10.0.2.2 maps to host machine 127.0.0.1)
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }

  // 5. Default fallback to current machine IP
  return 'http://192.168.1.215:8000';
};

export const BASE_URL = getBaseUrl();

export const ENDPOINTS = {
  TEAMS: `${BASE_URL}/teams`,
  SIGNUP: `${BASE_URL}/auth/signup`,
  LOGIN: `${BASE_URL}/auth/login`,
  POSTS: `${BASE_URL}/posts`,
};