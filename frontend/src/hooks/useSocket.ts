import { useEffect, useState, useCallback } from 'react';
import { AppState, AppStateStatus, DeviceEventEmitter } from 'react-native';
import { BASE_URL } from '../constants/api';

let globalSocket: WebSocket | null = null;
let subscribers: ((data: any) => void)[] = [];
let isConnecting = false;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

export const useSocket = (userId: string | null) => {
  const [isConnected, setIsConnected] = useState(globalSocket?.readyState === WebSocket.OPEN);

  // --- THE FIX: LISTEN GLOBALLY ---
  // No matter which screen we are on, always listen for the global status shout!
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('socket_status', (status: boolean) => {
      setIsConnected(status);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const connectSocket = () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }

      if (!globalSocket && !isConnecting) {
        isConnecting = true;
        
        const wsUrl = BASE_URL.replace('http', 'ws') + `/ws/${userId}`;
        globalSocket = new WebSocket(wsUrl);

        globalSocket.onopen = () => {
          isConnecting = false;
          // SHOUT TO THE LAYOUT BANNER: WE ARE ONLINE!
          DeviceEventEmitter.emit('socket_status', true); 
        };

        globalSocket.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            subscribers.forEach(callback => callback(parsed));
          } catch (e) {
            console.error("Socket parse error", e);
          }
        };

        globalSocket.onclose = () => {
          globalSocket = null;
          isConnecting = false;
          // SHOUT TO THE LAYOUT BANNER: WE LOST CONNECTION!
          DeviceEventEmitter.emit('socket_status', false); 
          
          reconnectTimeout = setTimeout(() => {
            connectSocket();
          }, 3000);
        };
      } else if (globalSocket?.readyState === WebSocket.OPEN) {
         setIsConnected(true);
      }
    };

    connectSocket();

    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        connectSocket();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [userId]);

  const addListener = useCallback((callback: (data: any) => void) => {
    subscribers.push(callback);
    return () => {
      subscribers = subscribers.filter(cb => cb !== callback);
    };
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (globalSocket?.readyState === WebSocket.OPEN) {
      globalSocket.send(JSON.stringify(message));
    }
  }, []);

  return { isConnected, addListener, sendMessage };
};