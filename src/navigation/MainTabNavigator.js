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
import {ensureDriveScopes} from '../services/driveService';
import {performBackup} from '../services/backupService';

const Tab = createBottomTabNavigator();

const MainTabNavigator = ({route}) => {
  const {user: initialUser, showTutorial} = route.params || {};
  const [user, setUser] = useState(initialUser || null);
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

  const handleBackupPress = () => {
    const runBackup = async () => {
      try {
        await ensureDriveScopes();
        const firebaseUid = await AsyncStorage.getItem('firebaseUid');
        const email = await AsyncStorage.getItem('backup.accountEmail');
        await performBackup({firebaseUid, accountEmail: email});
        Alert.alert('Backup Complete', 'Your data has been backed up.');
      } catch (error) {
        console.error('Manual backup failed:', error);
        Alert.alert('Backup Failed', 'Unable to backup right now.');
      }
    };
    runBackup();
  };

  const handleProfileUpdate = async updates => {
    try {
      const updatedUser = {
        ...(user || {}),
        ...updates,
      };
      setUser(updatedUser);

      const currentUser = auth().currentUser;
      if (currentUser) {
        await currentUser.updateProfile({
          displayName: updatedUser.displayName || '',
          photoURL: updatedUser.photoURL || '',
        });
      }

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
          onBackupPress={handleBackupPress}
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
          initialParams={{user, showTutorial}}
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
          initialParams={{user}}
          options={{
            tabBarIcon: ({color, size}) => (
              <Icon name="grid" size={size} color={color} />
            ),
          }}
          listeners={{
            focus: () => setShowHeader(false),
            blur: () => setShowHeader(true),
          }}>
          {props => (
            <MoreScreen
              {...props}
              user={user}
              onProfileUpdate={handleProfileUpdate}
            />
          )}
        </Tab.Screen>
      </Tab.Navigator>
    </>
  );
};

export default MainTabNavigator;
