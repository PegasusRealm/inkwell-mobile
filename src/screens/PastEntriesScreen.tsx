/**
 * Entries tab (v2.0, 2026-10-01). Mockup "4 Entries".
 * Top to bottom: Ask your journal (free, semanticSearch), the month calendar
 * (teal ring = a day with entries, filled teal disc = today, soft halo = selected),
 * the selected day's entries, then "Your month" (Sophy's 30-day read, Plus).
 * The depth line closes the screen as a plain fact.
 * The anniversary card moved to Today (2026-10-01).
 * Period insights: the server reads `period` ('weekly' | 'monthly'), not `days`.
 * Type floor: dates and subtitles >= 15px, nothing under 13px.
 */
import React, {useState, useEffect, useMemo, useCallback, useRef} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Modal,
  Alert,
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import Svg, {Circle, Path} from 'react-native-svg';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {useFocusEffect} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {spacing, borderRadius, fontFamily} from '../theme';
import {useTheme, ThemeColors} from '../theme/ThemeContext';
import PastEntryCard from '../components/PastEntryCard';
import {IdentityBar, ScreenTitle} from '../components/IdentityBar';
import PaywallModal from '../components/PaywallModal';
import {IWButton, Pill, SophyOrb} from '../components/kit';
import {ChevronLeftIcon, ChevronRightIcon, CloseIcon} from '../components/kit/icons';
import {CoachHint} from '../components/FirstStepsCard';
import {FirstStepsService} from '../services/firstStepsService';
import {useSubscription} from '../hooks/useSubscription';
import type {TabScreenProps} from '../navigation/types';
import {iPadContentStyle} from '../utils/iPad';

// Questions only history can answer. Shown while the search field is focused and empty.
const SEARCH_EXAMPLES = [
  'When did I feel proud of myself?',
  "What did I say I'd do differently last time?",
  "What shows up when I'm stressed?",
  'What was I grateful for months ago?',
];

const DAYS_OF_WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const SEARCH_URL = 'https://us-central1-inkwell-alpha.cloudfunctions.net/semanticSearch';
const INSIGHTS_URL = __DEV__
  ? 'http://localhost:5001/inkwell-alpha/us-central1/generatePeriodInsights'
  : 'https://us-central1-inkwell-alpha.cloudfunctions.net/generatePeriodInsights';

type Period = '7' | '30';
// generatePeriodInsights reads `period`: 'monthly' gives 30 days, anything else 7.
const SERVER_PERIOD: Record<Period, 'weekly' | 'monthly'> = {'7': 'weekly', '30': 'monthly'};

const SearchIcon: React.FC<{size?: number; color: string}> = ({size = 19, color}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx={11} cy={11} r={6.5} stroke={color} strokeWidth={2} />
    <Path d="M20 20l-4.2-4.2" stroke={color} strokeWidth={2} strokeLinecap="round" />
  </Svg>
);

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const PastEntriesScreen: React.FC<TabScreenProps<'Entries'>> = ({navigation, route}) => {
  const {colors} = useTheme();
  const {width: screenWidth} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {isPremium, loading: subscriptionLoading, showPaywall, openPaywall, closePaywall} = useSubscription();

  // FirstSteps: visiting Entries completes the quest step (web onTabVisit parity)
  useFocusEffect(
    useCallback(() => {
      FirstStepsService.complete('entries');
    }, []),
  );

  // Week dots in the identity bar refresh each time the tab comes back into view
  const [refreshTick, setRefreshTick] = useState(0);
  const hasFocusedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (hasFocusedRef.current) {
        setRefreshTick(t => t + 1);
      } else {
        hasFocusedRef.current = true;
      }
    }, []),
  );

  // Calendar + selected day
  const [displayedMonth, setDisplayedMonth] = useState(new Date().getMonth());
  const [displayedYear, setDisplayedYear] = useState(new Date().getFullYear());
  const [entryDates, setEntryDates] = useState<Set<string>>(new Set());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [dayEntries, setDayEntries] = useState<any[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  // Ask your journal (free)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [searching, setSearching] = useState(false);
  const [showingSearchResults, setShowingSearchResults] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [lastQuery, setLastQuery] = useState('');
  const [searchError, setSearchError] = useState('');

  // Edit
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [editText, setEditText] = useState('');

  // Your month (Sophy's period read)
  const [monthOpen, setMonthOpen] = useState(false);
  const [monthView, setMonthView] = useState<Period>('30');
  const [monthLoading, setMonthLoading] = useState<Period | null>(null);
  const [insights, setInsights] = useState<Partial<Record<Period, {text: string; count?: number}>>>({});
  const [monthNote, setMonthNote] = useState<string | null>(null);
  const [monthNoteIsError, setMonthNoteIsError] = useState(false);

  // Depth line: how far back the journal goes, stated as a fact
  const [depthLine, setDepthLine] = useState('');

  const selectedDayRef = useRef<number | null>(null);
  const dayRequestRef = useRef(0); // latest day request wins
  const monthKeyRef = useRef(''); // latest month load wins
  const initialPickDoneRef = useRef(false);
  // The month on screen, read at call time so a late async call never queries a stale month
  const displayedRef = useRef({y: displayedYear, m: displayedMonth});
  displayedRef.current = {y: displayedYear, m: displayedMonth};
  // Today's memory card opens Entries on that entry's day
  const pendingJumpRef = useRef<{y: number; m: number; d: number} | null>(null);
  const depthLoadedRef = useRef(false);

  // Load the days that hold entries whenever the shown month changes
  useEffect(() => {
    loadEntryDates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayedMonth, displayedYear]);

  useEffect(() => {
    const loadDepth = async () => {
      if (depthLoadedRef.current) return;
      const user = auth().currentUser;
      if (!user) return;
      depthLoadedRef.current = true;
      try {
        const firstSnap = await firestore()
          .collection('journalEntries')
          .where('userId', '==', user.uid)
          .orderBy('createdAt', 'asc')
          .limit(1)
          .get();
        if (!firstSnap.empty) {
          const first = firstSnap.docs[0].data().createdAt;
          const firstDate = first?.toDate ? first.toDate() : new Date(first);
          if (isNaN(firstDate.getTime())) return;
          const months = Math.floor((Date.now() - firstDate.getTime()) / (30.44 * 24 * 3600 * 1000));
          const since = firstDate.toLocaleDateString('en-US', {month: 'long', year: 'numeric'});
          setDepthLine(
            months >= 1
              ? `Your journal holds ${months} month${months === 1 ? '' : 's'} of your thinking, since ${since}.`
              : `Your journal began on ${firstDate.toLocaleDateString('en-US', {month: 'long', day: 'numeric'})}.`,
          );
        }
      } catch (e: any) {
        console.warn('Depth line skipped:', e.message);
      }
    };
    loadDepth();
  }, []);

  const loadEntryDates = async (forceServer = false): Promise<Set<string>> => {
    const key = `${displayedYear}-${displayedMonth}`;
    monthKeyRef.current = key;
    const datesWithEntries = new Set<string>();
    try {
      const user = auth().currentUser;
      if (user) {
        const startOfMonth = new Date(displayedYear, displayedMonth, 1);
        const endOfMonth = new Date(displayedYear, displayedMonth + 1, 0, 23, 59, 59, 999);

        const query = firestore()
          .collection('journalEntries')
          .where('userId', '==', user.uid)
          .where('createdAt', '>=', startOfMonth)
          .where('createdAt', '<=', endOfMonth);

        const snapshot = forceServer ? await query.get({source: 'server'}) : await query.get();

        snapshot.docs.forEach(doc => {
          const entry = doc.data();
          let entryDate: Date | null = null;
          if (entry.createdAt?.toDate) {
            entryDate = entry.createdAt.toDate();
          } else if (entry.date) {
            entryDate = new Date(entry.date);
          }
          if (entryDate) {
            datesWithEntries.add(entryDate.getDate().toString());
          }
        });
      }
    } catch (error) {
      console.error('Error loading entry dates:', error);
    }
    if (monthKeyRef.current === key) {
      setEntryDates(datesWithEntries);
    }
    return datesWithEntries;
  };

  /** Load one day's entries. `silent` refreshes without the spinner, so open entries stay open. */
  const handleDateClick = useCallback(
    async (day: number, silent = false) => {
      const requestId = ++dayRequestRef.current;
      setSelectedDay(day);
      selectedDayRef.current = day;
      if (!silent) {
        setLoadingEntries(true);
      }

      try {
        const user = auth().currentUser;
        if (!user) {
          setDayEntries([]);
          return;
        }

        const {y, m} = displayedRef.current;
        const startOfDay = new Date(y, m, day, 0, 0, 0, 0);
        const endOfDay = new Date(y, m, day, 23, 59, 59, 999);

        const snapshot = await firestore()
          .collection('journalEntries')
          .where('userId', '==', user.uid)
          .where('createdAt', '>=', startOfDay)
          .where('createdAt', '<=', endOfDay)
          .orderBy('createdAt', 'desc')
          .get({source: 'server'});

        if (requestId !== dayRequestRef.current) return;

        const matchingEntries = snapshot.docs.map(doc => {
          const entryData = doc.data();
          return {
            id: doc.id,
            ...entryData,
            date: entryData.createdAt?.toDate?.()?.toISOString() || entryData.date,
          };
        });

        setDayEntries(matchingEntries);
      } catch (error) {
        console.error('Error loading entries for date:', error);
        if (requestId === dayRequestRef.current) {
          setDayEntries([]);
        }
      } finally {
        if (requestId === dayRequestRef.current) {
          setLoadingEntries(false);
        }
      }
    },
    [displayedYear, displayedMonth],
  );

  // Jump to a day (from Today's memory card): show that month, then open that day
  const jumpTo = route.params?.jumpTo;
  useEffect(() => {
    if (!jumpTo) return;
    const [y, m, d] = jumpTo.split('-').map(Number);
    navigation.setParams({jumpTo: undefined});
    if (!y || !m || !d) return;
    initialPickDoneRef.current = true;
    dayRequestRef.current++;
    setShowingSearchResults(false);
    selectedDayRef.current = d;
    setSelectedDay(d);
    if (displayedRef.current.y === y && displayedRef.current.m === m - 1) {
      handleDateClick(d);
      return;
    }
    setDayEntries([]);
    pendingJumpRef.current = {y, m: m - 1, d};
    setDisplayedYear(y);
    setDisplayedMonth(m - 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpTo]);
  useEffect(() => {
    const p = pendingJumpRef.current;
    if (p && p.y === displayedYear && p.m === displayedMonth) {
      pendingJumpRef.current = null;
      handleDateClick(p.d);
    }
  }, [displayedYear, displayedMonth, handleDateClick]);

  /** First visit: open today if it holds entries, else the latest earlier day this month, else today. */
  const pickStartDay = (dates: Set<string>): number => {
    const todayNum = new Date().getDate();
    if (dates.has(String(todayNum))) return todayNum;
    const earlier = Array.from(dates)
      .map(Number)
      .filter(d => !isNaN(d) && d < todayNum);
    return earlier.length > 0 ? Math.max(...earlier) : todayNum;
  };

  // Refresh calendar data (and the open day) when the tab comes into focus
  useFocusEffect(
    useCallback(() => {
      const refreshData = async () => {
        const dates = await loadEntryDates(true);
        if (!initialPickDoneRef.current) {
          initialPickDoneRef.current = true;
          if (selectedDayRef.current === null) {
            handleDateClick(pickStartDay(dates));
          }
          return;
        }
        const day = selectedDayRef.current;
        if (day !== null) {
          handleDateClick(day, true);
        }
      };
      refreshData();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [handleDateClick]),
  );

  const changeMonth = (delta: number) => {
    let newMonth = displayedMonth + delta;
    let newYear = displayedYear;
    if (newMonth < 0) {
      newMonth = 11;
      newYear--;
    } else if (newMonth > 11) {
      newMonth = 0;
      newYear++;
    }
    setDisplayedMonth(newMonth);
    setDisplayedYear(newYear);
    // Clear the old selection: a day number from the old month must not ring in the new one
    dayRequestRef.current++;
    setSelectedDay(null);
    selectedDayRef.current = null;
    setDayEntries([]);
    setLoadingEntries(false);
  };

  const generateCalendar = () => {
    const firstDay = new Date(displayedYear, displayedMonth, 1).getDay();
    const daysInMonth = new Date(displayedYear, displayedMonth + 1, 0).getDate();
    const weeks: (number | null)[][] = [];
    let week: (number | null)[] = [];

    for (let i = 0; i < firstDay; i++) {
      week.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      week.push(day);
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }
    if (week.length > 0) {
      while (week.length < 7) {
        week.push(null);
      }
      weeks.push(week);
    }
    return weeks;
  };

  // ── Edit / delete (same writes as before) ──
  const handleEdit = (entryId: string) => {
    const entry = dayEntries.find(e => e.id === entryId) || searchResults.find(e => e.id === entryId);
    if (entry) {
      setEditingEntry(entry);
      setEditText(entry.text);
      setEditModalVisible(true);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingEntry || !editText.trim()) return;

    try {
      await firestore().collection('journalEntries').doc(editingEntry.id).update({
        text: editText.trim(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });

      const applyEdit = (list: any[]) =>
        list.map(entry => (entry.id === editingEntry.id ? {...entry, text: editText.trim()} : entry));
      setDayEntries(applyEdit);
      setSearchResults(applyEdit);

      setEditModalVisible(false);
      setEditingEntry(null);
      setEditText('');
    } catch (error) {
      console.error('Error saving edit:', error);
      Alert.alert('Could not save', 'The change did not save. Please try again.');
    }
  };

  const handleDelete = async (entryId: string) => {
    try {
      await firestore().collection('journalEntries').doc(entryId).delete();
      setDayEntries(prev => prev.filter(entry => entry.id !== entryId));
      setSearchResults(prev => prev.filter(entry => entry.id !== entryId));
      loadEntryDates();
    } catch (error) {
      console.error('Error deleting entry:', error);
      Alert.alert('Could not delete', 'The entry was not deleted. Please try again.');
    }
  };

  // ── Ask your journal (semanticSearch, free) ──
  const runSearch = async (raw: string) => {
    const query = raw.trim();
    if (!query || searching) return;

    Keyboard.dismiss();
    setSearching(true);
    setShowingSearchResults(true);
    setSearchResults([]);
    setSearchError('');
    setLastQuery(query);

    try {
      const user = auth().currentUser;
      if (!user) {
        setSearchError('Sign in again to search your journal.');
        return;
      }

      const idToken = await user.getIdToken();

      const response = await fetch(SEARCH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({query}),
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = await response.json();
      const results = data.results || [];
      if (results.length === 0) {
        return;
      }

      // Load full entry data from Firestore using the IDs from semantic search
      const entryIds: string[] = results.map((r: any) => r.id).filter(Boolean);
      const fullResults: any[] = [];

      // Firestore 'in' queries support up to 10 items at a time
      for (let i = 0; i < entryIds.length; i += 10) {
        const batch = entryIds.slice(i, i + 10);
        const snapshot = await firestore()
          .collection('journalEntries')
          .where(firestore.FieldPath.documentId(), 'in', batch)
          .get();

        for (const doc of snapshot.docs) {
          const entryData = doc.data();
          fullResults.push({
            id: doc.id,
            ...entryData,
            date: entryData.createdAt?.toDate?.()?.toISOString() || entryData.date,
          });
        }
      }

      // Keep the order semanticSearch ranked them in
      const rank = new Map(entryIds.map((id, index) => [id, index]));
      fullResults.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));

      setSearchResults(fullResults);
    } catch (error) {
      console.error('Smart Search error:', error);
      setSearchError('Search did not go through. Check your connection and try again.');
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setShowingSearchResults(false);
    setSearchResults([]);
    setSearchError('');
    setLastQuery('');
  };

  // ── Your month: Sophy's 30-day read (7-day as the secondary option) ──
  const runInsight = async (period: Period) => {
    if (monthLoading) return;

    // Already read this session: just show it
    if (insights[period]) {
      setMonthView(period);
      setMonthNote(null);
      setMonthOpen(true);
      return;
    }

    const user = auth().currentUser;
    if (!user) {
      setMonthView(period);
      setMonthNote('Sign in again so Sophy can read your entries.');
      setMonthNoteIsError(false);
      setMonthOpen(true);
      return;
    }

    const days = period === '30' ? 30 : 7;
    setMonthLoading(period);

    try {
      const idToken = await user.getIdToken(true);
      const response = await fetch(INSIGHTS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        // The server reads `period`; `days` rides along for older builds of the function
        body: JSON.stringify({period: SERVER_PERIOD[period], days}),
      });

      const raw = await response.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = {};
      }

      // Plus gate: the server answers 200 {upgradeRequired: true}. Open the Plus preview, no error.
      const errorText = typeof data.error === 'string' ? data.error : '';
      if (data.upgradeRequired || /upgrade|requires? inkwell plus/i.test(errorText)) {
        openPaywall();
        return;
      }

      if (!response.ok) {
        throw new Error(`Period insights failed: ${response.status} ${raw}`);
      }

      if (data.insight) {
        setInsights(prev => ({
          ...prev,
          [period]: {text: String(data.insight), count: typeof data.entryCount === 'number' ? data.entryCount : undefined},
        }));
        setMonthNote(null);
      } else if (data.insufficientEntries || data.message) {
        const have =
          typeof data.entryCount === 'number' ? ` You have ${data.entryCount} so far.` : '';
        setMonthNote(`Sophy needs at least 3 entries from the last ${days} days to see a pattern.${have}`);
        setMonthNoteIsError(false);
      } else {
        setMonthNote('Sophy could not read your entries just now.');
        setMonthNoteIsError(true);
      }
      setMonthView(period);
      setMonthOpen(true);
    } catch (error) {
      console.error('Error generating period insights:', error);
      setMonthView(period);
      setMonthNote('Sophy could not read your entries just now.');
      setMonthNoteIsError(true);
      setMonthOpen(true);
    } finally {
      setMonthLoading(null);
    }
  };

  const handleMonthPress = () => {
    if (monthLoading) return;
    if (monthOpen) {
      setMonthOpen(false); // tapping again closes it
      return;
    }
    if (insights[monthView]) {
      setMonthNote(null);
      setMonthOpen(true);
      return;
    }
    runInsight('30');
  };

  // ── Derived view values ──
  const monthName = new Date(displayedYear, displayedMonth, 1).toLocaleString('en-US', {month: 'long'});
  const weeks = generateCalendar();
  const today = new Date();
  const isCurrentMonth = displayedMonth === today.getMonth() && displayedYear === today.getFullYear();

  const selectedDate = selectedDay !== null ? new Date(displayedYear, displayedMonth, selectedDay) : null;
  const emptyDayText = selectedDate
    ? isSameDay(selectedDate, today)
      ? 'Nothing written today yet.'
      : `Nothing written on ${selectedDate.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          ...(selectedDate.getFullYear() !== today.getFullYear() ? {year: 'numeric'} : {}),
        })}.`
    : 'Tap a ringed day to read what you wrote.';

  const shownInsight = monthOpen ? insights[monthView] : undefined;
  const viewingWeek = monthOpen && monthView === '7';
  const monthTitle = viewingWeek ? 'Your week' : 'Your month';
  const monthSubtitle = monthLoading
    ? 'Sophy is reading...'
    : shownInsight?.count
    ? `Sophy read ${shownInsight.count} ${shownInsight.count === 1 ? 'entry' : 'entries'} from your last ${
        monthView === '30' ? '30' : '7'
      } days.`
    : viewingWeek
    ? 'Sophy reads your last 7 days.'
    : 'Sophy reads your last 30 days.';
  const showPeriodToggle = monthOpen && ((monthView === '30' && !!insights['30']) || monthView === '7');

  const showExamples = searchFocused && !searchQuery && !showingSearchResults;
  const canAsk = !!searchQuery.trim() && (!showingSearchResults || searchQuery.trim() !== lastQuery);

  return (
    <View style={styles.screen}>
      <IdentityBar refreshTrigger={refreshTick} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, iPadContentStyle(screenWidth)]}
        keyboardShouldPersistTaps="handled">
        <ScreenTitle>Entries</ScreenTitle>

        {/* ─── a. Ask your journal anything (free) ─── */}
        <View style={styles.section}>
          <View style={[styles.searchField, searchFocused && styles.searchFieldFocused]}>
            <SearchIcon color={colors.brandPrimary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Ask your journal anything"
              placeholderTextColor={colors.fontMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={() => runSearch(searchQuery)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              returnKeyType="search"
              editable={!searching}
              accessibilityLabel="Ask your journal anything"
            />
            {searching ? (
              <ActivityIndicator size="small" color={colors.brandPrimary} />
            ) : canAsk ? (
              <TouchableOpacity
                onPress={() => runSearch(searchQuery)}
                hitSlop={{top: 10, bottom: 10, left: 8, right: 8}}
                accessibilityRole="button">
                <Text style={styles.askLink}>Ask</Text>
              </TouchableOpacity>
            ) : null}
            {!searching && (searchQuery.length > 0 || showingSearchResults) && (
              <TouchableOpacity
                onPress={clearSearch}
                hitSlop={{top: 10, bottom: 10, left: 8, right: 8}}
                accessibilityRole="button"
                accessibilityLabel="Clear search">
                <CloseIcon color={colors.fontMuted} size={18} />
              </TouchableOpacity>
            )}
          </View>

          {showExamples && (
            <View style={styles.examplesRow}>
              {SEARCH_EXAMPLES.map(q => (
                <Pill
                  key={q}
                  label={q}
                  onPress={() => {
                    setSearchQuery(q);
                    runSearch(q);
                  }}
                />
              ))}
            </View>
          )}
        </View>

        {showingSearchResults ? (
          /* ─── Search results take the calendar's place until cleared ─── */
          <View style={styles.section}>
            {searching ? (
              <View style={styles.quietState}>
                <ActivityIndicator size="small" color={colors.brandPrimary} />
                <Text style={[styles.quietText, {marginTop: spacing.sm}]}>Reading your journal...</Text>
              </View>
            ) : searchError ? (
              <Text style={styles.quietText}>{searchError}</Text>
            ) : searchResults.length === 0 ? (
              <Text style={styles.quietText}>
                Nothing surfaced for that question. Try other words. The longer you write, the more your
                journal can answer.
              </Text>
            ) : (
              <>
                <Text style={styles.resultsHeader}>
                  Found {searchResults.length} {searchResults.length === 1 ? 'entry' : 'entries'}
                </Text>
                {searchResults.map(entry => (
                  <PastEntryCard
                    key={entry.id}
                    entry={{...entry, date: new Date(entry.date)}}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </>
            )}
            {!searching && (
              <TouchableOpacity onPress={clearSearch} style={styles.backLink} accessibilityRole="button">
                <Text style={styles.backLinkText}>Back to your calendar</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            {/* ─── b. Calendar: air, a ring for days with entries, a disc for today ─── */}
            <CoachHint markId="calendar" text="Ringed days hold your words. Tap one." />
            <View style={styles.section}>
              <View style={styles.calendarNav}>
                <TouchableOpacity
                  style={styles.calNavButton}
                  onPress={() => changeMonth(-1)}
                  accessibilityRole="button"
                  accessibilityLabel="Previous month">
                  <ChevronLeftIcon color={colors.brandPrimary} size={22} />
                </TouchableOpacity>
                <Text style={styles.monthHeading}>
                  {monthName} {displayedYear}
                </Text>
                <TouchableOpacity
                  style={styles.calNavButton}
                  onPress={() => changeMonth(1)}
                  accessibilityRole="button"
                  accessibilityLabel="Next month">
                  <ChevronRightIcon color={colors.brandPrimary} size={22} />
                </TouchableOpacity>
              </View>

              {/* Day-of-week header */}
              <View style={styles.calendarRow}>
                {DAYS_OF_WEEK.map((day, i) => (
                  <View key={i} style={styles.calendarHeaderCell}>
                    <Text style={styles.calendarHeaderText}>{day}</Text>
                  </View>
                ))}
              </View>

              {/* Date rows */}
              {weeks.map((week, weekIndex) => (
                <View key={weekIndex} style={styles.calendarRow}>
                  {week.map((day, dayIndex) => {
                    if (day === null) {
                      return <View key={dayIndex} style={styles.calendarCell} />;
                    }
                    const hasEntry = entryDates.has(day.toString());
                    const isToday = isCurrentMonth && day === today.getDate();
                    const isSelected = day === selectedDay;

                    return (
                      <View key={dayIndex} style={styles.calendarCell}>
                        <View style={[styles.calHalo, isSelected && styles.calHaloOn]}>
                          <TouchableOpacity
                            style={[styles.calDay, hasEntry && styles.calDayEntry, isToday && styles.calDayToday]}
                            onPress={() => {
                              Keyboard.dismiss();
                              handleDateClick(day);
                            }}
                            accessibilityRole="button"
                            accessibilityState={{selected: isSelected}}
                            accessibilityLabel={`${monthName} ${day}${isToday ? ', today' : ''}${
                              hasEntry ? ', has entries' : ''
                            }`}>
                            <Text style={[styles.calDayText, isToday && styles.calDayTextToday]}>{day}</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>

            {/* ─── c. The selected day's entries ─── */}
            <View style={styles.section}>
              {loadingEntries ? (
                <View style={styles.quietState}>
                  <ActivityIndicator size="small" color={colors.brandPrimary} />
                </View>
              ) : dayEntries.length === 0 ? (
                <Text style={styles.quietText}>{emptyDayText}</Text>
              ) : (
                dayEntries.map(entry => (
                  <PastEntryCard
                    key={entry.id}
                    entry={{...entry, date: new Date(entry.date)}}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    defaultExpanded={dayEntries.length === 1}
                  />
                ))
              )}
            </View>
          </>
        )}

        {/* ─── d. Your month: Sophy's read, her color ─── */}
        <View style={[styles.section, styles.monthCard]}>
          <Pressable
            style={styles.monthHead}
            onPress={handleMonthPress}
            accessibilityRole="button"
            accessibilityState={{expanded: monthOpen, busy: !!monthLoading}}
            accessibilityLabel={`${monthTitle}. ${monthSubtitle}${!isPremium && !subscriptionLoading ? ' Plus.' : ''}`}>
            <SophyOrb size={24} />
            <View style={styles.monthTxt}>
              <View style={styles.monthTitleRow}>
                <Text style={styles.monthTitle}>{monthTitle}</Text>
                {!isPremium && !subscriptionLoading && (
                  <View style={styles.plusTag}>
                    <Text style={styles.plusTagText}>PLUS</Text>
                  </View>
                )}
              </View>
              <Text style={styles.monthSub}>{monthSubtitle}</Text>
            </View>
            {monthLoading ? (
              <ActivityIndicator size="small" color={colors.sophyAccent} />
            ) : (
              <View style={monthOpen ? styles.chevronOpen : undefined}>
                <ChevronRightIcon color={colors.fontMuted} size={18} />
              </View>
            )}
          </Pressable>

          {monthOpen && (shownInsight || monthNote) && (
            <View style={styles.monthBody}>
              {shownInsight ? (
                <Text style={styles.monthInsight}>{shownInsight.text}</Text>
              ) : (
                <Text style={styles.monthNote}>{monthNote}</Text>
              )}
              {!shownInsight && monthNoteIsError && (
                <View style={styles.monthActions}>
                  <IWButton
                    voice="sophy"
                    small
                    title="Try again"
                    onPress={() => runInsight(monthView)}
                    disabled={!!monthLoading}
                  />
                </View>
              )}
              {showPeriodToggle && (
                <View style={styles.monthActions}>
                  <IWButton
                    voice="sophy"
                    small
                    title={monthView === '30' ? 'Just this week' : 'Back to your month'}
                    onPress={() => runInsight(monthView === '30' ? '7' : '30')}
                    disabled={!!monthLoading}
                  />
                </View>
              )}
            </View>
          )}
        </View>

        {/* Depth line: a fact, not a grade */}
        {depthLine ? <Text style={styles.depthLine}>{depthLine}</Text> : null}
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setEditModalVisible(false)}>
        <KeyboardAvoidingView
          style={[styles.modalContainer, {paddingTop: insets.top + spacing.base, paddingBottom: insets.bottom + spacing.base}]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit entry</Text>
            <TouchableOpacity
              onPress={() => setEditModalVisible(false)}
              hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}
              accessibilityRole="button"
              accessibilityLabel="Close">
              <CloseIcon color={colors.fontSecondary} size={22} />
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.modalTextInput}
            value={editText}
            onChangeText={setEditText}
            multiline
            textAlignVertical="top"
            placeholder="Your entry"
            placeholderTextColor={colors.fontMuted}
            autoFocus
          />
          <View style={styles.modalActions}>
            <IWButton voice="gray" title="Cancel" onPress={() => setEditModalVisible(false)} style={styles.modalButton} />
            <IWButton title="Save" onPress={handleSaveEdit} style={styles.modalButton} />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <PaywallModal visible={showPaywall} onClose={closePaywall} />
    </View>
  );
};

// Dynamic styles based on theme colors
const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    section: {
      marginBottom: spacing.xl,
    },

    // ── Ask your journal (mockup .search) ──
    searchField: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 50,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderMedium,
      backgroundColor: colors.bgCard,
    },
    searchFieldFocused: {
      borderColor: colors.brandPrimary,
    },
    searchInput: {
      flex: 1,
      fontFamily: fontFamily.body,
      fontSize: 16,
      color: colors.fontMain,
      paddingVertical: 12,
    },
    askLink: {
      fontFamily: fontFamily.buttonBold,
      fontSize: 15,
      color: colors.brandPrimary,
    },
    examplesRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    resultsHeader: {
      fontFamily: fontFamily.button,
      fontSize: 15,
      color: colors.fontSecondary,
      marginBottom: spacing.sm,
    },
    backLink: {
      alignSelf: 'center',
      paddingVertical: spacing.md,
      marginTop: spacing.sm,
    },
    backLinkText: {
      fontFamily: fontFamily.buttonBold,
      fontSize: 15,
      color: colors.brandPrimary,
    },

    // ── Calendar: air, a ring for days with entries, a disc for today ──
    calendarNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    calNavButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    monthHeading: {
      fontFamily: fontFamily.header,
      fontSize: 20,
      color: colors.fontMain,
    },
    calendarRow: {
      flexDirection: 'row',
    },
    calendarHeaderCell: {
      flex: 1,
      alignItems: 'center',
      paddingBottom: spacing.xs,
    },
    calendarHeaderText: {
      fontFamily: fontFamily.bodyBold,
      fontSize: 13,
      letterSpacing: 0.5,
      color: colors.fontMuted,
    },
    calendarCell: {
      flex: 1,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Selected: a soft halo around whatever the day already is (ring, disc, or plain)
    calHalo: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    calHaloOn: {
      backgroundColor: colors.brandPrimaryRgba,
    },
    calDay: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    calDayEntry: {
      borderColor: colors.brandPrimary, // the quiet ring
    },
    calDayToday: {
      backgroundColor: colors.btnPrimary, // the filled disc
      borderColor: colors.btnPrimary,
    },
    calDayText: {
      fontFamily: fontFamily.body,
      fontSize: 15,
      color: colors.fontMain,
    },
    calDayTextToday: {
      fontFamily: fontFamily.bodyBold,
      color: colors.fontWhite,
    },

    // ── Quiet states ──
    quietState: {
      alignItems: 'center',
      paddingVertical: spacing.lg,
    },
    quietText: {
      fontFamily: fontFamily.body,
      fontSize: 15,
      lineHeight: 22,
      color: colors.fontMuted,
      textAlign: 'center',
      paddingVertical: spacing.base,
    },

    // ── Your month (mockup .month): coral only, never teal inside ──
    monthCard: {
      backgroundColor: colors.sophyTint,
      borderColor: colors.sophyBorder,
      borderWidth: 1,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    monthHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 44,
    },
    monthTxt: {
      flex: 1,
      minWidth: 0,
    },
    monthTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    monthTitle: {
      fontFamily: fontFamily.bodyBold,
      fontSize: 16,
      color: colors.fontMain,
    },
    plusTag: {
      borderWidth: 1,
      borderColor: colors.sophyAccent,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 1,
    },
    plusTagText: {
      fontFamily: fontFamily.bodyBold,
      fontSize: 13,
      letterSpacing: 1,
      color: colors.sophyAccent,
    },
    monthSub: {
      fontFamily: fontFamily.body,
      fontSize: 15,
      color: colors.fontMuted,
      marginTop: 2,
    },
    chevronOpen: {
      transform: [{rotate: '90deg'}],
    },
    monthBody: {
      marginTop: 14,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: colors.sophyBorder,
    },
    monthInsight: {
      fontFamily: fontFamily.serif,
      fontSize: 17,
      lineHeight: 26,
      color: colors.fontMain,
    },
    monthNote: {
      fontFamily: fontFamily.body,
      fontSize: 15,
      lineHeight: 22,
      color: colors.fontSecondary,
    },
    monthActions: {
      flexDirection: 'row',
      marginTop: spacing.base,
    },

    // ── Depth line: one quiet fact at the bottom ──
    depthLine: {
      fontFamily: fontFamily.body,
      fontSize: 15,
      lineHeight: 22,
      color: colors.fontMuted,
      textAlign: 'center',
    },

    // ── Edit modal ──
    modalContainer: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
      paddingHorizontal: spacing.lg,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    modalTitle: {
      fontFamily: fontFamily.header,
      fontSize: 24,
      color: colors.fontMain,
    },
    modalTextInput: {
      fontFamily: fontFamily.serif,
      flex: 1,
      backgroundColor: colors.bgCard,
      borderWidth: 1,
      borderColor: colors.borderMedium,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      fontSize: 17,
      lineHeight: 27,
      color: colors.fontMain,
      marginBottom: spacing.lg,
    },
    modalActions: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    modalButton: {
      flex: 1,
    },
  });

export default PastEntriesScreen;
