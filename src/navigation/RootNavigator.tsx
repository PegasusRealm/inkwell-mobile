import React from 'react';
import {createStackNavigator, CardStyleInterpolators} from '@react-navigation/stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {useTheme} from '../theme/ThemeContext';
import {fontFamily} from '../theme';
import {PenIcon, BookIcon, FlagIcon, PersonIcon} from '../components/kit/icons';
import {isIPad} from '../utils/iPad';

import TodayScreen from '../screens/TodayScreen';
import WriteScreen from '../screens/WriteScreen';
import KeptScreen from '../screens/KeptScreen';
import EntriesScreen from '../screens/PastEntriesScreen';
import GoalsScreen from '../screens/ManifestScreen';
import YouScreen from '../screens/SettingsScreen';
import InfoScreen from '../screens/InfoScreen';

import type {RootStackParamList, MainTabParamList} from './types';

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// v2.0 (2026-10-01): four tabs, one job per screen. Every tab draws its own slim
// identity bar, so the navigator header stays off everywhere.
function MainTabs() {
  const {colors} = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.fontMuted,
        tabBarLabelStyle: {fontFamily: fontFamily.bodyBold, fontSize: 13},
        tabBarStyle: {
          height: isIPad() ? 72 : 62,
          paddingTop: 6,
          paddingBottom: isIPad() ? 12 : 8,
          backgroundColor: colors.bgPrimary,
          borderTopColor: colors.borderLight,
        },
      }}>
      <Tab.Screen
        name="Today"
        component={TodayScreen}
        options={{title: 'Today', tabBarIcon: ({color}) => <PenIcon color={color} strokeWidth={1.9} />}}
      />
      <Tab.Screen
        name="Entries"
        component={EntriesScreen}
        options={{title: 'Entries', tabBarIcon: ({color}) => <BookIcon color={color} />}}
      />
      <Tab.Screen
        name="Goals"
        component={GoalsScreen}
        options={{title: 'Goals', tabBarIcon: ({color}) => <FlagIcon color={color} />}}
      />
      <Tab.Screen
        name="You"
        component={YouScreen}
        options={{title: 'You', tabBarIcon: ({color}) => <PersonIcon color={color} />}}
      />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const {colors} = useTheme();

  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      {/* Write takes the whole screen. No tabs, no swipe-to-dismiss mid-sentence. */}
      <Stack.Screen
        name="Write"
        component={WriteScreen}
        options={{
          gestureEnabled: false,
          cardStyleInterpolator: CardStyleInterpolators.forVerticalIOS,
        }}
      />
      {/* Kept pops up over Today after a save. */}
      <Stack.Screen
        name="Kept"
        component={KeptScreen}
        options={{
          presentation: 'transparentModal',
          gestureEnabled: false,
          cardStyleInterpolator: CardStyleInterpolators.forFadeFromBottomAndroid,
        }}
      />
      <Stack.Screen
        name="Info"
        component={InfoScreen}
        options={{
          headerShown: true,
          presentation: 'modal',
          title: 'Help and About',
          headerStyle: {backgroundColor: colors.bgPrimary},
          headerTintColor: colors.fontMain,
          headerTitleStyle: {fontFamily: fontFamily.bodyBold},
        }}
      />
    </Stack.Navigator>
  );
}
