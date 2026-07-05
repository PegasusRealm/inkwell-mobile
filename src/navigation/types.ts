// Navigation type definitions for type-safe navigation

import type {CompositeScreenProps, NavigatorScreenParams} from '@react-navigation/native';
import type {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import type {StackScreenProps} from '@react-navigation/stack';

// Root Stack Navigator params
// (MainTabs accepts nested tab params so services can deep-navigate to a tab —
//  Build-83 rot fix 2026-07-04, was `undefined` which broke navigationService)
export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Settings: undefined;
  Info: undefined;
};

// Bottom Tab Navigator params
export type MainTabParamList = {
  Journal: undefined;
  Manifest: undefined;
  PastEntries: undefined;
};

// Combined navigation props for screens in the bottom tabs
export type TabScreenProps<T extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, T>,
  StackScreenProps<RootStackParamList>
>;

// Navigation props for stack screens
export type RootStackScreenProps<T extends keyof RootStackParamList> =
  StackScreenProps<RootStackParamList, T>;

// Declare global navigation types for TypeScript
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
