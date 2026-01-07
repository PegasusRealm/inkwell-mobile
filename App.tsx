/**
 * InkWell Mobile App
 * Firebase auth with React Navigation
 * BUILD VERSION: 2026-01-07-v1
 */

import React, {useEffect, useState} from 'react';
import {Text, StyleSheet, StatusBar, View} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import auth, {FirebaseAuthTypes} from '@react-native-firebase/auth';

import SplashScreen from './src/screens/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';
import RootNavigator from './src/navigation/RootNavigator';
import notificationService from './src/services/notificationService';
import {ThemeProvider, useTheme} from './src/theme';

// Log on module load to verify fresh bundle
console.log('🟣🟣🟣 APP MODULE LOADED - BUILD 2026-01-07-v1 🟣🟣🟣');

function App(): React.JSX.Element {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [showSplash, setShowSplash] = useState(true);

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

  const handleSplashFinish = () => {
    setShowSplash(false);
  };

  // Loading state
  if (initializing) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Loading...</Text>
      </View>
    );
  }

  // Show splash screen
  if (showSplash) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  // Show login if no user
  if (!user) {
    return <LoginScreen onLoginSuccess={() => {}} />;
  }

  // Show main app with React Navigation when logged in
  return (
    <ThemeProvider>
      <AppContent user={user} />
    </ThemeProvider>
  );
}

// Separate component to use theme hook
function AppContent({user}: {user: FirebaseAuthTypes.User}): React.JSX.Element {
  const {colors} = useTheme();
  
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
    backgroundColor: '#1a1a2e',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
  },
});

export default App;