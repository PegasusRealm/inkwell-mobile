/** Small pieces Today and Write both need (v2.0, 2026-10-01). */
import type {GratPractice} from '../navigation/types';

// Gratitude nudge dot. Mirrors web markGratDoneToday (localStorage 'gratDoneDate').
export const GRAT_DONE_KEY = 'gratDoneDate';
export const todayKey = () => new Date().toISOString().slice(0, 10);

// Same date rule as web: first Saturday = letter; Sun savor / Wed deep / Fri subtraction
export const suggestedGratitudePractice = (): GratPractice => {
  const d = new Date();
  if (d.getDay() === 6 && d.getDate() <= 7) return 'letter';
  return ({0: 'savor', 3: 'deep', 5: 'subtraction'} as Record<number, GratPractice>)[d.getDay()] || 'three';
};
