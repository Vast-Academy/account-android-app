import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import SplashScreen from '../screens/SplashScreen';
import LoginScreen from '../screens/LoginScreen';
import SetupScreen from '../screens/SetupScreen';
import MainTabNavigator from './MainTabNavigator';
import AccountDetailScreen from '../screens/AccountDetailScreen';
import LiabilityAccountDetailScreen from '../screens/LiabilityAccountDetailScreen';
import LedgerContactDetailScreen from '../screens/LedgerContactDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Stack = createStackNavigator();

const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerShown: false,
        }}>
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Setup" component={SetupScreen} />
        <Stack.Screen name="Home" component={MainTabNavigator} />
        <Stack.Screen name="AccountDetail" component={AccountDetailScreen} />
        <Stack.Screen name="LiabilityAccountDetail" component={LiabilityAccountDetailScreen} />
        <Stack.Screen name="LedgerContactDetail" component={LedgerContactDetailScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
