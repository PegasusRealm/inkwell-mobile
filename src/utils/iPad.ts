/**
 * iPad Compatibility Utilities
 * 
 * Provides helpers for responsive layouts that work across iPhone and iPad.
 * Created 2026-02-21: Fix Apple rejection for non-functional iPad buttons.
 * Updated 2026-02-21: Fix keyboard blocking content on iPad.
 *
 * Key principles:
 * - Content should be constrained to a readable width on large screens
 * - Touch targets must be at least 44x44pt (Apple HIG)
 * - ActionSheets must use Alert fallback on iPad (no anchor required)
 * - Dimensions should be dynamic, not static (iPad multitasking)
 * - Keyboard must not block input fields
 */

import { Platform, Alert, ActionSheetIOS } from 'react-native';

/**
 * Check if the current device is an iPad
 */
export const isIPad = (): boolean => {
  if (Platform.OS !== 'ios') return false;
  // Platform.isPad is the reliable check for iPad
  return (Platform as any).isPad === true;
};

/**
 * Get the maximum content width for the current device.
 * On iPhone: returns undefined (full width)
 * On iPad: returns a comfortable reading width based on screen size
 */
export const getContentMaxWidth = (screenWidth: number): number | undefined => {
  // Constrain on tablets — iPad via Platform.isPad, Android tablets via width
  // (2026-07-04: Android tablets previously got phone-stretched full width).
  // Phones always use full width.
  const isTablet = isIPad() || (Platform.OS === 'android' && screenWidth >= 768);
  if (!isTablet) return undefined;

  if (screenWidth >= 1024) {
    // Large iPad (12.9") or landscape - allow wider content
    return Math.min(700, screenWidth - 80);
  } else if (screenWidth >= 768) {
    // Standard iPad or split view
    return Math.min(600, screenWidth - 48);
  }
  // Small iPad split view - no constraint
  return undefined;
};

/**
 * Get container style for centering content on iPad.
 * Returns an object suitable for spreading into a View's style prop.
 * 
 * Usage:
 *   <View style={[styles.content, iPadContentStyle(width)]}>
 */
export const iPadContentStyle = (screenWidth: number) => {
  const maxWidth = getContentMaxWidth(screenWidth);
  if (!maxWidth) return {};
  return {
    maxWidth,
    alignSelf: 'center' as const,
    width: '100%' as const,
  };
};

/**
 * Get keyboard vertical offset for KeyboardAvoidingView.
 * iPad needs a larger offset due to the larger keyboard and navigation elements.
 */
export const getKeyboardVerticalOffset = (hasHeader: boolean = true): number => {
  if (isIPad()) {
    // iPad: larger offset for bigger keyboard + status bar + header
    return hasHeader ? 100 : 50;
  }
  // iPhone: standard offset
  return hasHeader ? 88 : 44;
};

/**
 * Minimum touch target size per Apple HIG (44x44 pt).
 * Use this to ensure buttons/controls meet accessibility requirements.
 */
export const MIN_TOUCH_TARGET = 44;

/**
 * Show a platform-safe action sheet.
 * On iPhone: uses native ActionSheetIOS
 * On iPad: uses Alert (which works without an anchor view)
 * On Android: uses Alert
 * 
 * This fixes the iPad crash where ActionSheetIOS requires an anchor/sourceRect.
 */
export const showActionSheet = (
  title: string,
  options: string[],
  cancelIndex: number,
  onSelect: (index: number) => void,
  destructiveIndex?: number,
) => {
  if (Platform.OS === 'ios' && !isIPad()) {
    // iPhone — use native ActionSheet
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: cancelIndex,
        destructiveButtonIndex: destructiveIndex,
      },
      (buttonIndex) => {
        onSelect(buttonIndex);
      },
    );
  } else {
    // iPad & Android — use Alert buttons (always works without anchor)
    const alertButtons = options
      .map((option, index) => {
        if (index === cancelIndex) {
          return { text: option, style: 'cancel' as const, onPress: () => onSelect(index) };
        }
        if (index === destructiveIndex) {
          return { text: option, style: 'destructive' as const, onPress: () => onSelect(index) };
        }
        return { text: option, onPress: () => onSelect(index) };
      });
    
    Alert.alert(title, undefined, alertButtons);
  }
};
