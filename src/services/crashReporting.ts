/**
 * crashReporting (v2.0, 2026-10-01): Firebase Crashlytics, so we can see crashes instead of
 * guessing at uninstalls. Crash data only: no journal text is ever logged here.
 * Loads the native module lazily and does nothing if it isn't in the build.
 */
let crashlytics: any = null;
try {
  crashlytics = require('@react-native-firebase/crashlytics').default;
} catch {
  crashlytics = null;
}

export function setCrashUser(uid: string | null) {
  try {
    if (crashlytics && uid) crashlytics().setUserId(uid);
  } catch {}
}

export function recordError(error: Error, componentStack?: string) {
  try {
    if (!crashlytics) return;
    if (componentStack) crashlytics().log(componentStack.slice(0, 900));
    crashlytics().recordError(error);
  } catch {}
}
