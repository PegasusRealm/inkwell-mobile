/**
 * Pill — quiet selector, one voice (web .grat-pill contract).
 * Active: solid teal, white text. Optional coral today-dot (gratitude nudge).
 */
import React from 'react';
import {Pressable, Text, View, StyleSheet, ViewStyle} from 'react-native';
import {useTheme} from '../../theme/ThemeContext';
import {fontFamily} from '../../theme/typography';

interface PillProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
  showDot?: boolean;
  style?: ViewStyle;
}

export const Pill: React.FC<PillProps> = ({label, active, onPress, showDot, style}) => {
  const {colors} = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.base,
        {
          backgroundColor: active ? colors.btnPrimary : 'transparent',
          borderColor: active ? colors.btnPrimary : colors.borderMedium,
        },
        style,
      ]}>
      <Text
        style={[
          styles.label,
          {color: active ? colors.fontWhite : colors.fontSecondary},
        ]}>
        {label}
      </Text>
      {showDot && <View style={[styles.dot, {backgroundColor: colors.sophyLight}]} />}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: 999,
    borderWidth: 1.5,
    paddingVertical: 9,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {fontFamily: fontFamily.button, fontSize: 14, lineHeight: 17},
  dot: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 9,
    height: 9,
    borderRadius: 5,
  },
});
