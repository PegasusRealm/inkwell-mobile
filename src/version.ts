/**
 * App version — SINGLE source of truth for the JS layer (M3 sync, 2026-07-04).
 *
 * Scheme (Adam): YY.DDD.build — DDD = day of year of the release cut.
 * RULE: the user-facing version string syncs across iOS / Android / web at
 * each coordinated release cut (one date code = one feature state). Platform
 * BUILD numbers stay independent (store requirement + per-platform trace);
 * a platform-only hotfix bumps its build number, never the version string.
 *
 * Native truth to keep in step at each cut:
 *   android/app/build.gradle       -> versionName + versionCode
 *   ios/InkWellMobile/Info.plist   -> CFBundleShortVersionString + CFBundleVersion
 */
import {Platform} from 'react-native';

// v2 release cut — day 185 of 2026 (2026-07-04), matches web v26.185.1
// 26.185.2 (2026-10-01): log-in security/billing hotfix, no feature change. The App Store needs a
// new version string for a released version, so the hotfix bumps the third segment.
// 26.274.1 (2026-10-01): Castalia (formerly InkWell) 2.0 phone app (Today / Entries / Goals / You, full-screen Write,
// Kept, heaviness ratings, Plus preview). Phone-only cut; web stays at its own version.
// Builds 84/88: the Castalia rename and new icon (83/87 may already be on TestFlight or Play internal).
// 26.274.2, builds 85/89 (2026-10-01): options pass (Adam): three ways in, the timer on the page, three
// gratitude practices, one-start goals, rename card. New feature state, so a new version string.
// iOS build 86 (2026-10-03): build 85 opened to the error screen on every iPhone. Info.plist had no
// RCTNewArchEnabled key, so RN 0.81 turned the New Architecture on at launch while every native module
// was compiled for the old one (Podfile RCT_NEW_ARCH_ENABLED=0). EAS works under a build/ path that
// pod install skips when it writes that key, so the key is now set to false in the repo. Android unaffected.
export const APP_VERSION = '26.274.2';

export const BUILD_NUMBER = Platform.select({
  ios: '86',
  android: '89',
  default: '0',
});
