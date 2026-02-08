import React, {useMemo} from 'react';
import {View, Text, StyleSheet, ScrollView} from 'react-native';
import {spacing, borderRadius, fontFamily, fontSize} from '../theme';
import {useTheme, ThemeColors} from '../theme/ThemeContext';

// App version - update this when releasing new builds
const APP_VERSION = '26.039.2';
const BUILD_NUMBER = '72';

export default function InfoScreen() {
  // Theme hook for dynamic theming
  const {colors} = useTheme();
  
  // Create styles with current theme colors
  const styles = useMemo(() => createStyles(colors), [colors]);

  const appVersion = APP_VERSION;
  const buildNumber = BUILD_NUMBER;
  
  return (
    <ScrollView style={styles.container}>
      {/* Welcome Section */}
      <View style={styles.section}>
        <Text style={styles.title}>Welcome to InkWell</Text>
        <Text style={styles.body}>
          InkWell is your personal journaling companion, designed to help you
          reflect, manifest, and grow through the power of writing and AI-guided
          insights.
        </Text>
      </View>

      {/* Features Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Core Features</Text>

        <View style={styles.feature}>
          <Text style={styles.emoji}>📝</Text>
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>Daily Journal</Text>
            <Text style={styles.featureText}>
              Write your thoughts with Sophy, your AI companion who provides
              thoughtful prompts and reflections to deepen your practice. Choose 
              from standard journaling, Gratitude mode, or InkBlot creative mode.
            </Text>
          </View>
        </View>

        <View style={styles.feature}>
          <Text style={styles.emoji}>✨</Text>
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>Manifest with WISH</Text>
            <Text style={styles.featureText}>
              Create powerful manifestations using the WISH framework:{'\n'}
              • <Text style={styles.bold}>W</Text>ant - What do you desire?{'\n'}
              • <Text style={styles.bold}>I</Text>magine - Visualize having it{'\n'}
              • <Text style={styles.bold}>S</Text>nags - What obstacles exist?{'\n'}
              • <Text style={styles.bold}>H</Text>ow-to - Your action plan
            </Text>
          </View>
        </View>

        <View style={styles.feature}>
          <Text style={styles.emoji}>🎙️</Text>
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>InkOutLoud Voice Entry</Text>
            <Text style={styles.featureText}>
              Speak your journal entries when typing isn't convenient. Your voice 
              is transcribed to text with emotional tone analysis showing your 
              energy and stress levels.
            </Text>
          </View>
        </View>

        <View style={styles.feature}>
          <Text style={styles.emoji}>🔍</Text>
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>Smart Search</Text>
            <Text style={styles.featureText}>
              Find past entries using natural language. Ask questions like "when
              did I feel most grateful?" and discover insights from your journal
              history.
            </Text>
          </View>
        </View>

        <View style={styles.feature}>
          <Text style={styles.emoji}>📎</Text>
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>Photo & File Attachments</Text>
            <Text style={styles.featureText}>
              Attach photos, documents, and files to your journal entries to 
              capture the full context of your experiences.
            </Text>
          </View>
        </View>
      </View>

      {/* Subscription Tiers */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Subscription Tiers</Text>

        <View style={styles.tier}>
          <Text style={styles.tierTitle}>🆓 Free</Text>
          <Text style={styles.tierText}>
            Unlimited journaling with 3 AI interactions per day. Perfect for 
            getting started with your journaling practice.
          </Text>
        </View>

        <View style={styles.tier}>
          <Text style={styles.tierTitle}>⭐ Plus ($6.99/mo)</Text>
          <Text style={styles.tierText}>
            Unlimited AI prompts, reflections, and Sophy chats. Unlock Smart 
            Search, voice transcription, and email insights from Sophy.
          </Text>
        </View>

        <View style={styles.tier}>
          <Text style={styles.tierTitle}>💜 Connect ($29.99/mo)</Text>
          <Text style={styles.tierText}>
            Everything in Plus, plus work with certified InkWell coaches who 
            can review your entries and provide professional support.
          </Text>
        </View>
      </View>

      {/* How to Use Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Getting Started</Text>

        <View style={styles.step}>
          <Text style={styles.stepNumber}>1</Text>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Start Journaling</Text>
            <Text style={styles.stepText}>
              Tap the Journal tab. Ask Sophy for a prompt or start writing 
              freely. Use the microphone for voice entry.
            </Text>
          </View>
        </View>

        <View style={styles.step}>
          <Text style={styles.stepNumber}>2</Text>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Set Your WISH</Text>
            <Text style={styles.stepText}>
              Use the Manifest tab to create a WISH statement. Track your 
              progress over 30, 60, or 90 days.
            </Text>
          </View>
        </View>

        <View style={styles.step}>
          <Text style={styles.stepNumber}>3</Text>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Review & Reflect</Text>
            <Text style={styles.stepText}>
              Browse Past Entries by date or use Smart Search to find patterns 
              and insights in your journal history.
            </Text>
          </View>
        </View>
      </View>

      {/* Privacy & Security Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Privacy & Security</Text>
        <Text style={styles.body}>
          Your journal entries are private and securely stored. We never share 
          your personal content with third parties. All AI interactions are 
          processed securely, and you maintain full control over your data 
          including the ability to export or delete it anytime.
        </Text>
      </View>

      {/* Support Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Need Help?</Text>
        <Text style={styles.body}>
          If you have questions or need assistance, please contact us at{' '}
          <Text style={styles.link}>support@inkwelljournal.io</Text>
        </Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>InkWell v{appVersion} (Build {buildNumber})</Text>
        <Text style={styles.footerText}>© 2026 Pegasus Realm LLC</Text>
      </View>
    </ScrollView>
  );
}

// Dynamic styles based on theme colors
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgCard,
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  title: {
    fontFamily: fontFamily.header,
    fontSize: fontSize.xxxl,
    color: colors.brandPrimary,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontFamily: fontFamily.header,
    fontSize: fontSize.xl,
    color: colors.brandPrimary,
    marginBottom: spacing.base,
  },
  body: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
    lineHeight: 26,
    color: colors.fontMain,
  },
  bold: {
    fontFamily: fontFamily.buttonBold,
    color: colors.brandPrimary,
  },
  feature: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  emoji: {
    fontSize: fontSize.display,
    marginRight: spacing.md,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontFamily: fontFamily.header,
    fontSize: fontSize.lg,
    color: colors.fontMain,
    marginBottom: 4,
  },
  featureText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    lineHeight: 24,
    color: colors.fontSecondary,
  },
  tier: {
    marginBottom: spacing.lg,
    paddingLeft: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.brandPrimary,
  },
  tierTitle: {
    fontFamily: fontFamily.header,
    fontSize: fontSize.lg,
    color: colors.fontMain,
    marginBottom: 4,
  },
  tierText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    lineHeight: 22,
    color: colors.fontSecondary,
  },
  step: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  stepNumber: {
    fontFamily: fontFamily.buttonBold,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brandPrimary,
    color: colors.fontWhite,
    fontSize: fontSize.md,
    textAlign: 'center',
    lineHeight: 32,
    marginRight: spacing.md,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontFamily: fontFamily.header,
    fontSize: fontSize.lg,
    color: colors.fontMain,
    marginBottom: 4,
  },
  stepText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    lineHeight: 24,
    color: colors.fontSecondary,
  },
  link: {
    fontFamily: fontFamily.buttonBold,
    color: colors.brandPrimary,
  },
  footer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  footerText: {
    fontFamily: fontFamily.button,
    fontSize: fontSize.xs,
    color: colors.fontMuted,
    marginVertical: 2,
  },
});
