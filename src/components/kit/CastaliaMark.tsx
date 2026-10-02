/**
 * Castalia brand mark and lockups (2026-10-01, Adam: mark C + wordmark 3).
 * The mark: the arched spring house at Delphi with one drop inside, soft round feet.
 * The wordmark: Newsreader Regular (36pt optical), slightly spaced.
 *
 * Brand asset: draw it from these paths only. Never redraw, recolor outside the
 * theme pair below, or stretch it.
 *   light ground: arch #2A6972 (brandPrimary), drop #4A9BA8 (brandAlt)
 *   dark ground:  arch #89C9D4 (brandLight),   drop #5FB3BF (brandPrimary)
 * `weight="icon"` is the heavier drawing for small sizes (under about 32px).
 */
import React from 'react';
import {View, Text, StyleSheet, StyleProp, ViewStyle} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import {useTheme} from '../../theme/ThemeContext';

const ARCH = 'M21 86 V47 A29 29 0 0 1 79 47 V86';
const DROP = 'M50 40 C50 40 39 54 39 62 A11 11 0 0 0 61 62 C61 54 50 40 50 40 Z';
const DROP_ICON = 'M50 38 C50 38 37 53 37 62 A13 13 0 0 0 63 62 C63 53 50 38 50 38 Z';

interface MarkProps {
  size?: number;
  weight?: 'logo' | 'icon';
  archColor?: string;
  dropColor?: string;
}

export const CastaliaMark: React.FC<MarkProps> = ({size = 28, weight, archColor, dropColor}) => {
  const {colors, isDark} = useTheme();
  const w = weight ?? (size < 32 ? 'icon' : 'logo');
  const arch = archColor ?? (isDark ? colors.brandLight : colors.brandPrimary);
  const drop = dropColor ?? (isDark ? colors.brandPrimary : colors.brandAlt);
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d={ARCH} fill="none" stroke={arch} strokeWidth={w === 'icon' ? 11 : 7.5} strokeLinecap="round" />
      <Path d={w === 'icon' ? DROP_ICON : DROP} fill={drop} />
    </Svg>
  );
};

interface WordmarkProps {
  size?: number;
  color?: string;
}

/** "Castalia" set in the brand wordmark style. */
export const CastaliaWordmark: React.FC<WordmarkProps> = ({size = 20, color}) => {
  const {colors} = useTheme();
  return (
    <Text
      accessibilityRole="header"
      style={[styles.word, {fontSize: size, letterSpacing: size * 0.04, color: color ?? colors.fontMain}]}>
      Castalia
    </Text>
  );
};

interface LockupProps {
  /** Wordmark size; the mark scales with it. */
  size?: number;
  stacked?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Mark + wordmark. Side by side, the arch's feet sit on the wordmark's baseline. */
export const CastaliaLockup: React.FC<LockupProps> = ({size = 20, stacked, style}) => {
  if (stacked) {
    return (
      <View style={[styles.stack, style]} accessible accessibilityLabel="Castalia">
        <CastaliaMark size={Math.round(size * 1.9)} />
        <CastaliaWordmark size={size} />
      </View>
    );
  }
  const markSize = Math.round(size * 1.3);
  return (
    <View style={[styles.row, {gap: Math.round(size * 0.3)}, style]} accessible accessibilityLabel="Castalia">
      <View style={{marginTop: -Math.round(size * 0.22)}}>
        <CastaliaMark size={markSize} />
      </View>
      <CastaliaWordmark size={size} />
    </View>
  );
};

const styles = StyleSheet.create({
  word: {fontFamily: 'Newsreader36pt-Regular'},
  row: {flexDirection: 'row', alignItems: 'center'},
  stack: {alignItems: 'center', gap: 10},
});
