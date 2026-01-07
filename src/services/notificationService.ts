import messaging from '@react-native-firebase/messaging';
import firestore from '@react-native-firebase/firestore';
import {Platform, PermissionsAndroid} from 'react-native';

class NotificationService {
  private initialized = false;

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
      if (Platform.Version >= 33) {
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
