/**
 * KeptScreen (v2.0, 2026-10-01): pops up over Today right after a save.
 * Order matters (board, 2026-10-01): "how heavy now" comes FIRST, before Sophy, so the
 * answer measures the writing and not Sophy's reply. Sophy only appears when asked,
 * because a reflection nobody asked for after a hard entry reads as being analyzed.
 * Skipped after-ratings are recorded (feelAfterSkipped) so "what helps" stays honest later.
 */
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import firestore from '@react-native-firebase/firestore';
import {useTheme, ThemeColors} from '../theme/ThemeContext';
import {spacing, borderRadius, fontFamily} from '../theme';
import {IWButton} from '../components/kit';
import {SophyOrb} from '../components/kit/SophyBlock';
import {CheckIcon} from '../components/kit/icons';
import {FeelCheck} from './WriteScreen';
import PaywallModal from '../components/PaywallModal';
import {useSubscription} from '../hooks/useSubscription';
import {getReflection} from '../services/sophyApi';
import {checkAIAccess, incrementAIUsage, AI_DAILY_LIMIT} from '../services/aiUsageService';
import type {RootStackScreenProps} from '../navigation/types';

const KeptScreen: React.FC<RootStackScreenProps<'Kept'>> = ({navigation, route}) => {
  const {colors} = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {entryId, text, mode, words, minutes, hadFeelBefore, firstSave, stillOpen} = route.params;
  const {hasFeatureAccess, checkFeatureAndShowPaywall, showPaywall, closePaywall} = useSubscription();

  const [feelAfter, setFeelAfter] = useState(0);
  const [reflection, setReflection] = useState('');
  const [asking, setAsking] = useState(false);
  const [keptReflection, setKeptReflection] = useState(false);
  const [note, setNote] = useState('');
  const doc = () => firestore().collection('journalEntries').doc(entryId);
  const closing = useRef(false);
  const feelAfterRef = useRef(0);

  // However the sheet closes (Done, a tap outside, Android Back), a skipped after-rating is
  // recorded once, so "what helps" never counts a skip as no change.
  useEffect(
    () => () => {
      if (hadFeelBefore && !feelAfterRef.current) {
        firestore()
          .collection('journalEntries')
          .doc(entryId)
          .update({feelAfterSkipped: true})
          .catch(() => {});
      }
    },
    [entryId, hadFeelBefore],
  );

  const onFeel = async (n: number) => {
    setFeelAfter(n);
    feelAfterRef.current = n;
    try {
      if (n) await doc().update({feelAfter: n, feelAfterSkipped: firestore.FieldValue.delete()});
      else await doc().update({feelAfter: firestore.FieldValue.delete()});
    } catch (e) {
      console.warn('feelAfter write failed:', e);
    }
  };

  const hearFromSophy = async () => {
    const unlimited = await hasFeatureAccess('ai');
    if (!unlimited) {
      const access = await checkAIAccess();
      if (!access.canUse) {
        Alert.alert("That's today's Sophy", `Free includes ${AI_DAILY_LIMIT} Sophy replies a day. It resets tomorrow. Plus has no daily limit.`, [
          {text: 'Not now', style: 'cancel'},
          {text: 'See Plus', onPress: () => checkFeatureAndShowPaywall('ai')},
        ]);
        return;
      }
    }
    setAsking(true);
    try {
      const r = await getReflection(text);
      setReflection(r || 'I read it. Nothing to add right now. It counts.');
      if (!unlimited) await incrementAIUsage();
    } catch {
      setNote("Sophy couldn't answer just now. Your entry is kept.");
    } finally {
      setAsking(false);
    }
  };

  const keepReflection = async () => {
    try {
      // Same field the old "Save this Reflection" checkbox wrote; Entries shows it in coral.
      await doc().update({reflectionUsed: reflection});
      setKeptReflection(true);
    } catch {
      setNote("Couldn't add it. Try again.");
    }
  };

  const done = async () => {
    if (closing.current) return;
    closing.current = true;
    if (stillOpen) navigation.goBack(); // back to the words still open in Write
    else navigation.navigate('MainTabs', {screen: 'Today'});
  };

  const summary =
    mode === 'gratitude'
      ? 'Kept.'
      : `Kept. ${words} ${words === 1 ? 'word' : 'words'}, ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`;

  return (
    <View style={styles.backdrop}>
      <TouchableOpacity style={styles.backdropTap} activeOpacity={1} onPress={done} accessibilityLabel="Done" />
      <View style={[styles.sheet, {paddingBottom: Math.max(insets.bottom, spacing.lg)}]}>
        <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
          <View style={styles.keptRow}>
            <View style={styles.ok}>
              <CheckIcon color={colors.fontWhite} />
            </View>
            <Text style={styles.keptText}>{summary}</Text>
          </View>
          {stillOpen ? <Text style={styles.first}>{`Your words in ${stillOpen} are still open.`}</Text> : null}
          {firstSave ? <Text style={styles.first}>Your first entry is kept. It's private, and it's here whenever you want it.</Text> : null}

          <FeelCheck question="How heavy is it now?" selected={feelAfter} onTap={onFeel} colors={colors} />

          {!reflection ? (
            <TouchableOpacity style={styles.hear} onPress={hearFromSophy} disabled={asking} accessibilityRole="button">
              <SophyOrb size={22} />
              <Text style={styles.hearText}>{asking ? 'Sophy is reading...' : 'Hear from Sophy'}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.refl}>
              <View style={styles.reflTop}>
                <SophyOrb size={22} />
                <Text style={styles.reflWho}>SOPHY</Text>
              </View>
              <Text style={styles.reflText}>{reflection}</Text>
              {keptReflection ? (
                <Text style={styles.reflKept}>Added to this entry.</Text>
              ) : (
                <View style={styles.reflActs}>
                  <IWButton voice="sophy" small title="Keep it with this entry" onPress={keepReflection} />
                </View>
              )}
            </View>
          )}

          {note ? <Text style={styles.note}>{note}</Text> : null}
          <IWButton title={stillOpen ? `Back to ${stillOpen}` : 'Done'} onPress={done} style={styles.doneBtn} />
        </ScrollView>
      </View>
      <PaywallModal visible={showPaywall} onClose={closePaywall} />
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: {flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)'},
    backdropTap: {flex: 1},
    sheet: {
      backgroundColor: colors.bgPrimary,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '88%',
    },
    inner: {padding: spacing.lg, paddingTop: spacing.xl, gap: spacing.base},
    keptRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.md},
    ok: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.btnPrimary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    keptText: {fontFamily: fontFamily.bodyBold, fontSize: 16, color: colors.fontMain, flex: 1},
    first: {fontFamily: fontFamily.serifItalic, fontStyle: 'italic', fontSize: 16, color: colors.fontSecondary},
    hear: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderWidth: 1,
      borderColor: colors.sophyBorder,
      borderRadius: borderRadius.xl,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.base,
      minHeight: 52,
    },
    hearText: {fontFamily: fontFamily.bodyBold, fontSize: 15, color: colors.sophyLight},
    refl: {
      backgroundColor: colors.sophyTint,
      borderColor: colors.sophyBorder,
      borderWidth: 1,
      borderRadius: borderRadius.xl,
      padding: spacing.base,
      gap: spacing.md,
    },
    reflTop: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
    reflWho: {fontFamily: fontFamily.bodyBold, fontSize: 13, letterSpacing: 1.6, color: colors.sophyLight},
    reflText: {fontFamily: fontFamily.serif, fontSize: 17, lineHeight: 26, color: colors.fontMain},
    reflActs: {flexDirection: 'row', gap: spacing.sm},
    reflKept: {fontFamily: fontFamily.body, fontSize: 15, color: colors.fontSecondary},
    note: {fontFamily: fontFamily.body, fontSize: 15, color: colors.fontSecondary},
    doneBtn: {marginTop: spacing.sm},
  });

export default KeptScreen;
