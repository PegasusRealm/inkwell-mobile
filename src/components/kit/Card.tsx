/**
 * Card — the one surface language (mockup .sheet / web .iw-card contract).
 * Light: white on lift ground, hairline stroke. Dark: raised ink, deep shadow.
 */
import React from 'react';
import {View, ViewProps, StyleSheet} from 'react-native';
import {useTheme} from '../../theme/ThemeContext';

interface CardProps extends ViewProps {
  padded?: boolean;
}

export const Card: React.FC<CardProps> = ({padded = true, style, children, ...rest}) => {
  const {colors, isDark} = useTheme();
  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: colors.bgCard,
          borderColor: colors.borderLight,
          shadowOpacity: isDark ? 0.55 : 0.08,
        },
        padded && styles.padded,
        style,
      ]}
      {...rest}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 10},
    shadowRadius: 24,
    elevation: 4,
  },
  padded: {
    padding: 20,
  },
});
