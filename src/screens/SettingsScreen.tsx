import React, {useState, useEffect} from 'react';
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
} from 'react-native';
import {Picker} from '@react-native-picker/picker';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {colors, spacing, borderRadius, fontFamily, fontSize} from '../theme';
import type {RootStackScreenProps} from '../navigation/types';
import {useSubscription} from '../hooks/useSubscription';
import PaywallModal from '../components/PaywallModal';

export default function SettingsScreen({
  navigation,
}: RootStackScreenProps<'Settings'>) {
  const user = auth().currentUser;
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
  }, []);

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
          name: doc.data()?.displayName || doc.data()?.email || 'Practitioner',
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
      const snapshot = await firestore()
        .collection('approvedPractitioners')
        .where('status', '==', 'active')
        .get();
      
      const approved = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || 'Practitioner',
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
      
      if (userData?.smsPreferences) {
        setPhoneNumber(userData.smsPreferences.phoneNumber || '');
        setSmsEnabled(userData.smsPreferences.enabled || false);
        setSelectedTimezone(userData.smsPreferences.timezone || 'America/New_York');
        setSmsWishMilestones(userData.smsPreferences.wishMilestones !== false);
        setSmsDailyPrompts(userData.smsPreferences.dailyPrompts || false);
        setSmsGratitudePrompts(userData.smsPreferences.gratitudePrompts !== false);
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
      await firestore()
        .collection('users')
        .doc(user.uid)
        .set({
          smsPreferences: {
            phoneNumber: phoneNumber.replace(/\s/g, ''),
            enabled: smsEnabled,
            timezone: selectedTimezone,
            wishMilestones: smsWishMilestones,
            dailyPrompts: smsDailyPrompts,
            gratitudePrompts: smsGratitudePrompts,
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

  const handleConnectToApproved = async () => {
    if (!selectedApprovedId) {
      Alert.alert('Error', 'Please select a practitioner from the list');
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
      console.error('Error connecting to practitioner:', error);
      Alert.alert('Error', 'Failed to connect to practitioner. Please try again.');
    } finally {
      setConnecting(false);
    }
  };

  const handleSendInvite = async () => {
    if (!inviteEmail.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
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
        `An invitation has been sent to ${inviteEmail}. They will appear in your practitioners list once they accept.`,
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
      'Remove Practitioner',
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
              Alert.alert('Success', 'Practitioner removed');
            } catch (error) {
              console.error('Error removing practitioner:', error);
              Alert.alert('Error', 'Failed to remove practitioner');
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
                <Text style={{fontWeight: '600'}}>Connect:</Text> All Plus features + licensed practitioner support
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

      {/* Available Practitioners Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connect with InkWell Practitioners</Text>
        
        {!isConnect ? (
          <View style={styles.card}>
            <Text style={styles.lockedDescription}>
              🔒 Upgrade to Connect to work with licensed practitioners who can view your journal entries and provide professional support.
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
              Choose from our verified practitioners who are available to support InkWell users.
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
                <Text style={styles.inputLabel}>Select Practitioner</Text>
                <Picker
                  selectedValue={selectedApprovedId}
                  onValueChange={(value) => setSelectedApprovedId(value)}
                  style={styles.picker}
                  itemStyle={styles.pickerItem}>
                  <Picker.Item label="Choose a practitioner..." value="" />
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
                    {connecting ? 'Connecting...' : 'Connect to Practitioner'}
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

      {/* My Practitioners Section - only show for Connect users */}
      {isConnect && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Practitioners</Text>
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
                No practitioners added yet. Add a practitioner to share journal entries and get support.
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

      {/* SMS Notifications Section */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>📱 SMS Notifications</Text>
          {!isPremium && (
            <View style={[styles.tierBadge, styles.plusBadge]}>
              <Text style={styles.tierBadgeText}>Plus</Text>
            </View>
          )}
        </View>
        
        {!isPremium ? (
          <View style={styles.card}>
            <Text style={styles.lockedDescription}>
              🔒 Upgrade to Plus to receive daily prompts, gratitude messages, and milestone celebrations delivered right to your phone.
            </Text>
            <TouchableOpacity
              style={styles.upgradePromptButton}
              onPress={() => checkFeatureAndShowPaywall('sms')}>
              <Text style={styles.upgradePromptButtonText}>Upgrade to Plus</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.insightsDescription}>
              Stay connected with wellness reminders and insights from InkWell via text message.
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
          </View>
        )}
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
              • Your practitioner connections will be removed{`\n`}
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

      {/* Add Practitioner Modal */}
      <Modal
        visible={addModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAddModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invite Practitioner</Text>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                <Text style={styles.modalCloseButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDescription}>
              Send an invitation to your practitioner or coach. They will receive an email to set up their account.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Practitioner Name (Optional)</Text>
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
                placeholder="practitioner@example.com"
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

const styles = StyleSheet.create({
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
});
