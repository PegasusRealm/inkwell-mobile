/**
 * useSubscription Hook
 * Easy access to subscription status throughout the app.
 *
 * v2.0 (2026-10-01): status is SHARED. Before, every screen kept its own copy, so a
 * purchase on one tab didn't show on another until the app came back to the
 * foreground. Now one store holds the status and every hook listens to it.
 * The paywall open/close state stays per screen (each screen mounts its own modal).
 */

import {useState, useEffect, useCallback} from 'react';
import {AppState, AppStateStatus} from 'react-native';
import SubscriptionService, {SubscriptionStatus} from '../services/SubscriptionService';
import auth from '@react-native-firebase/auth';

type Feature = 'sms' | 'ai' | 'practitioner' | 'export' | 'fileUpload';

const FREE: SubscriptionStatus = {tier: 'free', isActive: false, willRenew: false};

// ─── the shared store ───
let shared: SubscriptionStatus = FREE;
let loading = true;
let initializedFor: string | null = null; // uid RevenueCat was set up for
let initPromise: Promise<boolean> | null = null;
const listeners = new Set<() => void>();
const publish = () => listeners.forEach(l => l());

async function ensureInitializedShared(): Promise<boolean> {
  const user = auth().currentUser;
  if (!user) {
    loading = false;
    publish();
    return false;
  }
  if (initializedFor === user.uid) return true;
  if (initPromise) return initPromise;
  // A different account than last time: nothing of the old account's status carries over
  if (initializedFor !== null) {
    initializedFor = null;
    shared = FREE;
  }
  initPromise = (async () => {
    try {
      loading = true;
      publish();
      await SubscriptionService.initialize(user.uid);
      initializedFor = user.uid;
      shared = await SubscriptionService.getSubscriptionStatus();
      return true;
    } catch (error) {
      console.error('Failed to initialize subscription:', error);
      shared = FREE;
      return false;
    } finally {
      loading = false;
      initPromise = null;
      publish();
    }
  })();
  return initPromise;
}

/** On sign-out: drop the status and sign RevenueCat out, so the next account starts clean. */
export async function resetSubscriptionOnSignOut(): Promise<void> {
  initializedFor = null;
  shared = FREE;
  loading = false;
  publish();
  await SubscriptionService.logout();
}

/** Re-read the status (after a purchase, restore, or return to the app). */
export async function refreshSubscriptionStatus(): Promise<void> {
  const ok = await ensureInitializedShared();
  if (!ok) return;
  try {
    shared = await SubscriptionService.getSubscriptionStatus();
    publish();
  } catch (error) {
    console.error('Failed to refresh subscription status:', error);
  }
}

// One app-state listener for the whole app, not one per screen.
let appStateHooked = false;
function hookAppState() {
  if (appStateHooked) return;
  appStateHooked = true;
  AppState.addEventListener('change', (next: AppStateStatus) => {
    if (next === 'active' && initializedFor) refreshSubscriptionStatus();
  });
}

export const useSubscription = () => {
  const [, force] = useState(0);
  const [showPaywall, setShowPaywall] = useState(false);

  useEffect(() => {
    const l = () => force(n => n + 1);
    listeners.add(l);
    hookAppState();
    ensureInitializedShared();
    return () => {
      listeners.delete(l);
    };
  }, []);

  const ensureInitialized = useCallback(() => ensureInitializedShared(), []);
  const refreshStatus = useCallback(() => refreshSubscriptionStatus(), []);

  const hasFeatureAccess = useCallback(async (feature: Feature): Promise<boolean> => {
    await ensureInitializedShared();
    return await SubscriptionService.hasFeatureAccess(feature);
  }, []);

  const checkFeatureAndShowPaywall = useCallback(
    async (feature: Feature): Promise<boolean> => {
      const hasAccess = await hasFeatureAccess(feature);
      if (!hasAccess) setShowPaywall(true);
      return hasAccess;
    },
    [hasFeatureAccess],
  );

  const openPaywall = useCallback(() => setShowPaywall(true), []);
  const closePaywall = useCallback(() => setShowPaywall(false), []);

  const status = shared;
  return {
    // Status
    tier: status.tier,
    isActive: status.isActive,
    isPremium: status.tier === 'plus' || status.tier === 'connect',
    isConnect: status.tier === 'connect',
    expirationDate: status.expirationDate,
    willRenew: status.willRenew,
    loading,

    // Actions
    refreshStatus,
    hasFeatureAccess,
    checkFeatureAndShowPaywall,
    ensureInitialized,

    // Paywall (per screen)
    showPaywall,
    openPaywall,
    closePaywall,
    setShowPaywall,
  };
};
