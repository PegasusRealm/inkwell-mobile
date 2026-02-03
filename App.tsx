/**
 * InkWell Mobile App
 * Firebase auth with React Navigation
 * BUILD VERSION: 2026-01-07-v2-DARK-MODE
 */

import React, {useEffect, useState} from 'react';
import {Text, StyleSheet, StatusBar, View, AppState, Platform, NativeModules} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import auth, {FirebaseAuthTypes} from '@react-native-firebase/auth';
import messaging from '@react-native-firebase/messaging';

import SplashScreen from './src/screens/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';
import RootNavigator from './src/navigation/RootNavigator';
import notificationService from './src/services/notificationService';
import {ThemeProvider, useTheme} from './src/theme';
import {navigationRef} from './src/services/navigationService';

// Log on module load to verify fresh bundle
console.log('🟣🟣🟣 APP MODULE LOADED - BUILD 2026-01-07-v2-DARK-MODE 🟣🟣🟣');

function App(): React.JSX.Element {
  return (
    <ThemeProvider>
      <AppWithAuth />
    </ThemeProvider>
  );
}

// Inner component that handles auth state
function AppWithAuth(): React.JSX.Element {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [minSplashTimePassed, setMinSplashTimePassed] = useState(false);
  const [splashAnimationDone, setSplashAnimationDone] = useState(false);
  const {colors} = useTheme();

  // Log on component mount - debug splash screen visibility
  useEffect(() => {
    console.log('🟣🟣🟣 App component mounted - showSplash:', showSplash);
    
    // Minimum splash display time of 3 seconds as fallback
    const minTimer = setTimeout(() => {
      console.log('🟣🟣🟣 Minimum splash time reached');
      setMinSplashTimePassed(true);
    }, 3000);
    
    return () => clearTimeout(minTimer);
  }, []);

  // Only hide splash when BOTH animation is done AND min time passed
  useEffect(() => {
    if (splashAnimationDone && minSplashTimePassed) {
      console.log('🟣🟣🟣 Both conditions met, hiding splash');
      setShowSplash(false);
    }
  }, [splashAnimationDone, minSplashTimePassed]);

  const handleSplashFinish = () => {
    console.log('🟣🟣🟣 Splash animation finished callback received');
    setSplashAnimationDone(true);
  };

  // Monitor auth state
  useEffect(() => {
    const subscriber = auth().onAuthStateChanged(userState => {
      setUser(userState);
      if (initializing) {
        setInitializing(false);
      }
    });
    return subscriber;
  }, [initializing]);

  // Initialize push notifications when user logs in
  useEffect(() => {
    if (user) {
      notificationService.initialize(user.uid);
    }
  }, [user]);

  // Clear badge count when app opens or comes to foreground
  useEffect(() => {
    const clearBadge = async () => {
      if (Platform.OS === 'ios') {
        try {
          // Use native module to clear badge
          const { PushNotificationIOS } = NativeModules;
          if (PushNotificationIOS?.setApplicationIconBadgeNumber) {
            PushNotificationIOS.setApplicationIconBadgeNumber(0);
          }
          console.log('✅ Badge cleared');
        } catch (error) {
          // Native AppDelegate.mm handles badge clearing as fallback
          console.log('⚠️ Badge clear failed, native fallback active:', error);
        }
      }
    };
    
    // Clear on app launch
    clearBadge();
    
    // Clear when app comes to foreground
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        clearBadge();
      }
    });
    
    return () => subscription.remove();
  }, []);

  // ALWAYS show splash screen first - it runs its animation then calls onFinish
  // This ensures users see the branded splash on every app launch
  if (showSplash) {
    return (
      <>
        <StatusBar barStyle={colors.statusBar} />
        <SplashScreen onFinish={handleSplashFinish} />
      </>
    );
  }

  // Loading state (only shown after splash finishes, while auth initializes)
  if (initializing) {
    return (
      <View style={[styles.container, {backgroundColor: colors.bgPrimary}]}>
        <StatusBar barStyle={colors.statusBar} />
        <Text style={[styles.title, {color: colors.fontMain}]}>Loading...</Text>
      </View>
    );
  }

  // Show login if no user
  if (!user) {
    return (
      <>
        <StatusBar barStyle={colors.statusBar} />
        <LoginScreen onLoginSuccess={() => {}} />
      </>
    );
  }

  // Show main app with React Navigation when logged in
  return (
    <NavigationContainer ref={navigationRef}>
      <StatusBar barStyle={colors.statusBar} />
      <RootNavigator />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 16,
  },
});

export default App;