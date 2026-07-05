/**
 * Entries screen (route key: PastEntries) — v2 rebuild (M2, 2026-07-04)
 * Structure: web Entries tab parity (app.html) + mockup calendar contract:
 * "no cage lines — air, discs, and one quiet ring" (inkwell-v2.css).
 * Search is the headline feature, headline placement (web 2026-07-04).
 * Compounding surfaces ported (depth line + anniversary card).
 * Connect is dead — reply layer, coachReplies fetches, mark-as-read
 * removed (2026-07-04).
 */
import React, {useState, useEffect, useMemo, useCallback, useRef} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {useFocusEffect} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {spacing, borderRadius, fontFamily, fontSize} from '../theme';
import {useTheme, ThemeColors} from '../theme/ThemeContext';
import PastEntryCard from '../components/PastEntryCard';
import WeeklyActivityDots from '../components/WeeklyActivityDots';
import {Card, IWButton, Pill, SophyBlock} from '../components/kit';
import {CoachHint} from '../components/FirstStepsCard';
import {FirstStepsService} from '../services/firstStepsService';
import type {TabScreenProps} from '../navigation/types';
import {iPadContentStyle} from '../utils/iPad';

// Example questions only history can answer (web verbatim, v2 Phase 4)
const SEARCH_EXAMPLES = [
  'When did I feel proud of myself?',
  "What did I say I'd do differently last time?",
  "What shows up when I'm stressed?",
  'What was I grateful for months ago?',
];

const DAYS_OF_WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const PastEntriesScreen: React.FC<TabScreenProps<'PastEntries'>> = ({navigation}) => {
  const {colors} = useTheme();
  const {width: screenWidth} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // FirstSteps: visiting Entries completes the quest step (web onTabVisit parity)
  useFocusEffect(
    useCallback(() => {
      FirstStepsService.complete('entries');
    }, []),
  );

  // The identity bar replaces the navigation header (matches JournalScreen)
  useEffect(() => {
    navigation.setOptions({headerShown: false});
  }, [navigation]);

  const [displayedMonth, setDisplayedMonth] = useState(new Date().getMonth());
  const [displayedYear, setDisplayedYear] = useState(new Date().getFullYear());
  const [searchQuery, setSearchQuery] = useState('');
  const [entryDates, setEntryDates] = useState<Set<string>>(new Set());
  const [selectedDateEntries, setSelectedDateEntries] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [editText, setEditText] = useState('');
  const [searching, setSearching] = useState(false);
  const [showingSearchResults, setShowingSearchResults] = useState(false);
  const [loadingEntries, setLoadingEntries] = useState(false);

  // Period Insights state
  const [generatingInsights, setGeneratingInsights] = useState(false);
  const [insightsModalVisible, setInsightsModalVisible] = useState(false);
  const [insightsContent, setInsightsContent] = useState('');
  const [insightsPeriod, setInsightsPeriod] = useState<'7' | '30'>('7');

  // Compounding surfaces (web v2 Phase 4 port)
  const [depthLine, setDepthLine] = useState('');
  const [anniversary, setAnniversary] = useState<{
    label: string;
    title: string;
    snippet: string;
    fullText: string;
    expanded: boolean;
  } | null>(null);

  // Refs to prevent concurrent loading / dependency loops
  const isLoadingEntriesRef = useRef(false);
  const selectedDateRef = useRef<string | null>(null);
  const compoundingLoadedRef = useRef(false);

  // Load entries and identify dates with journal entries
  useEffect(() => {
    loadEntryDates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayedMonth, displayedYear]);

  // ── Compounding surfaces: the journal's growing depth made visible ──
  useEffect(() => {
    const loadCompoundingSurfaces = async () => {
      if (compoundingLoadedRef.current) return;
      const user = auth().currentUser;
      if (!user) return;
      compoundingLoadedRef.current = true;

      // Depth indicator: how far back the journal goes
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
          const months = Math.floor((Date.now() - firstDate.getTime()) / (30.44 * 24 * 3600 * 1000));
          const since = firstDate.toLocaleDateString('en-US', {month: 'long', year: 'numeric'});
          setDepthLine(
            months >= 1
              ? `Your journal holds ${months} month${months === 1 ? '' : 's'} of your thinking (since ${since}). Everything you write compounds.`
              : 'Your journal is just beginning. Everything you write from here compounds.',
          );
        }
      } catch (e: any) {
        console.warn('Depth indicator skipped:', e.message);
      }

      // Anniversary resurfacing: one year ago, else one month ago
      try {
        const windows = [
          {label: 'One year ago you wrote', ms: 365 * 24 * 3600 * 1000, pad: 3 * 24 * 3600 * 1000},
          {label: 'One month ago you wrote', ms: 30 * 24 * 3600 * 1000, pad: 2 * 24 * 3600 * 1000},
        ];
        for (const w of windows) {
          const center = Date.now() - w.ms;
          const snap = await firestore()
            .collection('journalEntries')
            .where('userId', '==', user.uid)
            .where('createdAt', '>=', new Date(center - w.pad))
            .where('createdAt', '<=', new Date(center + w.pad))
            .orderBy('createdAt', 'desc')
            .limit(1)
            .get();
          if (!snap.empty) {
            const e = snap.docs[0].data();
            const d = e.createdAt?.toDate ? e.createdAt.toDate() : new Date(e.createdAt);
            const fullText = e.text || '';
            setAnniversary({
              label: `${w.label}...`,
              title: `${e.title || 'Journal entry'} — ${d.toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}`,
              snippet: fullText.slice(0, 220) + (fullText.length > 220 ? '…' : ''),
              fullText,
              expanded: false,
            });
            break;
          }
        }
      } catch (e: any) {
        console.warn('Anniversary resurfacing skipped:', e.message);
      }
    };
    loadCompoundingSurfaces();
  }, []);

  const loadEntryDates = async (forceServer = false) => {
    try {
      const user = auth().currentUser;
      if (!user) {
        setEntryDates(new Set());
        return;
      }

      const startOfMonth = new Date(displayedYear, displayedMonth, 1);
      const endOfMonth = new Date(displayedYear, displayedMonth + 1, 0, 23, 59, 59, 999);

      const query = firestore()
        .collection('journalEntries')
        .where('userId', '==', user.uid)
        .where('createdAt', '>=', startOfMonth)
        .where('createdAt', '<=', endOfMonth);

      const snapshot = forceServer ? await query.get({source: 'server'}) : await query.get();

      const datesWithEntries = new Set<string>();
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

      setEntryDates(datesWithEntries);
    } catch (error) {
      console.error('Error loading entry dates:', error);
      setEntryDates(new Set());
    }
  };

  const handleDateClick = useCallback(
    async (day: number) => {
      if (isLoadingEntriesRef.current) {
        return;
      }

      const newSelectedDate = `${displayedMonth + 1}/${day}/${displayedYear}`;
      setSelectedDate(newSelectedDate);
      setSelectedDay(day);
      selectedDateRef.current = newSelectedDate;
      setLoadingEntries(true);
      isLoadingEntriesRef.current = true;
      setShowingSearchResults(false);

      try {
        const user = auth().currentUser;
        if (!user) {
          setSelectedDateEntries([]);
          return;
        }

        const startOfDay = new Date(displayedYear, displayedMonth, day, 0, 0, 0, 0);
        const endOfDay = new Date(displayedYear, displayedMonth, day, 23, 59, 59, 999);

        const snapshot = await firestore()
          .collection('journalEntries')
          .where('userId', '==', user.uid)
          .where('createdAt', '>=', startOfDay)
          .where('createdAt', '<=', endOfDay)
          .orderBy('createdAt', 'desc')
          .get({source: 'server'});

        const matchingEntries = snapshot.docs.map(doc => {
          const entryData = doc.data();
          return {
            id: doc.id,
            ...entryData,
            date: entryData.createdAt?.toDate?.()?.toISOString() || entryData.date,
          };
        });

        setSelectedDateEntries(matchingEntries);
      } catch (error) {
        console.error('Error loading entries for date:', error);
        setSelectedDateEntries([]);
      } finally {
        setLoadingEntries(false);
        isLoadingEntriesRef.current = false;
      }
    },
    [displayedYear, displayedMonth],
  );

  // Refresh calendar data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const refreshData = async () => {
        await loadEntryDates(true);
        const currentSelectedDate = selectedDateRef.current;
        if (currentSelectedDate && !showingSearchResults) {
          const parts = currentSelectedDate.split('/');
          if (parts.length === 3) {
            const day = parseInt(parts[1], 10);
            if (!isNaN(day)) {
              handleDateClick(day);
            }
          }
        }
      };
      refreshData();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [handleDateClick, showingSearchResults]),
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
    // Clear stale selection — a day number from the old month must not ring in the new one
    setSelectedDay(null);
    setSelectedDate(null);
    selectedDateRef.current = null;
    setSelectedDateEntries([]);
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

  const handleEdit = (entryId: string) => {
    const entry = selectedDateEntries.find(e => e.id === entryId);
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

      setSelectedDateEntries(prev =>
        prev.map(entry => (entry.id === editingEntry.id ? {...entry, text: editText.trim()} : entry)),
      );

      setEditModalVisible(false);
      setEditingEntry(null);
      setEditText('');
    } catch (error) {
      console.error('Error saving edit:', error);
      Alert.alert('Error', 'Failed to update entry. Please try again.');
    }
  };

  const handleDelete = async (entryId: string) => {
    try {
      await firestore().collection('journalEntries').doc(entryId).delete();
      setSelectedDateEntries(prev => prev.filter(entry => entry.id !== entryId));
      loadEntryDates();
    } catch (error) {
      console.error('Error deleting entry:', error);
      Alert.alert('Error', 'Failed to delete entry. Please try again.');
    }
  };

  const handleSmartSearch = async () => {
    if (!searchQuery.trim()) {
      return;
    }

    setSearching(true);
    setShowingSearchResults(true);
    setSelectedDate(null);
    setSelectedDay(null);
    selectedDateRef.current = null;

    try {
      const user = auth().currentUser;
      if (!user) {
        Alert.alert('Error', 'You must be logged in to search your journal');
        return;
      }

      const idToken = await user.getIdToken();

      const response = await fetch('https://us-central1-inkwell-alpha.cloudfunctions.net/semanticSearch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({query: searchQuery}),
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = await response.json();
      const results = data.results || [];

      if (results.length === 0) {
        setSelectedDateEntries([]);
        return;
      }

      // Load full entry data from Firestore using the IDs from semantic search
      const entryIds = results.map((r: any) => r.id);
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

      setSelectedDateEntries(fullResults);
    } catch (error) {
      console.error('Smart Search error:', error);
      Alert.alert('Search Error', 'Failed to search your journal. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setShowingSearchResults(false);
    setSelectedDateEntries([]);
  };

  // Generate Period Insights (7-day or 30-day)
  const handleGeneratePeriodInsights = async (days: '7' | '30') => {
    const user = auth().currentUser;
    if (!user) {
      Alert.alert('Error', 'Please log in to generate insights.');
      return;
    }

    setGeneratingInsights(true);
    setInsightsPeriod(days);

    try {
      const idToken = await user.getIdToken(true);
      const endpoint = __DEV__
        ? 'http://localhost:5001/inkwell-alpha/us-central1/generatePeriodInsights'
        : 'https://us-central1-inkwell-alpha.cloudfunctions.net/generatePeriodInsights';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({days: parseInt(days, 10)}),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Period insights error:', response.status, errorText);
        throw new Error(`Failed to generate insights: ${response.status}`);
      }

      const data = await response.json();

      if (data.insight) {
        setInsightsContent(data.insight);
        setInsightsModalVisible(true);
      } else if (data.message) {
        Alert.alert('Not Enough Data', data.message);
      } else {
        Alert.alert('Error', 'Could not generate insights at this time.');
      }
    } catch (error: any) {
      console.error('Error generating period insights:', error);
      Alert.alert('Error', 'Failed to generate insights. Please try again later.');
    } finally {
      setGeneratingInsights(false);
    }
  };

  const monthName = new Date(displayedYear, displayedMonth, 1).toLocaleString('default', {month: 'long'});
  const weeks = generateCalendar();
  const today = new Date();
  const isCurrentMonth = displayedMonth === today.getMonth() && displayedYear === today.getFullYear();

  return (
    <View style={styles.screen}>
      {/* ─── Identity bar: wordmark + week dots (matches JournalScreen) ─── */}
      <View style={[styles.identityBar, {paddingTop: insets.top + spacing.sm}]}>
        <Text style={styles.wordmark}>
          Ink<Text style={styles.wordmarkAccent}>Well</Text>
        </Text>
        <View style={styles.identityRight}>
          <WeeklyActivityDots />
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Text style={styles.settingsLink}>Settings</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={[styles.content, iPadContentStyle(screenWidth)]}>
        <Text style={styles.screenTitle}>Entries</Text>

        {/* Depth line — the compounding, one whisper */}
        {depthLine ? <Text style={styles.depthLine}>{depthLine}</Text> : null}

        {/* Anniversary resurfacing — the journal remembering, quietly */}
        {anniversary && (
          <View style={styles.anniversaryCard}>
            <Text style={styles.anniversaryLabel}>{anniversary.label}</Text>
            <Text style={styles.anniversaryTitle}>{anniversary.title}</Text>
            <Text style={styles.anniversarySnippet}>
              {anniversary.expanded ? anniversary.fullText : anniversary.snippet}
            </Text>
            {!anniversary.expanded && anniversary.fullText.length > 220 && (
              <TouchableOpacity onPress={() => setAnniversary(prev => (prev ? {...prev, expanded: true} : prev))}>
                <Text style={styles.anniversaryMore}>Read the rest</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ─── Ask Your Journal Anything — headline feature, headline placement ─── */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>Ask Your Journal Anything</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="ask anything about your past entries"
            placeholderTextColor={colors.fontMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSmartSearch}
            returnKeyType="search"
            editable={!searching}
          />
          <View style={styles.searchButtonRow}>
            <IWButton
              voice="sophy"
              title={searching ? 'Searching...' : 'Search'}
              onPress={handleSmartSearch}
              disabled={!searchQuery.trim() || searching}
              loading={searching}
              style={styles.searchButton}
            />
            {showingSearchResults && <IWButton voice="gray" title="Clear" onPress={clearSearch} />}
          </View>

          <Text style={styles.examplesLabel}>Try asking your journal:</Text>
          <View style={styles.examplesRow}>
            {SEARCH_EXAMPLES.map(q => (
              <Pill key={q} label={q} onPress={() => setSearchQuery(q)} />
            ))}
          </View>
          <Text style={styles.examplesHint}>The longer you write, the more your journal can answer.</Text>
        </Card>

        {/* ─── Calendar: no cage lines — air, discs, and one quiet ring ─── */}
        <CoachHint markId="calendar" text="Teal days hold your words. Tap one." />
        <Card style={styles.sectionCard}>
          <View style={styles.calendarNav}>
            <TouchableOpacity
              style={styles.calNavButton}
              onPress={() => changeMonth(-1)}
              accessibilityLabel="Previous month">
              <Text style={styles.calNavChevron}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.monthHeading}>
              {monthName} {displayedYear}
            </Text>
            <TouchableOpacity
              style={styles.calNavButton}
              onPress={() => changeMonth(1)}
              accessibilityLabel="Next month">
              <Text style={styles.calNavChevron}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Day-of-week header */}
          <View style={styles.calendarRow}>
            {DAYS_OF_WEEK.map((day, i) => (
              <View key={i} style={styles.calendarCellWrap}>
                <Text style={styles.calendarHeaderText}>{day}</Text>
              </View>
            ))}
          </View>

          {/* Date rows */}
          {weeks.map((week, weekIndex) => (
            <View key={weekIndex} style={styles.calendarRow}>
              {week.map((day, dayIndex) => {
                const hasEntry = day ? entryDates.has(day.toString()) : false;
                const isToday = day !== null && isCurrentMonth && day === today.getDate();
                const isSelected = day !== null && !showingSearchResults && day === selectedDay;

                return (
                  <View key={dayIndex} style={styles.calendarCellWrap}>
                    {day !== null && (
                      <TouchableOpacity
                        style={[
                          styles.calDay,
                          hasEntry && styles.calDayEntry,
                          isToday && styles.calDayToday,
                          isSelected && !hasEntry && styles.calDaySelected,
                          isSelected && hasEntry && styles.calDaySelectedEntry,
                        ]}
                        onPress={() => handleDateClick(day)}
                        accessibilityLabel={`${monthName} ${day}${hasEntry ? ', has entries' : ''}`}>
                        <Text
                          style={[
                            styles.calDayText,
                            hasEntry && styles.calDayTextEntry,
                          ]}>
                          {day}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </Card>

        {/* ─── Sophy: period insights — her block, her color ─── */}
        <SophyBlock line="Give me a week of your words and I’ll show you what’s building." style={styles.sectionCard}>
          <View style={styles.insightsButtonRow}>
            <IWButton
              voice="sophy"
              small
              title="7-Day Insights"
              onPress={() => handleGeneratePeriodInsights('7')}
              loading={generatingInsights && insightsPeriod === '7'}
              disabled={generatingInsights}
            />
            <IWButton
              voice="sophy"
              small
              title="30-Day Insights"
              onPress={() => handleGeneratePeriodInsights('30')}
              loading={generatingInsights && insightsPeriod === '30'}
              disabled={generatingInsights}
            />
          </View>
        </SophyBlock>

        {/* ─── Entries ─── */}
        <View style={styles.entriesContainer}>
          {showingSearchResults ? (
            <Text style={styles.entriesHeader}>
              {searching
                ? 'Searching your journal...'
                : `Found ${selectedDateEntries.length} relevant ${
                    selectedDateEntries.length === 1 ? 'entry' : 'entries'
                  }`}
            </Text>
          ) : selectedDate ? (
            <Text style={styles.entriesHeader}>Entries for {selectedDate}</Text>
          ) : null}

          {loadingEntries ? (
            <View style={styles.placeholderContainer}>
              <ActivityIndicator size="large" color={colors.brandPrimary} />
              <Text style={[styles.placeholderText, {marginTop: spacing.md}]}>Loading entries...</Text>
            </View>
          ) : selectedDateEntries.length === 0 ? (
            <View style={styles.placeholderContainer}>
              <Text style={styles.placeholderText}>
                {showingSearchResults && !searching
                  ? 'Nothing surfaced for that question. Try different words, or keep writing — the longer you write, the more your journal can answer.'
                  : selectedDate
                  ? 'No entries found for this date.'
                  : 'Tap a teal day on the calendar, or ask your journal anything.'}
              </Text>
            </View>
          ) : (
            selectedDateEntries.map(entry => (
              <PastEntryCard
                key={entry.id}
                entry={{
                  ...entry,
                  date: new Date(entry.date),
                }}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))
          )}
        </View>

        {/* Edit Modal */}
        <Modal
          visible={editModalVisible}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setEditModalVisible(false)}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Entry</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Text style={styles.modalCloseButton}>×</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalTextInput}
              value={editText}
              onChangeText={setEditText}
              multiline
              textAlignVertical="top"
              placeholder="Edit your journal entry..."
              placeholderTextColor={colors.fontMuted}
              autoFocus
            />
            <View style={styles.modalActions}>
              <IWButton voice="gray" title="Cancel" onPress={() => setEditModalVisible(false)} style={styles.modalButton} />
              <IWButton title="Save" onPress={handleSaveEdit} style={styles.modalButton} />
            </View>
          </View>
        </Modal>

        {/* Period Insights Modal */}
        <Modal
          visible={insightsModalVisible}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setInsightsModalVisible(false)}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{insightsPeriod}-Day Insights</Text>
              <TouchableOpacity onPress={() => setInsightsModalVisible(false)}>
                <Text style={styles.modalCloseButton}>×</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.insightsWho}>SOPHY</Text>
            <ScrollView style={styles.insightsScrollView}>
              <Text style={styles.insightsContent}>{insightsContent}</Text>
            </ScrollView>
            <View style={styles.insightsFooter}>
              <IWButton title="Close" onPress={() => setInsightsModalVisible(false)} />
            </View>
          </View>
        </Modal>
      </ScrollView>
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
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
    },

    // ── Identity bar (matches JournalScreen) ──
    identityBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
      backgroundColor: colors.bgPrimary,
    },
    wordmark: {
      fontFamily: fontFamily.header,
      fontSize: fontSize.xl,
      color: colors.fontMain,
      letterSpacing: 0.3,
    },
    wordmarkAccent: {
      color: colors.brandPrimary,
    },
    identityRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    settingsLink: {
      fontFamily: fontFamily.button,
      fontSize: fontSize.sm,
      color: colors.fontSecondary,
    },

    screenTitle: {
      fontFamily: fontFamily.header,
      fontSize: fontSize.display,
      color: colors.fontMain,
      marginBottom: spacing.sm,
    },

    // ── Compounding surfaces ──
    depthLine: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.sm,
      color: colors.fontSecondary,
      marginBottom: spacing.md,
    },
    anniversaryCard: {
      backgroundColor: colors.bgCard,
      borderLeftWidth: 4,
      borderLeftColor: colors.sophyLight,
      borderTopRightRadius: borderRadius.md,
      borderBottomRightRadius: borderRadius.md,
      padding: spacing.base,
      marginBottom: spacing.lg,
    },
    anniversaryLabel: {
      fontFamily: fontFamily.bodyBold,
      fontSize: fontSize.sm,
      color: colors.brandPrimary,
      marginBottom: spacing.xs,
    },
    anniversaryTitle: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.xs,
      color: colors.fontSecondary,
      marginBottom: spacing.xs,
    },
    anniversarySnippet: {
      fontFamily: fontFamily.serif,
      fontSize: fontSize.base,
      color: colors.fontMain,
      lineHeight: fontSize.base * 1.5,
    },
    anniversaryMore: {
      fontFamily: fontFamily.button,
      fontSize: fontSize.xs,
      color: colors.fontSecondary,
      textDecorationLine: 'underline',
      marginTop: spacing.sm,
    },

    // ── Cards / sections ──
    sectionCard: {
      marginBottom: spacing.lg,
    },
    sectionHeader: {
      fontFamily: fontFamily.header,
      fontSize: fontSize.xl,
      color: colors.fontMain,
      textAlign: 'center',
      marginBottom: spacing.md,
    },

    // ── Search ──
    searchInput: {
      fontFamily: fontFamily.serif,
      backgroundColor: colors.bgCard,
      borderWidth: 1,
      borderColor: colors.borderMedium,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      fontSize: fontSize.md,
      color: colors.fontMain,
      marginBottom: spacing.md,
    },
    searchButtonRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    searchButton: {
      flex: 1,
    },
    examplesLabel: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.sm,
      color: colors.fontMuted,
      textAlign: 'center',
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    examplesRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    examplesHint: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.xs,
      color: colors.fontMuted,
      fontStyle: 'italic',
      textAlign: 'center',
      marginTop: spacing.sm,
    },

    // ── Calendar: air, discs, one quiet ring ──
    calendarNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    calNavButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    calNavChevron: {
      fontSize: 26,
      color: colors.brandPrimary,
      lineHeight: 30,
    },
    monthHeading: {
      fontFamily: fontFamily.header,
      fontSize: fontSize.lg,
      color: colors.fontMain,
    },
    calendarRow: {
      flexDirection: 'row',
    },
    calendarCellWrap: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 3,
    },
    calendarHeaderText: {
      fontFamily: fontFamily.bodyBold,
      fontSize: fontSize.xs,
      letterSpacing: 1,
      color: colors.fontMuted,
      paddingBottom: spacing.sm,
    },
    calDay: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    calDayEntry: {
      backgroundColor: colors.btnPrimary, // deep teal disc, both themes
    },
    calDayToday: {
      borderColor: colors.brandSecondary, // thin bright ring, stacks with the disc
    },
    calDaySelected: {
      borderColor: colors.brandSecondary,
      backgroundColor: colors.bgMuted,
    },
    calDaySelectedEntry: {
      borderColor: colors.brandSecondary,
      backgroundColor: '#1E8A99', // selected entry day lifts (web contract)
    },
    calDayText: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.sm,
      color: colors.fontSecondary,
    },
    calDayTextEntry: {
      fontFamily: fontFamily.bodyBold,
      color: '#ffffff', // white number on the teal disc, both themes
    },

    // ── Insights block ──
    insightsButtonRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },

    // ── Entries list ──
    entriesContainer: {
      marginTop: spacing.sm,
    },
    entriesHeader: {
      fontFamily: fontFamily.header,
      fontSize: fontSize.md,
      color: colors.brandPrimary,
      marginBottom: spacing.md,
      textAlign: 'center',
    },
    placeholderContainer: {
      padding: spacing.xl,
      backgroundColor: colors.bgMuted,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderStyle: 'dashed',
    },
    placeholderText: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.sm,
      color: colors.fontMuted,
      textAlign: 'center',
      lineHeight: 20,
    },

    // ── Modals ──
    modalContainer: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
      padding: spacing.lg,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.lg,
      paddingTop: spacing.xl,
    },
    modalTitle: {
      fontFamily: fontFamily.header,
      fontSize: fontSize.xxl,
      color: colors.fontMain,
    },
    modalCloseButton: {
      fontSize: fontSize.xxxl,
      color: colors.fontSecondary,
      paddingHorizontal: spacing.sm,
    },
    modalTextInput: {
      fontFamily: fontFamily.serif,
      flex: 1,
      backgroundColor: colors.bgCard,
      borderWidth: 1,
      borderColor: colors.borderMedium,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      fontSize: fontSize.md,
      lineHeight: fontSize.md * 1.6,
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
    insightsWho: {
      fontFamily: fontFamily.bodyBold,
      fontSize: 10.5,
      letterSpacing: 2,
      color: colors.sophyLight,
      marginBottom: spacing.xs,
    },
    insightsScrollView: {
      flex: 1,
    },
    insightsContent: {
      fontFamily: fontFamily.serif,
      fontSize: fontSize.md,
      color: colors.fontMain,
      lineHeight: fontSize.md * 1.6,
      paddingBottom: spacing.xl,
    },
    insightsFooter: {
      paddingTop: spacing.base,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
  });

export default PastEntriesScreen;
