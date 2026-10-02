/** Small pieces Today and Write both need (v2.0, 2026-10-01). */
import type {GratPractice} from '../navigation/types';

// Gratitude nudge dot. Mirrors web markGratDoneToday (localStorage 'gratDoneDate').
export const GRAT_DONE_KEY = 'gratDoneDate';
export const todayKey = () => new Date().toISOString().slice(0, 10);

// Three practices (options pass, 2026-10-01): first Saturday of the month = letter;
// Wednesday and Sunday = one, deeply; every other day = three good things.
export const suggestedGratitudePractice = (): GratPractice => {
  const d = new Date();
  if (d.getDay() === 6 && d.getDate() <= 7) return 'letter';
  return d.getDay() === 0 || d.getDay() === 3 ? 'deep' : 'three';
};
