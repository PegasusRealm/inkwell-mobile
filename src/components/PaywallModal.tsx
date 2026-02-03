/**
 * InkWell Paywall Modal
 * Two-tier subscription upgrade screen: Plus + Connect
 * 
 * Updated 2026-01-06: Tiered design with separate Plus/Connect sections
 */

import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import SubscriptionService, { AllOfferings } from '../services/SubscriptionService';
import auth from '@react-native-firebase/auth';
import {spacing, borderRadius, fontFamily, fontSize} from '../theme';
import {useTheme, ThemeColors} from '../theme/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  onPurchaseSuccess?: () => void;
  featureBlocked?: string;
}

type SelectedTier = 'plus' | 'connect';

const PaywallModal: React.FC<PaywallModalProps> = ({
  visible,
  onClose,
  onPurchaseSuccess,
  featureBlocked,
}) => {
  // Theme hook for dynamic theming
  const {colors, isDark} = useTheme();
  
  // Create styles with current theme colors
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const [offerings, setOfferings] = useState<AllOfferings | null>(null);
  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedTier, setSelectedTier] = useState<SelectedTier>('plus');
  const [selectedPlusPackage, setSelectedPlusPackage] = useState<PurchasesPackage | null>(null);
  const [connectPackage, setConnectPackage] = useState<PurchasesPackage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);

  console.log('🔵 PaywallModal RENDER - visible:', visible, 'hasAttemptedLoad:', hasAttemptedLoad);

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

        if (fetchedOfferings.plus || fetchedOfferings.connect) {
          setOfferings(fetchedOfferings);
          
          // Set default selections
          // For Plus: default to annual (better LTV)
          if (fetchedOfferings.plus) {
            const annual = fetchedOfferings.plus.availablePackages.find(
              p => p.packageType === 'ANNUAL'
            );
            const monthly = fetchedOfferings.plus.availablePackages.find(
              p => p.packageType === 'MONTHLY'
            );
            setSelectedPlusPackage(annual || monthly || fetchedOfferings.plus.availablePackages[0]);
          }
          
          // For Connect: just the monthly
          if (fetchedOfferings.connect) {
            setConnectPackage(fetchedOfferings.connect.availablePackages[0]);
          }
          
          console.log('✅ Paywall loaded offerings');
        } else {
          setError('No subscription plans available');
        }
      } catch (err: any) {
        console.error('❌ Paywall error:', err);
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
        setSelectedPlusPackage(null);
        setConnectPackage(null);
        setError(null);
        setLoading(false);
        setSelectedTier('plus');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const handleRetry = () => {
    setError(null);
    setHasAttemptedLoad(false);
  };

  const handlePurchase = async () => {
    const packageToPurchase = selectedTier === 'plus' ? selectedPlusPackage : connectPackage;
    if (!packageToPurchase) return;

    try {
      setPurchasing(true);
      await SubscriptionService.purchasePackage(packageToPurchase);
      
      const tierName = selectedTier === 'plus' ? 'InkWell Plus' : 'InkWell Connect';
      Alert.alert(
        `🎉 Welcome to ${tierName}!`,
        selectedTier === 'plus' 
          ? 'Enjoy unlimited AI prompts, SMS reminders, and insights!'
          : 'You now have access to coach support!',

        [{ text: 'Start Using', onPress: () => { onPurchaseSuccess?.(); onClose(); } }],
      );
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
      Alert.alert('Purchases Restored', 'Your previous purchases have been restored!', [
        { text: 'OK', onPress: onClose },
      ]);
    } catch (error) {
      Alert.alert('Restore Failed', 'No purchases found to restore');
    } finally {
      setPurchasing(false);
    }
  };

  // Local FeatureChip component that has access to styles
  const FeatureChip: React.FC<{ icon: string; text: string }> = ({ icon, text }) => (
    <View style={styles.featureChip}>
      <Text style={styles.featureChipIcon}>{icon}</Text>
      <Text style={styles.featureChipText}>{text}</Text>
    </View>
  );

  // Error state
  if (error && !loading) {
    return (
      <Modal visible={visible} transparent animationType="slide">
        <View style={styles.container}>
          <View style={styles.loadingContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
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

  const currentPackage = selectedTier === 'plus' ? selectedPlusPackage : connectPackage;
  const isPlusAnnual = selectedPlusPackage?.packageType === 'ANNUAL';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Fixed Close Button - outside ScrollView for easy access */}
          <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* Title */}
          <View style={styles.titleSection}>
            <Text style={styles.title}>Choose Your Plan</Text>
            {featureBlocked && (
              <Text style={styles.subtitle}>{featureBlocked} requires a subscription</Text>
            )}
          </View>

          {/* ═══════════ PLUS TIER ═══════════ */}
          <TouchableOpacity
            style={[styles.tierCard, selectedTier === 'plus' && styles.tierCardSelected]}
            onPress={() => setSelectedTier('plus')}
            activeOpacity={0.8}
          >
            <View style={styles.tierHeader}>
              <Text style={styles.tierBadge}>INKWELL PLUS</Text>
              {selectedTier === 'plus' && <View style={styles.selectedDot} />}
            </View>

            <View style={styles.featuresRow}>
              <FeatureChip icon="🤖" text="Unlimited AI" />
              <FeatureChip icon="🎙️" text="Voice Analysis" />
              <FeatureChip icon="🔔" text="Reminders" />
              <FeatureChip icon="📎" text="File Attachments" />
              <FeatureChip icon="📊" text="Insights" />
              <FeatureChip icon="📤" text="Export" />
            </View>

            {/* Plus pricing options */}
            {offerings.plus && (
              <View style={styles.pricingOptions}>
                {offerings.plus.availablePackages.map((pkg) => {
                  const isAnnual = pkg.packageType === 'ANNUAL';
                  const isSelected = selectedPlusPackage?.identifier === pkg.identifier;
                  
                  return (
                    <TouchableOpacity
                      key={pkg.identifier}
                      style={[
                        styles.priceOption,
                        isSelected && selectedTier === 'plus' && styles.priceOptionSelected,
                      ]}
                      onPress={() => {
                        setSelectedTier('plus');
                        setSelectedPlusPackage(pkg);
                      }}
                    >
                      <View style={styles.priceOptionLeft}>
                        <View style={[styles.radioOuter, isSelected && selectedTier === 'plus' && styles.radioOuterSelected]}>
                          {isSelected && selectedTier === 'plus' && <View style={styles.radioInner} />}
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

            {/* Plus CTA */}
            {selectedTier === 'plus' && (
              <View style={styles.trialBadge}>
                <Text style={styles.trialBadgeText}>✨ 7-Day Free Trial</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* ═══════════ CONNECT TIER ═══════════ */}
          {offerings.connect && connectPackage && (
            <TouchableOpacity
              style={[styles.tierCard, styles.connectCard, selectedTier === 'connect' && styles.tierCardSelected]}
              onPress={() => setSelectedTier('connect')}
              activeOpacity={0.8}
            >
              <View style={styles.tierHeader}>
                <Text style={[styles.tierBadge, styles.connectBadge]}>INKWELL CONNECT</Text>
                {selectedTier === 'connect' && <View style={styles.selectedDot} />}
              </View>

              <Text style={styles.connectSubtitle}>Everything in Plus, plus human support</Text>

              <View style={styles.featuresRow}>
                <FeatureChip icon="🧠" text="All Plus Features" />
                <FeatureChip icon="👤" text="1 Message/Week" />
                <FeatureChip icon="🤝" text="Choose Your Human" />
                <FeatureChip icon="⚡" text="Priority Support" />
              </View>

              <View style={styles.connectPricing}>
                <View style={styles.priceOptionLeft}>
                  <View style={[styles.radioOuter, selectedTier === 'connect' && styles.radioOuterSelected]}>
                    {selectedTier === 'connect' && <View style={styles.radioInner} />}
                  </View>
                  <Text style={styles.priceLabel}>Monthly</Text>
                </View>
                <View style={styles.priceOptionRight}>
                  <Text style={styles.priceAmount}>{connectPackage.product.priceString}</Text>
                  <Text style={styles.pricePeriod}>/month</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}

          {/* CTA Button */}
          <TouchableOpacity
            style={[styles.ctaButton, purchasing && styles.ctaButtonDisabled]}
            onPress={handlePurchase}
            disabled={purchasing || !currentPackage}
          >
            {purchasing ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.ctaButtonText}>
                {selectedTier === 'plus' ? 'Start 7-Day Free Trial' : 'Subscribe to Connect'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Fine print */}
          <Text style={styles.finePrint}>
            {selectedTier === 'plus'
              ? `7-day free trial, then ${currentPackage?.product.priceString}${isPlusAnnual ? '/year' : '/month'}. Cancel anytime.`
              : `Billed ${currentPackage?.product.priceString}/month. Cancel anytime.`}
          </Text>

          {/* Restore */}
          <TouchableOpacity onPress={handleRestore} disabled={purchasing}>
            <Text style={styles.restoreText}>Restore Purchases</Text>
          </TouchableOpacity>

          {/* Legal */}
          <View style={styles.legalContainer}>
            <Text style={styles.legalText}>
              By subscribing, you agree to our <Text style={styles.legalLink}>Terms</Text> and{' '}
              <Text style={styles.legalLink}>Privacy Policy</Text>
            </Text>
          </View>
        </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

// Dynamic styles based on theme colors
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bgCard,
  },
  container: {
    flex: 1,
    backgroundColor: colors.bgCard,
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
    fontSize: fontSize.xl,
    color: colors.fontSecondary,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: fontSize.md,
    fontFamily: fontFamily.body,
    color: colors.fontSecondary,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  errorText: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.body,
    color: colors.fontSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  retryButton: {
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  retryButtonText: {
    color: colors.fontWhite,
    fontSize: fontSize.md,
    fontFamily: fontFamily.buttonBold,
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
    paddingTop: spacing.xxxl + spacing.lg, // Extra top padding for close button
    paddingBottom: 40,
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.xxxl,
    fontFamily: fontFamily.header,
    color: colors.brandPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.body,
    color: colors.fontSecondary,
    textAlign: 'center',
  },
  
  // Tier Cards
  tierCard: {
    borderWidth: 2,
    borderColor: colors.borderMedium,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.bgCard,
  },
  tierCardSelected: {
    borderColor: colors.brandPrimary,
    backgroundColor: colors.infoBg,
  },
  connectCard: {
    borderColor: colors.borderMedium,
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  tierBadge: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.buttonBold,
    color: colors.brandPrimary,
    letterSpacing: 1,
  },
  connectBadge: {
    color: colors.tierConnect,
  },
  selectedDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.brandPrimary,
  },
  connectSubtitle: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.body,
    color: colors.fontSecondary,
    marginBottom: spacing.sm,
  },
  
  // Features Row
  featuresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.lg,
  },
  featureChipIcon: {
    fontSize: fontSize.sm,
    marginRight: 4,
  },
  featureChipText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.buttonBold,
    color: colors.fontMain,
  },
  
  // Pricing Options
  pricingOptions: {
    gap: spacing.xs,
  },
  priceOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.borderMedium,
    backgroundColor: colors.bgCard,
  },
  priceOptionSelected: {
    borderColor: colors.brandPrimary,
    backgroundColor: colors.infoBg,
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
    borderColor: colors.brandPrimary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.brandPrimary,
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
    color: colors.brandPrimary,
  },
  pricePeriod: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.body,
    color: colors.fontSecondary,
  },
  
  // Trial Badge
  trialBadge: {
    backgroundColor: colors.accentGrowth + '20',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    alignSelf: 'center',
    marginTop: spacing.sm,
  },
  trialBadgeText: {
    color: colors.accentGrowth,
    fontFamily: fontFamily.buttonBold,
    fontSize: fontSize.sm,
  },
  
  // Connect Pricing
  connectPricing: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.tierConnect,
    backgroundColor: colors.tierConnect + '10',
  },
  
  // CTA
  ctaButton: {
    backgroundColor: colors.brandPrimary,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  ctaButtonDisabled: {
    opacity: 0.6,
  },
  ctaButtonText: {
    color: colors.fontWhite,
    fontSize: fontSize.lg,
    fontFamily: fontFamily.buttonBold,
  },
  finePrint: {
    textAlign: 'center',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.body,
    color: colors.fontSecondary,
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
  },
  legalLink: {
    color: colors.brandPrimary,
    textDecorationLine: 'underline',
  },
});

export default PaywallModal;
