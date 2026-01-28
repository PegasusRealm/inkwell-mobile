import React, {useState, useRef, useEffect, useMemo} from 'react';
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
  Linking,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import {Picker} from '@react-native-picker/picker';
import auth from '@react-native-firebase/auth';
import Voice, {
  SpeechResultsEvent,
  SpeechErrorEvent,
} from '@react-native-voice/voice';
import DocumentPicker from 'react-native-document-picker';
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
import OnboardingTip from '../components/OnboardingTip';
import {useOnboarding} from '../hooks/useOnboarding';
import type {TabScreenProps} from '../navigation/types';

const JournalScreen: React.FC<TabScreenProps<'Journal'>> = ({navigation}) => {
  // Theme hook for dynamic theming
  const {colors, isDark} = useTheme();
  
  // Create styles with current theme colors
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  // Subscription hook for feature gating
  const {
    checkFeatureAndShowPaywall,
    hasFeatureAccess,
    isPremium,
    isConnect,
    showPaywall,
    closePaywall,
  } = useSubscription();

  // Onboarding hook for first-time users
  const {shouldShowTip, markTipShown, getTip, markMilestone} = useOnboarding();
  const [showOnboardingTip, setShowOnboardingTip] = useState(false);

  // Show onboarding tip after a short delay on first visit
  useEffect(() => {
    const timer = setTimeout(() => {
      if (shouldShowTip('journal_intro')) {
        setShowOnboardingTip(true);
      }
    }, 1500); // 1.5 second delay per best practices
    return () => clearTimeout(timer);
  }, [shouldShowTip]);

  const handleDismissOnboarding = async () => {
    setShowOnboardingTip(false);
    await markTipShown('journal_intro');
  };

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

  // Prompt Section state
  const [promptTopic, setPromptTopic] = useState('');
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [savePromptChecked, setSavePromptChecked] = useState(false);
  const [generatingPrompt, setGeneratingPrompt] = useState(false);

  // InkOutLoud Voice Recording state (using native speech recognition)
  const [isRecording, setIsRecording] = useState(false);
  const [voiceText, setVoiceText] = useState(''); // Current recognized text
  const [voicePartialText, setVoicePartialText] = useState(''); // Partial results while speaking

  // File Attachments state
  const [attachments, setAttachments] = useState<Array<{uri: string; name: string; type: string; size: number}>>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  // Journal state
  const [journalEntry, setJournalEntry] = useState('');
  const [saving, setSaving] = useState(false);

  // Sophy Reflection state
  const [sophyReflection, setSophyReflection] = useState('');
  const [saveReflectionChecked, setSaveReflectionChecked] = useState(false);
  const [generatingReflection, setGeneratingReflection] = useState(false);

  // Emotional Insights state (from voice analysis)
  const [emotionalInsights, setEmotionalInsights] = useState<{
    primaryEmotion?: string;
    confidence?: number;
    energyLevel?: string;
    stressLevel?: string;
    sophyInsight?: string;
  } | null>(null);

  // AI Usage tracking state
  const [aiCallsRemaining, setAiCallsRemaining] = useState<number>(AI_DAILY_LIMIT);
  
  // Load AI usage on mount
  useEffect(() => {
    const loadAIUsage = async () => {
      if (!isPremium) {
        const remaining = await getRemainingAICalls();
        setAiCallsRemaining(remaining);
      }
    };
    loadAIUsage();
  }, [isPremium]);

  // Practitioner send state
  const [sendToPractitioner, setSendToPractitioner] = useState(false);
  const [selectedPractitionerId, setSelectedPractitionerId] = useState<string>('');
  const [practitioners, setPractitioners] = useState<Array<{id: string; name: string; email: string}>>([]);
  const [loadingPractitioners, setLoadingPractitioners] = useState(false);

  // AI gating helper - checks access and shows appropriate message
  const checkAndUseAI = async (featureName: string): Promise<boolean> => {
    // Check if user has AI feature access (Plus/Connect have unlimited)
    // This properly awaits subscription initialization
    const hasUnlimitedAI = await hasFeatureAccess('ai');
    console.log(`🔐 AI Gating: hasUnlimitedAI=${hasUnlimitedAI} for ${featureName}`);
    
    if (hasUnlimitedAI) {
      return true;
    }
    
    // Free user - check daily limit
    const access = await checkAIAccess();
    console.log(`🔐 AI Gating: Free user check - canUse=${access.canUse}, remaining=${access.remaining}`);
    
    if (!access.canUse) {
      Alert.alert(
        'Daily Limit Reached',
        `You've used all ${AI_DAILY_LIMIT} free AI calls today. Upgrade to Plus for unlimited access to Sophy's insights!`,
        [
          { text: 'Maybe Later', style: 'cancel' },
          { text: 'Upgrade', onPress: () => checkFeatureAndShowPaywall('ai') },
        ]
      );
      return false;
    }
    return true;
  };

  // Update remaining count after AI use
  const afterAIUse = async () => {
    // Only track usage for free users
    const hasUnlimitedAI = await hasFeatureAccess('ai');
    if (!hasUnlimitedAI) {
      await incrementAIUsage();
      const remaining = await getRemainingAICalls();
      setAiCallsRemaining(remaining);
    }
  };

  const handleGeneratePrompt = async () => {
    // Check AI access for free users
    const canProceed = await checkAndUseAI('prompt generation');
    if (!canProceed) return;

    setGeneratingPrompt(true);
    setGeneratedPrompt(''); // Clear previous prompt
    
    try {
      const prompt = await generatePrompt(promptTopic);
      setGeneratedPrompt(prompt);
      setSavePromptChecked(true); // Auto-check to save prompt
      await afterAIUse(); // Track usage
    } catch (error: any) {
      console.error('Error generating prompt:', error);
      Alert.alert(
        'Error', 
        error.message || 'Failed to generate prompt. Please try again.'
      );
    } finally {
      setGeneratingPrompt(false);
    }
  };

  const handleGetReflection = async () => {
    // Check AI access for free users
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
    setSophyReflection(''); // Clear previous reflection

    try {
      const reflection = await getReflection(journalEntry);
      setSophyReflection(reflection);
      await afterAIUse(); // Track usage;
      setSaveReflectionChecked(true); // Auto-check to save reflection
    } catch (error: any) {
      console.error('Error getting reflection:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to get reflection. Please try again.',
      );
    } finally {
      setGeneratingReflection(false);
    }
  };

  // Load practitioners when component mounts
  useEffect(() => {
    loadPractitioners();
  }, []);

  const loadPractitioners = async () => {
    const user = auth().currentUser;
    if (!user) return;

    setLoadingPractitioners(true);
    try {
      // Get user's document to find their practitioners
      const userDoc = await firestore().collection('users').doc(user.uid).get();
      const userData = userDoc.data();
      
      if (!userData?.practitioners || userData.practitioners.length === 0) {
        setPractitioners([]);
        return;
      }

      // Load practitioner details
      const practitionerDocs = await Promise.all(
        userData.practitioners.map((practId: string) =>
          firestore().collection('practitioners').doc(practId).get()
        )
      );

      const loadedPractitioners = practitionerDocs
        .filter(doc => doc.exists)
        .map(doc => ({
          id: doc.id,
          name: doc.data()?.displayName || doc.data()?.email || 'Coach',
          email: doc.data()?.email || '',
        }));

      setPractitioners(loadedPractitioners);
      
      // Auto-select first practitioner if available
      if (loadedPractitioners.length > 0 && !selectedPractitionerId) {
        setSelectedPractitionerId(loadedPractitioners[0].id);
      }
    } catch (error) {
      console.error('Error loading practitioners:', error);
    } finally {
      setLoadingPractitioners(false);
    }
  };

  // ==================== InkOutLoud Voice Recognition ====================
  
  // Set up Voice recognition listeners
  useEffect(() => {
    // Handle final speech results
    Voice.onSpeechResults = (e: SpeechResultsEvent) => {
      console.log('🎙️ Speech results:', e.value);
      if (e.value && e.value[0]) {
        setVoiceText(e.value[0]);
      }
    };

    // Handle partial results (while speaking)
    Voice.onSpeechPartialResults = (e: SpeechResultsEvent) => {
      if (e.value && e.value[0]) {
        setVoicePartialText(e.value[0]);
      }
    };

    // Handle speech errors
    Voice.onSpeechError = (e: SpeechErrorEvent) => {
      console.error('Speech error:', e.error);
      setIsRecording(false);
      // Don't show alert for common "no speech" errors
      if (e.error?.message && !e.error.message.includes('No speech')) {
        Alert.alert('Speech Error', 'Could not recognize speech. Please try again.');
      }
    };

    // Handle end of speech
    Voice.onSpeechEnd = () => {
      console.log('🎙️ Speech ended');
      setIsRecording(false);
    };

    // Cleanup listeners on unmount
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
    console.log('🎙️ Starting voice recognition...');
    
    const hasPermission = await requestMicrophonePermission();
    if (!hasPermission) {
      Alert.alert('Permission Denied', 'Microphone access is required for InkOutLoud.');
      return;
    }

    try {
      setVoiceText('');
      setVoicePartialText('');
      await Voice.start('en-US');
      setIsRecording(true);
    } catch (error: any) {
      console.error('Voice start error:', error);
      Alert.alert(
        'Voice Recognition Failed',
        'Could not start voice recognition. Please try again.',
      );
    }
  };

  const handleStopRecording = async () => {
    try {
      await Voice.stop();
      setIsRecording(false);
      
      // Get the final recognized text
      const recognizedText = voiceText || voicePartialText;
      
      if (!recognizedText || recognizedText.trim().length === 0) {
        Alert.alert('No Speech Detected', 'Please try speaking again.');
        return;
      }
      
      console.log('🎙️ Recognized text:', recognizedText);
      
      // Check if user has Plus for AI cleanup + emotional analysis
      if (isPremium) {
        // Plus/Connect users get AI cleanup and emotional analysis
        Alert.alert(
          'Processing Voice...',
          'Enhancing your text with AI and analyzing emotional patterns.',
        );
        
        try {
          // Send transcript to cloud function for AI cleanup and emotional analysis
          const transcriptionResult = await transcribeVoice(recognizedText);
          
          // Insert cleaned text into journal entry
          setJournalEntry(
            (prevText) =>
              prevText + (prevText ? ' ' : '') + transcriptionResult.cleanedText,
          );
          
          // Store emotional insights for display
          if (transcriptionResult.emotionalInsights) {
            setEmotionalInsights(transcriptionResult.emotionalInsights);
            
            // Also set Sophy's reflection if available
            if (transcriptionResult.emotionalInsights.sophyInsight) {
              setSophyReflection(transcriptionResult.emotionalInsights.sophyInsight);
              setSaveReflectionChecked(true);
            }
            
            // Show alert with emotional analysis summary
            const { primaryEmotion, energyLevel, stressLevel } = transcriptionResult.emotionalInsights;
            Alert.alert(
              '✨ Voice Analysis Complete',
              `Tone: ${primaryEmotion || 'Detected'}\nEnergy: ${energyLevel || 'Analyzed'}\nStress: ${stressLevel || 'Assessed'}\n\nYour entry has been enhanced with AI grammar cleanup. Scroll down to see Sophy's emotional reflection.`,
            );
          } else {
            Alert.alert(
              '✨ Voice Processed!',
              'Your voice has been transcribed with clean grammar.',
            );
          }
        } catch (transcriptionError: any) {
          console.error('AI processing error:', transcriptionError);
          // Fall back to raw text if AI fails
          setJournalEntry(
            (prevText) => prevText + (prevText ? ' ' : '') + recognizedText,
          );
          Alert.alert('Note', 'Voice added. AI enhancement unavailable.');
        }
      } else {
        // Free users get raw transcription directly inserted
        setJournalEntry(
          (prevText) => prevText + (prevText ? ' ' : '') + recognizedText,
        );
        
        Alert.alert(
          '🎙️ Voice Added!',
          'Your words have been added. Upgrade to Plus for AI grammar cleanup and emotional insights!',
          [
            { text: 'Got It', style: 'cancel' },
            { text: 'Learn More', onPress: () => checkFeatureAndShowPaywall('ai') },
          ]
        );
      }
      
      // Clear voice state
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

  // File Attachment Functions
  const handlePickFiles = async () => {
    // 🚨 FEATURE GATE: File uploads require Plus subscription
    const hasAccess = await checkFeatureAndShowPaywall('fileUpload');
    if (!hasAccess) {
      return; // Paywall will show automatically
    }

    try {
      const results = await DocumentPicker.pick({
        allowMultiSelection: true,
        type: [DocumentPicker.types.images, DocumentPicker.types.pdf],
      });

      // Validate file sizes (10MB max per file)
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
      const validFiles = results.filter(file => {
        if (file.size && file.size > MAX_FILE_SIZE) {
          Alert.alert(
            'File Too Large',
            `${file.name} is too large (max 10MB). It will be skipped.`,
          );
          return false;
        }
        return true;
      });

      setAttachments(prev => [...prev, ...validFiles.map(f => ({
        uri: f.uri,
        name: f.name || 'file',
        type: f.type || 'application/octet-stream',
        size: f.size || 0,
      }))]);
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

  const uploadAttachments = async (): Promise<Array<{url: string; name: string}>> => {
    if (attachments.length === 0) return [];

    const user = auth().currentUser;
    if (!user) throw new Error('User not authenticated');

    const uploadedAttachments: Array<{url: string; name: string}> = [];

    for (const file of attachments) {
      try {
        const fileName = `${user.uid}/${Date.now()}_${file.name}`;
        const reference = storage().ref(fileName);
        
        await reference.putFile(file.uri);
        const url = await reference.getDownloadURL();
        
        uploadedAttachments.push({url, name: file.name});
      } catch (uploadError) {
        console.error('Upload error for', file.name, uploadError);
        // Continue with other files even if one fails
      }
    }

    return uploadedAttachments;
  };

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
          Alert.alert(
            'Upload Warning',
            'Some files failed to upload but entry will still be saved.',
          );
        } finally {
          setUploadingFiles(false);
        }
      }

      // Check for today's manifest data to auto-include
      let manifestData = null;
      let hasManifestData = false;
      try {
        const today = new Date().toISOString().split('T')[0];
        const manifestSnapshot = await firestore()
          .collection('manifest')
          .where('userId', '==', user.uid)
          .where('date', '==', today)
          .limit(1)
          .get();
        
        if (!manifestSnapshot.empty) {
          const manifestDoc = manifestSnapshot.docs[0].data();
          const wish = manifestDoc.want || '';
          const outcome = manifestDoc.imagine || '';
          const opposition = manifestDoc.snags || '';
          const plan = manifestDoc.how || '';
          
          if (wish || outcome || opposition || plan) {
            hasManifestData = true;
            manifestData = {
              wish,
              outcome,
              opposition,
              plan,
            };
            console.log('✨ Auto-including manifest data from today:', manifestData);
          }
        }
      } catch (manifestError) {
        console.log('No manifest data found for today:', manifestError);
      }

      // Initialize tags array for auto-generated tags
      const tagsArray: string[] = [];
      
      // Add manifest tags if manifest data exists
      if (hasManifestData) {
        tagsArray.push('manifest', 'manifesting');
        const today = new Date().toISOString().split('T')[0];
        tagsArray.push(`manifestDate:${today}`);
      }

      // Save to Firestore
      const entryData: any = {
        text: journalEntry,
        userId: user.uid,
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };

      // Add tags if present
      if (tagsArray.length > 0) {
        entryData.tags = tagsArray;
      }

      // Add manifest data if found
      if (hasManifestData && manifestData) {
        entryData.manifestData = manifestData;
        entryData.contextManifest = `${manifestData.wish} | ${manifestData.outcome} | ${manifestData.opposition} | ${manifestData.plan}`;
      }

      // Add optional fields
      if (savePromptChecked && generatedPrompt) {
        entryData.promptUsed = generatedPrompt;
      }
      if (saveReflectionChecked && sophyReflection) {
        entryData.reflectionUsed = sophyReflection;
      }
      if (sendToPractitioner && selectedPractitionerId) {
        entryData.coachReview = true;
        entryData.practitionerId = selectedPractitionerId;
        entryData.practitionerReviewed = false;
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
              'Authorization': `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              text: journalEntry,
              entryId: savedEntry.id,
            }),
          });
          console.log('Entry embeddings generated');
        } catch (embedError) {
          console.warn('Embedding error (non-blocking):', embedError);
        }
      })();

      // Notify practitioner if tagged
      if (sendToPractitioner && selectedPractitionerId) {
        try {
          const practitioner = practitioners.find(p => p.id === selectedPractitionerId);
          const idToken = await user.getIdToken();
          
          const endpoint = __DEV__
            ? 'http://localhost:5001/inkwell-alpha/us-central1/notifyCoachOfTaggedEntry'
            : 'https://us-central1-inkwell-alpha.cloudfunctions.net/notifyCoachOfTaggedEntry';
          
          await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              entryId: savedEntry.id,
              practitionerEmail: practitioner?.email,
              practitionerName: practitioner?.name,
              userEmail: user.email,
              entryPreview: journalEntry.substring(0, 100),
            }),
          });
          
          console.log('Practitioner notification sent');
        } catch (notifyError) {
          console.error('Failed to notify practitioner:', notifyError);
          // Don't fail the save if notification fails
        }
      }

      const successMessage = hasManifestData 
        ? 'Journal entry saved with manifest data!' 
        : 'Journal entry saved successfully!';
      Alert.alert('Success', successMessage);

      // Clear form after successful save
      setJournalEntry('');
      setGeneratedPrompt('');
      setSophyReflection('');
      setEmotionalInsights(null);
      setPromptTopic('');
      setSavePromptChecked(false);
      setSaveReflectionChecked(false);
      setSendToPractitioner(false);
      setSelectedPractitionerId(practitioners.length > 0 ? practitioners[0].id : '');
      setAttachments([]);
      setAttachments([]);
    } catch (error: any) {
      console.error('Error saving entry:', error);
      Alert.alert('Error', 'Failed to save entry. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Prompt Section */}
        <Text style={styles.sophyIntro}>
          Meet <Text style={styles.sophyName}>Sophy</Text> — your gentle journaling companion. Trained in wellness and psychology, she's here to offer insight and reflection (never instructions or "have-tos") to help you discover more from your journaling practice.
        </Text>
        <Text style={styles.subtextMuted}>
          If you want a topic or some inspiration, Sophy can suggest ideas — you can even give her a topic to focus on.
        </Text>

        <TextInput
          style={styles.promptInput}
          placeholder="e.g., burnout last week, goals, feeling stuck"
          placeholderTextColor={colors.fontMuted}
          value={promptTopic}
          onChangeText={setPromptTopic}
        />

        <TouchableOpacity
          style={[styles.sophyButton, generatingPrompt && styles.sophyButtonDisabled]}
          onPress={handleGeneratePrompt}
          disabled={generatingPrompt}>
          <Text style={styles.sophyButtonText}>
            {generatingPrompt ? 'Generating...' : 'Ask Sophy for a Prompt'}
          </Text>
        </TouchableOpacity>

        {generatedPrompt ? (
          <View style={styles.promptDisplay}>
            <Text style={styles.promptText}>{generatedPrompt}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.checkboxContainer}
          onPress={() => {
            const newChecked = !savePromptChecked;
            setSavePromptChecked(newChecked);
            if (newChecked && generatedPrompt) {
              // Auto-insert prompt into journal entry
              setJournalEntry(prev => {
                const prefix = prev.trim() ? prev + '\n\n' : '';
                return prefix + `Prompt: ${generatedPrompt}`;
              });
            }
          }}>
          <View style={[styles.checkbox, savePromptChecked && styles.checkboxChecked]}>
            {savePromptChecked && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>
            Save this Prompt in my Journal Entry
          </Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider} />

        {/* InkOutLoud Voice Recording Section */}
        <TouchableOpacity
          style={[
            styles.voiceButton,
            isRecording && styles.voiceButtonRecording,
          ]}
          onPress={handleVoiceToggle}>
          <Text style={styles.voiceButtonText}>
            {isRecording ? '🛑 Stop Listening' : '🎙️ InkOutLoud'}
          </Text>
        </TouchableOpacity>

        {!isRecording && (
          <>
            <Text style={styles.voiceHint}>Tap to voice transcribe</Text>
            {!isPremium && (
              <Text style={styles.voiceHintPlus}>✨ Plus offers AI grammar cleanup & emotional reflection</Text>
            )}
          </>
        )}

        {isRecording && (
          <View>
            <Text style={styles.voiceStatus}>
              🎤 Listening... Speak now
            </Text>
            {voicePartialText ? (
              <Text style={styles.voicePartialText}>
                "{voicePartialText}"
              </Text>
            ) : null}
          </View>
        )}

        {/* Emotional Insights Display (from voice analysis) */}
        {emotionalInsights && (
          <View style={styles.emotionalInsightsContainer}>
            <Text style={styles.emotionalInsightsTitle}>🎭 Voice Emotional Analysis</Text>
            <View style={styles.emotionalInsightsRow}>
              <View style={styles.emotionalInsightsChip}>
                <Text style={styles.emotionalInsightsLabel}>Tone</Text>
                <Text style={styles.emotionalInsightsValue}>
                  {emotionalInsights.primaryEmotion || 'Detected'} {emotionalInsights.confidence ? `(${emotionalInsights.confidence}%)` : ''}
                </Text>
              </View>
              <View style={styles.emotionalInsightsChip}>
                <Text style={styles.emotionalInsightsLabel}>Energy</Text>
                <Text style={styles.emotionalInsightsValue}>{emotionalInsights.energyLevel || 'Normal'}</Text>
              </View>
              <View style={styles.emotionalInsightsChip}>
                <Text style={styles.emotionalInsightsLabel}>Stress</Text>
                <Text style={styles.emotionalInsightsValue}>{emotionalInsights.stressLevel || 'Normal'}</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.emotionalInsightsDismiss}
              onPress={() => setEmotionalInsights(null)}>
              <Text style={styles.emotionalInsightsDismissText}>✕ Dismiss</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Divider */}
        <View style={styles.divider} />

        {/* Journal Entry Section */}
        <Text style={styles.journalHeading}>Journal Entry</Text>
        
        <Text style={styles.subtitle}>
          What's on your mind today? Write freely and honestly.
        </Text>

        <TextInput
          style={styles.textArea}
          placeholder="Start writing your thoughts here..."
          placeholderTextColor="#93A5A8"
          value={journalEntry}
          onChangeText={setJournalEntry}
          multiline
          textAlignVertical="top"
          editable={!saving}
        />

        {/* Character Count */}
        <Text style={styles.characterCount}>
          {journalEntry.length} characters
        </Text>

        {/* Sophy Reflection Section */}
        <TouchableOpacity
          style={[
            styles.sophyButton,
            generatingReflection && styles.sophyButtonDisabled,
          ]}
          onPress={handleGetReflection}
          disabled={generatingReflection || !journalEntry.trim()}>
          <Text style={styles.sophyButtonText}>
            {generatingReflection
              ? 'Reflecting...'
              : 'Ask Sophy for Reflection'}
          </Text>
        </TouchableOpacity>

        {sophyReflection ? (
          <View style={styles.reflectionDisplay}>
            <Text style={styles.reflectionText}>{sophyReflection}</Text>
          </View>
        ) : null}

        {sophyReflection ? (
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => {
              const newChecked = !saveReflectionChecked;
              setSaveReflectionChecked(newChecked);
              if (newChecked && sophyReflection) {
                // Auto-insert reflection into journal entry
                setJournalEntry(prev => {
                  const prefix = prev.trim() ? prev + '\n\n' : '';
                  return prefix + `Sophy's Reflection: ${sophyReflection}`;
                });
              }
            }}>
            <View
              style={[
                styles.checkbox,
                saveReflectionChecked && styles.checkboxChecked,
              ]}>
              {saveReflectionChecked && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>
              Save this Reflection in my Journal Entry
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Divider */}
        <View style={styles.divider} />

        {/* File Attachments Section */}
        <View style={styles.sectionLabelRow}>
          <Text style={styles.sectionLabel}>Attach Photos or Files</Text>
          {!isPremium && (
            <View style={styles.plusBadge}>
              <Text style={styles.plusBadgeText}>Plus</Text>
            </View>
          )}
        </View>
        {isPremium && (
          <Text style={styles.subtitle}>
            Enrich your entry with images or documents (max 10MB per file)
          </Text>
        )}

        <TouchableOpacity
          style={[styles.attachButton, !isPremium && styles.attachButtonLocked]}
          onPress={handlePickFiles}
          disabled={uploadingFiles}>
          <Text style={styles.attachButtonText}>
            {uploadingFiles ? 'Uploading...' : isPremium ? '📎 Select Files' : '🔒 Upgrade to Attach Files'}
          </Text>
        </TouchableOpacity>

        {/* Attachment Previews */}
        {attachments.length > 0 && (
          <View style={styles.attachmentPreview}>
            {attachments.map((file, index) => (
              <View key={index} style={styles.attachmentItem}>
                {file.type?.startsWith('image/') ? (
                  <Image
                    source={{uri: file.uri}}
                    style={styles.attachmentImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.attachmentFileIcon}>
                    <Text style={styles.fileIconText}>📄</Text>
                  </View>
                )}
                <View style={styles.attachmentInfo}>
                  <Text style={styles.attachmentName} numberOfLines={1}>
                    {file.name}
                  </Text>
                  <Text style={styles.attachmentSize}>
                    {(file.size / 1024).toFixed(1)} KB
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleRemoveAttachment(index)}
                  style={styles.removeButton}>
                  <Text style={styles.removeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Divider */}
        <View style={styles.divider} />

        {/* Send to Coach */}
        <View style={styles.sectionLabelRow}>
          <Text style={styles.checkboxLabel}>📬 Send to Coach</Text>
          {!isConnect && (
            <View style={[styles.plusBadge, styles.connectBadge]}>
              <Text style={styles.plusBadgeText}>Connect</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={[styles.checkboxContainer, !isConnect && styles.checkboxContainerLocked]}
          onPress={async () => {
            // 🚨 FEATURE GATE: Practitioner connection requires Connect subscription
            const hasAccess = await checkFeatureAndShowPaywall('practitioner');
            if (!hasAccess) return;
            setSendToPractitioner(!sendToPractitioner);
          }}>
          <View
            style={[
              styles.checkbox,
              sendToPractitioner && styles.checkboxChecked,
            ]}>
            {sendToPractitioner && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>
            {isConnect ? 'Send this entry to my coach' : '🔒 Upgrade to Connect to share with coaches'}
          </Text>
        </TouchableOpacity>

        {/* Practitioner Dropdown - Only show if checkbox is checked */}
        {sendToPractitioner && (
          <View style={styles.practitionerSection}>
            {loadingPractitioners ? (
              <ActivityIndicator size="small" color={colors.brandPrimary} />
            ) : practitioners.length === 0 ? (
              <View style={styles.noPractitionersContainer}>
                <Text style={styles.noPractitionersText}>
                  ⚠️ No coaches found. Add a coach in Settings to share entries.
                </Text>
                <TouchableOpacity
                  style={styles.goToSettingsButton}
                  onPress={() => navigation.navigate('Settings')}>
                  <Text style={styles.goToSettingsButtonText}>
                    Go to Settings
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <Text style={styles.pickerLabel}>Select Coach:</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={selectedPractitionerId}
                    onValueChange={(value) => setSelectedPractitionerId(value)}
                    style={styles.picker}>
                    {practitioners.map((pract) => (
                      <Picker.Item
                        key={pract.id}
                        label={`${pract.name} (${pract.email})`}
                        value={pract.id}
                      />
                    ))}
                  </Picker>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}>
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save Journal Entry'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.helpText}>
          Your journal entries are private and only visible to you and any
          coaches you choose to share with.
        </Text>
      </View>

      {/* Paywall Modal */}
      <PaywallModal
        visible={showPaywall}
        onClose={closePaywall}
      />

      {/* Onboarding Tip for first-time users */}
      <OnboardingTip
        visible={showOnboardingTip}
        icon={getTip('journal_intro').icon}
        title={getTip('journal_intro').title}
        message={getTip('journal_intro').message}
        actionLabel={getTip('journal_intro').actionLabel}
        onDismiss={handleDismissOnboarding}
      />
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
    marginBottom: spacing.lg,
  },
  
  // Prompt Section Styles
  sophyIntro: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: colors.fontSecondary,
    marginTop: spacing.base,
    marginBottom: spacing.sm,
    lineHeight: 24,
  },
  subtextMuted: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: colors.fontSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.base,
    lineHeight: 24,
  },
  sophyName: {
    fontFamily: fontFamily.bodyBold,
    color: colors.sophyAccent,
  },
  promptInput: {
    fontFamily: fontFamily.body,
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    fontSize: fontSize.md,
    color: colors.fontMain,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    marginBottom: spacing.base,
  },
  sophyButton: {
    backgroundColor: colors.sophyAccent,
    paddingVertical: spacing.base,
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
  promptDisplay: {
    backgroundColor: colors.sophyAccent,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  promptText: {
    fontFamily: fontFamily.body,
    color: colors.fontWhite,
    fontSize: fontSize.base,
    lineHeight: 24,
  },
  reflectionDisplay: {
    backgroundColor: colors.bgSection,
    borderRadius: borderRadius.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.sophyAccent,
    padding: spacing.base,
    marginTop: spacing.base,
    marginBottom: spacing.base,
  },
  reflectionText: {
    fontFamily: fontFamily.body,
    color: colors.fontMain,
    fontSize: fontSize.base,
    lineHeight: 24,
    fontStyle: 'italic',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.base,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.borderMedium,
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
  checkboxLabel: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.fontSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderMedium,
    marginVertical: spacing.xl,
  },

  // InkOutLoud Voice Recording Styles
  voiceButton: {
    backgroundColor: colors.brandPrimary,
    paddingVertical: spacing.base,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  voiceButtonRecording: {
    backgroundColor: colors.btnDanger,
  },
  voiceButtonText: {
    fontFamily: fontFamily.buttonBold,
    color: colors.fontWhite,
    fontSize: fontSize.md,
    letterSpacing: 0.5,
  },
  voiceHint: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.fontSecondary,
    textAlign: 'center',
    marginTop: -spacing.xs,
  },
  voiceHintPlus: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.tierPlus,
    textAlign: 'center',
    marginBottom: spacing.base,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  voiceStatus: {
    fontFamily: fontFamily.button,
    fontSize: fontSize.sm,
    color: colors.brandPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  voicePartialText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
    color: colors.fontSecondary,
    textAlign: 'center',
    marginBottom: spacing.base,
    fontStyle: 'italic',
    paddingHorizontal: spacing.lg,
  },

  // Emotional Insights Display Styles
  emotionalInsightsContainer: {
    backgroundColor: 'rgba(42, 105, 114, 0.1)',
    borderRadius: borderRadius.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.brandPrimary,
    padding: spacing.base,
    marginTop: spacing.base,
    marginBottom: spacing.base,
  },
  emotionalInsightsTitle: {
    fontFamily: fontFamily.button,
    fontSize: fontSize.md,
    color: colors.brandPrimary,
    marginBottom: spacing.sm,
  },
  emotionalInsightsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  emotionalInsightsChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    minWidth: 80,
  },
  emotionalInsightsLabel: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.fontSecondary,
  },
  emotionalInsightsValue: {
    fontFamily: fontFamily.button,
    fontSize: fontSize.sm,
    color: colors.fontMain,
    textTransform: 'capitalize',
  },
  emotionalInsightsDismiss: {
    alignSelf: 'flex-end',
    padding: spacing.xs,
  },
  emotionalInsightsDismissText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.fontSecondary,
  },
  
  // Journal Entry Section Styles
  journalHeading: {
    fontFamily: fontFamily.header,
    fontSize: fontSize.xxxl,
    color: colors.fontMain,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  subtitle: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
    color: colors.fontSecondary,
    marginBottom: spacing.xl,
  },
  textArea: {
    fontFamily: fontFamily.body,
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    fontSize: fontSize.md,
    color: colors.fontMain,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    minHeight: 300,
    marginBottom: spacing.lg,
  },
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
  characterCount: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.fontMuted,
    textAlign: 'right',
    marginBottom: spacing.sm,
  },
  helpText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.fontMuted,
    lineHeight: 22,
    textAlign: 'center',
  },
  
  // File Attachment Styles
  sectionLabel: {
    fontFamily: fontFamily.header,
    fontSize: fontSize.md,
    color: colors.fontMain,
    marginBottom: spacing.sm,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
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
  connectBadge: {
    backgroundColor: colors.tierConnect,
  },
  attachButton: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderStyle: 'dashed',
    paddingVertical: spacing.base,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  attachButtonLocked: {
    borderColor: colors.borderLight,
    backgroundColor: colors.bgMuted,
  },
  attachButtonText: {
    fontFamily: fontFamily.button,
    color: colors.brandPrimary,
    fontSize: fontSize.md,
  },
  checkboxContainerLocked: {
    opacity: 0.7,
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
    fontSize: fontSize.xxl,
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
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.btnDanger + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: colors.btnDanger,
    fontSize: fontSize.lg,
  },
  
  // Practitioner Selection Styles
  practitionerSection: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.base,
    marginTop: spacing.sm,
    marginBottom: spacing.base,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  noPractitionersContainer: {
    alignItems: 'center',
    padding: spacing.sm,
  },
  noPractitionersText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.fontSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
    lineHeight: 22,
  },
  goToSettingsButton: {
    backgroundColor: colors.brandPrimary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    borderRadius: borderRadius.md,
  },
  goToSettingsButtonText: {
    fontFamily: fontFamily.buttonBold,
    color: colors.fontWhite,
    fontSize: fontSize.sm,
    letterSpacing: 0.5,
  },
  pickerLabel: {
    fontFamily: fontFamily.button,
    fontSize: fontSize.sm,
    color: colors.fontMain,
    marginBottom: spacing.xs,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: borderRadius.md,
    backgroundColor: colors.bgCard,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  tagsInput: {
    fontFamily: fontFamily.body,
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.base,
    fontSize: fontSize.md,
    color: colors.fontMain,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    marginBottom: spacing.xs,
  },
  tagsHint: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.brandPrimary,
    marginBottom: spacing.base,
    fontStyle: 'italic',
  },
});

export default JournalScreen;
