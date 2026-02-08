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
} from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import {Picker} from '@react-native-picker/picker';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {spacing, borderRadius, fontFamily, fontSize} from '../theme';
import {useTheme, ThemeColors} from '../theme/ThemeContext';
import type {ThemeMode} from '../theme';
import type {RootStackScreenProps} from '../navigation/types';
import {useSubscription} from '../hooks/useSubscription';
import {useOnboarding} from '../hooks/useOnboarding';
import PaywallModal from '../components/PaywallModal';
import notificationService, {PushNotificationPreferences} from '../services/notificationService';

// Twilio-supported country codes (major regions)
const COUNTRY_CODES = [
  { code: '+1', country: 'US/Canada', flag: '🇺🇸' },
  { code: '+44', country: 'UK', flag: '🇬🇧' },
  { code: '+61', country: 'Australia', flag: '🇦🇺' },
  { code: '+64', country: 'New Zealand', flag: '🇳🇿' },
  { code: '+353', country: 'Ireland', flag: '🇮🇪' },
  { code: '+49', country: 'Germany', flag: '🇩🇪' },
  { code: '+33', country: 'France', flag: '🇫🇷' },
  { code: '+34', country: 'Spain', flag: '🇪🇸' },
  { code: '+39', country: 'Italy', flag: '🇮🇹' },
  { code: '+31', country: 'Netherlands', flag: '🇳🇱' },
  { code: '+32', country: 'Belgium', flag: '🇧🇪' },
  { code: '+41', country: 'Switzerland', flag: '🇨🇭' },
  { code: '+43', country: 'Austria', flag: '🇦🇹' },
  { code: '+46', country: 'Sweden', flag: '🇸🇪' },
  { code: '+47', country: 'Norway', flag: '🇳🇴' },
  { code: '+45', country: 'Denmark', flag: '🇩🇰' },
  { code: '+358', country: 'Finland', flag: '🇫🇮' },
  { code: '+48', country: 'Poland', flag: '🇵🇱' },
  { code: '+81', country: 'Japan', flag: '🇯🇵' },
  { code: '+82', country: 'South Korea', flag: '🇰🇷' },
  { code: '+65', country: 'Singapore', flag: '🇸🇬' },
  { code: '+852', country: 'Hong Kong', flag: '🇭🇰' },
  { code: '+91', country: 'India', flag: '🇮🇳' },
  { code: '+971', country: 'UAE', flag: '🇦🇪' },
  { code: '+972', country: 'Israel', flag: '🇮🇱' },
  { code: '+27', country: 'South Africa', flag: '🇿🇦' },
  { code: '+52', country: 'Mexico', flag: '🇲🇽' },
  { code: '+55', country: 'Brazil', flag: '🇧🇷' },
  { code: '+54', country: 'Argentina', flag: '🇦🇷' },
  { code: '+56', country: 'Chile', flag: '🇨🇱' },
];

// Major world timezones (~25 grouped by region)
const TIMEZONES = [
  // Americas
  { value: 'Pacific/Honolulu', label: '🇺🇸 Hawaii (HST)', region: 'Americas' },
  { value: 'America/Anchorage', label: '🇺🇸 Alaska (AKST)', region: 'Americas' },
  { value: 'America/Los_Angeles', label: '🇺🇸 Pacific Time (PST)', region: 'Americas' },
  { value: 'America/Denver', label: '🇺🇸 Mountain Time (MST)', region: 'Americas' },
  { value: 'America/Phoenix', label: '🇺🇸 Arizona (MST)', region: 'Americas' },
  { value: 'America/Chicago', label: '🇺🇸 Central Time (CST)', region: 'Americas' },
  { value: 'America/New_York', label: '🇺🇸 Eastern Time (EST)', region: 'Americas' },
  { value: 'America/Toronto', label: '🇨🇦 Toronto (EST)', region: 'Americas' },
  { value: 'America/Mexico_City', label: '🇲🇽 Mexico City (CST)', region: 'Americas' },
  { value: 'America/Sao_Paulo', label: '🇧🇷 São Paulo (BRT)', region: 'Americas' },
  { value: 'America/Argentina/Buenos_Aires', label: '🇦🇷 Buenos Aires (ART)', region: 'Americas' },
  // Europe
  { value: 'Europe/London', label: '🇬🇧 London (GMT)', region: 'Europe' },
  { value: 'Europe/Dublin', label: '🇮🇪 Dublin (GMT)', region: 'Europe' },
  { value: 'Europe/Paris', label: '🇫🇷 Paris (CET)', region: 'Europe' },
  { value: 'Europe/Berlin', label: '🇩🇪 Berlin (CET)', region: 'Europe' },
  { value: 'Europe/Amsterdam', label: '🇳🇱 Amsterdam (CET)', region: 'Europe' },
  { value: 'Europe/Rome', label: '🇮🇹 Rome (CET)', region: 'Europe' },
  { value: 'Europe/Madrid', label: '🇪🇸 Madrid (CET)', region: 'Europe' },
  { value: 'Europe/Stockholm', label: '🇸🇪 Stockholm (CET)', region: 'Europe' },
  // Asia & Middle East
  { value: 'Asia/Dubai', label: '🇦🇪 Dubai (GST)', region: 'Asia' },
  { value: 'Asia/Kolkata', label: '🇮🇳 India (IST)', region: 'Asia' },
  { value: 'Asia/Singapore', label: '🇸🇬 Singapore (SGT)', region: 'Asia' },
  { value: 'Asia/Hong_Kong', label: '🇭🇰 Hong Kong (HKT)', region: 'Asia' },
  { value: 'Asia/Tokyo', label: '🇯🇵 Tokyo (JST)', region: 'Asia' },
  { value: 'Asia/Seoul', label: '🇰🇷 Seoul (KST)', region: 'Asia' },
  // Pacific
  { value: 'Australia/Sydney', label: '🇦🇺 Sydney (AEDT)', region: 'Pacific' },
  { value: 'Australia/Melbourne', label: '🇦🇺 Melbourne (AEDT)', region: 'Pacific' },
  { value: 'Australia/Perth', label: '🇦🇺 Perth (AWST)', region: 'Pacific' },
  { value: 'Pacific/Auckland', label: '🇳🇿 Auckland (NZDT)', region: 'Pacific' },
];

export default function SettingsScreen({
  navigation,
}: RootStackScreenProps<'Settings'>) {
  const user = auth().currentUser;
  const {colors, themeMode, setThemeMode, isDark} = useTheme();
  
  // Create styles with current theme colors
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const [practitioners, setPractitioners] = useState<Array<{id: string; name: string; email: string}>>([]);
  const [loadingPractitioners, setLoadingPractitioners] = useState(true);
  const [approvedPractitioners, setApprovedPractitioners] = useState<Array<{id: string; name: string; email: string; bio?: string; credentials?: string; practiceLocation?: string; specialties?: string[]}>>([]);
  const [loadingApproved, setLoadingApproved] = useState(true);
  const [selectedApprovedId, setSelectedApprovedId] = useState('');
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [weeklyInsightsEnabled, setWeeklyInsightsEnabled] = useState(true);
  const [monthlyInsightsEnabled, setMonthlyInsightsEnabled] = useState(true);
  const [savingInsights, setSavingInsights] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [crisisExpanded, setCrisisExpanded] = useState(false);
  
  // SMS Notifications state
  const [countryCode, setCountryCode] = useState('+1');
  const [localPhoneNumber, setLocalPhoneNumber] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [smsWishMilestones, setSmsWishMilestones] = useState(true);
  const [smsDailyPrompts, setSmsDailyPrompts] = useState(false);
  const [smsGratitudePrompts, setSmsGratitudePrompts] = useState(true);
  const [smsCoachReplies, setSmsCoachReplies] = useState(true);
  const [smsWeeklyInsights, setSmsWeeklyInsights] = useState(false);
  const [savingSms, setSavingSms] = useState(false);
  const [selectedTimezone, setSelectedTimezone] = useState('America/New_York');
  
  // Format phone number as user types (XXX) XXX-XXXX
  const formatPhoneNumber = (text: string): string => {
    // Remove all non-digits
    const cleaned = text.replace(/\D/g, '');
    
    // Apply formatting based on length
    if (cleaned.length <= 3) {
      return cleaned;
    } else if (cleaned.length <= 6) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    } else {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
    }
  };
  
  // Handle phone input with formatting
  const handlePhoneChange = (text: string) => {
    const formatted = formatPhoneNumber(text);
    setLocalPhoneNumber(formatted);
  };
  
  // Push Notifications state
  const [pushPermissionStatus, setPushPermissionStatus] = useState<'authorized' | 'denied' | 'not_determined'>('not_determined');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushDailyPrompts, setPushDailyPrompts] = useState(true);
  const [pushGratitudePrompts, setPushGratitudePrompts] = useState(true);
  const [pushWishMilestones, setPushWishMilestones] = useState(true);
  const [pushCoachReplies, setPushCoachReplies] = useState(true);
  const [pushWeeklyInsights, setPushWeeklyInsights] = useState(false);
  const [savingPush, setSavingPush] = useState(false);
  
  // Export state
  const [exporting, setExporting] = useState(false);
  
  const {
    tier: subscriptionTier,
    isActive,
    isPremium,
    isConnect,
    loading: subscriptionLoading,
    openPaywall: initAndOpenPaywall,
    checkFeatureAndShowPaywall,
    showPaywall,
    closePaywall,
  } = useSubscription();

  // Onboarding hook for reset functionality
  const {resetOnboarding} = useOnboarding();

  const handleResetOnboarding = async () => {
    Alert.alert(
      'Reset Onboarding',
      'This will show the welcome tips again on each screen. Useful for testing or if you want to see the tips again.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Reset',
          onPress: async () => {
            await resetOnboarding();
            Alert.alert('Done', 'Onboarding tips have been reset. You\'ll see them again on each screen.');
          },
        },
      ]
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
    loadPractitioners();
    loadApprovedPractitioners();
    loadInsightsPreferences();
    loadSmsPreferences();
    loadPushPreferences();
  }, []);

  // Refresh push permission status when app returns from background (e.g., after changing settings)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        // Refresh push permission status when app becomes active
        loadPushPreferences();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [user]);

  const loadPractitioners = async () => {
    if (!user) return;

    setLoadingPractitioners(true);
    try {
      const userDoc = await firestore().collection('users').doc(user.uid).get();
      const userData = userDoc.data();
      console.log('[loadPractitioners] User data:', JSON.stringify({
        connectedPractitioner: userData?.connectedPractitioner,
        practitioners: userData?.practitioners
      }));
      
      const loadedPractitioners: Array<{id: string; name: string; email: string}> = [];
      
      // Check for connectedPractitioner (new format from beta assignment)
      if (userData?.connectedPractitioner) {
        const connected = userData.connectedPractitioner;
        console.log('[loadPractitioners] Found connectedPractitioner:', connected);
        // Try to get coach details from users collection
        if (connected.practitionerId) {
          try {
            const coachDoc = await firestore().collection('users').doc(connected.practitionerId).get();
            console.log('[loadPractitioners] Coach doc exists:', coachDoc.exists());
            if (coachDoc.exists()) {
              const coachData = coachDoc.data();
              loadedPractitioners.push({
                id: connected.practitionerId,
                name: coachData?.displayName || connected.name || 'Coach',
                email: coachData?.email || connected.email || '',
              });
            } else {
              // Fallback to data stored in connectedPractitioner
              loadedPractitioners.push({
                id: connected.practitionerId,
                name: connected.name || 'Coach',
                email: connected.email || '',
              });
            }
          } catch (err) {
            console.log('[loadPractitioners] Error fetching coach:', err);
            // Fallback to data stored in connectedPractitioner
            loadedPractitioners.push({
              id: connected.practitionerId,
              name: connected.name || 'Coach',
              email: connected.email || '',
            });
          }
        }
      }
      
      // Also check legacy practitioners array format
      if (userData?.practitioners && userData.practitioners.length > 0) {
        const practitionerDocs = await Promise.all(
          userData.practitioners.map((practId: string) =>
            // Try users collection first (coaches are users), then practitioners collection
            firestore().collection('users').doc(practId).get()
          )
        );

        practitionerDocs
          .filter(doc => doc.exists())
          .forEach(doc => {
            // Avoid duplicates
            if (!loadedPractitioners.find(p => p.id === doc.id)) {
              loadedPractitioners.push({
                id: doc.id,
                name: doc.data()?.displayName || doc.data()?.email || 'Coach',
                email: doc.data()?.email || '',
              });
            }
          });
      }

      setPractitioners(loadedPractitioners);
    } catch (error) {
      console.error('Error loading practitioners:', error);
    } finally {
      setLoadingPractitioners(false);
    }
  };

  const loadApprovedPractitioners = async () => {
    setLoadingApproved(true);
    try {
      // Query users collection for coaches who have opted in to be publicly visible
      // Only coaches with freeAgentOptIn: true appear in the public directory
      const snapshot = await firestore()
        .collection('users')
        .where('userRole', '==', 'coach')
        .where('freeAgentOptIn', '==', true)
        .get();
      
      const approved = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().displayName || doc.data().signupUsername || 'Coach',
        email: doc.data().email || '',
        bio: doc.data().bio || '',
        credentials: doc.data().credentials || '',
        practiceLocation: doc.data().practiceLocation || '',
        specialties: doc.data().specialties || [],
      }));
      
      setApprovedPractitioners(approved);
    } catch (error) {
      console.error('Error loading approved practitioners:', error);
    } finally {
      setLoadingApproved(false);
    }
  };

  const loadInsightsPreferences = async () => {
    if (!user) return;

    try {
      const userDoc = await firestore().collection('users').doc(user.uid).get();
      const userData = userDoc.data();
      
      if (userData?.insightsPreferences) {
        // Default to true if not explicitly set to false
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
      await firestore()
        .collection('users')
        .doc(user.uid)
        .set({
          insightsPreferences: {
            weeklyEnabled: weekly,
            monthlyEnabled: monthly,
            updatedAt: firestore.FieldValue.serverTimestamp(),
          },
        }, { merge: true });

      Alert.alert('Success', 'Email insights preferences updated');
    } catch (error) {
      console.error('Error saving insights preferences:', error);
      Alert.alert('Error', 'Failed to save preferences. Please try again.');
    } finally {
      setSavingInsights(false);
    }
  };

  // SMS Preferences Functions
  const loadSmsPreferences = async () => {
    if (!user) return;

    try {
      const userDoc = await firestore().collection('users').doc(user.uid).get();
      const userData = userDoc.data();
      
      // IMPORTANT: Web app stores phoneNumber and timezone at root level,
      // mobile was storing inside smsPreferences. Check both for compatibility.
      
      // Phone number: prefer root level (web), fall back to smsPreferences (old mobile)
      const phone = userData?.phoneNumber || userData?.smsPreferences?.phoneNumber || '';
      setPhoneNumber(phone);
      
      // Parse country code from existing phone number
      if (phone) {
        // Find matching country code (longest match first)
        const sortedCodes = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);
        const matchedCountry = sortedCodes.find(c => phone.startsWith(c.code));
        if (matchedCountry) {
          setCountryCode(matchedCountry.code);
          setLocalPhoneNumber(phone.slice(matchedCountry.code.length));
        } else {
          // Default to US if no match
          setCountryCode('+1');
          setLocalPhoneNumber(phone.replace(/^\+/, ''));
        }
      }
      
      // Timezone: prefer root level (web), fall back to smsPreferences (old mobile)
      const tz = userData?.timezone || userData?.smsPreferences?.timezone || 'America/New_York';
      setSelectedTimezone(tz);
      
      // SMS enabled: web uses smsOptIn at root, mobile used smsPreferences.enabled
      const enabled = userData?.smsOptIn || userData?.smsPreferences?.enabled || false;
      setSmsEnabled(enabled);
      
      // Individual SMS preferences (these are correctly in smsPreferences on both)
      if (userData?.smsPreferences) {
        setSmsWishMilestones(userData.smsPreferences.wishMilestones !== false);
        setSmsDailyPrompts(userData.smsPreferences.dailyPrompts || false);
        // Web uses dailyGratitude, mobile used gratitudePrompts
        setSmsGratitudePrompts(userData.smsPreferences.dailyGratitude !== false || userData.smsPreferences.gratitudePrompts !== false);
        setSmsCoachReplies(userData.smsPreferences.coachReplies !== false);
        setSmsWeeklyInsights(userData.smsPreferences.weeklyInsights || false);
      }
    } catch (error) {
      console.error('Error loading SMS preferences:', error);
    }
  };

  const saveSmsPreferences = async () => {
    if (!user) return;

    // Combine country code + local number
    const cleanLocalNumber = localPhoneNumber.replace(/[\s\-\(\)]/g, '');
    const fullPhoneNumber = cleanLocalNumber ? `${countryCode}${cleanLocalNumber}` : '';
    
    // Validate phone number format (must have at least 6 digits after country code)
    if (smsEnabled && cleanLocalNumber && cleanLocalNumber.length < 6) {
      Alert.alert('Invalid Phone Number', 'Please enter a valid phone number (at least 6 digits)');
      return;
    }

    setSavingSms(true);
    try {
      await firestore()
        .collection('users')
        .doc(user.uid)
        .set({
          // Save at root level for web app compatibility
          phoneNumber: fullPhoneNumber,
          timezone: selectedTimezone,
          smsOptIn: smsEnabled,
          // Also save in smsPreferences for detailed preferences
          smsPreferences: {
            phoneNumber: fullPhoneNumber,
            enabled: smsEnabled,
            timezone: selectedTimezone,
            wishMilestones: smsWishMilestones,
            dailyPrompts: smsDailyPrompts,
            gratitudePrompts: smsGratitudePrompts,
            dailyGratitude: smsGratitudePrompts, // Web uses this name
            coachReplies: smsCoachReplies,
            weeklyInsights: smsWeeklyInsights,
            updatedAt: firestore.FieldValue.serverTimestamp(),
          },
        }, { merge: true });

      // Update local state with combined number
      setPhoneNumber(fullPhoneNumber);
      
      Alert.alert('Success', 'SMS preferences updated');
    } catch (error) {
      console.error('Error saving SMS preferences:', error);
      Alert.alert('Error', 'Failed to save SMS preferences. Please try again.');
    } finally {
      setSavingSms(false);
    }
  };

  // Push Notification Functions
  const loadPushPreferences = async () => {
    if (!user) return;

    try {
      // Load saved preferences first
      const prefs = await notificationService.loadPreferences(user.uid);
      
      // If user previously enabled notifications, trust that setting
      // Don't use checkPermissionStatus() - it returns cached/stale values
      if (prefs.enabled) {
        // User had it enabled - show as enabled and don't show warning
        setPushPermissionStatus('authorized');
        setPushEnabled(true);
      } else {
        // User hasn't enabled yet - show as not enabled, no warning needed
        setPushPermissionStatus('not_determined');
        setPushEnabled(false);
      }
      
      // Load other preferences
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
      // Enable push notifications
      setPushEnabled(true);
      setPushPermissionStatus('authorized');
      
      // Get FCM token and save preferences
      const tokenResult = await notificationService.getAndSaveToken(user.uid);
      await savePushPreferences(true, true); // skipAlert = true, we handle it here
      
      if (tokenResult.success) {
        Alert.alert(
          '✅ Push Notifications Enabled!', 
          `Token saved successfully.\n\nToken prefix: ${tokenResult.token?.substring(0, 30)}...`
        );
      } else if (tokenResult.permissionStatus === 'DENIED') {
        // Permission denied - need to go to Settings
        setPushEnabled(false);
        setPushPermissionStatus('denied');
        Alert.alert(
          'Permission Required',
          'Push notifications are disabled in your device settings. Would you like to open Settings to enable them?',
          [
            { text: 'Not Now', style: 'cancel' },
            { 
              text: 'Open Settings', 
              onPress: () => notificationService.openSettings()
            }
          ]
        );
      } else {
        // Other error (APNs not configured, etc.)
        setPushEnabled(false);
        Alert.alert(
          'Push Notification Error', 
          `Could not enable push notifications.\n\nError: ${tokenResult.error || 'Unknown error'}\n\nPermission: ${tokenResult.permissionStatus || 'unknown'}`
        );
      }
    } else {
      // Disabling
      setPushEnabled(false);
      await savePushPreferences(false, true);
      Alert.alert('Success', 'Push notifications disabled.');
    }
  };

  const savePushPreferences = async (enabled?: boolean, skipAlert?: boolean) => {
    if (!user) return;

    setSavingPush(true);
    try {
      const prefs: PushNotificationPreferences = {
        enabled: enabled ?? pushEnabled,
        dailyPrompts: pushDailyPrompts,
        gratitudePrompts: pushGratitudePrompts,
        wishMilestones: pushWishMilestones,
        coachReplies: pushCoachReplies,
        weeklyInsights: pushWeeklyInsights,
      };

      const success = await notificationService.savePreferences(user.uid, prefs);
      if (!skipAlert) {
        if (success) {
          Alert.alert('Success', 'Push notification preferences updated');
        } else {
          Alert.alert('Error', 'Failed to save preferences. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error saving push preferences:', error);
      if (!skipAlert) {
        Alert.alert('Error', 'Failed to save preferences. Please try again.');
      }
    } finally {
      setSavingPush(false);
    }
  };

  // Helper: safely convert date field (handles both Firestore Timestamp and ISO string)
  const safeToISOString = (dateField: any): string | null => {
    if (!dateField) return null;
    // If it's a Firestore Timestamp, call toDate()
    if (typeof dateField.toDate === 'function') {
      return dateField.toDate().toISOString();
    }
    // If it's already a string, return it
    if (typeof dateField === 'string') {
      return dateField;
    }
    // If it's a Date object
    if (dateField instanceof Date) {
      return dateField.toISOString();
    }
    return null;
  };

  // Export user data function
  const handleExportData = async () => {
    if (!user) return;

    // Check Plus subscription
    if (!isPremium) {
      Alert.alert(
        'Plus Feature',
        'Export your journal data is a Plus feature. Upgrade to download all your entries.',
        [
          { text: 'Maybe Later', style: 'cancel' },
          { text: 'Upgrade', onPress: handleUpgradePress },
        ]
      );
      return;
    }

    setExporting(true);
    try {
      // Collect journal entries
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

      // Collect manifest (single document per user)
      const manifestDoc = await firestore()
        .collection('manifests')
        .doc(user.uid)
        .get();

      const manifests = [];
      if (manifestDoc.exists) {
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

      // Build export data
      const exportData = {
        exportInfo: {
          exportDate: new Date().toISOString(),
          userEmail: user.email,
          appVersion: '1.0.0',
          platform: Platform.OS,
        },
        statistics: {
          totalJournalEntries: journalEntries.length,
          totalManifests: manifests.length,
          firstEntryDate: journalEntries.length > 0 
            ? journalEntries[journalEntries.length - 1].createdAt 
            : null,
          mostRecentEntryDate: journalEntries.length > 0 
            ? journalEntries[0].createdAt 
            : null,
        },
        journalEntries,
        manifests,
      };

      // Create readable text version
      const readableExport = generateReadableExport(exportData);

      // Save to temp file and share
      const fileName = `InkWell_Export_${new Date().toISOString().split('T')[0]}.txt`;
      const cacheDir = ReactNativeBlobUtil.fs.dirs.CacheDir;
      const filePath = `${cacheDir}/${fileName}`;
      
      await ReactNativeBlobUtil.fs.writeFile(filePath, readableExport, 'utf8');

      await Share.share({
        title: 'InkWell Journal Export',
        message: readableExport.substring(0, 500) + '...\n\n[Full export attached]',
        url: Platform.OS === 'ios' ? filePath : `file://${filePath}`,
      });

      // Also offer JSON export
      Alert.alert(
        'Export Complete!',
        `Exported ${journalEntries.length} journal entries and ${manifests.length} manifests.`,
        [
          { text: 'Done', style: 'default' },
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
            }
          },
        ]
      );

    } catch (error) {
      console.error('Error exporting data:', error);
      Alert.alert('Export Failed', 'Unable to export your data. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  // Generate human-readable export text
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

    // Journal Entries
    text += '═══════════════════════════════════════════\n';
    text += '              JOURNAL ENTRIES\n';
    text += '═══════════════════════════════════════════\n\n';

    data.journalEntries.forEach((entry: any, index: number) => {
      const date = entry.createdAt 
        ? new Date(entry.createdAt).toLocaleDateString('en-US', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
          })
        : 'Unknown date';
      
      text += `───────────────────────────────────────────\n`;
      text += `Entry ${index + 1} - ${date}\n`;
      text += `───────────────────────────────────────────\n`;
      
      if (entry.promptUsed) {
        text += `\n📝 Prompt: ${entry.promptUsed}\n`;
      }
      
      text += `\n${entry.text}\n`;
      
      if (entry.reflectionUsed) {
        text += `\n✨ Sophy's Reflection:\n${entry.reflectionUsed}\n`;
      }
      
      if (entry.attachmentNames?.length > 0) {
        text += `\n📎 Attachments: ${entry.attachmentNames.join(', ')}\n`;
      }
      
      text += '\n';
    });

    // Manifests
    if (data.manifests.length > 0) {
      text += '═══════════════════════════════════════════\n';
      text += '              WISH MANIFESTS\n';
      text += '═══════════════════════════════════════════\n\n';

      data.manifests.forEach((manifest: any, index: number) => {
        text += `───────────────────────────────────────────\n`;
        text += `Manifest ${index + 1} - ${manifest.date || 'Unknown date'}\n`;
        text += `───────────────────────────────────────────\n`;
        text += `🌟 Wish: ${manifest.wish}\n`;
        text += `🎯 Outcome: ${manifest.outcome}\n`;
        text += `⚡ Opposition: ${manifest.opposition}\n`;
        text += `📋 Plan: ${manifest.plan}\n\n`;
      });
    }

    text += '═══════════════════════════════════════════\n';
    text += '        Thank you for using InkWell!\n';
    text += '═══════════════════════════════════════════\n';

    return text;
  };

  const handleConnectToApproved = async () => {
    if (!selectedApprovedId) {
      Alert.alert('Error', 'Please select a coach from the list');
      return;
    }

    const selectedPractitioner = approvedPractitioners.find(p => p.id === selectedApprovedId);
    if (!selectedPractitioner || !user) return;

    // Check if user already has a coach connected - enforce once-per-billing-cycle switching
    try {
      const userDoc = await firestore().collection('users').doc(user.uid).get();
      const userData = userDoc.data();
      
      if (userData?.connectedPractitioner?.practitionerId) {
        const lastSwitchDate = userData.lastCoachSwitchAt?.toDate?.();
        const now = new Date();
        
        // Check if they've switched in the last 30 days
        if (lastSwitchDate) {
          const daysSinceSwitch = Math.floor((now.getTime() - lastSwitchDate.getTime()) / (1000 * 60 * 60 * 24));
          if (daysSinceSwitch < 30) {
            const daysRemaining = 30 - daysSinceSwitch;
            Alert.alert(
              'Coach Change Limit',
              `You can switch coaches once per billing cycle. You can change coaches again in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}.`,
            );
            return;
          }
        }
        
        // Confirm they want to switch
        Alert.alert(
          'Switch Coach?',
          `You are currently connected to ${userData.connectedPractitioner.name}. Switching to ${selectedPractitioner.name} will take effect immediately. You can only change coaches once per billing cycle.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Switch Coach', 
              onPress: () => performCoachConnection(selectedPractitioner, true),
            },
          ],
        );
        return;
      }
    } catch (checkError) {
      console.error('Error checking existing coach:', checkError);
    }

    // No existing coach, proceed with connection
    performCoachConnection(selectedPractitioner, false);
  };

  const performCoachConnection = async (
    selectedPractitioner: {id: string; name: string; email: string; bio?: string},
    isSwitch: boolean
  ) => {
    if (!user) return;
    
    setConnecting(true);
    try {
      const updateData: any = {
        connectedPractitioner: {
          practitionerId: selectedPractitioner.id,
          email: selectedPractitioner.email,
          name: selectedPractitioner.name,
          connectedAt: firestore.FieldValue.serverTimestamp(),
          connectionType: 'approved_selection',
        },
        practitioners: firestore.FieldValue.arrayUnion(selectedPractitioner.id),
      };
      
      // Track coach switch date if this is a switch
      if (isSwitch) {
        updateData.lastCoachSwitchAt = firestore.FieldValue.serverTimestamp();
      }
      
      await firestore()
        .collection('users')
        .doc(user.uid)
        .set(updateData, { merge: true });

      Alert.alert(
        isSwitch ? 'Coach Switched!' : 'Connected!',
        `You are now connected to ${selectedPractitioner.name}. You can tag them in your journal entries.`,
      );
      
      setSelectedApprovedId('');
      await loadPractitioners();
    } catch (error) {
      console.error('Error connecting to coach:', error);
      Alert.alert('Error', 'Failed to connect to coach. Please try again.');
    } finally {
      setConnecting(false);
    }
  };

  const handleSendInvite = async () => {
    if (!inviteEmail.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    // SPAM PREVENTION: Check if user already has a coach or pending invite
    try {
      const userDoc = await firestore().collection('users').doc(user?.uid).get();
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData?.connectedCoach || userData?.connectedPractitioner || practitioners.length > 0) {
          Alert.alert(
            'Coach Already Connected',
            'You already have a coach connected. Please disconnect first to invite a new one.'
          );
          return;
        }
        if (userData?.pendingPractitionerInvite) {
          Alert.alert(
            'Invitation Pending',
            'You already have a pending invitation. Wait for a response or cancel it in the web app first.'
          );
          return;
        }
      }
    } catch (checkError) {
      console.error('Error checking existing coach status:', checkError);
    }

    setSendingInvite(true);
    try {
      const idToken = await user?.getIdToken();
      
      const endpoint = __DEV__
        ? 'http://localhost:5001/inkwell-alpha/us-central1/sendPractitionerInvitation'
        : 'https://us-central1-inkwell-alpha.cloudfunctions.net/sendPractitionerInvitation';
      
      console.log('Sending invite to endpoint:', endpoint);
      console.log('Payload:', {
        practitionerEmail: inviteEmail.trim(),
        practitionerName: inviteName.trim() || inviteEmail.trim(),
        userEmail: user?.email,
      });
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          practitionerEmail: inviteEmail.trim(),
          practitionerName: inviteName.trim() || inviteEmail.trim(),
          userEmail: user?.email,
        }),
      });

      const responseText = await response.text();
      console.log('Response status:', response.status);
      console.log('Response:', responseText);

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${responseText}`);
      }

      Alert.alert(
        'Invitation Sent',
        `An invitation has been sent to ${inviteEmail}. They will appear in your coaches list once they accept.`,
      );
      
      setAddModalVisible(false);
      setInviteEmail('');
      setInviteName('');
      
      // Reload practitioners
      setTimeout(() => loadPractitioners(), 1000);
    } catch (error: any) {
      console.error('Error sending invite:', error);
      const errorMessage = error.message || error.toString();
      
      // Show more specific error for development
      if (__DEV__ && errorMessage.includes('Network request failed')) {
        Alert.alert(
          'Development Mode Error',
          'Cannot reach localhost:5001. This feature requires:\n\n' +
          '1. Firebase emulators running, OR\n' +
          '2. Change to production endpoint for testing\n\n' +
          'Actual error: ' + errorMessage
        );
      } else {
        Alert.alert('Error', 'Failed to send invitation. Please try again.\n\n' + errorMessage);
      }
    } finally {
      setSendingInvite(false);
    }
  };

  const handleRemovePractitioner = (practitionerId: string, practitionerName: string) => {
    Alert.alert(
      'Remove Coach',
      `Are you sure you want to remove ${practitionerName}? You will no longer be able to share journal entries with them.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!user) return;
              
              await firestore()
                .collection('users')
                .doc(user.uid)
                .update({
                  practitioners: firestore.FieldValue.arrayRemove(practitionerId),
                });
              
              await loadPractitioners();
              Alert.alert('Success', 'Coach removed');
            } catch (error) {
              console.error('Error removing practitioner:', error);
              Alert.alert('Error', 'Failed to remove coach');
            }
          },
        },
      ],
    );
  };

  const handleRequestAccountDeletion = async () => {
    if (!user) return;

    setDeletingAccount(true);
    try {
      const deletionDate = new Date();
      const scheduledDeletion = new Date(deletionDate);
      scheduledDeletion.setDate(scheduledDeletion.getDate() + 30);

      await firestore()
        .collection('users')
        .doc(user.uid)
        .set({
          deletionRequested: firestore.FieldValue.serverTimestamp(),
          deletionScheduledFor: firestore.Timestamp.fromDate(scheduledDeletion),
        }, { merge: true });

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
            // Navigation will automatically handle this via auth state change in App.tsx
          } catch (error) {
            console.error('Logout error:', error);
            Alert.alert('Error', 'Failed to logout. Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      {/* Account Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{user?.email || 'Not signed in'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>User ID</Text>
            <Text style={[styles.value, styles.small]} numberOfLines={1}>
              {user?.uid || 'N/A'}
            </Text>
          </View>
        </View>
      </View>

      {/* Subscription Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>✨ Subscription</Text>
        <View style={styles.subscriptionCard}>
          <View style={styles.subscriptionHeader}>
            <View style={{flex: 1}}>
              <Text style={styles.subscriptionLabel}>Current Plan:</Text>
              <View style={styles.subscriptionBadgeContainer}>
                {subscriptionLoading ? (
                  <ActivityIndicator size="small" color={colors.brandPrimary} />
                ) : (
                  <View style={[
                    styles.subscriptionBadge,
                    subscriptionTier === 'plus' && styles.subscriptionBadgePlus,
                    subscriptionTier === 'connect' && styles.subscriptionBadgeConnect,
                  ]}>
                    <Text style={styles.subscriptionBadgeText}>
                      {subscriptionTier === 'free' && 'Free'}
                      {subscriptionTier === 'plus' && 'Plus'}
                      {subscriptionTier === 'connect' && 'Connect'}
                    </Text>
                  </View>
                )}
              </View>
              {isActive && (
                <Text style={styles.subscriptionStatusText}>
                  Status: Active
                </Text>
              )}
            </View>
            {subscriptionTier !== 'connect' && (
              <TouchableOpacity
                style={styles.upgradeButton}
                onPress={handleUpgradePress}>
                <Text style={styles.upgradeButtonText}>
                  {subscriptionTier === 'free' ? 'Upgrade' : 'Manage'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          
          {subscriptionTier === 'free' && (
            <View style={styles.subscriptionPrompt}>
              <Text style={styles.subscriptionPromptText}>
                <Text style={{fontWeight: '600'}}>Plus:</Text> Unlimited AI prompts & reflections, InkOutLoud transcription, file attachments, email insights, SMS notifications{"\n\n"}
                <Text style={{fontWeight: '600'}}>Connect:</Text> All Plus features + certified coach support
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Help & Support Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Help & Support</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('Info')}>
          <Text style={styles.buttonText}>📖 Help & Tutorial</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.button}
          onPress={handleResetOnboarding}>
          <Text style={styles.buttonText}>🔄 Reset Welcome Tips</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Available Coaches Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connect with InkWell Coaches</Text>
        
        {!isConnect ? (
          <View style={styles.card}>
            <Text style={styles.lockedDescription}>
              🔒 Connect with certified coaches who can view your journal entries and provide professional support.
            </Text>
            <TouchableOpacity
              style={[styles.upgradePromptButton, styles.upgradeConnectButton]}
              onPress={() => Linking.openURL('https://inkwelljournal.io')}>
              <Text style={styles.upgradePromptButtonText}>🌐 Subscribe on inkwelljournal.io</Text>
            </TouchableOpacity>
            <Text style={styles.webSubscribeNote}>
              Connect subscriptions are managed through our website
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            {/* Show current connection if exists */}
            {practitioners.length > 0 ? (
              <>
                <View style={styles.connectedCoachCard}>
                  <Text style={styles.connectedLabel}>✓ Currently Connected</Text>
                  <Text style={styles.connectedCoachName}>{practitioners[0].name}</Text>
                  {practitioners[0].email && (
                    <Text style={styles.connectedCoachEmail}>{practitioners[0].email}</Text>
                  )}
                </View>
                
                {loadingApproved ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={colors.brandPrimary} />
                  </View>
                ) : approvedPractitioners.length > 0 && (
                  <>
                    <View style={styles.divider}>
                      <Text style={styles.dividerText}>— switch coach —</Text>
                    </View>
                    <Text style={styles.inputLabel}>Select Different Coach</Text>
                    <Picker
                      selectedValue={selectedApprovedId}
                      onValueChange={(value) => setSelectedApprovedId(value)}
                      style={[styles.picker, {color: colors.fontMain}]}
                      itemStyle={{...styles.pickerItem, color: colors.fontMain}}>
                      <Picker.Item label="Choose a coach..." value="" color={colors.fontMain} />
                      {approvedPractitioners.filter(p => p.id !== practitioners[0]?.id).map(pract => (
                        <Picker.Item
                          key={pract.id}
                          label={`${pract.name}${pract.credentials ? ` (${pract.credentials})` : ''}`}
                          value={pract.id}
                          color={colors.fontMain}
                        />
                      ))}
                    </Picker>
                    
                    {selectedApprovedId && (() => {
                      const selectedCoach = approvedPractitioners.find(p => p.id === selectedApprovedId);
                      if (!selectedCoach) return null;
                      return (
                        <View style={styles.coachBioContainer}>
                          <Text style={styles.coachBioName}>{selectedCoach.name}</Text>
                          {selectedCoach.credentials && (
                            <Text style={styles.coachBioCredentials}>{selectedCoach.credentials}</Text>
                          )}
                          {selectedCoach.practiceLocation && (
                            <Text style={styles.coachBioLocation}>📍 {selectedCoach.practiceLocation}</Text>
                          )}
                          {selectedCoach.bio && (
                            <Text style={styles.coachBioText}>{selectedCoach.bio}</Text>
                          )}
                        </View>
                      );
                    })()}
                    
                    <TouchableOpacity
                      style={[styles.modalButton, styles.modalSendButton, (connecting || !selectedApprovedId) && styles.modalButtonDisabled]}
                      onPress={handleConnectToApproved}
                      disabled={connecting || !selectedApprovedId}>
                      <Text style={styles.modalSendButtonText}>
                        {connecting ? 'Switching...' : 'Switch Coach'}
                      </Text>
                    </TouchableOpacity>
                    
                    <Text style={styles.coachSwitchNote}>
                      💡 You can change coaches once per billing cycle.
                    </Text>
                  </>
                )}
              </>
            ) : (
              <>
                <Text style={styles.approvedDescription}>
                  Choose from our verified coaches who are available to support InkWell users.
                </Text>
                
                {loadingApproved ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={colors.brandPrimary} />
                  </View>
                ) : approvedPractitioners.length === 0 ? (
                  <Text style={styles.emptyText}>
                    No practitioners available at this time.
                  </Text>
                ) : (
                  <>
                    <Text style={styles.inputLabel}>Select Coach</Text>
                    <Picker
                      selectedValue={selectedApprovedId}
                      onValueChange={(value) => setSelectedApprovedId(value)}
                      style={[styles.picker, {color: colors.fontMain}]}
                      itemStyle={{...styles.pickerItem, color: colors.fontMain}}>
                      <Picker.Item label="Choose a coach..." value="" color={colors.fontMain} />
                      {approvedPractitioners.map(pract => (
                        <Picker.Item
                          key={pract.id}
                          label={`${pract.name}${pract.credentials ? ` (${pract.credentials})` : ''}`}
                          value={pract.id}
                          color={colors.fontMain}
                        />
                      ))}
                    </Picker>
                    
                    {selectedApprovedId && (() => {
                      const selectedCoach = approvedPractitioners.find(p => p.id === selectedApprovedId);
                      if (!selectedCoach) return null;
                      return (
                        <View style={styles.coachBioContainer}>
                          <Text style={styles.coachBioName}>{selectedCoach.name}</Text>
                          {selectedCoach.credentials && (
                            <Text style={styles.coachBioCredentials}>{selectedCoach.credentials}</Text>
                          )}
                          {selectedCoach.practiceLocation && (
                            <Text style={styles.coachBioLocation}>📍 {selectedCoach.practiceLocation}</Text>
                          )}
                          {selectedCoach.bio && (
                            <Text style={styles.coachBioText}>{selectedCoach.bio}</Text>
                          )}
                        </View>
                      );
                    })()}
                    
                    <TouchableOpacity
                      style={[styles.modalButton, styles.modalSendButton, (connecting || !selectedApprovedId) && styles.modalButtonDisabled]}
                      onPress={handleConnectToApproved}
                      disabled={connecting || !selectedApprovedId}>
                      <Text style={styles.modalSendButtonText}>
                        {connecting ? 'Connecting...' : 'Connect to Coach'}
                      </Text>
                    </TouchableOpacity>
                    
                    <Text style={styles.coachSwitchNote}>
                      💡 You can change coaches once per billing cycle. Changes take effect immediately.
                    </Text>
                  </>
                )}
              </>
            )}
          </View>
        )}
        
        {isConnect && (
          <View style={styles.divider}>
            <Text style={styles.dividerText}>— or invite your own coach —</Text>
          </View>
        )}
        
        {isConnect && (
          <TouchableOpacity
            style={styles.inviteCoachButton}
            onPress={() => setAddModalVisible(true)}>
            <Text style={styles.inviteCoachButtonText}>✉️ Send Coach Invitation</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Email Insights Section */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>📧 Email Insights from Sophy</Text>
          {!isPremium && (
            <View style={[styles.tierBadge, styles.plusBadge]}>
              <Text style={styles.tierBadgeText}>Plus</Text>
            </View>
          )}
        </View>
        
        {!isPremium ? (
          <View style={styles.card}>
            <Text style={styles.lockedDescription}>
              🔒 Upgrade to Plus to receive personalized insights analyzing your journal patterns and mood trends.
            </Text>
            <TouchableOpacity
              style={styles.upgradePromptButton}
              onPress={() => checkFeatureAndShowPaywall('ai')}>
              <Text style={styles.upgradePromptButtonText}>Upgrade to Plus</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.insightsDescription}>
              Receive personalized insights analyzing your journal patterns and mood trends.
            </Text>
            
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text style={styles.switchTitle}>📅 Weekly Insights</Text>
                <Text style={styles.switchDescription}>Every Monday morning</Text>
              </View>
              <Switch
                value={weeklyInsightsEnabled}
                onValueChange={(value) => {
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
                <Text style={styles.switchTitle}>📅 Monthly Insights</Text>
                <Text style={styles.switchDescription}>First of every month</Text>
              </View>
              <Switch
                value={monthlyInsightsEnabled}
                onValueChange={(value) => {
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
                <Text style={styles.savingText}>Saving...</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Notifications Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔔 Notifications</Text>
        
        {/* Push Notifications Subsection - Free for all users */}
        <View style={styles.card}>
          <Text style={styles.subsectionTitle}>📱 Push Notifications</Text>
          <Text style={styles.insightsDescription}>
            Receive native phone notifications for prompts and reminders.
          </Text>
          
          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <Text style={styles.switchTitle}>Enable Push Notifications</Text>
            </View>
            <Switch
              value={pushEnabled}
              onValueChange={handlePushToggle}
              trackColor={{false: colors.borderMedium, true: colors.brandAlt}}
              thumbColor={pushEnabled ? colors.brandPrimary : colors.fontMuted}
            />
          </View>
          
          {pushEnabled && (
            <View style={styles.smsPreferences}>
              <Text style={styles.smsPreferencesTitle}>Notification Types:</Text>
              
              {/* Daily journal prompts - Free for all users */}
              <View style={styles.switchRowSmall}>
                <Text style={styles.switchTitleSmall}>✍️ Daily journal prompts</Text>
                <Switch
                  value={pushDailyPrompts}
                  onValueChange={setPushDailyPrompts}
                  trackColor={{false: colors.borderMedium, true: colors.brandAlt}}
                  thumbColor={pushDailyPrompts ? colors.brandPrimary : colors.fontMuted}
                />
              </View>
              
              {/* Plus-only notification types */}
              {isPremium ? (
                <>
                  <View style={styles.switchRowSmall}>
                    <Text style={styles.switchTitleSmall}>🌱 WISH milestone reminders</Text>
                    <Switch
                      value={pushWishMilestones}
                      onValueChange={setPushWishMilestones}
                      trackColor={{false: colors.borderMedium, true: colors.brandAlt}}
                      thumbColor={pushWishMilestones ? colors.brandPrimary : colors.fontMuted}
                    />
                  </View>
                  
                  <View style={styles.switchRowSmall}>
                    <Text style={styles.switchTitleSmall}>🙏 Daily gratitude from Sophy</Text>
                    <Switch
                      value={pushGratitudePrompts}
                      onValueChange={setPushGratitudePrompts}
                      trackColor={{false: colors.borderMedium, true: colors.brandAlt}}
                      thumbColor={pushGratitudePrompts ? colors.brandPrimary : colors.fontMuted}
                    />
                  </View>
                  
                  <View style={styles.switchRowSmall}>
                    <Text style={styles.switchTitleSmall}>💬 Coach replies</Text>
                    <Switch
                      value={pushCoachReplies}
                      onValueChange={setPushCoachReplies}
                      trackColor={{false: colors.borderMedium, true: colors.brandAlt}}
                      thumbColor={pushCoachReplies ? colors.brandPrimary : colors.fontMuted}
                    />
                  </View>
                  
                  <View style={styles.switchRowSmall}>
                    <Text style={styles.switchTitleSmall}>📊 Weekly insights</Text>
                    <Switch
                      value={pushWeeklyInsights}
                      onValueChange={setPushWeeklyInsights}
                      trackColor={{false: colors.borderMedium, true: colors.brandAlt}}
                      thumbColor={pushWeeklyInsights ? colors.brandPrimary : colors.fontMuted}
                    />
                  </View>
                </>
              ) : (
                <View style={styles.plusNotificationTypes}>
                  <Text style={styles.lockedNotificationText}>
                    🔒 Upgrade to Plus for additional notifications:
                  </Text>
                  <Text style={styles.lockedNotificationItem}>• 🌱 WISH milestone reminders</Text>
                  <Text style={styles.lockedNotificationItem}>• 🙏 Daily gratitude from Sophy</Text>
                  <Text style={styles.lockedNotificationItem}>• 💬 Coach replies</Text>
                  <Text style={styles.lockedNotificationItem}>• 📊 Weekly insights</Text>
                  <TouchableOpacity
                    style={styles.upgradePromptButton}
                    onPress={handleUpgradePress}>
                    <Text style={styles.upgradePromptButtonText}>Upgrade to Plus</Text>
                  </TouchableOpacity>
                </View>
              )}
              
              <TouchableOpacity
                style={[styles.saveButton, savingPush && styles.saveButtonDisabled]}
                onPress={() => savePushPreferences()}
                disabled={savingPush}>
                <Text style={styles.saveButtonText}>
                  {savingPush ? 'Saving...' : 'Save Push Preferences'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          
          {pushPermissionStatus === 'denied' && (
            <TouchableOpacity
              style={styles.openSettingsButton}
              onPress={() => notificationService.openSettings()}>
              <Text style={styles.openSettingsButtonText}>Open Device Settings</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {/* SMS Notifications Subsection - Plus feature */}
        <View style={[styles.card, {marginTop: spacing.md}]}>
          <View style={styles.subsectionTitleRow}>
            <Text style={styles.subsectionTitle}>💬 SMS Notifications</Text>
            {!isPremium && (
              <View style={[styles.tierBadge, styles.plusBadge]}>
                <Text style={styles.tierBadgeText}>Plus</Text>
              </View>
            )}
          </View>
          
          {!isPremium ? (
            <>
              <Text style={styles.lockedDescription}>
                🔒 Upgrade to Plus to receive daily prompts, gratitude messages, and milestone celebrations via text message.
              </Text>
              <TouchableOpacity
                style={styles.upgradePromptButton}
                onPress={() => checkFeatureAndShowPaywall('sms')}>
                <Text style={styles.upgradePromptButtonText}>Upgrade to Plus</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.insightsDescription}>
                Receive wellness reminders and insights from InkWell via text message.
              </Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Phone Number</Text>
                <View style={styles.phoneInputRow}>
                  <View style={styles.countryCodePicker}>
                    <Picker
                      selectedValue={countryCode}
                      onValueChange={(value) => setCountryCode(value)}
                      style={[styles.countryPicker, {color: colors.fontMain}]}
                      itemStyle={{...styles.countryPickerItem, color: colors.fontMain}}>
                      {COUNTRY_CODES.map((c) => (
                        <Picker.Item 
                          key={c.code} 
                          label={`${c.flag} ${c.code}`} 
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
                <Text style={styles.inputHint}>Select country code, then enter your number</Text>
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Timezone</Text>
                <Picker
                  selectedValue={selectedTimezone}
                  onValueChange={(value) => setSelectedTimezone(value)}
                  style={[styles.picker, {color: colors.fontMain}]}
                  itemStyle={{...styles.pickerItem, color: colors.fontMain}}>
                  {TIMEZONES.map((tz) => (
                    <Picker.Item 
                      key={tz.value} 
                      label={tz.label} 
                      value={tz.value}
                      color={colors.fontMain}
                    />
                  ))}
                </Picker>
              </View>
              
              <View style={styles.switchRow}>
                <View style={styles.switchLabel}>
                  <Text style={styles.switchTitle}>Enable SMS Notifications</Text>
                </View>
                <Switch
                  value={smsEnabled}
                  onValueChange={setSmsEnabled}
                  trackColor={{false: colors.borderMedium, true: colors.brandAlt}}
                  thumbColor={smsEnabled ? colors.brandPrimary : colors.fontMuted}
                />
              </View>
              
              {smsEnabled && (
                <View style={styles.smsPreferences}>
                  <Text style={styles.smsPreferencesTitle}>Notification Types:</Text>
                  
                  <View style={styles.switchRowSmall}>
                    <Text style={styles.switchTitleSmall}>🌱 WISH milestone reminders</Text>
                    <Switch
                      value={smsWishMilestones}
                      onValueChange={setSmsWishMilestones}
                      trackColor={{false: colors.borderMedium, true: colors.brandAlt}}
                      thumbColor={smsWishMilestones ? colors.brandPrimary : colors.fontMuted}
                    />
                  </View>
                  
                  <View style={styles.switchRowSmall}>
                    <Text style={styles.switchTitleSmall}>✍️ Daily journal prompts</Text>
                    <Switch
                      value={smsDailyPrompts}
                      onValueChange={setSmsDailyPrompts}
                      trackColor={{false: colors.borderMedium, true: colors.brandAlt}}
                      thumbColor={smsDailyPrompts ? colors.brandPrimary : colors.fontMuted}
                    />
                  </View>
                  
                  <View style={styles.switchRowSmall}>
                    <Text style={styles.switchTitleSmall}>🙏 Daily gratitude from Sophy</Text>
                    <Switch
                      value={smsGratitudePrompts}
                      onValueChange={setSmsGratitudePrompts}
                      trackColor={{false: colors.borderMedium, true: colors.brandAlt}}
                      thumbColor={smsGratitudePrompts ? colors.brandPrimary : colors.fontMuted}
                    />
                  </View>
                  
                  <View style={styles.switchRowSmall}>
                    <Text style={styles.switchTitleSmall}>💬 Coach replies</Text>
                    <Switch
                      value={smsCoachReplies}
                      onValueChange={setSmsCoachReplies}
                      trackColor={{false: colors.borderMedium, true: colors.brandAlt}}
                      thumbColor={smsCoachReplies ? colors.brandPrimary : colors.fontMuted}
                    />
                  </View>
                  
                  <View style={styles.switchRowSmall}>
                    <Text style={styles.switchTitleSmall}>📊 Weekly insights</Text>
                    <Switch
                      value={smsWeeklyInsights}
                      onValueChange={setSmsWeeklyInsights}
                      trackColor={{false: colors.borderMedium, true: colors.brandAlt}}
                      thumbColor={smsWeeklyInsights ? colors.brandPrimary : colors.fontMuted}
                    />
                  </View>
                </View>
              )}
              
              <TouchableOpacity
                style={[styles.saveButton, savingSms && styles.saveButtonDisabled]}
                onPress={saveSmsPreferences}
                disabled={savingSms}>
                <Text style={styles.saveButtonText}>
                  {savingSms ? 'Saving...' : 'Save SMS Preferences'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Export Data Section */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>📤 Export Data</Text>
          {!isPremium && (
            <View style={[styles.tierBadge, styles.plusBadge]}>
              <Text style={styles.tierBadgeText}>Plus</Text>
            </View>
          )}
        </View>
        
        {!isPremium ? (
          <View style={styles.card}>
            <Text style={styles.lockedFeatureText}>
              🔒 Upgrade to Plus to export your journal entries, manifests, and Sophy reflections as a downloadable file.
            </Text>
            <TouchableOpacity 
              style={styles.upgradePromptButton}
              onPress={handleUpgradePress}>
              <Text style={styles.upgradePromptButtonText}>Upgrade to Plus</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.exportDescription}>
              Download all your journal entries, WISH manifests, and Sophy reflections. Export as readable text or JSON format.
            </Text>
            <TouchableOpacity
              style={[styles.exportButton, exporting && styles.exportButtonDisabled]}
              onPress={handleExportData}
              disabled={exporting}>
              {exporting ? (
                <ActivityIndicator color={colors.fontWhite} size="small" />
              ) : (
                <Text style={styles.exportButtonText}>📥 Export My Data</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Theme Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎨 Appearance</Text>
        <View style={styles.card}>
          <Text style={styles.themeLabel}>Theme</Text>
          <View style={styles.themeOptions}>
            <TouchableOpacity
              style={[
                styles.themeOption,
                themeMode === 'light' && styles.themeOptionSelected,
              ]}
              onPress={() => setThemeMode('light')}>
              <Text style={styles.themeOptionIcon}>☀️</Text>
              <Text style={[
                styles.themeOptionText,
                themeMode === 'light' && styles.themeOptionTextSelected,
              ]}>Light</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.themeOption,
                themeMode === 'dark' && styles.themeOptionSelected,
              ]}
              onPress={() => setThemeMode('dark')}>
              <Text style={styles.themeOptionIcon}>🌙</Text>
              <Text style={[
                styles.themeOptionText,
                themeMode === 'dark' && styles.themeOptionTextSelected,
              ]}>Dark</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.themeOption,
                themeMode === 'system' && styles.themeOptionSelected,
              ]}
              onPress={() => setThemeMode('system')}>
              <Text style={styles.themeOptionIcon}>⚙️</Text>
              <Text style={[
                styles.themeOptionText,
                themeMode === 'system' && styles.themeOptionTextSelected,
              ]}>System</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.themeHint}>
            {themeMode === 'system' 
              ? `Currently using ${isDark ? 'dark' : 'light'} mode based on your device settings`
              : `${themeMode === 'dark' ? 'Dark' : 'Light'} mode active`}
          </Text>
        </View>
      </View>

      {/* App Info / About Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About & Help</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>App Version</Text>
            <Text style={styles.value}>1.0.0</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Build</Text>
            <Text style={styles.value}>Alpha</Text>
          </View>
        </View>
        
        {/* Crisis Resources Button (inside About section) */}
        <TouchableOpacity 
          style={styles.crisisButton}
          onPress={() => setCrisisExpanded(!crisisExpanded)}>
          <Text style={styles.crisisButtonText}>❤️‍🩹 Mental Health Crisis Resources</Text>
          <Text style={styles.crisisToggleIcon}>{crisisExpanded ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        
        {crisisExpanded && (
          <View style={styles.crisisContent}>
            <Text style={styles.crisisTitle}>🇺🇸 United States Crisis Resources</Text>
            <Text style={styles.crisisSubtitle}>If you're experiencing a mental health crisis:</Text>
            
            <TouchableOpacity 
              style={styles.crisisLink}
              onPress={() => Linking.openURL('tel:988')}>
              <Text style={styles.crisisLinkText}>📞 Call or text <Text style={styles.crisisBold}>988</Text> — Suicide & Crisis Lifeline</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.crisisLink}
              onPress={() => Linking.openURL('sms:741741&body=HOME')}>
              <Text style={styles.crisisLinkText}>💬 Text <Text style={styles.crisisBold}>HOME</Text> to <Text style={styles.crisisBold}>741741</Text> — Crisis Text Line</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.crisisLink}
              onPress={() => Linking.openURL('tel:1-800-273-8255')}>
              <Text style={styles.crisisLinkText}>🎖️ Call <Text style={styles.crisisBold}>1-800-273-8255</Text> — Veterans Crisis Line</Text>
            </TouchableOpacity>
            
            <Text style={styles.crisisInternational}>
              🌍 Outside the US? Please reach out to your local emergency services or mental health resources.
            </Text>
            
            <Text style={styles.crisisDisclaimer}>
              InkWell, Sophy, and all coaches are wellness tools — not emergency services or replacements for professional mental health care.
            </Text>
          </View>
        )}
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      {/* Delete Account Button */}
      <TouchableOpacity 
        style={styles.deleteAccountButton} 
        onPress={() => setDeleteModalVisible(true)}>
        <Text style={styles.deleteAccountText}>Delete Account</Text>
      </TouchableOpacity>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>InkWell by Pegasus Realm</Text>
        <Text style={styles.footerText}>© 2026 All rights reserved</Text>
      </View>

      {/* Paywall Modal - manual trigger */}
      <PaywallModal 
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
      />
      
      {/* Paywall Modal - feature gating trigger */}
      <PaywallModal 
        visible={showPaywall}
        onClose={closePaywall}
      />

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
                <Text style={styles.modalCloseButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.deleteWarningText}>
              ⚠️ This action will schedule your account for permanent deletion.
            </Text>

            <Text style={styles.modalDescription}>
              • All your journal entries will be deleted{`\n`}
              • Your coach connections will be removed{`\n`}
              • This cannot be undone after 30 days{`\n`}
              {`\n`}
              You have a 30-day grace period to cancel by logging in again.
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setDeleteModalVisible(false)}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.deleteConfirmButton, deletingAccount && styles.modalButtonDisabled]}
                onPress={handleRequestAccountDeletion}
                disabled={deletingAccount}>
                <Text style={styles.deleteConfirmButtonText}>
                  {deletingAccount ? 'Scheduling...' : 'Delete Account'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Coach Modal */}
      <Modal
        visible={addModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAddModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invite Coach</Text>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                <Text style={styles.modalCloseButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDescription}>
              Send an invitation to your coach. They will receive an email to set up their account.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Coach Name (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Dr. Smith"
                value={inviteName}
                onChangeText={setInviteName}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email Address *</Text>
              <TextInput
                style={styles.input}
                placeholder="coach@example.com"
                value={inviteEmail}
                onChangeText={setInviteEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setAddModalVisible(false)}
                disabled={sendingInvite}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalSendButton, sendingInvite && styles.modalButtonDisabled]}
                onPress={handleSendInvite}
                disabled={sendingInvite}>
                <Text style={styles.modalSendButtonText}>
                  {sendingInvite ? 'Sending...' : 'Send Invite'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// Dynamic styles based on theme colors
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  section: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.base,
  },
  sectionTitle: {
    fontFamily: fontFamily.button,
    fontSize: fontSize.sm,
    color: colors.fontSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  tierBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: spacing.sm,
  },
  plusBadge: {
    backgroundColor: colors.tierPlus,
  },
  connectBadge: {
    backgroundColor: colors.tierConnect,
  },
  tierBadgeText: {
    fontFamily: fontFamily.buttonBold,
    color: colors.fontWhite,
    fontSize: fontSize.xs,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  lockedDescription: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.fontSecondary,
    lineHeight: 22,
    marginBottom: spacing.base,
  },
  upgradePromptButton: {
    backgroundColor: colors.tierPlus,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  upgradeConnectButton: {
    backgroundColor: colors.tierConnect,
  },
  upgradePromptButtonText: {
    fontFamily: fontFamily.buttonBold,
    color: colors.fontWhite,
    fontSize: fontSize.base,
    letterSpacing: 0.5,
  },
  webSubscribeNote: {
    textAlign: 'center',
    fontSize: fontSize.xs,
    fontFamily: fontFamily.body,
    color: colors.fontSecondary,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
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
  small: {
    fontSize: fontSize.xs,
  },
  button: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
    color: colors.fontMain,
  },
  chevron: {
    fontSize: fontSize.xxl,
    color: colors.brandPrimary,
  },
  logoutButton: {
    marginHorizontal: spacing.base,
    marginTop: spacing.xxl,
    backgroundColor: colors.btnDanger,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  logoutText: {
    fontFamily: fontFamily.buttonBold,
    fontSize: fontSize.md,
    color: colors.fontWhite,
    letterSpacing: 0.5,
  },
  deleteAccountButton: {
    marginHorizontal: spacing.base,
    marginTop: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.btnDanger,
  },
  deleteAccountText: {
    fontFamily: fontFamily.buttonBold,
    fontSize: fontSize.md,
    color: colors.btnDanger,
    letterSpacing: 0.5,
  },
  deleteWarningText: {
    fontFamily: fontFamily.header,
    fontSize: fontSize.md,
    color: colors.btnDanger,
    marginBottom: spacing.base,
    textAlign: 'center',
  },
  deleteConfirmButton: {
    backgroundColor: colors.btnDanger,
  },
  deleteConfirmButtonText: {
    fontFamily: fontFamily.buttonBold,
    fontSize: fontSize.md,
    color: colors.fontWhite,
    letterSpacing: 0.5,
  },
  // Crisis Resources styles (inside About section)
  crisisButton: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dc3545',
    marginTop: spacing.md,
  },
  crisisButtonText: {
    fontFamily: fontFamily.button,
    fontSize: fontSize.sm,
    color: '#dc3545',
    flex: 1,
  },
  crisisToggleIcon: {
    fontSize: fontSize.sm,
    color: '#dc3545',
  },
  crisisContent: {
    backgroundColor: '#fff5f5',
    borderRadius: borderRadius.md,
    padding: spacing.base,
    marginTop: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: '#dc3545',
  },
  crisisTitle: {
    fontFamily: fontFamily.header,
    fontSize: fontSize.md,
    color: '#dc3545',
    marginBottom: spacing.sm,
  },
  crisisSubtitle: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.fontMain,
    marginBottom: spacing.base,
  },
  crisisLink: {
    backgroundColor: colors.bgCard,
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
    color: '#dc3545',
  },
  crisisInternational: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.fontSecondary,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  crisisDisclaimer: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.fontMuted,
    fontStyle: 'italic',
    marginTop: spacing.sm,
    lineHeight: 16,
  },
  footer: {
    marginTop: spacing.xxxl,
    marginBottom: spacing.xxl,
    alignItems: 'center',
  },
  footerText: {
    fontFamily: fontFamily.button,
    fontSize: fontSize.xs,
    color: colors.fontMuted,
    marginVertical: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  addButton: {
    backgroundColor: colors.brandPrimary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  addButtonText: {
    fontFamily: fontFamily.buttonBold,
    color: colors.fontWhite,
    fontSize: fontSize.sm,
    letterSpacing: 0.5,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.fontMuted,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 22,
  },
  practitionerRow: {
    paddingVertical: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  practitionerRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  practitionerInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  practitionerName: {
    fontFamily: fontFamily.header,
    fontSize: fontSize.md,
    color: colors.fontMain,
    marginBottom: 4,
  },
  practitionerEmail: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.fontSecondary,
  },
  removeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(229, 62, 62, 0.15)',
    borderRadius: borderRadius.sm,
  },
  removeButtonText: {
    fontFamily: fontFamily.button,
    fontSize: fontSize.sm,
    color: colors.btnDanger,
  },
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
  },
  modalDescription: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.fontSecondary,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  inputGroup: {
    marginBottom: spacing.base,
    width: '100%',
  },
  inputLabel: {
    fontFamily: fontFamily.button,
    fontSize: fontSize.sm,
    color: colors.brandLight,
    marginBottom: spacing.sm,
  },
  input: {
    fontFamily: fontFamily.body,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.fontMain,
    backgroundColor: colors.bgCard,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  modalButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    minWidth: 100,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: colors.bgMuted,
  },
  modalSendButton: {
    backgroundColor: colors.brandPrimary,
  },
  modalButtonText: {
    fontFamily: fontFamily.button,
    fontSize: fontSize.md,
    color: colors.fontSecondary,
  },
  modalSendButtonText: {
    fontFamily: fontFamily.buttonBold,
    fontSize: fontSize.md,
    color: colors.fontWhite,
    letterSpacing: 0.5,
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  approvedDescription: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.fontSecondary,
    marginBottom: spacing.base,
    lineHeight: 22,
  },
  connectedCoachCard: {
    backgroundColor: colors.bgMuted,
    borderRadius: borderRadius.md,
    padding: spacing.base,
    marginBottom: spacing.base,
    borderLeftWidth: 4,
    borderLeftColor: colors.tierConnect,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  connectedLabel: {
    fontFamily: fontFamily.button,
    fontSize: fontSize.xs,
    color: colors.tierConnect,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  connectedCoachName: {
    fontFamily: fontFamily.header,
    fontSize: fontSize.lg,
    color: colors.brandLight,
    marginBottom: 2,
  },
  connectedCoachEmail: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.fontSecondary,
  },
  divider: {
    marginTop: spacing.base,
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  dividerText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.fontMuted,
    fontStyle: 'italic',
  },
  picker: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: borderRadius.md,
    marginBottom: spacing.base,
    height: 44,
    color: colors.fontMain,
  },
  pickerItem: {
    fontSize: fontSize.md,
    height: 44,
    color: colors.fontMain,
  },
  coachBioContainer: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.base,
    marginBottom: spacing.base,
    borderLeftWidth: 3,
    borderLeftColor: colors.tierConnect,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  coachBioName: {
    fontFamily: fontFamily.header,
    fontSize: fontSize.lg,
    color: colors.fontMain,
    marginBottom: 4,
  },
  coachBioCredentials: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.tierConnect,
    fontWeight: '600',
    marginBottom: 4,
  },
  coachBioLocation: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.fontSecondary,
    marginBottom: spacing.sm,
  },
  coachBioText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.fontSecondary,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  coachSwitchNote: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.fontMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  inviteCoachButton: {
    backgroundColor: colors.bgMuted,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderMedium,
    marginTop: spacing.sm,
  },
  inviteCoachButtonText: {
    fontFamily: fontFamily.button,
    fontSize: fontSize.md,
    color: colors.tierConnect,
  },
  insightsDescription: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.fontSecondary,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  switchLabel: {
    flex: 1,
    marginRight: spacing.md,
  },
  switchTitle: {
    fontFamily: fontFamily.header,
    fontSize: fontSize.md,
    color: colors.fontMain,
    marginBottom: 4,
  },
  switchDescription: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.fontSecondary,
  },
  savingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.base,
    paddingTop: spacing.base,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  savingText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.brandPrimary,
    marginLeft: spacing.sm,
    fontStyle: 'italic',
  },
  subscriptionCard: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 2,
    borderColor: colors.tierConnect,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subscriptionLabel: {
    fontFamily: fontFamily.button,
    fontSize: fontSize.sm,
    color: colors.fontSecondary,
    marginBottom: spacing.sm,
  },
  subscriptionBadgeContainer: {
    marginBottom: 4,
  },
  subscriptionBadge: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.tierFree,
    alignSelf: 'flex-start',
  },
  subscriptionBadgePlus: {
    backgroundColor: colors.tierPlus,
  },
  subscriptionBadgeConnect: {
    backgroundColor: colors.tierConnect,
  },
  subscriptionBadgeText: {
    fontFamily: fontFamily.buttonBold,
    color: colors.fontWhite,
    fontSize: fontSize.md,
    letterSpacing: 0.5,
  },
  subscriptionStatusText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.fontSecondary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  upgradeButton: {
    backgroundColor: colors.tierConnect,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  upgradeButtonText: {
    fontFamily: fontFamily.buttonBold,
    color: colors.fontWhite,
    fontSize: fontSize.sm,
    letterSpacing: 0.5,
  },
  subscriptionPrompt: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  subscriptionPromptText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.fontSecondary,
    lineHeight: 22,
  },
  // SMS Section Styles
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  countryCodePicker: {
    width: 120,
    height: 50,
    backgroundColor: colors.bgMuted,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  countryPicker: {
    height: 50,
    width: '100%',
    color: colors.fontMain,
  },
  countryPickerItem: {
    fontSize: fontSize.md,
    color: colors.fontMain,
    height: 50,
  },
  phoneNumberInput: {
    flex: 1,
    fontFamily: fontFamily.body,
    backgroundColor: colors.bgMuted,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    color: colors.fontMain,
    height: 50,
  },
  smsInput: {
    fontFamily: fontFamily.body,
    backgroundColor: colors.bgMuted,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    color: colors.fontMain,
  },
  inputHint: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.fontMuted,
    marginTop: 4,
  },
  smsPreferences: {
    marginTop: spacing.base,
    paddingTop: spacing.base,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  smsPreferencesTitle: {
    fontFamily: fontFamily.button,
    fontSize: fontSize.sm,
    color: colors.fontSecondary,
    marginBottom: spacing.md,
  },
  switchRowSmall: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  switchTitleSmall: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.fontMain,
    flex: 1,
  },
  saveButton: {
    backgroundColor: colors.brandPrimary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.base,
  },
  saveButtonDisabled: {
    backgroundColor: colors.fontMuted,
  },
  saveButtonText: {
    fontFamily: fontFamily.buttonBold,
    color: colors.fontWhite,
    fontSize: fontSize.md,
    letterSpacing: 0.5,
  },
  // Export Section Styles
  lockedFeatureText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.fontSecondary,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  exportDescription: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.fontSecondary,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  exportButton: {
    backgroundColor: colors.brandPrimary,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  exportButtonDisabled: {
    backgroundColor: colors.fontMuted,
  },
  exportButtonText: {
    fontFamily: fontFamily.buttonBold,
    color: colors.fontWhite,
    fontSize: fontSize.md,
    letterSpacing: 0.5,
  },
  // Theme Selector Styles
  themeLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.md,
    color: colors.fontMain,
    marginBottom: spacing.md,
  },
  themeOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  themeOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.borderLight,
    backgroundColor: colors.bgMuted,
  },
  themeOptionSelected: {
    borderColor: colors.brandPrimary,
    backgroundColor: colors.brandPrimaryRgba,
  },
  themeOptionIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  themeOptionText: {
    fontFamily: fontFamily.button,
    fontSize: fontSize.sm,
    color: colors.fontSecondary,
  },
  themeOptionTextSelected: {
    fontFamily: fontFamily.buttonBold,
    color: colors.brandPrimary,
  },
  themeHint: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.fontMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Plus notification types locked state
  plusNotificationTypes: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  lockedNotificationText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.fontSecondary,
    marginBottom: spacing.sm,
  },
  lockedNotificationItem: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.fontMuted,
    marginLeft: spacing.sm,
    marginBottom: 4,
  },
  // Push Notification Styles
  subsectionTitle: {
    fontFamily: fontFamily.header,
    fontSize: fontSize.lg,
    color: colors.fontMain,
    marginBottom: spacing.sm,
  },
  subsectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  permissionWarning: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.btnWarning,
    marginTop: 2,
  },
  openSettingsButton: {
    backgroundColor: colors.bgMuted,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  openSettingsButtonText: {
    fontFamily: fontFamily.button,
    fontSize: fontSize.sm,
    color: colors.brandPrimary,
  },
});
