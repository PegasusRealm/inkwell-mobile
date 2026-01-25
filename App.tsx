/**
 * InkWell Mobile App
 * Firebase auth with React Navigation
 * BUILD VERSION: 2026-01-07-v2-DARK-MODE
 */

import React, {useEffect, useState} from 'react';
import {Text, StyleSheet, StatusBar, View, AppState, Platform} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import auth, {FirebaseAuthTypes} from '@react-native-firebase/auth';
import messaging from '@react-native-firebase/messaging';

import SplashScreen from './src/screens/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';
import RootNavigator from './src/navigation/RootNavigator';
import notificationService from './src/services/notificationService';
import {ThemeProvider, useTheme} from './src/theme';

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
  const {colors} = useTheme();

  // Log on component mount
  useEffect(() => {
    console.log('🟣 App component mounted - fresh bundle confirmed');
  }, []);

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
          // Use Firebase messaging to clear badge - works with RN 0.74+
          await messaging().setBadge(0);
        } catch (error) {
          console.log('Badge clear not available:', error);
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

  const handleSplashFinish = () => {
    setShowSplash(false);
  };

  // Loading state
  if (initializing) {
    return (
      <View style={[styles.container, {backgroundColor: colors.bgPrimary}]}>
        <StatusBar barStyle={colors.statusBar} />
        <Text style={[styles.title, {color: colors.fontMain}]}>Loading...</Text>
      </View>
    );
  }

  // Show splash screen
  if (showSplash) {
    return (
      <>
        <StatusBar barStyle={colors.statusBar} />
        <SplashScreen onFinish={handleSplashFinish} />
      </>
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
    <NavigationContainer>
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