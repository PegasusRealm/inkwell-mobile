/**
 * entryPayloads (v2.0, 2026-10-01): the journalEntries document each way of writing saves.
 *
 * Moved out of the old JournalScreen word for word, so the rebuilt Write screen saves
 * EXACTLY the same shapes. The web app, Practice Summary, gratitudeEngine and the insight
 * functions all read these documents. __tests__/entryPayloads.test.ts pins every shape
 * against the pre-2.0 output.
 *
 * 2.0 adds fields, never changes them. Each one is written only when known:
 *   practice      which way in was used ('freewrite' | 'sprint' | 'gratitude' | 'reframe' | 'inkblot')
 *   tzOffsetMin   minutes east of UTC at save time, so "time of day" can be read in the person's own time
 *   feelBefore    1-5 "how heavy" before writing (already on gratitude + reframe; now any way in)
 *   isVoiceEntry  true when Speak it supplied words (Practice Summary already counts this field)
 */

export type Practice = 'freewrite' | 'sprint' | 'gratitude' | 'reframe' | 'inkblot';
export type GratMode = 'three' | 'deep' | 'subtraction' | 'letter' | 'savor';

export interface Extras {
  practice?: Practice;
  tzOffsetMin?: number;
  feelBefore?: number;
  isVoiceEntry?: boolean;
}

interface Base {
  uid: string;
  /** firestore.FieldValue.serverTimestamp(), passed in so this file stays pure */
  ts: unknown;
  now: Date;
  extras?: Extras;
}

export const longDate = (now: Date) =>
  now.toLocaleDateString('en-US', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'});

export const tzOffsetMinutes = (now: Date = new Date()) => -now.getTimezoneOffset();

function applyExtras(entry: any, extras?: Extras) {
  if (!extras) return entry;
  if (extras.practice) entry.practice = extras.practice;
  if (typeof extras.tzOffsetMin === 'number') entry.tzOffsetMin = extras.tzOffsetMin;
  if (extras.feelBefore) entry.feelBefore = extras.feelBefore;
  if (extras.isVoiceEntry) entry.isVoiceEntry = true;
  return entry;
}

// ─── Free-write (old handleSave) ───
export interface ManifestSnapshot {
  wish: string;
  outcome: string;
  opposition: string;
  plan: string;
}

export function freeWritePayload(
  p: Base & {
    text: string;
    tags: string[];
    manifest: ManifestSnapshot | null;
    promptUsed?: string;
    reflectionUsed?: string;
    attachments?: Array<{url: string; name: string; type?: string}>;
  },
) {
  const tagsArray: string[] = [];
  p.tags.forEach(tag => {
    if (!tagsArray.includes(tag)) tagsArray.push(tag);
  });
  if (p.manifest) {
    if (!tagsArray.includes('manifest')) tagsArray.push('manifest');
    if (!tagsArray.includes('manifesting')) tagsArray.push('manifesting');
    const today = p.now.toISOString().split('T')[0];
    tagsArray.push(`manifestDate:${today}`);
  }
  const entry: any = {
    text: p.text,
    userId: p.uid,
    createdAt: p.ts,
    updatedAt: p.ts,
  };
  if (tagsArray.length > 0) entry.tags = tagsArray;
  if (p.manifest) {
    entry.manifestData = p.manifest;
    entry.contextManifest = `${p.manifest.wish} | ${p.manifest.outcome} | ${p.manifest.opposition} | ${p.manifest.plan}`;
  }
  if (p.promptUsed) entry.promptUsed = p.promptUsed;
  if (p.reflectionUsed) entry.reflectionUsed = p.reflectionUsed;
  if (p.attachments && p.attachments.length > 0) entry.attachments = p.attachments;
  return applyExtras(entry, p.extras);
}

/** The manifest snapshot the free-write save attaches, or null when the WISH is empty. */
export function manifestSnapshot(doc: any): ManifestSnapshot | null {
  if (!doc) return null;
  const wish = doc.want || '';
  const outcome = doc.imagine || '';
  const opposition = doc.snags || '';
  const plan = doc.how || '';
  return wish || outcome || opposition || plan ? {wish, outcome, opposition, plan} : null;
}

// ─── Reframe (old handleSaveReframe) ───
export function reframePayload(p: Base & {steps: [string, string, string, string]}) {
  const s = p.steps;
  const text = `Perspective practice:\n\nWhat happened:\n${s[0]}\n\nWhat my mind made it mean:\n${
    s[1] || '(skipped)'
  }\n\nFor and against that read:\n${s[2] || '(skipped)'}\n\nAnother way to see it:\n${s[3]}`;
  const entry: any = {
    userId: p.uid,
    text,
    title: `Reframe - ${longDate(p.now)}`,
    mood: '🔄',
    tags: ['reframe'],
    entryMode: 'journal',
    createdAt: p.ts,
    updatedAt: p.ts,
  };
  return applyExtras(entry, p.extras);
}

// ─── Gratitude: Three (old handleSaveGratitude) ───
export function gratitudeThreePayload(p: Base & {gratitudes: string[]}) {
  const content = p.gratitudes.map((g, i) => `${i + 1}. ${g}`).join('\n\n');
  const entry: any = {
    userId: p.uid,
    text: `Today I'm grateful for:\n\n${content}`,
    title: `Gratitude - ${longDate(p.now)}`,
    rawGratitudes: p.gratitudes,
    mood: '🙏',
    tags: ['gratitude'],
    entryMode: 'gratitude',
    gratitudeMode: 'three',
    createdAt: p.ts,
    updatedAt: p.ts,
  };
  return applyExtras(entry, p.extras);
}

// ─── Gratitude: deep / subtraction / letter / savor (old handleSaveGratitudePractice) ───
export function gratitudePracticePayload(
  p: Base & {mode: Exclude<GratMode, 'three'>; text: string; subtractionPrompt?: string; letterTo?: string},
) {
  const today = longDate(p.now);
  const to = p.mode === 'letter' ? (p.letterTo || '').trim() || 'someone' : null;
  const meta = {
    deep: {title: `Gratitude, Deeply - ${today}`, text: `One gratitude, deeply:\n\n${p.text}`, tag: 'deep'},
    subtraction: {
      title: `Mental Subtraction - ${today}`,
      text: `Imagining life without it:\n\n${p.subtractionPrompt || ''}\n\n${p.text}`,
      tag: 'subtraction',
    },
    letter: {title: `Gratitude Letter to ${to} - ${today}`, text: `Gratitude letter to ${to}:\n\n${p.text}`, tag: 'letter'},
    savor: {title: `Savoring - ${today}`, text: `Savoring the moment:\n\n${p.text}`, tag: 'savoring'},
  }[p.mode];
  const entry: any = {
    userId: p.uid,
    text: meta.text,
    title: meta.title,
    mood: '🙏',
    tags: ['gratitude', meta.tag],
    entryMode: 'gratitude',
    gratitudeMode: p.mode,
    createdAt: p.ts,
    updatedAt: p.ts,
  };
  return applyExtras(entry, p.extras);
}

// ─── Sprint (old handleSaveSprint) ───
export function sprintPayload(p: Base & {text: string; minutes: 15 | 20}) {
  const entry: any = {
    userId: p.uid,
    text: `Writing sprint (${p.minutes} min):\n\n${p.text}`,
    title: `Writing Sprint - ${longDate(p.now)}`,
    mood: '⏱️',
    tags: ['sprint'],
    entryMode: 'journal',
    sprintMinutes: p.minutes,
    createdAt: p.ts,
    updatedAt: p.ts,
  };
  return applyExtras(entry, p.extras);
}

/**
 * Timed write (2.0 options pass): a free-write saved after the page's timer was started.
 * It keeps Sprint's markers (practice 'sprint', the 'sprint' tag, sprintMinutes) so the
 * Practice Summary and "what helps" still count it, on top of the free-write shape.
 */
export function markTimedWrite(entry: any, minutes: 15 | 20) {
  entry.practice = 'sprint';
  entry.sprintMinutes = minutes;
  entry.tags = Array.from(new Set([...(entry.tags || []), 'sprint']));
  return entry;
}

// ─── InkBlot (old handleSaveInkblot) ───
export function inkblotPayload(p: Base & {text: string}) {
  const time = p.now.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit'});
  const entry: any = {
    userId: p.uid,
    text: `${p.text.trim()}`,
    title: `InkBlot - ${longDate(p.now)} at ${time}`,
    mood: '⚡',
    tags: ['inkblot', 'quick'],
    entryMode: 'inkblot',
    createdAt: p.ts,
    updatedAt: p.ts,
  };
  return applyExtras(entry, p.extras);
}

export const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).filter(Boolean).length : 0);
