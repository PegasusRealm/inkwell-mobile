/**
 * InkWell Theme Context
 * Provides Light/Dark/System theme switching
 * Colors match web app CSS variables
 */

import React, {createContext, useContext, useState, useEffect, ReactNode} from 'react';
import {useColorScheme} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_STORAGE_KEY = 'inkwell_theme_preference';

export type ThemeMode = 'light' | 'dark' | 'system';

// Light theme colors (current default)
export const lightColors = {
  // Brand Colors - Calming Teal Palette
  brandPrimary: '#2A6972',
  brandSecondary: '#388b97',
  brandAlt: '#4A9BA8',
  brandLight: '#89C9D4',
  brandOutline: '#4f4f4f',
  brandPrimaryRgba: 'rgba(42, 105, 114, 0.3)',

  // Typography Colors
  fontMain: '#2D3748',
  fontSecondary: '#4A5568',
  fontMuted: '#718096',
  fontAccent: '#2A6972',
  fontWhite: '#ffffff',

  // Backgrounds - Warm Gray Scale
  bgPrimary: '#F5F5F3',
  bgCard: '#FFFFFF',
  bgCardHover: '#FAFAF9',
  bgMuted: '#F7F6F5',
  bgOverlay: 'rgba(255, 255, 255, 0.95)',
  bgSection: '#FAFAF9',

  // Borders
  borderLight: '#E2E8F0',
  borderMedium: '#CBD5E0',
  borderAccent: '#4A9BA8',

  // Mindful Accent Colors
  accentWisdom: '#D69E2E',
  accentGrowth: '#38A169',
  accentReflection: '#805AD5',
  accentWarm: '#E53E3E',

  // Subscription Tier Colors
  tierPlus: '#2A6972',
  tierPlusLight: '#4A9BA8',
  tierConnect: '#805AD5',
  tierConnectLight: '#9F7AEA',

  // Sophy Colors
  sophyAccent: '#D49489',
  sophyLight: '#E6A497',
  sophyHover: '#C2867D',

  // Interactive States (Buttons)
  btnPrimary: '#2A6972',
  btnPrimaryHover: '#1A4B52',
  btnSecondary: '#E2E8F0',
  btnSecondaryHover: '#CBD5E0',
  btnDanger: '#dc3545',
  btnDangerHover: '#c82333',
  btnWarning: '#ff9800',
  btnWarningHover: '#e68900',
  btnSuccess: '#28a745',
  btnSuccessHover: '#218838',
  btnInfo: '#17a2b8',
  btnInfoHover: '#138496',

  // Information/Helper Backgrounds
  infoBg: '#eaf6fb',
  
  // Status bar
  statusBar: 'dark-content' as 'dark-content' | 'light-content',
};

// Dark theme colors (matching web app dark CSS)
export const darkColors: typeof lightColors = {
  // Brand Colors - Lighter teal for dark backgrounds
  brandPrimary: '#4A9BA8',
  brandSecondary: '#7BB8C4',
  brandAlt: '#9FD3E0',
  brandLight: '#B8E0EA',
  brandOutline: '#A0AEC0',
  brandPrimaryRgba: 'rgba(74, 155, 168, 0.3)',

  // Typography Colors - Light text for dark backgrounds
  fontMain: '#F7FAFC',
  fontSecondary: '#E2E8F0',
  fontMuted: '#A0AEC0',
  fontAccent: '#4A9BA8',
  fontWhite: '#ffffff',

  // Backgrounds - Deep blue-gray palette
  bgPrimary: '#0D1B2A',
  bgCard: '#1A202C',
  bgCardHover: '#2D3748',
  bgMuted: '#1A202C',
  bgOverlay: 'rgba(26, 32, 44, 0.95)',
  bgSection: '#1B263B',

  // Borders
  borderLight: '#2D3748',
  borderMedium: '#4A5568',
  borderAccent: '#4A9BA8',

  // Mindful Accent Colors (slightly brighter for dark mode)
  accentWisdom: '#ECC94B',
  accentGrowth: '#48BB78',
  accentReflection: '#9F7AEA',
  accentWarm: '#FC8181',

  // Subscription Tier Colors
  tierPlus: '#4A9BA8',
  tierPlusLight: '#7BB8C4',
  tierConnect: '#9F7AEA',
  tierConnectLight: '#B794F4',

  // Sophy Colors (warmer for dark mode)
  sophyAccent: '#E6A497',
  sophyLight: '#F0B5A7',
  sophyHover: '#D49489',

  // Interactive States (Buttons)
  btnPrimary: '#4A9BA8',
  btnPrimaryHover: '#7BB8C4',
  btnSecondary: '#2D3748',
  btnSecondaryHover: '#4A5568',
  btnDanger: '#e74c3c',
  btnDangerHover: '#c0392b',
  btnWarning: '#ffa726',
  btnWarningHover: '#ff9800',
  btnSuccess: '#2ecc71',
  btnSuccessHover: '#27ae60',
  btnInfo: '#3498db',
  btnInfoHover: '#2980b9',

  // Information/Helper Backgrounds
  infoBg: 'rgba(42, 105, 114, 0.15)',
  
  // Status bar
  statusBar: 'light-content' as const,
};

export type ThemeColors = typeof lightColors;

interface ThemeContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  colors: ThemeColors;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({children}) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved theme preference
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved && (saved === 'light' || saved === 'dark' || saved === 'system')) {
          setThemeModeState(saved as ThemeMode);
        }
      } catch (error) {
        console.warn('Failed to load theme preference:', error);
      } finally {
        setIsLoaded(true);
      }
    };
    loadTheme();
  }, []);

  // Save theme preference
  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (error) {
      console.warn('Failed to save theme preference:', error);
    }
  };

  // Determine if dark mode is active
  const isDark = 
    themeMode === 'dark' || 
    (themeMode === 'system' && systemColorScheme === 'dark');

  // Get the active color palette
  const colors = isDark ? darkColors : lightColors;

  // Don't render until theme is loaded to prevent flash
  if (!isLoaded) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{themeMode, setThemeMode, colors, isDark}}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Helper hook to get just the colors
export const useColors = (): ThemeColors => {
  const {colors} = useTheme();
  return colors;
};
