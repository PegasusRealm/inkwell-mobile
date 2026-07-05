import React, {useEffect, useRef, useMemo} from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  useWindowDimensions,
} from 'react-native';
import {spacing, fontFamily, fontSize} from '../theme';
import {useTheme, ThemeColors} from '../theme/ThemeContext';

interface SplashScreenProps {
  onFinish: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({onFinish}) => {
  // Theme hook for dynamic theming
  const {colors, isDark} = useTheme();
  
  // Dynamic dimensions for iPad support
  const {width, height} = useWindowDimensions();
  
  // Debug logging
  console.log('🎬🎬🎬 SplashScreen RENDER');
  
  // Create styles with current theme colors and dimensions
  const styles = useMemo(() => createStyles(colors, width, height), [colors, width, height]);
  
  // Prevent double-calling onFinish
  const hasFinishedRef = useRef(false);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  
  // Animation values
  const logoScale = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textSlide = useRef(new Animated.Value(30)).current;
  const prLogoOpacity = useRef(new Animated.Value(0)).current;
  const finalLogoScale = useRef(new Animated.Value(0.3)).current;
  const finalLogoOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    console.log('🎬🎬🎬 SplashScreen useEffect STARTING animation');
    const startTime = Date.now();
    
    // Sequence of animations
    Animated.sequence([
      // Phase 1: Small logo pops up (0-800ms)
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 0.3,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),

      // Phase 2: Intro text fades in (800-1200ms)
      Animated.delay(200),
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(textSlide, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),

      // Phase 2.5: Pegasus Realm logo fades in with text (1400ms)
      Animated.delay(200),
      Animated.timing(prLogoOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),

      // Phase 3: Hold text (1600-3500ms)
      Animated.delay(1900),

      // Phase 4: Fade out small logo, text, and PR logo (3500-4000ms)
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(textOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(prLogoOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),

      // Phase 5: Fade in large centered logo (4000-4800ms)
      Animated.delay(200),
      Animated.parallel([
        Animated.spring(finalLogoScale, {
          toValue: 1,
          tension: 40,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(finalLogoOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),

      // Phase 6: Tagline fades in (4800-5400ms)
      Animated.delay(200),
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),

      // Phase 7: Hold final screen (5400-7200ms)
      Animated.delay(1800),

      // Phase 8: Fade out everything (7200-7700ms)
      Animated.parallel([
        Animated.timing(finalLogoOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(taglineOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      // Animation complete, call onFinish
      const elapsed = Date.now() - startTime;
      console.log('🎬🎬🎬 SplashScreen animation COMPLETE after', elapsed, 'ms');
      
      if (!hasFinishedRef.current) {
        hasFinishedRef.current = true;
        onFinishRef.current();
      }
    });
  }, [
    logoScale,
    logoOpacity,
    textOpacity,
    textSlide,
    prLogoOpacity,
    finalLogoScale,
    finalLogoOpacity,
    taglineOpacity,
    // Removed onFinish from deps - using ref instead
  ]);

  return (
    <View style={styles.container}>
      {/* Phase 1 & 2: Intro text */}
      <Animated.View
        style={[
          styles.phaseOne,
          {
            opacity: logoOpacity,
          },
        ]}>
        <Animated.View
          style={[
            styles.introTextContainer,
            {
              opacity: textOpacity,
              transform: [{translateY: textSlide}],
            },
          ]}>
          <Text style={styles.introTitle}>
            Welcome to <Text style={styles.introTitleEm}>Your</Text> Journey
          </Text>
          <Text style={styles.introText}>
            A journal that learns you.{'\n'}
            Goals that grow from your values.
          </Text>
        </Animated.View>
        
        {/* Pegasus Realm logo with "brought to you by" */}
        <Animated.View
          style={[
            styles.prLogoContainer,
            {
              opacity: prLogoOpacity,
            },
          ]}>
          <Text style={styles.broughtToYouText}>
            brought to you by{'\n'}
            <Text style={styles.pegasusRealmText}>Pegasus Realm</Text>
          </Text>
          <Image
            source={require('../../assets/PegasusRealm-Logo.png')}
            style={styles.prLogo}
            resizeMode="contain"
          />
        </Animated.View>
      </Animated.View>

      {/* Phase 5 & 6: Large centered logo with tagline */}
      <Animated.View
        style={[
          styles.phaseTwo,
          {
            opacity: finalLogoOpacity,
          },
        ]}>
        <Animated.Image
          source={require('../../assets/InkWell-Logo.png')}
          style={[
            styles.largeLogo,
            {
              transform: [{scale: finalLogoScale}],
            },
          ]}
          resizeMode="contain"
        />
        <Animated.View
          style={[
            styles.taglineContainer,
            {
              opacity: taglineOpacity,
            },
          ]}>
          <Text style={styles.tagline}>
            For the <Text style={styles.taglineEm}>Thinkers</Text> and the{' '}
            <Text style={styles.taglineEm}>Forgetters</Text>.
          </Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
};

// Dynamic styles based on theme colors and screen dimensions
const createStyles = (colors: ThemeColors, width: number, height: number) => {
  // Cap logo/layout sizes for iPad to prevent oversized elements
  const logoSmallSize = Math.min(360, width * 0.7);
  const logoLargeSize = Math.min(450, width * 0.8);
  
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  phaseOne: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    width: width,
    height: height,
  },
  smallLogo: {
    width: logoSmallSize,
    height: logoSmallSize,
    marginBottom: spacing.xxl,
  },
  introTextContainer: {
    paddingHorizontal: spacing.xxxl,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  introTitle: {
    fontFamily: fontFamily.header,
    fontSize: fontSize.xxxl,
    color: colors.fontMain,
    textAlign: 'center',
    marginBottom: spacing.lg,
    letterSpacing: 0.5,
  },
  // Italic-teal emphasis is reserved for the user's words (Your)
  introTitleEm: {
    fontFamily: fontFamily.headerItalic,
    fontStyle: 'italic',
    color: colors.brandLight,
  },
  introText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.lg,
    lineHeight: 28,
    color: colors.fontSecondary,
    textAlign: 'center',
  },
  prLogoContainer: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  broughtToYouText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    textAlign: 'center',
    lineHeight: 18,
    color: colors.fontSecondary,
    marginBottom: 4,
    fontStyle: 'italic',
  },
  pegasusRealmText: {
    fontFamily: fontFamily.header,
    fontSize: fontSize.md,
    color: colors.brandPrimary,
  },
  prLogo: {
    width: 80,
    height: 80,
  },
  phaseTwo: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    width: width,
    height: height,
  },
  largeLogo: {
    width: logoLargeSize,
    height: logoLargeSize,
    marginBottom: spacing.sm,
  },
  taglineContainer: {
    alignItems: 'center',
    paddingHorizontal: spacing.xxxl,
  },
  brandName: {
    fontFamily: fontFamily.header,
    fontSize: fontSize.hero,
    color: colors.brandPrimary,
    marginBottom: spacing.md,
    letterSpacing: 1,
  },
  tagline: {
    fontFamily: fontFamily.serif,
    fontSize: fontSize.lg,
    color: colors.fontSecondary,
    textAlign: 'center',
  },
  // Thinkers / Forgetters — words that describe the user wear the teal italic
  taglineEm: {
    fontFamily: fontFamily.serifItalic,
    fontStyle: 'italic',
    color: colors.brandLight,
  },
});
};

export default SplashScreen;
