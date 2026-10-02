/**
 * userDates (v2.0, 2026-10-01): a few dates on the person's own user record so we can
 * tell whether 2.0 helps people stay. DATES ONLY. Never journal content, never titles,
 * never tags. Stored under users/{uid}.activity. Every write is best-effort and silent.
 */
import {Platform} from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {APP_VERSION, BUILD_NUMBER} from '../version';

const userRef = () => {
  const uid = auth().currentUser?.uid;
  return uid ? firestore().collection('users').doc(uid) : null;
};

async function stamp(fields: Record<string, unknown>) {
  const ref = userRef();
  if (!ref) return;
  try {
    const activity: Record<string, unknown> = {};
    Object.entries(fields).forEach(([k, v]) => (activity[k] = v));
    await ref.set({activity}, {merge: true});
  } catch (e) {
    console.warn('activity stamp skipped:', e);
  }
}

/** Once per launch. */
export function markAppOpen() {
  return stamp({
    lastOpenAt: firestore.FieldValue.serverTimestamp(),
    appVersion: `${APP_VERSION} (${BUILD_NUMBER})`,
    platform: Platform.OS,
  });
}

/** The first time this person keeps an entry on this install of 2.0 (kept only if missing). */
export async function markFirstEntry() {
  const uid = auth().currentUser?.uid;
  if (!uid) return;
  const key = `iw_first_entry_marked_${uid}`;
  try {
    if (await AsyncStorage.getItem(key)) return;
    const ref = userRef();
    if (!ref) return;
    const snap = await ref.get();
    if (!snap.data()?.activity?.firstEntryAt) {
      await stamp({firstEntryAt: firestore.FieldValue.serverTimestamp()});
    }
    await AsyncStorage.setItem(key, '1');
  } catch (e) {
    console.warn('first entry stamp skipped:', e);
  }
}

export function markPlusPreviewViewed() {
  return stamp({plusPreviewViewedAt: firestore.FieldValue.serverTimestamp()});
}

export function markTrialStarted() {
  return stamp({trialStartedAt: firestore.FieldValue.serverTimestamp()});
}
