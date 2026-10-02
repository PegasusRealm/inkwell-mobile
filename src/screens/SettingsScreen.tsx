/**
 * You tab (v2.0, 2026-10-01). Was the Settings modal; now a tab like the others.
 * Order: Your look, Sophy, Reminders and emails, Practice Summary, Your words,
 * InkWell Plus, Help right now, Help and About, Sign out.
 * One surface: the Your look card on top, then plain rows split by hairlines.
 * LAWS: teal is structure, coral is Sophy's only. Practice Summary and Export are FREE.
 * The privacy lines stay architecturally true and never say HIPAA.
 * Every Firestore read/write keeps its exact shape (web, insights and Practice
 * Summary read these docs). The coachReplies prefs have no UI but their stored
 * values pass through every save unchanged.
 */
import React, {useState, useEffect, useMemo, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
  Switch,
  Share,
  Platform,
  Linking,
  AppState,
  useWindowDimensions,
  KeyboardAvoidingView,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeBlobUtil from 'react-native-blob-util';
import {Picker} from '@react-native-picker/picker';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {spacing, borderRadius, fontFamily} from '../theme';
import {useTheme, ThemeColors} from '../theme/ThemeContext';
import type {ThemeMode} from '../theme';
import type {TabScreenProps} from '../navigation/types';
import {iPadContentStyle} from '../utils/iPad';
import {useSubscription} from '../hooks/useSubscription';
import {useOnboarding} from '../hooks/useOnboarding';
import PaywallModal from '../components/PaywallModal';
import {IdentityBar, ScreenTitle} from '../components/IdentityBar';
import notificationService, {PushNotificationPreferences} from '../services/notificationService';
import {FirstStepsService} from '../services/firstStepsService';
import {APP_VERSION} from '../version';
import {Card, IWButton, Pill, Eyebrow} from '../components/kit';
import {ChevronRightIcon, CloseIcon} from '../components/kit/icons';

// Read by Today. '1' shows past entries there, '0' hides them; missing means on.
const SHOW_MEMORIES_KEY = 'iw_show_memories';

const DELETE_COPY =
  'Your account and everything in it, including photos and files, will be deleted in 30 days. Sign in again before then to cancel.';

/** Android: copy an export into Downloads/InkWell. Android 10+ only; false means use the share sheet. */
async function saveToAndroidDownloads(name: string, path: string, mimeType: string): Promise<boolean> {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 29) return false;
  try {
    await ReactNativeBlobUtil.MediaCollection.copyToMediaStore(
      {name, parentFolder: 'Castalia', mimeType} as any,
      'Download',
      path,
    );
    return true;
  } catch (e) {
    console.warn('Could not save to Downloads:', e);
    return false;
  }
}

const MANAGE_SUBSCRIPTION_URL = Platform.select({
  ios: 'https://apps.apple.com/account/subscriptions',
  default: 'https://play.google.com/store/account/subscriptions',
});

// Twilio-supported country codes (major regions)
const COUNTRY_CODES = [
  {code: '+1', country: 'US/Canada'},
  {code: '+44', country: 'UK'},
  {code: '+61', country: 'Australia'},
  {code: '+64', country: 'New Zealand'},
  {code: '+353', country: 'Ireland'},
  {code: '+49', country: 'Germany'},
  {code: '+33', country: 'France'},
  {code: '+34', country: 'Spain'},
  {code: '+39', country: 'Italy'},
  {code: '+31', country: 'Netherlands'},
  {code: '+32', country: 'Belgium'},
  {code: '+41', country: 'Switzerland'},
  {code: '+43', country: 'Austria'},
  {code: '+46', country: 'Sweden'},
  {code: '+47', country: 'Norway'},
  {code: '+45', country: 'Denmark'},
  {code: '+358', country: 'Finland'},
  {code: '+48', country: 'Poland'},
  {code: '+81', country: 'Japan'},
  {code: '+82', country: 'South Korea'},
  {code: '+65', country: 'Singapore'},
  {code: '+852', country: 'Hong Kong'},
  {code: '+91', country: 'India'},
  {code: '+971', country: 'UAE'},
  {code: '+972', country: 'Israel'},
  {code: '+27', country: 'South Africa'},
  {code: '+52', country: 'Mexico'},
  {code: '+55', country: 'Brazil'},
  {code: '+54', country: 'Argentina'},
  {code: '+56', country: 'Chile'},
];

// Major world timezones (~25 grouped by region)
const TIMEZONES = [
  {value: 'Pacific/Honolulu', label: 'Hawaii (HST)'},
  {value: 'America/Anchorage', label: 'Alaska (AKST)'},
  {value: 'America/Los_Angeles', label: 'US Pacific (PST)'},
  {value: 'America/Denver', label: 'US Mountain (MST)'},
  {value: 'America/Phoenix', label: 'Arizona (MST)'},
  {value: 'America/Chicago', label: 'US Central (CST)'},
  {value: 'America/New_York', label: 'US Eastern (EST)'},
  {value: 'America/Toronto', label: 'Toronto (EST)'},
  {value: 'America/Mexico_City', label: 'Mexico City (CST)'},
  {value: 'America/Sao_Paulo', label: 'São Paulo (BRT)'},
  {value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (ART)'},
  {value: 'Europe/London', label: 'London (GMT)'},
  {value: 'Europe/Dublin', label: 'Dublin (GMT)'},
  {value: 'Europe/Paris', label: 'Paris (CET)'},
  {value: 'Europe/Berlin', label: 'Berlin (CET)'},
  {value: 'Europe/Amsterdam', label: 'Amsterdam (CET)'},
  {value: 'Europe/Rome', label: 'Rome (CET)'},
  {value: 'Europe/Madrid', label: 'Madrid (CET)'},
  {value: 'Europe/Stockholm', label: 'Stockholm (CET)'},
  {value: 'Asia/Dubai', label: 'Dubai (GST)'},
  {value: 'Asia/Kolkata', label: 'India (IST)'},
  {value: 'Asia/Singapore', label: 'Singapore (SGT)'},
  {value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)'},
  {value: 'Asia/Tokyo', label: 'Tokyo (JST)'},
  {value: 'Asia/Seoul', label: 'Seoul (KST)'},
  {value: 'Australia/Sydney', label: 'Sydney (AEDT)'},
  {value: 'Australia/Melbourne', label: 'Melbourne (AEDT)'},
  {value: 'Australia/Perth', label: 'Perth (AWST)'},
  {value: 'Pacific/Auckland', label: 'Auckland (NZDT)'},
];

const SUMMARY_DAY_OPTIONS = [7, 30, 90] as const;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// ==================== One row ====================
// The single row language for this screen: a hairline on top, a title, an optional
// subtitle, and a switch, value or chevron on the right.
interface RowProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  danger?: boolean;
  nested?: boolean;
  disabled?: boolean;
}

const Row: React.FC<RowProps> = ({title, subtitle, right, onPress, chevron, danger, nested, disabled}) => {
  const {colors} = useTheme();
  const rs = useMemo(() => createRowStyles(colors), [colors]);
  const body = (
    <>
      <View style={rs.text}>
        <Text style={[rs.title, nested && rs.titleNested, danger && {color: colors.btnDanger}]}>{title}</Text>
        {subtitle ? <Text style={rs.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
      {chevron ? <ChevronRightIcon color={colors.brandPrimary} /> : null}
    </>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        style={({pressed}) => [rs.row, nested && rs.nested, pressed && {opacity: 0.6}]}>
        {body}
      </Pressable>
    );
  }
  return <View style={[rs.row, nested && rs.nested]}>{body}</View>;
};

const createRowStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: 56,
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    nested: {
      marginLeft: spacing.base,
      minHeight: 48,
      paddingVertical: 10,
    },
    text: {flex: 1, minWidth: 0},
    title: {
      fontFamily: fontFamily.button,
      fontSize: 16,
      lineHeight: 22,
      color: colors.fontMain,
    },
    titleNested: {fontFamily: fontFamily.body, fontSize: 15},
    subtitle: {
      fontFamily: fontFamily.body,
      fontSize: 15,
      lineHeight: 21,
      color: colors.fontMuted,
      marginTop: 2,
    },
  });

export default function SettingsScreen({navigation}: TabScreenProps<'You'>) {
  const user = auth().currentUser;
  const {colors, themeMode, setThemeMode, isDark} = useTheme();
  const {width: screenWidth} = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Week dots in the identity bar refresh each time You comes into view
  const [dotsRefresh, setDotsRefresh] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setDotsRefresh(n => n + 1);
    }, []),
  );

  // Profile
  const [profileName, setProfileName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileStatus, setProfileStatus] = useState('');

  // Email insights
  const [weeklyInsightsEnabled, setWeeklyInsightsEnabled] = useState(true);
  const [monthlyInsightsEnabled, setMonthlyInsightsEnabled] = useState(true);
  const [savingInsights, setSavingInsights] = useState(false);

  // Account lifecycle
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // SMS notifications
  const [countryCode, setCountryCode] = useState('+1');
  const [localPhoneNumber, setLocalPhoneNumber] = useState('');
  const [, setPhoneNumber] = useState('');
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [smsEnabledStored, setSmsEnabledStored] = useState(false);
  const [smsWishMilestones, setSmsWishMilestones] = useState(true);
  const [smsDailyPrompts, setSmsDailyPrompts] = useState(false);
  const [smsGratitudePrompts, setSmsGratitudePrompts] = useState(false);
  // No UI; the stored value passes through saves unchanged
  const [smsCoachReplies, setSmsCoachReplies] = useState(true);
  const [smsWeeklyInsights, setSmsWeeklyInsights] = useState(false);
  const [savingSms, setSavingSms] = useState(false);
  const [smsStatus, setSmsStatus] = useState('');
  const [selectedTimezone, setSelectedTimezone] = useState('America/New_York');

  // Push notifications
  const [pushPermissionStatus, setPushPermissionStatus] = useState<'authorized' | 'denied' | 'not_determined'>('not_determined');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushDailyPrompts, setPushDailyPrompts] = useState(true);
  const [pushGratitudePrompts, setPushGratitudePrompts] = useState(true);
  const [pushWishMilestones, setPushWishMilestones] = useState(true);
  // No UI; the stored value passes through saves unchanged
  const [pushCoachReplies, setPushCoachReplies] = useState(true);
  const [pushWeeklyInsights, setPushWeeklyInsights] = useState(false);
  const [savingPush, setSavingPush] = useState(false);
  const [pushStatus, setPushStatus] = useState('');

  // Export (free)
  const [exporting, setExporting] = useState(false);

  // Past entries on Today (local to this phone)
  const [showMemories, setShowMemories] = useState(true);

  // Practice Summary (free)
  const [summaryDays, setSummaryDays] = useState<number>(30);
  const [sendingSummary, setSendingSummary] = useState(false);
  const [summaryStatus, setSummaryStatus] = useState('');

  const {
    isActive,
    isPremium,
    loading: subscriptionLoading,
    openPaywall,
    checkFeatureAndShowPaywall,
    showPaywall,
    closePaywall,
  } = useSubscription();

  const {resetOnboarding} = useOnboarding();

  // Transient inline status helper (observation voice, no cheerleader toasts)
  const flashStatus = (setter: (s: string) => void, text: string, ms = 3000) => {
    setter(text);
    setTimeout(() => setter(''), ms);
  };

  const switchColors = (on: boolean) => ({
    trackColor: {false: colors.borderMedium, true: colors.brandAlt},
    thumbColor: on ? colors.brandPrimary : colors.fontMuted,
  });

  // Resets the FirstSteps guide and its hints
  const handleResetFirstSteps = () => {
    Alert.alert('Show the tips again?', 'The first-steps guide and its hints come back, starting from the top.', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Show them',
        onPress: async () => {
          await resetOnboarding(); // legacy tip flags cleared too
          FirstStepsService.reset();
          Alert.alert('Done', 'The tips will show again as you use Castalia.');
        },
      },
    ]);
  };

  const handleManageSubscription = async () => {
    try {
      await Linking.openURL(MANAGE_SUBSCRIPTION_URL);
    } catch (error) {
      console.error('Error opening subscription management:', error);
      Alert.alert(
        'Could not open subscriptions',
        Platform.OS === 'ios'
          ? 'You can manage it in the Settings app under your name, then Subscriptions.'
          : 'You can manage it in the Play Store under Payments and subscriptions.',
      );
    }
  };

  useEffect(() => {
    loadProfile();
    loadInsightsPreferences();
    loadSmsPreferences();
    loadPushPreferences();
    loadShowMemories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh push permission status when app returns from background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        loadPushPreferences();
      }
    });
    return () => {
      subscription.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ==================== Past entries on Today ====================
  const loadShowMemories = async () => {
    try {
      const v = await AsyncStorage.getItem(SHOW_MEMORIES_KEY);
      setShowMemories(v !== '0');
    } catch (error) {
      console.error('Error loading show-memories setting:', error);
    }
  };

  const handleShowMemoriesToggle = async (value: boolean) => {
    setShowMemories(value);
    try {
      await AsyncStorage.setItem(SHOW_MEMORIES_KEY, value ? '1' : '0');
    } catch (error) {
      console.error('Error saving show-memories setting:', error);
    }
  };

  // ==================== Profile ====================
  const loadProfile = async () => {
    if (!user) return;
    try {
      const userDoc = await firestore().collection('users').doc(user.uid).get();
      const userData = userDoc.data();
      // Web schema: read signupUsername, fall back to displayName
      setProfileName(userData?.signupUsername || userData?.displayName || '');
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      await firestore().collection('users').doc(user.uid).set(
        {signupUsername: profileName.trim()},
        {merge: true},
      );
      flashStatus(setProfileStatus, 'Saved.');
    } catch (error) {
      console.error('Error saving profile:', error);
      flashStatus(setProfileStatus, 'Save failed. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  // ==================== Email insights ====================
  const loadInsightsPreferences = async () => {
    if (!user) return;
    try {
      const userDoc = await firestore().collection('users').doc(user.uid).get();
      const userData = userDoc.data();
      if (userData?.insightsPreferences) {
        setWeeklyInsightsEnabled(userData.insightsPreferences.weeklyEnabled !== false);
        setMonthlyInsightsEnabled(userData.insightsPreferences.monthlyEnabled !== false);
      }
    } catch (error) {
      console.error('Error loading insights preferences:', error);
    }
  };

  const saveInsightsPreferences = async (weekly: boolean, monthly: boolean) => {
    if (!user) return;
    setSavingInsights(true);
    try {
      await firestore().collection('users').doc(user.uid).set(
        {
          insightsPreferences: {
            weeklyEnabled: weekly,
            monthlyEnabled: monthly,
            updatedAt: firestore.FieldValue.serverTimestamp(),
          },
        },
        {merge: true},
      );
    } catch (error) {
      console.error('Error saving insights preferences:', error);
      Alert.alert('Not saved', 'Your email settings did not save. Please try again.');
    } finally {
      setSavingInsights(false);
    }
  };

  // ==================== SMS preferences ====================
  const formatPhoneNumber = (text: string): string => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length <= 3) {
      return cleaned;
    } else if (cleaned.length <= 6) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    } else {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
    }
  };

  const handlePhoneChange = (text: string) => {
    setLocalPhoneNumber(formatPhoneNumber(text));
  };

  const loadSmsPreferences = async () => {
    if (!user) return;
    try {
      const userDoc = await firestore().collection('users').doc(user.uid).get();
      const userData = userDoc.data();

      // Web stores phoneNumber and timezone at root level; old mobile stored
      // them inside smsPreferences. Check both for compatibility.
      const phone = userData?.phoneNumber || userData?.smsPreferences?.phoneNumber || '';
      setPhoneNumber(phone);

      if (phone) {
        const sortedCodes = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);
        const matchedCountry = sortedCodes.find(c => phone.startsWith(c.code));
        if (matchedCountry) {
          setCountryCode(matchedCountry.code);
          setLocalPhoneNumber(phone.slice(matchedCountry.code.length));
        } else {
          setCountryCode('+1');
          setLocalPhoneNumber(phone.replace(/^\+/, ''));
        }
      }

      const tz = userData?.timezone || userData?.smsPreferences?.timezone || 'America/New_York';
      setSelectedTimezone(tz);

      const enabled = userData?.smsOptIn || userData?.smsPreferences?.enabled || false;
      setSmsEnabled(enabled);
      setSmsEnabledStored(enabled);

      if (userData?.smsPreferences) {
        setSmsWishMilestones(userData.smsPreferences.wishMilestones !== false);
        setSmsDailyPrompts(userData.smsPreferences.dailyPrompts === true);
        setSmsGratitudePrompts(
          userData.smsPreferences.dailyGratitude === true || userData.smsPreferences.gratitudePrompts === true,
        );
        setSmsCoachReplies(userData.smsPreferences.coachReplies !== false);
        setSmsWeeklyInsights(userData.smsPreferences.weeklyInsights === true);
      }
    } catch (error) {
      console.error('Error loading SMS preferences:', error);
    }
  };

  const saveSmsPreferences = async () => {
    if (!user) return;

    const cleanLocalNumber = localPhoneNumber.replace(/[\s\-\(\)]/g, '');
    const fullPhoneNumber = cleanLocalNumber ? `${countryCode}${cleanLocalNumber}` : '';

    if (smsEnabled && cleanLocalNumber && cleanLocalNumber.length < 6) {
      Alert.alert('Check the number', 'Please enter a phone number with at least 6 digits.');
      return;
    }

    setSavingSms(true);
    try {
      await firestore().collection('users').doc(user.uid).set(
        {
          // Root level for web app compatibility
          phoneNumber: fullPhoneNumber,
          timezone: selectedTimezone,
          smsOptIn: smsEnabled,
          smsPreferences: {
            phoneNumber: fullPhoneNumber,
            enabled: smsEnabled,
            timezone: selectedTimezone,
            wishMilestones: smsWishMilestones,
            dailyPrompts: smsDailyPrompts,
            gratitudePrompts: smsGratitudePrompts,
            dailyGratitude: smsGratitudePrompts, // Web uses this name
            coachReplies: smsCoachReplies, // passthrough, no UI
            weeklyInsights: smsWeeklyInsights,
            updatedAt: firestore.FieldValue.serverTimestamp(),
          },
        },
        {merge: true},
      );

      setPhoneNumber(fullPhoneNumber);
      setSmsEnabledStored(smsEnabled);
      flashStatus(setSmsStatus, 'Saved.');
    } catch (error) {
      console.error('Error saving SMS preferences:', error);
      Alert.alert('Not saved', 'Your text message settings did not save. Please try again.');
    } finally {
      setSavingSms(false);
    }
  };

  // ==================== Push notifications ====================
  const loadPushPreferences = async () => {
    if (!user) return;
    try {
      const prefs = await notificationService.loadPreferences(user.uid);
      if (prefs.enabled) {
        setPushPermissionStatus('authorized');
        setPushEnabled(true);
      } else {
        setPushPermissionStatus('not_determined');
        setPushEnabled(false);
      }
      setPushDailyPrompts(prefs.dailyPrompts);
      setPushGratitudePrompts(prefs.gratitudePrompts);
      setPushWishMilestones(prefs.wishMilestones);
      setPushCoachReplies(prefs.coachReplies);
      setPushWeeklyInsights(prefs.weeklyInsights);
    } catch (error) {
      console.error('Error loading push preferences:', error);
    }
  };

  const handlePushToggle = async (value: boolean) => {
    if (!user) return;

    if (value) {
      setPushEnabled(true);
      setPushPermissionStatus('authorized');

      const tokenResult = await notificationService.getAndSaveToken(user.uid);
      await savePushPreferences(true, true);

      if (tokenResult.success) {
        flashStatus(setPushStatus, 'Notifications are on.');
      } else if (tokenResult.permissionStatus === 'DENIED') {
        setPushEnabled(false);
        setPushPermissionStatus('denied');
        Alert.alert(
          'Notifications are off for Castalia',
          'Your phone is blocking Castalia notifications. Open Settings to allow them?',
          [
            {text: 'Not now', style: 'cancel'},
            {text: 'Open Settings', onPress: () => notificationService.openSettings()},
          ],
        );
      } else {
        setPushEnabled(false);
        Alert.alert(
          'Could not turn on notifications',
          `Please try again.\n\nError: ${tokenResult.error || 'Unknown error'}`,
        );
      }
    } else {
      setPushEnabled(false);
      await savePushPreferences(false, true);
      flashStatus(setPushStatus, 'Notifications are off.');
    }
  };

  const savePushPreferences = async (enabled?: boolean, skipStatus?: boolean) => {
    if (!user) return;
    setSavingPush(true);
    try {
      const prefs: PushNotificationPreferences = {
        enabled: enabled ?? pushEnabled,
        dailyPrompts: pushDailyPrompts,
        gratitudePrompts: pushGratitudePrompts,
        wishMilestones: pushWishMilestones,
        coachReplies: pushCoachReplies, // passthrough, no UI
        weeklyInsights: pushWeeklyInsights,
      };

      const success = await notificationService.savePreferences(user.uid, prefs);
      if (!skipStatus) {
        if (success) {
          flashStatus(setPushStatus, 'Saved.');
        } else {
          Alert.alert('Not saved', 'Your notification settings did not save. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error saving push preferences:', error);
      if (!skipStatus) {
        Alert.alert('Not saved', 'Your notification settings did not save. Please try again.');
      }
    } finally {
      setSavingPush(false);
    }
  };

  // ==================== Practice Summary (free) ====================
  const handleSendPracticeSummary = async () => {
    if (!user) {
      flashStatus(setSummaryStatus, 'Sign in first.');
      return;
    }
    setSendingSummary(true);
    setSummaryStatus('Building your summary...');
    try {
      const idToken = await user.getIdToken();
      const r = await fetch('https://us-central1-inkwell-alpha.cloudfunctions.net/practiceSummary', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + idToken},
        body: JSON.stringify({days: summaryDays}),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok && data.sent) {
        flashStatus(setSummaryStatus, 'Sent to your email.', 5000);
        return;
      }
      flashStatus(setSummaryStatus, data.error || 'Could not send. Please try again.', 5000);
    } catch (e) {
      flashStatus(setSummaryStatus, 'Could not send. Please try again.', 5000);
    } finally {
      setSendingSummary(false);
    }
  };

  // ==================== Export (free in 2.0) ====================
  const safeToISOString = (dateField: any): string | null => {
    if (!dateField) return null;
    if (typeof dateField.toDate === 'function') {
      return dateField.toDate().toISOString();
    }
    if (typeof dateField === 'string') {
      return dateField;
    }
    if (dateField instanceof Date) {
      return dateField.toISOString();
    }
    return null;
  };

  const handleExportData = async () => {
    if (!user || exporting) return;

    setExporting(true);
    try {
      const entriesSnapshot = await firestore()
        .collection('journalEntries')
        .where('userId', '==', user.uid)
        .orderBy('createdAt', 'desc')
        .get();

      const journalEntries = entriesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          text: data.text || '',
          createdAt: safeToISOString(data.createdAt),
          promptUsed: data.promptUsed || null,
          reflectionUsed: data.reflectionUsed || null,
          tags: data.tags || [],
          attachmentNames: data.attachments?.map((a: any) => a.name) || [],
        };
      });

      const manifestDoc = await firestore().collection('manifests').doc(user.uid).get();
      const manifests = [];
      if (manifestDoc.exists()) {
        const data = manifestDoc.data();
        if (data) {
          manifests.push({
            id: manifestDoc.id,
            want: data.want || '',
            imagine: data.imagine || '',
            snags: data.snags || '',
            // The WISH doc stores this as `how` (Goals reads and writes `how`).
            // The old export read `howTo`, which never exists, so How always came out blank.
            how: data.how || '',
            progress: data.progress || 0,
            createdAt: safeToISOString(data.createdAt),
            updatedAt: safeToISOString(data.updatedAt),
          });
        }
      }

      const exportData = {
        exportInfo: {
          exportDate: new Date().toISOString(),
          userEmail: user.email,
          appVersion: APP_VERSION,
          platform: Platform.OS,
        },
        statistics: {
          totalJournalEntries: journalEntries.length,
          totalManifests: manifests.length,
          firstEntryDate: journalEntries.length > 0 ? journalEntries[journalEntries.length - 1].createdAt : null,
          mostRecentEntryDate: journalEntries.length > 0 ? journalEntries[0].createdAt : null,
        },
        journalEntries,
        manifests,
      };

      const readableExport = generateReadableExport(exportData);

      const fileName = `Castalia_Export_${new Date().toISOString().split('T')[0]}.txt`;
      const cacheDir = ReactNativeBlobUtil.fs.dirs.CacheDir;
      const filePath = `${cacheDir}/${fileName}`;

      await ReactNativeBlobUtil.fs.writeFile(filePath, readableExport, 'utf8');

      // iOS attaches the file to the share sheet. Android's share sheet can't carry a file
      // from here, so on Android the file is saved to Downloads/InkWell (Android 10+), and
      // older phones share the full text instead of the old 500-character preview.
      let where = '';
      if (Platform.OS === 'ios') {
        await Share.share({title: 'Castalia Journal Export', url: filePath});
      } else if (await saveToAndroidDownloads(fileName, filePath, 'text/plain')) {
        where = `\n\nSaved to your Downloads folder, in Castalia, as ${fileName}.`;
      } else {
        await Share.share({title: 'Castalia Journal Export', message: readableExport});
      }

      const counts = `Exported ${plural(journalEntries.length, 'entry', 'entries')} and ${plural(
        manifests.length,
        'goal',
        'goals',
      )}.`;
      Alert.alert('Export ready', counts + where, [
        {text: 'Done', style: 'default'},
        {
          text: 'Also as JSON',
          onPress: async () => {
            try {
              const jsonFileName = `Castalia_Export_${new Date().toISOString().split('T')[0]}.json`;
              const jsonPath = `${cacheDir}/${jsonFileName}`;
              const json = JSON.stringify(exportData, null, 2);
              await ReactNativeBlobUtil.fs.writeFile(jsonPath, json, 'utf8');
              if (Platform.OS === 'ios') {
                await Share.share({title: 'Castalia Journal Export (JSON)', url: jsonPath});
              } else if (await saveToAndroidDownloads(jsonFileName, jsonPath, 'application/json')) {
                Alert.alert('Saved', `Saved to your Downloads folder, in Castalia, as ${jsonFileName}.`);
              } else {
                await Share.share({title: 'Castalia Journal Export (JSON)', message: json});
              }
            } catch (e) {
              console.error('JSON export failed:', e);
              Alert.alert('JSON export did not finish', 'Please try again.');
            }
          },
        },
      ]);
    } catch (error) {
      console.error('Error exporting data:', error);
      Alert.alert('Export did not finish', 'Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const generateReadableExport = (data: any): string => {
    let text = '═══════════════════════════════════════════\n';
    text += '          CASTALIA JOURNAL EXPORT\n';
    text += '═══════════════════════════════════════════\n\n';
    text += `Export Date: ${new Date().toLocaleDateString()}\n`;
    text += `Account: ${data.exportInfo.userEmail}\n\n`;

    text += '───────────────────────────────────────────\n';
    text += '                 STATISTICS\n';
    text += '───────────────────────────────────────────\n';
    text += `Total Entries: ${data.statistics.totalJournalEntries}\n`;
    text += `Total Goals: ${data.statistics.totalManifests}\n`;
    if (data.statistics.firstEntryDate) {
      text += `First Entry: ${new Date(data.statistics.firstEntryDate).toLocaleDateString()}\n`;
    }
    if (data.statistics.mostRecentEntryDate) {
      text += `Most Recent: ${new Date(data.statistics.mostRecentEntryDate).toLocaleDateString()}\n`;
    }
    text += '\n';

    text += '═══════════════════════════════════════════\n';
    text += '                  ENTRIES\n';
    text += '═══════════════════════════════════════════\n\n';

    data.journalEntries.forEach((entry: any, index: number) => {
      const date = entry.createdAt
        ? new Date(entry.createdAt).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : 'Unknown date';

      text += '───────────────────────────────────────────\n';
      text += `Entry ${index + 1}, ${date}\n`;
      text += '───────────────────────────────────────────\n';

      if (entry.promptUsed) {
        text += `\nPrompt: ${entry.promptUsed}\n`;
      }

      text += `\n${entry.text}\n`;

      if (entry.reflectionUsed) {
        text += `\nSophy's Reflection:\n${entry.reflectionUsed}\n`;
      }

      if (entry.attachmentNames?.length > 0) {
        text += `\nAttachments: ${entry.attachmentNames.join(', ')}\n`;
      }

      text += '\n';
    });

    if (data.manifests.length > 0) {
      text += '═══════════════════════════════════════════\n';
      text += '               GOALS (WISH)\n';
      text += '═══════════════════════════════════════════\n\n';

      data.manifests.forEach((manifest: any, index: number) => {
        const manifestDate = manifest.updatedAt
          ? new Date(manifest.updatedAt).toLocaleDateString()
          : manifest.createdAt
          ? new Date(manifest.createdAt).toLocaleDateString()
          : 'Unknown date';
        text += '───────────────────────────────────────────\n';
        text += `Goal ${index + 1}, ${manifestDate}\n`;
        text += '───────────────────────────────────────────\n';
        text += `Want: ${manifest.want}\n`;
        text += `Imagine: ${manifest.imagine}\n`;
        text += `Snags: ${manifest.snags}\n`;
        text += `How: ${manifest.how}\n\n`;
      });
    }

    text += '═══════════════════════════════════════════\n';
    text += '        Thank you for using Castalia\n';
    text += '═══════════════════════════════════════════\n';

    return text;
  };

  // ==================== Account lifecycle ====================
  const handleRequestAccountDeletion = async () => {
    if (!user) return;
    setDeletingAccount(true);
    try {
      const deletionDate = new Date();
      const scheduledDeletion = new Date(deletionDate);
      scheduledDeletion.setDate(scheduledDeletion.getDate() + 30);

      await firestore().collection('users').doc(user.uid).set(
        {
          deletionRequested: firestore.FieldValue.serverTimestamp(),
          deletionScheduledFor: firestore.Timestamp.fromDate(scheduledDeletion),
        },
        {merge: true},
      );

      setDeleteModalVisible(false);

      const signOut = async () => {
        try {
          await auth().signOut();
        } catch (e) {
          console.error('Sign out after deletion request failed:', e);
        }
      };

      // Sign out right away, not on OK: if the app closed with this notice up, the next
      // launch would see a signed-in person and cancel the deletion they just asked for.
      Alert.alert(
        'Deletion scheduled',
        `Your account and everything in it, including photos and files, will be deleted on ${scheduledDeletion.toLocaleDateString()}. Sign in again before then to cancel.`,
        [{text: 'OK'}],
      );
      await signOut();
    } catch (error) {
      console.error('Error requesting account deletion:', error);
      Alert.alert('Not scheduled', 'Your account deletion did not go through. Please try again.');
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign out?', 'You can sign back in any time.', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Sign out',
        onPress: async () => {
          try {
            await auth().signOut();
          } catch (error) {
            console.error('Sign out error:', error);
            Alert.alert('Not signed out', 'Please try again.');
          }
        },
      },
    ]);
  };

  const themeOptions: Array<{mode: ThemeMode; label: string}> = [
    {mode: 'light', label: 'Light'},
    {mode: 'dark', label: 'Dark'},
    {mode: 'reading', label: 'Reading'},
    {mode: 'system', label: 'System'},
  ];

  const themeHint =
    themeMode === 'system'
      ? `Following your phone, ${isDark ? 'dark' : 'light'} right now.`
      : themeMode === 'reading'
      ? 'Warm paper, easy on the eyes.'
      : themeMode === 'dark'
      ? 'Dark, always.'
      : 'Light, always.';

  const showSmsSave = smsEnabled || smsEnabled !== smsEnabledStored;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <IdentityBar refreshTrigger={dotsRefresh} />
      <ScrollView
        style={styles.container}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}>
        <View style={[styles.inner, iPadContentStyle(screenWidth)]}>
          <ScreenTitle containerStyle={styles.titleWrap}>You</ScreenTitle>

          {/* ==================== 1. YOUR LOOK ==================== */}
          <Card>
            <Eyebrow style={styles.cardEyebrow}>Your look</Eyebrow>
            <View style={styles.pillRow}>
              {themeOptions.map(opt => (
                <Pill
                  key={opt.mode}
                  label={opt.label}
                  active={themeMode === opt.mode}
                  onPress={() => setThemeMode(opt.mode)}
                />
              ))}
            </View>
            <Text style={styles.helper}>{themeHint}</Text>
          </Card>

          {/* ==================== 2. SOPHY ==================== */}
          <View style={styles.section}>
            <Eyebrow sophy style={styles.eyebrow}>
              Sophy
            </Eyebrow>
            <View style={styles.block}>
              <Text style={styles.blockTitle}>What should Sophy call you?</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder="Your name (optional)"
                  placeholderTextColor={colors.fontMuted}
                  value={profileName}
                  onChangeText={setProfileName}
                  onSubmitEditing={saveProfile}
                  returnKeyType="done"
                  autoCapitalize="words"
                  accessibilityLabel="What should Sophy call you?"
                />
                <IWButton voice="gray" title="Save" onPress={saveProfile} loading={savingProfile} />
              </View>
              {profileStatus ? <Text style={styles.status}>{profileStatus}</Text> : null}
            </View>
          </View>

          {/* ==================== 3. REMINDERS AND EMAILS ==================== */}
          <View style={styles.section}>
            <Eyebrow style={styles.eyebrow}>Reminders and emails</Eyebrow>

            {/* Push: free for everyone */}
            <Row
              title="Notifications"
              subtitle="Prompts and reminders on this phone."
              right={
                <Switch
                  value={pushEnabled}
                  onValueChange={handlePushToggle}
                  accessibilityLabel="Notifications"
                  {...switchColors(pushEnabled)}
                />
              }
            />
            {pushEnabled && (
              <>
                <Row
                  nested
                  title="Daily journal prompts"
                  right={
                    <Switch
                      value={pushDailyPrompts}
                      onValueChange={setPushDailyPrompts}
                      accessibilityLabel="Daily journal prompts"
                      {...switchColors(pushDailyPrompts)}
                    />
                  }
                />
                {isPremium ? (
                  <>
                    <Row
                      nested
                      title="Goal milestones"
                      right={
                        <Switch
                          value={pushWishMilestones}
                          onValueChange={setPushWishMilestones}
                          accessibilityLabel="Goal milestones"
                          {...switchColors(pushWishMilestones)}
                        />
                      }
                    />
                    <Row
                      nested
                      title="Daily gratitude from Sophy"
                      right={
                        <Switch
                          value={pushGratitudePrompts}
                          onValueChange={setPushGratitudePrompts}
                          accessibilityLabel="Daily gratitude from Sophy"
                          {...switchColors(pushGratitudePrompts)}
                        />
                      }
                    />
                    <Row
                      nested
                      title="Weekly insights"
                      right={
                        <Switch
                          value={pushWeeklyInsights}
                          onValueChange={setPushWeeklyInsights}
                          accessibilityLabel="Weekly insights"
                          {...switchColors(pushWeeklyInsights)}
                        />
                      }
                    />
                  </>
                ) : (
                  <Row
                    nested
                    title="More reminder types"
                    subtitle="Plus adds goal milestones, daily gratitude from Sophy, and weekly insights."
                    chevron
                    onPress={openPaywall}
                  />
                )}
                <View style={styles.nestedAction}>
                  <IWButton
                    voice="gray"
                    title="Save notification settings"
                    onPress={() => savePushPreferences()}
                    loading={savingPush}
                  />
                </View>
              </>
            )}
            {pushPermissionStatus === 'denied' && (
              <Row
                nested
                title="Open phone settings"
                subtitle="Your phone is blocking Castalia notifications."
                chevron
                onPress={() => notificationService.openSettings()}
              />
            )}
            {pushStatus ? <Text style={styles.status}>{pushStatus}</Text> : null}

            {/* SMS: Plus */}
            {!isPremium ? (
              <Row
                title="Text messages"
                subtitle="Plus adds prompts, gratitude, and goal reminders by text."
                chevron
                onPress={() => checkFeatureAndShowPaywall('sms')}
              />
            ) : (
              <>
                <Row
                  title="Text messages"
                  subtitle="Reminders and insights from Castalia by text."
                  right={
                    <Switch
                      value={smsEnabled}
                      onValueChange={setSmsEnabled}
                      accessibilityLabel="Text messages"
                      {...switchColors(smsEnabled)}
                    />
                  }
                />
                {smsEnabled && (
                  <View style={styles.nestedBlock}>
                    <Text style={styles.fieldLabel}>Phone number</Text>
                    <View style={styles.inputRow}>
                      <View style={styles.countryCodePicker}>
                        <Picker
                          selectedValue={countryCode}
                          onValueChange={value => setCountryCode(value)}
                          style={[styles.picker, {color: colors.fontMain}]}
                          itemStyle={{color: colors.fontMain}}>
                          {COUNTRY_CODES.map(c => (
                            <Picker.Item
                              key={c.code}
                              label={`${c.country} ${c.code}`}
                              value={c.code}
                              color={colors.fontMain}
                            />
                          ))}
                        </Picker>
                      </View>
                      <TextInput
                        style={styles.input}
                        placeholder="(555) 123-4567"
                        placeholderTextColor={colors.fontMuted}
                        value={localPhoneNumber}
                        onChangeText={handlePhoneChange}
                        keyboardType="phone-pad"
                        autoCapitalize="none"
                        accessibilityLabel="Phone number"
                      />
                    </View>
                    <Text style={styles.helper}>Pick your country code, then enter your number.</Text>

                    <Text style={styles.fieldLabel}>Time zone</Text>
                    <Picker
                      selectedValue={selectedTimezone}
                      onValueChange={value => setSelectedTimezone(value)}
                      style={[styles.picker, {color: colors.fontMain}]}
                      itemStyle={{color: colors.fontMain}}>
                      {TIMEZONES.map(tz => (
                        <Picker.Item key={tz.value} label={tz.label} value={tz.value} color={colors.fontMain} />
                      ))}
                    </Picker>
                  </View>
                )}
                {smsEnabled && (
                  <>
                    <Row
                      nested
                      title="Goal milestones"
                      right={
                        <Switch
                          value={smsWishMilestones}
                          onValueChange={setSmsWishMilestones}
                          accessibilityLabel="Goal milestones by text"
                          {...switchColors(smsWishMilestones)}
                        />
                      }
                    />
                    <Row
                      nested
                      title="Daily journal prompts"
                      right={
                        <Switch
                          value={smsDailyPrompts}
                          onValueChange={setSmsDailyPrompts}
                          accessibilityLabel="Daily journal prompts by text"
                          {...switchColors(smsDailyPrompts)}
                        />
                      }
                    />
                    <Row
                      nested
                      title="Daily gratitude from Sophy"
                      right={
                        <Switch
                          value={smsGratitudePrompts}
                          onValueChange={setSmsGratitudePrompts}
                          accessibilityLabel="Daily gratitude from Sophy by text"
                          {...switchColors(smsGratitudePrompts)}
                        />
                      }
                    />
                    <Row
                      nested
                      title="Weekly insights"
                      right={
                        <Switch
                          value={smsWeeklyInsights}
                          onValueChange={setSmsWeeklyInsights}
                          accessibilityLabel="Weekly insights by text"
                          {...switchColors(smsWeeklyInsights)}
                        />
                      }
                    />
                  </>
                )}
                {showSmsSave && (
                  <View style={styles.nestedAction}>
                    <IWButton
                      voice="gray"
                      title="Save text message settings"
                      onPress={saveSmsPreferences}
                      loading={savingSms}
                    />
                  </View>
                )}
                {smsStatus ? <Text style={styles.status}>{smsStatus}</Text> : null}
              </>
            )}

            {/* Email insights: Plus */}
            {!isPremium ? (
              <Row
                title="Email insights from Sophy"
                subtitle="Plus adds a weekly and monthly read of your patterns, by email."
                chevron
                onPress={() => checkFeatureAndShowPaywall('ai')}
              />
            ) : (
              <>
                <Row
                  title="Weekly insights email"
                  subtitle="Every Monday morning"
                  right={
                    <Switch
                      value={weeklyInsightsEnabled}
                      onValueChange={value => {
                        setWeeklyInsightsEnabled(value);
                        saveInsightsPreferences(value, monthlyInsightsEnabled);
                      }}
                      disabled={savingInsights}
                      accessibilityLabel="Weekly insights email"
                      {...switchColors(weeklyInsightsEnabled)}
                    />
                  }
                />
                <Row
                  title="Monthly insights email"
                  subtitle="First of every month"
                  right={
                    <Switch
                      value={monthlyInsightsEnabled}
                      onValueChange={value => {
                        setMonthlyInsightsEnabled(value);
                        saveInsightsPreferences(weeklyInsightsEnabled, value);
                      }}
                      disabled={savingInsights}
                      accessibilityLabel="Monthly insights email"
                      {...switchColors(monthlyInsightsEnabled)}
                    />
                  }
                />
              </>
            )}
          </View>

          {/* ==================== 4. PRACTICE SUMMARY (free) ==================== */}
          <View style={styles.section}>
            <Eyebrow style={styles.eyebrow}>Practice Summary</Eyebrow>
            <View style={styles.block}>
              <Text style={styles.body}>
                A one-page summary of how you have been using Castalia: days journaled, streaks, and your practice
                mix. It never includes what you wrote. We email it to you, and only you. Some people forward it to
                a therapist, coach, or doctor they work with. That part is always your call.
              </Text>
              <View style={styles.pillRow}>
                {SUMMARY_DAY_OPTIONS.map(d => (
                  <Pill
                    key={d}
                    label={`Last ${d} days`}
                    active={summaryDays === d}
                    onPress={() => setSummaryDays(d)}
                  />
                ))}
              </View>
              <IWButton
                title="Email me my summary"
                onPress={handleSendPracticeSummary}
                loading={sendingSummary}
                style={styles.blockAction}
              />
              {summaryStatus ? <Text style={styles.status}>{summaryStatus}</Text> : null}
            </View>
          </View>

          {/* ==================== 5. YOUR WORDS ====================
              LAW: every privacy line must stay architecturally true. Never say HIPAA. */}
          <View style={styles.section}>
            <Eyebrow style={styles.eyebrow}>Your words</Eyebrow>
            <View style={styles.block}>
              <Text style={styles.privacyLine}>
                Your entries are encrypted in transit and at rest. No other user can ever see them.
              </Text>
              <Text style={styles.privacyLine}>
                Nothing you write is sold, shared with advertisers, or used to train AI models.
              </Text>
              <Text style={styles.privacyLine}>
                Sophy reads an entry only when you ask her to, or when you turn on her insights above. Her AI
                providers process it to respond and do not keep it to train on.
              </Text>
              <Text style={styles.privacyLine}>
                We keep a few dates, like when you last opened the app, and crash reports so we can fix what breaks. We never measure your words.
              </Text>
              <Text style={styles.privacyLine}>
                Delete your account and your words are permanently gone within 30 days.
              </Text>
              <Text style={styles.privacyFootnote}>
                Like any company, we must answer valid legal process; we keep what we store minimal. Full details
                in the{' '}
                <Text
                  style={styles.link}
                  accessibilityRole="link"
                  onPress={() => Linking.openURL('https://pegasusrealm.com/privacy-policy/')}>
                  Privacy Policy
                </Text>
                . Castalia is a wellness journal, not a medical record.
              </Text>
            </View>
            <Row
              title="Export your journal"
              subtitle="Your entries, goals, and Sophy's reflections, as text or JSON."
              onPress={handleExportData}
              disabled={exporting}
              right={exporting ? <ActivityIndicator size="small" color={colors.brandPrimary} /> : undefined}
              chevron={!exporting}
            />
            <Row
              title="Show past entries on Today"
              subtitle="Today can bring back something you wrote a while ago."
              right={
                <Switch
                  value={showMemories}
                  onValueChange={handleShowMemoriesToggle}
                  accessibilityLabel="Show past entries on Today"
                  {...switchColors(showMemories)}
                />
              }
            />
            <Row title="Delete account" subtitle={DELETE_COPY} danger onPress={() => setDeleteModalVisible(true)} />
          </View>

          {/* ==================== 6. CASTALIA PLUS ==================== */}
          <View style={styles.section}>
            <Eyebrow style={styles.eyebrow}>Castalia Plus</Eyebrow>
            <Row
              title="Your plan"
              subtitle={isPremium && isActive ? 'Active' : undefined}
              right={
                subscriptionLoading ? (
                  <ActivityIndicator size="small" color={colors.brandPrimary} />
                ) : (
                  <View style={[styles.planBadge, isPremium && styles.planBadgePlus]}>
                    {/* Legacy 'connect' subscribers count as Plus (isPremium) */}
                    <Text style={[styles.planBadgeText, isPremium && styles.planBadgeTextPlus]}>
                      {isPremium ? 'Plus' : 'Free'}
                    </Text>
                  </View>
                )
              }
            />
            {isPremium ? (
              <Row
                title="Manage subscription"
                subtitle={Platform.OS === 'ios' ? 'Opens your App Store subscriptions.' : 'Opens your Google Play subscriptions.'}
                chevron
                onPress={handleManageSubscription}
              />
            ) : (
              <Row
                title="See what Plus adds"
                subtitle="Already subscribed? You can restore it there too."
                chevron
                onPress={openPaywall}
              />
            )}
          </View>

          {/* ==================== 7. HELP RIGHT NOW (always visible, quiet) ==================== */}
          <View style={styles.section}>
            <Eyebrow style={styles.eyebrow}>Help right now</Eyebrow>
            <View style={styles.block}>
              <Text style={styles.body}>
                If things feel like too much: call or text 988. Veterans: dial 988, then press 1.
              </Text>
              <View style={styles.linkRow}>
                <Pressable
                  onPress={() => Linking.openURL('tel:988')}
                  accessibilityRole="button"
                  hitSlop={8}
                  style={styles.linkHit}>
                  <Text style={styles.linkAction}>Call 988</Text>
                </Pressable>
                <Pressable
                  onPress={() => Linking.openURL('sms:988')}
                  accessibilityRole="button"
                  hitSlop={8}
                  style={styles.linkHit}>
                  <Text style={styles.linkAction}>Text 988</Text>
                </Pressable>
              </View>
              <Text style={styles.helper}>Outside the US, your local emergency number can help.</Text>
            </View>
          </View>

          {/* ==================== 8. HELP AND ABOUT ==================== */}
          <View style={styles.section}>
            <Eyebrow style={styles.eyebrow}>Help and About</Eyebrow>
            <Row
              title="How Castalia works"
              subtitle="The tabs, Sophy, privacy, and how to reach us."
              chevron
              onPress={() => navigation.navigate('Info')}
            />
            <Row title="Show the tips again" chevron onPress={handleResetFirstSteps} />
            <Row title="Version" right={<Text style={styles.value}>{APP_VERSION}</Text>} />
          </View>

          {/* ==================== 9. SIGN OUT ==================== */}
          <View style={styles.section}>
            {user?.email ? <Text style={styles.signedInAs}>Signed in as {user.email}</Text> : null}
            <IWButton voice="gray" title="Sign out" onPress={handleSignOut} />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Castalia by Pegasus Realm</Text>
            <Text style={styles.footerText}>© 2026 All rights reserved</Text>
          </View>
        </View>
      </ScrollView>

      <PaywallModal visible={showPaywall} onClose={closePaywall} />

      {/* Delete account confirmation */}
      <Modal
        visible={deleteModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setDeleteModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Delete your account?</Text>
              <Pressable
                onPress={() => setDeleteModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={12}>
                <CloseIcon color={colors.fontMuted} size={20} />
              </Pressable>
            </View>
            <Text style={styles.modalBody}>{DELETE_COPY}</Text>
            <View style={styles.modalActions}>
              <IWButton
                voice="gray"
                title="Keep my account"
                onPress={() => setDeleteModalVisible(false)}
                style={styles.modalButton}
              />
              <IWButton
                voice="danger"
                title="Delete account"
                onPress={handleRequestAccountDeletion}
                loading={deletingAccount}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// Dynamic styles based on theme colors
const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    scrollContent: {
      flexGrow: 1,
      paddingBottom: spacing.xxxl,
    },
    inner: {
      paddingHorizontal: spacing.lg,
    },
    titleWrap: {
      paddingTop: spacing.lg,
    },

    // Sections
    section: {
      marginTop: 32,
    },
    eyebrow: {
      fontSize: 13,
      marginBottom: spacing.md,
    },
    cardEyebrow: {
      fontSize: 13,
      marginBottom: spacing.base,
    },
    block: {
      paddingBottom: spacing.base,
    },
    blockTitle: {
      fontFamily: fontFamily.button,
      fontSize: 16,
      lineHeight: 22,
      color: colors.fontMain,
      marginBottom: spacing.sm,
    },
    blockAction: {
      marginTop: spacing.base,
      alignSelf: 'flex-start',
    },
    nestedBlock: {
      marginLeft: spacing.base,
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    nestedAction: {
      marginLeft: spacing.base,
      paddingVertical: spacing.md,
      alignItems: 'flex-start',
    },

    // Text
    body: {
      fontFamily: fontFamily.body,
      fontSize: 16,
      lineHeight: 24,
      color: colors.fontSecondary,
    },
    helper: {
      fontFamily: fontFamily.body,
      fontSize: 15,
      lineHeight: 21,
      color: colors.fontMuted,
      marginTop: spacing.sm,
    },
    status: {
      fontFamily: fontFamily.body,
      fontSize: 15,
      lineHeight: 21,
      color: colors.brandPrimary,
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    fieldLabel: {
      fontFamily: fontFamily.button,
      fontSize: 15,
      color: colors.fontSecondary,
      marginBottom: spacing.xs,
      marginTop: spacing.sm,
    },
    value: {
      fontFamily: fontFamily.body,
      fontSize: 15,
      color: colors.fontMuted,
    },
    link: {
      fontFamily: fontFamily.button,
      color: colors.brandPrimary,
      textDecorationLine: 'underline',
    },

    // Pills
    pillRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.md,
    },

    // Inputs
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    input: {
      flex: 1,
      fontFamily: fontFamily.serif,
      fontSize: 17,
      color: colors.fontMain,
      backgroundColor: colors.bgCard,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.borderMedium,
      paddingHorizontal: spacing.md,
      paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    },
    countryCodePicker: {
      width: 150,
      borderWidth: 1,
      borderColor: colors.borderMedium,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.bgCard,
      overflow: 'hidden',
    },
    picker: {
      backgroundColor: colors.bgCard,
    },

    // Your words
    privacyLine: {
      fontFamily: fontFamily.body,
      fontSize: 16,
      lineHeight: 24,
      color: colors.fontSecondary,
      marginBottom: spacing.md,
    },
    privacyFootnote: {
      fontFamily: fontFamily.body,
      fontSize: 15,
      lineHeight: 22,
      color: colors.fontMuted,
    },

    // Plan badge (teal, never coral: coral is Sophy's)
    planBadge: {
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: colors.borderMedium,
      paddingVertical: 4,
      paddingHorizontal: 12,
    },
    planBadgePlus: {
      backgroundColor: colors.btnPrimary,
      borderColor: colors.btnPrimary,
    },
    planBadgeText: {
      fontFamily: fontFamily.bodyBold,
      fontSize: 13,
      letterSpacing: 0.6,
      color: colors.fontSecondary,
    },
    planBadgeTextPlus: {
      color: colors.fontWhite,
    },

    // Help right now
    linkRow: {
      flexDirection: 'row',
      gap: spacing.xl,
      marginTop: spacing.sm,
    },
    linkHit: {
      minHeight: 44,
      justifyContent: 'center',
    },
    linkAction: {
      fontFamily: fontFamily.button,
      fontSize: 16,
      color: colors.brandPrimary,
    },

    // Sign out
    signedInAs: {
      fontFamily: fontFamily.body,
      fontSize: 15,
      color: colors.fontMuted,
      marginBottom: spacing.md,
    },

    // Footer
    footer: {
      paddingTop: spacing.xxl,
      alignItems: 'center',
    },
    footerText: {
      fontFamily: fontFamily.body,
      fontSize: 13,
      color: colors.fontMuted,
      marginVertical: 2,
    },

    // Delete modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    modalContainer: {
      backgroundColor: colors.bgCard,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderLight,
      padding: spacing.lg,
      maxWidth: 480,
      width: '100%',
      alignSelf: 'center',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    modalTitle: {
      flex: 1,
      fontFamily: fontFamily.header,
      fontSize: 22,
      lineHeight: 28,
      color: colors.fontMain,
    },
    modalBody: {
      fontFamily: fontFamily.body,
      fontSize: 16,
      lineHeight: 24,
      color: colors.fontSecondary,
    },
    modalActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      gap: spacing.sm,
      marginTop: spacing.xl,
    },
    modalButton: {
      minWidth: 120,
    },
  });
