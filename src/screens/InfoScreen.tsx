/**
 * Help and About (v2.0, 2026-10-01). Opened from You as the 'Info' stack route;
 * the navigator draws the "Help and About" header and the way back.
 * Short on purpose: what InkWell is, the four tabs, Sophy, privacy, support.
 * Type floor: nothing under 13px. Teal is structure, coral is Sophy's only.
 */
import React, {useMemo} from 'react';
import {View, Text, StyleSheet, ScrollView, Linking, useWindowDimensions} from 'react-native';
import {spacing, fontFamily} from '../theme';
import {useTheme, ThemeColors} from '../theme/ThemeContext';
import {iPadContentStyle} from '../utils/iPad';
import {APP_VERSION, BUILD_NUMBER} from '../version';
import {Eyebrow, SophyOrb} from '../components/kit';

// Until support@castaliajournal.com exists (TASKS: Castalia overhaul), support goes to Pegasus Realm.
const SUPPORT_EMAIL = 'support@pegasusrealm.com';

const TABS: Array<{name: string; text: string}> = [
  {
    name: 'Today',
    text: 'Where you write. One question to start from, and a few ways in: free-write, sprint, gratitude, reframe, InkBlot, or just speak it.',
  },
  {
    name: 'Entries',
    text: 'Everything you have kept. Ask your journal in your own words, or open the calendar to find a day.',
  },
  {
    name: 'Goals',
    text: "Your WISH: Want, Imagine, Snags, How. When you're ready for a new one, find your next goal here.",
  },
  {
    name: 'You',
    text: 'Your look, reminders, Practice Summary, privacy and export, and your plan.',
  },
];

export default function InfoScreen() {
  const {colors} = useTheme();
  const {width: screenWidth} = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={[styles.inner, iPadContentStyle(screenWidth)]}>
        {/* What Castalia is */}
        <Text style={styles.lead}>A journal that remembers, reflects, and grows with you.</Text>

        {/* The tabs */}
        <View style={styles.section}>
          <Eyebrow style={styles.eyebrow}>How the tabs work</Eyebrow>
          {TABS.map(tab => (
            <View key={tab.name} style={styles.row}>
              <Text style={styles.rowTitle}>{tab.name}</Text>
              <Text style={styles.rowText}>{tab.text}</Text>
            </View>
          ))}
        </View>

        {/* Sophy */}
        <View style={styles.section}>
          <Eyebrow sophy style={styles.eyebrow}>
            Sophy
          </Eyebrow>
          <Text style={styles.body}>
            Sophy is an AI companion. She reads an entry only when you ask her to, or when you turn on her
            insights in You. Otherwise she stays quiet.
          </Text>
          <View style={styles.coralRow}>
            <SophyOrb size={18} />
            <Text style={styles.coralText}>Wherever you see coral, that is Sophy.</Text>
          </View>
        </View>

        {/* Privacy */}
        <View style={styles.section}>
          <Eyebrow style={styles.eyebrow}>Privacy</Eyebrow>
          <Text style={styles.body}>
            Your entries are encrypted, never sold, and never used to train AI models.
          </Text>
        </View>

        {/* Support */}
        <View style={styles.section}>
          <Eyebrow style={styles.eyebrow}>Support</Eyebrow>
          <Text style={styles.body}>
            Questions, or something not working? Write to{' '}
            <Text
              style={styles.link}
              accessibilityRole="link"
              onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>
              {SUPPORT_EMAIL}
            </Text>
            .
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Castalia {APP_VERSION} (build {BUILD_NUMBER})
          </Text>
          <Text style={styles.footerText}>© 2026 Pegasus Realm LLC</Text>
        </View>
      </View>
    </ScrollView>
  );
}

// Dynamic styles based on theme colors
const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    scrollContent: {
      paddingBottom: spacing.xxxl,
    },
    inner: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
    },
    lead: {
      fontFamily: fontFamily.header,
      fontSize: 26,
      lineHeight: 34,
      color: colors.fontMain,
    },
    section: {
      marginTop: 32,
    },
    eyebrow: {
      fontSize: 13,
      marginBottom: spacing.md,
    },
    row: {
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    rowTitle: {
      fontFamily: fontFamily.button,
      fontSize: 16,
      lineHeight: 22,
      color: colors.fontMain,
      marginBottom: 2,
    },
    rowText: {
      fontFamily: fontFamily.body,
      fontSize: 15,
      lineHeight: 22,
      color: colors.fontSecondary,
    },
    body: {
      fontFamily: fontFamily.body,
      fontSize: 16,
      lineHeight: 24,
      color: colors.fontSecondary,
    },
    coralRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginTop: spacing.md,
    },
    coralText: {
      flex: 1,
      fontFamily: fontFamily.button,
      fontSize: 15,
      lineHeight: 21,
      // Sophy's text coral, tuned per theme (deep on light ground for contrast)
      color: colors.sophyLight,
    },
    link: {
      fontFamily: fontFamily.button,
      color: colors.brandPrimary,
      textDecorationLine: 'underline',
    },
    footer: {
      marginTop: 40,
      alignItems: 'center',
    },
    footerText: {
      fontFamily: fontFamily.body,
      fontSize: 13,
      color: colors.fontMuted,
      marginVertical: 2,
    },
  });
