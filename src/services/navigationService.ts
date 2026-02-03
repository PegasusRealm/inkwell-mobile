import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/types';

// Create a navigation reference that can be used outside of React components
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

// Navigate to a screen
export function navigate(name: keyof RootStackParamList, params?: any) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name as any, params);
  } else {
    // If navigation is not ready, wait and try again
    setTimeout(() => navigate(name, params), 100);
  }
}

// Navigate to PastEntries tab (for coach replies)
export function navigateToPastEntries() {
  if (navigationRef.isReady()) {
    navigationRef.navigate('MainTabs', { screen: 'PastEntries' });
  }
}
