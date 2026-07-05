/**
 * InkWell Typography System — v2 design language (2026-07-04)
 * Newsreader writes (display + the user's words), Manrope runs the UI.
 * Mirrors web: --title-font / --serif-font = Newsreader, --body-font = Manrope.
 *
 * Fonts bundled in /assets/fonts (PostScript-exact filenames so one
 * fontFamily string works on iOS AND Android). After changing fonts:
 * `npx react-native-asset`, then a fresh native build.
 * Old fonts (Alice/Playfair/Lato) remain bundled until the M2 screen sweep
 * finishes, then move to assets/fonts-extra with the rest.
 */

import { Platform, TextStyle } from 'react-native';
import { colors } from './colors';

// Font Family Definitions
export const fontFamily = {
  // Display serif — big headings, screen titles (optical 36pt)
  header: 'Newsreader36pt-Medium',
  headerItalic: 'Newsreader36pt-Italic',
  // Reading serif — the user's words, entry text, Sophy's lines (optical 14pt)
  serif: 'Newsreader14pt-Regular',
  serifMedium: 'Newsreader14pt-Medium',
  serifItalic: 'Newsreader14pt-Italic',
  // UI sans — body copy, labels, controls. Manrope runs the UI.
  body: 'Manrope-Regular',
  bodyBold: 'Manrope-Bold',
  button: 'Manrope-SemiBold',
  buttonBold: 'Manrope-Bold',
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
  
  // ============ V2 ADDITIONS (2026-07-04) ============
  // Eyebrow — caps label over sections (mockup .who / manifest-eyebrow)
  eyebrow: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.xs,
    color: colors.brandPrimary,
    letterSpacing: letterSpacing.widest,
    textTransform: 'uppercase',
  },

  // The user's words — writing surfaces, entry text (serif, generous)
  serifBody: {
    fontFamily: fontFamily.serif,
    fontSize: fontSize.md,
    color: colors.fontMain,
    lineHeight: fontSize.md * lineHeight.loose,
  },

  // Sophy's line — her voice is serif italic (mockup .line)
  sophyLine: {
    fontFamily: fontFamily.serifItalic,
    fontSize: fontSize.md,
    color: colors.fontMain,
    fontStyle: 'italic',
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
