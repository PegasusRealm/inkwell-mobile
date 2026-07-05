/**
 * FirstStepsCard + CoachHint — event-driven onboarding UI (web parity, 2026-07-04).
 * The quest card fills as things actually happen; leaves forever when done.
 * Video-game structure, InkWell manners. CoachHint is the mobile adaptation of
 * the web's floating coach marks: same once-ever state, same copy, rendered
 * inline at the anchor surface instead of absolutely positioned.
 */
import React, {useEffect, useState, useRef, useMemo} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Animated} from 'react-native';
import {spacing, borderRadius, fontFamily, fontSize} from '../theme';
import {useTheme, ThemeColors} from '../theme/ThemeContext';
import {Card, Eyebrow} from './kit';
import {
  FirstStepsService,
  FirstStepsState,
  FIRST_STEPS,
  FirstStepKey,
} from '../services/firstStepsService';

/** Subscribe a component to quest state (initializes the service on first use). */
export const useFirstSteps = (): FirstStepsState | null => {
  const [state, setState] = useState<FirstStepsState | null>(FirstStepsService.getState());
  useEffect(() => {
    const unsub = FirstStepsService.subscribe(setState);
    FirstStepsService.init();
    return unsub;
  }, []);
  return state;
};

interface FirstStepsCardProps {
  onGo: (step: FirstStepKey) => void;
}

export const FirstStepsCard: React.FC<FirstStepsCardProps> = ({onGo}) => {
  const {colors} = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const state = useFirstSteps();

  // Finale: linger on the completion line, then fade out (web parity)
  const [finaleVisible, setFinaleVisible] = useState(false);
  const wasDoneRef = useRef<boolean | null>(null);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!state) return;
    if (wasDoneRef.current === null) {
      wasDoneRef.current = state.done;
      return;
    }
    if (state.done && !wasDoneRef.current) {
      wasDoneRef.current = true; // transition consumed — a later notify can't replay the finale
      setFinaleVisible(true);
      const t = setTimeout(() => {
        Animated.timing(fade, {toValue: 0, duration: 1200, useNativeDriver: true}).start(() =>
          setFinaleVisible(false),
        );
      }, 3200);
      return () => clearTimeout(t);
    }
    wasDoneRef.current = state.done;
  }, [state, fade]);

  if (!state || state.dismissed || (state.done && !finaleVisible)) return null;

  return (
    <Animated.View style={{opacity: fade}}>
      <Card style={styles.card}>
        {finaleVisible ? (
          <Text style={styles.finale}>
            You know your way around. The rest reveals itself as you write.
          </Text>
        ) : (
          <>
            <View style={styles.headerRow}>
              <Eyebrow>First steps</Eyebrow>
              <TouchableOpacity
                onPress={() => FirstStepsService.dismiss()}
                hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                <Text style={styles.dismissLink}>I know my way around</Text>
              </TouchableOpacity>
            </View>
            {FIRST_STEPS.map(([key, label, sub]) => {
              const done = state[key];
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.row, done && styles.rowDone]}
                  onPress={() => onGo(key)}>
                  <View style={[styles.dot, done && styles.dotDone]}>
                    {done ? <Text style={styles.dotCheck}>✓</Text> : null}
                  </View>
                  <Text style={[styles.label, done && styles.labelDone]}>{label}</Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {sub}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </>
        )}
      </Card>
    </Animated.View>
  );
};

interface CoachHintProps {
  /** Once-ever mark id (web marks{} parity: textarea/entriestab/calendar/planner) */
  markId: string;
  text: string;
}

/** One-time inline hint at its anchor surface. Claims its mark on first render. */
export const CoachHint: React.FC<CoachHintProps> = ({markId, text}) => {
  const {colors} = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [visible, setVisible] = useState(false);
  const claimedRef = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const state = useFirstSteps();

  useEffect(() => {
    if (claimedRef.current || !state) return;
    claimedRef.current = true;
    if (FirstStepsService.claimMark(markId)) {
      setVisible(true);
      // Timer owned by a ref, not the effect — the claim's own notify re-runs
      // this effect, and effect-owned cleanup would kill the 14s auto-hide
      hideTimer.current = setTimeout(() => setVisible(false), 14000);
    }
  }, [state, markId]);

  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    [],
  );

  if (!visible) return null;

  return (
    <View style={styles.hint}>
      <Text style={styles.hintText}>{text}</Text>
      <TouchableOpacity onPress={() => setVisible(false)} hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
        <Text style={styles.hintGotIt}>Got it</Text>
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      marginBottom: spacing.lg,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    dismissLink: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.xs,
      color: colors.fontMuted,
      textDecorationLine: 'underline',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: 6,
      minHeight: 36,
    },
    rowDone: {
      opacity: 0.55,
    },
    dot: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 1.5,
      borderColor: colors.borderMedium,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dotDone: {
      backgroundColor: colors.brandPrimary,
      borderColor: colors.brandPrimary,
    },
    dotCheck: {
      color: colors.fontWhite,
      fontSize: 10,
      fontFamily: fontFamily.buttonBold,
    },
    label: {
      fontFamily: fontFamily.buttonBold,
      fontSize: fontSize.sm,
      color: colors.fontMain,
    },
    labelDone: {
      textDecorationLine: 'line-through',
    },
    sub: {
      flex: 1,
      fontFamily: fontFamily.body,
      fontSize: fontSize.xs,
      color: colors.fontMuted,
    },
    finale: {
      fontFamily: fontFamily.serifItalic,
      fontStyle: 'italic',
      fontSize: fontSize.md,
      color: colors.fontMain,
      lineHeight: fontSize.md * 1.5,
    },
    hint: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.infoBg,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.md,
    },
    hintText: {
      flex: 1,
      fontFamily: fontFamily.body,
      fontSize: fontSize.sm,
      color: colors.fontSecondary,
      lineHeight: 19,
    },
    hintGotIt: {
      fontFamily: fontFamily.buttonBold,
      fontSize: fontSize.xs,
      color: colors.brandPrimary,
    },
  });

export default FirstStepsCard;
