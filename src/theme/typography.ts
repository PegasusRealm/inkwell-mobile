/**
 * InkWell Typography System
 * Custom fonts: Alice (headers), Playfair Display (body), Lato (buttons)
 * 
 * Font Installation: Run `npx react-native-asset` after adding fonts
 */

import { Platform, TextStyle } from 'react-native';
import { colors } from './colors';

// Font Family Definitions
export const fontFamily = {
  // Headers - Alice (elegant serif)
  header: Platform.select({
    ios: 'Alice-Regular',
    android: 'Alice-Regular',
    default: 'Alice-Regular',
  }),
  // Body copy - Playfair Display (readable serif)
  body: Platform.select({
    ios: 'PlayfairDisplay-Regular',
    android: 'PlayfairDisplay-Regular',
    default: 'PlayfairDisplay-Regular',
  }),
  bodyBold: Platform.select({
    ios: 'PlayfairDisplay-Bold',
    android: 'PlayfairDisplay-Bold',
    default: 'PlayfairDisplay-Bold',
  }),
  // Buttons & UI - Lato (clean sans-serif)
  button: Platform.select({
    ios: 'Lato-Regular',
    android: 'Lato-Regular',
    default: 'Lato-Regular',
  }),
  buttonBold: Platform.select({
    ios: 'Lato-Bold',
    android: 'Lato-Bold',
    default: 'Lato-Bold',
  }),
  // System fallbacks
  system: Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'System',
  }),
};

// Font Sizes - Consistent scale
export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 28,
  display: 32,
  hero: 40,
};

// Line Heights
export const lineHeight = {
  tight: 1.2,
  snug: 1.35,
  normal: 1.5,
  relaxed: 1.65,
  loose: 1.8,
};

// Letter Spacing
export const letterSpacing = {
  tight: -0.5,
  normal: 0,
  wide: 0.5,
  wider: 1,
  widest: 2,
};

/**
 * Pre-built Text Styles
 * Use these for consistent typography across the app
 */
export const textStyles: Record<string, TextStyle> = {
  // ============ HEADERS (Alice) ============
  // Screen titles, major headings
  screenTitle: {
    fontFamily: fontFamily.header,
    fontSize: fontSize.xxl,
    color: colors.fontMain,
    letterSpacing: letterSpacing.normal,
  },
  
  // Section headers within screens
  sectionHeader: {
    fontFamily: fontFamily.header,
    fontSize: fontSize.xl,
    color: colors.fontMain,
    letterSpacing: letterSpacing.normal,
  },
  
  // Card titles, subsection headers
  cardTitle: {
    fontFamily: fontFamily.header,
    fontSize: fontSize.lg,
    color: colors.fontMain,
    letterSpacing: letterSpacing.normal,
  },
  
  // Small headers, labels with emphasis
  smallHeader: {
    fontFamily: fontFamily.header,
    fontSize: fontSize.md,
    color: colors.fontMain,
    letterSpacing: letterSpacing.normal,
  },

  // ============ BODY TEXT (Playfair Display) ============
  // Primary body text - journal entries, descriptions
  body: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: colors.fontMain,
    lineHeight: fontSize.base * lineHeight.relaxed,
  },
  
  // Larger body text for reading
  bodyLarge: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.lg,
    color: colors.fontMain,
    lineHeight: fontSize.lg * lineHeight.relaxed,
  },
  
  // Smaller body text
  bodySmall: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.fontSecondary,
    lineHeight: fontSize.sm * lineHeight.normal,
  },
  
  // Emphasized body text
  bodyBold: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.base,
    color: colors.fontMain,
    lineHeight: fontSize.base * lineHeight.relaxed,
  },

  // ============ UI TEXT (Lato) ============
  // Primary button text
  buttonPrimary: {
    fontFamily: fontFamily.buttonBold,
    fontSize: fontSize.md,
    color: colors.fontWhite,
    letterSpacing: letterSpacing.wide,
  },
  
  // Secondary/outline button text
  buttonSecondary: {
    fontFamily: fontFamily.button,
    fontSize: fontSize.md,
    color: colors.brandPrimary,
    letterSpacing: letterSpacing.wide,
  },
  
  // Small button text
  buttonSmall: {
    fontFamily: fontFamily.button,
    fontSize: fontSize.sm,
    color: colors.fontWhite,
    letterSpacing: letterSpacing.normal,
  },

  // ============ LABELS & HINTS ============
  // Form labels
  label: {
    fontFamily: fontFamily.button,
    fontSize: fontSize.sm,
    color: colors.fontSecondary,
    letterSpacing: letterSpacing.wide,
  },
  
  // Input placeholder style reference
  placeholder: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: colors.fontMuted,
  },
  
  // Hint text, helper text
  hint: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.fontMuted,
    fontStyle: 'italic',
    lineHeight: fontSize.sm * lineHeight.normal,
  },
  
  // Caption text - timestamps, metadata
  caption: {
    fontFamily: fontFamily.button,
    fontSize: fontSize.xs,
    color: colors.fontMuted,
    letterSpacing: letterSpacing.normal,
  },

  // ============ SPECIAL STYLES ============
  // Badge text
  badge: {
    fontFamily: fontFamily.buttonBold,
    fontSize: fontSize.xs,
    color: colors.fontWhite,
    letterSpacing: letterSpacing.wider,
    textTransform: 'uppercase',
  },
  
  // Link text
  link: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: colors.brandPrimary,
    textDecorationLine: 'underline',
  },
  
  // Error text
  error: {
    fontFamily: fontFamily.button,
    fontSize: fontSize.sm,
    color: colors.btnDanger,
  },
  
  // Success text
  success: {
    fontFamily: fontFamily.button,
    fontSize: fontSize.sm,
    color: colors.btnSuccess,
  },

  // ============ NAVIGATION ============
  // Tab bar labels
  tabLabel: {
    fontFamily: fontFamily.button,
    fontSize: fontSize.xs,
  },
  
  // Navigation header title
  navTitle: {
    fontFamily: fontFamily.header,
    fontSize: fontSize.xl,
    color: colors.fontWhite,
  },
};

// Legacy export for backwards compatibility
export const typography = {
  fontFamily,
  fontSize,
  lineHeight,
  letterSpacing,
  textStyles,
  // Legacy weight strings (use fontFamily.buttonBold etc instead)
  fontWeight: {
    light: '300' as const,
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};
