import React, {useState, useEffect, useMemo} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import {spacing, borderRadius, fontFamily, fontSize} from '../theme';
import {useTheme, ThemeColors} from '../theme/ThemeContext';
import {refineManifest} from '../services/sophyApi';
import type {TabScreenProps} from '../navigation/types';

const ManifestScreen: React.FC<TabScreenProps<'Manifest'>> = ({navigation}) => {
  // Theme hook for dynamic theming
  const {colors, isDark} = useTheme();
  
  // Create styles with current theme colors
  const styles = useMemo(() => createStyles(colors), [colors]);
  // Add Settings button to header
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('Settings')}
          style={{marginRight: 16}}>
          <Text style={{fontSize: 24}}>⚙️</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  // Timeline state
  const [wishTimeline, setWishTimeline] = useState<number>(60);

  // WISH section states
  const [wantText, setWantText] = useState('');
  const [imagineText, setImagineText] = useState('');
  const [snagsText, setSnagsText] = useState('');
  const [howText, setHowText] = useState('');

  // Sophy suggestion states
  const [wantSuggestion, setWantSuggestion] = useState('');
  const [imagineSuggestion, setImagineSuggestion] = useState('');
  const [snagsSuggestion, setSnagsSuggestion] = useState('');
  const [howSuggestion, setHowSuggestion] = useState('');

  // Loading states
  const [loadingWant, setLoadingWant] = useState(false);
  const [loadingImagine, setLoadingImagine] = useState(false);
  const [loadingSnags, setLoadingSnags] = useState(false);
  const [loadingHow, setLoadingHow] = useState(false);
  const [saving, setSaving] = useState(false);

  // Progress tracking
  const [wishStartDate, setWishStartDate] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState(0);

  // Load WISH data from AsyncStorage and Firestore on mount
  useEffect(() => {
    loadWishData();
  }, []);

  const loadWishData = async () => {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) return;

      const userId = currentUser.uid;

      // Try loading from AsyncStorage first (faster)
      const localData = await AsyncStorage.getItem(`manifest_${userId}`);
      const localStartDate = await AsyncStorage.getItem(`wishStart_${userId}`);
      const localTimeline = await AsyncStorage.getItem(`wishTimeline_${userId}`);

      if (localData) {
        const manifest = JSON.parse(localData);
        setWantText(manifest.want || '');
        setImagineText(manifest.imagine || '');
        setSnagsText(manifest.snags || '');
        setHowText(manifest.how || '');
      }

      if (localStartDate) {
        setWishStartDate(localStartDate);
      }

      if (localTimeline) {
        setWishTimeline(parseInt(localTimeline));
      }

      // Also sync from Firestore in the background
      const manifestDoc = await firestore()
        .collection('manifests')
        .doc(userId)
        .get();

      if (manifestDoc.exists()) {
        const data = manifestDoc.data();
        if (data) {
          setWantText(data.want || '');
          setImagineText(data.imagine || '');
          setSnagsText(data.snags || '');
          setHowText(data.how || '');
          
          if (data.startDate) {
            setWishStartDate(data.startDate);
            await AsyncStorage.setItem(`wishStart_${userId}`, data.startDate);
          }
          
          if (data.timelineDays) {
            setWishTimeline(data.timelineDays);
            await AsyncStorage.setItem(`wishTimeline_${userId}`, data.timelineDays.toString());
          }

          // Update local storage with Firestore data
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
      const percent = Math.min((daysElapsed / wishTimeline) * 100, 100);
      setProgressPercent(percent);
    };

    updateProgress();
    // Update progress every hour
    const interval = setInterval(updateProgress, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [wishStartDate, wishTimeline]);

  const handleRefineWant = async () => {
    if (!wantText.trim()) {
      Alert.alert('Empty Field', 'Please write your Want first.');
      return;
    }
    setLoadingWant(true);
    setWantSuggestion('');
    try {
      const suggestion = await refineManifest('want', wantText);
      setWantSuggestion(suggestion);
    } catch (error) {
      console.error('Error refining Want:', error);
      setWantSuggestion('Something went wrong. Please try again.');
    } finally {
      setLoadingWant(false);
    }
  };

  const handleRefineImagine = async () => {
    if (!imagineText.trim()) {
      Alert.alert('Empty Field', 'Please write your Imagine first.');
      return;
    }
    setLoadingImagine(true);
    setImagineSuggestion('');
    try {
      const suggestion = await refineManifest('imagine', imagineText);
      setImagineSuggestion(suggestion);
    } catch (error) {
      console.error('Error refining Imagine:', error);
      setImagineSuggestion('Something went wrong. Please try again.');
    } finally {
      setLoadingImagine(false);
    }
  };

  const handleRefineSnags = async () => {
    if (!snagsText.trim()) {
      Alert.alert('Empty Field', 'Please write your Snags first.');
      return;
    }
    setLoadingSnags(true);
    setSnagsSuggestion('');
    try {
      const suggestion = await refineManifest('snags', snagsText);
      setSnagsSuggestion(suggestion);
    } catch (error) {
      console.error('Error refining Snags:', error);
      setSnagsSuggestion('Something went wrong. Please try again.');
    } finally {
      setLoadingSnags(false);
    }
  };

  const handleRefineHow = async () => {
    if (!howText.trim()) {
      Alert.alert('Empty Field', 'Please write your How first.');
      return;
    }
    setLoadingHow(true);
    setHowSuggestion('');
    try {
      const suggestion = await refineManifest('how', howText);
      setHowSuggestion(suggestion);
    } catch (error) {
      console.error('Error refining How:', error);
      setHowSuggestion('Something went wrong. Please try again.');
    } finally {
      setLoadingHow(false);
    }
  };

  const handleSave = async () => {
    if (!wantText.trim() && !imagineText.trim() && !snagsText.trim() && !howText.trim()) {
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
      const startDate = wishStartDate || now;
      if (!wishStartDate) {
        setWishStartDate(startDate);
        await AsyncStorage.setItem(`wishStart_${userId}`, startDate);
        console.log('🎯 WISH timeline started:', startDate);
      }

      // Prepare WISH data
      const manifestData = {
        want: wantText,
        imagine: imagineText,
        snags: snagsText,
        how: howText,
        timelineDays: wishTimeline,
        startDate: startDate,
        updatedAt: now,
      };

      // Save to AsyncStorage (local, instant)
      await AsyncStorage.setItem(`manifest_${userId}`, JSON.stringify(manifestData));
      await AsyncStorage.setItem(`wishTimeline_${userId}`, wishTimeline.toString());
      console.log('💾 Saved to AsyncStorage');

      // Save to Firestore (cloud, sync across devices)
      await firestore()
        .collection('manifests')
        .doc(userId)
        .set(manifestData, {merge: true});
      console.log('☁️ Saved to Firestore');

      // Clear all Sophy suggestions after save
      setWantSuggestion('');
      setImagineSuggestion('');
      setSnagsSuggestion('');
      setHowSuggestion('');

      Alert.alert('Success', 'Your WISH has been saved!');
    } catch (error) {
      Alert.alert('Error', 'Failed to save WISH.');
    } finally {
      setSaving(false);
    }
  };

  const handleClearWish = () => {
    Alert.alert(
      'Time for New WISH?',
      'This will clear all your current WISH content and reset your timeline. Are you sure?',
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
                
                // Clear AsyncStorage
                await AsyncStorage.removeItem(`manifest_${userId}`);
                await AsyncStorage.removeItem(`wishStart_${userId}`);
                console.log('💾 Cleared AsyncStorage');

                // Clear Firestore
                await firestore()
                  .collection('manifests')
                  .doc(userId)
                  .delete();
                console.log('☁️ Cleared Firestore');
              }

              // Clear local state
              setWantText('');
              setImagineText('');
              setSnagsText('');
              setHowText('');
              setWantSuggestion('');
              setImagineSuggestion('');
              setSnagsSuggestion('');
              setHowSuggestion('');
              setWishStartDate(null);
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

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Timeline Selector - Only show if not started */}
        {!wishStartDate && (
          <View style={styles.timelineSection}>
            <Text style={styles.timelineLabel}>
              How many days to achieve this WISH?
            </Text>
            <View style={styles.radioGroup}>
              {[30, 60, 90].map((days) => (
                <TouchableOpacity
                  key={days}
                  style={[
                    styles.radioButton,
                    wishTimeline === days && styles.radioButtonSelected,
                  ]}
                  onPress={() => setWishTimeline(days)}>
                  <View style={styles.radioCircle}>
                    {wishTimeline === days && (
                      <View style={styles.radioCircleSelected} />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.radioLabel,
                      wishTimeline === days && styles.radioLabelSelected,
                    ]}>
                    {days} days
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Progress Bar - Show when started */}
        {wishStartDate && (
          <View style={styles.progressSection}>
            <Text style={styles.progressTitle}>Your WISH Growth Journey</Text>
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBarFill, {width: `${progressPercent}%`}]}>
                <Text style={styles.progressEmoji}>
                  {progressPercent <= 25 ? '🌱' : progressPercent <= 50 ? '🍀' : progressPercent <= 75 ? '🌿' : '🌳'}
                </Text>
              </View>
            </View>
            <Text style={styles.progressMessage}>
              {progressPercent <= 25
                ? 'Taking your first steps - you\'ve begun something meaningful'
                : progressPercent <= 50
                ? 'Building momentum - your consistency is creating change'
                : progressPercent <= 75
                ? 'Making solid progress - you\'re developing new patterns'
                : progressPercent < 100
                ? 'Approaching your timeline - notice how far you\'ve come'
                : 'Timeline reached - Time for New WISH!'}
            </Text>
          </View>
        )}

        {/* Timeline Growth Visualization - Show when not started */}
        {!wishStartDate && (
          <View style={styles.timelineProgress}>
            <Text style={styles.timelineProgressLabel}>
              Your WISH Growth Journey
            </Text>
            
            {/* Growth Stages */}
            <View style={styles.growthStages}>
              {['🌱', '🍀', '🌿', '🌳'].map((emoji, index) => (
                <View key={index} style={styles.growthStage}>
                  <Text style={styles.growthEmoji}>{emoji}</Text>
                  {index < 3 && <View style={styles.growthConnector} />}
                </View>
              ))}
            </View>
            
            {/* Timeline Labels */}
            <View style={styles.timelineLabels}>
            {[
              'Start',
              `${wishTimeline / 4} days`,
              `${wishTimeline / 2} days`,
              `${(wishTimeline * 3) / 4} days`,
              `${wishTimeline} days`,
            ].map((label, index) => (
              <Text key={index} style={styles.timelineLabel}>
                {label}
              </Text>
            ))}
          </View>
        </View>
        )}

        {/* Divider */}
        <View style={styles.divider} />

        {/* WANT Section */}
        <Text style={styles.sectionHeading}>Want</Text>
        <Text style={styles.sectionSubtext}>
          Identify a deeply meaningful, specific, and attainable goal that you
          truly want to achieve.
        </Text>
        <Text style={styles.sectionPrompt}>
          • What is something I genuinely want to accomplish?{'\n'}
          • Is this challenging yet realistic for me?
        </Text>

        <TextInput
          style={styles.textArea}
          placeholder="Write your Want here..."
          placeholderTextColor="#93A5A8"
          value={wantText}
          onChangeText={setWantText}
          multiline
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.sophyButton, loadingWant && styles.sophyButtonDisabled]}
          onPress={handleRefineWant}
          disabled={loadingWant}>
          <Text style={styles.sophyButtonText}>
            {loadingWant ? 'Reflecting...' : 'Reflect on your Want with Sophy'}
          </Text>
        </TouchableOpacity>

        {wantSuggestion ? (
          <View style={styles.suggestionDisplay}>
            <Text style={styles.suggestionText}>{wantSuggestion}</Text>
          </View>
        ) : null}

        {/* Divider */}
        <View style={styles.divider} />

        {/* IMAGINE Section */}
        <Text style={styles.sectionHeading}>Imagine</Text>
        <Text style={styles.sectionSubtext}>
          Vividly imagine and describe the best possible result of achieving
          what you want.
        </Text>
        <Text style={styles.sectionPrompt}>
          • What would success look and feel like in detail?{'\n'}
          • How will my life be different and better?
        </Text>

        <TextInput
          style={styles.textArea}
          placeholder="Write your Imagine here..."
          placeholderTextColor="#93A5A8"
          value={imagineText}
          onChangeText={setImagineText}
          multiline
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[
            styles.sophyButton,
            loadingImagine && styles.sophyButtonDisabled,
          ]}
          onPress={handleRefineImagine}
          disabled={loadingImagine}>
          <Text style={styles.sophyButtonText}>
            {loadingImagine
              ? 'Reflecting...'
              : 'Reflect on your Imagine with Sophy'}
          </Text>
        </TouchableOpacity>

        {imagineSuggestion ? (
          <View style={styles.suggestionDisplay}>
            <Text style={styles.suggestionText}>{imagineSuggestion}</Text>
          </View>
        ) : null}

        {/* Divider */}
        <View style={styles.divider} />

        {/* SNAGS Section */}
        <Text style={styles.sectionHeading}>Snags</Text>
        <Text style={styles.sectionSubtext}>
          Recognize internal and external snags that could interfere with your
          success.
        </Text>
        <Text style={styles.sectionPrompt}>
          • What within me (habits, thoughts, beliefs) might get in the way?
          {'\n'}• Which external factors or obstacles could derail my progress?
        </Text>

        <TextInput
          style={styles.textArea}
          placeholder="Write your Snags here..."
          placeholderTextColor="#93A5A8"
          value={snagsText}
          onChangeText={setSnagsText}
          multiline
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.sophyButton, loadingSnags && styles.sophyButtonDisabled]}
          onPress={handleRefineSnags}
          disabled={loadingSnags}>
          <Text style={styles.sophyButtonText}>
            {loadingSnags ? 'Reflecting...' : 'Reflect on your Snags with Sophy'}
          </Text>
        </TouchableOpacity>

        {snagsSuggestion ? (
          <View style={styles.suggestionDisplay}>
            <Text style={styles.suggestionText}>{snagsSuggestion}</Text>
          </View>
        ) : null}

        {/* Divider */}
        <View style={styles.divider} />

        {/* HOW Section */}
        <Text style={styles.sectionHeading}>How</Text>
        <Text style={styles.sectionSubtext}>
          Create "if-then" statements for overcoming the snags you identified.
        </Text>
        <Text style={styles.sectionPrompt}>
          • If I encounter [specific snag], then I will [planned response or
          action].{'\n'}• How will I get back on track when things go wrong?
        </Text>

        <TextInput
          style={styles.textArea}
          placeholder="Write your How here..."
          placeholderTextColor="#93A5A8"
          value={howText}
          onChangeText={setHowText}
          multiline
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.sophyButton, loadingHow && styles.sophyButtonDisabled]}
          onPress={handleRefineHow}
          disabled={loadingHow}>
          <Text style={styles.sophyButtonText}>
            {loadingHow ? 'Reflecting...' : 'Reflect on your How with Sophy'}
          </Text>
        </TouchableOpacity>

        {howSuggestion ? (
          <View style={styles.suggestionDisplay}>
            <Text style={styles.suggestionText}>{howSuggestion}</Text>
          </View>
        ) : null}

        {/* Divider */}
        <View style={styles.divider} />

        {/* Coach Guidance */}
        <View style={styles.coachGuidance}>
          <Text style={styles.coachGuidanceTitle}>
            Want to share your WISH with your coach?
          </Text>
          <Text style={styles.coachGuidanceText}>
            Your WISH is a personal visioning tool for your private reflection.
            To share it with your coach, create a journal entry about your WISH
            using the "Journal" tab, then tag it for coach review. Your current
            WISH will automatically be included as context with your entry.
          </Text>
          <Text style={styles.coachGuidanceHint}>
            Consider reflecting: What insights emerged from this WISH? What
            support do you need from your coach?
          </Text>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Action Buttons */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}>
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save My WISH'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.clearButton} onPress={handleClearWish}>
          <Text style={styles.clearButtonText}>Time for New WISH</Text>
        </TouchableOpacity>

        <Text style={styles.helpText}>
          Your WISH is saved privately and helps guide your personal growth
          journey.
        </Text>
      </View>
    </ScrollView>
  );
};

// Dynamic styles based on theme colors
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  content: {
    padding: spacing.lg,
  },
  title: {
    fontFamily: fontFamily.header,
    fontSize: fontSize.xxl,
    color: colors.fontMain,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },

  // Timeline Section
  timelineSection: {
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  timelineLabel: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: colors.fontSecondary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  radioGroup: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  radioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    backgroundColor: colors.bgCard,
    minWidth: 90,
    justifyContent: 'center',
  },
  radioButtonSelected: {
    borderColor: colors.brandPrimary,
    backgroundColor: colors.brandPrimaryRgba,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.borderMedium,
    marginRight: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brandPrimary,
  },
  radioLabel: {
    fontFamily: fontFamily.button,
    fontSize: fontSize.sm,
    color: colors.fontSecondary,
  },
  radioLabelSelected: {
    fontFamily: fontFamily.buttonBold,
    color: colors.brandPrimary,
  },
  
  // Progress Section
  progressSection: {
    marginBottom: spacing.lg,
    paddingVertical: spacing.base,
  },
  progressTitle: {
    fontFamily: fontFamily.header,
    fontSize: fontSize.md,
    color: colors.brandPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  progressBarContainer: {
    height: 25,
    backgroundColor: colors.bgMuted,
    borderRadius: 15,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.brandPrimary,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: 8,
  },
  progressEmoji: {
    fontSize: fontSize.md,
  },
  progressMessage: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.fontMuted,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingHorizontal: spacing.base,
  },

  timelineProgress: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  timelineProgressLabel: {
    fontFamily: fontFamily.header,
    fontSize: fontSize.md,
    color: colors.brandPrimary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  growthStages: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    maxWidth: 350,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  growthStage: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  growthEmoji: {
    fontSize: fontSize.display,
    zIndex: 2,
  },
  growthConnector: {
    position: 'absolute',
    left: '50%',
    width: '100%',
    height: 2,
    backgroundColor: colors.brandPrimary,
    zIndex: 1,
  },
  timelineLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 350,
    paddingHorizontal: spacing.sm,
  },
  timelineLabelText: {
    fontFamily: fontFamily.button,
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.fontMuted,
    textAlign: 'center',
  },

  // Section Styles
  sectionHeading: {
    fontFamily: fontFamily.header,
    fontSize: fontSize.xxl,
    color: colors.fontMain,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  sectionSubtext: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
    color: colors.fontSecondary,
    marginBottom: spacing.md,
    lineHeight: 26,
  },
  sectionPrompt: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.fontMuted,
    marginBottom: spacing.lg,
    lineHeight: 22,
    fontStyle: 'italic',
  },

  // Text Area
  textArea: {
    fontFamily: fontFamily.body,
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    fontSize: fontSize.md,
    color: colors.fontMain,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    minHeight: 120,
    marginBottom: spacing.base,
  },

  // Sophy Button
  sophyButton: {
    backgroundColor: colors.sophyAccent,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  sophyButtonDisabled: {
    opacity: 0.7,
  },
  sophyButtonText: {
    fontFamily: fontFamily.buttonBold,
    color: colors.fontWhite,
    fontSize: fontSize.md,
    letterSpacing: 0.5,
  },

  // Suggestion Display
  suggestionDisplay: {
    backgroundColor: colors.bgSection,
    borderLeftWidth: 3,
    borderLeftColor: colors.sophyAccent,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.base,
  },
  suggestionText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    lineHeight: 22,
    color: colors.fontMain,
    fontStyle: 'italic',
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.xl,
  },

  // Coach Guidance
  coachGuidance: {
    backgroundColor: colors.infoBg,
    borderLeftWidth: 4,
    borderLeftColor: colors.brandPrimary,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  coachGuidanceTitle: {
    fontFamily: fontFamily.header,
    fontSize: fontSize.md,
    color: colors.brandPrimary,
    marginBottom: spacing.sm,
  },
  coachGuidanceText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.fontMain,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  coachGuidanceHint: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.fontMuted,
    fontStyle: 'italic',
    lineHeight: 20,
  },

  // Action Buttons
  saveButton: {
    backgroundColor: colors.brandPrimary,
    paddingVertical: spacing.base,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontFamily: fontFamily.buttonBold,
    color: colors.fontWhite,
    fontSize: fontSize.md,
    letterSpacing: 0.5,
  },
  clearButton: {
    backgroundColor: colors.fontMuted,
    paddingVertical: spacing.base,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  clearButtonText: {
    fontFamily: fontFamily.buttonBold,
    color: colors.fontWhite,
    fontSize: fontSize.md,
    letterSpacing: 0.5,
  },
  helpText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.fontMuted,
    lineHeight: 22,
    textAlign: 'center',
  },
});

export default ManifestScreen;
