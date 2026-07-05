/**
 * Goals screen (route key: Manifest) — v2 rebuild (M2, 2026-07-04)
 * Web parity: "Your Goals" using the WISH method (app.html manifest tab).
 * Order: planner slot-card → WISH builder → runway (timeline + progress).
 * Values Planner: FULL 6-step walk live (components/ValuesPlanner.tsx,
 * 2026-07-04) + Sophy quick-seed. Design law: FREE-tier flows only in this
 * space, never a paywall gate.
 * Growth stages: teal discs (web's SVG leaf has no dep-free RN equivalent;
 * emojis are barred from chrome).
 * Connect is dead — coach-guidance block removed (2026-07-04). The manifest
 * auto-include into journal entries lives in JournalScreen and is untouched.
 */
import React, {useState, useEffect, useMemo, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {spacing, borderRadius, fontFamily, fontSize} from '../theme';
import {useTheme, ThemeColors} from '../theme/ThemeContext';
import {refineManifest} from '../services/sophyApi';
import {plannerAssistFetch} from '../services/plannerApi';
import ValuesPlanner from '../components/ValuesPlanner';
import WeeklyActivityDots from '../components/WeeklyActivityDots';
import {Card, IWButton, Pill, Eyebrow, Divider} from '../components/kit';
import {LeafIcon} from '../components/kit/icons';
import {CoachHint} from '../components/FirstStepsCard';
import {FirstStepsService} from '../services/firstStepsService';
import type {TabScreenProps} from '../navigation/types';
import {iPadContentStyle, getKeyboardVerticalOffset} from '../utils/iPad';

type WishSection = 'want' | 'imagine' | 'snags' | 'how';

// Web builder copy, verbatim (app.html manifest tab)
const WISH_SECTIONS: Array<{
  key: WishSection;
  heading: string;
  placeholder: string;
  reflectLabel: string;
  tip?: string;
}> = [
  {
    key: 'want',
    heading: 'Want',
    placeholder:
      'Name the goal you want most right now. Keep it specific, meaningful, and within reach.\n\nExample: Walk 30 minutes every weekday.',
    reflectLabel: 'Reflect on your Want with Sophy',
  },
  {
    key: 'imagine',
    heading: 'Imagine',
    placeholder:
      'Describe the best thing about reaching this goal. How will it feel? What gets better? Write it like it already happened, with real detail.',
    reflectLabel: 'Reflect on your Imagine with Sophy',
  },
  {
    key: 'snags',
    heading: 'Snags',
    placeholder:
      'List what could get in your way. Look inside first: habits, moods, and excuses count as much as outside problems.\n\nExample: I stay up too late, so I skip my morning walk.',
    reflectLabel: 'Reflect on your Snags with Sophy',
  },
  {
    key: 'how',
    heading: 'How',
    placeholder:
      'Write an if-then plan for each snag, and tie it to something you already do daily.\n\nExample: If it hits 9 pm, then I plug my phone in across the room.',
    reflectLabel: 'Reflect on your How with Sophy',
    tip: 'Tip: anchor new habits to ones you already have. "After I [pour my coffee], I will [write one line]."',
  },
];

// Sophy planner assists live in the shared service (also used by ValuesPlanner)

const ManifestScreen: React.FC<TabScreenProps<'Manifest'>> = ({navigation}) => {
  const {colors} = useTheme();
  const {width: screenWidth} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Event-driven onboarding: FirstSteps hint fires on the planner card below
  // (web onTabVisit parity); the old timer-fired modal is gone.

  // The identity bar replaces the navigation header (matches the other tabs)
  useEffect(() => {
    navigation.setOptions({headerShown: false});
  }, [navigation]);

  // Timeline state
  const [wishTimeline, setWishTimeline] = useState<number>(60);

  // WISH section state
  const [wishTexts, setWishTexts] = useState<Record<WishSection, string>>({
    want: '',
    imagine: '',
    snags: '',
    how: '',
  });
  const [suggestions, setSuggestions] = useState<Record<WishSection, string>>({
    want: '',
    imagine: '',
    snags: '',
    how: '',
  });
  const [loadingSection, setLoadingSection] = useState<WishSection | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  // Planner slot-card state
  const [seedOutput, setSeedOutput] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [plannerResumeNote, setPlannerResumeNote] = useState('');

  // Resume note (web vpResumeNote parity) — refreshed on mount AND on planner close
  const loadResumeNote = useCallback(async () => {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) return;
      const snap = await firestore().collection('users').doc(currentUser.uid).get();
      const saved = snap.data()?.valuesPlanner;
      if (!saved) return;
      if (saved.done) {
        setPlannerResumeNote('Planner complete. Your goal: "' + (saved.chosen || '') + '". Start again anytime.');
      } else if (saved.stage !== 'values' || (saved.selected || []).length > 0) {
        setPlannerResumeNote(
          'You have a planner in progress. "Find a goal worth wanting" picks up where you left off.',
        );
      }
    } catch (e) {
      console.warn('planner resume note load failed:', e);
    }
  }, []);

  useEffect(() => {
    loadResumeNote();
  }, [loadResumeNote]);

  const handlePlannerClose = () => {
    setPlannerOpen(false);
    // Debounced planner save may still be in flight — give it a beat, then refresh
    setTimeout(loadResumeNote, 900);
  };

  // Step 6 handoff: the chosen goal becomes the Want (confirm before replacing)
  const handlePlannerHandoff = (chosen: string) => {
    setPlannerResumeNote('Planner complete. Your goal: "' + chosen + '". Start again anytime.');
    if (wishTexts.want.trim()) {
      Alert.alert(
        'Replace your Want?',
        'Your Want field already has a goal. Replace it with "' + chosen + '"?',
        [
          {text: 'Keep current', style: 'cancel'},
          {text: 'Replace', onPress: () => setWishText('want', chosen)},
        ],
      );
    } else {
      setWishText('want', chosen);
    }
  };

  // Progress tracking
  const [wishStartDate, setWishStartDate] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState(0);

  const setWishText = (key: WishSection, value: string) =>
    setWishTexts(prev => ({...prev, [key]: value}));

  // Load WISH data from AsyncStorage and Firestore on mount
  useEffect(() => {
    loadWishData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        setWishTexts({
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

      // Sync from Firestore in the background
      const manifestDoc = await firestore().collection('manifests').doc(userId).get();

      if (manifestDoc.exists()) {
        const data = manifestDoc.data();
        if (data) {
          setWishTexts({
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
    }
  };

  // Calculate progress when start date or timeline changes
  useEffect(() => {
    if (!wishStartDate) {
      setProgressPercent(0);
      return;
    }

    const updateProgress = () => {
      const start = new Date(wishStartDate);
      const now = new Date();
      const daysElapsed = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      const actualPercent = Math.min((daysElapsed / wishTimeline) * 100, 100);
      // Minimum 5% visual fill so the bar never looks empty
      setProgressPercent(Math.max(actualPercent, 5));
    };

    updateProgress();
    const interval = setInterval(updateProgress, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [wishStartDate, wishTimeline]);

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
      Alert.alert('Empty Field', `Please write your ${heading} first.`);
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

  const handleSave = async () => {
    const {want, imagine, snags, how} = wishTexts;
    if (!want.trim() && !imagine.trim() && !snags.trim() && !how.trim()) {
      Alert.alert('Empty WISH', 'Please fill in at least one section.');
      return;
    }

    setSaving(true);
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) {
        Alert.alert('Error', 'You must be logged in to save your WISH.');
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

      // Clear Sophy suggestions after save
      setSuggestions({want: '', imagine: '', snags: '', how: ''});

      setSaveStatus("✓ Vision saved. You're building something meaningful.");
      setTimeout(() => setSaveStatus(''), 4000);
      FirstStepsService.complete('wish');
    } catch (error) {
      Alert.alert('Error', 'Failed to save WISH.');
    } finally {
      setSaving(false);
    }
  };

  const handleClearWish = () => {
    Alert.alert(
      'Time for a New WISH?',
      'This will clear your current WISH and reset your runway. Are you sure?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Clear',
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

              setWishTexts({want: '', imagine: '', snags: '', how: ''});
              setSuggestions({want: '', imagine: '', snags: '', how: ''});
              setWishStartDate(null);
              setWishTimeline(60);
              setProgressPercent(0);
            } catch (error) {
              console.error('Error clearing WISH:', error);
              Alert.alert('Error', 'Failed to clear WISH.');
            }
          },
        },
      ],
    );
  };

  const progressMessage =
    progressPercent <= 25
      ? "Taking your first steps - you've begun something meaningful"
      : progressPercent <= 50
      ? 'Building momentum - your consistency is creating change'
      : progressPercent <= 75
      ? "Making solid progress - you're developing new patterns"
      : progressPercent < 100
      ? "Approaching your timeline - notice how far you've come"
      : 'Timeline reached - Time for New WISH!';

  // Growth stages: four teal discs, growing (no emojis in chrome; no SVG dep)
  const GROWTH_SIZES = [10, 16, 22, 28];

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoid}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={getKeyboardVerticalOffset(true)}>
      {/* ─── Identity bar: wordmark + week dots (matches the other tabs) ─── */}
      <View style={[styles.identityBar, {paddingTop: insets.top + spacing.sm}]}>
        <Text style={styles.wordmark}>
          Ink<Text style={styles.wordmarkAccent}>Well</Text>
        </Text>
        <View style={styles.identityRight}>
          <WeeklyActivityDots />
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Text style={styles.settingsLink}>Settings</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}>
        <View style={[styles.content, iPadContentStyle(screenWidth)]}>
          <Text style={styles.screenTitle}>Your Goals</Text>
          <Text style={styles.screenSubtitle}>using the WISH method</Text>

          {/* ─── Planner card: values planner + Sophy quick seed ───
              LAW: FREE-tier flows only in this space — never a paywall gate. */}
          <CoachHint markId="planner" text="No goal yet? This is where you find one." />
          <Card style={styles.sectionCard}>
            <Eyebrow style={styles.plannerEyebrow}>Finding your goal</Eyebrow>
            {!plannerOpen ? (
              <>
                <Text style={styles.plannerIntro}>
                  Already know what you want? Build it below. Not sure yet? Walk the Values Planner, or let Sophy
                  read your journal and suggest a place to start.
                </Text>
                <View style={styles.plannerButtonRow}>
                  <IWButton small title="Find a goal worth wanting" onPress={() => setPlannerOpen(true)} />
                  <IWButton
                    voice="sophy"
                    small
                    title="Ask Sophy for ideas"
                    onPress={handleQuickSeed}
                    loading={seeding}
                  />
                </View>
                {plannerResumeNote ? <Text style={styles.plannerResumeNote}>{plannerResumeNote}</Text> : null}
                {seedOutput ? (
                  <View style={styles.sophyOutputBox}>
                    <Text style={styles.sophyWho}>SOPHY</Text>
                    <Text style={styles.sophyOutputText}>{seedOutput}</Text>
                  </View>
                ) : null}
              </>
            ) : (
              <ValuesPlanner onClose={handlePlannerClose} onHandoff={handlePlannerHandoff} />
            )}
          </Card>

          {/* The WISH waits while the planner runs; quitting should be a choice,
              not a drift (web vpSetWishVisible parity) */}
          {!plannerOpen && (
          <>
          {/* ─── WISH builder: one method, one card ─── */}
          <Card style={styles.sectionCard}>
            {WISH_SECTIONS.map((section, index) => (
              <View key={section.key}>
                {index > 0 && <Divider />}
                <Text style={styles.sectionHeading}>{section.heading}</Text>
                <TextInput
                  style={styles.textArea}
                  placeholder={section.placeholder}
                  placeholderTextColor={colors.fontMuted}
                  value={wishTexts[section.key]}
                  onChangeText={text => setWishText(section.key, text)}
                  multiline
                  textAlignVertical="top"
                />
                {section.tip ? <Text style={styles.tipText}>{section.tip}</Text> : null}
                <IWButton
                  voice="sophy"
                  small
                  title={section.reflectLabel}
                  onPress={() => handleRefine(section.key, section.heading)}
                  loading={loadingSection === section.key}
                  disabled={loadingSection !== null && loadingSection !== section.key}
                  style={styles.reflectButton}
                />
                {suggestions[section.key] ? (
                  <View style={styles.sophyOutputBox}>
                    <Text style={styles.sophyWho}>SOPHY</Text>
                    <Text style={styles.sophyOutputText}>{suggestions[section.key]}</Text>
                  </View>
                ) : null}
              </View>
            ))}

            <Divider />

            {/* WISH actions */}
            <View style={styles.actionRow}>
              <IWButton title="Save My WISH" onPress={handleSave} loading={saving} style={styles.actionButton} />
              <IWButton voice="gray" title="Time for New WISH" onPress={handleClearWish} style={styles.actionButton} />
            </View>
            {saveStatus ? <Text style={styles.saveStatus}>{saveStatus}</Text> : null}
          </Card>

          {/* ─── WISH runway: the timeline + progress, tracking the WISH above ─── */}
          <Card style={styles.sectionCard}>
            {!wishStartDate && (
              <>
                <Text style={styles.runwayLabel}>How many days to build this?</Text>
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
            )}

            <Eyebrow style={styles.runwayEyebrow}>Your WISH Runway</Eyebrow>

            {!wishStartDate ? (
              <>
                {/* Growth stages: discs growing left to right */}
                <View style={styles.growthStages}>
                  {GROWTH_SIZES.map((size, index) => (
                    <React.Fragment key={index}>
                      {index > 0 && <View style={styles.growthConnector} />}
                      <View
                        style={[
                          styles.growthDisc,
                          {width: size, height: size, borderRadius: size / 2},
                        ]}
                      />
                    </React.Fragment>
                  ))}
                </View>
                <View style={styles.timelineLabels}>
                  {[
                    'Start',
                    `${wishTimeline / 4} days`,
                    `${wishTimeline / 2} days`,
                    `${(wishTimeline * 3) / 4} days`,
                    `${wishTimeline} days`,
                  ].map((label, index) => (
                    <Text key={index} style={styles.timelineLabelText}>
                      {label}
                    </Text>
                  ))}
                </View>
              </>
            ) : (
              <>
                <View style={styles.progressBarContainer}>
                  <View style={[styles.progressBarFill, {width: `${progressPercent}%`}]}>
                    {/* The leaf rides the fill edge (web runway parity) */}
                    <LeafIcon color="#ffffff" />
                  </View>
                </View>
                <Text style={styles.progressMessage}>{progressMessage}</Text>
              </>
            )}
          </Card>

          <Text style={styles.helpText}>
            Your WISH is saved privately and helps guide your personal growth journey.
          </Text>
          </>
          )}
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

    // ── Identity bar (matches the other tabs) ──
    identityBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
      backgroundColor: colors.bgPrimary,
    },
    wordmark: {
      fontFamily: fontFamily.header,
      fontSize: fontSize.xl,
      color: colors.fontMain,
      letterSpacing: 0.3,
    },
    wordmarkAccent: {
      color: colors.brandPrimary,
    },
    identityRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    settingsLink: {
      fontFamily: fontFamily.button,
      fontSize: fontSize.sm,
      color: colors.fontSecondary,
    },

    screenTitle: {
      fontFamily: fontFamily.header,
      fontSize: fontSize.display,
      color: colors.fontMain,
      textAlign: 'center',
    },
    screenSubtitle: {
      fontFamily: fontFamily.serifItalic,
      fontStyle: 'italic',
      fontSize: fontSize.sm,
      color: colors.fontMuted,
      textAlign: 'center',
      marginTop: spacing.xs,
      marginBottom: spacing.lg,
    },

    sectionCard: {
      marginBottom: spacing.lg,
    },

    // ── Planner slot-card ──
    plannerEyebrow: {
      marginBottom: spacing.sm,
    },
    plannerIntro: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.sm,
      color: colors.fontSecondary,
      lineHeight: 21,
      marginBottom: spacing.md,
    },
    plannerAction: {
      alignSelf: 'flex-start',
    },
    plannerButtonRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    plannerResumeNote: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.sm,
      fontStyle: 'italic',
      color: colors.fontMuted,
      marginTop: spacing.md,
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
      fontSize: 10,
      letterSpacing: 2,
      color: colors.sophyLight,
      marginBottom: 2,
    },
    sophyOutputText: {
      fontFamily: fontFamily.serifItalic,
      fontStyle: 'italic',
      fontSize: fontSize.base,
      color: colors.fontMain,
      lineHeight: fontSize.base * 1.55,
    },

    // ── WISH builder ──
    sectionHeading: {
      fontFamily: fontFamily.header,
      fontSize: fontSize.xxl,
      color: colors.fontMain,
      textAlign: 'center',
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
      fontSize: fontSize.xs,
      color: colors.fontMuted,
      marginBottom: spacing.sm,
    },
    reflectButton: {
      alignSelf: 'flex-start',
      marginTop: spacing.xs,
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
    saveStatus: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.sm,
      fontStyle: 'italic',
      color: colors.accentGrowth,
      textAlign: 'center',
      marginTop: spacing.sm,
    },

    // ── Runway ──
    runwayLabel: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.base,
      color: colors.fontSecondary,
      textAlign: 'center',
      marginBottom: spacing.md,
    },
    timelinePills: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    runwayEyebrow: {
      textAlign: 'center',
      marginBottom: spacing.md,
    },
    growthStages: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      maxWidth: 360,
      alignSelf: 'center',
      width: '100%',
      marginBottom: spacing.md,
      paddingHorizontal: spacing.sm,
    },
    growthDisc: {
      backgroundColor: colors.brandPrimary,
    },
    growthConnector: {
      flex: 1,
      height: 2,
      backgroundColor: colors.brandLight,
      marginHorizontal: spacing.xs,
    },
    timelineLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      maxWidth: 360,
      alignSelf: 'center',
      width: '100%',
    },
    timelineLabelText: {
      fontFamily: fontFamily.button,
      fontSize: fontSize.xs,
      color: colors.fontMuted,
      flex: 1,
      textAlign: 'center',
    },
    progressBarContainer: {
      height: 22,
      backgroundColor: colors.bgMuted,
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: spacing.sm,
      maxWidth: 400,
      alignSelf: 'center',
      width: '100%',
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: colors.brandPrimary,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingRight: 6,
    },
    progressMessage: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.sm,
      color: colors.fontMuted,
      textAlign: 'center',
      fontStyle: 'italic',
      paddingHorizontal: spacing.base,
    },

    helpText: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.sm,
      color: colors.fontMuted,
      lineHeight: 22,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
  });

export default ManifestScreen;
