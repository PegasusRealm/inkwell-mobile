import React from 'react';
import {createStackNavigator} from '@react-navigation/stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {Text} from 'react-native';
import {useTheme} from '../theme/ThemeContext';

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

// Tab bar icon component (simple text for now, can upgrade to icons later)
const TabIcon = ({label, focused}: {label: string; focused: boolean}) => (
  <Text style={{fontSize: 24, opacity: focused ? 1 : 0.5}}>{label}</Text>
);

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
          height: 60,
          paddingBottom: 8,
          backgroundColor: colors.bgCard,
          borderTopColor: colors.borderLight,
        },
      }}>
      <Tab.Screen
        name="Journal"
        component={JournalScreen}
        options={{
          title: 'Journal',
          tabBarIcon: ({focused}) => <TabIcon label="📝" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Manifest"
        component={ManifestScreen}
        options={{
          title: 'Manifest',
          tabBarIcon: ({focused}) => <TabIcon label="✨" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="PastEntries"
        component={PastEntriesScreen}
        options={{
          title: 'Past Entries',
          tabBarIcon: ({focused}) => <TabIcon label="📅" focused={focused} />,
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
