/**
 * ValuesPlanner — the 6-step values-based goal planner (M2 full port, 2026-07-04).
 * Web parity: app.html planner flow. Sort: Personal Values Card Sort (Miller,
 * C'de Baca, Matthews & Wilbourne, 2001, UNM). Step 3 = Best Possible Self
 * (King, 2001). Step 6 hands the chosen goal to WISH (WOOP; Oettingen &
 * Gollwitzer). LAW: FREE-tier flow — no gating anywhere in this component.
 * State persists to users/{uid}.valuesPlanner (debounced) so the ritual can
 * span days; completed runs archive to valuesPlannerHistory (capped 20).
 */
import React, {useState, useEffect, useRef, useMemo, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {spacing, borderRadius, fontFamily, fontSize} from '../theme';
import {useTheme, ThemeColors} from '../theme/ThemeContext';
import {plannerAssistFetch} from '../services/plannerApi';
import {PLANNER_VALUES, PLANNER_VALUE_NAMES} from './plannerValues';
import {IWButton} from './kit';

type VpStage = 'values' | 'rank' | 'vision' | 'brainstorm' | 'evaluate' | 'handoff';

interface VpState {
  stage: VpStage;
  round: number;
  pool: string[];
  selected: string[];
  ranked: string[];
  vision: string;
  ideas: string[];
  top3: string[];
  notes: Record<string, string>;
  chosen: string;
  done: boolean;
  completedAt?: string;
  dedupeOk?: boolean;
}

const VP_STAGES: VpStage[] = ['values', 'rank', 'vision', 'brainstorm', 'evaluate', 'handoff'];

// Step labels verbatim from web VP_LABELS
const VP_LABELS: Record<VpStage, string> = {
  values: 'Step 1 of 6, Your values',
  rank: 'Step 2 of 6, Rank your top values',
  vision: 'Step 3 of 6, A day in your life, 15 years from now',
  brainstorm: 'Step 4 of 6, Brainstorm',
  evaluate: 'Step 5 of 6, Choose one',
  handoff: 'Step 6 of 6, Into your WISH',
};

const vpDefault = (): VpState => ({
  stage: 'values',
  round: 1,
  pool: [...PLANNER_VALUE_NAMES],
  selected: [],
  ranked: [],
  vision: '',
  ideas: [],
  top3: [],
  notes: {},
  chosen: '',
  done: false,
});

interface ValuesPlannerProps {
  onClose: () => void;
  onHandoff: (chosen: string) => void;
}

const ValuesPlanner: React.FC<ValuesPlannerProps> = ({onClose, onHandoff}) => {
  const {colors} = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [vp, setVp] = useState<VpState | null>(null); // null while loading
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [showRestartGate, setShowRestartGate] = useState(false);
  const [showExitGate, setShowExitGate] = useState(false);
  const [exitText, setExitText] = useState('');
  const [exitNudged, setExitNudged] = useState(false);
  const [ideaInput, setIdeaInput] = useState('');
  const [sophyBusy, setSophyBusy] = useState<'vivid' | 'seed' | 'wantshould' | null>(null);
  const [vividOut, setVividOut] = useState('');
  const [seedOut, setSeedOut] = useState('');
  const [seedAdded, setSeedAdded] = useState<Record<number, boolean>>({});
  const [wsOut, setWsOut] = useState('');

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vpRef = useRef<VpState | null>(null);
  vpRef.current = vp;

  // ── Load: users/{uid}.valuesPlanner over defaults (web vpLoad parity) ──
  useEffect(() => {
    const load = async () => {
      let next = vpDefault();
      try {
        const user = auth().currentUser;
        if (user) {
          const snap = await firestore().collection('users').doc(user.uid).get();
          const saved = snap.data()?.valuesPlanner;
          if (saved) {
            next = {...vpDefault(), ...saved};
          }
        }
      } catch (e: any) {
        console.warn('planner load failed, starting fresh:', e.message);
      }
      setVp(next);
      // Informed restart gate when a completed run exists (web plannerStart parity)
      if (next.done && next.chosen) {
        setShowRestartGate(true);
      }
    };
    load();
  }, []);

  // ── Save: debounced 600ms merge (web vpSave parity), flushed on unmount ──
  const persist = useCallback(async (state: VpState | null) => {
    if (!state) return;
    try {
      const user = auth().currentUser;
      if (user) {
        await firestore().collection('users').doc(user.uid).set({valuesPlanner: state}, {merge: true});
      }
    } catch (e: any) {
      console.warn('planner save failed:', e.message);
    }
  }, []);

  const mutate = useCallback(
    (fn: (prev: VpState) => VpState) => {
      setVp(prev => {
        if (!prev) return prev;
        const next = fn(prev);
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => persist(next), 600);
        return next;
      });
    },
    [persist],
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        persist(vpRef.current);
      }
    };
  }, [persist]);

  // ── Completed runs stack into history, never overwritten (web vpArchiveRun) ──
  const archiveRun = async (state: VpState) => {
    try {
      const user = auth().currentUser;
      if (!user) return;
      const snap = await firestore().collection('users').doc(user.uid).get();
      const data = snap.data();
      const hist = data && Array.isArray(data.valuesPlannerHistory) ? data.valuesPlannerHistory : [];
      hist.push({
        completedAt: state.completedAt || new Date().toISOString(),
        ranked: state.ranked.slice(0, 10),
        chosen: state.chosen || '',
      });
      await firestore().collection('users').doc(user.uid).set(
        {valuesPlannerHistory: hist.slice(-20)},
        {merge: true},
      );
    } catch (e: any) {
      console.warn('planner archive failed (non-blocking):', e.message);
    }
  };

  // Writing steps save as journal entries so they compound (web vpSaveAsEntry)
  const saveAsEntry = async (title: string, text: string, tags: string[]) => {
    const user = auth().currentUser;
    if (!user) return;
    await firestore().collection('journalEntries').add({
      userId: user.uid,
      title,
      text,
      tags,
      entryMode: 'journal',
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
  };

  // ── Restart gate actions ──
  const handleRestartFresh = async () => {
    if (!vp) return;
    await archiveRun(vp);
    const fresh = vpDefault();
    setVp(fresh);
    persist(fresh);
    setShowRestartGate(false);
  };

  // ── Exit gate (web plannerExit/vpExitConfirm parity) ──
  const handleExitRequest = () => {
    if (!vp) return;
    if (vp.done) {
      persist(vp);
      onClose();
      return;
    }
    setShowExitGate(true);
  };

  const handleExitConfirm = () => {
    const t = exitText.toLowerCase().replace(/[‘’']/g, '');
    if (t.includes('ill come back') || t.includes('i will come back') || t.includes('will come back')) {
      persist(vpRef.current);
      onClose();
    } else {
      setExitNudged(true);
    }
  };

  // ── Stage handlers (web parity) ──
  const toggleValue = (name: string) => {
    setStatus('');
    mutate(prev => {
      const selected = prev.selected.includes(name)
        ? prev.selected.filter(n => n !== name)
        : [...prev.selected, name];
      return {...prev, selected};
    });
  };

  const toggleRank = (name: string) => {
    setStatus('');
    mutate(prev => {
      const ranked = prev.ranked.includes(name)
        ? prev.ranked.filter(n => n !== name)
        : [...prev.ranked, name];
      return {...prev, ranked};
    });
  };

  const addIdea = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    mutate(prev => ({...prev, ideas: [...prev.ideas, t.slice(0, 200)], dedupeOk: false}));
    setIdeaInput('');
  };

  const removeIdea = (i: number) => {
    mutate(prev => ({...prev, ideas: prev.ideas.filter((_, idx) => idx !== i), dedupeOk: false}));
  };

  const toggleTop3 = (idea: string) => {
    setStatus('');
    if (!vp) return;
    if (!vp.top3.includes(idea) && vp.top3.length >= 3) {
      setStatus('Three is the limit. Un-tap one first.');
      return;
    }
    mutate(prev => {
      if (prev.top3.includes(idea)) {
        return {...prev, top3: prev.top3.filter(x => x !== idea)};
      }
      // Limit enforced inside the updater too — no same-frame race past 3
      if (prev.top3.length >= 3) return prev;
      return {...prev, top3: [...prev.top3, idea]};
    });
  };

  const setNote = (idea: string, text: string) => {
    mutate(prev => ({...prev, notes: {...prev.notes, [idea]: text.slice(0, 1200)}}));
  };

  const choose = (idea: string) => {
    setStatus('');
    mutate(prev => ({...prev, chosen: idea}));
  };

  // ── Sophy assists (web vpVivid / vpSeed / vpAdoptSeed / vpWantShould) ──
  const handleVivid = async () => {
    if (!vp) return;
    setSophyBusy('vivid');
    setVividOut('Sophy is reading...');
    try {
      setVividOut(await plannerAssistFetch('vivid', {vision: vp.vision}));
    } catch (e: any) {
      setVividOut(e.message);
    } finally {
      setSophyBusy(null);
    }
  };

  const handleSeed = async () => {
    if (!vp) return;
    setSophyBusy('seed');
    setSeedOut('Sophy is thinking...');
    setSeedAdded({});
    try {
      setSeedOut(await plannerAssistFetch('seed', {vision: vp.vision, topValues: vp.ranked.slice(0, 10)}));
    } catch (e: any) {
      setSeedOut(e.message);
    } finally {
      setSophyBusy(null);
    }
  };

  const adoptSeed = (line: string, index: number) => {
    const cleaned = line.replace(/^[-\s]+/, '').split(' because')[0].trim();
    if (!cleaned) return;
    mutate(prev => ({...prev, ideas: [...prev.ideas, cleaned.slice(0, 200)], dedupeOk: false}));
    setSeedAdded(prev => ({...prev, [index]: true}));
  };

  const handleWantShould = async () => {
    if (!vp) return;
    setSophyBusy('wantshould');
    setWsOut('Sophy is reading...');
    const notes = vp.top3.map(i => i + ':\n' + (vp.notes[i] || '(no notes)')).join('\n\n');
    try {
      setWsOut(await plannerAssistFetch('wantshould', {notes}));
    } catch (e: any) {
      setWsOut(e.message);
    } finally {
      setSophyBusy(null);
    }
  };

  // ── Back / Next (web plannerBack / plannerNext parity) ──
  const handleBack = () => {
    if (!vp) return;
    setStatus('');
    if (vp.stage === 'values' && vp.round > 1) {
      mutate(prev => ({...prev, round: prev.round - 1, pool: [...PLANNER_VALUE_NAMES], selected: []}));
      return;
    }
    const i = VP_STAGES.indexOf(vp.stage);
    if (i > 0) {
      mutate(prev => ({...prev, stage: VP_STAGES[i - 1]}));
    }
  };

  const handleNext = async () => {
    if (!vp || busy) return;
    setStatus('');

    if (vp.stage === 'values') {
      if (vp.selected.length === 0) {
        setStatus('Tap at least one value first.');
        return;
      }
      if (vp.selected.length > 10) {
        mutate(prev => ({...prev, pool: [...prev.selected], selected: [], round: prev.round + 1}));
        return;
      }
      mutate(prev => ({...prev, pool: [...prev.selected], ranked: [], stage: 'rank'}));
      return;
    }

    if (vp.stage === 'rank') {
      if (vp.ranked.length !== vp.pool.length) {
        setStatus('Rank all of them: ' + vp.ranked.length + ' of ' + vp.pool.length + ' so far.');
        return;
      }
      mutate(prev => ({...prev, stage: 'vision'}));
      return;
    }

    if (vp.stage === 'vision') {
      const vision = vp.vision.trim();
      if (vision.length < 40) {
        setStatus('Give the day a little more life first, a few sentences at least.');
        return;
      }
      setBusy(true);
      setStatus('Saving to your journal...');
      try {
        await saveAsEntry('A Day in My Life, 15 Years From Now', vision, ['values-planner', 'vision']);
      } catch (e: any) {
        console.warn('vision entry save failed:', e.message);
      }
      setBusy(false);
      setStatus('');
      mutate(prev => ({...prev, vision, stage: 'brainstorm'}));
      return;
    }

    if (vp.stage === 'brainstorm') {
      if (vp.ideas.length < 20) {
        setStatus(vp.ideas.length + ' of 20. Keep going, the good ones live past the obvious.');
        return;
      }
      setBusy(true);
      // Sophy dedupe scrub: reworded repeats don't count (fail-open if unavailable)
      if (!vp.dedupeOk) {
        setStatus('Sophy is checking for repeats...');
        try {
          const verdict = await plannerAssistFetch('dedupe', {ideas: vp.ideas});
          const m = verdict.match(/DISTINCT:\s*(\d+)/i);
          const distinct = m ? parseInt(m[1], 10) : vp.ideas.length;
          if (distinct < 20) {
            setSeedOut(verdict.replace(/^DISTINCT:.*$/im, '').trim());
            setStatus(distinct + ' truly distinct so far. Rewording the same idea does not fool either of us.');
            setBusy(false);
            return;
          }
          mutate(prev => ({...prev, dedupeOk: true}));
        } catch (e: any) {
          console.warn('dedupe scrub unavailable, failing open:', e.message);
          mutate(prev => ({...prev, dedupeOk: true}));
        }
      }
      setStatus('Saving your list...');
      try {
        await saveAsEntry(
          'Goal Brainstorm',
          'Ideas toward my 15-year vision:\n\n' + vp.ideas.map((x, i) => i + 1 + '. ' + x).join('\n'),
          ['values-planner', 'brainstorm'],
        );
      } catch (e: any) {
        console.warn('brainstorm entry save failed:', e.message);
      }
      setBusy(false);
      setStatus('');
      mutate(prev => ({...prev, stage: 'evaluate'}));
      return;
    }

    if (vp.stage === 'evaluate') {
      if (vp.top3.length === 0) {
        setStatus('Tap up to three ideas to compare.');
        return;
      }
      mutate(prev => ({...prev, stage: 'handoff'}));
      return;
    }

    if (vp.stage === 'handoff') {
      if (!vp.chosen) {
        setStatus('Tap the one you choose.');
        return;
      }
      const finished: VpState = {...vp, done: true, completedAt: new Date().toISOString()};
      setVp(finished);
      await persist(finished);
      onHandoff(finished.chosen);
      onClose();
    }
  };

  const nextLabel =
    vp?.stage === 'vision'
      ? 'Save to journal & continue'
      : vp?.stage === 'brainstorm'
      ? 'Save list & continue'
      : vp?.stage === 'handoff'
      ? 'Send to my WISH'
      : 'Continue';

  const backHidden = vp?.stage === 'values' && vp.round === 1;

  // ── Sophy output box (coral only — her surface, her serif italic) ──
  const SophyOut = ({text}: {text: string}) =>
    text ? (
      <View style={styles.sophyBox}>
        <Text style={styles.sophyWho}>SOPHY</Text>
        <Text style={styles.sophyText}>{text}</Text>
      </View>
    ) : null;

  if (!vp) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color={colors.brandPrimary} />
      </View>
    );
  }

  // ── Informed restart gate (web plannerStart parity) ──
  if (showRestartGate) {
    const days = vp.completedAt
      ? Math.floor((Date.now() - new Date(vp.completedAt).getTime()) / 86400000)
      : 999;
    const ago = days >= 999 ? 'a while' : days === 0 ? 'today' : days === 1 ? 'yesterday' : days + ' days ago';
    const topVals = vp.ranked.slice(0, 3).join(', ') || 'your values';
    return (
      <View style={styles.gate}>
        {days < 90 ? (
          <Text style={styles.gateText}>
            You walked the planner {ago}. Your top values were <Text style={styles.gateBold}>{topVals}</Text> and
            you chose <Text style={styles.gateBold}>{vp.chosen}</Text>. Values usually shift with seasons of life,
            not weeks. If something big changed, walk it again. If the goal is just fighting you, it might need
            attention, not replacement.
          </Text>
        ) : (
          <Text style={styles.gateText}>
            It has been {ago} since your last walk. Your top values were{' '}
            <Text style={styles.gateBold}>{topVals}</Text>. Seasons change; a fresh walk is timely. Your old run
            stays archived either way.
          </Text>
        )}
        <View style={styles.gateButtons}>
          <IWButton
            voice="gray"
            small
            title={days < 90 ? 'Something big changed, start fresh' : 'Start a fresh walk'}
            onPress={handleRestartFresh}
          />
          <IWButton small title="Keep what I have" onPress={onClose} />
        </View>
      </View>
    );
  }

  return (
    <View>
      {/* Header: step label + save & close */}
      <View style={styles.headerRow}>
        <Text style={styles.stepLabel}>{VP_LABELS[vp.stage].toUpperCase()}</Text>
        <TouchableOpacity onPress={handleExitRequest} hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
          <Text style={styles.exitLink}>save & close</Text>
        </TouchableOpacity>
      </View>

      {/* ═══ Step 1: values ═══ */}
      {vp.stage === 'values' && (
        <View>
          <Text style={styles.intro}>
            {vp.round === 1
              ? 'Tap every value that is Very Important to you. Quick gut calls, no overthinking.'
              : 'Still ' +
                vp.pool.length +
                '. Same question, harder cut: tap only the values that are Very Important. The rest slip away.'}
          </Text>
          <View style={styles.valuesListWrap}>
            <ScrollView nestedScrollEnabled>
              {vp.pool.map(name => {
                const def = (PLANNER_VALUES.find(v => v[0] === name) || ['', ''])[1];
                const sel = vp.selected.includes(name);
                return (
                  <TouchableOpacity
                    key={name}
                    style={[styles.row, sel && styles.rowSel]}
                    onPress={() => toggleValue(name)}>
                    <Text style={[styles.rowName, sel && styles.rowNameSel]}>{name}</Text>
                    <Text style={styles.rowDef}>{def}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
          <Text style={styles.countLine}>
            {vp.selected.length} selected · 10 or fewer moves you to ranking
          </Text>
          <Text style={styles.creditLine}>
            Values sort adapted from Miller, C'de Baca, Matthews & Wilbourne (2001), University of New Mexico.
          </Text>
        </View>
      )}

      {/* ═══ Step 2: rank ═══ */}
      {vp.stage === 'rank' && (
        <View>
          <Text style={styles.intro}>
            Tap your values in order of importance. First tap is 1, your most important. Tap again to un-rank.
          </Text>
          {vp.pool.map(name => {
            const idx = vp.ranked.indexOf(name);
            return (
              <TouchableOpacity
                key={name}
                style={[styles.row, idx >= 0 && styles.rowSel]}
                onPress={() => toggleRank(name)}>
                <View style={styles.rankBadge}>
                  {idx >= 0 ? <Text style={styles.rankBadgeText}>{idx + 1}</Text> : null}
                </View>
                <Text style={[styles.rowName, idx >= 0 && styles.rowNameSel]}>{name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ═══ Step 3: vision ═══ */}
      {vp.stage === 'vision' && (
        <View>
          <Text style={styles.intro}>
            Your top values got to lead for 15 years. Write one ordinary day in that life, waking up to falling
            asleep. Present tense. Use your senses. One real day, not a highlight reel.
          </Text>
          <TextInput
            style={styles.visionInput}
            placeholder="I wake up and the first thing I hear is..."
            placeholderTextColor={colors.fontMuted}
            value={vp.vision}
            onChangeText={t => mutate(prev => ({...prev, vision: t}))}
            multiline
            textAlignVertical="top"
          />
          <IWButton
            voice="sophy"
            small
            title="Help me make it vivid"
            onPress={handleVivid}
            loading={sophyBusy === 'vivid'}
            style={styles.sophyAction}
          />
          <SophyOut text={vividOut} />
          <Text style={styles.creditLine}>
            Saves to your journal. Based on the Best Possible Self exercise (King, 2001).
          </Text>
        </View>
      )}

      {/* ═══ Step 4: brainstorm ═══ */}
      {vp.stage === 'brainstorm' && (
        <View>
          <Text style={styles.intro}>
            List anything that could move your real life toward that day. Twenty or more. The first ten are the
            obvious ones. The stupid, silly, impossible ones after that are the whole point. No filtering.
          </Text>
          <View style={styles.ideaInputRow}>
            <TextInput
              style={styles.ideaInput}
              placeholder="an idea, a goal, a resource..."
              placeholderTextColor={colors.fontMuted}
              value={ideaInput}
              onChangeText={setIdeaInput}
              onSubmitEditing={() => addIdea(ideaInput)}
              returnKeyType="done"
            />
            <IWButton voice="gray" small title="Add" onPress={() => addIdea(ideaInput)} />
          </View>
          {vp.ideas.map((idea, i) => (
            <View key={i} style={styles.row}>
              <Text style={[styles.rowName, styles.ideaText]}>{idea}</Text>
              <TouchableOpacity onPress={() => removeIdea(i)} hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                <Text style={styles.removeX}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
          <IWButton
            voice="sophy"
            small
            title="Sophy, seed some ideas"
            onPress={handleSeed}
            loading={sophyBusy === 'seed'}
            style={styles.sophyAction}
          />
          {seedOut ? (
            <View style={styles.sophyBox}>
              <Text style={styles.sophyWho}>SOPHY</Text>
              {seedOut.split('\n').filter(l => l.trim()).map((line, i) => {
                const isIdea = /^\s*-/.test(line);
                return (
                  <View key={i} style={styles.seedLine}>
                    <Text style={styles.sophyText}>{line}</Text>
                    {isIdea && (
                      <TouchableOpacity
                        style={[styles.seedAddChip, seedAdded[i] && styles.seedAddChipDone]}
                        disabled={!!seedAdded[i]}
                        onPress={() => adoptSeed(line, i)}>
                        <Text style={styles.seedAddChipText}>{seedAdded[i] ? 'added' : 'add'}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>
      )}

      {/* ═══ Step 5: evaluate ═══ */}
      {vp.stage === 'evaluate' && (
        <View>
          <Text style={styles.intro}>
            Tap your top 3 ideas, then jot quick pros and cons for each. Two questions before you choose: Would
            you still want it if nobody ever saw the result? Is it a want, or a should?
          </Text>
          <View style={styles.evalListWrap}>
            <ScrollView nestedScrollEnabled>
              {vp.ideas.map((idea, i) => {
                const sel = vp.top3.includes(idea);
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.row, sel && styles.rowSel]}
                    onPress={() => toggleTop3(idea)}>
                    <Text style={[styles.rowName, styles.ideaText, sel && styles.rowNameSel]}>{idea}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
          {vp.top3.map(idea => (
            <View key={idea} style={styles.evalBlock}>
              <Text style={styles.evalIdea}>{idea}</Text>
              <TextInput
                style={styles.evalInput}
                placeholder="Pros: ...  Cons: ..."
                placeholderTextColor={colors.fontMuted}
                value={vp.notes[idea] || ''}
                onChangeText={t => setNote(idea, t)}
                multiline
                textAlignVertical="top"
              />
            </View>
          ))}
          <IWButton
            voice="sophy"
            small
            title="Sophy, want or should?"
            onPress={handleWantShould}
            loading={sophyBusy === 'wantshould'}
            style={styles.sophyAction}
          />
          <SophyOut text={wsOut} />
        </View>
      )}

      {/* ═══ Step 6: handoff ═══ */}
      {vp.stage === 'handoff' && (
        <View>
          <Text style={styles.intro}>Pick the one that survived. It becomes the Want of your WISH below.</Text>
          {vp.top3.map(idea => (
            <TouchableOpacity
              key={idea}
              style={[styles.row, vp.chosen === idea && styles.rowSel]}
              onPress={() => choose(idea)}>
              <Text style={[styles.rowName, styles.ideaText, vp.chosen === idea && styles.rowNameSel]}>
                {idea}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Exit gate — leaving is a real choice, typed, not a drift */}
      {showExitGate && (
        <View style={styles.gate}>
          <Text style={styles.gateText}>
            No judgment, life happens. Your progress saves right here. To step out, type{' '}
            <Text style={styles.gateBold}>I'll come back</Text> so it's a promise, not a drift.
          </Text>
          <TextInput
            style={[styles.exitInput, exitNudged && styles.exitInputNudged]}
            placeholder={exitNudged ? "type: I'll come back" : "I'll come back"}
            placeholderTextColor={colors.fontMuted}
            value={exitText}
            onChangeText={setExitText}
            autoFocus
          />
          <View style={styles.gateButtons}>
            <IWButton voice="gray" small title="Save & step out" onPress={handleExitConfirm} />
            <IWButton
              small
              title="Keep going"
              onPress={() => {
                setShowExitGate(false);
                setExitText('');
                setExitNudged(false);
              }}
            />
          </View>
        </View>
      )}

      {/* Footer: Back / Continue + status */}
      <View style={styles.footerRow}>
        {!backHidden ? (
          <IWButton voice="gray" small title="Back" onPress={handleBack} />
        ) : (
          <View />
        )}
        <IWButton small title={nextLabel} onPress={handleNext} loading={busy} />
      </View>
      {status ? <Text style={styles.statusLine}>{status}</Text> : null}
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    loading: {
      padding: spacing.lg,
      alignItems: 'center',
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    stepLabel: {
      flex: 1,
      fontFamily: fontFamily.bodyBold,
      fontSize: fontSize.xs,
      letterSpacing: 1.5,
      color: colors.brandPrimary,
      marginRight: spacing.sm,
    },
    exitLink: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.xs,
      color: colors.fontMuted,
      textDecorationLine: 'underline',
    },
    intro: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.sm,
      color: colors.fontSecondary,
      lineHeight: 21,
      marginBottom: spacing.md,
    },
    valuesListWrap: {
      maxHeight: 340,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: borderRadius.md,
    },
    evalListWrap: {
      maxHeight: 180,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: borderRadius.md,
      marginBottom: spacing.md,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
      minHeight: 44,
    },
    rowSel: {
      backgroundColor: colors.infoBg,
    },
    rowName: {
      fontFamily: fontFamily.buttonBold,
      fontSize: fontSize.sm,
      color: colors.fontSecondary,
    },
    rowNameSel: {
      color: colors.brandPrimary,
    },
    rowDef: {
      flex: 1,
      fontFamily: fontFamily.body,
      fontSize: fontSize.xs,
      color: colors.fontMuted,
    },
    ideaText: {
      flex: 1,
      fontFamily: fontFamily.serif,
      fontSize: fontSize.sm,
      color: colors.fontMain,
    },
    rankBadge: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 1.5,
      borderColor: colors.borderMedium,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rankBadgeText: {
      fontFamily: fontFamily.buttonBold,
      fontSize: fontSize.xs,
      color: colors.brandPrimary,
    },
    countLine: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.sm,
      color: colors.fontMuted,
      marginTop: spacing.sm,
    },
    creditLine: {
      fontFamily: fontFamily.body,
      fontSize: 10.5,
      fontStyle: 'italic',
      color: colors.fontMuted,
      marginTop: spacing.sm,
    },
    visionInput: {
      fontFamily: fontFamily.serif,
      backgroundColor: colors.bgCard,
      borderRadius: borderRadius.lg,
      padding: spacing.base,
      fontSize: fontSize.md,
      lineHeight: fontSize.md * 1.6,
      color: colors.fontMain,
      borderWidth: 1,
      borderColor: colors.borderMedium,
      minHeight: 170,
      marginBottom: spacing.md,
    },
    ideaInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    ideaInput: {
      flex: 1,
      fontFamily: fontFamily.serif,
      backgroundColor: colors.bgCard,
      borderRadius: borderRadius.md,
      padding: spacing.sm,
      fontSize: fontSize.md,
      color: colors.fontMain,
      borderWidth: 1,
      borderColor: colors.borderMedium,
    },
    removeX: {
      fontSize: fontSize.lg,
      color: colors.fontMuted,
      paddingHorizontal: spacing.sm,
    },
    sophyAction: {
      alignSelf: 'flex-start',
      marginTop: spacing.md,
    },
    sophyBox: {
      backgroundColor: colors.sophyTint,
      borderWidth: 1,
      borderColor: colors.sophyBorder,
      borderRadius: borderRadius.md,
      padding: spacing.base,
      marginTop: spacing.md,
    },
    sophyWho: {
      fontFamily: fontFamily.bodyBold,
      fontSize: 10,
      letterSpacing: 2,
      color: colors.sophyLight,
      marginBottom: 2,
    },
    sophyText: {
      flex: 1,
      fontFamily: fontFamily.serifItalic,
      fontStyle: 'italic',
      fontSize: fontSize.base,
      color: colors.fontMain,
      lineHeight: fontSize.base * 1.5,
    },
    seedLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    seedAddChip: {
      borderWidth: 1,
      borderColor: colors.borderMedium,
      borderRadius: 999,
      paddingVertical: 2,
      paddingHorizontal: spacing.sm,
    },
    seedAddChipDone: {
      opacity: 0.5,
    },
    seedAddChipText: {
      fontFamily: fontFamily.button,
      fontSize: fontSize.xs,
      color: colors.fontSecondary,
    },
    evalBlock: {
      marginBottom: spacing.md,
    },
    evalIdea: {
      fontFamily: fontFamily.buttonBold,
      fontSize: fontSize.sm,
      color: colors.brandPrimary,
      marginBottom: spacing.xs,
    },
    evalInput: {
      fontFamily: fontFamily.serif,
      backgroundColor: colors.bgCard,
      borderRadius: borderRadius.md,
      padding: spacing.sm,
      fontSize: fontSize.sm,
      color: colors.fontMain,
      borderWidth: 1,
      borderColor: colors.borderMedium,
      minHeight: 56,
    },
    gate: {
      borderWidth: 1.5,
      borderColor: colors.borderMedium,
      borderRadius: borderRadius.md,
      backgroundColor: colors.bgMuted,
      padding: spacing.base,
      marginTop: spacing.md,
    },
    gateText: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.sm,
      color: colors.fontSecondary,
      lineHeight: 21,
      marginBottom: spacing.md,
    },
    gateBold: {
      fontFamily: fontFamily.bodyBold,
      color: colors.fontMain,
    },
    gateButtons: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    exitInput: {
      fontFamily: fontFamily.body,
      backgroundColor: colors.bgCard,
      borderRadius: borderRadius.md,
      padding: spacing.sm,
      fontSize: fontSize.md,
      color: colors.fontMain,
      borderWidth: 1.5,
      borderColor: colors.borderMedium,
      marginBottom: spacing.md,
    },
    exitInputNudged: {
      borderColor: colors.sophyAccent,
    },
    footerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: spacing.lg,
      gap: spacing.sm,
    },
    statusLine: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.sm,
      fontStyle: 'italic',
      color: colors.fontMuted,
      marginTop: spacing.sm,
      textAlign: 'center',
    },
  });

export default ValuesPlanner;
