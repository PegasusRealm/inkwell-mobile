/**
 * Goals tab (route key 'Goals'; file name kept). v2.0 re-skin, 2026-10-01.
 *
 * With a WISH:   Your WISH summary (Want, runway, How, Edit)
 *                -> Find your next goal (ValuesPlanner + Sophy seed)
 *                -> quiet "Time for a new WISH" row (clears it, after a confirm).
 * Without one:   Find your next goal -> the WISH builder.
 * The builder (Want / Imagine / Snags / How, Sophy refine in coral) shows only
 * while editing or when there is no WISH yet. While the planner runs, the WISH
 * waits (web vpSetWishVisible parity).
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
import {refineManifest} from '../services/sophyApi';
import {plannerAssistFetch} from '../services/plannerApi';
import ValuesPlanner from '../components/ValuesPlanner';
import {IdentityBar, ScreenTitle} from '../components/IdentityBar';
import {Card, IWButton, Pill, Eyebrow, Divider} from '../components/kit';
import {ChevronRightIcon} from '../components/kit/icons';
import {CoachHint} from '../components/FirstStepsCard';
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

  const [suggestions, setSuggestions] = useState<WishTexts>(EMPTY_WISH);
  const [loadingSection, setLoadingSection] = useState<WishSection | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  // Planner card state
  const [seedOutput, setSeedOutput] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [plannerResumeNote, setPlannerResumeNote] = useState('');

  const hasWish = hasAnyText(savedWish);
  const showBuilder = !hasWish || editing;

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
        setPlannerResumeNote('You have one in progress. Tap above to pick up where you left off.');
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
    };
    if (wishTexts.want.trim()) {
      Alert.alert('Replace your Want?', 'Your WISH already has a Want. Replace it with "' + chosen + '"?', [
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

  // ── Sophy planner quick-seed (web plannerQuickSeed parity) ──
  const handleQuickSeed = async () => {
    setSeeding(true);
    setSeedOutput('Sophy is reading your journal...');
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) throw new Error('Sign in required');
      // Web sends the values-planner state (vision + top values) when present
      let vision = '';
      let topValues: string[] = [];
      try {
        const userDoc = await firestore().collection('users').doc(currentUser.uid).get();
        const vp = userDoc.data()?.valuesPlanner;
        if (vp) {
          vision = vp.vision || '';
          topValues = Array.isArray(vp.ranked) ? vp.ranked.slice(0, 10) : [];
        }
      } catch (e) {
        console.warn('planner state load failed, seeding without it:', e);
      }
      const text = await plannerAssistFetch('seed', {vision, topValues});
      setSeedOutput(text);
    } catch (e: any) {
      setSeedOutput(e.message || 'Sophy is unavailable right now.');
    } finally {
      setSeeding(false);
    }
  };

  const handleRefine = async (key: WishSection, heading: string) => {
    if (!wishTexts[key].trim()) {
      Alert.alert('Nothing to reflect on yet', `Write your ${heading} first.`);
      return;
    }
    setLoadingSection(key);
    setSuggestions(prev => ({...prev, [key]: ''}));
    try {
      const suggestion = await refineManifest(key, wishTexts[key]);
      setSuggestions(prev => ({...prev, [key]: suggestion}));
    } catch (error) {
      console.error(`Error refining ${heading}:`, error);
      setSuggestions(prev => ({...prev, [key]: 'Something went wrong. Please try again.'}));
    } finally {
      setLoadingSection(null);
    }
  };

  const startEditing = () => {
    setWishTexts(savedWish ?? EMPTY_WISH);
    setSuggestions(EMPTY_WISH);
    setSaveStatus('');
    setEditing(true);
    scrollToTop();
  };

  const cancelEditing = () => {
    const base = savedWish ?? EMPTY_WISH;
    const close = () => {
      setWishTexts(base);
      setSuggestions(EMPTY_WISH);
      setEditing(false);
      scrollToTop();
    };
    const dirty = WISH_KEYS.some(k => wishTexts[k] !== base[k]);
    if (!dirty) {
      close();
      return;
    }
    Alert.alert('Discard your changes?', 'Your edits to this WISH will not be saved.', [
      {text: 'Keep editing', style: 'cancel'},
      {text: 'Discard', style: 'destructive', onPress: close},
    ]);
  };

  const handleSave = async () => {
    const {want, imagine, snags, how} = wishTexts;
    if (!want.trim() && !imagine.trim() && !snags.trim() && !how.trim()) {
      Alert.alert('Your WISH is empty', 'Fill in at least one part first.');
      return;
    }

    setSaving(true);
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) {
        Alert.alert('Not signed in', 'Sign in to save your WISH.');
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
      setSuggestions(EMPTY_WISH);
      setEditing(false);
      scrollToTop();

      setSaveStatus("Saved. You're building something meaningful.");
      setTimeout(() => setSaveStatus(''), 4000);
      FirstStepsService.complete('wish');
    } catch (error) {
      Alert.alert('Not saved', 'Your WISH did not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleClearWish = () => {
    Alert.alert(
      'Start a new WISH?',
      "This clears your current WISH and resets its runway. It can't be undone.",
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
              setSuggestions(EMPTY_WISH);
              setEditing(false);
              setSaveStatus('');
              setWishStartDate(null);
              setWishTimeline(60);
              setDayNumber(1);
              scrollToTop();
            } catch (error) {
              console.error('Error clearing WISH:', error);
              Alert.alert('Not cleared', 'Your WISH could not be cleared. Please try again.');
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
        <Eyebrow style={styles.eyebrow}>Your WISH</Eyebrow>

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
              {runwayDone ? <Text style={styles.runwayText}>Runway complete</Text> : null}
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

  // LAW: FREE-tier flows only in this card, never a paywall gate.
  const renderFindCard = () => (
    <>
      <CoachHint markId="planner" text="Ready for a new goal? Start here." />
      <Card style={styles.sectionCard}>
        {!plannerOpen ? (
          <>
            <Pressable
              onPress={openPlanner}
              accessibilityRole="button"
              accessibilityLabel="Find your next goal"
              style={({pressed}) => [styles.findRow, pressed && styles.pressed]}>
              <View style={styles.findText}>
                <Text style={styles.findTitle}>Find your next goal</Text>
                <Text style={styles.findLine}>
                  Sort your values, picture a day 15 years out, then pick one move.
                </Text>
              </View>
              <ChevronRightIcon color={colors.fontMuted} />
            </Pressable>
            {plannerResumeNote ? <Text style={styles.resumeNote}>{plannerResumeNote}</Text> : null}
            <IWButton
              voice="sophy"
              title="Ask Sophy for ideas"
              onPress={handleQuickSeed}
              loading={seeding}
              style={styles.seedButton}
            />
            {seedOutput ? renderSophyOutput(seedOutput) : null}
          </>
        ) : (
          <ValuesPlanner onClose={handlePlannerClose} onHandoff={handlePlannerHandoff} />
        )}
      </Card>
    </>
  );

  const renderBuilder = () => (
    <Card style={styles.sectionCard}>
      <Eyebrow style={styles.eyebrow}>{hasWish ? 'Edit your WISH' : 'New WISH'}</Eyebrow>
      {!hasWish ? (
        <Text style={styles.builderIntro}>Already know what you want? Build it here.</Text>
      ) : null}

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
          <IWButton
            voice="sophy"
            title="Reflect with Sophy"
            onPress={() => handleRefine(section.key, section.heading)}
            loading={loadingSection === section.key}
            disabled={loadingSection !== null && loadingSection !== section.key}
            style={styles.reflectButton}
          />
          {suggestions[section.key] ? renderSophyOutput(suggestions[section.key]) : null}
        </View>
      ))}

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
        <IWButton title="Save my WISH" onPress={handleSave} loading={saving} style={styles.actionButton} />
        {hasWish ? (
          <IWButton voice="gray" title="Cancel" onPress={cancelEditing} style={styles.actionButton} />
        ) : null}
      </View>
    </Card>
  );

  const renderNewWishRow = () => (
    <Pressable
      onPress={handleClearWish}
      accessibilityRole="button"
      accessibilityLabel="Time for a new WISH. Clears this one so you can start fresh."
      style={({pressed}) => [styles.quietRow, pressed && styles.pressed]}>
      <Text style={styles.quietRowTitle}>Time for a new WISH</Text>
      <Text style={styles.quietRowLine}>Clears this one so you can start fresh.</Text>
    </Pressable>
  );

  const renderBody = () => {
    if (!wishLoaded) return null;
    // The WISH waits while the planner runs; quitting should be a choice, not a drift
    if (plannerOpen) return renderFindCard();
    if (!hasWish) {
      return (
        <>
          {renderFindCard()}
          {renderBuilder()}
        </>
      );
    }
    if (editing) return renderBuilder();
    return (
      <>
        {renderWishSummary()}
        {renderFindCard()}
        {renderNewWishRow()}
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

    // ── Find your next goal ──
    findRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    findText: {
      flex: 1,
    },
    findTitle: {
      fontFamily: fontFamily.bodyBold,
      fontSize: fontSize.md,
      color: colors.fontMain,
      marginBottom: spacing.xs,
    },
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
    seedButton: {
      alignSelf: 'flex-start',
      marginTop: spacing.base,
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

    // ── Quiet "Time for a new WISH" row ──
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
