/**
 * IdentityBar + ScreenTitle (v2.0, 2026-10-01): the slim bar every tab shares.
 * Wordmark left, this week's writing dots right. No Settings link: settings live in You.
 * Type floor: nothing under 13px; titles are the display serif.
 */
import React from 'react';
import {View, Text, StyleSheet, StyleProp, ViewStyle, TextStyle} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../theme/ThemeContext';
import {fontFamily, spacing} from '../theme';
import WeeklyActivityDots from './WeeklyActivityDots';

interface IdentityBarProps {
  refreshTrigger?: number;
  right?: React.ReactNode;
}

export const IdentityBar: React.FC<IdentityBarProps> = ({refreshTrigger, right}) => {
  const {colors} = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.bar,
        {paddingTop: insets.top + spacing.sm, backgroundColor: colors.bgPrimary, borderBottomColor: colors.borderLight},
      ]}>
      <Text style={[styles.wordmark, {color: colors.fontMain}]}>
        Ink<Text style={{color: colors.brandPrimary}}>Well</Text>
      </Text>
      <View style={styles.right}>
        {right}
        <WeeklyActivityDots refreshTrigger={refreshTrigger} />
      </View>
    </View>
  );
};

interface ScreenTitleProps {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
}

/** The big serif screen title ("Entries", "Goals", "You"). */
export const ScreenTitle: React.FC<ScreenTitleProps> = ({children, style, containerStyle}) => {
  const {colors} = useTheme();
  return (
    <View style={containerStyle}>
      <Text style={[styles.title, {color: colors.fontMain}, style]} accessibilityRole="header">
        {children}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
  },
  wordmark: {
    fontFamily: fontFamily.header,
    fontSize: 20,
    letterSpacing: 0.3,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    fontFamily: fontFamily.header,
    fontSize: 30,
    lineHeight: 36,
    marginBottom: spacing.base,
  },
});
