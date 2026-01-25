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
import PaywallModal from '../components/PaywallModal';
import notificationService, {PushNotificationPreferences} from '../services/notificationService';

export default function SettingsScreen({
  navigation,
}: RootStackScreenProps<'Settings'>) {
  const user = auth().currentUser;
  const {colors, themeMode, setThemeMode, isDark} = useTheme();
  
  // Create styles with current theme colors
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const [practitioners, setPractitioners] = useState<Array<{id: string; name: string; email: string}>>([]);
  const [loadingPractitioners, setLoadingPractitioners] = useState(true);
  const [approvedPractitioners, setApprovedPractitioners] = useState<Array<{id: string; name: string; email: string; specialties?: string[]}>>([]);
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
  
  // SMS Notifications state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [smsWishMilestones, setSmsWishMilestones] = useState(true);
  const [smsDailyPrompts, setSmsDailyPrompts] = useState(false);
  const [smsGratitudePrompts, setSmsGratitudePrompts] = useState(true);
  const [smsCoachReplies, setSmsCoachReplies] = useState(true);
  const [smsWeeklyInsights, setSmsWeeklyInsights] = useState(false);
  const [savingSms, setSavingSms] = useState(false);
  const [selectedTimezone, setSelectedTimezone] = useState('America/New_York');
  
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
      
      if (!userData?.practitioners || userData.practitioners.length === 0) {
        setPractitioners([]);
        setLoadingPractitioners(false);
        return;
      }

      const practitionerDocs = await Promise.all(
        userData.practitioners.map((practId: string) =>
          firestore().collection('practitioners').doc(practId).get()
        )
      );

      const loadedPractitioners = practitionerDocs
        .filter(doc => doc.exists)
        .map(doc => ({
          id: doc.id,
          name: doc.data()?.displayName || doc.data()?.email || 'Coach',
          email: doc.data()?.email || '',
        }));

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
      // Query users collection for anyone with userRole 'coach' or accountType 'coach'
      const snapshot = await firestore()
        .collection('users')
        .where('userRole', '==', 'coach')
        .get();
      
      const approved = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().displayName || doc.data().signupUsername || 'Coach',
        email: doc.data().email || '',
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

    // Validate phone number format
    const phoneRegex = /^\+[1-9]\d{6,14}$/;
    if (smsEnabled && phoneNumber && !phoneRegex.test(phoneNumber.replace(/\s/g, ''))) {
      Alert.alert('Invalid Phone Number', 'Please enter a valid phone number with country code (e.g., +15551234567)');
      return;
    }

    setSavingSms(true);
    try {
      const cleanPhone = phoneNumber.replace(/\s/g, '');
      
      await firestore()
        .collection('users')
        .doc(user.uid)
        .set({
          // Save at root level for web app compatibility
          phoneNumber: cleanPhone,
          timezone: selectedTimezone,
          smsOptIn: smsEnabled,
          // Also save in smsPreferences for detailed preferences
          smsPreferences: {
            phoneNumber: cleanPhone,
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
        Alert.alert('Success', 'Push notifications enabled!');
      } else {
        Alert.alert('Error', 'Could not enable push notifications. Please check your device settings.');
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
          createdAt: data.createdAt?.toDate()?.toISOString() || null,
          promptUsed: data.promptUsed || null,
          reflectionUsed: data.reflectionUsed || null,
          tags: data.tags || [],
          attachmentNames: data.attachments?.map((a: any) => a.name) || [],
        };
      });

      // Collect manifests
      const manifestsSnapshot = await firestore()
        .collection('manifests')
        .doc(user.uid)
        .collection('entries')
        .orderBy('createdAt', 'desc')
        .get();

      const manifests = manifestsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          date: data.date || '',
          wish: data.wish || '',
          outcome: data.outcome || '',
          opposition: data.opposition || '',
          plan: data.plan || '',
          createdAt: data.createdAt?.toDate()?.toISOString() || null,
        };
      });

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

    setConnecting(true);
    try {
      await firestore()
        .collection('users')
        .doc(user.uid)
        .set({
          connectedPractitioner: {
            email: selectedPractitioner.email,
            name: selectedPractitioner.name,
            connectedAt: firestore.FieldValue.serverTimestamp(),
            connectionType: 'approved_selection',
          },
        }, { merge: true });

      Alert.alert(
        'Connected!',
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
                  <ActivityIndicator size="small" color="#2A6972" />
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

      {/* ew>

      {/* Help & Support Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Help & Support</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('Info')}>
          <Text style={styles.buttonText}>📖 Help & Tutorial</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Available Coaches Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connect with InkWell Coaches</Text>
        
        {!isConnect ? (
          <View style={styles.card}>
            <Text style={styles.lockedDescription}>
              🔒 Upgrade to Connect to work with certified coaches who can view your journal entries and provide professional support.
            </Text>
            <TouchableOpacity
              style={[styles.upgradePromptButton, styles.upgradeConnectButton]}
              onPress={() => checkFeatureAndShowPaywall('practitioner')}>
              <Text style={styles.upgradePromptButtonText}>Upgrade to Connect</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.approvedDescription}>
              Choose from our verified coaches who are available to support InkWell users.
            </Text>
            
            {loadingApproved ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#2A6972" />
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
                  style={styles.picker}
                  itemStyle={styles.pickerItem}>
                  <Picker.Item label="Choose a coach..." value="" />
                  {approvedPractitioners.map(pract => (
                    <Picker.Item
                      key={pract.id}
                      label={pract.name}
                      value={pract.id}
                    />
                  ))}
                </Picker>
                
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalSendButton, (connecting || !selectedApprovedId) && styles.modalButtonDisabled]}
                  onPress={handleConnectToApproved}
                  disabled={connecting || !selectedApprovedId}>
                  <Text style={styles.modalSendButtonText}>
                    {connecting ? 'Connecting...' : 'Connect to Coach'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
        
        {isConnect && (
          <View style={styles.divider}>
            <Text style={styles.dividerText}>— or invite your own —</Text>
          </View>
        )}
      </View>

      {/* My Coaches Section - only show for Connect users */}
      {isConnect && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Coaches</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setAddModalVisible(true)}>
              <Text style={styles.addButtonText}>+ Add</Text>
            </TouchableOpacity>
          </View>
          
          {loadingPractitioners ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#2A6972" />
            </View>
          ) : practitioners.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.emptyText}>
                No coaches added yet. Add a coach to share journal entries and get support.
              </Text>
            </View>
          ) : (
            <View style={styles.card}>
              {practitioners.map((pract, index) => (
                <View
                  key={pract.id}
                  style={[
                    styles.practitionerRow,
                    index !== practitioners.length - 1 && styles.practitionerRowBorder,
                ]}>
                <View style={styles.practitionerInfo}>
                  <Text style={styles.practitionerName}>{pract.name}</Text>
                  <Text style={styles.practitionerEmail}>{pract.email}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleRemovePractitioner(pract.id, pract.name)}
                  style={styles.removeButton}>
                  <Text style={styles.removeButtonText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>
      )}

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
                trackColor={{false: '#E0E0E0', true: '#4A9BA8'}}
                thumbColor={weeklyInsightsEnabled ? '#2A6972' : '#999'}
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
                trackColor={{false: '#E0E0E0', true: '#4A9BA8'}}
                thumbColor={monthlyInsightsEnabled ? '#2A6972' : '#999'}
                disabled={savingInsights}
              />
            </View>
            
            {savingInsights && (
              <View style={styles.savingIndicator}>
                <ActivityIndicator size="small" color="#2A6972" />
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
              trackColor={{false: '#E0E0E0', true: '#4A9BA8'}}
              thumbColor={pushEnabled ? '#2A6972' : '#999'}
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
                  trackColor={{false: '#E0E0E0', true: '#4A9BA8'}}
                  thumbColor={pushDailyPrompts ? '#2A6972' : '#999'}
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
                      trackColor={{false: '#E0E0E0', true: '#4A9BA8'}}
                      thumbColor={pushWishMilestones ? '#2A6972' : '#999'}
                    />
                  </View>
                  
                  <View style={styles.switchRowSmall}>
                    <Text style={styles.switchTitleSmall}>🙏 Daily gratitude from Sophy</Text>
                    <Switch
                      value={pushGratitudePrompts}
                      onValueChange={setPushGratitudePrompts}
                      trackColor={{false: '#E0E0E0', true: '#4A9BA8'}}
                      thumbColor={pushGratitudePrompts ? '#2A6972' : '#999'}
                    />
                  </View>
                  
                  <View style={styles.switchRowSmall}>
                    <Text style={styles.switchTitleSmall}>💬 Coach replies</Text>
                    <Switch
                      value={pushCoachReplies}
                      onValueChange={setPushCoachReplies}
                      trackColor={{false: '#E0E0E0', true: '#4A9BA8'}}
                      thumbColor={pushCoachReplies ? '#2A6972' : '#999'}
                    />
                  </View>
                  
                  <View style={styles.switchRowSmall}>
                    <Text style={styles.switchTitleSmall}>📊 Weekly insights</Text>
                    <Switch
                      value={pushWeeklyInsights}
                      onValueChange={setPushWeeklyInsights}
                      trackColor={{false: '#E0E0E0', true: '#4A9BA8'}}
                      thumbColor={pushWeeklyInsights ? '#2A6972' : '#999'}
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
                <TextInput
                  style={styles.smsInput}
                  placeholder="+1 555 123 4567"
                  placeholderTextColor="#999"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                />
                <Text style={styles.inputHint}>Format: +15551234567 (include country code)</Text>
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Timezone</Text>
                <Picker
                  selectedValue={selectedTimezone}
                  onValueChange={(value) => setSelectedTimezone(value)}
                  style={styles.picker}
                  itemStyle={styles.pickerItem}>
                  <Picker.Item label="Hawaii (Pacific/Honolulu)" value="Pacific/Honolulu" />
                  <Picker.Item label="Alaska (America/Anchorage)" value="America/Anchorage" />
                  <Picker.Item label="Pacific Time (America/Los_Angeles)" value="America/Los_Angeles" />
                  <Picker.Item label="Mountain Time (America/Denver)" value="America/Denver" />
                  <Picker.Item label="Arizona (America/Phoenix)" value="America/Phoenix" />
                  <Picker.Item label="Central Time (America/Chicago)" value="America/Chicago" />
                  <Picker.Item label="Eastern Time (America/New_York)" value="America/New_York" />
                  <Picker.Item label="London (Europe/London)" value="Europe/London" />
                  <Picker.Item label="Paris (Europe/Paris)" value="Europe/Paris" />
                  <Picker.Item label="Sydney (Australia/Sydney)" value="Australia/Sydney" />
                </Picker>
              </View>
              
              <View style={styles.switchRow}>
                <View style={styles.switchLabel}>
                  <Text style={styles.switchTitle}>Enable SMS Notifications</Text>
                </View>
                <Switch
                  value={smsEnabled}
                  onValueChange={setSmsEnabled}
                  trackColor={{false: '#E0E0E0', true: '#4A9BA8'}}
                  thumbColor={smsEnabled ? '#2A6972' : '#999'}
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
                      trackColor={{false: '#E0E0E0', true: '#4A9BA8'}}
                      thumbColor={smsWishMilestones ? '#2A6972' : '#999'}
                    />
                  </View>
                  
                  <View style={styles.switchRowSmall}>
                    <Text style={styles.switchTitleSmall}>✍️ Daily journal prompts</Text>
                    <Switch
                      value={smsDailyPrompts}
                      onValueChange={setSmsDailyPrompts}
                      trackColor={{false: '#E0E0E0', true: '#4A9BA8'}}
                      thumbColor={smsDailyPrompts ? '#2A6972' : '#999'}
                    />
                  </View>
                  
                  <View style={styles.switchRowSmall}>
                    <Text style={styles.switchTitleSmall}>🙏 Daily gratitude from Sophy</Text>
                    <Switch
                      value={smsGratitudePrompts}
                      onValueChange={setSmsGratitudePrompts}
                      trackColor={{false: '#E0E0E0', true: '#4A9BA8'}}
                      thumbColor={smsGratitudePrompts ? '#2A6972' : '#999'}
                    />
                  </View>
                  
                  <View style={styles.switchRowSmall}>
                    <Text style={styles.switchTitleSmall}>💬 Coach replies</Text>
                    <Switch
                      value={smsCoachReplies}
                      onValueChange={setSmsCoachReplies}
                      trackColor={{false: '#E0E0E0', true: '#4A9BA8'}}
                      thumbColor={smsCoachReplies ? '#2A6972' : '#999'}
                    />
                  </View>
                  
                  <View style={styles.switchRowSmall}>
                    <Text style={styles.switchTitleSmall}>📊 Weekly insights</Text>
                    <Switch
                      value={smsWeeklyInsights}
                      onValueChange={setSmsWeeklyInsights}
                      trackColor={{false: '#E0E0E0', true: '#4A9BA8'}}
                      thumbColor={smsWeeklyInsights ? '#2A6972' : '#999'}
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
                <ActivityIndicator color="#fff" size="small" />
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

      {/* App Info Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
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
    backgroundColor: '#FEE2E2',
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
    color: colors.fontMain,
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
    backgroundColor: colors.bgMuted,
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
    backgroundColor: colors.bgMuted,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: borderRadius.md,
    marginBottom: spacing.base,
    height: 44,
  },
  pickerItem: {
    fontSize: fontSize.md,
    height: 44,
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
    backgroundColor: colors.fontSecondary,
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
    color: '#F59E0B',
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
