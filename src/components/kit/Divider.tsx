/**
 * Divider — one hairline, generous air (web .workflow-divider contract).
 */
import React from 'react';
import {View} from 'react-native';
import {useTheme} from '../../theme/ThemeContext';

export const Divider: React.FC<{spacing?: number}> = ({spacing = 28}) => {
  const {colors} = useTheme();
  return (
    <View
      style={{
        height: 1,
        backgroundColor: colors.borderLight,
        marginVertical: spacing,
      }}
    />
  );
};
