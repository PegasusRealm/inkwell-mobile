/**
 * useSubscription Hook
 * Easy access to subscription status throughout the app
 * 
 * FIXED: 2026-01-06 - Removed recursive initialization loop
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import SubscriptionService, {
  SubscriptionStatus,
  SubscriptionTier,
} from '../services/SubscriptionService';
import auth from '@react-native-firebase/auth';

export const useSubscription = () => {
  const [status, setStatus] = useState<SubscriptionStatus>({
    tier: 'free',
    isActive: false,
    willRenew: false,
  });
  const [loading, setLoading] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  
  // Use refs to prevent re-initialization and infinite loops
  const initializedRef = useRef(false);
  const initializingRef = useRef(false);

  // Initialize RevenueCat - called once
  const ensureInitialized = useCallback(async (): Promise<boolean> => {
    // Already initialized
    if (initializedRef.current) {
      return true;
    }
    
    // Already in progress
    if (initializingRef.current) {
      console.log('🔄 useSubscription: init already in progress');
      return false;
    }
    
    const user = auth().currentUser;
    if (!user) {
      console.warn('Cannot initialize RevenueCat: no user authenticated');
      return false;
    }

    initializingRef.current = true;
    console.log('🔵 useSubscription: Starting initialization...');

    try {
      setLoading(true);
      await SubscriptionService.initialize(user.uid);
      initializedRef.current = true;
      console.log('✅ useSubscription: Initialized successfully');
      
      // Fetch initial status (don't call ensureInitialized again!)
      const currentStatus = await SubscriptionService.getSubscriptionStatus();
      setStatus(currentStatus);
      
      return true;
    } catch (error) {
      console.error('Failed to initialize subscription:', error);
      setStatus({
        tier: 'free',
        isActive: false,
        willRenew: false,
      });
      return false;
    } finally {
      setLoading(false);
      initializingRef.current = false;
    }
  }, []);

  // Refresh status - assumes already initialized
  const refreshStatus = useCallback(async () => {
    // Only refresh if already initialized
    if (!initializedRef.current) {
      console.log('⏸️ useSubscription: Skipping refresh, not initialized');
      return;
    }
    
    try {
      const currentStatus = await SubscriptionService.getSubscriptionStatus();
      setStatus(currentStatus);
    } catch (error) {
      console.error('Failed to refresh subscription status:', error);
    }
  }, []);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && initializedRef.current) {
        await refreshStatus();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [refreshStatus]);

  const hasFeatureAccess = useCallback(async (
    feature: 'sms' | 'ai' | 'practitioner' | 'export' | 'fileUpload'
  ): Promise<boolean> => {
    await ensureInitialized();
    return await SubscriptionService.hasFeatureAccess(feature);
  }, [ensureInitialized]);

  const checkFeatureAndShowPaywall = useCallback(async (
    feature: 'sms' | 'ai' | 'practitioner' | 'export' | 'fileUpload'
  ): Promise<boolean> => {
    const hasAccess = await hasFeatureAccess(feature);
    if (!hasAccess) {
      setShowPaywall(true);
    }
    return hasAccess;
  }, [hasFeatureAccess]);

  const isPremium = (): boolean => {
    return status.tier === 'plus' || status.tier === 'connect';
  };

  const isConnect = (): boolean => {
    return status.tier === 'connect';
  };

  const openPaywall = useCallback(async () => {
    // Don't need to initialize here - PaywallModal handles its own init
    setShowPaywall(true);
  }, []);

  const closePaywall = useCallback(() => {
    setShowPaywall(false);
  }, []);

  return {
    // Status
    tier: status.tier,
    isActive: status.isActive,
    isPremium: isPremium(),
    isConnect: isConnect(),
    expirationDate: status.expirationDate,
    willRenew: status.willRenew,
    loading,
    
    // Actions
    refreshStatus,
    hasFeatureAccess,
    checkFeatureAndShowPaywall,
    ensureInitialized,
    
    // Paywall
    showPaywall,
    openPaywall,
    closePaywall,
    setShowPaywall,
  };
};