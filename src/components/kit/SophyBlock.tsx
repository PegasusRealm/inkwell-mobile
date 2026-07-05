/**
 * SophyBlock + SophyRow — HER container. Verbatim port of the approved
 * mockup (mockup-a .sophy-row) via the web .sophy-block contract.
 *
 * LAWS: coral only, NEVER teal inside; her fields are warm surfaces
 * (colors.sophyFieldBg/Border); her words render serif italic.
 * The orb breathes: soft coral halo pulse.
 */
import React, {useEffect, useRef} from 'react';
import {View, Text, Animated, StyleSheet, ViewStyle} from 'react-native';
import {useTheme} from '../../theme/ThemeContext';
import {fontFamily} from '../../theme/typography';

export const SophyOrb: React.FC<{size?: number}> = ({size = 28}) => {
  const {colors} = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {toValue: 1, duration: 1600, useNativeDriver: true}),
        Animated.timing(pulse, {toValue: 0, duration: 1600, useNativeDriver: true}),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const haloScale = pulse.interpolate({inputRange: [0, 1], outputRange: [1, 1.45]});
  const haloOpacity = pulse.interpolate({inputRange: [0, 1], outputRange: [0.05, 0.3]});

  return (
    <View style={{width: size, height: size}}>
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          {
            borderRadius: size / 2,
            backgroundColor: colors.sophyLight,
            transform: [{scale: haloScale}],
            opacity: haloOpacity,
          },
        ]}
      />
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.sophyLight,
        }}>
        <View
          style={{
            position: 'absolute',
            top: size * 0.18,
            left: size * 0.22,
            width: size * 0.32,
            height: size * 0.32,
            borderRadius: size * 0.16,
            backgroundColor: 'rgba(255, 255, 255, 0.35)',
          }}
        />
      </View>
    </View>
  );
};

interface SophyRowProps {
  line: string;
  who?: string;
  children?: React.ReactNode; // trailing action, e.g. a sophy-voice IWButton
}

/** Orb + WHO + her line. Use inside SophyBlock, or standalone for a slim row. */
export const SophyRow: React.FC<SophyRowProps> = ({line, who = 'Sophy', children}) => {
  const {colors} = useTheme();
  return (
    <View style={styles.row}>
      <SophyOrb />
      <View style={styles.rowText}>
        <Text style={[styles.who, {color: colors.sophyLight}]}>{who.toUpperCase()}</Text>
        <Text style={[styles.line, {color: colors.fontMain}]}>{line}</Text>
      </View>
      {children}
    </View>
  );
};

interface SophyBlockProps {
  line: string;
  who?: string;
  style?: ViewStyle;
  children?: React.ReactNode; // her inputs/buttons/outputs — one function, one container
}

/** The full coral-tinted container: row + whatever she needs below it. */
export const SophyBlock: React.FC<SophyBlockProps> = ({line, who, style, children}) => {
  const {colors} = useTheme();
  return (
    <View
      style={[
        styles.block,
        {
          backgroundColor: colors.sophyTint,
          borderColor: colors.sophyBorder,
        },
        style,
      ]}>
      <SophyRow line={line} who={who} />
      {children ? <View style={styles.blockBody}>{children}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  block: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  blockBody: {
    marginTop: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowText: {flex: 1},
  who: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 10.5,
    letterSpacing: 2,
    marginBottom: 2,
  },
  line: {
    fontFamily: fontFamily.serifItalic,
    fontStyle: 'italic',
    fontSize: 15.5,
    lineHeight: 22,
  },
});
