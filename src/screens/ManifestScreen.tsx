/**
 * Goals tab (route key 'Goals'; file name kept). v2.0 re-skin, 2026-10-01.
 *
 * Options pass (Adam, 2026-10-01): one name ("your goal"), one start, one Sophy check.
 * With a goal:   Your goal (Want, runway, How, Edit)
 *                -> quiet "Done with this one? Start a new goal." (clears it, after a confirm).
 * Without one:   Start a goal: "Do you know what you want?"
 *                  Yes      -> the four steps (Want / Imagine / Snags / How)
 *                  Not sure -> the values planner, which hands its pick to the Want.
 * The builder ends with one "Check my plan with Sophy" (the whole plan, not each step).
 * WISH (the four steps' initials) is named once, in "Why this works". Data keys are unchanged.
 *
 * Data is untouched by the re-skin: manifests/{uid} and the AsyncStorage keys
 * manifest_ / wishStart_ / wishTimeline_ are read and written exactly as
 * before; planner state stays in users/{uid}.valuesPlanner (owned by
 * ValuesPlanner). LAW: free-tier flows only on this tab, never a paywall gate.
 * Check-ins and earlier goals arrive in 2.1.
 */
import React, {useState, useEffect, useMemo, useCallback, useRef} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import {useFocusEffect} from '@react-navigation/native';
import {spacing, borderRadius, fontFamily, fontSize} from '../theme';
import {useTheme, ThemeColors} from '../theme/ThemeContext';
import {checkGoalPlan} from '../services/sophyApi';
import ValuesPlanner from '../components/ValuesPlanner';
import {IdentityBar, ScreenTitle} from '../components/IdentityBar';
import {Card, IWButton, Pill, Eyebrow, Divider} from '../components/kit';
import {CoachHint} from '../components/FirstStepsCard';
import InfoModal, {InfoParagraph, InfoHighlightBox, InfoSection} from '../components/InfoModal';
import {FirstStepsService} from '../services/firstStepsService';
import type {TabScreenProps} from '../navigation/types';
import {iPadContentStyle, getKeyboardVerticalOffset} from '../utils/iPad';

type WishSection = 'want' | 'imagine' | 'snags' | 'how';
type WishTexts = Record<WishSection, string>;

const EMPTY_WISH: WishTexts = {want: '', imagine: '', snags: '', how: ''};
const WISH_KEYS: WishSection[] = ['want', 'imagine', 'snags', 'how'];

// Builder copy (web app.html manifest tab)
const WISH_SECTIONS: Array<{
  key: WishSection;
  heading: string;
  placeholder: string;
  tip?: string;
}> = [
  {
    key: 'want',
    heading: 'Want',
    placeholder:
      'Name the goal you want most right now. Keep it specific, meaningful, and within reach.\n\nExample: Walk 30 minutes every weekday.',
  },
  {
    key: 'imagine',
    heading: 'Imagine',
    placeholder:
      'Describe the best thing about reaching this goal. How will it feel? What gets better? Write it like it already happened, with real detail.',
  },
  {
    key: 'snags',
    heading: 'Snags',
    placeholder:
      'List what could get in your way. Look inside first: habits, moods, and excuses count as much as outside problems.\n\nExample: I stay up too late, so I skip my morning walk.',
  },
  {
    key: 'how',
    heading: 'How',
    placeholder:
      'Write an if-then plan for each snag, and tie it to something you already do daily.\n\nExample: If it hits 9 pm, then I plug my phone in across the room.',
    tip: 'Tip: anchor new habits to ones you already have. "After I [pour my coffee], I will [write one line]."',
  },
];

const hasAnyText = (w: WishTexts | null) => !!w && WISH_KEYS.some(k => w[k].trim().length > 0);

const ManifestScreen: React.FC<TabScreenProps<'Goals'>> = ({navigation}) => {
  const {colors} = useTheme();
  const {width: screenWidth} = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView>(null);

  // The identity bar replaces the navigation header (matches the other tabs)
  useEffect(() => {
    navigation.setOptions({headerShown: false});
  }, [navigation]);

  // Week dots refresh when the tab regains focus (an entry may have been kept elsewhere)
  const [dotsRefresh, setDotsRefresh] = useState(0);
  const firstFocusRef = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocusRef.current) {
        firstFocusRef.current = false;
        return;
      }
      setDotsRefresh(n => n + 1);
    }, []),
  );

  const scrollToTop = () => scrollRef.current?.scrollTo({y: 0, animated: true});

  // Timeline state
  const [wishTimeline, setWishTimeline] = useState<number>(60);

  // WISH state: wishTexts is the builder buffer; savedWish is what was last
  // loaded or saved (drives the summary card and Cancel)
  const [wishTexts, setWishTexts] = useState<WishTexts>(EMPTY_WISH);
  const [savedWish, setSavedWish] = useState<WishTexts | null>(null);
  const [wishLoaded, setWishLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const editingRef = useRef(false);
  useEffect(() => {
    editingRef.current = editing;
  }, [editing]);

  // One Sophy check on the whole plan (replaces the four per-step buttons)
  const [planCheck, setPlanCheck] = useState('');
  const [checkingPlan, setCheckingPlan] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [showWhy, setShowWhy] = useState(false);

  // Start a goal: null = the question; 'know' = the four steps
  const [startPath, setStartPath] = useState<'know' | null>(null);

  // Planner state
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [plannerResumeNote, setPlannerResumeNote] = useState('');

  const hasWish = hasAnyText(savedWish);

  // Resume note (web vpResumeNote parity), refreshed on mount AND on planner close
  const loadResumeNote = useCallback(async () => {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) return;
      const snap = await firestore().collection('users').doc(currentUser.uid).get();
      const saved = snap.data()?.valuesPlanner;
      if (!saved) return;
      if (saved.done) {
        setPlannerResumeNote('Last time you chose "' + (saved.chosen || '') + '". Walk it again anytime.');
      } else if (saved.stage !== 'values' || (saved.selected || []).length > 0) {
        setPlannerResumeNote('You have one in progress. "Not sure yet" picks up where you left off.');
      }
    } catch (e) {
      console.warn('planner resume note load failed:', e);
    }
  }, []);

  useEffect(() => {
    loadResumeNote();
  }, [loadResumeNote]);

  const openPlanner = () => {
    setPlannerOpen(true);
    scrollToTop();
  };

  const handlePlannerClose = () => {
    setPlannerOpen(false);
    // Debounced planner save may still be in flight; give it a beat, then refresh
    setTimeout(loadResumeNote, 900);
  };

  const setWishText = (key: WishSection, value: string) =>
    setWishTexts(prev => ({...prev, [key]: value}));

  // Step 6 handoff: the chosen goal becomes the Want (confirm before replacing).
  // With a WISH on file, the builder opens so the new Want can be saved.
  const handlePlannerHandoff = (chosen: string) => {
    setPlannerResumeNote('Last time you chose "' + chosen + '". Walk it again anytime.');
    const takeIt = () => {
      setWishText('want', chosen);
      if (hasWish) setEditing(true);
      else setStartPath('know');
    };
    if (wishTexts.want.trim()) {
      Alert.alert('Replace your Want?', 'Your goal already has a Want. Replace it with "' + chosen + '"?', [
        {text: 'Keep current', style: 'cancel'},
        {text: 'Replace', onPress: takeIt},
      ]);
    } else {
      takeIt();
    }
  };

  // Progress tracking
  const [wishStartDate, setWishStartDate] = useState<string | null>(null);
  const [dayNumber, setDayNumber] = useState(1);

  // Load WISH data from AsyncStorage and Firestore on mount
  useEffect(() => {
    loadWishData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While the builder is open, a late sync updates the saved copy only, so it
  // never overwrites words being typed
  const applyLoadedWish = (w: WishTexts) => {
    setSavedWish(w);
    if (!editingRef.current) setWishTexts(w);
  };

  const loadWishData = async () => {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) return;

      const userId = currentUser.uid;

      // AsyncStorage first (faster)
      const localData = await AsyncStorage.getItem(`manifest_${userId}`);
      const localStartDate = await AsyncStorage.getItem(`wishStart_${userId}`);
      const localTimeline = await AsyncStorage.getItem(`wishTimeline_${userId}`);

      if (localData) {
        const manifest = JSON.parse(localData);
        applyLoadedWish({
          want: manifest.want || '',
          imagine: manifest.imagine || '',
          snags: manifest.snags || '',
          how: manifest.how || '',
        });
      }
      if (localStartDate) {
        setWishStartDate(localStartDate);
      }
      if (localTimeline) {
        setWishTimeline(parseInt(localTimeline, 10));
      }
      if (localData) setWishLoaded(true);

      // Sync from Firestore in the background
      const manifestDoc = await firestore().collection('manifests').doc(userId).get();

      if (manifestDoc.exists()) {
        const data = manifestDoc.data();
        if (data) {
          applyLoadedWish({
            want: data.want || '',
            imagine: data.imagine || '',
            snags: data.snags || '',
            how: data.how || '',
          });

          if (data.startDate) {
            setWishStartDate(data.startDate);
            await AsyncStorage.setItem(`wishStart_${userId}`, data.startDate);
          }
          if (data.timelineDays) {
            setWishTimeline(data.timelineDays);
            await AsyncStorage.setItem(`wishTimeline_${userId}`, data.timelineDays.toString());
          }

          const manifestData = {
            want: data.want || '',
            imagine: data.imagine || '',
            snags: data.snags || '',
            how: data.how || '',
          };
          await AsyncStorage.setItem(`manifest_${userId}`, JSON.stringify(manifestData));
        }
      }
    } catch (error) {
      console.error('Error loading WISH data:', error);
    } finally {
      setWishLoaded(true);
    }
  };

  // Day count on the runway: day 1 is the day the WISH was first saved
  useEffect(() => {
    if (!wishStartDate) {
      setDayNumber(1);
      return;
    }

    const updateDay = () => {
      const start = new Date(wishStartDate);
      const daysElapsed = Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));
      setDayNumber(Math.max(daysElapsed + 1, 1));
    };

    updateDay();
    const interval = setInterval(updateDay, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [wishStartDate]);

  const runwayDone = dayNumber > wishTimeline;
  const shownDay = Math.min(dayNumber, wishTimeline);
  // Small minimum fill so day 1 never reads as an empty bar
  const fillPercent = Math.max((shownDay / wishTimeline) * 100, 4);

  // One Sophy check on the whole plan. Free, like the rest of Goals (never a paywall gate).
  const handleCheckPlan = async () => {
    if (!hasAnyText(wishTexts)) {
      Alert.alert('Nothing to check yet', 'Write at least your Want first.');
      return;
    }
    setCheckingPlan(true);
    setPlanCheck('');
    try {
      setPlanCheck(await checkGoalPlan(wishTexts));
    } catch (error) {
      console.error('Error checking the plan:', error);
      setPlanCheck('Sophy could not check it right now. Please try again.');
    } finally {
      setCheckingPlan(false);
    }
  };

  const startEditing = () => {
    setWishTexts(savedWish ?? EMPTY_WISH);
    setPlanCheck('');
    setSaveStatus('');
    setEditing(true);
    scrollToTop();
  };

  const cancelEditing = () => {
    const base = savedWish ?? EMPTY_WISH;
    const close = () => {
      setWishTexts(base);
      setPlanCheck('');
      setEditing(false);
      if (!hasWish) setStartPath(null);
      scrollToTop();
    };
    const dirty = WISH_KEYS.some(k => wishTexts[k] !== base[k]);
    if (!dirty) {
      close();
      return;
    }
    Alert.alert('Discard your changes?', 'Your edits to this goal will not be saved.', [
      {text: 'Keep editing', style: 'cancel'},
      {text: 'Discard', style: 'destructive', onPress: close},
    ]);
  };

  const handleSave = async () => {
    const {want, imagine, snags, how} = wishTexts;
    if (!want.trim() && !imagine.trim() && !snags.trim() && !how.trim()) {
      Alert.alert('Your goal is empty', 'Fill in at least one part first.');
      return;
    }

    setSaving(true);
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) {
        Alert.alert('Not signed in', 'Sign in to save your goal.');
        return;
      }

      const userId = currentUser.uid;
      const now = new Date().toISOString();

      // Set start date for progress tracking (only on first save)
      const isNewWish = !wishStartDate;
      const startDate = wishStartDate || now;
      if (isNewWish) {
        setWishStartDate(startDate);
        await AsyncStorage.setItem(`wishStart_${userId}`, startDate);
      }

      const manifestData: Record<string, any> = {
        want,
        imagine,
        snags,
        how,
        timelineDays: wishTimeline,
        startDate: startDate,
        updatedAt: now,
      };

      // New WISH resets milestone tracking
      if (isNewWish) {
        manifestData.milestonesSent = [];
        manifestData.lastMilestoneSentAt = null;
      }

      // Local first (instant), then cloud (cross-device sync)
      await AsyncStorage.setItem(`manifest_${userId}`, JSON.stringify(manifestData));
      await AsyncStorage.setItem(`wishTimeline_${userId}`, wishTimeline.toString());
      await firestore().collection('manifests').doc(userId).set(manifestData, {merge: true});

      // Back to the calm summary
      setSavedWish({want, imagine, snags, how});
      setPlanCheck('');
      setEditing(false);
      setStartPath(null);
      scrollToTop();

      setSaveStatus("Saved. You're building something meaningful.");
      setTimeout(() => setSaveStatus(''), 4000);
      FirstStepsService.complete('wish');
    } catch (error) {
      Alert.alert('Not saved', 'Your goal did not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleClearWish = () => {
    Alert.alert(
      'Start a new goal?',
      "This clears your current goal and resets its day count. It can't be undone.",
      [
        {text: 'Keep it', style: 'cancel'},
        {
          text: 'Clear it',
          style: 'destructive',
          onPress: async () => {
            try {
              const currentUser = auth().currentUser;
              if (currentUser) {
                const userId = currentUser.uid;
                await AsyncStorage.removeItem(`manifest_${userId}`);
                await AsyncStorage.removeItem(`wishStart_${userId}`);
                // Web parity: clear the timeline too, or the old choice re-hydrates
                await AsyncStorage.removeItem(`wishTimeline_${userId}`);
                await firestore().collection('manifests').doc(userId).delete();
              }

              setWishTexts(EMPTY_WISH);
              setSavedWish(null);
              setPlanCheck('');
              setEditing(false);
              setStartPath(null);
              setSaveStatus('');
              setWishStartDate(null);
              setWishTimeline(60);
              setDayNumber(1);
              scrollToTop();
            } catch (error) {
              console.error('Error clearing WISH:', error);
              Alert.alert('Not cleared', 'Your goal could not be cleared. Please try again.');
            }
          },
        },
      ],
    );
  };

  // ─── Pieces ───

  const renderSophyOutput = (text: string) => (
    <View style={styles.sophyOutputBox}>
      <Text style={styles.sophyWho}>SOPHY</Text>
      <Text style={styles.sophyOutputText}>{text}</Text>
    </View>
  );

  const renderWishSummary = () => {
    if (!savedWish) return null;
    const want = savedWish.want.trim();
    const how = savedWish.how.trim();
    return (
      <Card style={[styles.sectionCard, styles.wishCard]}>
        <Eyebrow style={styles.eyebrow}>Your goal</Eyebrow>

        {want ? (
          <Text style={styles.want} numberOfLines={4}>
            {want}
          </Text>
        ) : (
          <Text style={styles.helperMuted}>No Want yet. Tap Edit to name it.</Text>
        )}

        {wishStartDate ? (
          <View>
            <View style={styles.runwayRow}>
              <Text style={styles.runwayText}>{`Day ${shownDay} of ${wishTimeline}`}</Text>
              {runwayDone ? <Text style={styles.runwayText}>You made it.</Text> : null}
            </View>
            <View
              style={styles.runwayTrack}
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={`Day ${shownDay} of ${wishTimeline}`}
              accessibilityValue={{min: 0, max: wishTimeline, now: shownDay}}>
              <View style={[styles.runwayFill, {width: `${fillPercent}%`}]} />
            </View>
          </View>
        ) : null}

        {how ? (
          <Text style={styles.howText} numberOfLines={4}>
            <Text style={styles.howLabel}>How: </Text>
            {how}
          </Text>
        ) : (
          <Text style={styles.helperMuted}>No How yet. Tap Edit to add an if-then plan.</Text>
        )}

        <IWButton voice="gray" title="Edit" onPress={startEditing} style={styles.editButton} />
        {saveStatus ? <Text style={styles.saveStatus}>{saveStatus}</Text> : null}
      </Card>
    );
  };

  // LAW: FREE-tier flows only on this tab, never a paywall gate.
  const renderStartCard = () => (
    <Card style={styles.sectionCard}>
      <Eyebrow style={styles.eyebrow}>Start a goal</Eyebrow>
      <Text style={styles.startQuestion} accessibilityRole="header">
        Do you know what you want?
      </Text>
      <View style={styles.startButtons}>
        <IWButton title="Yes, I know" onPress={() => setStartPath('know')} style={styles.startButton} />
        <IWButton voice="gray" title="Not sure yet" onPress={openPlanner} style={styles.startButton} />
      </View>
      <Text style={styles.findLine}>
        Not sure? Start from what matters to you. You'll finish with one goal to try.
      </Text>
      {plannerResumeNote ? <Text style={styles.resumeNote}>{plannerResumeNote}</Text> : null}
    </Card>
  );

  const renderPlannerCard = () => (
    <>
      <CoachHint markId="planner" text="Take your time. It saves as you go." />
      <Card style={styles.sectionCard}>
        <ValuesPlanner onClose={handlePlannerClose} onHandoff={handlePlannerHandoff} />
      </Card>
    </>
  );

  const renderBuilder = () => (
    <Card style={styles.sectionCard}>
      <Eyebrow style={styles.eyebrow}>{hasWish ? 'Edit your goal' : 'Your goal'}</Eyebrow>
      <Text style={styles.builderIntro}>Four steps. Write them in your own words.</Text>

      {WISH_SECTIONS.map((section, index) => (
        <View key={section.key}>
          {index > 0 ? <Divider /> : <View style={styles.builderTopGap} />}
          <Text style={styles.sectionHeading}>{section.heading}</Text>
          <TextInput
            style={styles.textArea}
            placeholder={section.placeholder}
            placeholderTextColor={colors.fontMuted}
            value={wishTexts[section.key]}
            onChangeText={text => setWishText(section.key, text)}
            multiline
            textAlignVertical="top"
            accessibilityLabel={section.heading}
          />
          {section.tip ? <Text style={styles.tipText}>{section.tip}</Text> : null}
        </View>
      ))}

      <Divider />
      <IWButton
        voice="sophy"
        title={checkingPlan ? 'Sophy is reading...' : 'Check my plan with Sophy'}
        onPress={handleCheckPlan}
        loading={checkingPlan}
        style={styles.reflectButton}
      />
      {planCheck ? renderSophyOutput(planCheck) : null}

      {/* Timeline is chosen once, before the first save (unchanged behavior) */}
      {!wishStartDate ? (
        <>
          <Divider />
          <Text style={styles.timelineLabel}>How many days do you want to give this?</Text>
          <View style={styles.timelinePills}>
            {[30, 60, 90].map(days => (
              <Pill
                key={days}
                label={`${days} days`}
                active={wishTimeline === days}
                onPress={() => setWishTimeline(days)}
              />
            ))}
          </View>
        </>
      ) : null}

      <Divider />

      <View style={styles.actionRow}>
        <IWButton title="Save my goal" onPress={handleSave} loading={saving} style={styles.actionButton} />
        <IWButton voice="gray" title="Cancel" onPress={cancelEditing} style={styles.actionButton} />
      </View>
      <Pressable onPress={() => setShowWhy(true)} style={styles.whyLink} accessibilityRole="button">
        <Text style={styles.whyText}>Why this works</Text>
      </Pressable>
    </Card>
  );

  const renderNewGoalRow = () => (
    <Pressable
      onPress={handleClearWish}
      accessibilityRole="button"
      accessibilityLabel="Done with this one? Start a new goal. This clears your goal and its day count."
      style={({pressed}) => [styles.quietRow, pressed && styles.pressed]}>
      <Text style={styles.quietRowTitle}>Done with this one? Start a new goal.</Text>
      <Text style={styles.quietRowLine}>This clears your goal and its day count.</Text>
    </Pressable>
  );

  const renderBody = () => {
    if (!wishLoaded) return null;
    // The goal waits while the planner runs; quitting should be a choice, not a drift
    if (plannerOpen) return renderPlannerCard();
    if (!hasWish) return startPath === 'know' || hasAnyText(wishTexts) ? renderBuilder() : renderStartCard();
    if (editing) return renderBuilder();
    return (
      <>
        {renderWishSummary()}
        {renderNewGoalRow()}
      </>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoid}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={getKeyboardVerticalOffset(true)}>
      <IdentityBar refreshTrigger={dotsRefresh} />

      <ScrollView
        ref={scrollRef}
        style={styles.container}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}>
        <View style={[styles.content, iPadContentStyle(screenWidth)]}>
          <ScreenTitle>Goals</ScreenTitle>
          {renderBody()}
        </View>
      </ScrollView>
      <InfoModal
        visible={showWhy}
        onClose={() => setShowWhy(false)}
        title="Why four steps work"
        subtitle="Want, Imagine, Snags, How. Some people call it WISH."
        footerText="Name it. See it. Plan for the snag.">
        <InfoSection title="What the research shows">
          <InfoParagraph>
            Picturing the result alone can feel good and change little. Pairing it with an honest look at what gets in the
            way, then a plan for that moment, is what moves people. (Oettingen, 2014)
          </InfoParagraph>
          <InfoHighlightBox title="If-then plans">
            Deciding ahead of time what you will do when the snag shows up makes follow-through much more likely.
            (Gollwitzer and Sheeran, 2006)
          </InfoHighlightBox>
        </InfoSection>
      </InfoModal>
    </KeyboardAvoidingView>
  );
};

// Dynamic styles based on theme colors
const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    keyboardAvoid: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    scrollContent: {
      flexGrow: 1,
      paddingBottom: spacing.xxl,
    },
    content: {
      padding: spacing.lg,
    },

    sectionCard: {
      marginBottom: spacing.xl,
    },
    eyebrow: {
      fontSize: 13,
    },
    pressed: {
      opacity: 0.7,
    },
    helperMuted: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.base,
      lineHeight: 22,
      color: colors.fontMuted,
    },

    // ── Your WISH summary ──
    wishCard: {
      gap: 14,
    },
    want: {
      fontFamily: fontFamily.serif,
      fontSize: 23,
      lineHeight: 29,
      color: colors.fontMain,
    },
    runwayRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    runwayText: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.base,
      color: colors.fontMuted,
      fontVariant: ['tabular-nums'],
    },
    runwayTrack: {
      height: 8,
      borderRadius: 99,
      backgroundColor: colors.borderMedium,
      overflow: 'hidden',
    },
    runwayFill: {
      height: '100%',
      borderRadius: 99,
      backgroundColor: colors.brandPrimary,
    },
    howText: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.base,
      lineHeight: 22,
      color: colors.fontMain,
    },
    howLabel: {
      fontFamily: fontFamily.bodyBold,
    },
    editButton: {
      marginTop: spacing.xs,
    },
    saveStatus: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.base,
      color: colors.brandPrimary,
      textAlign: 'center',
    },

    // ── Start a goal ──
    findLine: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.base,
      lineHeight: 22,
      color: colors.fontMuted,
    },
    resumeNote: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.base,
      lineHeight: 22,
      color: colors.fontMuted,
      marginTop: spacing.md,
    },
    startQuestion: {
      fontFamily: fontFamily.header,
      fontSize: 24,
      lineHeight: 30,
      color: colors.fontMain,
      marginTop: spacing.sm,
      marginBottom: spacing.base,
    },
    startButtons: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.base,
    },
    startButton: {
      minWidth: 140,
    },
    whyLink: {
      alignSelf: 'center',
      marginTop: spacing.base,
      paddingVertical: spacing.sm,
      minHeight: 44,
      justifyContent: 'center',
    },
    whyText: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.base,
      color: colors.brandPrimary,
    },

    // ── Sophy output (her words, her surface) ──
    sophyOutputBox: {
      backgroundColor: colors.sophyTint,
      borderWidth: 1,
      borderColor: colors.sophyBorder,
      borderRadius: borderRadius.md,
      padding: spacing.base,
      marginTop: spacing.md,
    },
    sophyWho: {
      fontFamily: fontFamily.bodyBold,
      fontSize: 13,
      letterSpacing: 1.8,
      color: colors.sophyLight,
      marginBottom: spacing.xs,
    },
    sophyOutputText: {
      fontFamily: fontFamily.serifItalic,
      fontStyle: 'italic',
      fontSize: fontSize.base,
      color: colors.fontMain,
      lineHeight: fontSize.base * 1.55,
    },

    // ── WISH builder ──
    builderIntro: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.base,
      lineHeight: 22,
      color: colors.fontSecondary,
      marginTop: spacing.sm,
    },
    builderTopGap: {
      height: spacing.base,
    },
    sectionHeading: {
      fontFamily: fontFamily.header,
      fontSize: 22,
      lineHeight: 28,
      color: colors.fontMain,
      marginBottom: spacing.md,
    },
    textArea: {
      fontFamily: fontFamily.serif,
      backgroundColor: colors.bgCard,
      borderRadius: borderRadius.lg,
      padding: spacing.base,
      fontSize: fontSize.md,
      lineHeight: fontSize.md * 1.5,
      color: colors.fontMain,
      borderWidth: 1,
      borderColor: colors.borderMedium,
      minHeight: 130,
      textAlignVertical: 'top',
      marginBottom: spacing.sm,
    },
    tipText: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.base,
      lineHeight: 22,
      color: colors.fontMuted,
      marginBottom: spacing.sm,
    },
    reflectButton: {
      alignSelf: 'flex-start',
      marginTop: spacing.xs,
    },
    timelineLabel: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.base,
      color: colors.fontSecondary,
      marginBottom: spacing.md,
    },
    timelinePills: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    actionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    actionButton: {
      minWidth: 150,
    },

    // ── Quiet "Start a new goal" row ──
    quietRow: {
      paddingVertical: spacing.md,
      paddingHorizontal: 2,
    },
    quietRowTitle: {
      fontFamily: fontFamily.button,
      fontSize: fontSize.md,
      color: colors.fontSecondary,
    },
    quietRowLine: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.base,
      lineHeight: 22,
      color: colors.fontMuted,
      marginTop: 2,
    },
  });

export default ManifestScreen;
