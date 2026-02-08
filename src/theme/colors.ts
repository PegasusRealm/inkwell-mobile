/**
 * InkWell Color Palette
 * Synchronized with web app CSS variables
 * Source: /web/public/app.html :root styles
 */

export const colors = {
  // Brand Colors - Calming Teal Palette
  brandPrimary: '#2A6972',
  brandSecondary: '#388b97',
  brandAlt: '#4A9BA8',
  brandLight: '#89C9D4', // Updated to user's preferred light accent
  brandOutline: '#4f4f4f',
  brandPrimaryRgba: 'rgba(42, 105, 114, 0.3)',

  // Typography Colors
  fontMain: '#2D3748',
  fontSecondary: '#4A5568',
  fontMuted: '#718096',
  fontAccent: '#2A6972',
  fontWhite: '#ffffff',

  // Backgrounds - Warm Gray Scale
  bgPrimary: '#F5F5F3', // Very subtle warm gray
  bgCard: '#FFFFFF',
  bgCardHover: '#FAFAF9',
  bgMuted: '#F7F6F5',
  bgOverlay: 'rgba(255, 255, 255, 0.95)',
  bgSection: '#FAFAF9', // Light warm gray for sections

  // Borders
  borderLight: '#E2E8F0',
  borderMedium: '#CBD5E0',
  borderAccent: '#4A9BA8',

  // Mindful Accent Colors
  accentWisdom: '#D69E2E',
  accentGrowth: '#38A169',
  accentReflection: '#805AD5',
  accentWarm: '#E53E3E',

  // Subscription Tier Colors (consistent across app)
  tierFree: '#2A6972',        // Deep teal - free tier
  tierFreeLight: '#4A9BA8',   // Light teal for backgrounds
  tierPlus: '#D49489',        // Sophy coral - Plus tier
  tierPlusLight: '#E6A497',   // Light coral for backgrounds
  tierConnect: '#805AD5',     // Purple - Connect tier
  tierConnectLight: '#9F7AEA', // Light purple for backgrounds

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

  // Dark Theme Colors (for future implementation)
  dark: {
    bgPrimary: '#0D1B2A',
    bgCard: 'rgba(26, 32, 44, 0.9)',
    bgMuted: '#1A202C',
    fontMain: '#F7FAFC',
    fontSecondary: '#E2E8F0',
    fontMuted: '#A0AEC0',
    brandPrimary: '#4A9BA8',
    brandSecondary: '#7BB8C4',
    borderLight: '#2D3748',
    borderMedium: '#4A5568',
  },
};
