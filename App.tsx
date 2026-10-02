/**
 * InkWell Mobile App
 * Firebase auth with React Navigation
 *
 * v2.0 (2026-10-01):
 *  - No more animated splash on every launch (it held people for about 8 seconds).
 *    The native launch screen covers loading; the app opens as soon as sign-in is known.
 *  - Signing back in during the 30-day deletion window cancels the deletion, as promised.
 *  - A crash on one screen shows a calm "try again" instead of a dead app.
 *  - A few dates (never content) on the user record, so we can see whether 2.0 helps.
 */

import React, {useEffect, useState} from 'react';
import {StatusBar, View, AppState, Platform, NativeModules, Alert} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import auth, {FirebaseAuthTypes} from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

import LoginScreen from './src/screens/LoginScreen';
import RootNavigator from './src/navigation/RootNavigator';
import notificationService from './src/services/notificationService';
import {ThemeProvider, useTheme} from './src/theme';
import {navigationRef} from './src/services/navigationService';
import {ErrorBoundary} from './src/components/ErrorBoundary';
import {markAppOpen} from './src/services/userDates';
import {recordError, setCrashUser} from './src/services/crashReporting';
import {resetSubscriptionOnSignOut} from './src/hooks/useSubscription';

function App(): React.JSX.Element {
  return (
    <ThemeProvider>
      <AppWithAuth />
    </ThemeProvider>
  );
}

// Signing in again during the deletion window cancels it. The user can write these
// two fields themselves (Settings sets them the same way).
async function cancelPendingDeletion(user: FirebaseAuthTypes.User) {
  try {
    const ref = firestore().collection('users').doc(user.uid);
    const snap = await ref.get();
    const data = snap.data();
    if (!data?.deletionRequested) return;
    await ref.update({
      deletionRequested: firestore.FieldValue.delete(),
      deletionScheduledFor: firestore.FieldValue.delete(),
      deletionCanceledAt: firestore.FieldValue.serverTimestamp(),
    });
    Alert.alert('Welcome back', 'Your account will not be deleted. Everything is where you left it.', [{text: 'OK'}]);
  } catch (e) {
    console.warn('Could not check for a pending deletion:', e);
  }
}

function AppWithAuth(): React.JSX.Element {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const {colors} = useTheme();

  // Monitor auth state
  useEffect(() => {
    let hadUser = false;
    const subscriber = auth().onAuthStateChanged(userState => {
      if (hadUser && !userState) resetSubscriptionOnSignOut();
      hadUser = !!userState;
      setUser(userState);
      setInitializing(false);
    });
    return subscriber;
  }, []);

  // Signed in: push notifications, pending-deletion check, open stamp
  useEffect(() => {
    if (user) {
      notificationService.initialize(user.uid);
      setCrashUser(user.uid);
      cancelPendingDeletion(user);
      markAppOpen();
    }
  }, [user]);

  // Clear badge count when app opens or comes to foreground
  useEffect(() => {
    const clearBadge = () => {
      if (Platform.OS === 'ios') {
        try {
          const {PushNotificationIOS} = NativeModules;
          if (PushNotificationIOS?.setApplicationIconBadgeNumber) {
            PushNotificationIOS.setApplicationIconBadgeNumber(0);
          }
        } catch (error) {
          // Native AppDelegate.mm handles badge clearing as fallback
        }
      }
    };
    clearBadge();
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') clearBadge();
    });
    return () => subscription.remove();
  }, []);

  // While sign-in state loads: a plain screen in the app's own color, no text, no spinner.
  if (initializing) {
    return (
      <View style={{flex: 1, backgroundColor: colors.bgPrimary}}>
        <StatusBar barStyle={colors.statusBar} />
      </View>
    );
  }

  if (!user) {
    return (
      <ErrorBoundary onError={(error, info) => recordError(error, info?.componentStack || undefined)}>
        <StatusBar barStyle={colors.statusBar} />
        <LoginScreen onLoginSuccess={() => {}} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary onError={(error, info) => recordError(error, info?.componentStack || undefined)}>
      <NavigationContainer ref={navigationRef}>
        <StatusBar barStyle={colors.statusBar} />
        <RootNavigator />
      </NavigationContainer>
    </ErrorBoundary>
  );
}

export default App;
