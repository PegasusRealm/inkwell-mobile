/**
 * Eyebrow — small caps label over a section (mockup .who / manifest-eyebrow).
 * Teal by default (structure); coral for Sophy via the `sophy` prop.
 */
import React from 'react';
import {Text, TextProps, StyleSheet} from 'react-native';
import {useTheme} from '../../theme/ThemeContext';
import {fontFamily} from '../../theme/typography';

interface EyebrowProps extends TextProps {
  sophy?: boolean;
}

export const Eyebrow: React.FC<EyebrowProps> = ({sophy, style, children, ...rest}) => {
  const {colors} = useTheme();
  return (
    <Text
      style={[styles.base, {color: sophy ? colors.sophyLight : colors.brandPrimary}, style]}
      {...rest}>
      {typeof children === 'string' ? children.toUpperCase() : children}
    </Text>
  );
};

const styles = StyleSheet.create({
  base: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    letterSpacing: 1.8,
  },
});
