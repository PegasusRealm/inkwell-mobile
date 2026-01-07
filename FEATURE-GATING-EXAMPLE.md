# Feature Gating Implementation Example

## Quick Example: AI Prompt Gating in JournalScreen

Add this to `JournalScreen.tsx` to gate AI prompts for free users:

```tsx
// Add to imports
import { useSubscription } from '../hooks/useSubscription';

// Add to component (after existing state)
const { checkFeatureAndShowPaywall, isPremium } = useSubscription();

// Replace the existing handleGeneratePrompt function:
const handleGeneratePrompt = async () => {
  // 🚨 FEATURE GATE: Check AI access before generating
  const hasAccess = await checkFeatureAndShowPaywall('ai');
  if (!hasAccess) {
    return; // Paywall will show automatically
  }

  setGeneratingPrompt(true);
  setGeneratedPrompt('');
  
  try {
    const prompt = await generatePrompt(promptTopic);
    setGeneratedPrompt(prompt);
    setSavePromptChecked(true);
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
```

## Other Places to Add Feature Gating

### SMS Reminders (Settings Screen)
```tsx
// In SettingsScreen.tsx
const handleSMSToggle = async () => {
  const hasAccess = await checkFeatureAndShowPaywall('sms');
  if (!hasAccess) return;
  
  // Continue with SMS toggle logic
};
```

### Data Export
```tsx
const handleExport = async () => {
  const hasAccess = await checkFeatureAndShowPaywall('export');
  if (!hasAccess) return;
  
  // Continue with export logic
};
```

### Practitioner Connection
```tsx
const handlePractitionerContact = async () => {
  const hasAccess = await checkFeatureAndShowPaywall('practitioner');
  if (!hasAccess) return;
  
  // Continue with practitioner logic
};
```

## UI Visual Indicators

Add subscription badges or "Premium" indicators:

```tsx
// Example: Premium badge on AI prompt button
<TouchableOpacity style={styles.generateButton} onPress={handleGeneratePrompt}>
  <Text style={styles.generateButtonText}>Generate AI Prompt</Text>
  {!isPremium && <Text style={styles.premiumBadge}>Plus</Text>}
</TouchableOpacity>
```

## Free User Experience (Graceful Degradation)

For AI prompts, instead of hard blocking, you could:

```tsx
const handleGeneratePrompt = async () => {
  // For free users: 20% chance of AI, 80% generic prompts
  const useAI = isPremium || Math.random() < 0.2;
  
  setGeneratingPrompt(true);
  
  try {
    const prompt = useAI 
      ? await generatePrompt(promptTopic)
      : generateGenericPrompt(promptTopic); // Fallback method
      
    setGeneratedPrompt(prompt);
    
    // Show upgrade hint for free users occasionally
    if (!useAI && Math.random() < 0.3) {
      Alert.alert(
        'Want More AI Prompts?', 
        'Upgrade to Plus for unlimited AI-powered prompts',
        [
          { text: 'Maybe Later', style: 'cancel' },
          { text: 'Learn More', onPress: () => openPaywall() }
        ]
      );
    }
  } catch (error) {
    // Handle error
  } finally {
    setGeneratingPrompt(false);
  }
};
```

This approach lets free users still use the feature but incentivizes upgrades.