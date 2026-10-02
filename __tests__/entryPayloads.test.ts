/**
 * Golden copies of what the pre-2.0 JournalScreen saved for each way of writing.
 * Every expected object below was written by hand from the 26.185.2 code (JournalScreen.tsx
 * lines 844-866, 951-960, 1005-1016, 1077-1087, 1342-1352, 1392-1401) with fixed inputs.
 * If a 2.0 change alters a saved field, these fail. Additive 2.0 fields are tested separately.
 */
import {describe, test, expect} from '@jest/globals';
import {
  freeWritePayload,
  manifestSnapshot,
  reframePayload,
  gratitudeThreePayload,
  gratitudePracticePayload,
  sprintPayload,
  inkblotPayload,
  wordCount,
} from '../src/services/entryPayloads';

const TS = {__serverTimestamp: true};
const NOW = new Date('2026-10-01T19:41:00Z');
const UID = 'user-123';
const today = NOW.toLocaleDateString('en-US', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'});
const time = NOW.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit'});

describe('legacy shapes are unchanged', () => {
  test('free-write, minimal', () => {
    expect(freeWritePayload({uid: UID, ts: TS, now: NOW, text: 'Hello there', tags: [], manifest: null})).toEqual({
      text: 'Hello there',
      userId: UID,
      createdAt: TS,
      updatedAt: TS,
    });
  });

  test('free-write, everything', () => {
    const manifest = manifestSnapshot({want: 'Walk', imagine: 'Lighter', snags: 'Phone', how: 'If 6:15 then out'});
    const out = freeWritePayload({
      uid: UID,
      ts: TS,
      now: NOW,
      text: 'Body',
      tags: ['sleep', 'sleep', 'home'],
      manifest,
      promptUsed: 'A prompt',
      reflectionUsed: 'A reflection',
      attachments: [{url: 'https://x/y.jpg?alt=media', name: 'y.jpg', type: 'image/jpeg'}],
    });
    expect(out).toEqual({
      text: 'Body',
      userId: UID,
      createdAt: TS,
      updatedAt: TS,
      tags: ['sleep', 'home', 'manifest', 'manifesting', 'manifestDate:2026-10-01'],
      manifestData: {wish: 'Walk', outcome: 'Lighter', opposition: 'Phone', plan: 'If 6:15 then out'},
      contextManifest: 'Walk | Lighter | Phone | If 6:15 then out',
      promptUsed: 'A prompt',
      reflectionUsed: 'A reflection',
      attachments: [{url: 'https://x/y.jpg?alt=media', name: 'y.jpg', type: 'image/jpeg'}],
    });
  });

  test('empty WISH attaches nothing', () => {
    expect(manifestSnapshot({want: '', imagine: '', snags: '', how: ''})).toBeNull();
    expect(manifestSnapshot(undefined)).toBeNull();
  });

  test('reframe', () => {
    expect(reframePayload({uid: UID, ts: TS, now: NOW, steps: ['Facts', '', '', 'Other view']})).toEqual({
      userId: UID,
      text: 'Perspective practice:\n\nWhat happened:\nFacts\n\nWhat my mind made it mean:\n(skipped)\n\nFor and against that read:\n(skipped)\n\nAnother way to see it:\nOther view',
      title: `Reframe - ${today}`,
      mood: '🔄',
      tags: ['reframe'],
      entryMode: 'journal',
      createdAt: TS,
      updatedAt: TS,
    });
  });

  test('gratitude three', () => {
    expect(gratitudeThreePayload({uid: UID, ts: TS, now: NOW, gratitudes: ['Rain', 'Coffee']})).toEqual({
      userId: UID,
      text: "Today I'm grateful for:\n\n1. Rain\n\n2. Coffee",
      title: `Gratitude - ${today}`,
      rawGratitudes: ['Rain', 'Coffee'],
      mood: '🙏',
      tags: ['gratitude'],
      entryMode: 'gratitude',
      gratitudeMode: 'three',
      createdAt: TS,
      updatedAt: TS,
    });
  });

  test('gratitude deep / subtraction / letter / savor', () => {
    const base = {uid: UID, ts: TS, now: NOW};
    expect(gratitudePracticePayload({...base, mode: 'deep', text: 'T'})).toEqual({
      userId: UID, text: 'One gratitude, deeply:\n\nT', title: `Gratitude, Deeply - ${today}`, mood: '🙏',
      tags: ['gratitude', 'deep'], entryMode: 'gratitude', gratitudeMode: 'deep', createdAt: TS, updatedAt: TS,
    });
    expect(gratitudePracticePayload({...base, mode: 'subtraction', text: 'T', subtractionPrompt: 'P'})).toEqual({
      userId: UID, text: 'Imagining life without it:\n\nP\n\nT', title: `Mental Subtraction - ${today}`, mood: '🙏',
      tags: ['gratitude', 'subtraction'], entryMode: 'gratitude', gratitudeMode: 'subtraction', createdAt: TS, updatedAt: TS,
    });
    expect(gratitudePracticePayload({...base, mode: 'letter', text: 'T', letterTo: '  '})).toEqual({
      userId: UID, text: 'Gratitude letter to someone:\n\nT', title: `Gratitude Letter to someone - ${today}`, mood: '🙏',
      tags: ['gratitude', 'letter'], entryMode: 'gratitude', gratitudeMode: 'letter', createdAt: TS, updatedAt: TS,
    });
    expect(gratitudePracticePayload({...base, mode: 'letter', text: 'T', letterTo: 'Kai'}).title).toBe(
      `Gratitude Letter to Kai - ${today}`,
    );
    expect(gratitudePracticePayload({...base, mode: 'savor', text: 'T'})).toEqual({
      userId: UID, text: 'Savoring the moment:\n\nT', title: `Savoring - ${today}`, mood: '🙏',
      tags: ['gratitude', 'savoring'], entryMode: 'gratitude', gratitudeMode: 'savor', createdAt: TS, updatedAt: TS,
    });
  });

  test('sprint', () => {
    expect(sprintPayload({uid: UID, ts: TS, now: NOW, text: 'Go', minutes: 20})).toEqual({
      userId: UID,
      text: 'Writing sprint (20 min):\n\nGo',
      title: `Writing Sprint - ${today}`,
      mood: '⏱️',
      tags: ['sprint'],
      entryMode: 'journal',
      sprintMinutes: 20,
      createdAt: TS,
      updatedAt: TS,
    });
  });

  test('inkblot', () => {
    expect(inkblotPayload({uid: UID, ts: TS, now: NOW, text: '  quick one  '})).toEqual({
      userId: UID,
      text: 'quick one',
      title: `InkBlot - ${today} at ${time}`,
      mood: '⚡',
      tags: ['inkblot', 'quick'],
      entryMode: 'inkblot',
      createdAt: TS,
      updatedAt: TS,
    });
  });
});

describe('2.0 additions are additive only', () => {
  test('extras are written only when known', () => {
    const out = sprintPayload({
      uid: UID, ts: TS, now: NOW, text: 'Go', minutes: 15,
      extras: {practice: 'sprint', tzOffsetMin: -600, feelBefore: 4, isVoiceEntry: true},
    });
    expect(out.practice).toBe('sprint');
    expect(out.tzOffsetMin).toBe(-600);
    expect(out.feelBefore).toBe(4);
    expect(out.isVoiceEntry).toBe(true);
    const bare = sprintPayload({uid: UID, ts: TS, now: NOW, text: 'Go', minutes: 15, extras: {feelBefore: 0}});
    expect('feelBefore' in bare).toBe(false);
    expect('isVoiceEntry' in bare).toBe(false);
  });

  test('every legacy field survives next to the extras', () => {
    const extras = {practice: 'gratitude' as const, tzOffsetMin: 0, feelBefore: 3};
    const withExtras = gratitudeThreePayload({uid: UID, ts: TS, now: NOW, gratitudes: ['A'], extras});
    const legacy = gratitudeThreePayload({uid: UID, ts: TS, now: NOW, gratitudes: ['A']});
    expect(withExtras).toEqual({...legacy, ...extras});
  });

  test('word count', () => {
    expect(wordCount('  one two   three ')).toBe(3);
    expect(wordCount('   ')).toBe(0);
  });
});
