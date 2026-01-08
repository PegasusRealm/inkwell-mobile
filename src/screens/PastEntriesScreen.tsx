import React, {useState, useEffect, useMemo} from 'react';
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
} from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {spacing, borderRadius, fontFamily, fontSize} from '../theme';
import {useTheme, ThemeColors} from '../theme/ThemeContext';
import PastEntryCard from '../components/PastEntryCard';
import type {TabScreenProps} from '../navigation/types';

const PastEntriesScreen: React.FC<TabScreenProps<'PastEntries'>> = ({navigation}) => {
  // Theme hook for dynamic theming
  const {colors, isDark} = useTheme();
  
  // Create styles with current theme colors
  const styles = useMemo(() => createStyles(colors), [colors]);
  // Add Settings button to header
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('Settings')}
          style={{marginRight: 16}}>
          <Text style={{fontSize: 24}}>⚙️</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const [displayedMonth, setDisplayedMonth] = useState(new Date().getMonth());
  const [displayedYear, setDisplayedYear] = useState(new Date().getFullYear());
  const [searchQuery, setSearchQuery] = useState('');
  const [entryDates, setEntryDates] = useState<Set<string>>(new Set());
  const [replyDates, setReplyDates] = useState<Set<string>>(new Set());
  const [selectedDateEntries, setSelectedDateEntries] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [editText, setEditText] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showingSearchResults, setShowingSearchResults] = useState(false);
  const [loadingEntries, setLoadingEntries] = useState(false);

  const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Load entries and identify dates with journal entries
  useEffect(() => {
    loadEntryDates();
  }, [displayedMonth, displayedYear]);

  const loadEntryDates = async () => {
    try {
      const user = auth().currentUser;
      if (!user) {
        setEntryDates(new Set());
        setReplyDates(new Set());
        return;
      }

      // Calculate start and end of displayed month
      const startOfMonth = new Date(displayedYear, displayedMonth, 1);
      const endOfMonth = new Date(displayedYear, displayedMonth + 1, 0, 23, 59, 59, 999);

      // Query Firestore for entries in this month
      const snapshot = await firestore()
        .collection('journalEntries')
        .where('userId', '==', user.uid)
        .where('createdAt', '>=', startOfMonth)
        .where('createdAt', '<=', endOfMonth)
        .get();

      const datesWithEntries = new Set<string>();
      const datesWithReplies = new Set<string>();

      snapshot.docs.forEach((doc) => {
        const entry = doc.data();
        let entryDate: Date | null = null;
        
        // Handle different date formats
        if (entry.createdAt?.toDate) {
          entryDate = entry.createdAt.toDate();
        } else if (entry.date) {
          entryDate = new Date(entry.date);
        }

        if (entryDate) {
          const dateKey = entryDate.getDate().toString();
          datesWithEntries.add(dateKey);
          
          if (entry.newCoachReply === true) {
            datesWithReplies.add(dateKey);
          }
        }
      });

      setEntryDates(datesWithEntries);
      setReplyDates(datesWithReplies);
    } catch (error) {
      console.error('Error loading entry dates:', error);
      setEntryDates(new Set());
      setReplyDates(new Set());
    }
  };

  // Change month handler
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
  };

  // Generate calendar days
  const generateCalendar = () => {
    const firstDay = new Date(displayedYear, displayedMonth, 1).getDay();
    const daysInMonth = new Date(displayedYear, displayedMonth + 1, 0).getDate();
    const weeks: (number | null)[][] = [];
    let week: (number | null)[] = [];

    // Fill in empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      week.push(null);
    }

    // Fill in the days
    for (let day = 1; day <= daysInMonth; day++) {
      week.push(day);
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }

    // Fill remaining cells
    if (week.length > 0) {
      while (week.length < 7) {
        week.push(null);
      }
      weeks.push(week);
    }

    return weeks;
  };

  const handleDateClick = async (day: number) => {
    console.log('Date clicked:', displayedYear, displayedMonth, day);
    setSelectedDate(`${displayedMonth + 1}/${day}/${displayedYear}`);
    setLoadingEntries(true);
    setShowingSearchResults(false);
    
    try {
      const user = auth().currentUser;
      if (!user) {
        setSelectedDateEntries([]);
        return;
      }

      // Calculate start and end of the selected day
      const startOfDay = new Date(displayedYear, displayedMonth, day, 0, 0, 0, 0);
      const endOfDay = new Date(displayedYear, displayedMonth, day, 23, 59, 59, 999);

      console.log('Querying for entries between:', startOfDay, 'and', endOfDay);

      // Query Firestore for entries on this specific day
      const snapshot = await firestore()
        .collection('journalEntries')
        .where('userId', '==', user.uid)
        .where('createdAt', '>=', startOfDay)
        .where('createdAt', '<=', endOfDay)
        .orderBy('createdAt', 'desc')
        .get();

      const matchingEntries = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().date,
      }));

      console.log('Found entries:', matchingEntries.length);
      setSelectedDateEntries(matchingEntries);
    } catch (error) {
      console.error('Error loading entries for date:', error);
      setSelectedDateEntries([]);
    } finally {
      setLoadingEntries(false);
    }
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
      // Update in Firestore
      await firestore()
        .collection('journalEntries')
        .doc(editingEntry.id)
        .update({
          text: editText.trim(),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
      
      // Update local state
      setSelectedDateEntries(prev =>
        prev.map(entry =>
          entry.id === editingEntry.id ? {...entry, text: editText.trim()} : entry
        )
      );

      setEditModalVisible(false);
      setEditingEntry(null);
      setEditText('');
      Alert.alert('Success', 'Entry updated successfully!');
    } catch (error) {
      console.error('Error saving edit:', error);
      Alert.alert('Error', 'Failed to update entry. Please try again.');
    }
  };

  const handleDelete = async (entryId: string) => {
    try {
      // Delete from Firestore
      await firestore()
        .collection('journalEntries')
        .doc(entryId)
        .delete();
      
      // Update local state
      setSelectedDateEntries(prev => prev.filter(entry => entry.id !== entryId));
      
      // Reload calendar highlights
      loadEntryDates();
      
      Alert.alert('Success', 'Entry deleted successfully!');
    } catch (error) {
      console.error('Error deleting entry:', error);
      Alert.alert('Error', 'Failed to delete entry. Please try again.');
    }
  };

  const handleMarkAsRead = async (entryId: string) => {
    try {
      // Update in Firestore
      await firestore()
        .collection('journalEntries')
        .doc(entryId)
        .update({
          newCoachReply: false,
        });
      
      // Update local state
      setSelectedDateEntries(prev =>
        prev.map(entry =>
          entry.id === entryId ? {...entry, newCoachReply: false} : entry
        )
      );
      
      // Reload calendar highlights
      loadEntryDates();
      
      Alert.alert('Success', 'Marked as read!');
    } catch (error) {
      console.error('Error marking as read:', error);
      Alert.alert('Error', 'Failed to mark as read. Please try again.');
    }
  };

  const handleSmartSearch = async () => {
    if (!searchQuery.trim()) {
      Alert.alert('Empty Search', 'Please enter a search query');
      return;
    }

    setSearching(true);
    setShowingSearchResults(true);
    setSelectedDate(null);

    try {
      const user = auth().currentUser;
      if (!user) {
        Alert.alert('Error', 'You must be logged in to use Smart Search');
        return;
      }

      const idToken = await user.getIdToken();

      // Call Firebase Cloud Function for semantic search
      const response = await fetch(
        'https://us-central1-inkwell-alpha.cloudfunctions.net/semanticSearch',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({query: searchQuery}),
        },
      );

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = await response.json();
      const results = data.results || [];

      console.log(`Smart Search found ${results.length} results`);

      if (results.length === 0) {
        Alert.alert(
          'No Results',
          'No relevant entries found. Try different keywords or write more journal entries!',
        );
        setSearchResults([]);
        return;
      }

      // Load full entry data from Firestore using the IDs returned by semantic search
      const entryIds = results.map((r: any) => r.id);
      const fullResults: any[] = [];
      
      // Firestore 'in' queries support up to 10 items at a time
      for (let i = 0; i < entryIds.length; i += 10) {
        const batch = entryIds.slice(i, i + 10);
        const snapshot = await firestore()
          .collection('journalEntries')
          .where(firestore.FieldPath.documentId(), 'in', batch)
          .get();
        
        snapshot.docs.forEach(doc => {
          fullResults.push({
            id: doc.id,
            ...doc.data(),
            date: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().date,
          });
        });
      }

      setSearchResults(fullResults);
      setSelectedDateEntries(fullResults);
    } catch (error) {
      console.error('Smart Search error:', error);
      Alert.alert(
        'Search Error',
        'Failed to search your journal. Please try again.',
      );
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowingSearchResults(false);
    setSelectedDateEntries([]);
  };

  const monthName = new Date(displayedYear, displayedMonth, 1).toLocaleString(
    'default',
    {month: 'long'},
  );

  const weeks = generateCalendar();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Calendar Navigation */}
      <View style={styles.calendarControls}>
        <TouchableOpacity
          style={[styles.navButton, {marginRight: spacing.sm}]}
          onPress={() => changeMonth(-1)}>
          <Text style={styles.navButtonText}>← Previous</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navButton, {marginLeft: spacing.sm}]}
          onPress={() => changeMonth(1)}>
          <Text style={styles.navButtonText}>Next →</Text>
        </TouchableOpacity>
      </View>

      {/* Calendar Container */}
      <View style={styles.calendarContainer}>
        <Text style={styles.monthHeading}>
          {monthName} {displayedYear}
        </Text>

        {/* Calendar Table */}
        <View style={styles.calendar}>
          {/* Header Row */}
          <View style={styles.calendarRow}>
            {DAYS_OF_WEEK.map(day => (
              <View key={day} style={styles.calendarHeaderCell}>
                <Text style={styles.calendarHeaderText}>{day}</Text>
              </View>
            ))}
          </View>

          {/* Date Rows */}
          {weeks.map((week, weekIndex) => (
            <View key={weekIndex} style={styles.calendarRow}>
              {week.map((day, dayIndex) => {
                const hasEntry = day ? entryDates.has(day.toString()) : false;
                const hasReply = day ? replyDates.has(day.toString()) : false;
                const isToday =
                  day === new Date().getDate() &&
                  displayedMonth === new Date().getMonth() &&
                  displayedYear === new Date().getFullYear();

                return (
                  <TouchableOpacity
                    key={dayIndex}
                    style={[
                      styles.calendarCell,
                      day === null && styles.emptyCell,
                      hasEntry && !hasReply && !isToday && styles.hasEntryCell,
                      hasReply && !isToday && styles.hasReplyCell,
                      isToday && styles.todayCell,
                    ]}
                    onPress={() => day && handleDateClick(day)}
                    disabled={day === null}>
                    {day && (
                      <Text
                        style={[
                          styles.calendarDayText,
                          hasEntry && !hasReply && !isToday && styles.hasEntryText,
                          hasReply && !isToday && styles.hasReplyText,
                          isToday && styles.todayText,
                        ]}>
                        {day}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Search Section */}
      <View style={styles.searchSection}>
        <Text style={styles.sectionHeader}>Smart Search Your Journal</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="e.g., burnout last week, goals, feeling stuck"
          placeholderTextColor={colors.fontMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSmartSearch}
          returnKeyType="search"
          editable={!searching}
        />
        <View style={{flexDirection: 'row', gap: spacing.md}}>
          <TouchableOpacity
            style={[
              styles.searchButton,
              (!searchQuery.trim() || searching) && styles.searchButtonDisabled,
            ]}
            onPress={handleSmartSearch}
            disabled={!searchQuery.trim() || searching}>
            <Text style={styles.searchButtonText}>
              {searching ? '🔍 Searching...' : 'Search'}
            </Text>
          </TouchableOpacity>
          {showingSearchResults && (
            <TouchableOpacity style={styles.clearButton} onPress={clearSearch}>
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Entries Container */}
      <View style={styles.entriesContainer}>
        {showingSearchResults ? (
          <Text style={styles.selectedDateHeader}>
            🔍 Found {selectedDateEntries.length} relevant entries
          </Text>
        ) : selectedDate ? (
          <Text style={styles.selectedDateHeader}>
            📅 Entries for {selectedDate}
          </Text>
        ) : null}
        {selectedDate && !loadingEntries && (
          <Text style={{fontSize: 12, color: '#666', marginBottom: 8, textAlign: 'center'}}>
            {selectedDateEntries.length} entry(ies) loaded
          </Text>
        )}
        {loadingEntries ? (
          <View style={styles.placeholderContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.placeholderText, {marginTop: spacing.md}]}>
              Loading entries...
            </Text>
          </View>
        ) : selectedDateEntries.length === 0 ? (
          <View style={styles.placeholderContainer}>
            <Text style={styles.placeholderText}>
              {selectedDate
                ? 'No entries found for this date.'
                : 'Select a date from the calendar above or use Smart Search to explore your journal entries.'}
            </Text>
          </View>
        ) : (
          selectedDateEntries.map(entry => {
            console.log('Rendering entry card for:', entry.id);
            return (
              <PastEntryCard
                key={entry.id}
                entry={{
                  ...entry,
                  date: new Date(entry.date),
                }}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onMarkAsRead={handleMarkAsRead}
              />
            );
          })
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
              <Text style={styles.modalCloseButton}>✕</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.modalTextInput}
            value={editText}
            onChangeText={setEditText}
            multiline
            placeholder="Edit your journal entry..."
            placeholderTextColor={colors.fontSecondary}
            autoFocus
          />
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalCancelButton]}
              onPress={() => setEditModalVisible(false)}>
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalSaveButton]}
              onPress={handleSaveEdit}>
              <Text style={styles.modalButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

// Dynamic styles based on theme colors
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  content: {
    padding: spacing.lg,
  },
  heading: {
    fontFamily: fontFamily.header,
    fontSize: fontSize.xxl,
    color: colors.brandPrimary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  calendarControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  navButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    backgroundColor: colors.bgCard,
    minWidth: 110,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonText: {
    fontFamily: fontFamily.button,
    color: colors.fontSecondary,
    fontSize: fontSize.sm,
  },
  calendarContainer: {
    marginBottom: spacing.lg,
  },
  monthHeading: {
    fontFamily: fontFamily.header,
    fontSize: fontSize.lg,
    color: colors.fontMain,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  calendar: {
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  calendarRow: {
    flexDirection: 'row',
  },
  calendarHeaderCell: {
    flex: 1,
    padding: spacing.sm,
    backgroundColor: colors.brandPrimary,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarHeaderText: {
    fontFamily: fontFamily.buttonBold,
    color: colors.fontWhite,
    fontSize: fontSize.sm,
  },
  calendarCell: {
    flex: 1,
    aspectRatio: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
  },
  emptyCell: {
    backgroundColor: colors.bgMuted,
  },
  hasEntryCell: {
    backgroundColor: colors.brandPrimaryRgba,
  },
  hasReplyCell: {
    backgroundColor: colors.accentGrowth,
  },
  todayCell: {
    backgroundColor: colors.tierPlus,
  },
  calendarDayText: {
    fontFamily: fontFamily.button,
    fontSize: fontSize.md,
    color: colors.fontMain,
  },
  hasEntryText: {
    fontFamily: fontFamily.buttonBold,
    color: colors.brandSecondary,
  },
  hasReplyText: {
    fontFamily: fontFamily.buttonBold,
    color: colors.fontWhite,
  },
  todayText: {
    fontFamily: fontFamily.buttonBold,
    color: colors.fontWhite,
  },
  divider: {
    height: 2,
    backgroundColor: colors.borderMedium,
    marginVertical: spacing.xl,
  },
  searchSection: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    fontFamily: fontFamily.header,
    fontSize: fontSize.lg,
    color: colors.fontMain,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  searchInput: {
    fontFamily: fontFamily.body,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.fontMain,
    marginBottom: spacing.md,
  },
  searchButton: {
    flex: 1,
    backgroundColor: colors.brandPrimary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  searchButtonDisabled: {
    backgroundColor: colors.borderMedium,
    opacity: 0.6,
  },
  searchButtonText: {
    fontFamily: fontFamily.buttonBold,
    color: colors.fontWhite,
    fontSize: fontSize.md,
    letterSpacing: 0.5,
  },
  clearButton: {
    backgroundColor: colors.sophyAccent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  clearButtonText: {
    fontFamily: fontFamily.buttonBold,
    color: colors.fontWhite,
    fontSize: fontSize.md,
    letterSpacing: 0.5,
  },
  entriesContainer: {
    marginTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  selectedDateHeader: {
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
    borderWidth: 2,
    borderColor: colors.borderLight,
    borderStyle: 'dashed',
  },
  placeholderText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.fontMuted,
    textAlign: 'center',
  },
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
    color: colors.brandPrimary,
  },
  modalCloseButton: {
    fontSize: fontSize.xxxl,
    color: colors.fontSecondary,
  },
  modalTextInput: {
    fontFamily: fontFamily.body,
    flex: 1,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.fontMain,
    textAlignVertical: 'top',
    marginBottom: spacing.lg,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: colors.fontSecondary,
  },
  modalSaveButton: {
    backgroundColor: colors.brandSecondary,
  },
  modalButtonText: {
    fontFamily: fontFamily.buttonBold,
    color: colors.fontWhite,
    fontSize: fontSize.md,
    letterSpacing: 0.5,
  },
});

export default PastEntriesScreen;
