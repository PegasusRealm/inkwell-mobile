/**
 * AI Usage Service
 * Tracks daily AI usage for free tier users
 * Free users get 3 AI calls per day (Plus/Connect get unlimited)
 * Daily reset at midnight UTC-10 (Hawaii time, where InkWell operates)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

const AI_USAGE_KEY = 'ai_usage_today';
const FREE_DAILY_LIMIT = 3;

interface AIUsageData {
  date: string; // YYYY-MM-DD format in UTC-10
  count: number;
  lastReset: string;
}

/**
 * Get today's date in YYYY-MM-DD format (UTC-10 Hawaii time)
 * This ensures the daily reset happens at midnight Hawaii time
 */
function getTodayString(): string {
  const now = new Date();
  // UTC-10 = subtract 10 hours from UTC
  const hawaiiOffset = -10 * 60; // -10 hours in minutes
  const utcOffset = now.getTimezoneOffset(); // local offset in minutes (positive = behind UTC)
  const hawaiiTime = new Date(now.getTime() + (utcOffset + hawaiiOffset) * 60 * 1000);
  return hawaiiTime.toISOString().split('T')[0];
}

/**
 * Get current AI usage data from local storage
 */
async function getLocalUsage(): Promise<AIUsageData> {
  try {
    const todayStr = getTodayString();
    const stored = await AsyncStorage.getItem(AI_USAGE_KEY);
    if (stored) {
      const data: AIUsageData = JSON.parse(stored);
      console.log(`🔢 AI Usage: ${data.count}/${FREE_DAILY_LIMIT} (date: ${data.date}, today: ${todayStr})`);
      // Reset if it's a new day (Hawaii time)
      if (data.date !== todayStr) {
        console.log('🔄 New day detected (Hawaii time) - resetting AI usage');
        return { date: todayStr, count: 0, lastReset: new Date().toISOString() };
      }
      return data;
    }
  } catch (error) {
    console.warn('Error reading AI usage from storage:', error);
  }
  return { date: getTodayString(), count: 0, lastReset: new Date().toISOString() };
}

/**
 * Save AI usage data to local storage
 */
async function saveLocalUsage(data: AIUsageData): Promise<void> {
  try {
    await AsyncStorage.setItem(AI_USAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('Error saving AI usage to storage:', error);
  }
}

/**
 * Sync usage with Firestore (for cross-device tracking)
 */
async function syncWithFirestore(data: AIUsageData): Promise<void> {
  try {
    const user = auth().currentUser;
    if (!user) return;

    await firestore()
      .collection('users')
      .doc(user.uid)
      .set(
        {
          aiUsage: {
            date: data.date,
            count: data.count,
            lastUpdated: firestore.FieldValue.serverTimestamp(),
          },
        },
        { merge: true }
      );
  } catch (error) {
    console.warn('Error syncing AI usage with Firestore:', error);
    // Don't throw - local tracking is the source of truth for UX
  }
}

/**
 * Get current AI usage count for today
 */
export async function getAIUsageCount(): Promise<number> {
  const data = await getLocalUsage();
  return data.count;
}

/**
 * Get remaining AI calls for today (for free users)
 */
export async function getRemainingAICalls(): Promise<number> {
  const data = await getLocalUsage();
  return Math.max(0, FREE_DAILY_LIMIT - data.count);
}

/**
 * Check if user can make an AI call (free tier check)
 * @returns true if allowed, false if limit reached
 */
export async function canMakeAICall(): Promise<boolean> {
  const data = await getLocalUsage();
  return data.count < FREE_DAILY_LIMIT;
}

/**
 * Increment AI usage count
 * Call this after each successful AI API call
 */
export async function incrementAIUsage(): Promise<AIUsageData> {
  const data = await getLocalUsage();
  data.count += 1;
  await saveLocalUsage(data);
  
  // Sync to Firestore in background (don't await)
  syncWithFirestore(data).catch(() => {});
  
  return data;
}

/**
 * Get formatted usage string for display
 * e.g., "2 of 3 AI calls used today"
 */
export async function getUsageDisplayString(): Promise<string> {
  const data = await getLocalUsage();
  const remaining = Math.max(0, FREE_DAILY_LIMIT - data.count);
  return `${remaining} of ${FREE_DAILY_LIMIT} AI calls remaining today`;
}

/**
 * Check AI access and return detailed status
 */
export async function checkAIAccess(): Promise<{
  canUse: boolean;
  remaining: number;
  total: number;
  message: string;
}> {
  const data = await getLocalUsage();
  const remaining = Math.max(0, FREE_DAILY_LIMIT - data.count);
  const canUse = remaining > 0;
  
  console.log(`🤖 AI Access Check: canUse=${canUse}, remaining=${remaining}, used=${data.count}`);
  
  return {
    canUse,
    remaining,
    total: FREE_DAILY_LIMIT,
    message: canUse 
      ? `${remaining} AI ${remaining === 1 ? 'call' : 'calls'} remaining today`
      : 'Daily AI limit reached. Upgrade to Plus for unlimited access!',
  };
}

/**
 * Reset usage (for testing or admin purposes)
 */
export async function resetAIUsage(): Promise<void> {
  const data: AIUsageData = {
    date: getTodayString(),
    count: 0,
    lastReset: new Date().toISOString(),
  };
  await saveLocalUsage(data);
  await syncWithFirestore(data);
}

export const AI_DAILY_LIMIT = FREE_DAILY_LIMIT;
