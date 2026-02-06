/**
 * Weekly Activity Dots
 * Shows a gentle visual of journaling activity for the current week
 * No numbers, no streaks - just visual dots to show engagement
 * 
 * Created 2026-01-29: Matches web weekly activity dots
 */

import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
  
  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>This week:</Text>
        {DAY_LABELS.map((_, index) => (
          <View key={index} style={styles.dotWrapper}>
            <Text style={styles.dayLabel}>{DAY_LABELS[index]}</Text>
            <View style={[styles.dot, styles.dotEmpty]} />
          </View>
        ))}
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <Text style={styles.label}>This week:</Text>
      {DAY_LABELS.map((label, index) => {
        const hasFilled = daysWithEntries.has(index);
        const isToday = index === today;
        
        return (
          <View 
            key={index} 
            style={styles.dotWrapper}
            accessibilityLabel={`${DAY_NAMES[index]}: ${hasFilled ? 'Entry recorded' : 'No entry'}`}
          >
            <Text style={styles.dayLabel}>{label}</Text>
            <View style={[
              styles.dot,
              hasFilled ? styles.dotFilled : styles.dotEmpty,
              isToday && styles.dotToday,
            ]} />
          </View>
        );
      })}
    </View>
  );
};

const createStyles = (colors: ThemeColors, isDark: boolean) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 12,
    gap: 12,
  },
  label: {
    fontSize: 11,
    color: colors.fontSecondary,
    marginRight: 4,
  },
  dotWrapper: {
    alignItems: 'center',
    gap: 2,
  },
  dayLabel: {
    fontSize: 9,
    fontWeight: '500',
    color: colors.fontSecondary,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotEmpty: {
    backgroundColor: isDark ? 'rgba(42, 105, 114, 0.2)' : colors.bgMuted,
    borderWidth: 1.5,
    borderColor: isDark ? 'rgba(42, 105, 114, 0.4)' : colors.borderLight,
  },
  dotFilled: {
    backgroundColor: colors.brandPrimary,
    borderWidth: 1.5,
    borderColor: colors.brandPrimary,
  },
  dotToday: {
    // Ring effect for today
    shadowColor: colors.brandPrimary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
    elevation: 3,
  },
});

export default WeeklyActivityDots;
