/**
 * InkWell Theme Context — v2 design language (2026-07-04)
 * Light (White & Clean) / Dark (Ink & Light) / Reading (warm paper) / System.
 *
 * Tokens mirror the web: /web/public/app.html + inkwell-v2.css contracts,
 * from the Adam-approved mockups in Projects/InkWell/builds/ui-pass-2026-07/.
 *
 * LAWS: teal is structure; coral is Sophy's only (warm surfaces inside her
 * blocks — cool tokens read teal there); Reading is opt-in ONLY, never a
 * default (zombie-pastel rule); purple is dead (Connect retired).
 */

import React, {createContext, useContext, useState, useEffect, ReactNode} from 'react';
import {useColorScheme} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_STORAGE_KEY = 'inkwell_theme_preference';

export type ThemeMode = 'light' | 'dark' | 'reading' | 'system';

// ── LIGHT: White & Clean — true white cards on a cool lift ──
export const lightColors = {
  brandPrimary: '#2A6972',
  brandSecondary: '#1E8A99',
  brandAlt: '#4A9BA8',
  brandLight: '#89C9D4',
  brandOutline: '#43514E',
  brandPrimaryRgba: 'rgba(42, 105, 114, 0.3)',

  fontMain: '#101B19',
  fontSecondary: '#43514E',
  fontMuted: '#6B7876',
  fontAccent: '#2A6972',
  fontWhite: '#ffffff',
  fontDark: '#101B19',

  bgPrimary: '#F2F6F6',
  bgCard: '#FFFFFF',
  bgCardHover: '#FAFBFB',
  bgMuted: '#F6F8F8',
  bgOverlay: 'rgba(255, 255, 255, 0.92)',
  bgSection: '#F6F8F8',

  borderLight: '#E6E9E9',
  borderMedium: '#D5DBDA',
  borderAccent: '#2A6972',

  accentWisdom: '#B8860B',
  accentGrowth: '#38A169',
  accentReflection: '#C96F5E', // Sophy's — saturated coral for light ground
  accentWarm: '#C75050',

  tierFree: '#2A6972',
  tierFreeLight: '#4A9BA8',
  tierPlus: '#D49489',
  tierPlusLight: '#E6A497',
  tierConnect: '#4A9BA8',      // Connect retired — teal, never purple
  tierConnectLight: '#89C9D4',

  sophyAccent: '#C96F5E',
  sophyLight: '#D49489',
  sophyHover: '#B85F4F',
  sophyTint: 'rgba(212, 148, 137, 0.10)',
  sophyBorder: 'rgba(212, 148, 137, 0.25)',
  sophyFieldBg: '#FFFFFF',
  sophyFieldBorder: '#D5DBDA',

  btnPrimary: '#2A6972',
  btnPrimaryHover: '#1F565E',
  btnSecondary: '#EDF1F1',
  btnSecondaryHover: '#E2E8E8',
  btnDanger: '#C0392B',
  btnDangerHover: '#A93226',
  btnWarning: '#E8A33D',
  btnWarningHover: '#D08F2C',
  btnSuccess: '#38A169',
  btnSuccessHover: '#2F8A59',
  btnInfo: '#2A6972',
  btnInfoHover: '#1F565E',

  infoBg: 'rgba(95, 179, 191, 0.08)',

  statusBar: 'dark-content' as 'dark-content' | 'light-content',
};

// ── DARK: Ink & Light — bone words on raised ink ──
export const darkColors: typeof lightColors = {
  brandPrimary: '#5FB3BF',
  brandSecondary: '#7BC4CE',
  brandAlt: '#4A9BA8',
  brandLight: '#89C9D4',
  brandOutline: '#9BA6A3',
  brandPrimaryRgba: 'rgba(95, 179, 191, 0.3)',

  fontMain: '#EDE7DC',
  fontSecondary: '#C9C4B8',
  fontMuted: '#9BA6A3',
  fontAccent: '#5FB3BF',
  fontWhite: '#ffffff',
  fontDark: '#EDE7DC',

  bgPrimary: '#111A1C',
  bgCard: '#172225',
  bgCardHover: '#1C2A2E',
  bgMuted: '#0C1213',
  bgOverlay: 'rgba(17, 26, 28, 0.92)',
  bgSection: '#0C1213',

  borderLight: '#1E2C30',
  borderMedium: '#2A3A3F',
  borderAccent: '#5FB3BF',

  accentWisdom: '#D4A72C',
  accentGrowth: '#48BB78',
  accentReflection: '#D49489', // Sophy's brand coral on dark
  accentWarm: '#E07856',

  tierFree: '#5FB3BF',
  tierFreeLight: '#89C9D4',
  tierPlus: '#D49489',
  tierPlusLight: '#E6A497',
  tierConnect: '#4A9BA8',
  tierConnectLight: '#89C9D4',

  sophyAccent: '#D49489',
  sophyLight: '#E6A497',
  sophyHover: '#C2867D',
  sophyTint: 'rgba(212, 148, 137, 0.14)',
  sophyBorder: 'rgba(212, 148, 137, 0.25)',
  // Her fields are WARM ink — cool card tokens read teal inside her block
  sophyFieldBg: '#1D1917',
  sophyFieldBorder: 'rgba(212, 148, 137, 0.32)',

  btnPrimary: '#2A6972',       // deep teal chassis, white text — both themes
  btnPrimaryHover: '#35818C',
  btnSecondary: '#1C2A2E',
  btnSecondaryHover: '#233438',
  btnDanger: '#C0392B',
  btnDangerHover: '#D64533',
  btnWarning: '#E8A33D',
  btnWarningHover: '#F0B155',
  btnSuccess: '#38A169',
  btnSuccessHover: '#48BB78',
  btnInfo: '#2A6972',
  btnInfoHover: '#35818C',

  infoBg: 'rgba(95, 179, 191, 0.10)',

  statusBar: 'light-content' as const,
};

// ── READING: warm paper. LAW: opt-in ONLY, never a default. ──
export const readingColors: typeof lightColors = {
  ...lightColors,
  fontMain: '#2E2A22',
  fontSecondary: '#574F3E',
  fontMuted: '#83795F',

  bgPrimary: '#F1EAD8',
  bgCard: '#FBF6EA',
  bgCardHover: '#F7F0E0',
  bgMuted: '#F1E9D6',
  bgOverlay: 'rgba(251, 246, 234, 0.92)',
  bgSection: '#F1E9D6',

  borderLight: '#E8DDC5',
  borderMedium: '#D6C8A8',

  btnSecondary: '#EDE4CE',
  btnSecondaryHover: '#E5DABD',

  infoBg: 'rgba(42, 105, 114, 0.06)',

  statusBar: 'dark-content' as const,
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
        if (saved && (saved === 'light' || saved === 'dark' || saved === 'reading' || saved === 'system')) {
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

  // Determine the active palette
  const isDark =
    themeMode === 'dark' ||
    (themeMode === 'system' && systemColorScheme === 'dark');

  const colors =
    themeMode === 'reading' ? readingColors : isDark ? darkColors : lightColors;

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
