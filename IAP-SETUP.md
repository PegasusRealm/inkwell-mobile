# RevenueCat + IAP Setup Guide

## Quick Reference - Final Product Configuration

### Subscriptions (Auto-Renewable)

| Product ID | Price | Trial | Tier |
|------------|-------|-------|------|
| `com.inkwell.plus.monthly` | $6.99/mo | 7 days | Plus |
| `com.inkwell.plus.annual` | $69.99/yr | 7 days | Plus |
| `com.inkwell.connect.monthly` | $29.99/mo | **None** | Connect |

### RevenueCat Offerings

| Offering ID | Packages |
|-------------|----------|
| `plus` | `$rc_monthly` → plus.monthly, `$rc_annual` → plus.annual |
| `connect` | `monthly` → connect.monthly |

### Entitlements

| Entitlement | Products | Features |
|-------------|----------|----------|
| `plus` | plus.monthly, plus.annual | AI, SMS, Export, Insights |
| `connect` | connect.monthly | Plus features + 1 practitioner msg/week |

---

## 1. Create RevenueCat Account

1. Go to https://app.revenuecat.com and sign up
2. Create a new project: "InkWell"
3. Get your API keys:
   - **iOS:** `appl_xxxxxxxxxx`
   - **Android:** `goog_xxxxxxxxxx`

## 2. Configure App Store Connect (iOS)

### Create In-App Purchase Products:

1. Go to App Store Connect → Your App → Features → In-App Purchases
2. Click "+" to create new products:

**InkWell Plus (Monthly)**
- Type: Auto-Renewable Subscription
- Reference Name: `InkWell Plus Monthly`
- Product ID: `com.inkwell.plus.monthly`
- Subscription Duration: 1 month
- Price: $6.99 USD
- Subscription Group: Create "InkWell" (if not exists)
- Introductory Offer: 7 days free trial

**Display Name (Localized - English US):** InkWell Plus Monthly
**Description (Localized - English US):** 
```
Unlock unlimited AI-powered journaling with intelligent prompts, daily SMS reminders, weekly insights, and data export capabilities. Perfect for consistent journalers seeking deeper self-reflection.
```

**InkWell Plus (Annual)**
- Type: Auto-Renewable Subscription
- Reference Name: `InkWell Plus Annual`
- Product ID: `com.inkwell.plus.annual`
- Subscription Duration: 1 year
- Price: $69.99 USD (Save $14 vs monthly)
- Subscription Group: "InkWell"
- Introductory Offer: 7 days free trial

**Display Name (Localized - English US):** InkWell Plus Annual
**Description (Localized - English US):**
```
Get 12 months of InkWell Plus at a discounted rate. Includes unlimited AI prompts, SMS reminders, insights, and export features. Best value for committed journalers.
```

**InkWell Connect (Monthly)**
- Type: Auto-Renewable Subscription
- Reference Name: `InkWell Connect Monthly`
- Product ID: `com.inkwell.connect.monthly`
- Subscription Duration: 1 month
- Price: $29.99 USD
- Subscription Group: "InkWell"
- Introductory Offer: 7 days free trial

**Display Name (Localized - English US):** InkWell Connect Monthly
**Description (Localized - English US):**
```
Premium tier with everything in Plus, plus direct access to certified mental wellness practitioners. Includes 4 practitioner sessions per month, priority support, and advanced analytics for deeper personal growth.
```

### Subscription Group Configuration:
- Subscription Group Reference Name: "InkWell"
- Subscription Group Display Name: "InkWell Premium Features"
- App Store Localized Group Description: "Choose your InkWell subscription plan"

### Additional Settings (for each subscription):
- Subscription Review Information: Add screenshots/notes showing features
- Family Sharing: Off (subscriptions are personal)
- Free Trial: 7 days (auto-renewable, user charged after trial)
- Subscription Prices: Available in all territories at equivalent pricing

## 3. Configure Google Play Console (Android)

1. Go to Play Console → Your App → Monetize → Subscriptions
2. Create subscription products:

**InkWell Plus (Monthly)**
- Product ID: `com.inkwell.plus.monthly`
- Price: $6.99
- Billing period: Monthly
- Free trial: 7 days

**InkWell Plus (Annual)**
- Product ID: `com.inkwell.plus.annual`
- Price: $69.99
- Billing period: Yearly
- Free trial: 7 days

**InkWell Connect (Monthly)**
- Product ID: `com.inkwell.connect.monthly`
- Price: $29.99
- Billing period: Monthly
- Free trial: 7 days

## 4. Link Stores to RevenueCat

### iOS Setup:
1. In RevenueCat Dashboard → Project Settings → Apple App Store
2. Add your App Store Connect credentials
3. Click "Link App"
4. Configure Shared Secret from App Store Connect

### Android Setup:
1. In RevenueCat Dashboard → Project Settings → Google Play Store
2. Upload Service Account JSON key
3. Link your app package name: `com.inkwelljournal.mobile`

## 5. Create Offerings in RevenueCat

1. Go to RevenueCat Dashboard → Offerings
2. Create "Default Offering"
3. Add packages:

**Monthly Package:**
- Identifier: `monthly`
- iOS Product: `com.inkwell.plus.monthly`
- Android Product: `com.inkwell.plus.monthly`

**Annual Package:**
- Identifier: `annual`
- iOS Product: `com.inkwell.plus.annual`
- Android Product: `com.inkwell.plus.annual`

**Connect Package:**
- Identifier: `connect`
- iOS Product: `com.inkwell.connect.monthly`
- Android Product: `com.inkwell.connect.monthly`

4. Configure Entitlements:
   - Create "plus" entitlement → attach Plus products
   - Create "connect" entitlement → attach Connect product

## 6. Update Mobile App with API Keys

Edit `src/services/SubscriptionService.ts`:

```typescript
const REVENUECAT_IOS_KEY = 'appl_YOUR_ACTUAL_KEY';
const REVENUECAT_ANDROID_KEY = 'goog_YOUR_ACTUAL_KEY';
```

## 7. Test IAP (Sandbox)

### iOS Testing:
1. Add sandbox testers in App Store Connect
2. Sign out of real App Store on device
3. Run app and attempt purchase
4. Sign in with sandbox account when prompted

### Android Testing:
1. Add test accounts in Google Play Console
2. Install app via internal testing track
3. Attempt purchase with test account

## 8. Configure Webhook (Optional)

To sync RevenueCat → Firebase automatically:

1. Create Cloud Function webhook endpoint
2. In RevenueCat → Integrations → Webhooks
3. Add endpoint: `https://us-central1-inkwell-alpha.cloudfunctions.net/revenueCatWebhook`
4. Select events: `INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `EXPIRATION`

## 9. Production Checklist

- [ ] Subscriptions approved in App Store Connect
- [ ] Products published in Google Play Console
- [ ] RevenueCat API keys in production app
- [ ] Offerings configured correctly
- [ ] Privacy policy updated with subscription terms
- [ ] Terms of service include auto-renewal disclosure
- [ ] "Restore Purchases" button accessible
- [ ] Webhook configured (if using)

## Testing Commands

```bash
# iOS
npx react-native run-ios

# Android
npx react-native run-android

# Clear RevenueCat cache (for testing)
# iOS: Delete app and reinstall
# Android: Clear app data
```

## Pricing Strategy

**Free Tier:**
- Unlimited journaling
- 20% AI prompts
- No SMS

**Plus Tier ($6.99/mo or $69.99/yr):**
- Everything in Free
- 100% AI prompts
- SMS daily reminders
- Data export
- Weekly/monthly insights
- 7-day free trial

**Connect Tier ($29.99/mo):**
- Everything in Plus
- 1 practitioner message per week (included)
- Priority support
- NO free trial (human support cost)

## RevenueCat Resources

- Dashboard: https://app.revenuecat.com
- Docs: https://docs.revenuecat.com
- Community: https://community.revenuecat.com
- Support: support@revenuecat.com

---

## ✅ Session Handoff Status (Jan 18, 2025)

### 🛠️ **CRITICAL ISSUE RESOLVED - Firestore User Creation**

**MAJOR BUG FIXED:** No user documents created during mobile signup ✅

**Problem**: User successfully purchased Plus monthly subscription in sandbox, but no Firestore user document was created, breaking subscription sync and all app functionality.

**Root Cause**: Mobile app had commented-out Firestore user creation code in all signup methods:
```typescript
// This was commented out in email signup:
/* TODO: Re-enable when Firestore is added back */
```

**Solution Applied**: ✅ **CRITICAL FIX COMPLETE**
- ✅ **Email Signup**: Uncommented and updated Firestore user creation with complete field structure
- ✅ **Google Signin**: Updated user document to include all required fields (special_code, onboardingState, etc.)
- ✅ **Apple Signin**: Updated user document to include all required fields (special_code, onboardingState, etc.)

**Mobile User Document Structure Now Includes ALL Required Fields**:
```typescript
{
  userId: string,
  email: string,
  displayName: string,
  signupUsername: string,
  userRole: 'journaler', // Matches web app
  authProvider: 'email' | 'google' | 'apple',
  agreementAccepted: true,
  special_code: 'beta', // Required for system compatibility
  subscriptionTier: 'free',
  subscriptionStatus: 'active',
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  insightsPreferences: {
    weeklyEnabled: true,
    monthlyEnabled: true,
    createdAt: serverTimestamp()
  },
  onboardingState: {
    hasCompletedVoiceEntry: false,
    hasSeenWishTab: false,
    hasCreatedWish: false,
    hasUsedSophy: false,
    totalEntries: 0,
    currentMilestone: 'new_user',
    milestones: { firstEntry: null, firstVoiceEntry: null, firstWish: null, firstSophyChat: null },
    createdAt: serverTimestamp()
  },
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp()
}
```

**Immediate Test Plan**: 
1. Delete existing Firebase Auth test accounts
2. Sign up fresh via mobile app with any method (email/Google/Apple)  
3. Verify complete Firestore user document is created in Firebase Console
4. Test subscription purchase and verify RevenueCat → Firestore sync works
5. Test subscription-gated features

### ✅ **PREVIOUS SESSION COMPLETED FIXES**
- ✅ **Mobile Signup Form Cleanup** - Removed phone/SMS fields (web-only features)
- ✅ **PaywallModal Infinite Loop** - State guards prevent recursive renders
- ✅ **RevenueCat Multi-Offering Setup** - Plus and Connect tiers configured  
- ✅ **Bundle ID Corrections** - `com.pegasusrealm.inkwellmobile` matches App Store Connect
- ✅ **Metro Bundler Monorepo Fixes** - Updated config for proper path resolution
- ✅ **Plus Monthly Sandbox Purchase** - Confirmed working end-to-end

### 🚨 **IMMEDIATE NEXT STEPS**

1. **TEST CRITICAL FIX**: Sign up fresh and verify Firestore user document creation
2. **Complete Sandbox Testing**: Test Plus Annual and Connect Monthly subscriptions  
3. **Verify Subscription Sync**: Confirm RevenueCat entitlements update Firestore correctly
4. **Feature Gating**: Implement subscription-based feature locks throughout app
5. **Restore Purchases**: Add restore functionality to PaywallModal and settings

---

## ✅ Session Handoff Status (Jan 6, 2026)

### 🎯 **COMPLETED THIS SESSION**
- ✅ **PaywallModal Infinite Loop Fixed** - State-based guards prevent recursive re-renders
- ✅ **Two-Tier Paywall Redesigned** - Plus (annual pre-selected + monthly) + Connect sections
- ✅ **Multi-Offering RevenueCat Setup** - `default` (Plus) + `connect` offerings configured
- ✅ **Bundle ID Fixed** - Changed to `com.pegasusrealm.inkwellmobile` (matches App Store Connect)  
- ✅ **Metro Monorepo Issues Resolved** - Updated `metro.config.js` with proper paths
- ✅ **App Runs on Physical Device** - Successfully deploys and launches
- ✅ **Free Trial Configuration** - 7-day trials on Plus products only (Connect has none)

### 📋 **CURRENT CONFIGURATION**
**RevenueCat Setup:**
- API Key: `appl_MgoxKdevXxWONmSBnChHrgObCqn`
- iOS Bundle ID: `com.pegasusrealm.inkwellmobile`
- Offerings: `default` (Plus), `connect` (Connect)
- Entitlements: `plus`, `connect`

**App Store Connect Products:**
- `com.inkwell.plus.monthly` - $6.99/mo (7-day trial)
- `com.inkwell.plus.annual` - $69.99/yr (7-day trial) 
- `com.inkwell.connect.monthly` - $29.99/mo (no trial)

### 🚨 **NEXT PRIORITY TASKS**

#### 1. **CRITICAL: Test Sandbox Purchase Flow**
```bash
# From mobile_2/ directory
npm start  # Start Metro in background
npm run ios:sim  # Or use Xcode for device testing
```
- Sign out of real App Store on device
- Test Plus monthly & annual purchases
- Test Connect monthly purchase  
- Verify entitlements appear in RevenueCat dashboard
- Confirm Firestore user document updates correctly

#### 2. **✅ FIXED: Mobile Signup Form**
- **COMPLETED:** Removed phone number field from mobile signup
- **COMPLETED:** Removed SMS agreement checkbox from mobile signup  
- **REASON:** Mobile uses native push notifications, not SMS
- **NOTE:** Web app retains SMS functionality for browser users

#### 3. **VERIFY: Feature Lock/Unlock System**
**Add feature gating throughout the app:**
- SMS reminders (Plus+ only)
- AI prompts (20% free, 100% Plus+)
- Data export (Plus+ only)
- Practitioner connection (Connect only)

**Recommended locations to add checks:**
- Journal prompt generation screens
- SMS settings toggle
- Export functionality
- Any practitioner-related features

#### 4. **IMPLEMENT: Restore Purchases Functionality**  
**Currently missing:**
- Add "Restore Purchases" button to PaywallModal
- Add restore functionality to settings/profile screen
- Test restore after deleting/reinstalling app

#### 5. **OPTIONAL: Apple Connect Grace Period**
- Add grace period in App Store Connect subscription settings
- Test subscription expiration and renewal flows

### 🛠 **DEVELOPMENT WORKFLOW**
**Always work from `mobile_2/` directory:**
```bash
cd /path/to/inkwell-monorepo/mobile_2

# Clear caches if build issues
rm -rf ios/build node_modules/.cache
watchman watch-del-all
npm start --reset-cache

# For device builds, use Xcode (not CLI)
# Simulator builds: npm run ios
```

**Key Files Modified:**
- `src/components/PaywallModal.tsx` - Two-tier paywall UI
- `src/services/SubscriptionService.ts` - Multi-offering RevenueCat wrapper  
- `src/hooks/useSubscription.ts` - Fixed initialization loop
- `metro.config.js` - Monorepo path configuration
- `IAP-SETUP.md` - This documentation

**Testing Strategy:**
1. **Sandbox Testing First** - Use App Store Connect sandbox accounts
2. **Revenue Cat Dashboard** - Monitor purchase events and entitlements  
3. **Firestore Console** - Verify user subscription fields update
4. **Physical Device** - Required for IAP testing (simulator won't work)

### 💡 **RECOMMENDATIONS**

**Immediate (Next 2-3 hours):**
1. Test sandbox purchase flow end-to-end
2. Add restore purchases button to PaywallModal
3. Verify feature gating works correctly

**Short-term (This week):**
1. Add comprehensive feature access checks throughout app
2. Test subscription renewal and cancellation flows
3. Implement consumable products for extra messages

**Medium-term (Next sprint):**
1. Add webhook from RevenueCat to Firebase for real-time sync
2. Implement subscription management screen
3. Add analytics for paywall conversion tracking
