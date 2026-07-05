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
export const APP_VERSION = '26.185.1';

export const BUILD_NUMBER = Platform.select({
  ios: '81',
  android: '84',
  default: '0',
});
