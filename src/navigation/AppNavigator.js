import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';

import SplashScreen from '../screens/SplashScreen';
import LoginScreen from '../screens/LoginScreen';
import MainTabNavigator from './MainTabNavigator';
import AccountDetailScreen from '../screens/AccountDetailScreen';
import ExpensesAccountDetailScreen from '../screens/ExpensesAccountDetailScreen';
import AmountEntryScreen from '../screens/AmountEntryScreen';
import AddAccountScreen from '../screens/AddAccountScreen';
import PersonalizeAccountScreen from '../screens/PersonalizeAccountScreen';
import LedgerContactDetailScreen from '../screens/LedgerContactDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';
import BackupScreen from '../screens/BackupScreen';
import CurrencySetupScreen from '../screens/CurrencySetupScreen';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';

const Stack = createStackNavigator();

const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerShown: false,
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
          gestureDirection: 'horizontal',
          gestureResponseDistance: 20,
        }}>
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Home" component={MainTabNavigator} />
        <Stack.Screen name="AccountDetail" component={AccountDetailScreen} />
        <Stack.Screen name="ExpensesAccountDetail" component={ExpensesAccountDetailScreen} />
        <Stack.Screen name="AmountEntry" component={AmountEntryScreen} />
        <Stack.Screen name="AddAccount" component={AddAccountScreen} />
        <Stack.Screen name="PersonalizeAccount" component={PersonalizeAccountScreen} />
        <Stack.Screen name="LedgerContactDetail" component={LedgerContactDetailScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Backup" component={BackupScreen} />
        <Stack.Screen name="CurrencySetup" component={CurrencySetupScreen} />
        <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
        <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;