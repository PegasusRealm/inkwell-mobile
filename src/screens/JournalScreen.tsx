/**
 * JournalScreen — v2 rebuild (M2 slice 1, 2026-07-04)
 * Structure: Projects/InkWell/builds/ui-pass-2026-07/mockup-a (Adam-approved).
 * Copy: web/public/app.html voice pass, verbatim.
 * LAWS: teal structure / coral Sophy-only / warm fields in her blocks /
 * no emojis in chrome / the person owns the sentence.
 * Connect is dead — all practitioner send paths removed (2026-07-04).
 */
import React, {useState, useRef, useEffect, useMemo, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  PermissionsAndroid,
  Image,
  useWindowDimensions,
  KeyboardAvoidingView,
  Linking,
  Animated,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Clipboard from '@react-native-clipboard/clipboard';
// Wrap Voice import to handle iOS compatibility issues
let Voice: any = null;
try {
  const VoiceModule = require('@react-native-voice/voice');
  Voice = VoiceModule.default;
} catch (e) {
  console.warn('Voice module not available:', e);
}
import DocumentPicker from 'react-native-document-picker';
import {launchImageLibrary, ImagePickerResponse} from 'react-native-image-picker';
import storage from '@react-native-firebase/storage';
import firestore from '@react-native-firebase/firestore';
import {spacing, borderRadius, fontFamily, fontSize} from '../theme';
import {useTheme, ThemeColors} from '../theme/ThemeContext';
import {generatePrompt, transcribeVoice, getReflection} from '../services/sophyApi';
import {useSubscription} from '../hooks/useSubscription';
import {
  checkAIAccess,
  incrementAIUsage,
  getRemainingAICalls,
  AI_DAILY_LIMIT,
} from '../services/aiUsageService';
import PaywallModal from '../components/PaywallModal';
import InfoModal, {InfoHighlightBox, InfoParagraph, InfoDivider, InfoSection} from '../components/InfoModal';
import WeeklyActivityDots from '../components/WeeklyActivityDots';
import {Card, IWButton, Pill, SophyBlock, Divider} from '../components/kit';
import {FirstStepsCard, CoachHint} from '../components/FirstStepsCard';
import {FirstStepsService, FirstStepKey} from '../services/firstStepsService';
import type {TabScreenProps} from '../navigation/types';
import {iPadContentStyle, showActionSheet, getKeyboardVerticalOffset} from '../utils/iPad';

// Gratitude nudge dot — mirrors web markGratDoneToday (localStorage 'gratDoneDate')
const GRAT_DONE_KEY = 'gratDoneDate';
const todayKey = () => new Date().toISOString().slice(0, 10);

// ═══════════════════════════════════════════════════════════════════════════
// GRATITUDE PROTOCOL ENGINE — ported verbatim from web app.html (v2 Phase 2a)
// Five evidence-based practices, rotated to prevent habituation
// (Emmons & McCullough 2003; Seligman et al. 2005; Koo et al. 2008;
//  Lyubomirsky et al. 2005; Bryant & Veroff 2007)
// ═══════════════════════════════════════════════════════════════════════════
type GratPractice = 'three' | 'deep' | 'subtraction' | 'letter' | 'savor';

const GRATITUDE_SUBTEXT: Record<GratPractice, string> = {
  three: 'Research shows listing 3+ gratitudes improves well-being, sleep, and relationships.',
  deep: 'Going deep on one good thing beats listing many. (Seligman et al., 2005)',
  subtraction: 'Imagining life without a good thing renews its power. (Koo et al., 2008)',
  letter: 'The gratitude letter carries the largest effect in positive psychology. (Seligman et al., 2005)',
  savor: 'Savoring one moment in detail trains the brain to notice more of them. (Bryant & Veroff, 2007)',
};

const SUBTRACTION_PROMPTS = [
  "Think of a person you're glad is in your life. Imagine the day you almost didn't meet them. What would this week have looked like without them?",
  "Picture a choice you made that turned out well. Imagine you'd chosen differently. What good thing wouldn't exist now?",
  'Think of your home, or a place you feel safe. Imagine never having found it. Where would you be instead?',
  'Recall a skill or ability you use every day. Imagine waking up tomorrow without it. What would the day cost you?',
  "Think of someone who taught you something important. Imagine they'd never crossed your path. What would you not know today?",
  "Picture a friendship that almost didn't happen. Trace the near-miss. What did luck hand you that day?",
  'Think of one part of your body that works without complaint. Imagine a week without it. What does it quietly do for you?',
  'Recall an opportunity you almost turned down. Imagine you had. What chain of good things breaks?',
  'Think of a tool or object you rely on daily. Imagine it gone for a month. What does it actually carry for you?',
  "Picture someone who forgave you once. Imagine they hadn't. What would be different between you now?",
  "Think of a hard season that ended. Imagine it hadn't ended yet. What does its absence give you today?",
  'Recall a small kindness a stranger showed you. Imagine that moment never happened. What did it change?',
];

const SAVOR_NUDGES = [
  'What did it sound like?',
  'Where in your body did you feel it?',
  'What would a photo of it have missed?',
  'What did the air feel like?',
  'What made it almost too small to notice?',
  'If the moment had a color, what was it?',
];

// Same date rule as web: first Saturday = letter; Sun savor / Wed deep / Fri subtraction
const suggestedGratitudePractice = (): GratPractice => {
  const d = new Date();
  if (d.getDay() === 6 && d.getDate() <= 7) return 'letter';
  return ({0: 'savor', 3: 'deep', 5: 'subtraction'} as Record<number, GratPractice>)[d.getDay()] || 'three';
};

// Server-backed gratitude actions (gratitudeEngine cloud function)
const GRATITUDE_ENGINE_URL = 'https://us-central1-inkwell-alpha.cloudfunctions.net/gratitudeEngine';
async function gratEngineFetch(payload: object): Promise<{ok: boolean; status: number; data: any}> {
  const user = auth().currentUser;
  if (!user) throw new Error('Sign in required');
  const idToken = await user.getIdToken();
  const response = await fetch(GRATITUDE_ENGINE_URL, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + idToken},
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  return {ok: response.ok, status: response.status, data};
}

// ═══════════════════════════════════════════════════════════════════════════
// FEEL CHECK (ported from web 2026-07-04) — optional 1-5 "how heavy does it
// feel" before and after practices. LAW: a self-rated feel, NEVER a symptom
// score. No clinical words on or near the scale. Feeds the anonymous shift
// line in the Practice Summary (numbers only, never words).
// ═══════════════════════════════════════════════════════════════════════════
type FeelKey = 'gratitude' | 'reframe';

interface FeelCheckRowProps {
  question: string;
  selected: number;
  onTap: (n: number) => void;
  colors: ThemeColors;
}

const FeelCheckRow: React.FC<FeelCheckRowProps> = ({question, selected, onTap, colors}) => (
  // Centered stack (Adam, 2026-07-05): question / scale / "optional" on its own line
  <View style={[feelStyles.row, {backgroundColor: colors.bgMuted}]}>
    <Text style={[feelStyles.q, {color: colors.fontSecondary}]}>{question}</Text>
    <View style={feelStyles.scale}>
      <Text style={[feelStyles.end, {color: colors.fontMuted}]}>light</Text>
      {[1, 2, 3, 4, 5].map(n => (
        <TouchableOpacity
          key={n}
          style={[
            feelStyles.dot,
            {borderColor: colors.borderMedium, backgroundColor: colors.bgCard},
            selected === n && {backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary},
          ]}
          onPress={() => onTap(n)}
          hitSlop={{top: 6, bottom: 6, left: 2, right: 2}}>
          <Text
            style={[
              feelStyles.dotText,
              {color: selected === n ? colors.fontWhite : colors.fontSecondary},
            ]}>
            {n}
          </Text>
        </TouchableOpacity>
      ))}
      <Text style={[feelStyles.end, {color: colors.fontMuted}]}>heavy</Text>
    </View>
    <Text style={[feelStyles.skip, {color: colors.fontMuted}]}>optional</Text>
  </View>
);

const feelStyles = StyleSheet.create({
  row: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 14,
  },
  q: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    textAlign: 'center',
  },
  scale: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  end: {
    fontFamily: fontFamily.body,
    fontSize: 10.5,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotText: {
    fontFamily: fontFamily.buttonBold,
    fontSize: 12,
  },
  skip: {
    fontFamily: fontFamily.body,
    fontSize: 10.5,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  noted: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    opacity: 0.75,
  },
});

const JournalScreen: React.FC<TabScreenProps<'Journal'>> = ({navigation}) => {
  const {colors, isDark} = useTheme();
  const {width: screenWidth} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const {
    checkFeatureAndShowPaywall,
    hasFeatureAccess,
    isPremium,
    showPaywall,
    closePaywall,
  } = useSubscription();

  // FirstSteps quest navigation (event-driven onboarding — web parity)
  const handleFirstStepGo = (step: FirstStepKey) => {
    if (step === 'entries') {
      navigation.navigate('PastEntries');
      return;
    }
    if (step === 'wish') {
      navigation.navigate('Manifest');
      return;
    }
    // write / prompt / save all live in Full Journal
    setActiveMode('full');
    setJournalPractice('free');
  };

  // The identity bar replaces the navigation header (mockup nav decision (a))
  useEffect(() => {
    navigation.setOptions({headerShown: false});
  }, [navigation]);

  // Journal Mode State — Full Journal is the default (v2 spec)
  type JournalMode = 'gratitude' | 'inkblot' | 'full';
  const [activeMode, setActiveMode] = useState<JournalMode>('full');

  // Info Modal State
  const [showGratitudeInfo, setShowGratitudeInfo] = useState(false);
  const [showInkblotInfo, setShowInkblotInfo] = useState(false);

  // Activity dots refresh trigger
  const [activityRefreshTrigger, setActivityRefreshTrigger] = useState(0);

  // Gratitude nudge dot (coral on the Gratitude pill until saved today)
  const [gratDoneToday, setGratDoneToday] = useState(true); // assume done until read
  useEffect(() => {
    AsyncStorage.getItem(GRAT_DONE_KEY).then(v => setGratDoneToday(v === todayKey()));
  }, []);
  const markGratDoneToday = useCallback(async () => {
    await AsyncStorage.setItem(GRAT_DONE_KEY, todayKey());
    setGratDoneToday(true);
  }, []);

  // Gratitude (Three) state
  const [gratitude1, setGratitude1] = useState('');
  const [gratitude2, setGratitude2] = useState('');
  const [gratitude3, setGratitude3] = useState('');
  const [savingGratitude, setSavingGratitude] = useState(false);
  const [gratitudeStatus, setGratitudeStatus] = useState('');

  // Gratitude protocol engine state (deep / subtraction / letter / savor)
  const [activeGratPractice, setActiveGratPractice] = useState<GratPractice>('three');
  const [gratDeepText, setGratDeepText] = useState('');
  const [gratSubtractionText, setGratSubtractionText] = useState('');
  const [gratSubtractionPrompt, setGratSubtractionPrompt] = useState('');
  const [gratLetterTo, setGratLetterTo] = useState('');
  const [gratLetterText, setGratLetterText] = useState('');
  const [gratSavorText, setGratSavorText] = useState('');
  const [gratSavorNudge, setGratSavorNudge] = useState('');
  const [letterAssistLoading, setLetterAssistLoading] = useState(false);
  const [personalizingPrompt, setPersonalizingPrompt] = useState(false);
  const suggestedPractice = useMemo(() => suggestedGratitudePractice(), []);

  const shuffleSubtractionPrompt = useCallback(() => {
    setGratSubtractionPrompt(prev => {
      let next = prev;
      while (next === prev) {
        next = SUBTRACTION_PROMPTS[Math.floor(Math.random() * SUBTRACTION_PROMPTS.length)];
      }
      return next;
    });
  }, []);

  const switchGratPractice = (p: GratPractice) => {
    setActiveGratPractice(p);
    if (p === 'subtraction' && !gratSubtractionPrompt.trim()) {
      shuffleSubtractionPrompt();
    }
    if (p === 'savor') {
      setGratSavorNudge(SAVOR_NUDGES[Math.floor(Math.random() * SAVOR_NUDGES.length)]);
    }
  };

  // InkBlot state
  const [inkblotText, setInkblotText] = useState('');
  const [savingInkblot, setSavingInkblot] = useState(false);
  const [inkblotRecording, setInkblotRecording] = useState(false);
  const [inkblotStatus, setInkblotStatus] = useState('');

  // InkBlot two-speed: Capture / Sprint (Pennebaker & Beall 1986; Frattaroli 2006)
  const [blotPractice, setBlotPractice] = useState<'capture' | 'sprint'>('capture');
  const [sprintMinutes, setSprintMinutes] = useState<15 | 20>(15);
  const [sprintRunning, setSprintRunning] = useState(false);
  const [sprintDisplay, setSprintDisplay] = useState('15:00');
  const [sprintIdle, setSprintIdle] = useState(false);
  const [sprintText, setSprintText] = useState('');
  const [savingSprint, setSavingSprint] = useState(false);
  const [sprintStatus, setSprintStatus] = useState('');
  const sprintEndsAtRef = useRef<number | null>(null);
  const sprintLastKeyRef = useRef(0);
  const sprintBreath = useRef(new Animated.Value(0)).current;

  // FeelCheck state — before-values per practice, one pending "and now?" offer
  const [feelBefore, setFeelBefore] = useState<Record<FeelKey, number>>({gratitude: 0, reframe: 0});
  const [feelAfterPrompt, setFeelAfterPrompt] = useState<{key: FeelKey; entryId: string} | null>(null);
  const [feelNoted, setFeelNoted] = useState<FeelKey | null>(null);

  // Journal practice state: Free-write / Reframe
  const [journalPractice, setJournalPractice] = useState<'free' | 'reframe'>('free');
  const [reframe1, setReframe1] = useState('');
  const [reframe2, setReframe2] = useState('');
  const [reframe3, setReframe3] = useState('');
  const [reframe4, setReframe4] = useState('');
  const [savingReframe, setSavingReframe] = useState(false);
  const [reframeStatus, setReframeStatus] = useState('');

  // Sophy prompt state
  const [promptTopic, setPromptTopic] = useState('');
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [savePromptChecked, setSavePromptChecked] = useState(false);
  const [generatingPrompt, setGeneratingPrompt] = useState(false);

  // InkOutLoud voice state (native speech recognition)
  const [isRecording, setIsRecording] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [voicePartialText, setVoicePartialText] = useState('');
  const [voiceStatus, setVoiceStatus] = useState('');

  // File attachments state
  const [attachments, setAttachments] = useState<Array<{uri: string; name: string; type: string; size: number}>>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  // Journal entry state
  const [journalEntry, setJournalEntry] = useState('');
  const [saving, setSaving] = useState(false);
  const [journalStatus, setJournalStatus] = useState('');

  // Sophy reflection state
  const [sophyReflection, setSophyReflection] = useState('');
  const [saveReflectionChecked, setSaveReflectionChecked] = useState(false);
  const [generatingReflection, setGeneratingReflection] = useState(false);

  // Emotional insights (from Plus voice analysis)
  const [emotionalInsights, setEmotionalInsights] = useState<{
    primaryEmotion?: string;
    confidence?: number;
    energyLevel?: string;
    stressLevel?: string;
    sophyInsight?: string;
  } | null>(null);

  // AI usage tracking
  const [, setAiCallsRemaining] = useState<number>(AI_DAILY_LIMIT);
  useEffect(() => {
    const loadAIUsage = async () => {
      if (!isPremium) {
        const remaining = await getRemainingAICalls();
        setAiCallsRemaining(remaining);
      }
    };
    loadAIUsage();
  }, [isPremium]);

  // Tag state
  const [entryTags, setEntryTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [userTagLibrary, setUserTagLibrary] = useState<string[]>([]);

  useEffect(() => {
    const loadUserTags = async () => {
      const user = auth().currentUser;
      if (!user) return;
      try {
        const userDoc = await firestore().collection('users').doc(user.uid).get();
        if (userDoc.exists() && userDoc.data()?.userTags) {
          setUserTagLibrary(userDoc.data()?.userTags || []);
        }
      } catch (error) {
        console.warn('Could not load user tags:', error);
      }
    };
    loadUserTags();
  }, []);

  const addTag = (tag: string) => {
    const normalized = tag.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
    if (!normalized || normalized.length < 2 || entryTags.includes(normalized)) {
      setTagInput('');
      return;
    }
    setEntryTags([...entryTags, normalized]);
    if (!userTagLibrary.includes(normalized)) {
      const newLibrary = [...userTagLibrary, normalized].sort();
      setUserTagLibrary(newLibrary);
      const user = auth().currentUser;
      if (user) {
        firestore().collection('users').doc(user.uid).update({userTags: newLibrary});
      }
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setEntryTags(entryTags.filter(t => t !== tag));
  };

  // Transient inline status helper (observation voice, no cheerleader toasts)
  const flashStatus = (setter: (s: string) => void, text: string, ms = 3000) => {
    setter(text);
    setTimeout(() => setter(''), ms);
  };

  // AI gating helper
  const checkAndUseAI = async (featureName: string): Promise<boolean> => {
    const hasUnlimitedAI = await hasFeatureAccess('ai');
    if (hasUnlimitedAI) {
      return true;
    }
    const access = await checkAIAccess();
    if (!access.canUse) {
      Alert.alert(
        'Daily Limit Reached',
        `You've used all ${AI_DAILY_LIMIT} free AI calls today. Plus removes the limit.`,
        [
          {text: 'Maybe Later', style: 'cancel'},
          {text: 'See Plus', onPress: () => checkFeatureAndShowPaywall('ai')},
        ],
      );
      return false;
    }
    return true;
  };

  const afterAIUse = async () => {
    const hasUnlimitedAI = await hasFeatureAccess('ai');
    if (!hasUnlimitedAI) {
      await incrementAIUsage();
      const remaining = await getRemainingAICalls();
      setAiCallsRemaining(remaining);
    }
  };

  const handleGeneratePrompt = async () => {
    const canProceed = await checkAndUseAI('prompt generation');
    if (!canProceed) return;

    setGeneratingPrompt(true);
    setGeneratedPrompt('');
    try {
      const prompt = await generatePrompt(promptTopic);
      setGeneratedPrompt(prompt);
      setSavePromptChecked(true);
      await afterAIUse();
      FirstStepsService.complete('prompt');
    } catch (error: any) {
      console.error('Error generating prompt:', error);
      Alert.alert('Error', error.message || 'Failed to generate prompt. Please try again.');
    } finally {
      setGeneratingPrompt(false);
    }
  };

  const handleGetReflection = async () => {
    const canProceed = await checkAndUseAI('reflection');
    if (!canProceed) return;

    if (!journalEntry.trim()) {
      Alert.alert(
        'Empty Entry',
        'Please write something in your journal first, then Sophy can reflect on it.',
      );
      return;
    }

    setGeneratingReflection(true);
    setSophyReflection('');
    try {
      const reflection = await getReflection(journalEntry);
      setSophyReflection(reflection);
      await afterAIUse();
      setSaveReflectionChecked(true);
    } catch (error: any) {
      console.error('Error getting reflection:', error);
      Alert.alert('Error', error.message || 'Failed to get reflection. Please try again.');
    } finally {
      setGeneratingReflection(false);
    }
  };

  // ==================== InkOutLoud Voice Recognition ====================

  useEffect(() => {
    if (!Voice) {
      console.warn('Voice module not available - voice features disabled');
      return;
    }

    Voice.onSpeechResults = (e: any) => {
      if (e.value && e.value[0]) {
        setVoiceText(e.value[0]);
      }
    };

    Voice.onSpeechPartialResults = (e: any) => {
      if (e.value && e.value[0]) {
        setVoicePartialText(e.value[0]);
      }
    };

    Voice.onSpeechError = (e: any) => {
      console.error('Speech error:', e.error);
      setIsRecording(false);
      if (e.error?.message && !e.error.message.includes('No speech')) {
        Alert.alert('Speech Error', 'Could not recognize speech. Please try again.');
      }
    };

    Voice.onSpeechEnd = () => {
      setIsRecording(false);
    };

    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, []);

  const requestMicrophonePermission = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'InkWell needs access to your microphone for voice journaling.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true; // iOS handles permission via Info.plist
  };

  const handleStartRecording = async () => {
    if (!Voice) {
      Alert.alert('Voice Unavailable', 'Voice recognition is not available on this device.');
      return;
    }
    const hasPermission = await requestMicrophonePermission();
    if (!hasPermission) {
      Alert.alert('Permission Denied', 'Microphone access is required to speak an entry.');
      return;
    }
    try {
      setVoiceText('');
      setVoicePartialText('');
      await Voice.start('en-US');
      setIsRecording(true);
    } catch (error: any) {
      console.error('Voice start error:', error);
      Alert.alert('Voice Recognition Failed', 'Could not start voice recognition. Please try again.');
    }
  };

  const handleStopRecording = async () => {
    if (!Voice) return;
    try {
      await Voice.stop();
      setIsRecording(false);

      const recognizedText = voiceText || voicePartialText;
      if (!recognizedText || recognizedText.trim().length === 0) {
        flashStatus(setVoiceStatus, 'No speech detected. Try again.');
        return;
      }

      if (isPremium) {
        // Plus users get AI cleanup and emotional analysis
        setVoiceStatus('Cleaning up your words...');
        try {
          const transcriptionResult = await transcribeVoice(recognizedText);
          setJournalEntry(prev => prev + (prev ? ' ' : '') + transcriptionResult.cleanedText);
          if (transcriptionResult.emotionalInsights) {
            setEmotionalInsights(transcriptionResult.emotionalInsights);
            if (transcriptionResult.emotionalInsights.sophyInsight) {
              setSophyReflection(transcriptionResult.emotionalInsights.sophyInsight);
              setSaveReflectionChecked(true);
            }
          }
          flashStatus(setVoiceStatus, 'Voice added.');
        } catch (transcriptionError: any) {
          console.error('AI processing error:', transcriptionError);
          setJournalEntry(prev => prev + (prev ? ' ' : '') + recognizedText);
          flashStatus(setVoiceStatus, 'Voice added. AI cleanup unavailable.');
        }
      } else {
        setJournalEntry(prev => prev + (prev ? ' ' : '') + recognizedText);
        flashStatus(setVoiceStatus, 'Voice added.');
      }

      setVoiceText('');
      setVoicePartialText('');
    } catch (error) {
      console.error('Stop recording error:', error);
      Alert.alert('Error', 'Failed to stop voice recognition.');
    }
  };

  const handleVoiceToggle = () => {
    if (isRecording) {
      handleStopRecording();
    } else {
      handleStartRecording();
    }
  };

  // ==================== File Attachments ====================

  const handlePickFiles = async () => {
    // FEATURE GATE: file uploads require Plus
    const hasAccess = await checkFeatureAndShowPaywall('fileUpload');
    if (!hasAccess) {
      return;
    }
    showActionSheet(
      'Attach Files',
      ['Cancel', 'Photo Library', 'Files'],
      0,
      buttonIndex => {
        if (buttonIndex === 1) {
          handlePickPhotos();
        } else if (buttonIndex === 2) {
          handlePickDocuments();
        }
      },
    );
  };

  const handlePickPhotos = async () => {
    try {
      const result: ImagePickerResponse = await launchImageLibrary({
        mediaType: 'mixed',
        selectionLimit: 10,
        quality: 0.8,
      });

      if (result.didCancel) return;
      if (result.errorCode) {
        console.error('Image picker error:', result.errorMessage);
        Alert.alert('Error', 'Failed to access photo library.');
        return;
      }

      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
      const validAssets = (result.assets || []).filter(asset => {
        if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE) {
          Alert.alert('File Too Large', `${asset.fileName || 'Photo'} is too large (max 10MB). It will be skipped.`);
          return false;
        }
        return true;
      });

      setAttachments(prev => [
        ...prev,
        ...validAssets.map(asset => ({
          uri: asset.uri || '',
          name: asset.fileName || `photo_${Date.now()}.jpg`,
          type: asset.type || 'image/jpeg',
          size: asset.fileSize || 0,
        })),
      ]);
    } catch (error) {
      console.error('Photo picker error:', error);
      Alert.alert('Error', 'Failed to pick photos.');
    }
  };

  const handlePickDocuments = async () => {
    try {
      const results = await DocumentPicker.pick({
        allowMultiSelection: true,
        type: [DocumentPicker.types.images, DocumentPicker.types.pdf, DocumentPicker.types.allFiles],
      });

      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
      const validFiles = results.filter(file => {
        if (file.size && file.size > MAX_FILE_SIZE) {
          Alert.alert('File Too Large', `${file.name} is too large (max 10MB). It will be skipped.`);
          return false;
        }
        return true;
      });

      setAttachments(prev => [
        ...prev,
        ...validFiles.map(f => ({
          uri: f.uri,
          name: f.name || 'file',
          type: f.type || 'application/octet-stream',
          size: f.size || 0,
        })),
      ]);
    } catch (error: any) {
      if (!DocumentPicker.isCancel(error)) {
        console.error('File picker error:', error);
        Alert.alert('Error', 'Failed to pick files.');
      }
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const uploadAttachments = async (): Promise<Array<{url: string; name: string; type?: string}>> => {
    if (attachments.length === 0) return [];

    const user = auth().currentUser;
    if (!user) throw new Error('User not authenticated');

    const uploadedAttachments: Array<{url: string; name: string; type?: string}> = [];
    const failedUploads: string[] = [];

    for (const file of attachments) {
      try {
        const fileName = `${user.uid}/${Date.now()}_${file.name}`;
        const reference = storage().ref(fileName);
        await reference.putFile(file.uri);
        const url = await reference.getDownloadURL();
        uploadedAttachments.push({url, name: file.name, type: file.type});
      } catch (uploadError) {
        console.error('Upload error for', file.name, uploadError);
        failedUploads.push(file.name);
      }
    }

    if (failedUploads.length > 0) {
      Alert.alert('Some Files Failed', `Could not upload: ${failedUploads.join(', ')}. The rest of your entry was saved.`);
    }

    return uploadedAttachments;
  };

  // ==================== FULL JOURNAL SAVE ====================
  const handleSave = async () => {
    if (!journalEntry.trim()) {
      Alert.alert('Empty Entry', 'Please write something before saving.');
      return;
    }

    setSaving(true);
    try {
      const user = auth().currentUser;
      if (!user) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      // Upload attachments first
      let uploadedAttachments: Array<{url: string; name: string}> = [];
      if (attachments.length > 0) {
        setUploadingFiles(true);
        try {
          uploadedAttachments = await uploadAttachments();
        } catch (uploadError) {
          console.error('Upload error:', uploadError);
          Alert.alert('Upload Warning', 'Some files failed to upload but entry will still be saved.');
        } finally {
          setUploadingFiles(false);
        }
      }

      // Check for user's manifest data to auto-include
      let manifestData = null;
      let hasManifestData = false;
      try {
        const manifestDoc = await firestore().collection('manifests').doc(user.uid).get();
        if (manifestDoc.exists()) {
          const manifestDocData = manifestDoc.data();
          const wish = manifestDocData?.want || '';
          const outcome = manifestDocData?.imagine || '';
          const opposition = manifestDocData?.snags || '';
          const plan = manifestDocData?.how || '';
          if (wish || outcome || opposition || plan) {
            hasManifestData = true;
            manifestData = {wish, outcome, opposition, plan};
          }
        }
      } catch (manifestError) {
        console.log('No manifest data found:', manifestError);
      }

      const tagsArray: string[] = [];
      entryTags.forEach(tag => {
        if (!tagsArray.includes(tag)) {
          tagsArray.push(tag);
        }
      });
      if (hasManifestData) {
        if (!tagsArray.includes('manifest')) tagsArray.push('manifest');
        if (!tagsArray.includes('manifesting')) tagsArray.push('manifesting');
        const today = new Date().toISOString().split('T')[0];
        tagsArray.push(`manifestDate:${today}`);
      }

      const entryData: any = {
        text: journalEntry,
        userId: user.uid,
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };

      if (tagsArray.length > 0) {
        entryData.tags = tagsArray;
      }
      if (hasManifestData && manifestData) {
        entryData.manifestData = manifestData;
        entryData.contextManifest = `${manifestData.wish} | ${manifestData.outcome} | ${manifestData.opposition} | ${manifestData.plan}`;
      }
      if (savePromptChecked && generatedPrompt) {
        entryData.promptUsed = generatedPrompt;
      }
      if (saveReflectionChecked && sophyReflection) {
        entryData.reflectionUsed = sophyReflection;
      }
      if (uploadedAttachments.length > 0) {
        entryData.attachments = uploadedAttachments;
      }

      const savedEntry = await firestore().collection('journalEntries').add(entryData);

      // Generate embeddings in background (non-blocking)
      (async () => {
        try {
          const idToken = await user.getIdToken();
          const endpoint = __DEV__
            ? 'http://localhost:5001/inkwell-alpha/us-central1/embedAndStoreEntry'
            : 'https://us-central1-inkwell-alpha.cloudfunctions.net/embedAndStoreEntry';
          await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              text: journalEntry,
              entryId: savedEntry.id,
            }),
          });
        } catch (embedError) {
          console.warn('Embedding error (non-blocking):', embedError);
        }
      })();

      // First save earns the compounding line (web FirstSteps toast copy)
      const isFirstSave = FirstStepsService.isQuestActive() && !FirstStepsService.getState()?.save;
      flashStatus(
        setJournalStatus,
        isFirstSave ? 'Saved. A year from now, this entry comes back to you.' : 'Saved to your journal.',
        isFirstSave ? 6000 : 3000,
      );
      FirstStepsService.complete('save');

      // Refresh activity dots
      setActivityRefreshTrigger(prev => prev + 1);

      // Clear form after successful save
      setJournalEntry('');
      setGeneratedPrompt('');
      setSophyReflection('');
      setEmotionalInsights(null);
      setPromptTopic('');
      setSavePromptChecked(false);
      setSaveReflectionChecked(false);
      setAttachments([]);
      setEntryTags([]);
      setTagInput('');
      setShowTagInput(false);
    } catch (error: any) {
      console.error('Error saving entry:', error);
      Alert.alert('Error', 'Failed to save entry. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ==================== REFRAME SAVE ====================
  // Entry shape ported verbatim from web saveReframeEntry (app.html)
  const handleSaveReframe = async () => {
    const steps = [reframe1.trim(), reframe2.trim(), reframe3.trim(), reframe4.trim()];
    if (!steps[0] || !steps[3]) {
      flashStatus(setReframeStatus, 'At minimum: what happened (1) and another way to see it (4).', 4000);
      return;
    }

    setSavingReframe(true);
    try {
      const user = auth().currentUser;
      if (!user) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }
      const today = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const text = `Perspective practice:\n\nWhat happened:\n${steps[0]}\n\nWhat my mind made it mean:\n${
        steps[1] || '(skipped)'
      }\n\nFor and against that read:\n${steps[2] || '(skipped)'}\n\nAnother way to see it:\n${steps[3]}`;

      const entryData: any = {
        userId: user.uid,
        text,
        title: `Reframe - ${today}`,
        mood: '🔄',
        tags: ['reframe'],
        entryMode: 'journal',
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };
      feelStamp('reframe', entryData);

      const docRef = await firestore().collection('journalEntries').add(entryData);
      feelOfferAfter('reframe', docRef.id);

      setReframe1('');
      setReframe2('');
      setReframe3('');
      setReframe4('');
      flashStatus(setReframeStatus, 'Saved to your journal.');
      setActivityRefreshTrigger(prev => prev + 1);
    } catch (e) {
      console.error('Reframe save failed:', e);
      flashStatus(setReframeStatus, 'Save failed. Please try again.');
    } finally {
      setSavingReframe(false);
    }
  };

  // ==================== GRATITUDE SAVE (Three) ====================
  const handleSaveGratitude = async () => {
    const gratitudes = [gratitude1, gratitude2, gratitude3].map(g => g.trim()).filter(g => g);
    if (gratitudes.length === 0) {
      flashStatus(setGratitudeStatus, 'Please enter at least one gratitude.');
      return;
    }

    setSavingGratitude(true);
    try {
      const user = auth().currentUser;
      if (!user) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      // Entry shape mirrors web saveGratitudeEntry (app.html)
      const content = gratitudes.map((g, i) => `${i + 1}. ${g}`).join('\n\n');
      const today = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const entryData: any = {
        userId: user.uid,
        text: `Today I'm grateful for:\n\n${content}`,
        title: `Gratitude - ${today}`,
        rawGratitudes: gratitudes,
        mood: '🙏',
        tags: ['gratitude'],
        entryMode: 'gratitude',
        gratitudeMode: 'three',
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };
      feelStamp('gratitude', entryData);

      const docRef = await firestore().collection('journalEntries').add(entryData);

      await markGratDoneToday();
      flashStatus(setGratitudeStatus, 'Saved to your journal.');
      setActivityRefreshTrigger(prev => prev + 1);
      feelOfferAfter('gratitude', docRef.id);

      setGratitude1('');
      setGratitude2('');
      setGratitude3('');
    } catch (error: any) {
      console.error('Error saving gratitude:', error);
      flashStatus(setGratitudeStatus, 'Save failed. Please try again.');
    } finally {
      setSavingGratitude(false);
    }
  };

  // ==================== GRATITUDE PRACTICE SAVE (deep/subtraction/letter/savor) ====================
  // Entry shapes ported verbatim from web saveGratitudePractice (app.html)
  const handleSaveGratitudePractice = async (mode: Exclude<GratPractice, 'three'>) => {
    const fieldMap: Record<string, string> = {
      deep: gratDeepText,
      subtraction: gratSubtractionText,
      letter: gratLetterText,
      savor: gratSavorText,
    };
    const text = fieldMap[mode]?.trim();
    if (!text) {
      flashStatus(setGratitudeStatus, 'Please write a little first.');
      return;
    }
    const to = mode === 'letter' ? gratLetterTo.trim() || 'someone' : null;

    setSavingGratitude(true);
    try {
      const user = auth().currentUser;
      if (!user) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }
      const today = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const meta = {
        deep: {title: `Gratitude, Deeply - ${today}`, text: `One gratitude, deeply:\n\n${text}`, tag: 'deep'},
        subtraction: {
          title: `Mental Subtraction - ${today}`,
          text: `Imagining life without it:\n\n${gratSubtractionPrompt}\n\n${text}`,
          tag: 'subtraction',
        },
        letter: {title: `Gratitude Letter to ${to} - ${today}`, text: `Gratitude letter to ${to}:\n\n${text}`, tag: 'letter'},
        savor: {title: `Savoring - ${today}`, text: `Savoring the moment:\n\n${text}`, tag: 'savoring'},
      }[mode];

      const entryData: any = {
        userId: user.uid,
        text: meta.text,
        title: meta.title,
        mood: '🙏',
        tags: ['gratitude', meta.tag],
        entryMode: 'gratitude',
        gratitudeMode: mode,
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };
      feelStamp('gratitude', entryData);

      const docRef = await firestore().collection('journalEntries').add(entryData);
      feelOfferAfter('gratitude', docRef.id);

      if (mode === 'deep') setGratDeepText('');
      if (mode === 'subtraction') setGratSubtractionText('');
      if (mode === 'letter') {
        setGratLetterText('');
        setGratLetterTo('');
      }
      if (mode === 'savor') setGratSavorText('');

      await markGratDoneToday();
      flashStatus(setGratitudeStatus, 'Saved to your journal.');
      setActivityRefreshTrigger(prev => prev + 1);
    } catch (e) {
      console.error('Gratitude practice save failed:', e);
      flashStatus(setGratitudeStatus, 'Save failed. Please try again.');
    } finally {
      setSavingGratitude(false);
    }
  };

  // Sophy letter drafting (Plus) — mirrors web sophyLetterAssist
  const handleSophyLetterAssist = async () => {
    const notes = gratLetterText.trim();
    if (notes.length < 5) {
      flashStatus(
        setGratitudeStatus,
        'Jot a few rough notes in the letter box first — who they are, what they did, what it meant.',
        5000,
      );
      return;
    }
    setLetterAssistLoading(true);
    setGratitudeStatus('Sophy is drafting...');
    try {
      const r = await gratEngineFetch({
        action: 'letterAssist',
        notes,
        recipientName: gratLetterTo.trim(),
      });
      if (r.status === 403 && r.data.code === 'UPGRADE_REQUIRED') {
        flashStatus(setGratitudeStatus, 'Sophy letter drafting is an InkWell Plus feature.', 4000);
        checkFeatureAndShowPaywall('ai');
        return;
      }
      if (r.ok && r.data.draft) {
        setGratLetterText(r.data.draft);
        flashStatus(setGratitudeStatus, 'Draft ready — make it yours before saving.', 4000);
        return;
      }
      flashStatus(setGratitudeStatus, r.data.error || 'Sophy could not draft right now.');
    } catch (e) {
      console.error('letterAssist failed:', e);
      flashStatus(setGratitudeStatus, 'Sophy could not draft right now.');
    } finally {
      setLetterAssistLoading(false);
    }
  };

  // Copy the letter — mirrors web copyGratitudeLetter
  const handleCopyGratitudeLetter = () => {
    const t = gratLetterText.trim();
    if (!t) return;
    Clipboard.setString(t);
    flashStatus(setGratitudeStatus, 'Copied.', 2000);
  };

  // Email the letter to yourself — mirrors web emailGratitudeLetterToSelf (mailto fallback)
  const handleEmailLetterToSelf = async () => {
    const t = gratLetterText.trim();
    if (!t) return;
    const to = gratLetterTo.trim();
    setGratitudeStatus('Sending to your email...');
    try {
      const r = await gratEngineFetch({action: 'emailLetter', letterText: t, recipientName: to});
      if (r.ok && r.data.sent) {
        flashStatus(setGratitudeStatus, 'Sent to your email.');
        return;
      }
      throw new Error(r.data.error || 'send failed');
    } catch (e: any) {
      console.warn('emailLetter fell back to mailto:', e.message);
      const email = auth().currentUser?.email || '';
      const url =
        'mailto:' +
        encodeURIComponent(email) +
        '?subject=' +
        encodeURIComponent('Gratitude letter' + (to ? ' to ' + to : '')) +
        '&body=' +
        encodeURIComponent(t);
      Linking.openURL(url).catch(() => flashStatus(setGratitudeStatus, 'Could not open your mail app.'));
      setGratitudeStatus('');
    }
  };

  // Personalized subtraction prompt from the user's journal (Plus) — mirrors web
  const handlePersonalSubtractionPrompt = async () => {
    setPersonalizingPrompt(true);
    try {
      const r = await gratEngineFetch({action: 'personalSubtraction'});
      if (r.status === 403 && r.data.code === 'UPGRADE_REQUIRED') {
        flashStatus(setGratitudeStatus, 'Personalized practice is an InkWell Plus feature.', 4000);
        checkFeatureAndShowPaywall('ai');
        return;
      }
      if (r.ok && r.data.code === 'NOT_ENOUGH_HISTORY') {
        flashStatus(setGratitudeStatus, r.data.message, 4000);
        return;
      }
      if (r.ok && r.data.prompt) {
        setGratSubtractionPrompt(String(r.data.prompt));
        flashStatus(setGratitudeStatus, 'From your own journal.');
        return;
      }
      flashStatus(setGratitudeStatus, r.data.error || 'Could not personalize right now.');
    } catch (e) {
      console.error('personalSubtraction failed:', e);
      flashStatus(setGratitudeStatus, 'Could not personalize right now.');
    } finally {
      setPersonalizingPrompt(false);
    }
  };

  // ==================== FEEL CHECK (stamp / offer-after / and-now) ====================
  // Mirrors web FeelCheck: stamp feelBefore onto the entry at save; after a
  // successful save, offer "And now?" for 30s; tap writes feelAfter to the doc.
  const feelStamp = (key: FeelKey, entryData: any) => {
    if (feelBefore[key]) {
      entryData.feelBefore = feelBefore[key];
    }
    return entryData;
  };

  const feelOfferAfter = (key: FeelKey, entryId: string) => {
    if (!feelBefore[key]) return;
    setFeelAfterPrompt({key, entryId});
    setFeelBefore(prev => ({...prev, [key]: 0}));
    setTimeout(() => {
      setFeelAfterPrompt(prev => (prev?.entryId === entryId ? null : prev));
    }, 30000);
  };

  const handleFeelAfterTap = async (n: number) => {
    const target = feelAfterPrompt;
    if (!target) return;
    try {
      await firestore().collection('journalEntries').doc(target.entryId).update({feelAfter: n});
    } catch (e) {
      console.warn('feelAfter write failed:', e);
    }
    setFeelAfterPrompt(null);
    setFeelNoted(target.key);
    setTimeout(() => setFeelNoted(prev => (prev === target.key ? null : prev)), 6000);
  };

  // ==================== SPRINT TIMER ====================
  const stopSprintTimer = useCallback(
    (resetLabel: boolean) => {
      setSprintRunning(false);
      sprintEndsAtRef.current = null;
      setSprintIdle(false);
      if (resetLabel) {
        setSprintDisplay(`${sprintMinutes}:00`);
      }
    },
    [sprintMinutes],
  );

  const toggleSprint = () => {
    if (sprintRunning) {
      stopSprintTimer(true);
      return;
    }
    sprintEndsAtRef.current = Date.now() + sprintMinutes * 60000;
    sprintLastKeyRef.current = Date.now();
    setSprintRunning(true);
  };

  const handleSetSprintDuration = (mins: 15 | 20) => {
    if (sprintRunning) return; // no switching mid-sprint
    setSprintMinutes(mins);
    setSprintDisplay(`${mins}:00`);
  };

  // Countdown + idle detection (gentle nudge after ~20s of stillness)
  useEffect(() => {
    if (!sprintRunning) return;
    const tick = () => {
      const endsAt = sprintEndsAtRef.current;
      if (!endsAt) return;
      const left = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      const m = Math.floor(left / 60);
      const s = String(left % 60).padStart(2, '0');
      setSprintDisplay(`${m}:${s}`);
      setSprintIdle(Date.now() - sprintLastKeyRef.current > 20000);
      if (left === 0) {
        stopSprintTimer(false);
        setSprintDisplay('Time. Keep going or save. Both count.');
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [sprintRunning, stopSprintTimer]);

  // Breathing teal edge cue while the writer is still (adaptation of the web
  // whole-screen vignette — same rhythm, opacity loop on a border frame)
  useEffect(() => {
    if (sprintRunning && sprintIdle) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(sprintBreath, {toValue: 1, duration: 3000, useNativeDriver: true}),
          Animated.timing(sprintBreath, {toValue: 0, duration: 3000, useNativeDriver: true}),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
    sprintBreath.setValue(0);
  }, [sprintRunning, sprintIdle, sprintBreath]);

  const handleSprintInput = (text: string) => {
    setSprintText(text);
    sprintLastKeyRef.current = Date.now();
    if (sprintIdle) {
      setSprintIdle(false);
    }
  };

  // ==================== SPRINT SAVE ====================
  // Entry shape ported verbatim from web saveSprintEntry (app.html)
  const handleSaveSprint = async () => {
    const text = sprintText.trim();
    if (!text) {
      flashStatus(setSprintStatus, 'Write first, save after.');
      return;
    }

    setSavingSprint(true);
    try {
      const user = auth().currentUser;
      if (!user) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }
      const today = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const entryData: any = {
        userId: user.uid,
        text: `Writing sprint (${sprintMinutes} min):\n\n${text}`,
        title: `Writing Sprint - ${today}`,
        mood: '⏱️',
        tags: ['sprint'],
        entryMode: 'journal',
        sprintMinutes: sprintMinutes,
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };

      await firestore().collection('journalEntries').add(entryData);

      setSprintText('');
      stopSprintTimer(true);
      flashStatus(setSprintStatus, 'Sprint saved to your journal.');
      setActivityRefreshTrigger(prev => prev + 1);
    } catch (e) {
      console.error('Sprint save failed:', e);
      flashStatus(setSprintStatus, 'Save failed. Your writing is still here — try again.');
    } finally {
      setSavingSprint(false);
    }
  };

  // ==================== INKBLOT SAVE ====================
  const handleSaveInkblot = async () => {
    if (!inkblotText.trim()) {
      flashStatus(setInkblotStatus, 'Please enter a thought first.');
      return;
    }

    setSavingInkblot(true);
    try {
      const user = auth().currentUser;
      if (!user) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      // Entry shape mirrors web saveInkblotEntry (app.html)
      const today = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const time = new Date().toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit'});

      const entryData: any = {
        userId: user.uid,
        text: `${inkblotText.trim()}`,
        title: `InkBlot - ${today} at ${time}`,
        mood: '⚡',
        tags: ['inkblot', 'quick'],
        entryMode: 'inkblot',
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };

      await firestore().collection('journalEntries').add(entryData);

      flashStatus(setInkblotStatus, 'Saved to your journal.');
      setActivityRefreshTrigger(prev => prev + 1);
      setInkblotText('');
    } catch (error: any) {
      console.error('Error saving InkBlot:', error);
      flashStatus(setInkblotStatus, 'Save failed. Please try again.');
    } finally {
      setSavingInkblot(false);
    }
  };

  // ==================== INKBLOT VOICE ====================
  const handleInkblotVoiceToggle = async () => {
    if (!Voice) {
      Alert.alert('Voice Unavailable', 'Voice recognition is not available on this device.');
      return;
    }

    if (inkblotRecording) {
      try {
        await Voice.stop();
        setInkblotRecording(false);
        const recognizedText = voiceText || voicePartialText;
        if (recognizedText && recognizedText.trim().length > 0) {
          setInkblotText(prev => prev + (prev ? ' ' : '') + recognizedText.trim());
        }
        setVoiceText('');
        setVoicePartialText('');
      } catch (error) {
        console.error('Stop recording error:', error);
        setInkblotRecording(false);
      }
    } else {
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) {
        Alert.alert('Permission Denied', 'Microphone access is required for voice input.');
        return;
      }
      try {
        setVoiceText('');
        setVoicePartialText('');
        await Voice.start('en-US');
        setInkblotRecording(true);
      } catch (error: any) {
        console.error('Voice start error:', error);
        Alert.alert('Voice Recognition Failed', 'Could not start voice recognition.');
      }
    }
  };

  // ==================== derived display bits ====================
  const dateLine = new Date()
    .toLocaleDateString('en-US', {weekday: 'long', month: 'long', day: 'numeric'})
    .toUpperCase();

  const wordCount = journalEntry.trim() ? journalEntry.trim().split(/\s+/).filter(Boolean).length : 0;

  const quickChips = userTagLibrary.filter(t => !entryTags.includes(t)).slice(0, 8);

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoid}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={getKeyboardVerticalOffset(true)}>
      {/* ─── Identity bar: wordmark + week dots (mockup nav, slimmed) ─── */}
      <View style={[styles.identityBar, {paddingTop: insets.top + spacing.sm}]}>
        <Text style={styles.wordmark}>
          Ink<Text style={styles.wordmarkAccent}>Well</Text>
        </Text>
        <View style={styles.identityRight}>
          <WeeklyActivityDots refreshTrigger={activityRefreshTrigger} />
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
          {/* ─── Date-line + the big serif question ─── */}
          <Text style={styles.dateLine}>{dateLine}</Text>
          <Text style={styles.question}>
            What's taking up <Text style={styles.questionEm}>space</Text> today?
          </Text>

          {/* ─── First steps: event-driven quest for new users ─── */}
          <FirstStepsCard onGo={handleFirstStepGo} />

          {/* ─── Mode pills: Full Journal (default) / InkBlot / Gratitude ─── */}
          <View style={styles.pillRow}>
            <Pill label="Full Journal" active={activeMode === 'full'} onPress={() => setActiveMode('full')} />
            <Pill label="InkBlot" active={activeMode === 'inkblot'} onPress={() => setActiveMode('inkblot')} />
            <Pill
              label="Gratitude"
              active={activeMode === 'gratitude'}
              onPress={() => setActiveMode('gratitude')}
              showDot={!gratDoneToday}
            />
          </View>

          {/* ================== FULL JOURNAL MODE ================== */}
          {activeMode === 'full' && (
            <View>
              {/* Journal practices: Free-write / Reframe */}
              <View style={styles.pillRowCentered}>
                <Pill
                  label="Free-write"
                  active={journalPractice === 'free'}
                  onPress={() => setJournalPractice('free')}
                />
                <Pill
                  label="Reframe"
                  active={journalPractice === 'reframe'}
                  onPress={() => setJournalPractice('reframe')}
                />
              </View>

              {/* ═══ Reframe (perspective practice — wellness-framed) ═══ */}
              {journalPractice === 'reframe' && (
                <View>
                  <FeelCheckRow
                    question="How heavy does it feel right now?"
                    selected={feelBefore.reframe}
                    onTap={n => setFeelBefore(prev => ({...prev, reframe: n}))}
                    colors={colors}
                  />
                  <Text style={styles.gratIntroLine}>Four short steps to look at one moment from a second angle.</Text>

                  <Text style={styles.reframeLabel}>1. What happened? Just the facts.</Text>
                  <TextInput
                    style={styles.reframeInput}
                    placeholder="Who, what, where. No interpretation yet."
                    placeholderTextColor={colors.fontMuted}
                    value={reframe1}
                    onChangeText={setReframe1}
                    multiline
                    textAlignVertical="top"
                  />

                  <Text style={styles.reframeLabel}>2. What did your mind make it mean?</Text>
                  <TextInput
                    style={styles.reframeInput}
                    placeholder="The automatic read. Write it the way it sounded in your head."
                    placeholderTextColor={colors.fontMuted}
                    value={reframe2}
                    onChangeText={setReframe2}
                    multiline
                    textAlignVertical="top"
                  />

                  <Text style={styles.reframeLabel}>3. What supports that read, and what doesn't?</Text>
                  <TextInput
                    style={styles.reframeInput}
                    placeholder="Evidence both ways. Be a fair judge."
                    placeholderTextColor={colors.fontMuted}
                    value={reframe3}
                    onChangeText={setReframe3}
                    multiline
                    textAlignVertical="top"
                  />

                  <Text style={styles.reframeLabel}>4. Another honest way to see it?</Text>
                  <TextInput
                    style={styles.reframeInput}
                    placeholder="Not forced positivity. Just a read that fits the facts at least as well."
                    placeholderTextColor={colors.fontMuted}
                    value={reframe4}
                    onChangeText={setReframe4}
                    multiline
                    textAlignVertical="top"
                  />

                  <IWButton
                    title="Save Reframe"
                    onPress={handleSaveReframe}
                    loading={savingReframe}
                    style={styles.modeSaveButton}
                  />
                  {reframeStatus ? <Text style={styles.saveStatus}>{reframeStatus}</Text> : null}
                  {feelAfterPrompt?.key === 'reframe' && (
                    <FeelCheckRow question="And now?" selected={0} onTap={handleFeelAfterTap} colors={colors} />
                  )}
                  {feelNoted === 'reframe' && (
                    <Text style={[feelStyles.noted, {color: colors.fontSecondary, textAlign: 'center'}]}>
                      Noted. The shift is yours.
                    </Text>
                  )}
                </View>
              )}

              {journalPractice === 'free' && (
              <View>
              {/* Sophy: prompt block — everything of hers inside her tint */}
              <SophyBlock line="Want a place to start? Give me a topic, or let me pick a thread.">
                <TextInput
                  style={styles.sophyField}
                  placeholder="a topic, or leave it to Sophy"
                  placeholderTextColor={colors.fontMuted}
                  value={promptTopic}
                  onChangeText={setPromptTopic}
                />
                <IWButton
                  voice="sophy"
                  small
                  title="Ask for a prompt"
                  onPress={handleGeneratePrompt}
                  loading={generatingPrompt}
                  style={styles.sophyAction}
                />
                {generatedPrompt ? <Text style={styles.sophyOutput}>{generatedPrompt}</Text> : null}
                {generatedPrompt ? (
                  <TouchableOpacity
                    style={styles.checkRow}
                    onPress={() => {
                      const newChecked = !savePromptChecked;
                      setSavePromptChecked(newChecked);
                      if (newChecked && generatedPrompt) {
                        setJournalEntry(prev => {
                          const prefix = prev.trim() ? prev + '\n\n' : '';
                          return prefix + `Prompt: ${generatedPrompt}`;
                        });
                      }
                    }}>
                    <View style={[styles.checkbox, savePromptChecked && styles.checkboxChecked]}>
                      {savePromptChecked && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={styles.checkLabel}>Save this Prompt in my Journal Entry</Text>
                  </TouchableOpacity>
                ) : null}
              </SophyBlock>

              {/* Mic pill, right-aligned above the sheet */}
              <View style={styles.micRow}>
                <Pill
                  label={isRecording ? 'Stop listening' : 'Speak it instead'}
                  active={isRecording}
                  onPress={handleVoiceToggle}
                />
              </View>
              {voiceStatus ? <Text style={styles.inlineStatus}>{voiceStatus}</Text> : null}
              {isRecording && voicePartialText ? (
                <Text style={styles.voicePartialText}>"{voicePartialText}"</Text>
              ) : null}
              {!isPremium && !isRecording ? (
                <Text style={styles.voiceHintPlus}>Plus adds AI grammar cleanup and emotional reflection.</Text>
              ) : null}

              {/* The writing sheet — the words own the screen */}
              <CoachHint markId="textarea" text="Start anywhere. One sentence counts." />
              <Card style={styles.sheet} padded={false}>
                <TextInput
                  style={styles.sheetInput}
                  placeholder="or write your thoughts here..."
                  placeholderTextColor={colors.fontMuted}
                  value={journalEntry}
                  onChangeText={t => {
                    setJournalEntry(t);
                    if (t.trim()) {
                      FirstStepsService.complete('write');
                    }
                  }}
                  multiline
                  textAlignVertical="top"
                  editable={!saving}
                />
                <View style={styles.sheetFoot}>
                  <Text style={styles.wordCount}>
                    {wordCount} {wordCount === 1 ? 'WORD' : 'WORDS'}
                  </Text>
                </View>
              </Card>

              {/* Emotional insights (Plus voice analysis) */}
              {emotionalInsights && (
                <Card style={styles.insightsCard}>
                  <Text style={styles.insightsTitle}>Voice analysis</Text>
                  <View style={styles.insightsRow}>
                    <View style={styles.insightsChip}>
                      <Text style={styles.insightsLabel}>Tone</Text>
                      <Text style={styles.insightsValue}>
                        {emotionalInsights.primaryEmotion || 'Detected'}
                        {emotionalInsights.confidence ? ` (${emotionalInsights.confidence}%)` : ''}
                      </Text>
                    </View>
                    <View style={styles.insightsChip}>
                      <Text style={styles.insightsLabel}>Energy</Text>
                      <Text style={styles.insightsValue}>{emotionalInsights.energyLevel || 'Normal'}</Text>
                    </View>
                    <View style={styles.insightsChip}>
                      <Text style={styles.insightsLabel}>Stress</Text>
                      <Text style={styles.insightsValue}>{emotionalInsights.stressLevel || 'Normal'}</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.insightsDismiss} onPress={() => setEmotionalInsights(null)}>
                    <Text style={styles.insightsDismissText}>Dismiss</Text>
                  </TouchableOpacity>
                </Card>
              )}

              {/* Sophy: reflection block */}
              <SophyBlock line="When you're done writing, I can reflect it back to you." style={styles.reflectionBlock}>
                <IWButton
                  voice="sophy"
                  small
                  title="Ask for Reflection"
                  onPress={handleGetReflection}
                  loading={generatingReflection}
                  disabled={!journalEntry.trim()}
                  style={styles.sophyAction}
                />
                {sophyReflection ? <Text style={styles.sophyOutput}>{sophyReflection}</Text> : null}
                {sophyReflection ? (
                  <TouchableOpacity
                    style={styles.checkRow}
                    onPress={() => {
                      const newChecked = !saveReflectionChecked;
                      setSaveReflectionChecked(newChecked);
                      if (newChecked && sophyReflection) {
                        setJournalEntry(prev => {
                          const prefix = prev.trim() ? prev + '\n\n' : '';
                          return prefix + `Sophy's Reflection: ${sophyReflection}`;
                        });
                      }
                    }}>
                    <View style={[styles.checkbox, saveReflectionChecked && styles.checkboxChecked]}>
                      {saveReflectionChecked && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={styles.checkLabel}>Save this Reflection in my Journal Entry</Text>
                  </TouchableOpacity>
                ) : null}
              </SophyBlock>

              <Divider />

              {/* Attachments */}
              <View style={styles.sectionLabelRow}>
                <Text style={styles.sectionLabel}>Attach photos or files</Text>
                {!isPremium && (
                  <View style={styles.plusBadge}>
                    <Text style={styles.plusBadgeText}>Plus</Text>
                  </View>
                )}
              </View>
              <IWButton
                voice="gray"
                title={uploadingFiles ? 'Uploading...' : isPremium ? 'Add photos or files' : 'Attach files with Plus'}
                onPress={handlePickFiles}
                disabled={uploadingFiles}
                style={styles.attachButton}
              />

              {attachments.length > 0 && (
                <View style={styles.attachmentPreview}>
                  {attachments.map((file, index) => (
                    <View key={index} style={styles.attachmentItem}>
                      {file.type?.startsWith('image/') ? (
                        <Image source={{uri: file.uri}} style={styles.attachmentImage} resizeMode="cover" />
                      ) : (
                        <View style={styles.attachmentFileIcon}>
                          <Text style={styles.fileIconText}>FILE</Text>
                        </View>
                      )}
                      <View style={styles.attachmentInfo}>
                        <Text style={styles.attachmentName} numberOfLines={1}>
                          {file.name}
                        </Text>
                        <Text style={styles.attachmentSize}>{(file.size / 1024).toFixed(1)} KB</Text>
                      </View>
                      <TouchableOpacity onPress={() => handleRemoveAttachment(index)} style={styles.removeButton}>
                        <Text style={styles.removeButtonText}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <Divider />

              {/* Tags */}
              <TouchableOpacity style={styles.collapsibleHeader} onPress={() => setShowTagInput(!showTagInput)}>
                <Text style={styles.collapsibleHeaderText}>Add Tags</Text>
                <Text style={styles.collapsibleToggle}>{showTagInput ? '▴' : '▾'}</Text>
              </TouchableOpacity>

              {showTagInput && (
                <View style={styles.tagSection}>
                  {/* One-tap chips from your existing tag library */}
                  {quickChips.length > 0 && (
                    <View style={styles.tagChipsContainer}>
                      {quickChips.map(tag => (
                        <TouchableOpacity key={tag} style={styles.tagQuickChip} onPress={() => addTag(tag)}>
                          <Text style={styles.tagQuickChipText}>{tag}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {entryTags.length > 0 && (
                    <View style={styles.tagChipsContainer}>
                      {entryTags.map(tag => (
                        <View key={tag} style={styles.tagChip}>
                          <Text style={styles.tagChipText}>{tag}</Text>
                          <TouchableOpacity onPress={() => removeTag(tag)}>
                            <Text style={styles.tagChipRemove}>×</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={styles.tagInputRow}>
                    <TextInput
                      style={styles.tagInputField}
                      value={tagInput}
                      onChangeText={setTagInput}
                      placeholder="Type to add a tag..."
                      placeholderTextColor={colors.fontMuted}
                      onSubmitEditing={() => addTag(tagInput)}
                      returnKeyType="done"
                    />
                    <IWButton voice="gray" small title="Add" onPress={() => addTag(tagInput)} />
                  </View>

                  {tagInput.length > 0 &&
                    userTagLibrary.filter(t => t.includes(tagInput.toLowerCase()) && !entryTags.includes(t)).length > 0 && (
                      <View style={styles.tagSuggestions}>
                        {userTagLibrary
                          .filter(t => t.includes(tagInput.toLowerCase()) && !entryTags.includes(t))
                          .slice(0, 5)
                          .map(tag => (
                            <TouchableOpacity key={tag} style={styles.tagSuggestionItem} onPress={() => addTag(tag)}>
                              <Text style={styles.tagSuggestionText}>{tag}</Text>
                            </TouchableOpacity>
                          ))}
                      </View>
                    )}
                </View>
              )}

              <Divider />

              {/* Save */}
              <IWButton title="Save Journal Entry" onPress={handleSave} loading={saving} />
              {journalStatus ? <Text style={styles.saveStatus}>{journalStatus}</Text> : null}
              <Text style={styles.helpText}>Your journal entries are private and only visible to you.</Text>
              </View>
              )}
            </View>
          )}

          {/* ================== GRATITUDE MODE ================== */}
          {activeMode === 'gratitude' && (
            <View>
              <TouchableOpacity onPress={() => setShowGratitudeInfo(true)}>
                <Text style={styles.modeTitle}>What are you grateful for today?</Text>
              </TouchableOpacity>
              <Text style={styles.modeSubtitle}>{GRATITUDE_SUBTEXT[activeGratPractice]}</Text>

              <FeelCheckRow
                question="How heavy does it feel right now?"
                selected={feelBefore.gratitude}
                onTap={n => setFeelBefore(prev => ({...prev, gratitude: n}))}
                colors={colors}
              />

              {/* Practice pills — the protocol engine (5 practices, suggested one wears the dot) */}
              <View style={styles.pillRowCentered}>
                <Pill
                  label="Three"
                  active={activeGratPractice === 'three'}
                  onPress={() => switchGratPractice('three')}
                />
                <Pill
                  label="One, Deeply"
                  active={activeGratPractice === 'deep'}
                  onPress={() => switchGratPractice('deep')}
                  showDot={suggestedPractice === 'deep'}
                />
                <Pill
                  label="Without It"
                  active={activeGratPractice === 'subtraction'}
                  onPress={() => switchGratPractice('subtraction')}
                  showDot={suggestedPractice === 'subtraction'}
                />
                <Pill
                  label="Letter"
                  active={activeGratPractice === 'letter'}
                  onPress={() => switchGratPractice('letter')}
                  showDot={suggestedPractice === 'letter'}
                />
                <Pill
                  label="Savor"
                  active={activeGratPractice === 'savor'}
                  onPress={() => switchGratPractice('savor')}
                  showDot={suggestedPractice === 'savor'}
                />
              </View>

              {/* ═══ Three (Emmons & McCullough 2003) ═══ */}
              {activeGratPractice === 'three' && (
                <View>
                  {[
                    {n: '1.', value: gratitude1, set: setGratitude1},
                    {n: '2.', value: gratitude2, set: setGratitude2},
                    {n: '3.', value: gratitude3, set: setGratitude3},
                  ].map(item => (
                    <View key={item.n} style={styles.gratitudeInputContainer}>
                      <Text style={styles.gratitudeNumber}>{item.n}</Text>
                      <TextInput
                        style={styles.gratitudeInput}
                        placeholder="I'm grateful for..."
                        placeholderTextColor={colors.fontMuted}
                        value={item.value}
                        onChangeText={item.set}
                        multiline
                      />
                    </View>
                  ))}
                  <IWButton
                    title="Save Gratitude Entry"
                    onPress={handleSaveGratitude}
                    loading={savingGratitude}
                    disabled={!gratitude1.trim() && !gratitude2.trim() && !gratitude3.trim()}
                    style={styles.modeSaveButton}
                  />
                </View>
              )}

              {/* ═══ One, Deeply (Seligman et al. 2005) ═══ */}
              {activeGratPractice === 'deep' && (
                <View>
                  <Text style={styles.gratIntroLine}>
                    What happened? · Why did it happen? · What was your part in it?
                  </Text>
                  <TextInput
                    style={styles.gratTextarea}
                    placeholder="One good thing, in depth..."
                    placeholderTextColor={colors.fontMuted}
                    value={gratDeepText}
                    onChangeText={setGratDeepText}
                    multiline
                    textAlignVertical="top"
                  />
                  <IWButton
                    title="Save Reflection"
                    onPress={() => handleSaveGratitudePractice('deep')}
                    loading={savingGratitude}
                    style={styles.modeSaveButton}
                  />
                </View>
              )}

              {/* ═══ Without It (mental subtraction — Koo et al. 2008) ═══ */}
              {activeGratPractice === 'subtraction' && (
                <View>
                  <View style={styles.gratPromptCard}>
                    <Text style={styles.gratPromptText}>{gratSubtractionPrompt}</Text>
                  </View>
                  <View style={styles.gratRowButtons}>
                    <IWButton voice="gray" small title="Try another" onPress={shuffleSubtractionPrompt} />
                    <IWButton
                      voice="sophy"
                      small
                      title="From your journal"
                      onPress={handlePersonalSubtractionPrompt}
                      loading={personalizingPrompt}
                    />
                  </View>
                  <TextInput
                    style={styles.gratTextarea}
                    placeholder="Write what would be missing..."
                    placeholderTextColor={colors.fontMuted}
                    value={gratSubtractionText}
                    onChangeText={setGratSubtractionText}
                    multiline
                    textAlignVertical="top"
                  />
                  <IWButton
                    title="Save Reflection"
                    onPress={() => handleSaveGratitudePractice('subtraction')}
                    loading={savingGratitude}
                    style={styles.modeSaveButton}
                  />
                </View>
              )}

              {/* ═══ Letter (gratitude visit — Seligman et al. 2005, largest effect size) ═══ */}
              {activeGratPractice === 'letter' && (
                <View>
                  <TextInput
                    style={styles.letterToInput}
                    placeholder="To (their name)..."
                    placeholderTextColor={colors.fontMuted}
                    value={gratLetterTo}
                    onChangeText={setGratLetterTo}
                  />
                  <TextInput
                    style={[styles.gratTextarea, styles.letterTextarea]}
                    placeholder="Dear ___ , what did they do? What did it cost them? What did it change for you? Be specific. The details carry the gratitude."
                    placeholderTextColor={colors.fontMuted}
                    value={gratLetterText}
                    onChangeText={setGratLetterText}
                    multiline
                    textAlignVertical="top"
                  />
                  <View style={styles.gratRowButtons}>
                    <IWButton
                      title="Save Letter"
                      onPress={() => handleSaveGratitudePractice('letter')}
                      loading={savingGratitude}
                      style={styles.letterSaveButton}
                    />
                    <IWButton
                      voice="sophy"
                      small
                      title="Ask Sophy for help"
                      onPress={handleSophyLetterAssist}
                      loading={letterAssistLoading}
                    />
                    <IWButton voice="gray" small title="Copy" onPress={handleCopyGratitudeLetter} />
                    <IWButton voice="gray" small title="Email me" onPress={handleEmailLetterToSelf} />
                  </View>
                  <Text style={styles.helpText}>Sending is optional. Writing it is where the effect lives.</Text>
                </View>
              )}

              {/* ═══ Savor (Bryant & Veroff 2007) ═══ */}
              {activeGratPractice === 'savor' && (
                <View>
                  {gratSavorNudge ? <Text style={styles.savorNudge}>{gratSavorNudge}</Text> : null}
                  <TextInput
                    style={styles.gratTextarea}
                    placeholder="One good moment from today, in full sensory detail..."
                    placeholderTextColor={colors.fontMuted}
                    value={gratSavorText}
                    onChangeText={setGratSavorText}
                    multiline
                    textAlignVertical="top"
                  />
                  <IWButton
                    title="Save Moment"
                    onPress={() => handleSaveGratitudePractice('savor')}
                    loading={savingGratitude}
                    style={styles.modeSaveButton}
                  />
                </View>
              )}

              {gratitudeStatus ? <Text style={styles.saveStatus}>{gratitudeStatus}</Text> : null}
              {feelAfterPrompt?.key === 'gratitude' && (
                <FeelCheckRow question="And now?" selected={0} onTap={handleFeelAfterTap} colors={colors} />
              )}
              {feelNoted === 'gratitude' && (
                <Text style={[feelStyles.noted, {color: colors.fontSecondary, textAlign: 'center'}]}>
                  Noted. The shift is yours.
                </Text>
              )}
              <Text style={styles.helpText}>
                Your gratitude entries are saved to your journal and visible in Past Entries.
              </Text>
            </View>
          )}

          {/* ================== INKBLOT MODE ================== */}
          {activeMode === 'inkblot' && (
            <View>
              <TouchableOpacity onPress={() => setShowInkblotInfo(true)} disabled={blotPractice === 'sprint'}>
                <Text style={styles.modeTitle}>
                  {blotPractice === 'sprint' ? 'Write through it.' : 'Quick thought? Drop an InkBlot.'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.modeSubtitle}>
                {blotPractice === 'sprint'
                  ? 'A timed, continuous write about whatever is taking up space.'
                  : 'Capture a moment, feeling, or fleeting thought in seconds.'}
              </Text>

              {/* Two-speed InkBlot: Capture / Sprint */}
              <View style={styles.pillRowCentered}>
                <Pill
                  label="Capture"
                  active={blotPractice === 'capture'}
                  onPress={() => {
                    // Web parity: leaving Sprint stops the timer
                    stopSprintTimer(false);
                    setBlotPractice('capture');
                  }}
                />
                <Pill
                  label="Sprint"
                  active={blotPractice === 'sprint'}
                  onPress={() => setBlotPractice('sprint')}
                />
              </View>

              {/* ═══ Capture ═══ */}
              {blotPractice === 'capture' && (
                <View>
                  <Card style={styles.sheet} padded={false}>
                    <TextInput
                      style={[styles.sheetInput, styles.inkblotInput]}
                      placeholder="What's on your mind right now?"
                      placeholderTextColor={colors.fontMuted}
                      value={inkblotText}
                      onChangeText={setInkblotText}
                      multiline
                      textAlignVertical="top"
                      maxLength={500}
                    />
                    <View style={styles.sheetFoot}>
                      <Text style={styles.wordCount}>{inkblotText.length}/500 characters</Text>
                    </View>
                  </Card>

                  <View style={styles.micRow}>
                    <Pill
                      label={inkblotRecording ? 'Stop listening' : 'Speak Your InkBlot'}
                      active={inkblotRecording}
                      onPress={handleInkblotVoiceToggle}
                    />
                  </View>
                  {inkblotRecording && <Text style={styles.inlineStatus}>Listening... speak now.</Text>}

                  <IWButton
                    title="Save InkBlot"
                    onPress={handleSaveInkblot}
                    loading={savingInkblot}
                    disabled={!inkblotText.trim()}
                    style={styles.modeSaveButton}
                  />
                  {inkblotStatus ? <Text style={styles.saveStatus}>{inkblotStatus}</Text> : null}
                  <Text style={styles.helpText}>InkBlots are quick journal entries — perfect for busy days.</Text>
                </View>
              )}

              {/* ═══ Sprint (Pennebaker expressive writing; Frattaroli 2006) ═══ */}
              {blotPractice === 'sprint' && (
                <View>
                  <Text style={styles.gratIntroLine}>
                    Writing about hard things can stir them up before it settles them. That's normal, and it's part
                    of how this works. Go at your own depth.
                  </Text>

                  <View style={styles.sprintControls}>
                    <Pill
                      label="15 min"
                      active={sprintMinutes === 15}
                      onPress={() => handleSetSprintDuration(15)}
                    />
                    <Pill
                      label="20 min"
                      active={sprintMinutes === 20}
                      onPress={() => handleSetSprintDuration(20)}
                    />
                    <IWButton
                      small
                      title={sprintRunning ? 'Stop' : 'Start'}
                      onPress={toggleSprint}
                    />
                  </View>

                  {(sprintRunning || sprintDisplay.startsWith('Time.')) && (
                    <Text style={styles.sprintTimer}>{sprintDisplay}</Text>
                  )}
                  {sprintRunning && sprintIdle && (
                    <Text style={styles.sprintNudge}>Keep the pen moving. Grammar and sense don't matter here.</Text>
                  )}

                  <Card style={styles.sheet} padded={false}>
                    <TextInput
                      style={styles.sheetInput}
                      placeholder="Write continuously about whatever is taking up space. Don't stop to fix anything."
                      placeholderTextColor={colors.fontMuted}
                      value={sprintText}
                      onChangeText={handleSprintInput}
                      multiline
                      textAlignVertical="top"
                    />
                  </Card>

                  <IWButton
                    title="Save Sprint"
                    onPress={handleSaveSprint}
                    loading={savingSprint}
                    disabled={!sprintText.trim()}
                    style={styles.modeSaveButton}
                  />
                  {sprintStatus ? <Text style={styles.saveStatus}>{sprintStatus}</Text> : null}
                  <Text style={styles.helpText}>
                    The research dose is 3 or 4 sprints on the same topic over a week or two. Save early or write
                    past the timer, both are fine.
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Gratitude Info Modal */}
        <InfoModal
          visible={showGratitudeInfo}
          onClose={() => setShowGratitudeInfo(false)}
          title="The Science of Gratitude"
          subtitle="A daily practice that rewires your brain for well-being."
          footerText="Notice. Appreciate. Grow.">
          <InfoSection title="Why Gratitude Works">
            <InfoParagraph>
              Decades of research from positive psychology shows that regularly noting what you're grateful for isn't
              just "thinking happy thoughts"—it physically changes your brain. Studies from UC Davis, UC Berkeley, and
              leading psychology labs have found consistent benefits.
            </InfoParagraph>
          </InfoSection>

          <InfoDivider />

          <InfoSection title="What the Research Shows">
            <InfoHighlightBox title="Neural Rewiring" emoji="🧠">
              Practicing gratitude activates the hypothalamus and dopamine pathways. Over time, your brain becomes
              better at noticing positive experiences—a phenomenon called "neural plasticity."
            </InfoHighlightBox>
            <InfoHighlightBox title="Better Sleep" emoji="😴">
              Studies show that writing down three gratitudes before bed helps people fall asleep faster and sleep
              longer. The mind shifts from rumination to appreciation.
            </InfoHighlightBox>
            <InfoHighlightBox title="Improved Resilience" emoji="💪">
              People who practice gratitude regularly cope better with stress and adversity. They don't ignore
              problems—they develop a more balanced perspective.
            </InfoHighlightBox>
            <InfoHighlightBox title="Stronger Relationships" emoji="❤️">
              Expressing appreciation strengthens social bonds. Grateful people report more satisfying relationships
              and feel more connected to others.
            </InfoHighlightBox>
          </InfoSection>

          <InfoDivider />

          <InfoSection title="Why Three Gratitudes?">
            <InfoParagraph>
              Research by Dr. Robert Emmons found that listing three specific things you're grateful for is the sweet
              spot—enough to create impact without becoming a chore. Specificity matters: "I'm grateful my friend
              texted to check on me" works better than "I'm grateful for friends."
            </InfoParagraph>
          </InfoSection>
        </InfoModal>

        {/* InkBlot Info Modal */}
        <InfoModal
          visible={showInkblotInfo}
          onClose={() => setShowInkblotInfo(false)}
          title="InkBlot: Quick Capture"
          subtitle="Get it out of your head before it disappears."
          footerText="Think it. Capture it. Free yourself.">
          <InfoSection title="The Power of Quick Capture">
            <InfoParagraph>
              Not every thought needs a polished journal entry. InkBlot is for those fleeting ideas, sudden
              realizations, or quick emotional check-ins that deserve to be saved but don't require ceremony.
            </InfoParagraph>
          </InfoSection>

          <InfoDivider />

          <InfoSection title="Why Quick Capture Matters">
            <InfoHighlightBox title="Reduce Cognitive Load" emoji="🧠">
              Psychologist David Allen calls this "closing open loops." When you capture a thought externally, your
              brain can stop holding onto it—freeing mental space for other things.
            </InfoHighlightBox>
            <InfoHighlightBox title="Catch Insights" emoji="💡">
              Research shows we forget up to 40% of new information within 20 minutes. Those shower thoughts, midnight
              realizations, and random connections? Gone unless you capture them quickly.
            </InfoHighlightBox>
            <InfoHighlightBox title="Process Emotions" emoji="🌊">
              Sometimes you just need to name what you're feeling—even if it's just "feeling weird today" or
              "surprisingly hopeful right now." Brief emotional check-ins create self-awareness over time.
            </InfoHighlightBox>
            <InfoHighlightBox title="Build Momentum" emoji="✨">
              A 30-second InkBlot entry is infinitely more valuable than the perfect journal entry you never write.
              Small consistent actions beat sporadic perfection.
            </InfoHighlightBox>
          </InfoSection>

          <InfoDivider />

          <InfoSection title="How to Use InkBlot">
            <InfoParagraph>
              • Type or speak whatever's on your mind (up to 500 characters){'\n'}• Don't overthink it—messy is fine,
              incomplete is fine{'\n'}• Save and move on—you can always revisit in Past Entries
            </InfoParagraph>
            <InfoParagraph>
              Think of InkBlot entries as seeds. Some will grow into bigger reflections later. Others simply needed to
              be planted and acknowledged.
            </InfoParagraph>
          </InfoSection>
        </InfoModal>
      </ScrollView>

      {/* Sprint idle cue: breathing teal edge frame (web vignette adaptation).
          Gated to the sprint surface so the cue never leaks onto other modes. */}
      {activeMode === 'inkblot' && blotPractice === 'sprint' && sprintRunning && sprintIdle && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.sprintBreathFrame,
            {opacity: sprintBreath.interpolate({inputRange: [0, 1], outputRange: [0.15, 0.9]})},
          ]}
        />
      )}

      {/* Paywall Modal */}
      <PaywallModal visible={showPaywall} onClose={closePaywall} />
    </KeyboardAvoidingView>
  );
};

// Dynamic styles based on theme colors
const createStyles = (colors: ThemeColors, isDark: boolean) =>
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

    // ── Identity bar ──
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

    // ── Date-line + question ──
    dateLine: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.xs,
      color: colors.fontMuted,
      letterSpacing: 2,
      marginBottom: spacing.xs,
    },
    question: {
      fontFamily: fontFamily.header,
      fontSize: fontSize.display,
      lineHeight: fontSize.display * 1.18,
      color: colors.fontMain,
      marginBottom: spacing.lg,
    },
    questionEm: {
      fontFamily: fontFamily.headerItalic,
      fontStyle: 'italic',
      color: colors.brandLight,
    },

    // ── Pills ──
    pillRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },

    // ── Sophy surfaces ──
    sophyField: {
      fontFamily: fontFamily.serif,
      backgroundColor: colors.sophyFieldBg,
      borderColor: colors.sophyFieldBorder,
      borderWidth: 1,
      borderRadius: borderRadius.md,
      padding: spacing.base,
      fontSize: fontSize.md,
      color: colors.fontMain,
      marginBottom: spacing.sm,
    },
    sophyAction: {
      alignSelf: 'flex-start',
    },
    sophyOutput: {
      fontFamily: fontFamily.serif,
      fontSize: fontSize.md,
      lineHeight: fontSize.md * 1.6,
      color: colors.fontMain,
      marginTop: spacing.base,
    },
    checkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.base,
      minHeight: 44,
    },
    checkbox: {
      width: 26,
      height: 26,
      borderRadius: borderRadius.sm,
      borderWidth: 2,
      borderColor: colors.sophyBorder,
      marginRight: spacing.sm,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkboxChecked: {
      backgroundColor: colors.sophyAccent,
      borderColor: colors.sophyAccent,
    },
    checkmark: {
      color: colors.fontWhite,
      fontSize: fontSize.sm,
    },
    checkLabel: {
      flex: 1,
      fontFamily: fontFamily.body,
      fontSize: fontSize.sm,
      color: colors.fontSecondary,
    },

    // ── Writing sheet ──
    micRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    sheet: {
      marginBottom: spacing.lg,
    },
    sheetInput: {
      fontFamily: fontFamily.serif,
      fontSize: fontSize.lg,
      lineHeight: fontSize.lg * 1.65,
      color: colors.fontMain,
      minHeight: 260,
      padding: spacing.lg,
      paddingBottom: spacing.sm,
    },
    inkblotInput: {
      minHeight: 160,
    },
    sheetFoot: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    wordCount: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.xs,
      color: colors.fontMuted,
      letterSpacing: 1.2,
    },
    inlineStatus: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.sm,
      color: colors.brandPrimary,
      textAlign: 'right',
      marginBottom: spacing.sm,
    },
    voicePartialText: {
      fontFamily: fontFamily.serifItalic,
      fontStyle: 'italic',
      fontSize: fontSize.md,
      color: colors.fontSecondary,
      textAlign: 'center',
      marginBottom: spacing.base,
      paddingHorizontal: spacing.lg,
    },
    voiceHintPlus: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.xs,
      color: colors.fontMuted,
      textAlign: 'right',
      marginBottom: spacing.sm,
      fontStyle: 'italic',
    },

    // ── Insights card (Plus voice analysis) ──
    insightsCard: {
      marginBottom: spacing.lg,
    },
    insightsTitle: {
      fontFamily: fontFamily.bodyBold,
      fontSize: fontSize.xs,
      color: colors.brandPrimary,
      letterSpacing: 1.8,
      textTransform: 'uppercase',
      marginBottom: spacing.sm,
    },
    insightsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    insightsChip: {
      backgroundColor: colors.infoBg,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: borderRadius.md,
      minWidth: 80,
    },
    insightsLabel: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.xs,
      color: colors.fontSecondary,
      marginBottom: 2,
    },
    insightsValue: {
      fontFamily: fontFamily.button,
      fontSize: fontSize.sm,
      color: colors.fontMain,
      textTransform: 'capitalize',
    },
    insightsDismiss: {
      alignSelf: 'flex-end',
      padding: spacing.xs,
    },
    insightsDismissText: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.xs,
      color: colors.fontSecondary,
    },

    reflectionBlock: {
      marginBottom: spacing.sm,
    },

    // ── Section labels / attachments ──
    sectionLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    sectionLabel: {
      fontFamily: fontFamily.header,
      fontSize: fontSize.md,
      color: colors.fontMain,
    },
    plusBadge: {
      backgroundColor: colors.tierPlus,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: borderRadius.sm,
      marginLeft: spacing.sm,
    },
    plusBadgeText: {
      fontFamily: fontFamily.buttonBold,
      color: colors.fontWhite,
      fontSize: fontSize.xs,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    attachButton: {
      marginBottom: spacing.base,
    },
    attachmentPreview: {
      marginBottom: spacing.base,
    },
    attachmentItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgCard,
      borderRadius: borderRadius.md,
      padding: spacing.sm,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    attachmentImage: {
      width: 50,
      height: 50,
      borderRadius: borderRadius.sm,
      marginRight: spacing.sm,
    },
    attachmentFileIcon: {
      width: 50,
      height: 50,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.bgMuted,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.sm,
    },
    fileIconText: {
      fontFamily: fontFamily.bodyBold,
      fontSize: fontSize.xs,
      color: colors.fontMuted,
      letterSpacing: 1,
    },
    attachmentInfo: {
      flex: 1,
    },
    attachmentName: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.sm,
      color: colors.fontMain,
      marginBottom: 2,
    },
    attachmentSize: {
      fontFamily: fontFamily.button,
      fontSize: fontSize.xs,
      color: colors.fontMuted,
    },
    removeButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
    },
    removeButtonText: {
      color: colors.btnDanger,
      fontSize: fontSize.xl,
    },

    // ── Tags ──
    collapsibleHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      marginBottom: spacing.xs,
      minHeight: 44,
    },
    collapsibleHeaderText: {
      fontFamily: fontFamily.button,
      fontSize: fontSize.md,
      color: colors.fontMain,
    },
    collapsibleToggle: {
      fontSize: fontSize.sm,
      color: colors.fontMuted,
    },
    tagSection: {
      marginBottom: spacing.base,
    },
    tagChipsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    tagQuickChip: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.borderMedium,
      minHeight: 32,
      justifyContent: 'center',
    },
    tagQuickChipText: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.sm,
      color: colors.fontSecondary,
    },
    tagChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgMuted,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    tagChipText: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.sm,
      color: colors.fontMain,
      marginRight: spacing.xs,
    },
    tagChipRemove: {
      fontSize: fontSize.lg,
      color: colors.fontMuted,
      fontWeight: '300',
    },
    tagInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    tagInputField: {
      flex: 1,
      fontFamily: fontFamily.body,
      backgroundColor: colors.bgCard,
      borderRadius: borderRadius.md,
      padding: spacing.sm,
      fontSize: fontSize.md,
      color: colors.fontMain,
      borderWidth: 1,
      borderColor: colors.borderMedium,
    },
    tagSuggestions: {
      marginTop: spacing.xs,
      backgroundColor: colors.bgCard,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.borderMedium,
      overflow: 'hidden',
    },
    tagSuggestionItem: {
      padding: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
      minHeight: 44,
      justifyContent: 'center',
    },
    tagSuggestionText: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.sm,
      color: colors.fontMain,
    },

    // ── Save / status / help ──
    saveStatus: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.sm,
      fontStyle: 'italic',
      color: colors.accentGrowth,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
    helpText: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.sm,
      color: colors.fontMuted,
      lineHeight: 22,
      textAlign: 'center',
      marginTop: spacing.base,
    },

    // ── Gratitude / InkBlot mode chrome ──
    modeTitle: {
      fontFamily: fontFamily.header,
      fontSize: fontSize.xl,
      color: colors.fontMain,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    modeSubtitle: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.sm,
      color: colors.fontSecondary,
      textAlign: 'center',
      marginBottom: spacing.lg,
      lineHeight: 20,
    },
    modeSaveButton: {
      marginTop: spacing.base,
    },
    gratitudeInputContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: spacing.md,
    },
    gratitudeNumber: {
      fontFamily: fontFamily.header,
      fontSize: fontSize.xl,
      color: colors.brandPrimary,
      width: 30,
      marginTop: spacing.sm,
    },
    gratitudeInput: {
      flex: 1,
      fontFamily: fontFamily.serif,
      backgroundColor: colors.bgCard,
      borderRadius: borderRadius.lg,
      padding: spacing.base,
      fontSize: fontSize.md,
      color: colors.fontMain,
      borderWidth: 1,
      borderColor: colors.borderMedium,
      minHeight: 60,
      textAlignVertical: 'top',
    },

    // ── Gratitude protocol engine ──
    pillRowCentered: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    gratIntroLine: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.sm,
      color: colors.fontMuted,
      textAlign: 'center',
      marginBottom: spacing.md,
    },
    gratTextarea: {
      fontFamily: fontFamily.serif,
      backgroundColor: colors.bgCard,
      borderRadius: borderRadius.lg,
      padding: spacing.base,
      fontSize: fontSize.md,
      lineHeight: fontSize.md * 1.6,
      color: colors.fontMain,
      borderWidth: 1,
      borderColor: colors.borderMedium,
      minHeight: 140,
      textAlignVertical: 'top',
    },
    gratPromptCard: {
      backgroundColor: colors.bgCard,
      borderLeftWidth: 4,
      borderLeftColor: colors.brandPrimary,
      borderRadius: borderRadius.md,
      padding: spacing.base,
      marginBottom: spacing.sm,
    },
    gratPromptText: {
      fontFamily: fontFamily.serif,
      fontSize: fontSize.md,
      lineHeight: fontSize.md * 1.5,
      color: colors.fontMain,
    },
    gratRowButtons: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.md,
      marginTop: spacing.sm,
    },
    letterToInput: {
      fontFamily: fontFamily.serif,
      backgroundColor: colors.bgCard,
      borderRadius: borderRadius.md,
      padding: spacing.base,
      fontSize: fontSize.md,
      color: colors.fontMain,
      borderWidth: 1,
      borderColor: colors.borderMedium,
      marginBottom: spacing.md,
    },
    letterTextarea: {
      minHeight: 180,
    },
    letterSaveButton: {
      flexGrow: 2,
      minWidth: 140,
    },
    savorNudge: {
      fontFamily: fontFamily.serifItalic,
      fontStyle: 'italic',
      fontSize: fontSize.md,
      color: colors.fontMuted,
      textAlign: 'center',
      marginBottom: spacing.md,
    },

    // ── Sprint ──
    sprintControls: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    sprintTimer: {
      fontFamily: Platform.select({ios: 'Menlo', android: 'monospace', default: 'monospace'}),
      fontSize: fontSize.xxl,
      color: colors.brandPrimary,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    sprintNudge: {
      fontFamily: fontFamily.button,
      fontSize: fontSize.md,
      color: colors.brandAlt,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    sprintBreathFrame: {
      ...StyleSheet.absoluteFillObject,
      borderWidth: 5,
      borderColor: colors.brandAlt,
      borderRadius: 2,
    },

    // ── Reframe ──
    reframeLabel: {
      fontFamily: fontFamily.bodyBold,
      fontSize: fontSize.sm,
      color: colors.fontMain,
      marginBottom: spacing.xs,
    },
    reframeInput: {
      fontFamily: fontFamily.serif,
      backgroundColor: colors.bgCard,
      borderRadius: borderRadius.lg,
      padding: spacing.base,
      fontSize: fontSize.md,
      lineHeight: fontSize.md * 1.5,
      color: colors.fontMain,
      borderWidth: 1,
      borderColor: colors.borderMedium,
      minHeight: 80,
      textAlignVertical: 'top',
      marginBottom: spacing.md,
    },
  });

export default JournalScreen;
