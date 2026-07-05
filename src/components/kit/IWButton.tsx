/**
 * IWButton — one family, four voices (web inkwell-v2.css button contract).
 *   primary: solid teal, white text — the app's hand
 *   gray:    quiet neutral, hairline border
 *   sophy:   coral ghost — HER voice only; fills coral when pressed
 *   danger:  red, same chassis
 */
import React, {useState} from 'react';
import {Pressable, Text, StyleSheet, ViewStyle, ActivityIndicator} from 'react-native';
import {useTheme} from '../../theme/ThemeContext';
import {fontFamily} from '../../theme/typography';

export type ButtonVoice = 'primary' | 'gray' | 'sophy' | 'danger';

interface IWButtonProps {
  title: string;
  onPress?: () => void;
  voice?: ButtonVoice;
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  style?: ViewStyle;
}

export const IWButton: React.FC<IWButtonProps> = ({
  title, onPress, voice = 'primary', disabled, loading, small, style,
}) => {
  const {colors} = useTheme();
  const [pressed, setPressed] = useState(false);

  const chassis: ViewStyle = {borderRadius: 10, borderWidth: 1.5, borderColor: 'transparent'};
  let bg = colors.btnPrimary;
  let border = 'transparent';
  let fg = colors.fontWhite;

  if (voice === 'primary') {
    bg = pressed ? colors.btnPrimaryHover : colors.btnPrimary;
  } else if (voice === 'gray') {
    bg = pressed ? colors.btnSecondaryHover : colors.btnSecondary;
    border = colors.borderMedium;
    fg = colors.fontSecondary;
  } else if (voice === 'sophy') {
    bg = pressed ? colors.sophyAccent : 'transparent';
    border = colors.sophyAccent;
    fg = pressed ? '#241512' : colors.sophyLight;
  } else if (voice === 'danger') {
    bg = pressed ? colors.btnDangerHover : colors.btnDanger;
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        chassis,
        styles.base,
        small && styles.small,
        {backgroundColor: bg, borderColor: border, opacity: disabled ? 0.45 : 1},
        style,
      ]}>
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <Text style={[styles.label, small && styles.labelSmall, {color: fg}]}>{title}</Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    paddingVertical: 12,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  small: {paddingVertical: 8, paddingHorizontal: 16},
  label: {fontFamily: fontFamily.buttonBold, fontSize: 15, lineHeight: 18},
  labelSmall: {fontSize: 13, lineHeight: 16},
});
