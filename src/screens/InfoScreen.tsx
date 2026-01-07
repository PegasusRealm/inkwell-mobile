import React from 'react';
import {View, Text, StyleSheet, ScrollView} from 'react-native';
import {colors, spacing, borderRadius, fontFamily, fontSize} from '../theme';

export default function InfoScreen() {
  return (
    <ScrollView style={styles.container}>
      {/* Welcome Section */}
      <View style={styles.section}>
        <Text style={styles.title}>Welcome to InkWell</Text>
        <Text style={styles.body}>
          InkWell is your personal journaling companion, designed to help you
          reflect, manifest, and grow through the power of writing and AI-guided
          prompts.
        </Text>
      </View>

      {/* Features Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Features</Text>

        <View style={styles.feature}>
          <Text style={styles.emoji}>📝</Text>
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>Daily Journal</Text>
            <Text style={styles.featureText}>
              Write your thoughts with Sophy, your AI companion who provides
              thoughtful prompts and reflections to deepen your practice.
            </Text>
          </View>
        </View>

        <View style={styles.feature}>
          <Text style={styles.emoji}>✨</Text>
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>Manifest WISH</Text>
            <Text style={styles.featureText}>
              Create powerful manifestations using the WISH framework: What you
              want, Why it matters, How you'll achieve it, and When it will
              happen.
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
          <Text style={styles.emoji}>🎙️</Text>
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>InkOutLoud</Text>
            <Text style={styles.featureText}>
              Record voice entries when typing isn't convenient. Your audio is
              securely stored and easily accessible.
            </Text>
          </View>
        </View>
      </View>

      {/* How to Use Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>How to Use</Text>

        <View style={styles.step}>
          <Text style={styles.stepNumber}>1</Text>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Start Writing</Text>
            <Text style={styles.stepText}>
              Tap the Journal tab to begin. Sophy will greet you and offer
              prompts to get started.
            </Text>
          </View>
        </View>

        <View style={styles.step}>
          <Text style={styles.stepNumber}>2</Text>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Create Manifestations</Text>
            <Text style={styles.stepText}>
              Use the Manifest tab to set intentions and create powerful WISH
              statements for your goals.
            </Text>
          </View>
        </View>

        <View style={styles.step}>
          <Text style={styles.stepNumber}>3</Text>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Review & Search</Text>
            <Text style={styles.stepText}>
              Browse past entries by date or use Smart Search to find specific
              moments and insights.
            </Text>
          </View>
        </View>
      </View>

      {/* Privacy & Security Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Privacy & Security</Text>
        <Text style={styles.body}>
          Your journal entries are private and encrypted. We never share your
          personal content. All AI interactions are processed securely, and you
          maintain full control over your data.
        </Text>
      </View>

      {/* Support Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Need Help?</Text>
        <Text style={styles.body}>
          If you have questions or need assistance, please contact us at{' '}
          <Text style={styles.link}>support@inkwell.app</Text>
        </Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>InkWell v1.0.0 (Alpha)</Text>
        <Text style={styles.footerText}>© 2026 Pegasus Realm</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
