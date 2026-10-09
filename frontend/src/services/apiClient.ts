import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../constants/api';
import { Alert, DeviceEventEmitter } from 'react-native';
import { router } from 'expo-router'; // <-- ADDED EXPO ROUTER

export const apiClient = {
  async request(endpoint: string, options: RequestInit = {}) {
    const token = await AsyncStorage.getItem('userToken');

    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${BASE_URL}${path}`;

    const isFormData = options.body instanceof FormData;

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      // This tells Android's network engine NOT to keep the connection alive,
      // which often prevents the stale socket bug from ever happening!
      'Connection': 'close',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...((options.headers as Record<string, string>) || {}),
    };

    if (!isFormData && options.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts) {
      attempts++;

      // --- THE FIX: REBUILD FORM DATA ON RETRY ---
      // fetch() consumes the body stream. If we are on attempt 2, 
      // we MUST rebuild the FormData object from the original parts.
      let currentBody = options.body;
      if (isFormData && attempts > 1) {
        currentBody = new FormData();
        const parts = (options.body as any)._parts || [];
        parts.forEach((part: any) => {
          (currentBody as FormData).append(part[0], part[1]);
        });
        console.log(`[API Client] Rebuilt FormData for attempt ${attempts}`);
      }

      const controller = new AbortController();
      const timeoutValue = isFormData ? 90000 : 15000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutValue);

      try {
        const response = await fetch(url, {
          ...options,
          headers,
          body: currentBody, // Use the fresh body
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.status === 401) {
          console.log("[Auth] Token expired. Clearing session...");
          await AsyncStorage.multiRemove(['userToken', 'userId', 'userFirstName']);

          // --- THE FIX: ADD BUTTON WITH NAVIGATION LOGIC ---
          Alert.alert(
            "Session Expired",
            "Please log in again.",
            [
              {
                text: "OK",
                onPress: () => {
                  DeviceEventEmitter.emit("force_logout");
                  // Redirect to your login screen (change '/' to '/login' if needed)
                  router.replace('/');
                }
              }
            ],
            // Prevent dismissing the alert by tapping outside
            { cancelable: false }
          );
        }

        return response;

      } catch (error: any) {
        clearTimeout(timeoutId);

        const isTimeout = error.name === 'AbortError';
        const isOffline = error.message === "Network request failed" || error.name === "TypeError";

        if (isOffline && attempts < maxAttempts) {
          console.log(`[API Client] Stale connection detected on attempt ${attempts}. Retrying silently...`);
          continue;
        }

        if (isTimeout || isOffline) {
          const detailMsg = isTimeout ? "Upload timed out" : "Offline";
          console.log(`[API Client] ${detailMsg} for ${endpoint} after ${attempts} attempts`);

          return {
            ok: false,
            status: isTimeout ? 408 : 0,
            json: async () => ({
              detail: isTimeout
                ? "The media is too large or connection is slow. Try a shorter clip."
                : "Network error. Please check your connection."
            }),
          } as any;
        }

        Alert.alert("Error", "Something went wrong with the server.");
        throw error;
      }
    }
  },

  get: (endpoint: string, options?: RequestInit) =>
    apiClient.request(endpoint, { ...options, method: 'GET' }),

  post: (endpoint: string, body?: any, options?: RequestInit) =>
    apiClient.request(endpoint, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body)
    }),

  put: (endpoint: string, body?: any, options?: RequestInit) =>
    apiClient.request(endpoint, {
      ...options,
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body)
    }),

  delete: (endpoint: string, options?: RequestInit) =>
    apiClient.request(endpoint, { ...options, method: 'DELETE' }),
};