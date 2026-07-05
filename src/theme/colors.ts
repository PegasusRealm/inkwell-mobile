/**
 * InkWell Color Palette — v2 design language (2026-07-04)
 * Synchronized with web app tokens. Source of truth:
 *   /web/public/app.html :root + [data-theme] blocks
 *   /web/public/inkwell-v2.css component contracts
 *   Projects/InkWell/builds/ui-pass-2026-07/ mockups (Adam-approved)
 *
 * LAWS (do not drift):
 *  - Teal is structure. Coral (#D49489 family) is Sophy's ONLY — never teal
 *    anywhere inside her surfaces, no cool-cast tokens in her blocks.
 *  - No zombie pastels: no grayed/muted comfort palettes as defaults.
 *    Reading (warm paper) exists ONLY as an explicit user choice.
 *  - Purple is dead (Connect retired 2026-07-01).
 */

export const colors = {
  // Brand — teal is structure
  brandPrimary: '#2A6972',
  brandSecondary: '#1E8A99',
  brandAlt: '#4A9BA8',
  brandLight: '#89C9D4',
  brandOutline: '#43514E',
  brandPrimaryRgba: 'rgba(42, 105, 114, 0.3)',

  // Typography — deep ink, crisp secondary (White & Clean)
  fontMain: '#101B19',
  fontSecondary: '#43514E',
  fontMuted: '#6B7876',
  fontAccent: '#2A6972',
  fontWhite: '#ffffff',

  // Backgrounds — lift under white cards (page < muted < card)
  bgPrimary: '#F2F6F6',
  bgCard: '#FFFFFF',
  bgCardHover: '#FAFBFB',
  bgMuted: '#F6F8F8',
  bgOverlay: 'rgba(255, 255, 255, 0.92)',
  bgSection: '#F6F8F8',

  // Borders — crisp hairlines
  borderLight: '#E6E9E9',
  borderMedium: '#D5DBDA',
  borderAccent: '#2A6972',

  // Accents — every color is semantic
  accentWisdom: '#B8860B',
  accentGrowth: '#38A169',
  accentReflection: '#D49489', // Sophy's — reflections are hers (was purple; purple is dead)
  accentWarm: '#C75050',

  // Subscription tier colors (Connect retired; token kept for back-compat, teal not purple)
  tierFree: '#2A6972',
  tierFreeLight: '#4A9BA8',
  tierPlus: '#D49489',
  tierPlusLight: '#E6A497',
  tierConnect: '#4A9BA8',
  tierConnectLight: '#89C9D4',

  // Sophy — coral ONLY, saturated variant for light grounds
  sophyAccent: '#C96F5E',
  sophyLight: '#D49489',
  sophyHover: '#B85F4F',
  sophyTint: 'rgba(212, 148, 137, 0.10)',
  sophyBorder: 'rgba(212, 148, 137, 0.25)',

  // Buttons — one family, four voices (see web inkwell-v2.css contracts)
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

  // Information/helper backgrounds
  infoBg: 'rgba(95, 179, 191, 0.08)',

  // ── DARK: Ink & Light (the face of the app) ──
  dark: {
    bgPrimary: '#111A1C',        // page — ink
    bgCard: '#172225',           // raised card — ink-2
    bgCardHover: '#1C2A2E',
    bgMuted: '#0C1213',          // deepest surface
    bgOverlay: 'rgba(17, 26, 28, 0.92)',
    fontMain: '#EDE7DC',         // bone — warm, not white
    fontSecondary: '#C9C4B8',
    fontMuted: '#9BA6A3',
    brandPrimary: '#5FB3BF',     // structure & action in dark
    brandSecondary: '#7BC4CE',
    borderLight: '#1E2C30',      // stroke / hairline — ink-3
    borderMedium: '#2A3A3F',
    btnPrimary: '#2A6972',       // buttons keep deep teal (white text)
    btnPrimaryHover: '#35818C',
    btnSecondary: '#1C2A2E',
    btnSecondaryHover: '#233438',
    sophyAccent: '#D49489',      // brand coral on dark
    sophyLight: '#E6A497',
    // Sophy's field surfaces are WARM ink — cool tokens read teal in her block
    sophyFieldBg: '#1D1917',
    sophyFieldBorder: 'rgba(212, 148, 137, 0.32)',
    infoBg: 'rgba(95, 179, 191, 0.10)',
  },

  // ── READING: warm paper. LAW: opt-in ONLY, never a default. ──
  reading: {
    bgPrimary: '#F1EAD8',
    bgCard: '#FBF6EA',
    bgCardHover: '#F7F0E0',
    bgMuted: '#F1E9D6',
    bgOverlay: 'rgba(251, 246, 234, 0.92)',
    fontMain: '#2E2A22',
    fontSecondary: '#574F3E',
    fontMuted: '#83795F',
    brandPrimary: '#2A6972',
    brandSecondary: '#1E8A99',
    borderLight: '#E8DDC5',
    borderMedium: '#D6C8A8',
    btnPrimary: '#2A6972',
    btnPrimaryHover: '#1F565E',
    btnSecondary: '#EDE4CE',
    btnSecondaryHover: '#E5DABD',
    sophyAccent: '#C96F5E',
    sophyLight: '#D49489',
    infoBg: 'rgba(42, 105, 114, 0.06)',
  },
};
