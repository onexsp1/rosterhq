import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '../services/apiClient';

interface UseApiOptions {
  manual?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}

/**
 * useApi Hook
 * Standardizes fetch logic (loading, error, data) across the app.
 */
export const useApi = (endpoint: string, options: UseApiOptions = {}) => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(!options.manual);
  const [error, setError] = useState<any>(null);

  const fetchData = useCallback(async (params = "") => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(`${endpoint}${params}`);
      if (response.ok) {
        const json = await response.json();
        setData(json);
        options.onSuccess?.(json);
      } else {
        const errJson = await response.json();
        setError(errJson);
        options.onError?.(errJson);
      }
    } catch (err) {
      setError(err);
      options.onError?.(err);
    } finally {
      setIsLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    if (!options.manual) {
      fetchData();
    }
  }, [fetchData, options.manual]);

  return { data, isLoading, error, fetchData, setData };
};
