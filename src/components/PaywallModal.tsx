/**
 * PaywallModal: the Plus preview (v2.0, 2026-10-01).
 *
 * People SEE what Plus does (small renderings of the real Plus surfaces, marked
 * "Example"), then choose. It opens only where someone reaches for a Plus feature
 * (Sophy's daily limit, Speak it cleanup, Your month, photos) or from You. Never on
 * launch, never as an interruption.
 *
 * Honesty rules (board, 2026-10-01):
 *  - Only features that exist in this build are shown.
 *  - "Free trial" appears only when the store product carries a free intro offer AND
 *    this person is eligible (iOS eligibility check; Google Play only returns offers
 *    the person is eligible for). Otherwise the button just says "Get Plus".
 *  - The charge date and amount are stated above the button.
 *  - Savings are worked out from live store prices, never hardcoded.
 *  - Nothing is preselected for them except the plain monthly plan.
 *  - Cancellation and legal text match the platform.
 */

import React, {useEffect, useState, useMemo, useCallback} from 'react';
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
  Platform,
  useWindowDimensions,
} from 'react-native';
import Purchases, {PurchasesPackage} from 'react-native-purchases';
import SubscriptionService from '../services/SubscriptionService';
import auth from '@react-native-firebase/auth';
import {spacing, borderRadius, fontFamily} from '../theme';
import {useTheme, ThemeColors} from '../theme/ThemeContext';
import {IWButton} from './kit';
import {SophyOrb} from './kit/SophyBlock';
import {CloseIcon} from './kit/icons';
import {iPadContentStyle} from '../utils/iPad';
import {refreshSubscriptionStatus} from '../hooks/useSubscription';
import {markPlusPreviewViewed, markTrialStarted} from '../services/userDates';
import {AI_DAILY_LIMIT} from '../services/aiUsageService';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  onPurchaseSuccess?: () => void;
  featureBlocked?: string;
}

type TrialInfo = {days: number} | null;

const isAnnual = (p: PurchasesPackage) => p.packageType === 'ANNUAL';
const periodWord = (p: PurchasesPackage) => (isAnnual(p) ? 'year' : 'month');

function daysFrom(unit?: string, count?: number): number {
  if (!unit || !count) return 0;
  const u = unit.toUpperCase();
  if (u.startsWith('DAY')) return count;
  if (u.startsWith('WEEK')) return count * 7;
  if (u.startsWith('MONTH')) return count * 30;
  return 0;
}

/** Days of free trial this package offers, if the store has a free intro offer on it. */
function freeTrialDays(p: PurchasesPackage): number {
  const product: any = p.product;
  if (Platform.OS === 'android') {
    const phase = product.defaultOption?.freePhase;
    if (!phase) return 0;
    const bp = phase.billingPeriod;
    if (bp?.unit && bp?.value) return daysFrom(bp.unit, bp.value);
    const iso: string | undefined = bp?.iso8601;
    const m = iso && /^P(\d+)([DW])$/.exec(iso);
    return m ? Number(m[1]) * (m[2] === 'W' ? 7 : 1) : 0; // unreadable: promise nothing
  }
  const intro = product.introPrice;
  if (!intro || intro.price !== 0) return 0;
  return daysFrom(intro.periodUnit, intro.periodNumberOfUnits); // 0 if unreadable: promise nothing
}

const PaywallModal: React.FC<PaywallModalProps> = ({visible, onClose, onPurchaseSuccess}) => {
  const {colors} = useTheme();
  const {width: screenWidth} = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selected, setSelected] = useState<PurchasesPackage | null>(null);
  const [eligible, setEligible] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const user = auth().currentUser;
      if (!user) throw new Error('signed out');
      await SubscriptionService.initialize(user.uid);
      const all = await SubscriptionService.getAllOfferings();
      const pkgs = (all.plus?.availablePackages || []).filter(
        p => p.packageType === 'MONTHLY' || p.packageType === 'ANNUAL',
      );
      const list = pkgs.length ? pkgs : all.plus?.availablePackages || [];
      if (!list.length) throw new Error('no plans');
      // Monthly first, annual second, so the plain option is the default.
      list.sort((a, b) => Number(isAnnual(a)) - Number(isAnnual(b)));
      setPackages(list);
      setSelected(list[0]);
      if (Platform.OS === 'ios') {
        try {
          const ids = list.map(p => p.product.identifier);
          const res = await Purchases.checkTrialOrIntroductoryPriceEligibility(ids);
          const map: Record<string, boolean> = {};
          ids.forEach(id => {
            map[id] = res[id]?.status === Purchases.INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE;
          });
          setEligible(map);
        } catch {
          setEligible({}); // unknown means we don't promise a trial
        }
      }
    } catch (e) {
      console.warn('Paywall load failed:', e);
      setError("Plans couldn't load. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      load();
      markPlusPreviewViewed();
    }
  }, [visible, load]);

  const trialFor = (p: PurchasesPackage | null): TrialInfo => {
    if (!p) return null;
    const days = freeTrialDays(p);
    if (!days) return null;
    if (Platform.OS === 'ios' && !eligible[p.product.identifier]) return null;
    return {days};
  };

  const monthly = packages.find(p => p.packageType === 'MONTHLY');
  const annual = packages.find(p => p.packageType === 'ANNUAL');
  const savePct =
    monthly && annual && monthly.product.price > 0
      ? Math.round((1 - annual.product.price / (monthly.product.price * 12)) * 100)
      : 0;

  const trial = trialFor(selected);
  const chargeDate = trial
    ? new Date(Date.now() + trial.days * 86400000).toLocaleDateString('en-US', {month: 'long', day: 'numeric'})
    : '';

  const handlePurchase = async () => {
    if (!selected) return;
    try {
      setPurchasing(true);
      await SubscriptionService.purchasePackage(selected);
      if (trial) markTrialStarted();
      await refreshSubscriptionStatus();
      Alert.alert('Plus is on', trial ? `Your free days run through ${chargeDate}.` : 'Thanks for supporting InkWell.', [
        {
          text: 'OK',
          onPress: () => {
            onPurchaseSuccess?.();
            onClose();
          },
        },
      ]);
    } catch (e: any) {
      const code = String(e?.code ?? '');
      const cancelled = e?.userCancelled || code === '1' || code === 'PURCHASE_CANCELLED' || /cancel/i.test(code);
      if (cancelled) return;
      if (code === '20' || /PAYMENT_PENDING/i.test(code)) {
        Alert.alert('Waiting on the store', 'Your payment is pending with the store. Plus turns on as soon as it clears.');
      } else if (code === '6' || /ALREADY_PURCHASED/i.test(code)) {
        Alert.alert('You already have this', 'Tap "Restore a purchase" to turn Plus back on for this account.');
      } else {
        Alert.alert("That didn't go through", 'The store did not complete the purchase. Please try again.');
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    try {
      setPurchasing(true);
      await SubscriptionService.restorePurchases();
      await refreshSubscriptionStatus();
      Alert.alert('Checked your purchases', 'If you had Plus on this account, it is back on.', [{text: 'OK', onPress: onClose}]);
    } catch {
      Alert.alert("Couldn't find a purchase", 'There is no Plus purchase on this store account.');
    } finally {
      setPurchasing(false);
    }
  };

  const cancelWhere =
    Platform.OS === 'ios' ? 'Cancel anytime in Settings, then your name, then Subscriptions.' : 'Cancel anytime in Google Play, then Subscriptions.';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.top}>
          <Text style={styles.eyebrow}>INKWELL PLUS</Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles.close}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <CloseIcon color={colors.fontSecondary} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={[styles.scroll, iPadContentStyle(screenWidth)]} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>More from what you write</Text>
          <Text style={styles.lead}>
            Free stays a complete journal, every way of writing included. Plus adds Sophy without limits and a look at
            what your writing shows over time.
          </Text>

          {/* ─── See it: small versions of the real Plus screens ─── */}
          <Preview title="Your month" caption="Sophy reads your last 30 days." styles={styles} sophy>
            <View style={styles.sophyCard}>
              <View style={styles.sophyTop}>
                <SophyOrb size={18} />
                <Text style={styles.sophyWho}>SOPHY</Text>
                <Text style={styles.example}>Example</Text>
              </View>
              <Text style={styles.sophyText}>
                You wrote 14 times this month. Sleep came up most. Your entries after the 20th sound lighter than the
                ones before it.
              </Text>
            </View>
          </Preview>

          <Preview title="Sophy, any time" caption={`Free includes ${AI_DAILY_LIMIT} Sophy replies a day. Plus has no daily limit.`} styles={styles} sophy>
            <View style={styles.sophyCard}>
              <View style={styles.sophyTop}>
                <SophyOrb size={18} />
                <Text style={styles.sophyWho}>SOPHY</Text>
                <Text style={styles.example}>Example</Text>
              </View>
              <Text style={styles.sophyText}>
                You named three yeses this week, and none of them were for you. What would it look like to guard one hour
                of Saturday?
              </Text>
            </View>
          </Preview>

          <Preview title="Speak it, cleaned up" caption="Spoken words tidied into sentences, with Sophy's note on your voice." styles={styles}>
            <View style={styles.plainCard}>
              <Text style={styles.example}>Example</Text>
              <Text style={styles.raw}>so um today was kind of a lot like the meeting ran long and then</Text>
              <Text style={styles.clean}>Today was a lot. The meeting ran long, and then...</Text>
              <View style={styles.chips}>
                <Text style={styles.chip}>Tone: tired</Text>
                <Text style={styles.chip}>Energy: low</Text>
              </View>
            </View>
          </Preview>

          <Preview title="Gratitude from your own journal" caption="Prompts built from what you've written, and help drafting a gratitude letter." styles={styles} sophy>
            <View style={styles.sophyCard}>
              <View style={styles.sophyTop}>
                <SophyOrb size={18} />
                <Text style={styles.sophyWho}>FROM YOUR JOURNAL</Text>
                <Text style={styles.example}>Example</Text>
              </View>
              <Text style={styles.sophyText}>You wrote about the neighbor who returned the ladder. Imagine they had moved away last spring...</Text>
            </View>
          </Preview>

          <View style={styles.more}>
            <Text style={styles.moreTitle}>Also in Plus</Text>
            <Text style={styles.moreLine}>Photos and files in your entries</Text>
            <Text style={styles.moreLine}>Text message prompts and goal milestones</Text>
          </View>

          {/* ─── Choose ─── */}
          {loading ? (
            <ActivityIndicator color={colors.brandPrimary} style={styles.loader} />
          ) : error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              <IWButton voice="gray" small title="Try again" onPress={load} />
            </View>
          ) : (
            <View style={styles.plans}>
              {packages.map(p => {
                const on = selected?.identifier === p.identifier;
                return (
                  <TouchableOpacity
                    key={p.identifier}
                    style={[styles.plan, on && styles.planOn]}
                    onPress={() => setSelected(p)}
                    accessibilityRole="radio"
                    accessibilityState={{selected: on}}>
                    <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
                    <View style={styles.planText}>
                      <Text style={styles.planName}>{isAnnual(p) ? 'Yearly' : 'Monthly'}</Text>
                      {isAnnual(p) && savePct >= 5 ? <Text style={styles.planSave}>Save {savePct}% compared with monthly</Text> : null}
                    </View>
                    <Text style={styles.planPrice}>
                      {p.product.priceString}
                      <Text style={styles.planPer}>/{periodWord(p)}</Text>
                    </Text>
                  </TouchableOpacity>
                );
              })}

              {selected ? (
                <Text style={styles.terms}>
                  {trial
                    ? `Free for ${trial.days} days, then ${selected.product.priceString} a ${periodWord(selected)} starting ${chargeDate}. Cancel before then and you won't be charged.`
                    : `${selected.product.priceString} a ${periodWord(selected)}. Renews until you cancel.`}
                </Text>
              ) : null}

              <IWButton
                title={trial ? `Start ${trial.days}-day free trial` : 'Get Plus'}
                onPress={handlePurchase}
                loading={purchasing}
                disabled={purchasing || !selected}
              />
            </View>
          )}

          <Text style={styles.fine}>Subscription renews automatically until cancelled. {cancelWhere}</Text>
          <TouchableOpacity onPress={handleRestore} disabled={purchasing} style={styles.restore}>
            <Text style={styles.restoreText}>Restore a purchase</Text>
          </TouchableOpacity>
          <Text style={styles.legal}>
            <Text style={styles.link} onPress={() => Linking.openURL('https://pegasusrealm.com/terms-conditions/')}>
              Terms of Service
            </Text>
            {'   '}
            <Text style={styles.link} onPress={() => Linking.openURL('https://pegasusrealm.com/privacy-policy/')}>
              Privacy Policy
            </Text>
            {Platform.OS === 'ios' ? (
              <>
                {'   '}
                <Text
                  style={styles.link}
                  onPress={() => Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')}>
                  Apple's Standard EULA
                </Text>
              </>
            ) : null}
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const Preview: React.FC<{title: string; caption: string; styles: any; sophy?: boolean; children: React.ReactNode}> = ({
  title,
  caption,
  styles,
  children,
}) => (
  <View style={styles.preview}>
    <Text style={styles.previewTitle}>{title}</Text>
    {children}
    <Text style={styles.previewCaption}>{caption}</Text>
  </View>
);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: {flex: 1, backgroundColor: colors.bgPrimary},
    top: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.base,
      paddingBottom: spacing.sm,
    },
    eyebrow: {fontFamily: fontFamily.bodyBold, fontSize: 13, letterSpacing: 1.8, color: colors.brandPrimary},
    close: {
      width: 38,
      height: 38,
      borderRadius: 19,
      borderWidth: 1,
      borderColor: colors.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scroll: {padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.xl},
    title: {fontFamily: fontFamily.header, fontSize: 30, lineHeight: 36, color: colors.fontMain},
    lead: {fontFamily: fontFamily.body, fontSize: 16, lineHeight: 24, color: colors.fontSecondary, marginTop: -spacing.md},
    preview: {gap: spacing.sm},
    previewTitle: {fontFamily: fontFamily.bodyBold, fontSize: 16, color: colors.fontMain},
    previewCaption: {fontFamily: fontFamily.body, fontSize: 15, lineHeight: 22, color: colors.fontMuted},
    sophyCard: {
      backgroundColor: colors.sophyTint,
      borderColor: colors.sophyBorder,
      borderWidth: 1,
      borderRadius: borderRadius.xl,
      padding: spacing.base,
      gap: spacing.sm,
    },
    sophyTop: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
    sophyWho: {fontFamily: fontFamily.bodyBold, fontSize: 13, letterSpacing: 1.4, color: colors.sophyLight, flex: 1},
    sophyText: {fontFamily: fontFamily.serif, fontSize: 16, lineHeight: 24, color: colors.fontMain},
    example: {fontFamily: fontFamily.body, fontSize: 13, color: colors.fontMuted},
    plainCard: {
      backgroundColor: colors.bgCard,
      borderColor: colors.borderLight,
      borderWidth: 1,
      borderRadius: borderRadius.xl,
      padding: spacing.base,
      gap: spacing.sm,
    },
    raw: {fontFamily: fontFamily.body, fontSize: 15, color: colors.fontMuted, textDecorationLine: 'line-through'},
    clean: {fontFamily: fontFamily.serif, fontSize: 16, lineHeight: 24, color: colors.fontMain},
    chips: {flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap'},
    chip: {
      fontFamily: fontFamily.body,
      fontSize: 13,
      color: colors.fontSecondary,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: borderRadius.full,
      paddingHorizontal: spacing.md,
      paddingVertical: 4,
      overflow: 'hidden',
    },
    more: {gap: 6},
    moreTitle: {fontFamily: fontFamily.bodyBold, fontSize: 16, color: colors.fontMain, marginBottom: 2},
    moreLine: {fontFamily: fontFamily.body, fontSize: 15, lineHeight: 22, color: colors.fontSecondary},
    loader: {marginVertical: spacing.xl},
    errorBox: {gap: spacing.md, alignItems: 'flex-start'},
    errorText: {fontFamily: fontFamily.body, fontSize: 15, color: colors.fontSecondary},
    plans: {gap: spacing.md},
    plan: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderWidth: 1.5,
      borderColor: colors.borderLight,
      borderRadius: borderRadius.xl,
      padding: spacing.base,
      minHeight: 64,
    },
    planOn: {borderColor: colors.brandPrimary},
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.borderMedium,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioOn: {borderColor: colors.brandPrimary},
    radioDot: {width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brandPrimary},
    planText: {flex: 1},
    planName: {fontFamily: fontFamily.bodyBold, fontSize: 16, color: colors.fontMain},
    planSave: {fontFamily: fontFamily.body, fontSize: 15, color: colors.brandPrimary, marginTop: 2},
    planPrice: {fontFamily: fontFamily.bodyBold, fontSize: 17, color: colors.fontMain},
    planPer: {fontFamily: fontFamily.body, fontSize: 15, color: colors.fontMuted},
    terms: {fontFamily: fontFamily.body, fontSize: 15, lineHeight: 22, color: colors.fontMain},
    fine: {fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19, color: colors.fontMuted},
    restore: {alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center'},
    restoreText: {fontFamily: fontFamily.bodyBold, fontSize: 15, color: colors.brandPrimary},
    legal: {fontFamily: fontFamily.body, fontSize: 13, lineHeight: 20, color: colors.fontMuted},
    link: {color: colors.brandPrimary, textDecorationLine: 'underline'},
  });

export default PaywallModal;
