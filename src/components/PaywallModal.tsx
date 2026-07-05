/**
 * PaywallModal — InkWell Plus upgrade (v2 rebuild, 2026-07-04).
 * Single tier: Plus. Connect selling REMOVED (tier retired 2026-07-01) —
 * legacy Connect subscribers keep their entitlements via useSubscription;
 * we stopped selling, not honoring.
 * Prices come live from RevenueCat priceString (store-console truth, never
 * hardcoded). Apple-required disclosures preserved (trial terms, auto-renew,
 * restore, Terms/Privacy/EULA links).
 */

import React, {useEffect, useState, useMemo} from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Linking,
  useWindowDimensions,
} from 'react-native';
import {PurchasesPackage} from 'react-native-purchases';
import SubscriptionService, {AllOfferings} from '../services/SubscriptionService';
import auth from '@react-native-firebase/auth';
import {spacing, borderRadius, fontFamily, fontSize} from '../theme';
import {useTheme, ThemeColors} from '../theme/ThemeContext';
import {IWButton} from './kit';
import {iPadContentStyle} from '../utils/iPad';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  onPurchaseSuccess?: () => void;
  featureBlocked?: string;
}

const PLUS_FEATURES = [
  'Unlimited Sophy prompts and reflections',
  'Voice cleanup and emotional analysis',
  'Weekly and monthly insight reports',
  'File attachments',
  'SMS reminders and email insights',
  'Full journal export',
];

const PaywallModal: React.FC<PaywallModalProps> = ({
  visible,
  onClose,
  onPurchaseSuccess,
  featureBlocked,
}) => {
  const {colors} = useTheme();
  const {width: screenWidth} = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [offerings, setOfferings] = useState<AllOfferings | null>(null);
  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);

  // Load offerings when modal opens
  useEffect(() => {
    if (!visible || hasAttemptedLoad || loading) return;

    setHasAttemptedLoad(true);
    setLoading(true);

    const loadData = async () => {
      try {
        const user = auth().currentUser;
        if (!user) throw new Error('User not authenticated');

        await SubscriptionService.initialize(user.uid);
        const fetchedOfferings = await SubscriptionService.getAllOfferings();

        if (fetchedOfferings.plus) {
          setOfferings(fetchedOfferings);
          // Default to annual (better LTV), else monthly, else first available
          const annual = fetchedOfferings.plus.availablePackages.find(p => p.packageType === 'ANNUAL');
          const monthly = fetchedOfferings.plus.availablePackages.find(p => p.packageType === 'MONTHLY');
          setSelectedPackage(annual || monthly || fetchedOfferings.plus.availablePackages[0]);
        } else {
          setError('No subscription plans available');
        }
      } catch (err: any) {
        console.error('Paywall error:', err);
        setError(err.message || 'Failed to load subscriptions');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [visible, hasAttemptedLoad, loading]);

  // Reset when modal closes
  useEffect(() => {
    if (!visible) {
      const timer = setTimeout(() => {
        setHasAttemptedLoad(false);
        setOfferings(null);
        setSelectedPackage(null);
        setError(null);
        setLoading(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const handleRetry = () => {
    setError(null);
    setHasAttemptedLoad(false);
  };

  const handlePurchase = async () => {
    if (!selectedPackage) return;

    try {
      setPurchasing(true);
      await SubscriptionService.purchasePackage(selectedPackage);

      Alert.alert('Welcome to InkWell Plus', 'Your upgrade is active.', [
        {
          text: 'Start Using',
          onPress: () => {
            onPurchaseSuccess?.();
            onClose();
          },
        },
      ]);
    } catch (error: any) {
      if (error.code !== 'PURCHASE_CANCELLED') {
        Alert.alert('Purchase Failed', error.message || 'Please try again');
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    try {
      setPurchasing(true);
      await SubscriptionService.restorePurchases();
      Alert.alert('Purchases Restored', 'Your previous purchases have been restored.', [
        {text: 'OK', onPress: onClose},
      ]);
    } catch (error) {
      Alert.alert('Restore Failed', 'No purchases found to restore');
    } finally {
      setPurchasing(false);
    }
  };

  // Error state
  if (error && !loading) {
    return (
      <Modal visible={visible} transparent animationType="slide">
        <View style={styles.container}>
          <View style={styles.loadingContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <IWButton title="Try Again" onPress={handleRetry} />
            <TouchableOpacity style={styles.closeTextButton} onPress={onClose}>
              <Text style={styles.closeTextButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  // Loading state
  if (loading || !offerings) {
    return (
      <Modal visible={visible} transparent animationType="slide">
        <View style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.brandPrimary} />
            <Text style={styles.loadingText}>Loading plans...</Text>
          </View>
        </View>
      </Modal>
    );
  }

  const isAnnualSelected = selectedPackage?.packageType === 'ANNUAL';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Fixed close button */}
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Text style={styles.closeButtonText}>×</Text>
          </TouchableOpacity>

          <ScrollView
            contentContainerStyle={[styles.scrollContent, iPadContentStyle(screenWidth)]}
            showsVerticalScrollIndicator={false}>
            {/* Title */}
            <View style={styles.titleSection}>
              <Text style={styles.eyebrow}>INKWELL PLUS</Text>
              <Text style={styles.title}>More from a journal that learns you</Text>
              {featureBlocked && <Text style={styles.subtitle}>{featureBlocked} requires a subscription</Text>}
            </View>

            {/* What Plus adds */}
            <View style={styles.featureList}>
              {PLUS_FEATURES.map(feature => (
                <View key={feature} style={styles.featureRow}>
                  <View style={styles.featureDot} />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>

            {/* Pricing options — live store prices, never hardcoded */}
            {offerings.plus && (
              <View style={styles.pricingOptions}>
                {offerings.plus.availablePackages.map(pkg => {
                  const isAnnual = pkg.packageType === 'ANNUAL';
                  const isSelected = selectedPackage?.identifier === pkg.identifier;

                  return (
                    <TouchableOpacity
                      key={pkg.identifier}
                      style={[styles.priceOption, isSelected && styles.priceOptionSelected]}
                      onPress={() => setSelectedPackage(pkg)}>
                      <View style={styles.priceOptionLeft}>
                        <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                          {isSelected && <View style={styles.radioInner} />}
                        </View>
                        <View>
                          <Text style={styles.priceLabel}>{isAnnual ? 'Annual' : 'Monthly'}</Text>
                          {isAnnual && <Text style={styles.savingsText}>Save 17%</Text>}
                        </View>
                      </View>
                      <View style={styles.priceOptionRight}>
                        <Text style={styles.priceAmount}>{pkg.product.priceString}</Text>
                        <Text style={styles.pricePeriod}>{isAnnual ? '/year' : '/month'}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Trial note */}
            <View style={styles.trialBadge}>
              <Text style={styles.trialBadgeText}>7-day free trial</Text>
            </View>

            {/* CTA */}
            <IWButton
              title="Start 7-Day Free Trial"
              onPress={handlePurchase}
              loading={purchasing}
              disabled={purchasing || !selectedPackage}
              style={styles.ctaButton}
            />

            {/* The free version stays a real journal (positioning law) */}
            <Text style={styles.freeNote}>
              The free version stays a complete journal. Upgrade if you want more.
            </Text>

            {/* Fine print - Apple required disclosures */}
            <Text style={styles.finePrint}>
              7-day free trial, then {selectedPackage?.product.priceString}
              {isAnnualSelected ? '/year' : '/month'}.{'\n'}
              Subscription auto-renews until cancelled. Cancel anytime in Settings, Apple ID, Subscriptions.
            </Text>

            {/* Restore */}
            <TouchableOpacity onPress={handleRestore} disabled={purchasing}>
              <Text style={styles.restoreText}>Restore Purchases</Text>
            </TouchableOpacity>

            {/* Legal - Apple requires Terms, Privacy, and EULA links */}
            <View style={styles.legalContainer}>
              <Text style={styles.legalText}>
                By subscribing you agree to our{' '}
                <Text
                  style={styles.legalLink}
                  onPress={() => Linking.openURL('https://pegasusrealm.com/terms-of-service')}>
                  Terms of Service
                </Text>
                {', '}
                <Text
                  style={styles.legalLink}
                  onPress={() => Linking.openURL('https://pegasusrealm.com/privacy-policy')}>
                  Privacy Policy
                </Text>
                {', and '}
                <Text
                  style={styles.legalLink}
                  onPress={() =>
                    Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')
                  }>
                  Apple's Standard EULA
                </Text>
                .
              </Text>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

// Dynamic styles based on theme colors
const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    closeButton: {
      position: 'absolute',
      top: spacing.sm,
      right: spacing.md,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.bgMuted,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10,
    },
    closeButtonText: {
      fontSize: fontSize.xxl,
      color: colors.fontSecondary,
      lineHeight: fontSize.xxl + 2,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
      gap: spacing.sm,
    },
    loadingText: {
      marginTop: spacing.md,
      fontSize: fontSize.md,
      fontFamily: fontFamily.body,
      color: colors.fontSecondary,
    },
    errorText: {
      fontSize: fontSize.md,
      fontFamily: fontFamily.body,
      color: colors.fontSecondary,
      textAlign: 'center',
      marginBottom: spacing.lg,
    },
    closeTextButton: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.sm,
    },
    closeTextButtonText: {
      color: colors.fontSecondary,
      fontSize: fontSize.md,
      fontFamily: fontFamily.button,
    },
    scrollContent: {
      padding: spacing.lg,
      paddingTop: spacing.xxxl + spacing.lg,
      paddingBottom: 40,
    },
    titleSection: {
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    eyebrow: {
      fontFamily: fontFamily.bodyBold,
      fontSize: fontSize.xs,
      color: colors.tierPlus,
      letterSpacing: 2,
      marginBottom: spacing.sm,
    },
    title: {
      fontSize: fontSize.xxl,
      fontFamily: fontFamily.header,
      color: colors.fontMain,
      textAlign: 'center',
      marginBottom: 4,
    },
    subtitle: {
      fontSize: fontSize.base,
      fontFamily: fontFamily.body,
      color: colors.fontSecondary,
      textAlign: 'center',
      marginTop: spacing.xs,
    },

    // Feature list — quiet rows, no emoji chips
    featureList: {
      backgroundColor: colors.bgCard,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: borderRadius.lg,
      padding: spacing.base,
      marginBottom: spacing.lg,
      gap: spacing.sm,
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    featureDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.tierPlus,
    },
    featureText: {
      flex: 1,
      fontSize: fontSize.sm,
      fontFamily: fontFamily.body,
      color: colors.fontMain,
      lineHeight: 20,
    },

    // Pricing options
    pricingOptions: {
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    priceOption: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: spacing.base,
      borderRadius: borderRadius.lg,
      borderWidth: 1.5,
      borderColor: colors.borderMedium,
      backgroundColor: colors.bgCard,
    },
    priceOptionSelected: {
      borderColor: colors.tierPlus,
      backgroundColor: colors.sophyTint,
    },
    priceOptionLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    priceOptionRight: {
      alignItems: 'flex-end',
    },
    radioOuter: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.borderMedium,
      justifyContent: 'center',
      alignItems: 'center',
    },
    radioOuterSelected: {
      borderColor: colors.tierPlus,
    },
    radioInner: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.tierPlus,
    },
    priceLabel: {
      fontSize: fontSize.md,
      fontFamily: fontFamily.buttonBold,
      color: colors.fontMain,
    },
    savingsText: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.buttonBold,
      color: colors.accentGrowth,
      marginTop: 2,
    },
    priceAmount: {
      fontSize: fontSize.xl,
      fontFamily: fontFamily.header,
      color: colors.fontMain,
    },
    pricePeriod: {
      fontSize: fontSize.sm,
      fontFamily: fontFamily.body,
      color: colors.fontSecondary,
    },

    // Trial
    trialBadge: {
      backgroundColor: colors.accentGrowth + '20',
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      borderRadius: 20,
      alignSelf: 'center',
      marginBottom: spacing.md,
    },
    trialBadgeText: {
      color: colors.accentGrowth,
      fontFamily: fontFamily.buttonBold,
      fontSize: fontSize.sm,
    },

    // CTA
    ctaButton: {
      marginBottom: spacing.md,
    },
    freeNote: {
      textAlign: 'center',
      fontSize: fontSize.sm,
      fontFamily: fontFamily.body,
      color: colors.fontSecondary,
      marginBottom: spacing.md,
    },
    finePrint: {
      textAlign: 'center',
      fontSize: fontSize.xs,
      fontFamily: fontFamily.body,
      color: colors.fontMuted,
      lineHeight: 18,
      marginBottom: spacing.lg,
    },
    restoreText: {
      textAlign: 'center',
      fontSize: fontSize.md,
      fontFamily: fontFamily.buttonBold,
      color: colors.brandPrimary,
      marginBottom: spacing.lg,
    },
    legalContainer: {
      marginTop: spacing.xs,
    },
    legalText: {
      textAlign: 'center',
      fontSize: fontSize.xs,
      fontFamily: fontFamily.body,
      color: colors.fontMuted,
      lineHeight: 18,
    },
    legalLink: {
      color: colors.brandPrimary,
      textDecorationLine: 'underline',
    },
  });

export default PaywallModal;
