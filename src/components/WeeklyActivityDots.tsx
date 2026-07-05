/**
 * Weekly Activity Dots
 * Shows a gentle visual of journaling activity for the current week
 * No numbers, no streaks - just visual dots to show engagement
 * 
 * Created 2026-01-29: Matches web weekly activity dots
 */

import React, { useEffect, useState, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { useTheme, ThemeColors } from '../theme/ThemeContext';

interface WeeklyActivityDotsProps {
  refreshTrigger?: number; // Increment to force refresh after saving entry
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const WeeklyActivityDots: React.FC<WeeklyActivityDotsProps> = ({ refreshTrigger }) => {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  
  const [daysWithEntries, setDaysWithEntries] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  
  const today = new Date().getDay(); // 0 = Sunday
  
  useEffect(() => {
    const fetchWeeklyEntries = async () => {
      const user = auth().currentUser;
      if (!user) {
        setLoading(false);
        return;
      }
      
      try {
        // Get start of current week (Sunday)
        const now = new Date();
        const dayOfWeek = now.getDay();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - dayOfWeek);
        startOfWeek.setHours(0, 0, 0, 0);
        
        // Convert to Firestore Timestamp for proper comparison
        // (entries use serverTimestamp() which creates Timestamp, not ISO string)
        const startOfWeekTimestamp = firestore.Timestamp.fromDate(startOfWeek);
        
        // Query entries from this week
        const snapshot = await firestore()
          .collection('journalEntries')
          .where('userId', '==', user.uid)
          .where('createdAt', '>=', startOfWeekTimestamp)
          .orderBy('createdAt', 'desc')
          .get();
        
        // Track which days have entries
        const days = new Set<number>();
        snapshot.forEach(doc => {
          const data = doc.data();
          // Handle both Timestamp objects and ISO strings for backwards compatibility
          let entryDate: Date;
          if (data.createdAt?.toDate) {
            entryDate = data.createdAt.toDate();
          } else if (typeof data.createdAt === 'string') {
            entryDate = new Date(data.createdAt);
          } else {
            entryDate = new Date();
          }
          const entryDay = entryDate.getDay();
          days.add(entryDay);
        });
        
        setDaysWithEntries(days);
        console.log('📅 Weekly activity dots updated:', days.size, 'days with entries');
      } catch (error) {
        console.warn('Could not load weekly activity:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchWeeklyEntries();
  }, [refreshTrigger]); // Re-fetch when trigger changes
  
  // v2 restyle (2026-07-04): bare mockup dots — done / today / empty.
  // No label, no day letters; accessibility labels carry the day names.
  if (loading) {
    return (
      <View style={styles.container}>
        {DAY_LABELS.map((_, index) => (
          <View key={index} style={[styles.dot, styles.dotEmpty]} />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {DAY_LABELS.map((_, index) => {
        const hasFilled = daysWithEntries.has(index);
        const isToday = index === today;

        return (
          <View
            key={index}
            accessibilityLabel={`${DAY_NAMES[index]}: ${hasFilled ? 'Entry recorded' : 'No entry'}`}
            style={[
              styles.dot,
              hasFilled ? styles.dotFilled : styles.dotEmpty,
              isToday && styles.dotToday,
            ]}
          />
        );
      })}
    </View>
  );
};

const createStyles = (colors: ThemeColors, isDark: boolean) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotEmpty: {
    backgroundColor: colors.borderLight,
  },
  dotFilled: {
    backgroundColor: colors.brandPrimary,
  },
  dotToday: {
    backgroundColor: colors.brandPrimary,
    shadowColor: colors.brandPrimary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: isDark ? 0.9 : 0.5,
    shadowRadius: 4,
    elevation: 3,
  },
});

export default WeeklyActivityDots;
