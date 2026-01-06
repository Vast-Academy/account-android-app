import React, {useState, useEffect} from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Alert} from 'react-native';

import DashboardScreen from '../screens/DashboardScreen';
import LedgerScreen from '../screens/LedgerScreen';
import MoreScreen from '../screens/MoreScreen';
import Header from '../components/Header';
import {colors, fontSize} from '../utils/theme';
import {auth} from '../config/firebase';
import {saveUserData} from '../services/database';

const Tab = createBottomTabNavigator();

const MainTabNavigator = ({route}) => {
  const [user, setUser] = useState(route.params?.user || null);
  const [showHeader, setShowHeader] = useState(true);

  useEffect(() => {
    if (!user) {
      loadUserData();
    }
  }, [user]);

  const loadUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const handleNotificationPress = () => {
    Alert.alert('Notifications', 'No new notifications');
  };

  const handleProfileUpdate = async updates => {
    try {
      const updatedUser = {
        ...(user || {}),
        displayName: updates.displayName,
        photoURL: updates.photoURL,
      };

      const currentUser = auth().currentUser;
      if (currentUser) {
        await currentUser.updateProfile({
          displayName: updatedUser.displayName || '',
          photoURL: updatedUser.photoURL || '',
        });
      }

      setUser(updatedUser);
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      saveUserData(updatedUser);
      return {success: true};
    } catch (error) {
      console.error('Failed to update profile:', error);
      return {success: false, message: 'Failed to update profile'};
    }
  };

  return (
    <>
      {showHeader && (
        <Header
          user={user}
          onNotificationPress={handleNotificationPress}
          onProfileUpdate={handleProfileUpdate}
        />
      )}
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.tabBarActive,
          tabBarInactiveTintColor: colors.tabBarInactive,
          tabBarStyle: {
            backgroundColor: colors.tabBarBg,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            height: 60,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontSize: fontSize.small,
            fontWeight: '500',
          },
        }}>
        <Tab.Screen
          name="Dashboard"
          component={DashboardScreen}
          initialParams={{user}}
          options={{
            tabBarIcon: ({color, size}) => (
              <Icon name="home" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Ledger"
          component={LedgerScreen}
          options={{
            tabBarIcon: ({color, size}) => (
              <Icon name="book" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="More"
          component={MoreScreen}
          initialParams={{user}}
          options={{
            tabBarIcon: ({color, size}) => (
              <Icon name="grid" size={size} color={color} />
            ),
          }}
          listeners={{
            focus: () => setShowHeader(false),
            blur: () => setShowHeader(true),
          }}
        />
      </Tab.Navigator>
    </>
  );
};

export default MainTabNavigator;
