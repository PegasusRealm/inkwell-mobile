import messaging from '@react-native-firebase/messaging';
import firestore from '@react-native-firebase/firestore';
import {Platform, PermissionsAndroid, Linking} from 'react-native';

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
  async checkPermissionStatus(): Promise<'authorized' | 'denied' | 'not_determined'> {
    try {
      const authStatus = await messaging().hasPermission();
      
      if (authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL) {
        return 'authorized';
      } else if (authStatus === messaging.AuthorizationStatus.DENIED) {
        return 'denied';
      }
      return 'not_determined';
    } catch (error) {
      console.error('Error checking notification permission:', error);
      return 'not_determined';
    }
  }

  // Request push notification permissions and return the result
  async requestPermissionAndEnable(userId: string): Promise<boolean> {
    try {
      const authStatus = await this.requestPermission();
      
      if (authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL) {
        // Register and get token
        await messaging().registerDeviceForRemoteMessages();
        const token = await messaging().getToken();
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
      return false;
    } catch (error: any) {
      if (error?.message?.includes('aps-environment')) {
        console.warn('⚠️ Push notifications not configured in Xcode');
      } else {
        console.error('Error requesting notification permission:', error);
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
    if (this.initialized) return;

    try {
      // Request permission
      const authStatus = await this.requestPermission();
      
      if (authStatus === messaging.AuthorizationStatus.AUTHORIZED || 
          authStatus === messaging.AuthorizationStatus.PROVISIONAL) {
        
        // Register for remote messages first
        await messaging().registerDeviceForRemoteMessages();
        
        // Get FCM token
        const token = await messaging().getToken();
        console.log('FCM Token:', token);
        
        // Store token in Firestore
        await this.saveFCMToken(userId, token);
        
        // Listen for token refresh
        messaging().onTokenRefresh(async (newToken) => {
          console.log('FCM Token refreshed:', newToken);
          await this.saveFCMToken(userId, newToken);
        });
        
        // Set up notification handlers
        this.setupNotificationHandlers();
        
        this.initialized = true;
        console.log('✅ Push notifications initialized');
      } else {
        console.log('❌ Push notification permission denied');
      }
    } catch (error: any) {
      // Gracefully handle APS entitlement errors (not configured yet)
      if (error?.message?.includes('aps-environment')) {
        console.warn('⚠️ Push notifications not configured - skipping (add Push Notification capability in Xcode)');
        this.initialized = true; // Mark as initialized to prevent retry loops
        return;
      }
      console.error('Error initializing notifications:', error);
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
      // You can show a local notification here if needed
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
    
    // Example: Navigate to specific screen based on notification data
    // if (remoteMessage.data?.type === 'milestone') {
    //   navigation.navigate('Manifest');
    // } else if (remoteMessage.data?.type === 'practitioner_reply') {
    //   navigation.navigate('PastEntries');
    // }
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
