/**
 * Onboarding Hook - Progressive contextual onboarding for InkWell
 * 
 * Best practices applied:
 * - Progressive disclosure (show tips when user reaches each feature)
 * - Value-focused messaging (benefits, not feature lists)
 * - User control (can dismiss, tips don't block core functionality)
 * - Short content (under 60 seconds to core value)
 * - Contextual timing (delay tips, don't show immediately)
 */

import {useState, useEffect, useCallback} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';

// Storage keys
const ONBOARDING_SHOWN_KEY = '@inkwell_onboarding_shown';
const ONBOARDING_MILESTONES_KEY = '@inkwell_onboarding_milestones';

// Onboarding tip IDs
export type OnboardingTipId = 
  | 'journal_intro'
  | 'manifest_intro'
  | 'past_entries_intro'
  | 'sophy_intro'
  | 'voice_intro';

// Milestone tracking
export type OnboardingMilestone = 
  | 'first_entry'
  | 'first_voice'
  | 'first_wish'
  | 'first_sophy'
  | 'three_entries'
  | 'week_streak';

export interface OnboardingTip {
  id: OnboardingTipId;
  icon: string;
  title: string;
  message: string;
  actionLabel?: string;
}

// Tip content - short, benefit-focused messages
export const ONBOARDING_TIPS: Record<OnboardingTipId, OnboardingTip> = {
  journal_intro: {
    id: 'journal_intro',
    icon: '✍️',
    title: 'Your Space to Reflect',
    message: 'Just start writing—even one sentence counts. There\'s no right or wrong way to journal.',
    actionLabel: 'Start Writing',
  },
  manifest_intro: {
    id: 'manifest_intro',
    icon: '🎯',
    title: 'Turn Wishes Into Plans',
    message: 'The WISH framework turns vague goals into actionable plans using proven psychology.',
    actionLabel: 'Create My WISH',
  },
  past_entries_intro: {
    id: 'past_entries_intro',
    icon: '📅',
    title: 'Your Journey So Far',
    message: 'Tap any date to revisit that day\'s reflections. Watch your growth unfold over time.',
    actionLabel: 'Explore',
  },
  sophy_intro: {
    id: 'sophy_intro',
    icon: '💬',
    title: 'Meet Sophy, Your AI Guide',
    message: 'Stuck? Tap "Ask Sophy" for personalized prompts, insights, and gentle guidance.',
    actionLabel: 'Got it!',
  },
  voice_intro: {
    id: 'voice_intro',
    icon: '🎤',
    title: 'Speak Your Thoughts',
    message: 'Don\'t feel like typing? Tap the mic to speak freely—we\'ll transcribe it for you.',
    actionLabel: 'Got it!',
  },
};

interface UseOnboardingReturn {
  // Check if a tip should be shown
  shouldShowTip: (tipId: OnboardingTipId) => boolean;
  // Mark a tip as shown
  markTipShown: (tipId: OnboardingTipId) => Promise<void>;
  // Get tip content
  getTip: (tipId: OnboardingTipId) => OnboardingTip;
  // Track milestone completion
  markMilestone: (milestone: OnboardingMilestone) => Promise<void>;
  // Check if milestone is completed
  hasMilestone: (milestone: OnboardingMilestone) => boolean;
  // Reset all onboarding (for testing)
  resetOnboarding: () => Promise<void>;
  // Loading state
  isLoading: boolean;
}

export function useOnboarding(): UseOnboardingReturn {
  const [shownTips, setShownTips] = useState<Record<string, number>>({});
  const [milestones, setMilestones] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Get current user ID
  const userId = auth().currentUser?.uid;

  // Load onboarding state from AsyncStorage
  useEffect(() => {
    const loadState = async () => {
      if (!userId) {
        setIsLoading(false);
        return;
      }

      try {
        const [shownData, milestonesData] = await Promise.all([
          AsyncStorage.getItem(ONBOARDING_SHOWN_KEY),
          AsyncStorage.getItem(ONBOARDING_MILESTONES_KEY),
        ]);

        if (shownData) {
          const parsed = JSON.parse(shownData);
          setShownTips(parsed[userId] || {});
        }

        if (milestonesData) {
          const parsed = JSON.parse(milestonesData);
          setMilestones(parsed[userId] || {});
        }
      } catch (error) {
        console.error('Failed to load onboarding state:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadState();
  }, [userId]);

  // Check if a tip should be shown
  const shouldShowTip = useCallback(
    (tipId: OnboardingTipId): boolean => {
      if (!userId || isLoading) return false;
      return !shownTips[tipId];
    },
    [userId, shownTips, isLoading]
  );

  // Mark a tip as shown
  const markTipShown = useCallback(
    async (tipId: OnboardingTipId): Promise<void> => {
      if (!userId) return;

      try {
        const newShown = {...shownTips, [tipId]: Date.now()};
        setShownTips(newShown);

        const existingData = await AsyncStorage.getItem(ONBOARDING_SHOWN_KEY);
        const allData = existingData ? JSON.parse(existingData) : {};
        allData[userId] = newShown;
        await AsyncStorage.setItem(ONBOARDING_SHOWN_KEY, JSON.stringify(allData));

        console.log(`✨ Onboarding tip shown: ${tipId}`);
      } catch (error) {
        console.error('Failed to mark tip shown:', error);
      }
    },
    [userId, shownTips]
  );

  // Get tip content
  const getTip = useCallback((tipId: OnboardingTipId): OnboardingTip => {
    return ONBOARDING_TIPS[tipId];
  }, []);

  // Mark milestone completion
  const markMilestone = useCallback(
    async (milestone: OnboardingMilestone): Promise<void> => {
      if (!userId) return;
      if (milestones[milestone]) return; // Already completed

      try {
        const newMilestones = {...milestones, [milestone]: Date.now()};
        setMilestones(newMilestones);

        const existingData = await AsyncStorage.getItem(ONBOARDING_MILESTONES_KEY);
        const allData = existingData ? JSON.parse(existingData) : {};
        allData[userId] = newMilestones;
        await AsyncStorage.setItem(ONBOARDING_MILESTONES_KEY, JSON.stringify(allData));

        console.log(`🎯 Milestone completed: ${milestone}`);
      } catch (error) {
        console.error('Failed to mark milestone:', error);
      }
    },
    [userId, milestones]
  );

  // Check if milestone is completed
  const hasMilestone = useCallback(
    (milestone: OnboardingMilestone): boolean => {
      return !!milestones[milestone];
    },
    [milestones]
  );

  // Reset all onboarding (for testing)
  const resetOnboarding = useCallback(async (): Promise<void> => {
    if (!userId) return;

    try {
      // Clear user-specific data
      const [shownData, milestonesData] = await Promise.all([
        AsyncStorage.getItem(ONBOARDING_SHOWN_KEY),
        AsyncStorage.getItem(ONBOARDING_MILESTONES_KEY),
      ]);

      if (shownData) {
        const parsed = JSON.parse(shownData);
        delete parsed[userId];
        await AsyncStorage.setItem(ONBOARDING_SHOWN_KEY, JSON.stringify(parsed));
      }

      if (milestonesData) {
        const parsed = JSON.parse(milestonesData);
        delete parsed[userId];
        await AsyncStorage.setItem(ONBOARDING_MILESTONES_KEY, JSON.stringify(parsed));
      }

      setShownTips({});
      setMilestones({});
      console.log('🔄 Onboarding reset complete');
    } catch (error) {
      console.error('Failed to reset onboarding:', error);
    }
  }, [userId]);

  return {
    shouldShowTip,
    markTipShown,
    getTip,
    markMilestone,
    hasMilestone,
    resetOnboarding,
    isLoading,
  };
}
