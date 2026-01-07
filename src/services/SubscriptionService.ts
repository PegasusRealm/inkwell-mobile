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

// RevenueCat API Keys (from https://app.revenuecat.com)
// iOS Public Key - use for client-side iOS app
const REVENUECAT_API_KEY = 'appl_MgoxKdevXxWONmSBnChHrgObCqn';

// Offering identifiers (configured in RevenueCat dashboard)
export const OFFERING_IDS = {
  PLUS: 'default',  // Named "default" in RevenueCat, contains Plus packages
  CONNECT: 'connect',
} as const;

// Product identifiers for consumables
export const PRODUCT_IDS = {
  EXTRA_MESSAGE: 'com.inkwell.connect.extra_message',
  EXTRA_MESSAGE_3PACK: 'com.inkwell.connect.extra_message_3pack',
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
  private initialized = false;

  /**
   * Initialize RevenueCat SDK
   * Call this on app startup after user authentication
   */
  async initialize(userId: string): Promise<void> {
    if (this.initialized) {
      console.log('RevenueCat already initialized');
      return;
    }

    try {
      // Configure RevenueCat
      Purchases.setLogLevel(LOG_LEVEL.DEBUG); // Use VERBOSE for development
      await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
      
      // Set user ID for cross-platform subscription tracking
      await Purchases.logIn(userId);
      
      this.initialized = true;
      console.log('✅ RevenueCat initialized for user:', userId);
      
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
   * Get consumable products (extra messages)
   */
  async getExtraMessageProducts(): Promise<PurchasesStoreProduct[]> {
    try {
      const products = await Purchases.getProducts([
        PRODUCT_IDS.EXTRA_MESSAGE,
        PRODUCT_IDS.EXTRA_MESSAGE_3PACK,
      ]);
      
      console.log('📦 Extra message products:', products.length);
      return products;
      
    } catch (error) {
      console.error('❌ Failed to get extra message products:', error);
      return [];
    }
  }

  /**
   * Purchase a consumable product (extra message)
   */
  async purchaseConsumable(productId: string): Promise<CustomerInfo> {
    try {
      console.log('💳 Purchasing consumable:', productId);
      
      const products = await Purchases.getProducts([productId]);
      if (products.length === 0) {
        throw new Error('Product not found');
      }
      
      const { customerInfo } = await Purchases.purchaseStoreProduct(products[0]);
      
      console.log('✅ Consumable purchase successful!');
      
      // Track the purchase in Firestore (for message credits)
      await this.trackConsumablePurchase(productId);
      
      return customerInfo;
      
    } catch (error: any) {
      console.error('❌ Consumable purchase failed:', error);
      throw error;
    }
  }

  /**
   * Track consumable purchase and add credits
   */
  private async trackConsumablePurchase(productId: string): Promise<void> {
    const userId = auth().currentUser?.uid;
    if (!userId) return;

    const credits = productId === PRODUCT_IDS.EXTRA_MESSAGE_3PACK ? 3 : 1;
    
    await firestore().collection('users').doc(userId).update({
      extraMessageCredits: firestore.FieldValue.increment(credits),
      lastExtraPurchase: firestore.FieldValue.serverTimestamp(),
    });
    
    console.log(`✅ Added ${credits} extra message credit(s)`);
  }

  /**
   * Purchase a subscription package
   */
  async purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo> {
    try {
      console.log('💳 Purchasing package:', pkg.identifier);
      
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      
      console.log('✅ Purchase successful!');
      
      // Sync with Firestore
      await this.syncSubscriptionStatus(customerInfo);
      
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
   */
  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      return this.parseSubscriptionStatus(customerInfo);
      
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
   * Sync subscription status with Firestore
   * This keeps the backend in sync with IAP subscriptions
   */
  async syncSubscriptionStatus(customerInfo?: CustomerInfo): Promise<void> {
    try {
      const userId = auth().currentUser?.uid;
      if (!userId) {
        console.warn('⚠️ No authenticated user to sync subscription');
        return;
      }

      // Get customer info if not provided
      const info = customerInfo || await Purchases.getCustomerInfo();
      const status = this.parseSubscriptionStatus(info);
      
      // Update Firestore user document
      await firestore().collection('users').doc(userId).update({
        subscriptionTier: status.tier,
        subscriptionStatus: status.isActive ? 'active' : 'inactive',
        subscriptionPlatform: status.platform || 'unknown',
        subscriptionExpiresAt: status.expirationDate ? firestore.Timestamp.fromDate(status.expirationDate) : null,
        subscriptionWillRenew: status.willRenew,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
      
      console.log('✅ Synced subscription to Firestore:', status.tier);
      
    } catch (error) {
      console.error('❌ Failed to sync subscription status:', error);
    }
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
  async logout(): Promise<void> {
    try {
      await Purchases.logOut();
      this.initialized = false;
      console.log('✅ Logged out from RevenueCat');
    } catch (error) {
      console.error('❌ Failed to logout from RevenueCat:', error);
    }
  }
}

// Export singleton instance
export default new SubscriptionService();
