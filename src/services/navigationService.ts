import {createNavigationContainerRef} from '@react-navigation/native';
import type {MainTabParamList, RootStackParamList, WriteParams} from '../navigation/types';

// Create a navigation reference that can be used outside of React components
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

// Calls made before the navigator mounts (a notification tap that launched the app)
// wait for it instead of being dropped. Gives up after ~10 seconds.
function whenReady(run: () => void, tries = 0) {
  if (navigationRef.isReady()) {
    run();
  } else if (tries < 100) {
    setTimeout(() => whenReady(run, tries + 1), 100);
  }
}

export function navigate(name: keyof RootStackParamList, params?: any) {
  whenReady(() => navigationRef.navigate(name as any, params));
}

export function navigateToTab(tab: keyof MainTabParamList) {
  whenReady(() => navigationRef.navigate('MainTabs', {screen: tab}));
}

export function navigateToWrite(params?: WriteParams) {
  whenReady(() => navigationRef.navigate('Write', params));
}

/** Kept for older callers. Entries is the new name for Past Entries. */
export function navigateToPastEntries() {
  navigateToTab('Entries');
}
