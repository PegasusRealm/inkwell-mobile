/**
 * InkWell Login Screen
 * Handles email/password, Apple, and Google authentication
 */

import React, {useState, useMemo} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {GoogleSignin} from '@react-native-google-signin/google-signin';
import appleAuth from '@invertase/react-native-apple-authentication';

import {spacing, borderRadius, fontFamily, fontSize} from '../theme';
import {useTheme, ThemeColors} from '../theme/ThemeContext';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({onLoginSuccess}) => {
  // Theme hook for dynamic theming
  const {colors, isDark} = useTheme();
  
  // Create styles with current theme colors
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [termsAgreed, setTermsAgreed] = useState(true);
  const [privacyAgreed, setPrivacyAgreed] = useState(true);
  const [loading, setLoading] = useState(false);

  // Configure Google Sign-In
  React.useEffect(() => {
    GoogleSignin.configure({
      webClientId: '849610731668-vddadhg61m7dla7oh8avmjb2c69l4pbd.apps.googleusercontent.com',
      iosClientId: '849610731668-b3qfvenc3ff0b9e26ea0q326mgq4r98m.apps.googleusercontent.com',
      offlineAccess: true,
    });
  }, []);

  // Email validation
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Password validation
  const validatePassword = (password: string): boolean => {
    return password.length >= 6;
  };



  // Google Sign-In Handler
  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      console.log('🔵 Starting Google Sign-In...');
      await GoogleSignin.hasPlayServices({showPlayServicesUpdateDialog: true});
      console.log('🔵 Play services OK, calling signIn()...');
      const signInResult = await GoogleSignin.signIn();
      console.log('🔵 Google signIn result:', JSON.stringify(signInResult, null, 2));
      
      // v10+ API: idToken is in signInResult.data.idToken
      const idToken = signInResult.data?.idToken || (signInResult as any).idToken;
      console.log('🔵 Got idToken:', idToken ? `${idToken.substring(0, 50)}...` : 'NULL');
      
      if (!idToken) {
        throw new Error('No idToken received from Google Sign-In. Result: ' + JSON.stringify(signInResult));
      }
      
      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      console.log('🔵 Created Firebase credential, signing in...');
      const userCredential = await auth().signInWithCredential(googleCredential);
      console.log('🔵 Firebase sign-in SUCCESS, uid:', userCredential.user.uid);
      
      // Create user profile (always set to ensure document exists)
      console.log('🔵 Creating/updating Firestore user document...');
      await firestore().collection('users').doc(userCredential.user.uid).set({
        userId: userCredential.user.uid,
        email: userCredential.user.email,
        displayName: userCredential.user.displayName || '',
        signupUsername: userCredential.user.displayName || userCredential.user.email?.split('@')[0] || '',
        avatar: userCredential.user.photoURL || '',
        userRole: 'journaler',
        authProvider: 'google',
        agreementAccepted: true,
        special_code: 'beta',
        subscriptionTier: 'free',
        subscriptionStatus: 'active',
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        insightsPreferences: {
          weeklyEnabled: true,
          monthlyEnabled: true,
          createdAt: firestore.FieldValue.serverTimestamp(),
        },
        onboardingState: {
          hasCompletedVoiceEntry: false,
          hasSeenWishTab: false,
          hasCreatedWish: false,
          hasUsedSophy: false,
          totalEntries: 0,
          currentMilestone: 'new_user',
          milestones: {
            firstEntry: null,
            firstVoiceEntry: null,
            firstWish: null,
            firstSophyChat: null,
          },
          createdAt: firestore.FieldValue.serverTimestamp(),
        },
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
        lastLoginAt: firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      console.log('🔵 Firestore user document created/updated!');
      
      onLoginSuccess();
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      if (error.code === 'SIGN_IN_CANCELLED') {
        // User cancelled the sign-in flow
      } else {
        Alert.alert('Google Sign-In Failed', error.message || 'An error occurred during Google sign-in.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Apple Sign-In Handler
  const handleAppleSignIn = async () => {
    if (Platform.OS !== 'ios') {
      Alert.alert('Not Available', 'Apple Sign-In is only available on iOS devices.');
      return;
    }
    
    setLoading(true);
    try {
      const appleAuthRequestResponse = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
      });

      if (!appleAuthRequestResponse.identityToken) {
        throw new Error('Apple Sign-In failed - no identity token returned');
      }

      const {identityToken, nonce} = appleAuthRequestResponse;
      const appleCredential = auth.AppleAuthProvider.credential(identityToken, nonce);
      const userCredential = await auth().signInWithCredential(appleCredential);
      
      // Create user profile if new user
      const userDoc = await firestore().collection('users').doc(userCredential.user.uid).get();
      if (!userDoc.exists) {
        const displayName = appleAuthRequestResponse.fullName
          ? `${appleAuthRequestResponse.fullName.givenName || ''} ${appleAuthRequestResponse.fullName.familyName || ''}`.trim()
          : userCredential.user.displayName || userCredential.user.email?.split('@')[0] || 'InkWell User';
        
        await firestore().collection('users').doc(userCredential.user.uid).set({
          userId: userCredential.user.uid,
          email: userCredential.user.email,
          displayName: displayName,
          signupUsername: displayName,
          avatar: userCredential.user.photoURL || '',
          userRole: 'journaler', // Match web app role
          authProvider: 'apple',
          agreementAccepted: true,
          special_code: 'beta', // Match web app beta code
          subscriptionTier: 'free',
          subscriptionStatus: 'active',
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          // Match web app insights preferences structure
          insightsPreferences: {
            weeklyEnabled: true,
            monthlyEnabled: true,
            createdAt: firestore.FieldValue.serverTimestamp(),
          },
          // Match web app onboarding state structure (from migration data)
          onboardingState: {
            hasCompletedVoiceEntry: false,
            hasSeenWishTab: false,
            hasCreatedWish: false,
            hasUsedSophy: false,
            totalEntries: 0,
            currentMilestone: 'new_user',
            milestones: {
              firstEntry: null,
              firstVoiceEntry: null,
              firstWish: null,
              firstSophyChat: null,
            },
            createdAt: firestore.FieldValue.serverTimestamp(),
          },
          createdAt: firestore.FieldValue.serverTimestamp(),
          updatedAt: firestore.FieldValue.serverTimestamp(),
          lastLoginAt: firestore.FieldValue.serverTimestamp(),
        });
      } else {
        // Existing user - just update lastLoginAt
        await firestore().collection('users').doc(userCredential.user.uid).update({
          lastLoginAt: firestore.FieldValue.serverTimestamp(),
        });
      }
      
      onLoginSuccess();
    } catch (error: any) {
      console.error('Apple sign-in error:', error);
      if (error.code === '1001') {
        // User cancelled
      } else {
        Alert.alert('Apple Sign-In Failed', error.message || 'An error occurred during Apple sign-in.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Email/Password Sign In
  const handleEmailSignIn = async () => {
    if (!validateEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    if (!validatePassword(password)) {
      Alert.alert(
        'Invalid Password',
        'Password must be at least 6 characters.',
      );
      return;
    }

    setLoading(true);
    try {
      const userCredential = await auth().signInWithEmailAndPassword(email, password);
      // Track last login time
      await firestore().collection('users').doc(userCredential.user.uid).update({
        lastLoginAt: firestore.FieldValue.serverTimestamp(),
      });
      onLoginSuccess();
    } catch (error: any) {
      let message = 'Login failed. Please try again.';
      if (error.code === 'auth/user-not-found') {
        message = 'No account found with this email.';
      } else if (error.code === 'auth/wrong-password') {
        message = 'Incorrect password.';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Invalid email address.';
      } else if (error.code === 'auth/invalid-credential') {
        message = 'Invalid email or password.';
      }
      Alert.alert('Login Failed', message);
    } finally {
      setLoading(false);
    }
  };

  // Email/Password Sign Up
  const handleEmailSignUp = async () => {
    if (!displayName.trim()) {
      Alert.alert('Name Required', 'Please enter your name.');
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    if (!validatePassword(password)) {
      Alert.alert(
        'Invalid Password',
        'Password must be at least 6 characters.',
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return;
    }



    if (!termsAgreed || !privacyAgreed) {
      Alert.alert('Agreements Required', 'Please agree to the Terms & Conditions and Privacy Policy.');
      return;
    }

    setLoading(true);
    try {
      console.log('📝 Starting email signup...');
      const userCred = await auth().createUserWithEmailAndPassword(
        email,
        password,
      );
      console.log('✅ Firebase Auth user created:', userCred.user.uid);

      // Update profile with display name
      await userCred.user.updateProfile({
        displayName: displayName.trim(),
      });
      console.log('✅ Display name updated');

      // Create user document in Firestore
      console.log('📝 Creating Firestore user document...');
      try {
        await firestore().collection('users').doc(userCred.user.uid).set({
          userId: userCred.user.uid,
          email: email,
          displayName: displayName.trim(),
          signupUsername: displayName.trim(),
          avatar: '',
          userRole: 'journaler',
          authProvider: 'email',
          agreementAccepted: true,
          special_code: 'beta',
          subscriptionTier: 'free',
          subscriptionStatus: 'active',
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          insightsPreferences: {
            weeklyEnabled: true,
            monthlyEnabled: true,
            createdAt: firestore.FieldValue.serverTimestamp(),
          },
          onboardingState: {
            hasCompletedVoiceEntry: false,
            hasSeenWishTab: false,
            hasCreatedWish: false,
            hasUsedSophy: false,
            totalEntries: 0,
            currentMilestone: 'new_user',
            milestones: {
              firstEntry: null,
              firstVoiceEntry: null,
              firstWish: null,
              firstSophyChat: null,
            },
            createdAt: firestore.FieldValue.serverTimestamp(),
          },
          createdAt: firestore.FieldValue.serverTimestamp(),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
        console.log('✅ Firestore user document created successfully!');
      } catch (firestoreError: any) {
        console.error('❌ Firestore error:', firestoreError.message);
        console.error('❌ Firestore error code:', firestoreError.code);
        // Don't block signup if Firestore fails, but log it
      }

      onLoginSuccess();
    } catch (error: any) {
      let message = 'Sign up failed. Please try again.';
      if (error.code === 'auth/email-already-in-use') {
        message = 'This email is already registered.';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Invalid email address.';
      } else if (error.code === 'auth/weak-password') {
        message = 'Password is too weak. Please use a stronger password.';
      }
      Alert.alert('Sign Up Failed', message);
    } finally {
      setLoading(false);
    }
  };

  // TODO: Add Apple Sign In when @invertase/react-native-apple-authentication is installed
  // TODO: Add Google Sign In when @react-native-google-signin/google-signin is installed

  // Forgot Password
  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('Email Required', 'Please enter your email address first.');
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    try {
      await auth().sendPasswordResetEmail(email);
      Alert.alert(
        'Password Reset Email Sent',
        'Check your email for instructions to reset your password.',
      );
    } catch (error: any) {
      Alert.alert(
        'Reset Failed',
        'Unable to send reset email. Please check your email address.',
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={true}>
        {/* Logo */}
        <Image
          source={require('../../assets/InkWell-Logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        {/* Title */}
        <Text style={styles.title}>
          {isSignUp ? 'Create Account' : 'Welcome Back'}
        </Text>
        <Text style={styles.subtitle}>
          {isSignUp
            ? 'Start your journaling journey'
            : 'Continue your journey'}
        </Text>

        {/* Social Sign In Buttons */}
        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={styles.appleButton}
            onPress={handleAppleSignIn}
            disabled={loading}>
            <Text style={styles.appleIcon}></Text>
            <Text style={styles.appleButtonText}>Continue with Apple</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.googleButton}
          onPress={handleGoogleSignIn}
          disabled={loading}>
          <View style={styles.googleIconContainer}>
            <Text style={styles.googleIcon}>G</Text>
          </View>
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Email/Password Form */}
        {isSignUp && (
          <TextInput
            style={styles.input}
            placeholder="Full Name"
            placeholderTextColor="#93A5A8"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
            editable={!loading}
          />
        )}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#93A5A8"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#93A5A8"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
        />

        {isSignUp && (
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor="#93A5A8"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            editable={!loading}
          />
        )}

        {/* Agreement Checkboxes for Sign Up */}
        {isSignUp && (
          <>
            {/* Terms & Conditions */}
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setTermsAgreed(!termsAgreed)}
              disabled={loading}>
              <View style={[styles.checkbox, termsAgreed && styles.checkboxChecked]}>
                {termsAgreed && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>
                I agree to the <Text style={styles.link}>Terms & Conditions</Text>
              </Text>
            </TouchableOpacity>

            {/* Privacy Policy */}
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setPrivacyAgreed(!privacyAgreed)}
              disabled={loading}>
              <View style={[styles.checkbox, privacyAgreed && styles.checkboxChecked]}>
                {privacyAgreed && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>
                I agree to the <Text style={styles.link}>Privacy Policy</Text>
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* Forgot Password */}
        {!isSignUp && (
          <TouchableOpacity onPress={handleForgotPassword} disabled={loading}>
            <Text style={styles.forgotPassword}>Forgot password?</Text>
          </TouchableOpacity>
        )}

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={isSignUp ? handleEmailSignUp : handleEmailSignIn}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#F0FDFA" />
          ) : (
            <Text style={styles.submitButtonText}>
              {isSignUp ? 'Sign Up' : 'Log In'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Toggle Sign Up/Login */}
        <View style={styles.toggleContainer}>
          <Text style={styles.toggleText}>
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}
          </Text>
          <TouchableOpacity
            onPress={() => {
              setIsSignUp(!isSignUp);
              setConfirmPassword('');
              setDisplayName('');
            }}
            disabled={loading}>
            <Text style={styles.toggleLink}>
              {isSignUp ? 'Log In' : 'Sign Up'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// Dynamic styles based on theme colors
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: 60,
    paddingBottom: spacing.xxxl,
  },
  logo: {
    width: 120,
    height: 120,
    alignSelf: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontFamily: fontFamily.header,
    fontSize: fontSize.display,
    color: colors.brandPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
    color: colors.fontSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  appleButton: {
    backgroundColor: '#000000',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appleIcon: {
    color: colors.fontWhite,
    fontSize: fontSize.xl,
    marginRight: spacing.sm,
  },
  appleButtonText: {
    fontFamily: fontFamily.buttonBold,
    color: colors.fontWhite,
    fontSize: fontSize.md,
    letterSpacing: 0.5,
  },
  googleButton: {
    backgroundColor: colors.bgCard,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIconContainer: {
    width: 20,
    height: 20,
    marginRight: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIcon: {
    fontSize: fontSize.lg,
    color: '#4285F4',
  },
  googleButtonText: {
    fontFamily: fontFamily.button,
    color: colors.fontMain,
    fontSize: fontSize.md,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderMedium,
  },
  dividerText: {
    fontFamily: fontFamily.button,
    marginHorizontal: spacing.base,
    color: colors.fontMuted,
    fontSize: fontSize.sm,
  },
  input: {
    fontFamily: fontFamily.body,
    backgroundColor: colors.bgCard,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    fontSize: fontSize.md,
    color: colors.fontMain,
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  forgotPassword: {
    fontFamily: fontFamily.body,
    color: colors.brandPrimary,
    fontSize: fontSize.sm,
    textAlign: 'right',
    marginBottom: spacing.xl,
    textDecorationLine: 'underline',
  },
  submitButton: {
    backgroundColor: colors.brandPrimary,
    paddingVertical: spacing.base,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontFamily: fontFamily.buttonBold,
    color: colors.fontWhite,
    fontSize: fontSize.md,
    letterSpacing: 0.5,
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleText: {
    fontFamily: fontFamily.body,
    color: colors.fontSecondary,
    fontSize: fontSize.sm,
    marginRight: 4,
  },
  toggleLink: {
    fontFamily: fontFamily.buttonBold,
    color: colors.brandPrimary,
    fontSize: fontSize.sm,
    textDecorationLine: 'underline',
  },
  helpText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.fontMuted,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
    marginLeft: 4,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.brandPrimary,
    marginRight: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgCard,
  },
  checkboxChecked: {
    backgroundColor: colors.brandPrimary,
  },
  checkmark: {
    color: colors.fontWhite,
    fontSize: fontSize.md,
  },
  checkboxLabel: {
    fontFamily: fontFamily.body,
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.brandPrimary,
    lineHeight: 22,
  },
  link: {
    fontFamily: fontFamily.buttonBold,
    textDecorationLine: 'underline',
    color: colors.brandPrimary,
  },
  disclaimerText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.fontMuted,
    marginLeft: 36,
    marginBottom: spacing.base,
    lineHeight: 18,
  },
});

export default LoginScreen;
