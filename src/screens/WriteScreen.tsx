/**
 * WriteScreen (v2.0, 2026-10-01): the full-screen writing room. No tabs. Every way in
 * lives here: Free-write, Sprint, Gratitude (five practices), Reframe, InkBlot.
 * Built from the 26.185.2 JournalScreen: same handlers, same saved documents (see
 * services/entryPayloads.ts and its golden tests). What moved:
 *   - the date line, the big question, FirstSteps and the memory card now live on Today
 *   - Sophy's reflection now happens after saving, on the Kept sheet
 *   - "how heavy" is asked before every way in (it was only gratitude and reframe)
 *   - the 30-second "And now?" offer is gone; Kept asks instead, so answers aren't lost
 * LAWS: teal structure / coral Sophy-only / the person owns the sentence / no emojis in
 * chrome / no em dashes in copy / nothing under 13px.
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
import {pick, types, isErrorWithCode, errorCodes} from '@react-native-documents/picker';
import {launchImageLibrary, ImagePickerResponse} from 'react-native-image-picker';
import storage from '@react-native-firebase/storage';
import firestore from '@react-native-firebase/firestore';
import {spacing, borderRadius, fontFamily, fontSize} from '../theme';
import {useTheme, ThemeColors} from '../theme/ThemeContext';
import {generatePrompt, transcribeVoice} from '../services/sophyApi';
import {useSubscription} from '../hooks/useSubscription';
import {checkAIAccess, incrementAIUsage, AI_DAILY_LIMIT} from '../services/aiUsageService';
import PaywallModal from '../components/PaywallModal';
import InfoModal, {InfoHighlightBox, InfoParagraph, InfoDivider, InfoSection} from '../components/InfoModal';
import {Card, IWButton, Pill, Divider} from '../components/kit';
import {CloseIcon, MicIcon, TagIcon, PhotoIcon, CheckIcon} from '../components/kit/icons';
import {SophyOrb} from '../components/kit/SophyBlock';
import {CoachHint} from '../components/FirstStepsCard';
import {FirstStepsService} from '../services/firstStepsService';
import type {RootStackScreenProps, WriteMode, GratPractice} from '../navigation/types';
import {iPadContentStyle, showActionSheet} from '../utils/iPad';
import {
  freeWritePayload,
  manifestSnapshot,
  reframePayload,
  gratitudeThreePayload,
  gratitudePracticePayload,
  sprintPayload,
  inkblotPayload,
  tzOffsetMinutes,
  wordCount as countWords,
  Practice,
} from '../services/entryPayloads';
import {markFirstEntry} from '../services/userDates';

import {GRAT_DONE_KEY, todayKey, suggestedGratitudePractice} from '../services/writeShared';

// ═══════════════════════════════════════════════════════════════════════════
// GRATITUDE PROTOCOL ENGINE — ported verbatim from web app.html (v2 Phase 2a)
// Five evidence-based practices, rotated to prevent habituation
// (Emmons & McCullough 2003; Seligman et al. 2005; Koo et al. 2008;
//  Lyubomirsky et al. 2005; Bryant & Veroff 2007)
// ═══════════════════════════════════════════════════════════════════════════
const GRATITUDE_SUBTEXT: Record<GratPractice, string> = {
  three: 'Three specific good things, big or small.',
  deep: 'One good thing, in depth. Depth beats a long list.',
  subtraction: 'Imagine life without a good thing. It renews its pull.',
  letter: 'A letter to someone who helped you. Sending it is optional.',
  savor: 'One good moment, in full detail.',
};

const SUBTRACTION_PROMPTS = [
  "Think of a person you're glad is in your life. Imagine the day you almost didn't meet them. What would this week have looked like without them?",
  "Picture a choice you made that turned out well. Imagine you'd chosen differently. What good thing wouldn't exist now?",
  'Think of your home, or a place you feel safe. Imagine never having found it. Where would you be instead?',
  'Think of a routine that steadies your day. Imagine it gone tomorrow. What does it quietly hold together?',
  "Think of someone who taught you something important. Imagine they'd never crossed your path. What would you not know today?",
  "Picture a friendship that almost didn't happen. Trace the near-miss. What did luck hand you that day?",
  'Think of a small comfort you rely on every day. Imagine a week without it. What does it quietly do for you?',
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

const MODE_LABEL: Record<WriteMode, string> = {
  free: 'Free-write',
  sprint: 'Sprint',
  gratitude: 'Gratitude',
  reframe: 'Reframe',
  inkblot: 'InkBlot',
};
const MODE_PRACTICE: Record<WriteMode, Practice> = {
  free: 'freewrite',
  sprint: 'sprint',
  gratitude: 'gratitude',
  reframe: 'reframe',
  inkblot: 'inkblot',
};
const MODES: WriteMode[] = ['free', 'sprint', 'gratitude', 'reframe', 'inkblot'];

// ═══════════════════════════════════════════════════════════════════════════
// FEEL CHECK — optional 1-5 "how heavy" before writing. LAW: a self-rated feel,
// NEVER a symptom score. No clinical words on or near the scale. The ends are
// labeled so a tired person never has to guess which way is heavy.
// ═══════════════════════════════════════════════════════════════════════════
interface FeelCheckProps {
  question: string;
  selected: number;
  onTap: (n: number) => void;
  colors: ThemeColors;
}

export const FeelCheck: React.FC<FeelCheckProps> = ({question, selected, onTap, colors}) => (
  <View style={[feelStyles.row, {borderColor: colors.borderLight}]}>
    <Text style={[feelStyles.q, {color: colors.fontSecondary}]}>{question}</Text>
    <View style={feelStyles.scale}>
      {[1, 2, 3, 4, 5].map(n => (
        <View key={n} style={feelStyles.col}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`${n}${n === 1 ? ', light' : n === 5 ? ', heavy' : ''}`}
            accessibilityState={{selected: selected === n}}
            style={[
              feelStyles.dot,
              {borderColor: colors.borderMedium, backgroundColor: colors.bgCard},
              selected === n && {backgroundColor: colors.btnPrimary, borderColor: colors.btnPrimary},
            ]}
            onPress={() => onTap(selected === n ? 0 : n)}
            hitSlop={{top: 6, bottom: 6, left: 4, right: 4}}>
            <Text style={[feelStyles.dotText, {color: selected === n ? colors.fontWhite : colors.fontSecondary}]}>
              {n}
            </Text>
          </TouchableOpacity>
          <Text style={[feelStyles.end, {color: colors.fontMuted}]}>{n === 1 ? 'Light' : n === 5 ? 'Heavy' : ' '}</Text>
        </View>
      ))}
    </View>
    <Text style={[feelStyles.hint, {color: colors.fontMuted}]}>Optional. Tap again to clear.</Text>
  </View>
);

const feelStyles = StyleSheet.create({
  row: {
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginBottom: spacing.lg,
  },
  q: {fontFamily: fontFamily.body, fontSize: 15, lineHeight: 21},
  scale: {flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4},
  col: {alignItems: 'center', gap: 4, minWidth: 48},
  dot: {width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center'},
  dotText: {fontFamily: fontFamily.buttonBold, fontSize: 15},
  end: {fontFamily: fontFamily.body, fontSize: 13},
  hint: {fontFamily: fontFamily.body, fontSize: 15},
});

const WriteScreen: React.FC<RootStackScreenProps<'Write'>> = ({navigation, route}) => {
  const {colors, isDark} = useTheme();
  const {width: screenWidth} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const params = route.params || {};
  const openedAt = useRef(Date.now()).current;
  const leavingRef = useRef(false);
  const unsavedRef = useRef(false);

  const {checkFeatureAndShowPaywall, hasFeatureAccess, isPremium, showPaywall, closePaywall} = useSubscription();

  // The way in. Opens on whatever Today asked for; free-write otherwise.
  const [mode, setMode] = useState<WriteMode>(params.mode || 'free');

  // Info Modal State
  const [showGratitudeInfo, setShowGratitudeInfo] = useState(false);
  const [showInkblotInfo, setShowInkblotInfo] = useState(false);

  // Gratitude nudge dot (coral on the Gratitude pill until saved today)
  const [gratDoneToday, setGratDoneToday] = useState(true); // assume done until read
  useEffect(() => {
    AsyncStorage.getItem(GRAT_DONE_KEY).then(v => setGratDoneToday(v === todayKey()));
  }, []);
  const markGratDoneToday = useCallback(async () => {
    await AsyncStorage.setItem(GRAT_DONE_KEY, todayKey());
    setGratDoneToday(true);
  }, []);

  // One "how heavy" answer per writing session, whichever way in is used.
  const [feelBefore, setFeelBefore] = useState(0);

  // Gratitude (Three) state
  const [gratitude1, setGratitude1] = useState('');
  const [gratitude2, setGratitude2] = useState('');
  const [gratitude3, setGratitude3] = useState('');
  const [savingGratitude, setSavingGratitude] = useState(false);
  const [gratitudeStatus, setGratitudeStatus] = useState('');

  // Gratitude protocol engine state (deep / subtraction / letter / savor)
  const [activeGratPractice, setActiveGratPractice] = useState<GratPractice>(params.gratPractice || 'three');
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

  const switchGratPractice = useCallback(
    (p: GratPractice) => {
      setActiveGratPractice(p);
      if (p === 'subtraction') {
        setGratSubtractionPrompt(prev => prev || SUBTRACTION_PROMPTS[Math.floor(Math.random() * SUBTRACTION_PROMPTS.length)]);
      }
      if (p === 'savor') {
        setGratSavorNudge(SAVOR_NUDGES[Math.floor(Math.random() * SAVOR_NUDGES.length)]);
      }
    },
    [],
  );
  // Opening straight into a practice from Today sets up its prompt or nudge too.
  useEffect(() => {
    if (params.gratPractice) switchGratPractice(params.gratPractice);
  }, [params.gratPractice, switchGratPractice]);

  // InkBlot state
  const [inkblotText, setInkblotText] = useState('');
  const [savingInkblot, setSavingInkblot] = useState(false);
  const [inkblotRecording, setInkblotRecording] = useState(false);
  const [inkblotStatus, setInkblotStatus] = useState('');

  // Sprint (Pennebaker & Beall 1986; Frattaroli 2006)
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

  // Reframe
  const [reframe1, setReframe1] = useState('');
  const [reframe2, setReframe2] = useState('');
  const [reframe3, setReframe3] = useState('');
  const [reframe4, setReframe4] = useState('');
  const [savingReframe, setSavingReframe] = useState(false);
  const [reframeStatus, setReframeStatus] = useState('');

  // Sophy prompt (from Today, or asked for here)
  const [prompt, setPrompt] = useState(params.prompt || '');
  const [generatingPrompt, setGeneratingPrompt] = useState(false);

  // InkOutLoud voice state (native speech recognition)
  const [isRecording, setIsRecording] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [voicePartialText, setVoicePartialText] = useState('');
  const [voiceStatus, setVoiceStatus] = useState('');
  const usedVoiceRef = useRef(false);

  // File attachments state
  const [attachments, setAttachments] = useState<Array<{uri: string; name: string; type: string; size: number}>>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  // Free-write state
  const [journalEntry, setJournalEntry] = useState('');
  const [saving, setSaving] = useState(false);
  const [journalStatus, setJournalStatus] = useState('');

  // Plus voice cleanup returns Sophy's line about the voice note; it's saved as reflectionUsed
  const [voiceReflection, setVoiceReflection] = useState('');
  // Sophy's note on a spoken entry is kept only if they choose to (same rule as the old checkbox).
  const [keepVoiceNote, setKeepVoiceNote] = useState(false);
  const [emotionalInsights, setEmotionalInsights] = useState<{
    primaryEmotion?: string;
    confidence?: number;
    energyLevel?: string;
    stressLevel?: string;
    sophyInsight?: string;
  } | null>(null);

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

  // AI gating helper (free: 3 Sophy calls a day; Plus: no limit)
  const checkAndUseAI = async (): Promise<boolean> => {
    const hasUnlimitedAI = await hasFeatureAccess('ai');
    if (hasUnlimitedAI) return true;
    const access = await checkAIAccess();
    if (!access.canUse) {
      Alert.alert(
        "That's today's Sophy",
        `Free includes ${AI_DAILY_LIMIT} Sophy replies a day. It resets tomorrow. Plus has no daily limit.`,
        [
          {text: 'Not now', style: 'cancel'},
          {text: 'See Plus', onPress: () => checkFeatureAndShowPaywall('ai')},
        ],
      );
      return false;
    }
    return true;
  };

  const afterAIUse = async () => {
    const hasUnlimitedAI = await hasFeatureAccess('ai');
    if (!hasUnlimitedAI) await incrementAIUsage();
  };

  const handleGeneratePrompt = async () => {
    if (!(await checkAndUseAI())) return;
    setGeneratingPrompt(true);
    try {
      const p = await generatePrompt('');
      setPrompt(p);
      await afterAIUse();
      FirstStepsService.complete('prompt');
    } catch (error: any) {
      console.error('Error generating prompt:', error);
      Alert.alert("Sophy couldn't answer", 'Check your connection and try again.');
    } finally {
      setGeneratingPrompt(false);
    }
  };

  // ==================== InkOutLoud Voice Recognition ====================
  useEffect(() => {
    if (!Voice) {
      console.warn('Voice module not available - voice features disabled');
      return;
    }
    Voice.onSpeechResults = (e: any) => {
      if (e.value && e.value[0]) setVoiceText(e.value[0]);
    };
    Voice.onSpeechPartialResults = (e: any) => {
      if (e.value && e.value[0]) setVoicePartialText(e.value[0]);
    };
    Voice.onSpeechError = (e: any) => {
      console.error('Speech error:', e.error);
      setIsRecording(false);
      setInkblotRecording(false);
      if (e.error?.message && !e.error.message.includes('No speech')) {
        Alert.alert("Couldn't catch that", 'Try again, a little closer to the phone.');
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
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
          title: 'Microphone',
          message: 'InkWell uses the microphone only while you speak an entry.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        });
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
      Alert.alert('Voice unavailable', 'Speaking an entry is not available on this device.');
      return;
    }
    if (!(await requestMicrophonePermission())) {
      Alert.alert('Microphone is off', 'Turn on microphone access for InkWell in your phone settings to speak an entry.');
      return;
    }
    try {
      setVoiceText('');
      setVoicePartialText('');
      await Voice.start('en-US');
      setIsRecording(true);
    } catch (error: any) {
      console.error('Voice start error:', error);
      Alert.alert("Couldn't start listening", 'Please try again.');
    }
  };

  const handleStopRecording = async () => {
    if (!Voice) return;
    try {
      await Voice.stop();
      setIsRecording(false);
      const recognizedText = voiceText || voicePartialText;
      if (!recognizedText || recognizedText.trim().length === 0) {
        flashStatus(setVoiceStatus, 'Nothing heard. Try again.');
        return;
      }
      usedVoiceRef.current = true;
      if (isPremium) {
        // Plus: cleaned-up words and Sophy's note on the voice
        setVoiceStatus('Cleaning up your words...');
        try {
          const transcriptionResult = await transcribeVoice(recognizedText);
          setJournalEntry(prev => prev + (prev ? ' ' : '') + transcriptionResult.cleanedText);
          if (transcriptionResult.emotionalInsights) {
            setEmotionalInsights(transcriptionResult.emotionalInsights);
            if (transcriptionResult.emotionalInsights.sophyInsight) {
              setVoiceReflection(transcriptionResult.emotionalInsights.sophyInsight);
            }
          }
          flashStatus(setVoiceStatus, 'Added.');
        } catch (transcriptionError: any) {
          console.error('AI processing error:', transcriptionError);
          setJournalEntry(prev => prev + (prev ? ' ' : '') + recognizedText);
          flashStatus(setVoiceStatus, 'Added. Cleanup is unavailable right now.');
        }
      } else {
        setJournalEntry(prev => prev + (prev ? ' ' : '') + recognizedText);
        flashStatus(setVoiceStatus, 'Added.');
      }
      setVoiceText('');
      setVoicePartialText('');
    } catch (error) {
      console.error('Stop recording error:', error);
      setIsRecording(false);
    }
  };

  const handleVoiceToggle = () => (isRecording ? handleStopRecording() : handleStartRecording());

  // Today's "Speak it" opens Write already listening.
  const startedVoiceRef = useRef(false);
  useEffect(() => {
    if (params.startVoice && !startedVoiceRef.current && mode === 'free') {
      startedVoiceRef.current = true;
      const t = setTimeout(() => handleStartRecording(), 400);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.startVoice]);

  // ==================== File Attachments ====================
  const handlePickFiles = async () => {
    // FEATURE GATE: photos and files are part of Plus
    if (!(await checkFeatureAndShowPaywall('fileUpload'))) return;
    showActionSheet('Add to this entry', ['Cancel', 'Photo Library', 'Files'], 0, buttonIndex => {
      if (buttonIndex === 1) handlePickPhotos();
      else if (buttonIndex === 2) handlePickDocuments();
    });
  };

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const handlePickPhotos = async () => {
    try {
      const result: ImagePickerResponse = await launchImageLibrary({mediaType: 'mixed', selectionLimit: 10, quality: 0.8});
      if (result.didCancel) return;
      if (result.errorCode) {
        console.error('Image picker error:', result.errorMessage);
        Alert.alert("Couldn't open your photos", 'Please try again.');
        return;
      }
      const validAssets = (result.assets || []).filter(asset => {
        if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE) {
          Alert.alert('Too large', `${asset.fileName || 'That photo'} is over 10MB and will be skipped.`);
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
    }
  };

  const handlePickDocuments = async () => {
    try {
      const results = await pick({allowMultiSelection: true, type: [types.images, types.pdf, types.allFiles]});
      const validFiles = results.filter(file => {
        if (file.size && file.size > MAX_FILE_SIZE) {
          Alert.alert('Too large', `${file.name} is over 10MB and will be skipped.`);
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
      if (!isErrorWithCode(error) || error.code !== errorCodes.OPERATION_CANCELED) {
        console.error('File picker error:', error);
      }
    }
  };

  const handleRemoveAttachment = (index: number) => setAttachments(prev => prev.filter((_, i) => i !== index));

  const uploadAttachments = async (): Promise<Array<{url: string; name: string; type?: string}>> => {
    if (attachments.length === 0) return [];
    const user = auth().currentUser;
    if (!user) throw new Error('User not authenticated');
    const uploaded: Array<{url: string; name: string; type?: string}> = [];
    const failed: string[] = [];
    for (const file of attachments) {
      try {
        const fileName = `${user.uid}/${Date.now()}_${file.name}`;
        const reference = storage().ref(fileName);
        await reference.putFile(file.uri);
        const url = await reference.getDownloadURL();
        uploaded.push({url, name: file.name, type: file.type});
      } catch (uploadError) {
        console.error('Upload error for', file.name, uploadError);
        failed.push(file.name);
      }
    }
    if (failed.length > 0) {
      Alert.alert("Some files didn't upload", `${failed.join(', ')}. The rest of your entry was kept.`);
    }
    return uploaded;
  };

  // ==================== shared save plumbing ====================
  const extrasFor = (m: WriteMode, voice = false) => ({
    practice: MODE_PRACTICE[m],
    tzOffsetMin: tzOffsetMinutes(),
    feelBefore: feelBefore || undefined,
    isVoiceEntry: voice || undefined,
  });

  const minutesSinceOpen = () => Math.max(1, Math.round((Date.now() - openedAt) / 60000));

  // Every text field in Write, which way it belongs to, and how to clear it. Used so that
  // keeping one way never silently drops words typed in another (Bruce, 2026-10-01).
  type FieldKey =
    | 'journalEntry' | 'sprintText' | 'inkblotText'
    | 'reframe1' | 'reframe2' | 'reframe3' | 'reframe4'
    | 'gratitude1' | 'gratitude2' | 'gratitude3'
    | 'gratDeepText' | 'gratSubtractionText' | 'gratLetterText' | 'gratSavorText';
  const fieldValues: Record<FieldKey, string> = {
    journalEntry, sprintText, inkblotText, reframe1, reframe2, reframe3, reframe4,
    gratitude1, gratitude2, gratitude3, gratDeepText, gratSubtractionText, gratLetterText, gratSavorText,
  };
  const FIELD_HOME: Record<FieldKey, {mode: WriteMode; grat?: GratPractice}> = {
    journalEntry: {mode: 'free'},
    sprintText: {mode: 'sprint'},
    inkblotText: {mode: 'inkblot'},
    reframe1: {mode: 'reframe'},
    reframe2: {mode: 'reframe'},
    reframe3: {mode: 'reframe'},
    reframe4: {mode: 'reframe'},
    gratitude1: {mode: 'gratitude', grat: 'three'},
    gratitude2: {mode: 'gratitude', grat: 'three'},
    gratitude3: {mode: 'gratitude', grat: 'three'},
    gratDeepText: {mode: 'gratitude', grat: 'deep'},
    gratSubtractionText: {mode: 'gratitude', grat: 'subtraction'},
    gratLetterText: {mode: 'gratitude', grat: 'letter'},
    gratSavorText: {mode: 'gratitude', grat: 'savor'},
  };
  const clearField: Record<FieldKey, () => void> = {
    journalEntry: () => {
      setJournalEntry('');
      setEntryTags([]);
      setAttachments([]);
      setPrompt('');
      setVoiceReflection('');
      setKeepVoiceNote(false);
      setEmotionalInsights(null);
    },
    sprintText: () => setSprintText(''),
    inkblotText: () => setInkblotText(''),
    reframe1: () => setReframe1(''),
    reframe2: () => setReframe2(''),
    reframe3: () => setReframe3(''),
    reframe4: () => setReframe4(''),
    gratitude1: () => setGratitude1(''),
    gratitude2: () => setGratitude2(''),
    gratitude3: () => setGratitude3(''),
    gratDeepText: () => setGratDeepText(''),
    gratSubtractionText: () => setGratSubtractionText(''),
    gratLetterText: () => setGratLetterText(''),
    gratSavorText: () => setGratSavorText(''),
  };

  /**
   * After any save: Kept takes over from Write (it pops up over Today).
   * If another way still holds words, Write stays underneath on that way, and Kept's
   * Done brings them back to it instead of to Today.
   */
  const goKept = (entryId: string, text: string, m: WriteMode, words: number, saved: FieldKey[]) => {
    markFirstEntry();
    const firstSave = FirstStepsService.isQuestActive() && !FirstStepsService.getState()?.save;
    FirstStepsService.complete('save');
    const kept = {
      entryId,
      text,
      mode: m,
      words,
      minutes: m === 'sprint' ? sprintMinutes : minutesSinceOpen(),
      hadFeelBefore: feelBefore > 0,
      firstSave,
    };
    const remaining = (Object.keys(fieldValues) as FieldKey[]).filter(
      k => !saved.includes(k) && fieldValues[k].trim().length > 0,
    );
    if (remaining.length === 0) {
      leavingRef.current = true;
      navigation.replace('Kept', kept);
      return;
    }
    saved.forEach(k => clearField[k]());
    // The next entry starts fresh: its own before-rating, and not marked as spoken
    setFeelBefore(0);
    usedVoiceRef.current = false;
    inkblotVoiceRef.current = false;
    const home = FIELD_HOME[remaining[0]];
    setMode(home.mode);
    if (home.grat) setActiveGratPractice(home.grat);
    navigation.navigate('Kept', {...kept, stillOpen: MODE_LABEL[home.mode]});
  };

  const ts = () => firestore.FieldValue.serverTimestamp();

  // ==================== FREE-WRITE SAVE ====================
  const handleSave = async () => {
    if (!journalEntry.trim()) {
      flashStatus(setJournalStatus, 'Write a little first, then keep it.');
      return;
    }
    setSaving(true);
    try {
      const user = auth().currentUser;
      if (!user) {
        Alert.alert('Signed out', 'Sign in again to keep this entry.');
        return;
      }
      let uploadedAttachments: Array<{url: string; name: string; type?: string}> = [];
      if (attachments.length > 0) {
        setUploadingFiles(true);
        try {
          uploadedAttachments = await uploadAttachments();
        } catch (uploadError) {
          console.error('Upload error:', uploadError);
        } finally {
          setUploadingFiles(false);
        }
      }
      // The WISH snapshot rides along, exactly as before
      let manifest = null;
      try {
        const manifestDoc = await firestore().collection('manifests').doc(user.uid).get();
        if (manifestDoc.exists()) manifest = manifestSnapshot(manifestDoc.data());
      } catch (manifestError) {
        console.log('No manifest data found:', manifestError);
      }
      const entryData = freeWritePayload({
        uid: user.uid,
        ts: ts(),
        now: new Date(),
        text: journalEntry,
        tags: entryTags,
        manifest,
        promptUsed: prompt || undefined,
        reflectionUsed: keepVoiceNote && voiceReflection ? voiceReflection : undefined,
        attachments: uploadedAttachments,
        extras: extrasFor('free', usedVoiceRef.current),
      });
      const savedEntry = await firestore().collection('journalEntries').add(entryData);

      // Embeddings in the background (non-blocking), for Ask your journal
      (async () => {
        try {
          const idToken = await user.getIdToken();
          const endpoint = __DEV__
            ? 'http://localhost:5001/inkwell-alpha/us-central1/embedAndStoreEntry'
            : 'https://us-central1-inkwell-alpha.cloudfunctions.net/embedAndStoreEntry';
          await fetch(endpoint, {
            method: 'POST',
            headers: {'Content-Type': 'application/json', Authorization: `Bearer ${idToken}`},
            body: JSON.stringify({text: journalEntry, entryId: savedEntry.id}),
          });
        } catch (embedError) {
          console.warn('Embedding error (non-blocking):', embedError);
        }
      })();

      goKept(savedEntry.id, journalEntry, 'free', countWords(journalEntry), ['journalEntry']);
    } catch (error: any) {
      console.error('Error saving entry:', error);
      flashStatus(setJournalStatus, "Couldn't keep this. Your words are still here. Try again.", 5000);
    } finally {
      setSaving(false);
    }
  };

  // ==================== REFRAME SAVE ====================
  const handleSaveReframe = async () => {
    const steps: [string, string, string, string] = [reframe1.trim(), reframe2.trim(), reframe3.trim(), reframe4.trim()];
    if (!steps[0] || !steps[3]) {
      flashStatus(setReframeStatus, 'At minimum: what happened (1) and another way to see it (4).', 4000);
      return;
    }
    setSavingReframe(true);
    try {
      const user = auth().currentUser;
      if (!user) return;
      const entryData = reframePayload({uid: user.uid, ts: ts(), now: new Date(), steps, extras: extrasFor('reframe')});
      const docRef = await firestore().collection('journalEntries').add(entryData);
      goKept(docRef.id, entryData.text, 'reframe', countWords(steps.join(' ')), ['reframe1', 'reframe2', 'reframe3', 'reframe4']);
    } catch (e) {
      console.error('Reframe save failed:', e);
      flashStatus(setReframeStatus, "Couldn't keep this. Your words are still here. Try again.", 5000);
    } finally {
      setSavingReframe(false);
    }
  };

  // ==================== GRATITUDE SAVE (Three) ====================
  const handleSaveGratitude = async () => {
    const gratitudes = [gratitude1, gratitude2, gratitude3].map(g => g.trim()).filter(g => g);
    if (gratitudes.length === 0) {
      flashStatus(setGratitudeStatus, 'Add at least one.');
      return;
    }
    setSavingGratitude(true);
    try {
      const user = auth().currentUser;
      if (!user) return;
      const entryData = gratitudeThreePayload({uid: user.uid, ts: ts(), now: new Date(), gratitudes, extras: extrasFor('gratitude')});
      const docRef = await firestore().collection('journalEntries').add(entryData);
      await markGratDoneToday();
      goKept(docRef.id, entryData.text, 'gratitude', countWords(gratitudes.join(' ')), ['gratitude1', 'gratitude2', 'gratitude3']);
    } catch (error: any) {
      console.error('Error saving gratitude:', error);
      flashStatus(setGratitudeStatus, "Couldn't keep this. Try again.");
    } finally {
      setSavingGratitude(false);
    }
  };

  // ==================== GRATITUDE PRACTICE SAVE (deep/subtraction/letter/savor) ====================
  const handleSaveGratitudePractice = async (m: Exclude<GratPractice, 'three'>) => {
    const fieldMap: Record<string, string> = {
      deep: gratDeepText,
      subtraction: gratSubtractionText,
      letter: gratLetterText,
      savor: gratSavorText,
    };
    const text = fieldMap[m]?.trim();
    if (!text) {
      flashStatus(setGratitudeStatus, 'Write a little first.');
      return;
    }
    setSavingGratitude(true);
    try {
      const user = auth().currentUser;
      if (!user) return;
      const entryData = gratitudePracticePayload({
        uid: user.uid,
        ts: ts(),
        now: new Date(),
        mode: m,
        text,
        subtractionPrompt: gratSubtractionPrompt,
        letterTo: gratLetterTo,
        extras: extrasFor('gratitude'),
      });
      const docRef = await firestore().collection('journalEntries').add(entryData);
      await markGratDoneToday();
      const practiceField: Record<typeof m, FieldKey> = {
        deep: 'gratDeepText',
        subtraction: 'gratSubtractionText',
        letter: 'gratLetterText',
        savor: 'gratSavorText',
      };
      goKept(docRef.id, entryData.text, 'gratitude', countWords(text), [practiceField[m]]);
    } catch (e) {
      console.error('Gratitude practice save failed:', e);
      flashStatus(setGratitudeStatus, "Couldn't keep this. Try again.");
    } finally {
      setSavingGratitude(false);
    }
  };

  // Sophy letter drafting (Plus) — mirrors web sophyLetterAssist
  const handleSophyLetterAssist = async () => {
    const notes = gratLetterText.trim();
    if (notes.length < 5) {
      flashStatus(setGratitudeStatus, 'Jot a few rough notes first: who they are, what they did, what it meant.', 5000);
      return;
    }
    setLetterAssistLoading(true);
    setGratitudeStatus('Sophy is drafting...');
    try {
      const r = await gratEngineFetch({action: 'letterAssist', notes, recipientName: gratLetterTo.trim()});
      if (r.status === 403 && r.data.code === 'UPGRADE_REQUIRED') {
        setGratitudeStatus('');
        checkFeatureAndShowPaywall('ai');
        return;
      }
      if (r.ok && r.data.draft) {
        setGratLetterText(r.data.draft);
        flashStatus(setGratitudeStatus, 'Draft ready. Make it yours before you keep it.', 4000);
        return;
      }
      flashStatus(setGratitudeStatus, "Sophy couldn't draft right now.");
    } catch (e) {
      console.error('letterAssist failed:', e);
      flashStatus(setGratitudeStatus, "Sophy couldn't draft right now.");
    } finally {
      setLetterAssistLoading(false);
    }
  };

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
      Linking.openURL(url).catch(() => flashStatus(setGratitudeStatus, "Couldn't open your mail app."));
      setGratitudeStatus('');
    }
  };

  // Personalized subtraction prompt from the person's own journal (Plus)
  const handlePersonalSubtractionPrompt = async () => {
    setPersonalizingPrompt(true);
    try {
      const r = await gratEngineFetch({action: 'personalSubtraction'});
      if (r.status === 403 && r.data.code === 'UPGRADE_REQUIRED') {
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
      flashStatus(setGratitudeStatus, "Couldn't personalize right now.");
    } catch (e) {
      console.error('personalSubtraction failed:', e);
      flashStatus(setGratitudeStatus, "Couldn't personalize right now.");
    } finally {
      setPersonalizingPrompt(false);
    }
  };

  // ==================== SPRINT TIMER ====================
  const stopSprintTimer = useCallback(
    (resetLabel: boolean) => {
      setSprintRunning(false);
      sprintEndsAtRef.current = null;
      setSprintIdle(false);
      if (resetLabel) setSprintDisplay(`${sprintMinutes}:00`);
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
        setSprintDisplay('Time. Keep going or keep it. Both count.');
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [sprintRunning, stopSprintTimer]);

  // Breathing teal edge cue while the writer is still
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

  // Leaving Sprint stops its timer
  useEffect(() => {
    if (mode !== 'sprint' && sprintRunning) stopSprintTimer(false);
  }, [mode, sprintRunning, stopSprintTimer]);

  const handleSprintInput = (text: string) => {
    setSprintText(text);
    sprintLastKeyRef.current = Date.now();
    if (sprintIdle) setSprintIdle(false);
  };

  // ==================== SPRINT SAVE ====================
  const handleSaveSprint = async () => {
    const text = sprintText.trim();
    if (!text) {
      flashStatus(setSprintStatus, 'Write first, keep it after.');
      return;
    }
    setSavingSprint(true);
    try {
      const user = auth().currentUser;
      if (!user) return;
      const entryData = sprintPayload({uid: user.uid, ts: ts(), now: new Date(), text, minutes: sprintMinutes, extras: extrasFor('sprint')});
      const docRef = await firestore().collection('journalEntries').add(entryData);
      stopSprintTimer(true);
      goKept(docRef.id, entryData.text, 'sprint', countWords(text), ['sprintText']);
    } catch (e) {
      console.error('Sprint save failed:', e);
      flashStatus(setSprintStatus, "Couldn't keep this. Your writing is still here. Try again.", 5000);
    } finally {
      setSavingSprint(false);
    }
  };

  // ==================== INKBLOT SAVE ====================
  const inkblotVoiceRef = useRef(false);
  const handleSaveInkblot = async () => {
    if (!inkblotText.trim()) {
      flashStatus(setInkblotStatus, 'Jot a thought first.');
      return;
    }
    setSavingInkblot(true);
    try {
      const user = auth().currentUser;
      if (!user) return;
      const entryData = inkblotPayload({
        uid: user.uid,
        ts: ts(),
        now: new Date(),
        text: inkblotText,
        extras: extrasFor('inkblot', inkblotVoiceRef.current),
      });
      const docRef = await firestore().collection('journalEntries').add(entryData);
      goKept(docRef.id, entryData.text, 'inkblot', countWords(inkblotText), ['inkblotText']);
    } catch (error: any) {
      console.error('Error saving InkBlot:', error);
      flashStatus(setInkblotStatus, "Couldn't keep this. Try again.");
    } finally {
      setSavingInkblot(false);
    }
  };

  // ==================== INKBLOT VOICE ====================
  const handleInkblotVoiceToggle = async () => {
    if (!Voice) {
      Alert.alert('Voice unavailable', 'Speaking is not available on this device.');
      return;
    }
    if (inkblotRecording) {
      try {
        await Voice.stop();
        setInkblotRecording(false);
        const recognizedText = voiceText || voicePartialText;
        if (recognizedText && recognizedText.trim().length > 0) {
          inkblotVoiceRef.current = true;
          setInkblotText(prev => (prev + (prev ? ' ' : '') + recognizedText.trim()).slice(0, 500));
        }
        setVoiceText('');
        setVoicePartialText('');
      } catch (error) {
        console.error('Stop recording error:', error);
        setInkblotRecording(false);
      }
    } else {
      if (!(await requestMicrophonePermission())) {
        Alert.alert('Microphone is off', 'Turn on microphone access for InkWell in your phone settings.');
        return;
      }
      try {
        setVoiceText('');
        setVoicePartialText('');
        await Voice.start('en-US');
        setInkblotRecording(true);
      } catch (error: any) {
        console.error('Voice start error:', error);
        Alert.alert("Couldn't start listening", 'Please try again.');
      }
    }
  };

  // ==================== leaving ====================
  const hasUnsavedWords = () =>
    [
      journalEntry,
      sprintText,
      inkblotText,
      reframe1,
      reframe2,
      reframe3,
      reframe4,
      gratitude1,
      gratitude2,
      gratitude3,
      gratDeepText,
      gratSubtractionText,
      gratLetterText,
      gratSavorText,
      voicePartialText, // words still being dictated count too
      voiceText,
    ].some(s => s.trim().length > 0);

  // Every way out (Close, Android Back, a notification tap) asks first when there are
  // unkept words. Keeping an entry (replace to Kept) and a confirmed Leave pass straight through.
  unsavedRef.current = hasUnsavedWords();
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', e => {
      if (leavingRef.current || !unsavedRef.current) return;
      e.preventDefault();
      Alert.alert('Leave without keeping this?', 'What you wrote here will be lost.', [
        {text: 'Keep writing', style: 'cancel'},
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => {
            leavingRef.current = true;
            navigation.dispatch(e.data.action);
          },
        },
      ]);
    });
    return unsubscribe;
  }, [navigation]);

  // Listening stops when they actually leave (the unmount cleanup destroys Voice), not
  // before the guard asks, so "Keep writing" never loses words mid-dictation.
  const handleClose = () => {
    navigation.goBack();
  };

  const quickChips = userTagLibrary.filter(t => !entryTags.includes(t)).slice(0, 8);
  const headerCount =
    mode === 'free'
      ? `${countWords(journalEntry)} words`
      : mode === 'sprint'
      ? `${countWords(sprintText)} words`
      : mode === 'inkblot'
      ? `${inkblotText.length}/500`
      : '';
  const feelQuestion = 'How heavy is today?';

  const keepHandler =
    mode === 'free'
      ? handleSave
      : mode === 'sprint'
      ? handleSaveSprint
      : mode === 'reframe'
      ? handleSaveReframe
      : mode === 'inkblot'
      ? handleSaveInkblot
      : activeGratPractice === 'three'
      ? handleSaveGratitude
      : () => handleSaveGratitudePractice(activeGratPractice as Exclude<GratPractice, 'three'>);
  const keepLoading =
    mode === 'free'
      ? saving || uploadingFiles
      : mode === 'sprint'
      ? savingSprint
      : mode === 'reframe'
      ? savingReframe
      : mode === 'inkblot'
      ? savingInkblot
      : savingGratitude;
  const status =
    mode === 'free'
      ? journalStatus || voiceStatus
      : mode === 'sprint'
      ? sprintStatus
      : mode === 'reframe'
      ? reframeStatus
      : mode === 'inkblot'
      ? inkblotStatus
      : gratitudeStatus;

  return (
    <KeyboardAvoidingView style={styles.keyboardAvoid} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* ─── Top bar: close, the way in, a quiet count ─── */}
      <View style={[styles.wbar, {paddingTop: insets.top + spacing.xs}]}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <CloseIcon color={colors.fontSecondary} />
        </TouchableOpacity>
        <Text style={styles.wbarTitle}>{MODE_LABEL[mode]}</Text>
        <Text style={styles.wbarCount}>{headerCount}</Text>
      </View>

      {/* ─── Ways in ─── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.modeStrip}
        contentContainerStyle={styles.modeStripInner}
        keyboardShouldPersistTaps="handled">
        {MODES.map(m => (
          <Pill
            key={m}
            label={MODE_LABEL[m]}
            active={mode === m}
            onPress={() => setMode(m)}
            showDot={m === 'gratitude' && !gratDoneToday}
          />
        ))}
      </ScrollView>

      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
        <View style={[styles.content, iPadContentStyle(screenWidth)]}>
          {/* Sprint asks before the timer starts; everyone else asks up top */}
          {!(mode === 'sprint' && sprintRunning) && (
            <FeelCheck question={feelQuestion} selected={feelBefore} onTap={setFeelBefore} colors={colors} />
          )}

          {/* ================== FREE-WRITE ================== */}
          {mode === 'free' && (
            <View>
              {prompt ? (
                <View style={styles.promptCard}>
                  <View style={styles.promptTop}>
                    <SophyOrb size={20} />
                    <Text style={styles.promptWho}>SOPHY'S PROMPT</Text>
                    <TouchableOpacity
                      onPress={() => setPrompt('')}
                      accessibilityLabel="Remove the prompt"
                      hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                      style={styles.promptX}>
                      <CloseIcon size={15} color={colors.sophyLight} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.promptText}>{prompt}</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.askRow}
                  onPress={handleGeneratePrompt}
                  disabled={generatingPrompt}
                  accessibilityRole="button">
                  <SophyOrb size={18} />
                  <Text style={styles.askText}>
                    {generatingPrompt ? 'Sophy is thinking...' : 'Want a place to start? Ask Sophy.'}
                  </Text>
                </TouchableOpacity>
              )}

              {isRecording ? (
                <Text style={styles.listening}>
                  {voicePartialText ? `"${voicePartialText}"` : 'Listening. Tap the microphone when you are done.'}
                </Text>
              ) : null}

              <CoachHint markId="textarea" text="Start anywhere. One sentence counts." />
              <TextInput
                style={styles.page}
                placeholder="The page is yours. Nothing here needs to be good. It just needs to be true."
                placeholderTextColor={colors.fontMuted}
                value={journalEntry}
                onChangeText={t => {
                  setJournalEntry(t);
                  if (t.trim()) FirstStepsService.complete('write');
                }}
                multiline
                textAlignVertical="top"
                editable={!saving}
                autoFocus={!params.startVoice}
              />

              {/* Plus voice analysis, dismissible */}
              {emotionalInsights && (
                <Card style={styles.insightsCard}>
                  <Text style={styles.insightsTitle}>Your voice</Text>
                  <View style={styles.insightsRow}>
                    <View style={styles.insightsChip}>
                      <Text style={styles.insightsLabel}>Tone</Text>
                      <Text style={styles.insightsValue}>{emotionalInsights.primaryEmotion || 'Noted'}</Text>
                    </View>
                    <View style={styles.insightsChip}>
                      <Text style={styles.insightsLabel}>Energy</Text>
                      <Text style={styles.insightsValue}>{emotionalInsights.energyLevel || 'Steady'}</Text>
                    </View>
                  </View>
                  {voiceReflection ? (
                    <View style={styles.voiceNote}>
                      <View style={styles.promptTop}>
                        <SophyOrb size={18} />
                        <Text style={styles.promptWho}>SOPHY'S NOTE</Text>
                      </View>
                      <Text style={styles.voiceNoteText}>{voiceReflection}</Text>
                      <TouchableOpacity
                        style={styles.keepNoteRow}
                        onPress={() => setKeepVoiceNote(v => !v)}
                        accessibilityRole="checkbox"
                        accessibilityState={{checked: keepVoiceNote}}>
                        <View style={[styles.keepNoteBox, keepVoiceNote && styles.keepNoteBoxOn]}>
                          {keepVoiceNote ? <CheckIcon size={14} color={colors.fontWhite} /> : null}
                        </View>
                        <Text style={styles.keepNoteText}>Keep Sophy's note with this entry</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                  <TouchableOpacity style={styles.insightsDismiss} onPress={() => setEmotionalInsights(null)}>
                    <Text style={styles.insightsDismissText}>Dismiss</Text>
                  </TouchableOpacity>
                </Card>
              )}
              {!isPremium && usedVoiceRef.current && !isRecording ? (
                <TouchableOpacity onPress={() => checkFeatureAndShowPaywall('ai')}>
                  <Text style={styles.quietLink}>Plus cleans up spoken words. See Plus</Text>
                </TouchableOpacity>
              ) : null}

              {showTagInput && (
                <View style={styles.tagSection}>
                  <Divider />
                  <Text style={styles.toolLabel}>Tags</Text>
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
                          <TouchableOpacity onPress={() => removeTag(tag)} accessibilityLabel={`Remove ${tag}`}>
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
                      placeholder="Add a tag"
                      placeholderTextColor={colors.fontMuted}
                      onSubmitEditing={() => addTag(tagInput)}
                      returnKeyType="done"
                    />
                    <IWButton voice="gray" small title="Add" onPress={() => addTag(tagInput)} />
                  </View>
                </View>
              )}

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
                        <Text style={styles.attachmentSize}>{(file.size / 1024).toFixed(0)} KB</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleRemoveAttachment(index)}
                        style={styles.removeButton}
                        accessibilityLabel={`Remove ${file.name}`}>
                        <Text style={styles.removeButtonText}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ================== GRATITUDE ================== */}
          {mode === 'gratitude' && (
            <View>
              <Text style={styles.modeTitle}>What are you grateful for today?</Text>
              <Text style={styles.modeSubtitle}>{GRATITUDE_SUBTEXT[activeGratPractice]}</Text>

              <View style={styles.pillRowCentered}>
                <Pill label="Three" active={activeGratPractice === 'three'} onPress={() => switchGratPractice('three')} />
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
                </View>
              )}

              {activeGratPractice === 'deep' && (
                <View>
                  <Text style={styles.gratIntroLine}>What happened? Why did it happen? What was your part in it?</Text>
                  <TextInput
                    style={styles.gratTextarea}
                    placeholder="One good thing, in depth..."
                    placeholderTextColor={colors.fontMuted}
                    value={gratDeepText}
                    onChangeText={setGratDeepText}
                    multiline
                    textAlignVertical="top"
                  />
                </View>
              )}

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
                      title={isPremium ? 'From your journal' : 'From your journal (Plus)'}
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
                </View>
              )}

              {activeGratPractice === 'letter' && (
                <View>
                  <TextInput
                    style={styles.letterToInput}
                    placeholder="To (their name)"
                    placeholderTextColor={colors.fontMuted}
                    value={gratLetterTo}
                    onChangeText={setGratLetterTo}
                  />
                  <TextInput
                    style={[styles.gratTextarea, styles.letterTextarea]}
                    placeholder="What did they do? What did it cost them? What did it change for you? The details carry the gratitude."
                    placeholderTextColor={colors.fontMuted}
                    value={gratLetterText}
                    onChangeText={setGratLetterText}
                    multiline
                    textAlignVertical="top"
                  />
                  <View style={styles.gratRowButtons}>
                    <IWButton
                      voice="sophy"
                      small
                      title={isPremium ? 'Ask Sophy for help' : 'Ask Sophy for help (Plus)'}
                      onPress={handleSophyLetterAssist}
                      loading={letterAssistLoading}
                    />
                    <IWButton voice="gray" small title="Copy" onPress={handleCopyGratitudeLetter} />
                    <IWButton voice="gray" small title="Email me" onPress={handleEmailLetterToSelf} />
                  </View>
                  <Text style={styles.helpText}>Sending is optional. Writing it is where the good lives.</Text>
                </View>
              )}

              {activeGratPractice === 'savor' && (
                <View>
                  {gratSavorNudge ? <Text style={styles.savorNudge}>{gratSavorNudge}</Text> : null}
                  <TextInput
                    style={styles.gratTextarea}
                    placeholder="One good moment from today, in full detail..."
                    placeholderTextColor={colors.fontMuted}
                    value={gratSavorText}
                    onChangeText={setGratSavorText}
                    multiline
                    textAlignVertical="top"
                  />
                </View>
              )}

              <TouchableOpacity onPress={() => setShowGratitudeInfo(true)} style={styles.whyLink}>
                <Text style={styles.quietLink}>Why this works</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ================== REFRAME ================== */}
          {mode === 'reframe' && (
            <View>
              <Text style={styles.gratIntroLine}>Four short steps to look at one moment from a second angle.</Text>
              {[
                {label: '1. What happened? Just the facts.', ph: 'Who, what, where. No interpretation yet.', v: reframe1, set: setReframe1},
                {label: '2. What did your mind make it mean?', ph: 'The automatic read, the way it sounded in your head.', v: reframe2, set: setReframe2},
                {label: "3. What supports that read, and what doesn't?", ph: 'Evidence both ways. Be a fair judge.', v: reframe3, set: setReframe3},
                {label: '4. Another honest way to see it?', ph: 'Not forced positivity. A read that fits the facts at least as well.', v: reframe4, set: setReframe4},
              ].map(step => (
                <View key={step.label}>
                  <Text style={styles.reframeLabel}>{step.label}</Text>
                  <TextInput
                    style={styles.reframeInput}
                    placeholder={step.ph}
                    placeholderTextColor={colors.fontMuted}
                    value={step.v}
                    onChangeText={step.set}
                    multiline
                    textAlignVertical="top"
                  />
                </View>
              ))}
            </View>
          )}

          {/* ================== SPRINT ================== */}
          {mode === 'sprint' && (
            <View>
              <Text style={styles.gratIntroLine}>
                A timed, continuous write about whatever is taking up space. Writing about hard things can stir them
                up before it settles them. That is normal. Go at your own depth.
              </Text>
              <View style={styles.sprintControls}>
                <Pill label="15 min" active={sprintMinutes === 15} onPress={() => handleSetSprintDuration(15)} />
                <Pill label="20 min" active={sprintMinutes === 20} onPress={() => handleSetSprintDuration(20)} />
                <IWButton voice="gray" small title={sprintRunning ? 'Stop timer' : 'Start timer'} onPress={toggleSprint} />
              </View>
              {(sprintRunning || sprintDisplay.startsWith('Time.')) && <Text style={styles.sprintTimer}>{sprintDisplay}</Text>}
              {sprintRunning && sprintIdle && (
                <Text style={styles.sprintNudge}>Keep the pen moving. Grammar and sense don't matter here.</Text>
              )}
              <TextInput
                style={styles.page}
                placeholder="Write continuously. Don't stop to fix anything."
                placeholderTextColor={colors.fontMuted}
                value={sprintText}
                onChangeText={handleSprintInput}
                multiline
                textAlignVertical="top"
              />
              <Text style={styles.helpText}>
                The research dose is 3 or 4 sprints on the same topic over a week or two. Keep it early or write past
                the timer. Both are fine.
              </Text>
            </View>
          )}

          {/* ================== INKBLOT ================== */}
          {mode === 'inkblot' && (
            <View>
              <Text style={styles.modeTitle}>Quick thought? Drop an InkBlot.</Text>
              <Text style={styles.modeSubtitle}>A moment, a feeling, a passing thought. Seconds, not minutes.</Text>
              {inkblotRecording ? (
                <Text style={styles.listening}>
                  {voicePartialText ? `"${voicePartialText}"` : 'Listening. Tap the microphone when you are done.'}
                </Text>
              ) : null}
              <TextInput
                style={[styles.page, styles.inkblotPage]}
                placeholder="What's on your mind right now?"
                placeholderTextColor={colors.fontMuted}
                value={inkblotText}
                onChangeText={setInkblotText}
                multiline
                textAlignVertical="top"
                maxLength={500}
              />
              <TouchableOpacity onPress={() => setShowInkblotInfo(true)} style={styles.whyLink}>
                <Text style={styles.quietLink}>Why quick capture works</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <InfoModal
          visible={showGratitudeInfo}
          onClose={() => setShowGratitudeInfo(false)}
          title="Why gratitude works"
          subtitle="Five ways in, rotated so it stays fresh."
          footerText="Notice. Appreciate. Grow.">
          <InfoSection title="What the research shows">
            <InfoParagraph>
              Writing down specific good things is linked with better mood, sleep and relationships. Variety matters:
              doing the same list every day wears off, so InkWell rotates five practices and suggests one each day.
            </InfoParagraph>
          </InfoSection>
          <InfoDivider />
          <InfoSection title="The five practices">
            <InfoHighlightBox title="Three">Three specific good things. Specific beats general. (Emmons and McCullough, 2003)</InfoHighlightBox>
            <InfoHighlightBox title="One, Deeply">One good thing, why it happened, and your part in it. (Seligman and others, 2005)</InfoHighlightBox>
            <InfoHighlightBox title="Without It">Imagine life without something good. It renews its pull. (Koo and others, 2008)</InfoHighlightBox>
            <InfoHighlightBox title="Letter">A letter to someone who helped you. Writing it carries the effect. (Seligman and others, 2005)</InfoHighlightBox>
            <InfoHighlightBox title="Savor">One moment in full detail trains you to notice more of them. (Bryant and Veroff, 2007)</InfoHighlightBox>
          </InfoSection>
        </InfoModal>

        <InfoModal
          visible={showInkblotInfo}
          onClose={() => setShowInkblotInfo(false)}
          title="InkBlot: quick capture"
          subtitle="Get it out of your head before it disappears."
          footerText="Think it. Capture it. Let it go.">
          <InfoSection title="Why quick capture helps">
            <InfoParagraph>
              Not every thought needs a full entry. Writing a passing thought down lets your mind stop holding it, and a
              thirty-second InkBlot beats the perfect entry you never write.
            </InfoParagraph>
            <InfoParagraph>Type or speak up to 500 characters. Messy is fine. Incomplete is fine.</InfoParagraph>
          </InfoSection>
        </InfoModal>
      </ScrollView>

      {/* ─── Footer: a few quiet tools, and Keep ─── */}
      {status ? <Text style={styles.footStatus}>{status}</Text> : null}
      <View style={[styles.wfoot, {paddingBottom: Math.max(insets.bottom, spacing.md)}]}>
        {(mode === 'free' || mode === 'inkblot') && (
          <TouchableOpacity
            style={[styles.tool, (isRecording || inkblotRecording) && styles.toolOn]}
            onPress={mode === 'free' ? handleVoiceToggle : handleInkblotVoiceToggle}
            accessibilityRole="button"
            accessibilityLabel={isRecording || inkblotRecording ? 'Stop listening' : 'Speak it'}>
            <MicIcon color={isRecording || inkblotRecording ? colors.fontWhite : colors.fontSecondary} />
          </TouchableOpacity>
        )}
        {mode === 'free' && (
          <TouchableOpacity
            style={[styles.tool, showTagInput && styles.toolActive]}
            onPress={() => setShowTagInput(v => !v)}
            accessibilityRole="button"
            accessibilityLabel="Add a tag">
            <TagIcon color={colors.fontSecondary} />
          </TouchableOpacity>
        )}
        {mode === 'free' && (
          <TouchableOpacity
            style={styles.tool}
            onPress={handlePickFiles}
            disabled={uploadingFiles}
            accessibilityRole="button"
            accessibilityLabel="Add a photo or file">
            <PhotoIcon color={colors.fontSecondary} />
          </TouchableOpacity>
        )}
        <IWButton title="Keep this" onPress={keepHandler} loading={keepLoading} style={styles.keepBtn} />
      </View>

      {/* Sprint idle cue: breathing teal edge frame. Gated to the sprint surface. */}
      {mode === 'sprint' && sprintRunning && sprintIdle && (
        <Animated.View
          pointerEvents="none"
          style={[styles.sprintBreathFrame, {opacity: sprintBreath.interpolate({inputRange: [0, 1], outputRange: [0.15, 0.9]})}]}
        />
      )}

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
      color: colors.brandEm,
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
      fontSize: 13,
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
      fontSize: 13,
      color: colors.fontSecondary,
      marginBottom: 2,
    },
    insightsValue: {
      fontFamily: fontFamily.button,
      fontSize: 15,
      color: colors.fontMain,
      textTransform: 'capitalize',
    },
    voiceNote: {
      backgroundColor: colors.sophyTint,
      borderColor: colors.sophyBorder,
      borderWidth: 1,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    voiceNoteText: {fontFamily: fontFamily.serif, fontSize: 16, lineHeight: 24, color: colors.fontMain},
    keepNoteRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44},
    keepNoteBox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: colors.sophyBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    keepNoteBoxOn: {backgroundColor: colors.sophyAccent, borderColor: colors.sophyAccent},
    keepNoteText: {fontFamily: fontFamily.body, fontSize: 15, color: colors.fontMain, flex: 1},
    insightsDismiss: {
      alignSelf: 'flex-end',
      padding: spacing.xs,
    },
    insightsDismissText: {
      fontFamily: fontFamily.body,
      fontSize: 13,
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
      fontSize: 13,
      color: colors.fontMuted,
      letterSpacing: 1,
    },
    attachmentInfo: {
      flex: 1,
    },
    attachmentName: {
      fontFamily: fontFamily.body,
      fontSize: 15,
      color: colors.fontMain,
      marginBottom: 2,
    },
    attachmentSize: {
      fontFamily: fontFamily.button,
      fontSize: 13,
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
      fontSize: 15,
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
      fontSize: 15,
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
      fontSize: 15,
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
      fontSize: 15,
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
      fontSize: 15,
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
      fontSize: 15,
      lineHeight: 22,
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
      fontSize: 15,
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
  
    // ── v2.0 Write chrome ──
    wbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      backgroundColor: colors.bgPrimary,
    },
    closeBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      borderWidth: 1,
      borderColor: colors.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    wbarTitle: {fontFamily: fontFamily.bodyBold, fontSize: 16, color: colors.fontMain},
    wbarCount: {
      fontFamily: fontFamily.body,
      fontSize: 14,
      color: colors.fontMuted,
      minWidth: 38,
      textAlign: 'right',
      fontVariant: ['tabular-nums'],
    },
    modeStrip: {flexGrow: 0, backgroundColor: colors.bgPrimary},
    modeStripInner: {paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm},
    promptCard: {
      backgroundColor: colors.sophyTint,
      borderColor: colors.sophyBorder,
      borderWidth: 1,
      borderRadius: borderRadius.xl,
      padding: spacing.base,
      marginBottom: spacing.lg,
    },
    promptTop: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm},
    promptWho: {fontFamily: fontFamily.bodyBold, fontSize: 13, letterSpacing: 1.6, color: colors.sophyLight, flex: 1},
    promptX: {padding: 2},
    promptText: {fontFamily: fontFamily.serifItalic, fontStyle: 'italic', fontSize: 17, lineHeight: 25, color: colors.fontMain},
    askRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg, minHeight: 44},
    askText: {fontFamily: fontFamily.body, fontSize: 15, color: colors.sophyLight},
    listening: {
      fontFamily: fontFamily.serifItalic,
      fontStyle: 'italic',
      fontSize: 16,
      color: colors.fontSecondary,
      marginBottom: spacing.base,
    },
    page: {
      fontFamily: fontFamily.serif,
      fontSize: 19,
      lineHeight: 31,
      color: colors.fontMain,
      minHeight: 300,
      paddingTop: 0,
      paddingHorizontal: 0,
      marginBottom: spacing.lg,
    },
    inkblotPage: {minHeight: 180},
    quietLink: {fontFamily: fontFamily.body, fontSize: 15, color: colors.brandPrimary, paddingVertical: spacing.sm},
    whyLink: {alignSelf: 'center', marginTop: spacing.base},
    toolLabel: {fontFamily: fontFamily.bodyBold, fontSize: 15, color: colors.fontMain, marginBottom: spacing.sm},
    footStatus: {
      fontFamily: fontFamily.body,
      fontSize: 15,
      color: colors.fontSecondary,
      textAlign: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      backgroundColor: colors.bgPrimary,
    },
    wfoot: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.base,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
      backgroundColor: colors.bgPrimary,
    },
    tool: {
      width: 44,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    toolOn: {backgroundColor: colors.btnPrimary, borderColor: colors.btnPrimary},
    toolActive: {borderColor: colors.brandPrimary},
    keepBtn: {marginLeft: 'auto', minWidth: 132},
  });

export default WriteScreen;
