/**
 * FirstSteps — event-driven onboarding (web app.html parity, ported 2026-07-04).
 * A quest line and coach-mark hints, each fired ONCE by real user events.
 * No timers, no center-screen lectures (replaces the OnboardingTip modals).
 * State syncs to users/{uid}.firstSteps; veterans (any existing entry) never
 * see it. AsyncStorage cache mirrors web's localStorage cache.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

export type FirstStepKey = 'write' | 'prompt' | 'save' | 'entries' | 'wish';

// Quest line verbatim from web FirstSteps.STEPS
export const FIRST_STEPS: Array<[FirstStepKey, string, string]> = [
  ['write', 'Write a line', 'One sentence counts.'],
  ['prompt', 'Ask Sophy for a prompt', 'She reads nothing until you ask.'],
  ['save', 'Save your first entry', 'That is the whole habit, right there.'],
  ['entries', 'Find it in Entries', 'Everything you write compounds here.'],
  ['wish', 'Plant a WISH', 'A goal with a plan attached.'],
];

export interface FirstStepsState {
  write: boolean;
  prompt: boolean;
  save: boolean;
  entries: boolean;
  wish: boolean;
  dismissed: boolean;
  done: boolean;
  marks: Record<string, boolean>;
}

type Listener = (state: FirstStepsState | null) => void;

let state: FirstStepsState | null = null;
let initPromise: Promise<void> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<Listener>();

const cacheKey = (uid: string) => 'inkwell-firststeps-' + uid;

const notify = () => listeners.forEach(l => l(state));

const persist = () => {
  const user = auth().currentUser;
  if (!user || !state) return;
  AsyncStorage.setItem(cacheKey(user.uid), JSON.stringify(state)).catch(() => {});
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    firestore()
      .collection('users')
      .doc(user.uid)
      .set({firstSteps: state}, {merge: true})
      .catch(() => {});
  }, 800);
};

export const FirstStepsService = {
  getState: () => state,

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    listener(state);
    return () => {
      listeners.delete(listener);
    };
  },

  /** Cache → remote → veteran check (any existing entry = no quest). */
  async init(): Promise<void> {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      const user = auth().currentUser;
      if (!user) return;
      try {
        const cached = await AsyncStorage.getItem(cacheKey(user.uid));
        if (cached) state = JSON.parse(cached);
      } catch (e) {}
      if (!state) {
        try {
          const snap = await firestore().collection('users').doc(user.uid).get();
          const saved = snap.data()?.firstSteps;
          if (saved) state = saved;
        } catch (e) {}
      }
      if (!state) {
        let veteran = false;
        try {
          const q = await firestore()
            .collection('journalEntries')
            .where('userId', '==', user.uid)
            .limit(1)
            .get();
          veteran = !q.empty;
        } catch (e) {}
        state = {
          write: false,
          prompt: false,
          save: false,
          entries: false,
          wish: false,
          dismissed: veteran,
          done: veteran,
          marks: {},
        };
      }
      if (!state.marks) state.marks = {};
      persist();
      notify();
    })();
    return initPromise;
  },

  /** Fire a quest step ONCE from a real user event (web complete parity). */
  complete(step: FirstStepKey) {
    if (!state || state.done || state.dismissed || state[step]) return;
    state = {...state, [step]: true};
    if (FIRST_STEPS.every(([k]) => state![k])) {
      state = {...state, done: true};
    }
    persist();
    notify();
  },

  dismiss() {
    if (!state) return;
    state = {...state, dismissed: true};
    persist();
    notify();
  },

  /** One-time coach-mark hint per id; returns true if this call claims it. */
  claimMark(id: string): boolean {
    if (!state || state.marks[id] || state.done || state.dismissed) return false;
    state = {...state, marks: {...state.marks, [id]: true}};
    persist();
    notify();
    return true;
  },

  isQuestActive(): boolean {
    return !!state && !state.done && !state.dismissed;
  },

  /** Explicit user request (Settings): run the quest again from the top.
   *  Bypasses the veteran gate — asking for it IS the opt-in. Marks clear
   *  too, so the coach hints re-fire. */
  reset() {
    state = {
      write: false,
      prompt: false,
      save: false,
      entries: false,
      wish: false,
      dismissed: false,
      done: false,
      marks: {},
    };
    persist();
    notify();
  },
};
