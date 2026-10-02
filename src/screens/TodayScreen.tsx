/**
 * TodayScreen (v2.0, 2026-10-01): where InkWell opens. One question, one button.
 * Ways in sit under it, Sophy waits until asked, and one memory comes back when there's
 * a kind one to bring back.
 *
 * Memory card rule (board, revised by Phil 2026-10-01): only what the person wrote as a good
 * thing comes back: a gratitude entry (not mental subtraction, which imagines a loss), or the
 * "Another way to see it" line of a reframe, never the event or the painful read. Feeling
 * lighter after writing says nothing about the content, so it no longer qualifies.
 * It can be turned off in You > Your words ("Show past entries on Today").
 */
import React, {useCallback, useMemo, useState} from 'react';
import {View, Text, ScrollView, TouchableOpacity, StyleSheet, useWindowDimensions, Alert} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {useTheme, ThemeColors} from '../theme/ThemeContext';
import {spacing, borderRadius, fontFamily} from '../theme';
import {IdentityBar} from '../components/IdentityBar';
import {IWButton, Pill} from '../components/kit';
import {SophyOrb} from '../components/kit/SophyBlock';
import {MicIcon, CloseIcon} from '../components/kit/icons';
import {FirstStepsCard} from '../components/FirstStepsCard';
import {FirstStepKey, FirstStepsService} from '../services/firstStepsService';
import PaywallModal from '../components/PaywallModal';
import {useSubscription} from '../hooks/useSubscription';
import {generatePrompt} from '../services/sophyApi';
import {checkAIAccess, incrementAIUsage, AI_DAILY_LIMIT} from '../services/aiUsageService';
import {iPadContentStyle} from '../utils/iPad';
import {GRAT_DONE_KEY, todayKey, suggestedGratitudePractice} from '../services/writeShared';
import type {TabScreenProps, WriteMode} from '../navigation/types';

export const SHOW_MEMORIES_KEY = 'iw_show_memories';
const MEMORY_HIDDEN_KEY = 'iw_memory_hidden_on';

// The question rotates by day so it never wears into wallpaper. [before, emphasized, after]
const QUESTIONS: Array<[string, string, string]> = [
  ["What's taking up ", 'space', ' today?'],
  ['What do you want to ', 'remember', ' about today?'],
  ["What's asking for your ", 'attention', '?'],
  ['What went ', 'better', ' than you expected?'],
  ['What are you ', 'carrying', ' into today?'],
  ['What would make tonight ', 'easier', '?'],
  ['Where did your ', 'energy', ' go yesterday?'],
  ['What surprised you ', 'lately', '?'],
  ["What's one thing you'd like to say ", 'out loud', '?'],
  ['What do you need ', 'more', ' of this week?'],
];

const WAYS: Array<{mode: WriteMode; label: string}> = [
  {mode: 'free', label: 'Free-write'},
  {mode: 'sprint', label: 'Sprint'},
  {mode: 'gratitude', label: 'Gratitude'},
  {mode: 'reframe', label: 'Reframe'},
  {mode: 'inkblot', label: 'InkBlot'},
];

const PRACTICE_NAME: Record<string, string> = {
  three: 'Gratitude',
  deep: 'Gratitude',
  subtraction: 'Gratitude',
  letter: 'Gratitude letter',
  savor: 'Savoring',
};

/** The part of an entry that's safe to bring back, or null if none of it is. */
function memoryText(e: any): {text: string; kind: string} | null {
  if (e.deletedAt) return null;
  const t: string = (e.text || '').trim();
  if (e.entryMode === 'gratitude') {
    if (e.gratitudeMode === 'subtraction') return null;
    const body = t
      .replace(/^Today I'm grateful for:\s*/i, '')
      .replace(/^One gratitude, deeply:\s*/i, '')
      .replace(/^Savoring the moment:\s*/i, '')
      .replace(/^Gratitude letter to [^:\n]*:\s*/i, '')
      .trim();
    return body ? {text: body, kind: PRACTICE_NAME[e.gratitudeMode] || 'Gratitude'} : null;
  }
  if (Array.isArray(e.tags) && e.tags.includes('reframe')) {
    const i = t.lastIndexOf('Another way to see it:');
    if (i < 0) return null;
    const body = t.slice(i + 'Another way to see it:'.length).trim();
    return body && body !== '(skipped)' ? {text: body, kind: 'Reframe'} : null;
  }
  return null;
}

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

interface Memory {
  label: string;
  snippet: string;
  meta: string;
  /** YYYY-MM-DD, so a tap opens that day in Entries */
  day: string;
}

const dayOfYear = (d: Date) => Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000);

const TodayScreen: React.FC<TabScreenProps<'Today'>> = ({navigation}) => {
  const {colors} = useTheme();
  const {width: screenWidth} = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {hasFeatureAccess, checkFeatureAndShowPaywall, showPaywall, closePaywall} = useSubscription();

  const now = new Date();
  const dateLine = now.toLocaleDateString('en-US', {weekday: 'long', month: 'long', day: 'numeric'}).toUpperCase();
  const [q0, q1, q2] = QUESTIONS[dayOfYear(now) % QUESTIONS.length];

  const [refresh, setRefresh] = useState(0);
  const [gratDoneToday, setGratDoneToday] = useState(true);
  const [memory, setMemory] = useState<Memory | null>(null);
  const [prompt, setPrompt] = useState('');
  const [asking, setAsking] = useState(false);

  const loadMemory = useCallback(async () => {
    try {
      const pref = await AsyncStorage.getItem(SHOW_MEMORIES_KEY);
      const hiddenOn = await AsyncStorage.getItem(MEMORY_HIDDEN_KEY);
      if (pref === '0' || hiddenOn === todayKey()) {
        setMemory(null);
        return;
      }
      const user = auth().currentUser;
      if (!user) return;
      const DAY = 24 * 3600 * 1000;
      const windows = [
        {label: 'One year ago', ms: 365 * DAY, pad: 3 * DAY},
        {label: 'One month ago', ms: 30 * DAY, pad: 2 * DAY},
      ];
      for (const w of windows) {
        const center = Date.now() - w.ms;
        const snap = await firestore()
          .collection('journalEntries')
          .where('userId', '==', user.uid)
          .where('createdAt', '>=', new Date(center - w.pad))
          .where('createdAt', '<=', new Date(center + w.pad))
          .orderBy('createdAt', 'desc')
          .limit(20)
          .get();
        for (const doc of snap.docs) {
          const e = doc.data();
          const safe = memoryText(e);
          if (!safe) continue;
          const d = e.createdAt?.toDate ? e.createdAt.toDate() : new Date(e.createdAt);
          if (isNaN(d.getTime())) continue;
          const text = safe.text;
          setMemory({
            label: w.label,
            snippet: text.length > 200 ? text.slice(0, 200).replace(/\s+\S*$/, '') + '…' : text,
            meta: `${safe.kind} · ${d.toLocaleDateString('en-US', {month: 'long', day: 'numeric'})}`,
            day: ymd(d),
          });
          return;
        }
      }
      setMemory(null);
    } catch (e: any) {
      console.warn('Memory card skipped:', e?.message);
      setMemory(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setRefresh(n => n + 1);
      AsyncStorage.getItem(GRAT_DONE_KEY).then(v => setGratDoneToday(v === todayKey()));
      loadMemory();
    }, [loadMemory]),
  );

  const openWrite = (mode: WriteMode, extra: Record<string, unknown> = {}) => {
    const params: any = {mode, ...extra};
    if (mode === 'gratitude') params.gratPractice = suggestedGratitudePractice();
    navigation.navigate('Write', params);
  };

  const onFirstStep = (step: FirstStepKey) => {
    if (step === 'entries') return navigation.navigate('Entries');
    if (step === 'wish') return navigation.navigate('Goals');
    openWrite('free');
  };

  const askSophy = async () => {
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
      const p = await generatePrompt('');
      setPrompt(p);
      if (!unlimited) await incrementAIUsage();
      FirstStepsService.complete('prompt');
    } catch {
      Alert.alert("Sophy couldn't answer", 'Check your connection and try again.');
    } finally {
      setAsking(false);
    }
  };

  const hideMemoryToday = async () => {
    setMemory(null);
    await AsyncStorage.setItem(MEMORY_HIDDEN_KEY, todayKey());
  };

  return (
    <View style={styles.screen}>
      <IdentityBar refreshTrigger={refresh} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={[styles.content, iPadContentStyle(screenWidth)]}>
          <Text style={styles.date}>{dateLine}</Text>
          <Text style={styles.question} accessibilityRole="header">
            {q0}
            <Text style={styles.questionEm}>{q1}</Text>
            {q2}
          </Text>

          <FirstStepsCard onGo={onFirstStep} />

          {/* The one main thing: start writing */}
          <TouchableOpacity style={styles.start} activeOpacity={0.85} onPress={() => openWrite('free')}>
            <Text style={styles.startPh}>The page is yours. Nothing here needs to be good. It just needs to be true.</Text>
            <View style={styles.startRow}>
              <TouchableOpacity
                style={styles.speak}
                onPress={() => openWrite('free', {startVoice: true})}
                accessibilityRole="button"
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <MicIcon size={19} color={colors.fontSecondary} />
                <Text style={styles.speakText}>Speak it</Text>
              </TouchableOpacity>
              <IWButton title="Start writing" onPress={() => openWrite('free')} />
            </View>
          </TouchableOpacity>

          {/* Ways in */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ways}>
            {WAYS.map(w => (
              <Pill
                key={w.mode}
                label={w.label}
                active={false}
                onPress={() => openWrite(w.mode)}
                showDot={w.mode === 'gratitude' && !gratDoneToday}
              />
            ))}
          </ScrollView>

          {/* Sophy, only when asked */}
          <View style={styles.sophy}>
            <View style={styles.sophyTop}>
              <SophyOrb size={26} />
              <View style={styles.sophyText}>
                <Text style={styles.sophyWho}>SOPHY</Text>
                <Text style={styles.sophyLine}>{prompt || 'Want a place to start?'}</Text>
              </View>
              {!prompt ? (
                <IWButton voice="sophy" small title={asking ? '...' : 'Ask'} onPress={askSophy} loading={asking} />
              ) : null}
            </View>
            {prompt ? (
              <View style={styles.sophyActs}>
                <IWButton voice="sophy" small title="Write with this" onPress={() => openWrite('free', {prompt})} />
                <TouchableOpacity onPress={askSophy} disabled={asking} style={styles.sophyAnother}>
                  <Text style={styles.sophyAnotherText}>{asking ? 'Thinking...' : 'Another'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setPrompt('')} style={styles.sophyAnother}>
                  <Text style={styles.sophyAnotherText}>Not now</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          {/* One kind memory, when there is one */}
          {memory ? (
            <TouchableOpacity style={styles.memory} activeOpacity={0.85} onPress={() => navigation.navigate('Entries', {jumpTo: memory.day})}>
              <View style={styles.memoryTop}>
                <Text style={styles.memoryLabel}>{memory.label.toUpperCase()}</Text>
                <TouchableOpacity
                  onPress={hideMemoryToday}
                  accessibilityLabel="Hide this for today"
                  hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                  <CloseIcon size={15} color={colors.fontMuted} />
                </TouchableOpacity>
              </View>
              <Text style={styles.memoryText} numberOfLines={4}>
                {memory.snippet}
              </Text>
              <Text style={styles.memoryMeta}>{memory.meta}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>
      <PaywallModal visible={showPaywall} onClose={closePaywall} />
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: {flex: 1, backgroundColor: colors.bgPrimary},
    scroll: {paddingBottom: spacing.xxxl},
    content: {padding: spacing.lg, gap: spacing.xl},
    date: {fontFamily: fontFamily.bodyBold, fontSize: 15, letterSpacing: 1.6, color: colors.fontMuted, marginBottom: -spacing.lg},
    question: {fontFamily: fontFamily.header, fontSize: 32, lineHeight: 38, color: colors.fontMain},
    questionEm: {fontFamily: fontFamily.headerItalic, fontStyle: 'italic', color: colors.brandLight},
    start: {
      backgroundColor: colors.bgCard,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: borderRadius.xl,
      padding: spacing.lg,
      gap: spacing.lg,
    },
    startPh: {fontFamily: fontFamily.serifItalic, fontStyle: 'italic', fontSize: 19, lineHeight: 28, color: colors.fontMuted},
    startRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
    speak: {flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 44},
    speakText: {fontFamily: fontFamily.bodyBold, fontSize: 15, color: colors.fontSecondary},
    ways: {gap: spacing.sm, paddingRight: spacing.lg},
    sophy: {
      backgroundColor: colors.sophyTint,
      borderColor: colors.sophyBorder,
      borderWidth: 1,
      borderRadius: borderRadius.xl,
      padding: spacing.base,
      gap: spacing.md,
    },
    sophyTop: {flexDirection: 'row', alignItems: 'center', gap: spacing.md},
    sophyText: {flex: 1},
    sophyWho: {fontFamily: fontFamily.bodyBold, fontSize: 13, letterSpacing: 1.6, color: colors.sophyLight},
    sophyLine: {fontFamily: fontFamily.serifItalic, fontStyle: 'italic', fontSize: 17, lineHeight: 24, color: colors.fontMain},
    sophyActs: {flexDirection: 'row', alignItems: 'center', gap: spacing.base, flexWrap: 'wrap'},
    sophyAnother: {minHeight: 44, justifyContent: 'center'},
    sophyAnotherText: {fontFamily: fontFamily.body, fontSize: 15, color: colors.fontSecondary},
    memory: {
      backgroundColor: colors.bgMuted,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: borderRadius.xl,
      padding: spacing.base,
      gap: spacing.sm,
    },
    memoryTop: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
    memoryLabel: {fontFamily: fontFamily.bodyBold, fontSize: 13, letterSpacing: 1.6, color: colors.brandPrimary},
    memoryText: {fontFamily: fontFamily.serif, fontSize: 17, lineHeight: 26, color: colors.fontMain},
    memoryMeta: {fontFamily: fontFamily.body, fontSize: 15, color: colors.fontMuted},
  });

export default TodayScreen;
