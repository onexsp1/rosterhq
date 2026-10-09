import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkThemeColors, lightThemeColors, ThemeColors } from './colors';

type ThemeMode = 'light' | 'dark';

interface ThemeContextData {
  mode: ThemeMode;
  colors: ThemeColors;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextData | undefined>(undefined);

export const AppThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>('dark'); // Default to your Navy palette

  useEffect(() => {
    // Load saved preferences
    AsyncStorage.getItem('user_theme').then((savedTheme) => {
      if (savedTheme === 'light' || savedTheme === 'dark') {
        setMode(savedTheme);
      }
    });
  }, []);

  const toggleTheme = () => {
    const newMode = mode === 'dark' ? 'light' : 'dark';
    setMode(newMode);
    AsyncStorage.setItem('user_theme', newMode);
  };

  const setTheme = (newMode: ThemeMode) => {
    setMode(newMode);
    AsyncStorage.setItem('user_theme', newMode);
  };

  const colors = mode === 'dark' ? darkThemeColors : lightThemeColors;

  return (
    <ThemeContext.Provider value={{ mode, colors, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    // Fail-safe defaults if accessed before Provider mounts
    return { mode: 'dark' as ThemeMode, colors: darkThemeColors, toggleTheme: () => {}, setTheme: () => {} };
  }
  return context;
};
