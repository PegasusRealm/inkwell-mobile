/**
 * Pill — quiet selector, one voice (web .grat-pill contract).
 * Active: solid teal, white text. Optional teal today-dot (gratitude nudge). v2.0: teal, not coral;
 * coral is Sophy's alone. A ring in the page color keeps the dot visible on any pill.
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
      {showDot && (
        <View
          style={[styles.dot, {backgroundColor: active ? colors.brandLight : colors.brandPrimary, borderColor: colors.bgPrimary}]}
        />
      )}
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
    top: -4,
    right: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
});
