/**
 * SettingsScreen — v2 rebuild (M2, 2026-07-04)
 * Structure: v2 kit (Card/IWButton/Eyebrow/Pill), web settings parity.
 * Copy: web/public/app.html voice pass, verbatim where ported.
 * LAWS: teal structure / no emojis in chrome / Reading is opt-in only /
 * Your Words card stays architecturally true, never says HIPAA /
 * Practice Summary is FREE tier, never gated.
 * Connect is dead — coaches section, invite modal, and coach-reply
 * notification rows removed (2026-07-04). Stored coachReplies pref values
 * pass through untouched (no data loss, no service-file edits).
 */
import React, {useState, useEffect, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
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
import ReactNativeBlobUtil from 'react-native-blob-util';
import {Picker} from '@react-native-picker/picker';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {spacing, borderRadius, fontFamily, fontSize} from '../theme';
import {useTheme, ThemeColors} from '../theme/ThemeContext';
import type {ThemeMode} from '../theme';
import type {RootStackScreenProps} from '../navigation/types';
import {iPadContentStyle, getKeyboardVerticalOffset} from '../utils/iPad';
import {useSubscription} from '../hooks/useSubscription';
import {useOnboarding} from '../hooks/useOnboarding';
import PaywallModal from '../components/PaywallModal';
import notificationService, {PushNotificationPreferences} from '../services/notificationService';
import {FirstStepsService} from '../services/firstStepsService';
import {APP_VERSION} from '../version';
import {Card, IWButton, Pill, Eyebrow, Divider} from '../components/kit';

// App version comes from the single source of truth (src/version.ts — M3 sync)

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

export default function SettingsScreen({
  navigation,
}: RootStackScreenProps<'Settings'>) {
  const user = auth().currentUser;
  const {colors, themeMode, setThemeMode, isDark} = useTheme();
  const {width: screenWidth} = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);

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
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [crisisExpanded, setCrisisExpanded] = useState(false);

  // SMS notifications
  const [countryCode, setCountryCode] = useState('+1');
  const [localPhoneNumber, setLocalPhoneNumber] = useState('');
  const [, setPhoneNumber] = useState('');
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [smsWishMilestones, setSmsWishMilestones] = useState(true);
  const [smsDailyPrompts, setSmsDailyPrompts] = useState(false);
  const [smsGratitudePrompts, setSmsGratitudePrompts] = useState(false);
  // Connect retired — no UI row, but the stored value passes through saves untouched
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
  // Connect retired — stored value passes through untouched
  const [pushCoachReplies, setPushCoachReplies] = useState(true);
  const [pushWeeklyInsights, setPushWeeklyInsights] = useState(false);
  const [savingPush, setSavingPush] = useState(false);
  const [pushStatus, setPushStatus] = useState('');

  // Export
  const [exporting, setExporting] = useState(false);

  // Practice Summary (free tier by law)
  const [summaryDays, setSummaryDays] = useState<number>(30);
  const [sendingSummary, setSendingSummary] = useState(false);
  const [summaryStatus, setSummaryStatus] = useState('');

  const {
    tier: subscriptionTier,
    isActive,
    isPremium,
    loading: subscriptionLoading,
    openPaywall: initAndOpenPaywall,
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

  // Repointed 2026-07-04: resets the FirstSteps quest (the old welcome-tip
  // system is retired — event-driven onboarding replaced it)
  const handleResetFirstSteps = () => {
    Alert.alert(
      'Reset First Steps',
      'This will bring back the first-steps guide and its hints, starting from the top.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Reset',
          onPress: async () => {
            await resetOnboarding(); // legacy tip flags cleared too
            FirstStepsService.reset();
            Alert.alert('Done', 'First steps will be waiting on your Journal tab.');
          },
        },
      ],
    );
  };

  const handleUpgradePress = async () => {
    try {
      if (initAndOpenPaywall) {
        await initAndOpenPaywall();
      }
      setPaywallVisible(true);
    } catch (error) {
      console.error('Error opening paywall:', error);
      Alert.alert('Error', 'Unable to load subscription options. Please try again.');
    }
  };

  useEffect(() => {
    loadProfile();
    loadInsightsPreferences();
    loadSmsPreferences();
    loadPushPreferences();
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
      Alert.alert('Error', 'Failed to save preferences. Please try again.');
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
      Alert.alert('Invalid Phone Number', 'Please enter a valid phone number (at least 6 digits)');
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
            coachReplies: smsCoachReplies, // passthrough, no UI (Connect retired)
            weeklyInsights: smsWeeklyInsights,
            updatedAt: firestore.FieldValue.serverTimestamp(),
          },
        },
        {merge: true},
      );

      setPhoneNumber(fullPhoneNumber);
      flashStatus(setSmsStatus, 'Saved.');
    } catch (error) {
      console.error('Error saving SMS preferences:', error);
      Alert.alert('Error', 'Failed to save SMS preferences. Please try again.');
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
        flashStatus(setPushStatus, 'Push notifications enabled.');
      } else if (tokenResult.permissionStatus === 'DENIED') {
        setPushEnabled(false);
        setPushPermissionStatus('denied');
        Alert.alert(
          'Permission Required',
          'Push notifications are disabled in your device settings. Would you like to open Settings to enable them?',
          [
            {text: 'Not Now', style: 'cancel'},
            {text: 'Open Settings', onPress: () => notificationService.openSettings()},
          ],
        );
      } else {
        setPushEnabled(false);
        Alert.alert(
          'Push Notification Error',
          `Could not enable push notifications.\n\nError: ${tokenResult.error || 'Unknown error'}`,
        );
      }
    } else {
      setPushEnabled(false);
      await savePushPreferences(false, true);
      flashStatus(setPushStatus, 'Push notifications disabled.');
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
        coachReplies: pushCoachReplies, // passthrough, no UI (Connect retired)
        weeklyInsights: pushWeeklyInsights,
      };

      const success = await notificationService.savePreferences(user.uid, prefs);
      if (!skipStatus) {
        if (success) {
          flashStatus(setPushStatus, 'Saved.');
        } else {
          Alert.alert('Error', 'Failed to save preferences. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error saving push preferences:', error);
      if (!skipStatus) {
        Alert.alert('Error', 'Failed to save preferences. Please try again.');
      }
    } finally {
      setSavingPush(false);
    }
  };

  // ==================== Practice Summary (free tier by law) ====================
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

  // ==================== Export ====================
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
    if (!user) return;

    if (!isPremium) {
      Alert.alert(
        'Plus Feature',
        'Exporting your journal data is a Plus feature.',
        [
          {text: 'Maybe Later', style: 'cancel'},
          {text: 'See Plus', onPress: handleUpgradePress},
        ],
      );
      return;
    }

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
            howTo: data.howTo || '',
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

      const fileName = `InkWell_Export_${new Date().toISOString().split('T')[0]}.txt`;
      const cacheDir = ReactNativeBlobUtil.fs.dirs.CacheDir;
      const filePath = `${cacheDir}/${fileName}`;

      await ReactNativeBlobUtil.fs.writeFile(filePath, readableExport, 'utf8');

      await Share.share({
        title: 'InkWell Journal Export',
        message: readableExport.substring(0, 500) + '...\n\n[Full export attached]',
        url: Platform.OS === 'ios' ? filePath : `file://${filePath}`,
      });

      Alert.alert(
        'Export Complete',
        `Exported ${journalEntries.length} journal entries and ${manifests.length} manifests.`,
        [
          {text: 'Done', style: 'default'},
          {
            text: 'Export as JSON',
            onPress: async () => {
              const jsonFileName = `InkWell_Export_${new Date().toISOString().split('T')[0]}.json`;
              const jsonPath = `${cacheDir}/${jsonFileName}`;
              await ReactNativeBlobUtil.fs.writeFile(jsonPath, JSON.stringify(exportData, null, 2), 'utf8');
              await Share.share({
                title: 'InkWell Journal Export (JSON)',
                url: Platform.OS === 'ios' ? jsonPath : `file://${jsonPath}`,
              });
            },
          },
        ],
      );
    } catch (error) {
      console.error('Error exporting data:', error);
      Alert.alert('Export Failed', 'Unable to export your data. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const generateReadableExport = (data: any): string => {
    let text = '═══════════════════════════════════════════\n';
    text += '           INKWELL JOURNAL EXPORT\n';
    text += '═══════════════════════════════════════════\n\n';
    text += `Export Date: ${new Date().toLocaleDateString()}\n`;
    text += `Account: ${data.exportInfo.userEmail}\n\n`;

    text += '───────────────────────────────────────────\n';
    text += '                 STATISTICS\n';
    text += '───────────────────────────────────────────\n';
    text += `Total Journal Entries: ${data.statistics.totalJournalEntries}\n`;
    text += `Total Manifests: ${data.statistics.totalManifests}\n`;
    if (data.statistics.firstEntryDate) {
      text += `First Entry: ${new Date(data.statistics.firstEntryDate).toLocaleDateString()}\n`;
    }
    if (data.statistics.mostRecentEntryDate) {
      text += `Most Recent: ${new Date(data.statistics.mostRecentEntryDate).toLocaleDateString()}\n`;
    }
    text += '\n';

    text += '═══════════════════════════════════════════\n';
    text += '              JOURNAL ENTRIES\n';
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
      text += `Entry ${index + 1} - ${date}\n`;
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
      text += '              WISH MANIFESTS\n';
      text += '═══════════════════════════════════════════\n\n';

      data.manifests.forEach((manifest: any, index: number) => {
        // Field names fixed 2026-07-04 (pre-existing bug: printed wish/outcome/
        // opposition/plan, but export data carries want/imagine/snags/howTo)
        const manifestDate = manifest.updatedAt
          ? new Date(manifest.updatedAt).toLocaleDateString()
          : manifest.createdAt
          ? new Date(manifest.createdAt).toLocaleDateString()
          : 'Unknown date';
        text += '───────────────────────────────────────────\n';
        text += `Manifest ${index + 1} - ${manifestDate}\n`;
        text += '───────────────────────────────────────────\n';
        text += `Want: ${manifest.want}\n`;
        text += `Imagine: ${manifest.imagine}\n`;
        text += `Snags: ${manifest.snags}\n`;
        text += `How: ${manifest.howTo}\n\n`;
      });
    }

    text += '═══════════════════════════════════════════\n';
    text += '        Thank you for using InkWell\n';
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

      Alert.alert(
        'Account Deletion Scheduled',
        `Your account will be permanently deleted on ${scheduledDeletion.toLocaleDateString()}. You can cancel this by logging in again before that date.`,
        [
          {
            text: 'OK',
            onPress: async () => {
              await auth().signOut();
            },
          },
        ],
      );
    } catch (error) {
      console.error('Error requesting account deletion:', error);
      Alert.alert('Error', 'Failed to schedule account deletion. Please try again.');
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await auth().signOut();
          } catch (error) {
            console.error('Logout error:', error);
            Alert.alert('Error', 'Failed to logout. Please try again.');
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
      ? `Currently using ${isDark ? 'dark' : 'light'} mode based on your device settings`
      : themeMode === 'reading'
      ? 'Reading mode active. Warm paper, your choice.'
      : `${themeMode === 'dark' ? 'Dark' : 'Light'} mode active`;

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoid}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={getKeyboardVerticalOffset(true)}>
      <ScrollView
        style={styles.container}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}>
        <View style={iPadContentStyle(screenWidth)}>
          {/* ==================== ACCOUNT + PROFILE ==================== */}
          <View style={styles.section}>
            <Eyebrow style={styles.sectionEyebrow}>Account</Eyebrow>
            <Card>
              <View style={styles.row}>
                <Text style={styles.label}>Email</Text>
                <Text style={styles.value}>{user?.email || 'Not signed in'}</Text>
              </View>
              <View style={styles.profileBlock}>
                <Text style={styles.inputLabel}>What should Sophy call you?</Text>
                <View style={styles.profileRow}>
                  <TextInput
                    style={styles.input}
                    placeholder="Your name (optional)"
                    placeholderTextColor={colors.fontMuted}
                    value={profileName}
                    onChangeText={setProfileName}
                    autoCapitalize="words"
                  />
                  <IWButton voice="gray" small title="Save" onPress={saveProfile} loading={savingProfile} />
                </View>
                {profileStatus ? <Text style={styles.inlineStatus}>{profileStatus}</Text> : null}
              </View>
            </Card>
          </View>

          {/* ==================== SUBSCRIPTION ==================== */}
          <View style={styles.section}>
            <Eyebrow style={styles.sectionEyebrow}>Subscription</Eyebrow>
            <Card>
              <View style={styles.subscriptionHeader}>
                <View style={styles.subscriptionInfo}>
                  <Text style={styles.label}>Current plan</Text>
                  {subscriptionLoading ? (
                    <ActivityIndicator size="small" color={colors.brandPrimary} />
                  ) : (
                    <View
                      style={[
                        styles.subscriptionBadge,
                        subscriptionTier !== 'free' && styles.subscriptionBadgePaid,
                      ]}>
                      <Text style={styles.subscriptionBadgeText}>
                        {subscriptionTier === 'free' && 'Free'}
                        {subscriptionTier === 'plus' && 'Plus'}
                        {subscriptionTier === 'connect' && 'Connect'}
                      </Text>
                    </View>
                  )}
                  {isActive && <Text style={styles.subscriptionStatusText}>Status: Active</Text>}
                </View>
                <IWButton
                  small
                  title={subscriptionTier === 'free' ? 'Upgrade' : 'Manage'}
                  onPress={handleUpgradePress}
                />
              </View>
              {subscriptionTier === 'free' && (
                <Text style={styles.subscriptionPromptText}>
                  Plus adds unlimited Sophy prompts and reflections, voice cleanup, file attachments, email
                  insights, and SMS notifications.
                </Text>
              )}
            </Card>
          </View>

          {/* ==================== APPEARANCE ==================== */}
          <View style={styles.section}>
            <Eyebrow style={styles.sectionEyebrow}>Appearance</Eyebrow>
            <Card>
              <Text style={styles.inputLabel}>Theme</Text>
              <View style={styles.themeOptions}>
                {themeOptions.map(opt => (
                  <Pill
                    key={opt.mode}
                    label={opt.label}
                    active={themeMode === opt.mode}
                    onPress={() => setThemeMode(opt.mode)}
                  />
                ))}
              </View>
              <Text style={styles.hintText}>{themeHint}</Text>
            </Card>
          </View>

          {/* ==================== YOUR WORDS (privacy promise — web verbatim) ====================
              LAW: every line must stay architecturally true. Never say HIPAA. */}
          <View style={styles.section}>
            <Eyebrow style={styles.sectionEyebrow}>Your Words</Eyebrow>
            <Card>
              <Text style={styles.privacyLine}>
                Your entries are encrypted in transit and at rest. No other user can ever see them.
              </Text>
              <Text style={styles.privacyLine}>
                Nothing you write is sold, shared with advertisers, or used to train AI models.
              </Text>
              <Text style={styles.privacyLine}>
                Sophy reads an entry only when you ask her to. Her AI providers process it to respond and do not
                keep it to train on.
              </Text>
              <Text style={styles.privacyLine}>
                We measure taps and screens to make InkWell better. We do not measure your words.
              </Text>
              <Text style={styles.privacyLine}>
                Delete your account and your words are permanently gone within 30 days.
              </Text>
              <Text style={styles.privacyFootnote}>
                Like any company, we must answer valid legal process; we keep what we store minimal. Full details
                in the{' '}
                <Text
                  style={styles.privacyLink}
                  onPress={() => Linking.openURL('https://www.inkwelljournal.io/privacy-policy/')}>
                  Privacy Policy
                </Text>
                . InkWell is a wellness journal, not a medical record.
              </Text>
            </Card>
          </View>

          {/* ==================== PRACTICE SUMMARY (FREE tier by law) ==================== */}
          <View style={styles.section}>
            <Eyebrow style={styles.sectionEyebrow}>Practice Summary</Eyebrow>
            <Card>
              <Text style={styles.cardBody}>
                A one-page summary of how you have been using InkWell: days journaled, streaks, and your practice
                mix. It never includes what you wrote. We email it to you, and only you. Some people forward it to
                a therapist, coach, or doctor they work with. That part is always your call.
              </Text>
              <View style={styles.summaryRow}>
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
                style={styles.cardAction}
              />
              {summaryStatus ? <Text style={styles.inlineStatus}>{summaryStatus}</Text> : null}
            </Card>
          </View>

          {/* ==================== EMAIL INSIGHTS (Plus) ==================== */}
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Eyebrow style={styles.sectionEyebrowInline}>Email Insights from Sophy</Eyebrow>
              {!isPremium && (
                <View style={styles.plusBadge}>
                  <Text style={styles.plusBadgeText}>Plus</Text>
                </View>
              )}
            </View>
            {!isPremium ? (
              <Card>
                <Text style={styles.cardBody}>
                  Plus adds personalized insights analyzing your journal patterns and mood trends, delivered to
                  your email.
                </Text>
                <IWButton
                  title="See Plus"
                  onPress={() => checkFeatureAndShowPaywall('ai')}
                  style={styles.cardAction}
                />
              </Card>
            ) : (
              <Card>
                <Text style={styles.cardBody}>
                  Receive personalized insights analyzing your journal patterns and mood trends.
                </Text>
                <View style={styles.switchRow}>
                  <View style={styles.switchLabel}>
                    <Text style={styles.switchTitle}>Weekly insights</Text>
                    <Text style={styles.switchDescription}>Every Monday morning</Text>
                  </View>
                  <Switch
                    value={weeklyInsightsEnabled}
                    onValueChange={value => {
                      setWeeklyInsightsEnabled(value);
                      saveInsightsPreferences(value, monthlyInsightsEnabled);
                    }}
                    trackColor={{false: colors.borderMedium, true: colors.brandAlt}}
                    thumbColor={weeklyInsightsEnabled ? colors.brandPrimary : colors.fontMuted}
                    disabled={savingInsights}
                  />
                </View>
                <View style={styles.switchRow}>
                  <View style={styles.switchLabel}>
                    <Text style={styles.switchTitle}>Monthly insights</Text>
                    <Text style={styles.switchDescription}>First of every month</Text>
                  </View>
                  <Switch
                    value={monthlyInsightsEnabled}
                    onValueChange={value => {
                      setMonthlyInsightsEnabled(value);
                      saveInsightsPreferences(weeklyInsightsEnabled, value);
                    }}
                    trackColor={{false: colors.borderMedium, true: colors.brandAlt}}
                    thumbColor={monthlyInsightsEnabled ? colors.brandPrimary : colors.fontMuted}
                    disabled={savingInsights}
                  />
                </View>
                {savingInsights && (
                  <View style={styles.savingIndicator}>
                    <ActivityIndicator size="small" color={colors.brandPrimary} />
                    <Text style={styles.hintText}>Saving...</Text>
                  </View>
                )}
              </Card>
            )}
          </View>

          {/* ==================== NOTIFICATIONS ==================== */}
          <View style={styles.section}>
            <Eyebrow style={styles.sectionEyebrow}>Notifications</Eyebrow>

            {/* Push — free for all users */}
            <Card>
              <Text style={styles.subsectionTitle}>Push notifications</Text>
              <Text style={styles.cardBody}>Receive phone notifications for prompts and reminders.</Text>

              <View style={styles.switchRow}>
                <View style={styles.switchLabel}>
                  <Text style={styles.switchTitle}>Enable push notifications</Text>
                </View>
                <Switch
                  value={pushEnabled}
                  onValueChange={handlePushToggle}
                  trackColor={{false: colors.borderMedium, true: colors.brandAlt}}
                  thumbColor={pushEnabled ? colors.brandPrimary : colors.fontMuted}
                />
              </View>

              {pushEnabled && (
                <View style={styles.prefGroup}>
                  <Text style={styles.prefGroupTitle}>Notification types</Text>

                  <View style={styles.switchRowSmall}>
                    <Text style={styles.switchTitleSmall}>Daily journal prompts</Text>
                    <Switch
                      value={pushDailyPrompts}
                      onValueChange={setPushDailyPrompts}
                      trackColor={{false: colors.borderMedium, true: colors.brandAlt}}
                      thumbColor={pushDailyPrompts ? colors.brandPrimary : colors.fontMuted}
                    />
                  </View>

                  {isPremium ? (
                    <>
                      <View style={styles.switchRowSmall}>
                        <Text style={styles.switchTitleSmall}>WISH milestone reminders</Text>
                        <Switch
                          value={pushWishMilestones}
                          onValueChange={setPushWishMilestones}
                          trackColor={{false: colors.borderMedium, true: colors.brandAlt}}
                          thumbColor={pushWishMilestones ? colors.brandPrimary : colors.fontMuted}
                        />
                      </View>
                      <View style={styles.switchRowSmall}>
                        <Text style={styles.switchTitleSmall}>Daily gratitude from Sophy</Text>
                        <Switch
                          value={pushGratitudePrompts}
                          onValueChange={setPushGratitudePrompts}
                          trackColor={{false: colors.borderMedium, true: colors.brandAlt}}
                          thumbColor={pushGratitudePrompts ? colors.brandPrimary : colors.fontMuted}
                        />
                      </View>
                      <View style={styles.switchRowSmall}>
                        <Text style={styles.switchTitleSmall}>Weekly insights</Text>
                        <Switch
                          value={pushWeeklyInsights}
                          onValueChange={setPushWeeklyInsights}
                          trackColor={{false: colors.borderMedium, true: colors.brandAlt}}
                          thumbColor={pushWeeklyInsights ? colors.brandPrimary : colors.fontMuted}
                        />
                      </View>
                    </>
                  ) : (
                    <View style={styles.lockedGroup}>
                      <Text style={styles.cardBody}>Plus adds more notification types:</Text>
                      <Text style={styles.lockedItem}>WISH milestone reminders</Text>
                      <Text style={styles.lockedItem}>Daily gratitude from Sophy</Text>
                      <Text style={styles.lockedItem}>Weekly insights</Text>
                      <IWButton title="See Plus" onPress={handleUpgradePress} style={styles.cardAction} />
                    </View>
                  )}

                  <IWButton
                    voice="gray"
                    title="Save push preferences"
                    onPress={() => savePushPreferences()}
                    loading={savingPush}
                    style={styles.cardAction}
                  />
                </View>
              )}
              {pushStatus ? <Text style={styles.inlineStatus}>{pushStatus}</Text> : null}

              {pushPermissionStatus === 'denied' && (
                <IWButton
                  voice="gray"
                  title="Open device settings"
                  onPress={() => notificationService.openSettings()}
                  style={styles.cardAction}
                />
              )}
            </Card>

            {/* SMS — Plus */}
            <Card style={styles.stackedCard}>
              <View style={styles.subsectionTitleRow}>
                <Text style={styles.subsectionTitle}>SMS notifications</Text>
                {!isPremium && (
                  <View style={styles.plusBadge}>
                    <Text style={styles.plusBadgeText}>Plus</Text>
                  </View>
                )}
              </View>

              {!isPremium ? (
                <>
                  <Text style={styles.cardBody}>
                    Plus adds daily prompts, gratitude messages, and milestone reminders via text message.
                  </Text>
                  <IWButton
                    title="See Plus"
                    onPress={() => checkFeatureAndShowPaywall('sms')}
                    style={styles.cardAction}
                  />
                </>
              ) : (
                <>
                  <Text style={styles.cardBody}>
                    Receive wellness reminders and insights from InkWell via text message.
                  </Text>

                  <Text style={styles.inputLabel}>Phone number</Text>
                  <View style={styles.phoneInputRow}>
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
                      style={styles.phoneNumberInput}
                      placeholder="(555) 123-4567"
                      placeholderTextColor={colors.fontMuted}
                      value={localPhoneNumber}
                      onChangeText={handlePhoneChange}
                      keyboardType="phone-pad"
                      autoCapitalize="none"
                    />
                  </View>
                  <Text style={styles.hintText}>Select country code, then enter your number</Text>

                  <Text style={styles.inputLabel}>Timezone</Text>
                  <Picker
                    selectedValue={selectedTimezone}
                    onValueChange={value => setSelectedTimezone(value)}
                    style={[styles.picker, {color: colors.fontMain}]}
                    itemStyle={{color: colors.fontMain}}>
                    {TIMEZONES.map(tz => (
                      <Picker.Item key={tz.value} label={tz.label} value={tz.value} color={colors.fontMain} />
                    ))}
                  </Picker>

                  <View style={styles.switchRow}>
                    <View style={styles.switchLabel}>
                      <Text style={styles.switchTitle}>Enable SMS notifications</Text>
                    </View>
                    <Switch
                      value={smsEnabled}
                      onValueChange={setSmsEnabled}
                      trackColor={{false: colors.borderMedium, true: colors.brandAlt}}
                      thumbColor={smsEnabled ? colors.brandPrimary : colors.fontMuted}
                    />
                  </View>

                  {smsEnabled && (
                    <View style={styles.prefGroup}>
                      <Text style={styles.prefGroupTitle}>Notification types</Text>

                      <View style={styles.switchRowSmall}>
                        <Text style={styles.switchTitleSmall}>WISH milestone reminders</Text>
                        <Switch
                          value={smsWishMilestones}
                          onValueChange={setSmsWishMilestones}
                          trackColor={{false: colors.borderMedium, true: colors.brandAlt}}
                          thumbColor={smsWishMilestones ? colors.brandPrimary : colors.fontMuted}
                        />
                      </View>
                      <View style={styles.switchRowSmall}>
                        <Text style={styles.switchTitleSmall}>Daily journal prompts</Text>
                        <Switch
                          value={smsDailyPrompts}
                          onValueChange={setSmsDailyPrompts}
                          trackColor={{false: colors.borderMedium, true: colors.brandAlt}}
                          thumbColor={smsDailyPrompts ? colors.brandPrimary : colors.fontMuted}
                        />
                      </View>
                      <View style={styles.switchRowSmall}>
                        <Text style={styles.switchTitleSmall}>Daily gratitude from Sophy</Text>
                        <Switch
                          value={smsGratitudePrompts}
                          onValueChange={setSmsGratitudePrompts}
                          trackColor={{false: colors.borderMedium, true: colors.brandAlt}}
                          thumbColor={smsGratitudePrompts ? colors.brandPrimary : colors.fontMuted}
                        />
                      </View>
                      <View style={styles.switchRowSmall}>
                        <Text style={styles.switchTitleSmall}>Weekly insights</Text>
                        <Switch
                          value={smsWeeklyInsights}
                          onValueChange={setSmsWeeklyInsights}
                          trackColor={{false: colors.borderMedium, true: colors.brandAlt}}
                          thumbColor={smsWeeklyInsights ? colors.brandPrimary : colors.fontMuted}
                        />
                      </View>
                    </View>
                  )}

                  <IWButton
                    voice="gray"
                    title="Save SMS preferences"
                    onPress={saveSmsPreferences}
                    loading={savingSms}
                    style={styles.cardAction}
                  />
                  {smsStatus ? <Text style={styles.inlineStatus}>{smsStatus}</Text> : null}
                </>
              )}
            </Card>
          </View>

          {/* ==================== EXPORT (Plus) ==================== */}
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Eyebrow style={styles.sectionEyebrowInline}>Export Data</Eyebrow>
              {!isPremium && (
                <View style={styles.plusBadge}>
                  <Text style={styles.plusBadgeText}>Plus</Text>
                </View>
              )}
            </View>
            <Card>
              {!isPremium ? (
                <>
                  <Text style={styles.cardBody}>
                    Plus adds full export of your journal entries, manifests, and Sophy reflections as a
                    downloadable file.
                  </Text>
                  <IWButton title="See Plus" onPress={handleUpgradePress} style={styles.cardAction} />
                </>
              ) : (
                <>
                  <Text style={styles.cardBody}>
                    Download all your journal entries, WISH manifests, and Sophy reflections. Export as readable
                    text or JSON format.
                  </Text>
                  <IWButton
                    title="Export my data"
                    onPress={handleExportData}
                    loading={exporting}
                    style={styles.cardAction}
                  />
                </>
              )}
            </Card>
          </View>

          {/* ==================== HELP & ABOUT ==================== */}
          <View style={styles.section}>
            <Eyebrow style={styles.sectionEyebrow}>Help & About</Eyebrow>
            <Card padded={false}>
              <TouchableOpacity style={styles.navRow} onPress={() => navigation.navigate('Info')}>
                <Text style={styles.navRowText}>Help & Tutorial</Text>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
              <Divider spacing={0} />
              <TouchableOpacity style={styles.navRow} onPress={handleResetFirstSteps}>
                <Text style={styles.navRowText}>Reset first steps</Text>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
              <Divider spacing={0} />
              <View style={styles.navRow}>
                <Text style={styles.navRowText}>App version</Text>
                <Text style={styles.value}>{APP_VERSION}</Text>
              </View>
            </Card>

            {/* Crisis resources — content preserved, chrome restyled */}
            <TouchableOpacity style={styles.crisisButton} onPress={() => setCrisisExpanded(!crisisExpanded)}>
              <Text style={styles.crisisButtonText}>Mental Health Crisis Resources</Text>
              <Text style={styles.crisisToggleIcon}>{crisisExpanded ? '▴' : '▾'}</Text>
            </TouchableOpacity>

            {crisisExpanded && (
              <View style={styles.crisisContent}>
                <Text style={styles.crisisTitle}>United States Crisis Resources</Text>
                <Text style={styles.crisisSubtitle}>If you're experiencing a mental health crisis:</Text>

                <TouchableOpacity style={styles.crisisLink} onPress={() => Linking.openURL('tel:988')}>
                  <Text style={styles.crisisLinkText}>
                    Call or text <Text style={styles.crisisBold}>988</Text> — Suicide & Crisis Lifeline
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.crisisLink}
                  onPress={() => Linking.openURL('sms:741741&body=HOME')}>
                  <Text style={styles.crisisLinkText}>
                    Text <Text style={styles.crisisBold}>HOME</Text> to <Text style={styles.crisisBold}>741741</Text>{' '}
                    — Crisis Text Line
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.crisisLink} onPress={() => Linking.openURL('tel:1-800-273-8255')}>
                  <Text style={styles.crisisLinkText}>
                    Call <Text style={styles.crisisBold}>1-800-273-8255</Text> — Veterans Crisis Line
                  </Text>
                </TouchableOpacity>

                <Text style={styles.crisisInternational}>
                  Outside the US? Please reach out to your local emergency services or mental health resources.
                </Text>

                <Text style={styles.crisisDisclaimer}>
                  InkWell and Sophy are wellness tools — not emergency services or replacements for professional
                  mental health care.
                </Text>
              </View>
            )}
          </View>

          {/* ==================== LOGOUT / DELETE ==================== */}
          <View style={styles.section}>
            <IWButton voice="danger" title="Logout" onPress={handleLogout} />
            <TouchableOpacity style={styles.deleteAccountButton} onPress={() => setDeleteModalVisible(true)}>
              <Text style={styles.deleteAccountText}>Delete Account</Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>InkWell by Pegasus Realm</Text>
            <Text style={styles.footerText}>© 2026 All rights reserved</Text>
          </View>

          {/* Paywall Modal - manual trigger */}
          <PaywallModal visible={paywallVisible} onClose={() => setPaywallVisible(false)} />

          {/* Paywall Modal - feature gating trigger */}
          <PaywallModal visible={showPaywall} onClose={closePaywall} />

          {/* Delete Account Modal */}
          <Modal
            visible={deleteModalVisible}
            animationType="fade"
            transparent={true}
            onRequestClose={() => setDeleteModalVisible(false)}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Delete Account?</Text>
                  <TouchableOpacity onPress={() => setDeleteModalVisible(false)}>
                    <Text style={styles.modalCloseButton}>×</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.deleteWarningText}>
                  This action will schedule your account for permanent deletion.
                </Text>

                <Text style={styles.modalDescription}>
                  • All your journal entries will be deleted{'\n'}• This cannot be undone after 30 days{'\n'}
                  {'\n'}You have a 30-day grace period to cancel by logging in again.
                </Text>

                <View style={styles.modalActions}>
                  <IWButton
                    voice="gray"
                    title="Cancel"
                    onPress={() => setDeleteModalVisible(false)}
                    style={styles.modalButton}
                  />
                  <IWButton
                    voice="danger"
                    title={deletingAccount ? 'Scheduling...' : 'Delete Account'}
                    onPress={handleRequestAccountDeletion}
                    disabled={deletingAccount}
                    style={styles.modalButton}
                  />
                </View>
              </View>
            </View>
          </Modal>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Dynamic styles based on theme colors
const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    keyboardAvoid: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    scrollContent: {
      flexGrow: 1,
      paddingBottom: spacing.xxl,
    },
    section: {
      marginTop: spacing.xl,
      paddingHorizontal: spacing.base,
    },
    sectionEyebrow: {
      marginBottom: spacing.sm,
    },
    sectionEyebrowInline: {
      marginBottom: 0,
    },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    stackedCard: {
      marginTop: spacing.md,
    },

    // Rows / labels
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    label: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.md,
      color: colors.fontMain,
    },
    value: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.md,
      color: colors.fontSecondary,
      flex: 1,
      textAlign: 'right',
      marginLeft: spacing.base,
    },
    inputLabel: {
      fontFamily: fontFamily.button,
      fontSize: fontSize.sm,
      color: colors.fontSecondary,
      marginBottom: spacing.xs,
      marginTop: spacing.sm,
    },
    input: {
      flex: 1,
      fontFamily: fontFamily.serif,
      backgroundColor: colors.bgCard,
      borderRadius: borderRadius.md,
      padding: spacing.sm,
      fontSize: fontSize.md,
      color: colors.fontMain,
      borderWidth: 1,
      borderColor: colors.borderMedium,
    },
    inlineStatus: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.sm,
      fontStyle: 'italic',
      color: colors.fontMuted,
      marginTop: spacing.sm,
    },
    hintText: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.xs,
      color: colors.fontMuted,
      marginTop: spacing.xs,
    },
    cardBody: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.sm,
      color: colors.fontSecondary,
      lineHeight: 21,
      marginBottom: spacing.sm,
    },
    cardAction: {
      marginTop: spacing.sm,
      alignSelf: 'flex-start',
    },

    // Profile
    profileBlock: {
      paddingTop: spacing.md,
    },
    profileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },

    // Subscription
    subscriptionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    subscriptionInfo: {
      flex: 1,
    },
    subscriptionBadge: {
      alignSelf: 'flex-start',
      backgroundColor: colors.bgMuted,
      borderWidth: 1,
      borderColor: colors.borderMedium,
      paddingHorizontal: spacing.md,
      paddingVertical: 4,
      borderRadius: 999,
      marginTop: spacing.xs,
    },
    subscriptionBadgePaid: {
      backgroundColor: colors.brandPrimary,
      borderColor: colors.brandPrimary,
    },
    subscriptionBadgeText: {
      fontFamily: fontFamily.buttonBold,
      fontSize: fontSize.sm,
      color: colors.fontMain,
      letterSpacing: 0.5,
    },
    subscriptionStatusText: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.xs,
      color: colors.fontMuted,
      marginTop: spacing.xs,
    },
    subscriptionPromptText: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.sm,
      color: colors.fontSecondary,
      lineHeight: 21,
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },

    // Plus badge
    plusBadge: {
      backgroundColor: colors.tierPlus,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: borderRadius.sm,
      marginLeft: spacing.sm,
    },
    plusBadgeText: {
      fontFamily: fontFamily.buttonBold,
      color: colors.fontWhite,
      fontSize: fontSize.xs,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },

    // Theme picker
    themeOptions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },

    // Your Words
    privacyLine: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.sm,
      color: colors.fontSecondary,
      lineHeight: 21,
      marginBottom: spacing.sm,
    },
    privacyFootnote: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.xs,
      color: colors.fontMuted,
      lineHeight: 18,
    },
    privacyLink: {
      color: colors.brandPrimary,
      textDecorationLine: 'underline',
    },

    // Practice Summary
    summaryRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },

    // Switch rows
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.sm,
    },
    switchLabel: {
      flex: 1,
      marginRight: spacing.md,
    },
    switchTitle: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.md,
      color: colors.fontMain,
    },
    switchDescription: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.xs,
      color: colors.fontMuted,
      marginTop: 2,
    },
    switchRowSmall: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.xs,
    },
    switchTitleSmall: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.sm,
      color: colors.fontSecondary,
      flex: 1,
      marginRight: spacing.md,
    },
    prefGroup: {
      marginTop: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    prefGroupTitle: {
      fontFamily: fontFamily.button,
      fontSize: fontSize.sm,
      color: colors.fontSecondary,
      marginBottom: spacing.xs,
    },
    lockedGroup: {
      marginTop: spacing.sm,
    },
    lockedItem: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.sm,
      color: colors.fontMuted,
      marginBottom: spacing.xs,
      paddingLeft: spacing.sm,
    },
    subsectionTitle: {
      fontFamily: fontFamily.header,
      fontSize: fontSize.lg,
      color: colors.fontMain,
      marginBottom: spacing.xs,
    },
    subsectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    savingIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },

    // Phone / pickers
    phoneInputRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      alignItems: 'center',
    },
    countryCodePicker: {
      width: 150,
      borderWidth: 1,
      borderColor: colors.borderMedium,
      borderRadius: borderRadius.md,
      backgroundColor: colors.bgCard,
      overflow: 'hidden',
    },
    phoneNumberInput: {
      flex: 1,
      fontFamily: fontFamily.body,
      backgroundColor: colors.bgCard,
      borderRadius: borderRadius.md,
      padding: spacing.sm,
      fontSize: fontSize.md,
      color: colors.fontMain,
      borderWidth: 1,
      borderColor: colors.borderMedium,
    },
    picker: {
      backgroundColor: colors.bgCard,
    },

    // Help & About rows
    navRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.base,
      minHeight: 48,
    },
    navRowText: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.md,
      color: colors.fontMain,
    },
    chevron: {
      fontSize: fontSize.xxl,
      color: colors.brandPrimary,
    },

    // Crisis resources
    crisisButton: {
      backgroundColor: colors.bgCard,
      borderRadius: borderRadius.lg,
      padding: spacing.base,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.btnDanger,
      marginTop: spacing.md,
    },
    crisisButtonText: {
      fontFamily: fontFamily.button,
      fontSize: fontSize.sm,
      color: colors.btnDanger,
      flex: 1,
    },
    crisisToggleIcon: {
      fontSize: fontSize.sm,
      color: colors.btnDanger,
    },
    crisisContent: {
      backgroundColor: colors.bgCard,
      borderRadius: borderRadius.md,
      padding: spacing.base,
      marginTop: spacing.sm,
      borderLeftWidth: 4,
      borderLeftColor: colors.btnDanger,
    },
    crisisTitle: {
      fontFamily: fontFamily.header,
      fontSize: fontSize.md,
      color: colors.btnDanger,
      marginBottom: spacing.sm,
    },
    crisisSubtitle: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.sm,
      color: colors.fontMain,
      marginBottom: spacing.base,
    },
    crisisLink: {
      backgroundColor: colors.bgMuted,
      borderRadius: borderRadius.md,
      padding: spacing.sm,
      marginBottom: spacing.sm,
    },
    crisisLinkText: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.sm,
      color: colors.fontMain,
    },
    crisisBold: {
      fontFamily: fontFamily.buttonBold,
      color: colors.btnDanger,
    },
    crisisInternational: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.xs,
      color: colors.fontSecondary,
      marginTop: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    crisisDisclaimer: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.xs,
      color: colors.fontMuted,
      fontStyle: 'italic',
      marginTop: spacing.sm,
      lineHeight: 16,
    },

    // Logout / delete
    deleteAccountButton: {
      marginTop: spacing.md,
      backgroundColor: colors.bgCard,
      borderRadius: 10,
      padding: spacing.base,
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: colors.btnDanger,
    },
    deleteAccountText: {
      fontFamily: fontFamily.buttonBold,
      fontSize: fontSize.md,
      color: colors.btnDanger,
      letterSpacing: 0.5,
    },

    // Footer
    footer: {
      marginTop: spacing.xxl,
      marginBottom: spacing.xxl,
      alignItems: 'center',
    },
    footerText: {
      fontFamily: fontFamily.button,
      fontSize: fontSize.xs,
      color: colors.fontMuted,
      marginVertical: 2,
    },

    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContainer: {
      backgroundColor: colors.bgCard,
      borderRadius: borderRadius.xl,
      padding: spacing.xl,
      width: '85%',
      maxWidth: 400,
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 4},
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 8,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.base,
    },
    modalTitle: {
      fontFamily: fontFamily.header,
      fontSize: fontSize.xl,
      color: colors.fontMain,
    },
    modalCloseButton: {
      fontSize: fontSize.xxl,
      color: colors.fontMuted,
      paddingHorizontal: spacing.sm,
    },
    deleteWarningText: {
      fontFamily: fontFamily.header,
      fontSize: fontSize.md,
      color: colors.btnDanger,
      marginBottom: spacing.base,
      textAlign: 'center',
    },
    modalDescription: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.sm,
      color: colors.fontSecondary,
      lineHeight: 22,
      marginBottom: spacing.lg,
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing.sm,
    },
    modalButton: {
      minWidth: 110,
    },
  });
