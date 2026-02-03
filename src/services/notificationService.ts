import messaging from '@react-native-firebase/messaging';
import firestore from '@react-native-firebase/firestore';
import {Platform, PermissionsAndroid, Linking, Alert} from 'react-native';
import { navigateToPastEntries } from './navigationService';

export interface PushNotificationPreferences {
  enabled: boolean;
  dailyPrompts: boolean;
  gratitudePrompts: boolean;
  wishMilestones: boolean;
  coachReplies: boolean;
  weeklyInsights: boolean;
}

class NotificationService {
  private initialized = false;

  // Check if push notifications are authorized
  // IMPORTANT: Firebase's hasPermission() and requestPermission() both cache values
  // and don't reflect changes made in iOS Settings.
  // The most reliable method is to try to get an FCM token - iOS won't give us one
  // if notifications are disabled in Settings.
  async checkPermissionStatus(): Promise<'authorized' | 'denied' | 'not_determined'> {
    try {
      if (Platform.OS === 'ios') {
        // On iOS, the only reliable way to check if notifications are CURRENTLY enabled
        // is to try to get an FCM token. iOS will not provide a token if the user
        // has disabled notifications in Settings.
        console.log('🔔 iOS: Checking permission by attempting to get FCM token...');
        
        try {
          // First register for remote messages
          await messaging().registerDeviceForRemoteMessages();
          
          // Try to get the token - this will fail or return null if notifications disabled
          const token = await messaging().getToken();
          
          if (token && token.length > 0) {
            console.log('🔔 iOS: Got FCM token, notifications ARE enabled');
            return 'authorized';
          } else {
            console.log('🔔 iOS: No FCM token returned, checking Firebase status...');
            // Fall back to Firebase status check
            const authStatus = await messaging().hasPermission();
            if (authStatus === messaging.AuthorizationStatus.NOT_DETERMINED) {
              return 'not_determined';
            }
            return 'denied';
          }
        } catch (tokenError: any) {
          console.log('🔔 iOS: Token error:', tokenError?.message);
          
          // Check if this is just a setup issue vs actual denial
          if (tokenError?.message?.includes('aps-environment') || 
              tokenError?.message?.includes('not registered') ||
              tokenError?.message?.includes('APNS')) {
            // This is a development/configuration issue, not user denial
            console.log('🔔 iOS: APNS not configured, treating as not_determined');
            return 'not_determined';
          }
          
          // User has likely denied notifications
          console.log('🔔 iOS: Token retrieval failed, likely denied');
          return 'denied';
        }
      } else {
        // On Android, hasPermission is reliable
        const authStatus = await messaging().hasPermission();
        console.log('🔔 Android permission check:', authStatus);
        
        if (authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
            authStatus === messaging.AuthorizationStatus.PROVISIONAL) {
          return 'authorized';
        } else if (authStatus === messaging.AuthorizationStatus.DENIED) {
          return 'denied';
        }
        return 'not_determined';
      }
    } catch (error) {
      console.error('🔔 Error checking notification permission:', error);
      return 'not_determined';
    }
  }

  // Try to get FCM token silently in background - no UI feedback
  // This is a fire-and-forget method for when we trust user intent
  async tryGetTokenSilently(userId: string): Promise<void> {
    await this.getAndSaveToken(userId);
  }

  // Get FCM token and save to Firestore - returns detailed result
  async getAndSaveToken(userId: string): Promise<{success: boolean; token?: string; error?: string; permissionStatus?: string}> {
    try {
      console.log('🔔 Step 1: Requesting notification permission...');
      
      // Request permission and CHECK THE RESULT
      const authStatus = await messaging().requestPermission();
      console.log('🔔 Step 2: Permission result:', authStatus);
      
      // Check if permission was granted
      const permissionGranted = 
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      
      if (!permissionGranted) {
        const statusName = authStatus === messaging.AuthorizationStatus.DENIED 
          ? 'DENIED' 
          : authStatus === messaging.AuthorizationStatus.NOT_DETERMINED 
            ? 'NOT_DETERMINED' 
            : `UNKNOWN (${authStatus})`;
        console.log('🔔 Permission not granted:', statusName);
        return { 
          success: false, 
          error: `Permission ${statusName}. Please enable notifications in Settings.`,
          permissionStatus: statusName
        };
      }
      
      console.log('🔔 Step 3: Registering for remote messages...');
      await messaging().registerDeviceForRemoteMessages();
      
      console.log('🔔 Step 4: Getting FCM token...');
      const token = await messaging().getToken();
      console.log('🔔 Step 5: Token received:', token ? `${token.substring(0, 30)}...` : 'NULL');
      
      if (token && token.length > 0) {
        console.log('🔔 Step 6: Saving token to Firestore...');
        await this.saveFCMToken(userId, token);
        console.log('🔔 Step 7: Token saved successfully!');
        
        if (!this.initialized) {
          messaging().onTokenRefresh(async (newToken) => {
            console.log('🔔 Token refreshed, saving new token...');
            await this.saveFCMToken(userId, newToken);
          });
          this.setupNotificationHandlers();
          this.initialized = true;
        }
        
        return { success: true, token, permissionStatus: 'AUTHORIZED' };
      } else {
        return { success: false, error: 'No FCM token returned from Firebase. Is APNs configured?', permissionStatus: 'AUTHORIZED' };
      }
    } catch (error: any) {
      console.error('🔔 FCM token error:', error?.message);
      const errorMsg = error?.message || error?.toString() || 'Unknown error';
      return { success: false, error: errorMsg };
    }
  }

  // Request push notification permissions and return the result
  // NEW APPROACH: Don't rely on requestPermission() status - it's cached!
  // Instead, just try to get the FCM token. If we get one, notifications work.
  async requestPermissionAndEnable(userId: string): Promise<boolean> {
    try {
      // Always call requestPermission first (required by iOS)
      // But DON'T use its return value to decide - it's unreliable
      await messaging().requestPermission();
      
      // Register for remote messages
      await messaging().registerDeviceForRemoteMessages();
      
      // The real test: can we get an FCM token?
      // iOS will NOT give us a token if notifications are disabled in Settings
      const token = await messaging().getToken();
      
      if (token && token.length > 0) {
        // SUCCESS! We got a token, so notifications are definitely enabled
        await this.saveFCMToken(userId, token);
        
        // Set up handlers if not already done
        if (!this.initialized) {
          messaging().onTokenRefresh(async (newToken) => {
            await this.saveFCMToken(userId, newToken);
          });
          this.setupNotificationHandlers();
          this.initialized = true;
        }
        
        return true;
      }
      
      // No token means notifications are disabled
      return false;
    } catch (error: any) {
      if (error?.message?.includes('aps-environment')) {
        console.warn('⚠️ Push notifications not configured in Xcode');
      } else {
        console.error('Error enabling notifications:', error);
      }
      return false;
    }
  }

  // Open device settings (for when permission is denied)
  async openSettings() {
    if (Platform.OS === 'ios') {
      await Linking.openURL('app-settings:');
    } else {
      await Linking.openSettings();
    }
  }

  // Load push notification preferences from Firestore
  async loadPreferences(userId: string): Promise<PushNotificationPreferences> {
    try {
      const doc = await firestore().collection('users').doc(userId).get();
      const data = doc.data();
      
      if (data?.pushPreferences) {
        return {
          enabled: data.pushPreferences.enabled ?? false,
          dailyPrompts: data.pushPreferences.dailyPrompts ?? true,
          gratitudePrompts: data.pushPreferences.gratitudePrompts ?? true,
          wishMilestones: data.pushPreferences.wishMilestones ?? true,
          coachReplies: data.pushPreferences.coachReplies ?? true,
          weeklyInsights: data.pushPreferences.weeklyInsights ?? false,
        };
      }
      
      // Default preferences
      return {
        enabled: false,
        dailyPrompts: true,
        gratitudePrompts: true,
        wishMilestones: true,
        coachReplies: true,
        weeklyInsights: false,
      };
    } catch (error) {
      console.error('Error loading push preferences:', error);
      return {
        enabled: false,
        dailyPrompts: true,
        gratitudePrompts: true,
        wishMilestones: true,
        coachReplies: true,
        weeklyInsights: false,
      };
    }
  }

  // Save push notification preferences to Firestore
  async savePreferences(userId: string, preferences: PushNotificationPreferences): Promise<boolean> {
    try {
      await firestore().collection('users').doc(userId).set({
        pushPreferences: {
          ...preferences,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        },
      }, { merge: true });
      return true;
    } catch (error) {
      console.error('Error saving push preferences:', error);
      return false;
    }
  }

  async initialize(userId: string) {
    if (this.initialized) {
      console.log('📱 Notification service already initialized, skipping');
      return;
    }

    console.log('🔔🔔🔔 INITIALIZING PUSH NOTIFICATIONS for user:', userId);

    try {
      // Always set up notification handlers first
      // This ensures we can receive notifications even if we can't request permission
      this.setupNotificationHandlers();
      console.log('📱 Notification handlers set up');
      
      // Check if user has push notifications enabled in Firestore
      const prefs = await this.loadPreferences(userId);
      console.log('📱 Push prefs from Firestore:', JSON.stringify(prefs));
      
      // Always try to get and save token if on real device
      // This ensures TestFlight builds always have fresh token
      try {
        console.log('📱 Step 1: Requesting notification permission...');
        
        // IMPORTANT: Must request permission BEFORE getting token on iOS!
        const authStatus = await messaging().requestPermission();
        console.log('📱 Step 2: Permission result:', authStatus);
        
        const permissionGranted = 
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;
        
        if (!permissionGranted) {
          console.warn('📱 Notification permission not granted, status:', authStatus);
          // Still continue - user may grant later via Settings
        }
        
        console.log('📱 Step 3: Registering for remote messages...');
        await messaging().registerDeviceForRemoteMessages();
        
        console.log('📱 Step 4: Getting FCM token...');
        const token = await messaging().getToken();
        
        if (token) {
          console.log('📱 Step 5: FCM Token obtained:', token?.substring(0, 30) + '...');
          await this.saveFCMToken(userId, token);
          console.log('📱 Step 6: FCM Token saved to Firestore for user:', userId);
          
          // Listen for token refresh
          messaging().onTokenRefresh(async (newToken) => {
            console.log('📱 FCM Token refreshed');
            await this.saveFCMToken(userId, newToken);
          });
        } else {
          console.warn('📱 No FCM token returned - push notifications may not work');
        }
      } catch (tokenError: any) {
        // On simulator or when APNS not configured, this will fail
        console.error('📱 Token error full:', tokenError);
        if (tokenError?.message?.includes('aps-environment')) {
          console.warn('⚠️ Push notifications not configured (add Push Notification capability in Xcode)');
        } else if (tokenError?.message?.includes('simulator')) {
          console.log('📱 Running on simulator - push notifications not supported');
        } else {
          console.warn('⚠️ Could not get FCM token:', tokenError?.message);
        }
      }
      
      this.initialized = true;
      console.log('✅ Push notifications initialized');
    } catch (error: any) {
      console.error('Error initializing notifications:', error);
      // Still mark as initialized to prevent infinite retries
      this.initialized = true;
    }
  }

  async requestPermission(): Promise<number> {
    if (Platform.OS === 'ios') {
      const authStatus = await messaging().requestPermission();
      return authStatus;
    } else {
      // Android 13+ requires runtime permission
      if (typeof Platform.Version === 'number' && Platform.Version >= 33) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED
          ? messaging.AuthorizationStatus.AUTHORIZED
          : messaging.AuthorizationStatus.DENIED;
      }
      return messaging.AuthorizationStatus.AUTHORIZED;
    }
  }

  async saveFCMToken(userId: string, token: string) {
    try {
      await firestore().collection('users').doc(userId).set(
        {
          fcmToken: token,
          platform: Platform.OS,
          lastTokenUpdate: firestore.FieldValue.serverTimestamp(),
        },
        {merge: true}
      );
      console.log('FCM token saved to Firestore');
    } catch (error) {
      console.error('Error saving FCM token:', error);
    }
  }

  setupNotificationHandlers() {
    // Handle notifications when app is in foreground
    messaging().onMessage(async (remoteMessage) => {
      console.log('Foreground notification:', remoteMessage);
      
      // Show an in-app alert for foreground notifications
      const title = remoteMessage.notification?.title || 'InkWell';
      const body = remoteMessage.notification?.body || '';
      const type = remoteMessage.data?.type;
      
      if (type === 'coach_reply') {
        // Show alert with option to view
        Alert.alert(
          title,
          body,
          [
            { text: 'Later', style: 'cancel' },
            { text: 'View', onPress: () => navigateToPastEntries() },
          ],
          { cancelable: true }
        );
      } else {
        // For other notifications, just show a simple alert
        Alert.alert(title, body);
      }
    });

    // Handle notification when app is opened from background state
    messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('Notification opened app from background:', remoteMessage);
      // Navigate to specific screen based on notification data
      this.handleNotificationNavigation(remoteMessage);
    });

    // Check if app was opened by a notification when it was completely closed
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          console.log('Notification opened app from quit state:', remoteMessage);
          this.handleNotificationNavigation(remoteMessage);
        }
      });
  }

  handleNotificationNavigation(remoteMessage: any) {
    // Handle navigation based on notification type
    console.log('Navigate to:', remoteMessage.data);
    
    const type = remoteMessage.data?.type;
    
    if (type === 'coach_reply') {
      // Navigate to Past Entries to see the coach reply
      navigateToPastEntries();
    } else if (type === 'milestone') {
      // Could navigate to Manifest screen
      // For now, just go to PastEntries
      navigateToPastEntries();
    }
    // Add more notification types as needed
  }

  async unsubscribe(userId: string) {
    try {
      // Remove FCM token from Firestore
      await firestore().collection('users').doc(userId).update({
        fcmToken: firestore.FieldValue.delete(),
      });
      
      // Delete the token from FCM
      await messaging().deleteToken();
      
      this.initialized = false;
      console.log('Push notifications unsubscribed');
    } catch (error) {
      console.error('Error unsubscribing from notifications:', error);
    }
  }
}

export default new NotificationService();
