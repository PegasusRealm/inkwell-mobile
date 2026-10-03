/**
 * InkWell Subscription Service
 * Handles RevenueCat integration for iOS/Android IAP
 * 
 * Updated 2026-01-06: Multi-tier offerings (Plus, Connect) + consumables
 */

import Purchases, {
  LOG_LEVEL,
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
  PurchasesOfferings,
  PurchasesStoreProduct,
} from 'react-native-purchases';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { Platform } from 'react-native';

// RevenueCat PUBLIC SDK keys (from https://app.revenuecat.com). Public by design: they ship
// inside the app binary. v2.0 (2026-10-01): Android had no key, so Android could not buy Plus.
const REVENUECAT_API_KEY = Platform.select({
  ios: 'appl_MgoxKdevXxWONmSBnChHrgObCqn',
  android: 'goog_yCobCFmvQHElcFiWRSGAUSHTNma',
  default: 'appl_MgoxKdevXxWONmSBnChHrgObCqn',
}) as string;

// Offering identifiers (configured in RevenueCat dashboard)
export const OFFERING_IDS = {
  PLUS: 'default',  // Named "default" in RevenueCat, contains Plus packages
  CONNECT: 'connect',
} as const;

export type SubscriptionTier = 'free' | 'plus' | 'connect';

export interface SubscriptionStatus {
  tier: SubscriptionTier;
  isActive: boolean;
  expirationDate?: Date;
  willRenew: boolean;
  platform?: 'ios' | 'android' | 'stripe';
}

export interface AllOfferings {
  plus: PurchasesOffering | null;
  connect: PurchasesOffering | null;
}

class SubscriptionService {
  private configured = false;
  // The InkWell account RevenueCat is signed in as. v2.0: before, a second account on the
  // same phone kept the first account's RevenueCat identity (purchases landed on the wrong user).
  private userId: string | null = null;
  // initialize and logout run one after another, never interleaved (a quick sign-out then
  // sign-in must not leave RevenueCat anonymous, and two screens must not configure twice).
  private queue: Promise<unknown> = Promise.resolve();
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => undefined);
    return run;
  }

  /**
   * Initialize RevenueCat for this signed-in user.
   * Configures the SDK once per app run, then logs in (or switches) to this user.
   */
  initialize(userId: string): Promise<void> {
    return this.serial(() => this.initializeNow(userId));
  }

  private async initializeNow(userId: string): Promise<void> {
    if (this.configured && this.userId === userId) {
      return;
    }

    try {
      if (!this.configured) {
        Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
        await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
        this.configured = true;
      }

      // Set user ID for cross-platform subscription tracking (also switches accounts)
      await Purchases.logIn(userId);
      this.userId = userId;
      console.log('✅ RevenueCat ready for user:', userId);
      
      // Sync initial subscription status with Firestore
      await this.syncSubscriptionStatus();
      
    } catch (error) {
      console.error('❌ Failed to initialize RevenueCat:', error);
      throw error;
    }
  }

  /**
   * Get available subscription offerings
   * Returns the current/default offering
   */
  async getOfferings(): Promise<PurchasesOffering | null> {
    try {
      const offerings = await Purchases.getOfferings();
      
      if (offerings.current) {
        console.log('📦 Current offering:', offerings.current.identifier);
        console.log('📦 Available packages:', offerings.current.availablePackages.length);
        return offerings.current;
      }
      
      console.warn('⚠️ No offerings configured in RevenueCat');
      return null;
      
    } catch (error) {
      console.error('❌ Failed to get offerings:', error);
      return null;
    }
  }

  /**
   * Get all offerings (Plus and Connect separately)
   * Use this for the tiered paywall display
   */
  async getAllOfferings(): Promise<AllOfferings> {
    try {
      const offerings = await Purchases.getOfferings();
      
      const result: AllOfferings = {
        plus: offerings.all[OFFERING_IDS.PLUS] || null,
        connect: offerings.all[OFFERING_IDS.CONNECT] || null,
      };
      
      console.log('📦 Plus offering:', result.plus?.availablePackages.length || 0, 'packages');
      console.log('📦 Connect offering:', result.connect?.availablePackages.length || 0, 'packages');
      
      // Fallback: if no separate offerings, try to parse from current
      if (!result.plus && !result.connect && offerings.current) {
        console.log('⚠️ Using fallback: parsing current offering');
        // This handles the case where offerings aren't split yet
        result.plus = offerings.current;
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ Failed to get all offerings:', error);
      return { plus: null, connect: null };
    }
  }

  /**
   * Purchase a subscription package
   */
  async purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo> {
    try {
      console.log('💳 Purchasing package:', pkg.identifier);
      
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      
      console.log('✅ Purchase successful!');
      
      // Sync with Firestore. A failed sync must not report a completed purchase as failed;
      // the next app open syncs again.
      try {
        await this.syncSubscriptionStatus(customerInfo);
      } catch (syncError) {
        console.warn('Purchase done, Firestore sync will retry:', syncError);
      }
      
      return customerInfo;
      
    } catch (error: any) {
      console.error('❌ Purchase failed:', error);
      
      // Handle specific error cases
      if (error.code === 'PURCHASE_CANCELLED') {
        console.log('User cancelled purchase');
      } else if (error.code === 'PRODUCT_ALREADY_PURCHASED') {
        console.log('User already owns this product');
      }
      
      throw error;
    }
  }

  /**
   * Restore previous purchases
   */
  async restorePurchases(): Promise<CustomerInfo> {
    try {
      console.log('🔄 Restoring purchases...');
      
      const customerInfo = await Purchases.restorePurchases();
      
      console.log('✅ Purchases restored');
      
      // Sync with Firestore
      await this.syncSubscriptionStatus(customerInfo);
      
      return customerInfo;
      
    } catch (error) {
      console.error('❌ Failed to restore purchases:', error);
      throw error;
    }
  }

  /**
   * Get current subscription status
   * PRIORITY ORDER:
   * 1. Firestore admin override / beta tier (trust backend)
   * 2. RevenueCat (paying customers)
   * 3. Free tier
   */
  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    try {
      const userId = auth().currentUser?.uid;
      
      // FIRST: Check Firestore for admin override or backend-set tier
      // This takes priority because admin/beta overrides should work without RevenueCat
      if (userId) {
        try {
          const userDoc = await firestore().collection('users').doc(userId).get();
          const userData = userDoc.data();
          
          if (userData) {
            const adminOverrideTier = userData.betaProgress?.tierOverride?.tier;
            const firestoreTier = userData.subscriptionTier;
            const specialCode = userData.special_code;
            const freeTrialEnds = userData.freeTrialEnds;
            const isBetaTester = ['alpha', 'beta'].includes(specialCode);
            
            // Check for admin override tier (highest priority)
            if (adminOverrideTier && ['plus', 'connect'].includes(adminOverrideTier)) {
              console.log('🔓 Using admin override tier:', adminOverrideTier);
              return {
                tier: adminOverrideTier as SubscriptionTier,
                isActive: true,
                willRenew: false,
                platform: 'stripe',
              };
            }
            
            // Check Firestore subscriptionTier directly (beta users, admin-set)
            // FIXED: Trust the tier if set, don't require subscriptionStatus
            if (firestoreTier && ['plus', 'connect'].includes(firestoreTier)) {
              console.log('🔓 Using Firestore tier:', firestoreTier);
              return {
                tier: firestoreTier as SubscriptionTier,
                isActive: true, // If tier is set, it's active
                willRenew: userData.subscriptionWillRenew || false,
                platform: userData.subscriptionPlatform || 'stripe',
              };
            }
            
            // Check for alpha/beta tester free trial period
            // Alpha: 6 months free, Beta: 3 months free
            if (isBetaTester && freeTrialEnds) {
              const trialEndDate = freeTrialEnds.toDate ? freeTrialEnds.toDate() : new Date(freeTrialEnds);
              const now = new Date();
              
              if (now < trialEndDate) {
                console.log('🔓 Alpha/Beta free trial active until:', trialEndDate.toISOString());
                return {
                  tier: 'plus',
                  isActive: true,
                  willRenew: false,
                  platform: 'stripe',
                  // Build-83 rot fix 2026-07-04: was `expiresAt` (typo, not in
                  // the SubscriptionStatus interface, nothing consumed it)
                  expirationDate: trialEndDate,
                };
              } else {
                console.log('⏰ Alpha/Beta free trial expired:', trialEndDate.toISOString());
                // Trial expired - they need to subscribe at discounted rate
              }
            }
            
            // Legacy: Check for beta tester status without freeTrialEnds (grants Plus)
            // This supports existing testers until we migrate them
            if (isBetaTester && !freeTrialEnds) {
              console.log('🔓 Legacy beta tester detected, granting Plus access');
              return {
                tier: 'plus',
                isActive: true,
                willRenew: false,
                platform: 'stripe',
              };
            }
          }
        } catch (firestoreError) {
          console.warn('⚠️ Could not check Firestore for tier override:', firestoreError);
        }
      }
      
      // SECOND: Check RevenueCat (actual paying customers)
      try {
        const customerInfo = await Purchases.getCustomerInfo();
        const rcStatus = this.parseSubscriptionStatus(customerInfo);
        
        if (rcStatus.tier !== 'free') {
          console.log('💳 Using RevenueCat tier:', rcStatus.tier);
          return rcStatus;
        }
      } catch (rcError) {
        console.warn('⚠️ RevenueCat check failed:', rcError);
      }
      
      // Default to free tier
      console.log('📱 Defaulting to free tier');
      return {
        tier: 'free',
        isActive: true,
        willRenew: false,
      };
      
    } catch (error) {
      console.error('❌ Failed to get subscription status:', error);
      return {
        tier: 'free',
        isActive: false,
        willRenew: false,
      };
    }
  }

  /**
   * Parse RevenueCat customer info into our subscription status
   */
  private parseSubscriptionStatus(customerInfo: CustomerInfo): SubscriptionStatus {
    const entitlements = customerInfo.entitlements.active;
    
    // Check for Connect tier (highest)
    if (entitlements['connect']) {
      const entitlement = entitlements['connect'];
      return {
        tier: 'connect',
        isActive: true,
        expirationDate: entitlement.expirationDate ? new Date(entitlement.expirationDate) : undefined,
        willRenew: entitlement.willRenew,
        platform: entitlement.store === 'APP_STORE' ? 'ios' : 'android',
      };
    }
    
    // Check for Plus tier
    if (entitlements['plus']) {
      const entitlement = entitlements['plus'];
      return {
        tier: 'plus',
        isActive: true,
        expirationDate: entitlement.expirationDate ? new Date(entitlement.expirationDate) : undefined,
        willRenew: entitlement.willRenew,
        platform: entitlement.store === 'APP_STORE' ? 'ios' : 'android',
      };
    }
    
    // Default to free tier
    return {
      tier: 'free',
      isActive: true,
      willRenew: false,
    };
  }

  /**
   * No longer writes anything. Kept so existing callers stay unchanged.
   */
  async syncSubscriptionStatus(_customerInfo?: CustomerInfo): Promise<void> {
    // 2026-10-03: the server owns the tier now. RevenueCat reports every purchase,
    // renewal and expiry to our server (revenuecatWebhook), and the Firestore rules
    // refuse a paid tier written from the phone. Writing it here also stepped web
    // (Stripe) subscribers down to free whenever they opened the app.
  }

  /**
   * Check if user has access to a specific feature
   */
  async hasFeatureAccess(feature: 'sms' | 'ai' | 'practitioner' | 'export' | 'fileUpload'): Promise<boolean> {
    const status = await this.getSubscriptionStatus();
    
    switch (feature) {
      case 'sms':
        return status.tier === 'plus' || status.tier === 'connect';
      case 'ai':
        return status.tier === 'plus' || status.tier === 'connect';
      case 'practitioner':
        return status.tier === 'connect';
      case 'export':
        return status.tier === 'plus' || status.tier === 'connect';
      case 'fileUpload':
        return status.tier === 'plus' || status.tier === 'connect';
      default:
        return false;
    }
  }

  /**
   * Logout user from RevenueCat
   */
  logout(): Promise<void> {
    return this.serial(() => this.logoutNow());
  }

  private async logoutNow(): Promise<void> {
    try {
      if (this.userId) await Purchases.logOut();
      this.userId = null;
      console.log('✅ Logged out from RevenueCat');
    } catch (error) {
      console.error('❌ Failed to logout from RevenueCat:', error);
    }
  }
}

// Export singleton instance
export default new SubscriptionService();
