// src/theme/colors.ts

export type ThemeColors = {
  background: string;
  cardBg: string;
  primary: string;
  textMain: string;
  textSubtle: string;
  pillBg: string;
  pillBorder: string;
  teal: string;
  coral: string;
  sky: string;
};

export const darkThemeColors: ThemeColors = {
  background: '#0F3460', // Deep navy palette
  cardBg: '#1A3A63',     // Slightly lighter for the preview card
  primary: '#1976D2',    // Primary blue for the main CTA
  textMain: '#FFFFFF',
  textSubtle: '#9DB2C6', // Light blue-grey for subtitles
  pillBg: 'rgba(25, 118, 210, 0.2)', // Transparent blue for pills
  pillBorder: '#1976D2',
  
  // Badge Colors
  teal: '#2A9D8F',
  coral: '#E76F51',
  sky: '#63A4FF',
};

export const lightThemeColors: ThemeColors = {
  background: '#F8F9FA', // Clean off-white
  cardBg: '#FFFFFF',     // Bright white card
  primary: '#1976D2',    
  textMain: '#1A1A1A',   // Very dark gray
  textSubtle: '#6B7280', // Contrast gray
  pillBg: 'rgba(25, 118, 210, 0.1)', 
  pillBorder: '#1976D2',
  
  teal: '#2A9D8F',
  coral: '#E76F51',
  sky: '#63A4FF',
};

// Fallback constant for files not yet migrated to useTheme()
export const colors = darkThemeColors;