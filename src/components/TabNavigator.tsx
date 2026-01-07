import React, {useState} from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import JournalScreen from '../screens/JournalScreen';
import ManifestScreen from '../screens/ManifestScreen';
import PastEntriesScreen from '../screens/PastEntriesScreen';
import {colors, spacing, fontFamily, fontSize} from '../theme';

type TabType = 'journal' | 'manifest' | 'past';

interface TabNavigatorProps {
  onLogout: () => void;
}

const TabNavigator: React.FC<TabNavigatorProps> = ({onLogout}) => {
  const [activeTab, setActiveTab] = useState<TabType>('journal');

  const renderScreen = () => {
    switch (activeTab) {
      case 'journal':
        return <JournalScreen />;
      case 'manifest':
        return <ManifestScreen />;
      case 'past':
        return <PastEntriesScreen />;
      default:
        return <JournalScreen />;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header with Logout */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>InkWell</Text>
        <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Screen Content */}
      <View style={styles.screenContainer}>{renderScreen()}</View>

      {/* Bottom Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => setActiveTab('journal')}>
          <Text style={styles.tabIcon}>📖</Text>
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'journal' && styles.tabLabelActive,
            ]}>
            Journal
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tab}
          onPress={() => setActiveTab('manifest')}>
          <Text style={styles.tabIcon}>✨</Text>
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'manifest' && styles.tabLabelActive,
            ]}>
            Manifest
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tab}
          onPress={() => setActiveTab('past')}>
          <Text style={styles.tabIcon}>📚</Text>
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'past' && styles.tabLabelActive,
            ]}>
            Past Entries
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundMain,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.brandPrimary,
    borderBottomWidth: 1,
    borderBottomColor: '#1F5159',
  },
  headerTitle: {
    fontSize: fontSize.xxl,
    fontFamily: fontFamily.header,
    color: colors.backgroundMain,
  },
  logoutButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: 'rgba(240, 253, 250, 0.2)',
    borderRadius: 8,
  },
  logoutText: {
    color: colors.backgroundMain,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.buttonBold,
  },
  screenContainer: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingBottom: 20,
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  tabIcon: {
    fontSize: fontSize.xxl,
    marginBottom: 4,
  },
  tabLabel: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.body,
    color: colors.fontMuted,
  },
  tabLabelActive: {
    color: colors.brandPrimary,
    fontFamily: fontFamily.bodyBold,
  },
});

export default TabNavigator;
