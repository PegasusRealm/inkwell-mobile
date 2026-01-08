/**
 * Sophy AI API Service
 * Handles all AI-powered features using Firebase Cloud Functions
 */

import auth from '@react-native-firebase/auth';
import storage from '@react-native-firebase/storage';

// Cloud Functions endpoint base URL
const FUNCTIONS_BASE_URL = 'https://us-central1-inkwell-alpha.cloudfunctions.net';

/**
 * Helper to make authenticated requests to Cloud Functions
 */
async function callCloudFunction<T>(
  endpoint: string,
  payload: any,
): Promise<T> {
  // Ensure user is authenticated
  const currentUser = auth().currentUser;
  if (!currentUser) {
    throw new Error('User must be authenticated to use AI features');
  }

  // Get Firebase ID token for authentication
  const idToken = await currentUser.getIdToken();

  const response = await fetch(`${FUNCTIONS_BASE_URL}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorMessage = `AI request failed: ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch (parseError) {
      errorMessage = `AI request failed: ${response.status} ${response.statusText}`;
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * Generate a journaling prompt using Sophy AI
 * @param topic - Optional topic to focus the prompt on
 * @returns The generated prompt text
 */
export async function generatePrompt(topic?: string): Promise<string> {
  try {
    const response = await callCloudFunction<{prompt: string}>(
      'generatePrompt',
      {topic: topic || ''},
    );
    return response.prompt;
  } catch (error) {
    console.error('Error generating prompt:', error);
    throw error;
  }
}

/**
 * Get AI reflection/insights on journal entry
 * @param text - Journal entry text
 * @returns Reflection text from Sophy
 */
export async function getReflection(text: string): Promise<string> {
  try {
    const response = await callCloudFunction<{insight: string}>(
      'askSophy',
      {entry: text},
    );
    
    // Clean the response to remove stage directions or prompt leakage
    let insight = response.insight || '';
    if (insight) {
      insight = insight
        .replace(/^\*[^*]*\*\s*/g, '') // Remove opening stage directions
        .replace(/\*[^*]*\*$/g, '') // Remove ending stage directions
        .replace(/\*[^*]*\*/g, '') // Remove any remaining stage directions
        .trim();
    }
    
    return insight;
  } catch (error) {
    console.error('Error getting reflection:', error);
    throw error;
  }
}

/**
 * Process voice transcript with AI cleanup and emotional analysis (Premium feature)
 * @param transcript - The raw transcript text from native speech recognition
 * @returns Cleaned transcript text with optional emotional insights
 */
export async function transcribeVoice(
  transcript: string,
): Promise<{cleanedText: string; emotionalInsights?: any}> {
  try {
    const currentUser = auth().currentUser;
    if (!currentUser) {
      throw new Error('User must be authenticated');
    }

    console.log('🎙️ Processing voice transcript with AI:', transcript.substring(0, 50) + '...');

    // Call Cloud Function to clean the transcript and add emotional analysis
    const response = await callCloudFunction<{
      cleanedText: string;
      emotionalInsights?: any;
    }>('processVoiceWithEmotion', {
      transcript: transcript,
      hasAudio: false, // We're sending text, not audio
    });

    return response;
  } catch (error) {
    console.error('Error processing voice transcript:', error);
    throw error;
  }
}

/**
 * Refine a WISH section with Sophy guidance using exact web app prompts
 * @param section - The WISH section (want, imagine, snags, how)
 * @param text - User's input for that section
 * @returns Sophy's guidance
 */
export async function refineManifest(
  section: 'want' | 'imagine' | 'snags' | 'how',
  text: string,
): Promise<string> {
  let prompt = '';
  
  // Use exact prompts from web app for each WISH section
  switch (section) {
    case 'want':
      prompt = `You are Sophy, a supportive journaling assistant and WISH coach. Analyze this user's Wish and provide guidance on how well it aligns with effective WISH principles:

WISH EVALUATION CRITERIA:

1. BE SPECIFIC AND REALISTIC - Is it concrete rather than vague? Achievable with current abilities?
2. PERSONAL AND INSPIRING - Does it resonate personally? Is it challenging but possible?
3. FOCUS ON ONE PRIORITY - Is it singular and focused rather than multiple goals?
4. IMMEDIATE AND ACTIONABLE - Can it be acted on in the next few weeks/months?

User's Wish: ${text}

Please evaluate their wish against these criteria and provide specific, actionable advice on how to strengthen it. Consider:
- What's working well in their current wish?
- Which criteria could be improved and how?
- Specific suggestions to make it more effective for WISH

Provide your guidance as helpful coaching advice, not a rewrite. Help them understand what makes a strong wish and how they can refine theirs.

IMPORTANT: Provide coaching guidance and advice only. Do not rewrite their wish for them. Help them understand how to improve it themselves.`;
      break;
      
    case 'imagine':
      prompt = `You are Sophy, a supportive journaling assistant and WISH coach. Analyze this user's Imagine and provide guidance on how well it aligns with effective WISH principles:

IMAGINE EVALUATION CRITERIA:

1. VISUALIZE VIVIDLY - Does it include detailed imagery of what life will look like and how success will feel?
2. MAKE IT PERSONAL - Does it deeply matter to them and reflect their values?
3. BE CONCRETE AND SPECIFIC - Is it tangible and observable rather than abstract?
4. SAVOR THE FEELING - Does it capture emotions, sensations, and achievement feelings?

User's Imagine: ${text}

Please evaluate their imagination against these criteria and provide specific, actionable advice on how to strengthen it. Consider:
- What vivid details are already present vs. missing?
- How could they make it more personally meaningful?
- Where could they add concrete, observable elements?
- How might they better capture the emotional experience of success?

Provide coaching guidance to help them create a more motivating and compelling vision of their success.

IMPORTANT: Provide coaching guidance and advice only. Do not rewrite their imagination for them. Help them understand how to make it more vivid and motivating themselves.`;
      break;
      
    case 'snags':
      prompt = `You are Sophy, a supportive journaling assistant and WISH coach. Analyze this user's Snags and provide guidance on how well it aligns with effective WISH principles:

SNAGS EVALUATION CRITERIA:

1. BE HONEST AND REFLECTIVE - Does it focus on internal roadblocks (self-doubt, procrastination, habits) rather than external circumstances?
2. MAKE IT SPECIFIC AND CLEAR - Is it concrete and specific rather than vague generalities?
3. FOCUS ON THE MOST RELEVANT OBSTACLE - Is it the one most likely to derail progress?
4. CONNECT EMOTION AND BEHAVIOR - Does it describe patterns, triggers, or how the obstacle typically manifests?

User's Snags: ${text}

Please evaluate their snags against these criteria and provide specific, actionable advice on how to strengthen them. Consider:
- Are they focusing on internal vs. external snags?
- How could they be more specific about the snag's pattern?
- Is this truly the most likely barrier to derail their progress?
- How might they better describe when and how this snag shows up?

Provide coaching guidance to help them identify the most relevant internal snag they can actually address.

IMPORTANT: Provide coaching guidance and advice only. Do not rewrite their snags for them. Help them understand how to identify and articulate their most critical internal barrier.`;
      break;
      
    case 'how':
      prompt = `You are Sophy, a supportive journaling assistant and WISH coach. Analyze this user's How and provide guidance on how well it aligns with effective WISH principles:

HOW EVALUATION CRITERIA:

1. USE "IF-THEN" IMPLEMENTATION INTENTIONS - Is it structured as "If [snag] happens, then I will [specific action]"?
2. MAKE IT SPECIFIC AND FEASIBLE - Is it one clear, realistic action they can do in their daily context?
3. KEEP IT SIMPLE - Is it concise and focused on one main coping strategy?
4. PREPARE TO EXECUTE IMMEDIATELY - Can they visualize and immediately act when the snag appears?

User's How: ${text}

Please evaluate their plan against these criteria and provide specific, actionable advice on how to strengthen it. Consider:
- Does it follow the if-then format linking snag to action?
- Is the planned action specific, realistic, and doable for them?
- Is it simple enough to remember and execute in the moment?
- How could they make it more immediately actionable?

Provide coaching guidance to help them create a more effective implementation intention that will actually work when they encounter their snag.

IMPORTANT: Provide coaching guidance and advice only. Do not rewrite their plan for them. Help them understand how to create a stronger if-then implementation strategy themselves.`;
      break;
  }
  
  const result = await callCloudFunction<{insight?: string; response?: string}>('askSophy', {
    entry: prompt
  });
  
  // Clean the response to remove stage directions and prompt leakage (matching web app)
  let cleanResponse = (result.insight || result.response || '').trim();
  if (cleanResponse) {
    cleanResponse = cleanResponse
      .replace(/^\*[^*]*\*\s*/g, '') // Remove opening stage directions
      .replace(/\*[^*]*\*$/g, '') // Remove ending stage directions
      .replace(/\*[^*]*\*/g, '') // Remove any remaining stage directions
      .replace(/^\*with\s+warmth\s+and\s+empathy\*\s*/gi, '')
      .replace(/^\*[^*]*warmth[^*]*\*\s*/gi, '')
      .replace(/^\*[^*]*empathy[^*]*\*\s*/gi, '')
      .replace(/I\s+sense\s+there\s+is\s+an\s+important\s+wish/gi, '')
      .replace(/Let's\s+take\s+a\s+moment\s+to\s+vividly\s+imagine/gi, '')
      .replace(/Envision\s+yourself\s+feeling/gi, '')
      .replace(/Picture\s+yourself\s+with/gi, '')
      .trim();
  }
  
  return cleanResponse || 'Something went wrong.';
}

