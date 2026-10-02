// Navigation type definitions for type-safe navigation
// v2.0 (2026-10-01): four tabs (Today, Entries, Goals, You). Write is a full-screen
// takeover with no tabs; Kept is the sheet that follows a save.

import type {CompositeScreenProps, NavigatorScreenParams} from '@react-navigation/native';
import type {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import type {StackScreenProps} from '@react-navigation/stack';

/** The ways in. Every one of them opens inside Write. */
export type WriteMode = 'free' | 'sprint' | 'gratitude' | 'reframe' | 'inkblot';
export type GratPractice = 'three' | 'deep' | 'subtraction' | 'letter' | 'savor';

export type WriteParams = {
  mode?: WriteMode;
  gratPractice?: GratPractice;
  /** A Sophy prompt chosen on Today, shown above the page and saved as promptUsed. */
  prompt?: string;
  /** Start listening as soon as Write opens (Today's "Speak it"). */
  startVoice?: boolean;
};

export type KeptParams = {
  entryId: string;
  /** What was written, for Sophy's reflection. Never stored here. */
  text: string;
  mode: WriteMode;
  words: number;
  minutes: number;
  /** True when the person answered "how heavy" before writing. */
  hadFeelBefore: boolean;
  /** The very first entry this person keeps (FirstSteps). */
  firstSave?: boolean;
};

// Root stack (MainTabs accepts nested tab params so services can deep-navigate)
export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Write: WriteParams | undefined;
  Kept: KeptParams;
  Info: undefined;
};

// Bottom tabs
export type MainTabParamList = {
  Today: undefined;
  /** jumpTo: 'YYYY-MM-DD', opens that day (Today's memory card). */
  Entries: {jumpTo?: string} | undefined;
  Goals: undefined;
  You: undefined;
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
