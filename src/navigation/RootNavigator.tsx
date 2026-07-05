import React from 'react';
import {createStackNavigator} from '@react-navigation/stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {useTheme} from '../theme/ThemeContext';
import {PenIcon, StarIcon, CalendarIcon} from '../components/kit/icons';
import {isIPad} from '../utils/iPad';

// Import screens
import JournalScreen from '../screens/JournalScreen';
import ManifestScreen from '../screens/ManifestScreen';
import PastEntriesScreen from '../screens/PastEntriesScreen';
import SettingsScreen from '../screens/SettingsScreen';
import InfoScreen from '../screens/InfoScreen';

// Import types
import type {RootStackParamList, MainTabParamList} from './types';

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// v2 tab icons (web SVG paths, 2026-07-04) — replaced the emoji labels.
// The old TabIconWithBadge (unread coach replies + tierConnect badge) died
// here too: Connect retired, the hook was already an inert stub.

// Main bottom tab navigator
function MainTabs() {
  const {colors} = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.brandPrimary,
        },
        headerTintColor: colors.fontWhite,
        headerTitleStyle: {
          fontWeight: '600',
        },
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.fontMuted,
        tabBarStyle: {
          height: isIPad() ? 70 : 60,
          paddingBottom: isIPad() ? 12 : 8,
          backgroundColor: colors.bgCard,
          borderTopColor: colors.borderLight,
        },
      }}>
      <Tab.Screen
        name="Journal"
        component={JournalScreen}
        options={{
          title: 'Journal',
          tabBarIcon: ({color}) => <PenIcon color={color} />,
        }}
      />
      <Tab.Screen
        name="Manifest"
        component={ManifestScreen}
        options={{
          title: 'Goals',
          tabBarIcon: ({color}) => <StarIcon color={color} />,
        }}
      />
      <Tab.Screen
        name="PastEntries"
        component={PastEntriesScreen}
        options={{
          title: 'Entries',
          tabBarIcon: ({color}) => <CalendarIcon color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

// Root stack navigator (includes tabs and modal screens)
export default function RootNavigator() {
  const {colors} = useTheme();
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          headerShown: true,
          presentation: 'modal',
          title: 'Settings',
          headerStyle: {
            backgroundColor: colors.brandPrimary,
          },
          headerTintColor: colors.fontWhite,
        }}
      />
      <Stack.Screen
        name="Info"
        component={InfoScreen}
        options={{
          headerShown: true,
          presentation: 'modal',
          title: 'Help & Info',
          headerStyle: {
            backgroundColor: colors.brandPrimary,
          },
          headerTintColor: colors.fontWhite,
        }}
      />
    </Stack.Navigator>
  );
}
