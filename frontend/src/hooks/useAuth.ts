import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * useAuth Hook
 * Provides a centralized way to access logged-in user information.
 */
export const useAuth = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadToken = async () => {
      const token = await AsyncStorage.getItem('userToken');
      const id = await AsyncStorage.getItem('userId');
      setUserId(id);
      setIsLoading(false); // Only set to false AFTER reading from storage
    };
    loadToken();
  }, []);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const [id, email, first, last] = await Promise.all([
        AsyncStorage.getItem('userId'),
        AsyncStorage.getItem('userEmail'),
        AsyncStorage.getItem('userFirstName'),
        AsyncStorage.getItem('userLastName')
      ]);

      setUserId(id);
      setUserEmail(email);
      if (first && last) {
        setUserName(`${first} ${last}`);
      }
    } catch (e) {
      console.error("Auth Hook Error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    userId,
    userEmail,
    userName,
    isLoading,
    refreshAuth: loadUserData
  };
};
