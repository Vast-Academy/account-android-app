import React, { useEffect, useCallback } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkAuthStatus, getFirebaseToken } from '../utils/tokenManager';
import { getUserDetails } from '../services/api';
import {notificationService} from '../services/NotificationService';
import { initMessagingService } from '../services/messagingService';

const SplashScreen = ({ navigation }) => {
  const checkAuthentication = useCallback(async () => {
    try {
      // Show splash for minimum 1.5 seconds
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Trigger notification permission on app start from Splash
      await notificationService.ensureExpenseRemindersScheduled();

      // Check if user is authenticated
      const authStatus = await checkAuthStatus();

      if (authStatus.isAuthenticated) {
        // Initialize messaging service to ensure FCM token is set up
        console.log('🔔 Initializing messaging service on splash...');
        try {
          await initMessagingService();
          console.log('✅ Messaging service initialized on splash');
        } catch (msgError) {
          console.warn('⚠️ Failed to initialize messaging service on splash:', msgError);
        }

        let userData = authStatus.user || {};

        // Fetch fresh user data from backend to ensure we have latest profile info
        try {
          const token = await getFirebaseToken();
          if (token) {
            const response = await getUserDetails(token);
            if (response?.success && response?.user) {
              userData = {
                ...userData,
                ...response.user,
              };
              // Update local storage with fresh data from backend
              await AsyncStorage.setItem('user', JSON.stringify(userData));
            }
          }
        } catch (fetchError) {
          console.warn('Could not refresh user data from backend:', fetchError);
          // Continue with cached data if backend fetch fails
        }

        // Check cloud setupComplete flag from user profile
        if (userData.setupComplete === true) {
          // Profile setup complete → Go to Home
          navigation.replace('Home', { user: userData });
        } else {
          // Profile setup incomplete → Go to ProfileSetup
          navigation.replace('ProfileSetup', { user: userData });
        }
      } else {
        // User not logged in, go to Login
        navigation.replace('Login');
      }
    } catch (error) {
      console.error('Splash screen error:', error);
      // On error, go to Login screen
      navigation.replace('Login');
    }
  }, [navigation]);

  useEffect(() => {
    checkAuthentication();
  }, [checkAuthentication]);

  return (
    <View style={styles.container}>
      <Image source={require('../../icon.png')} style={styles.logo} />
      <Text style={styles.title}>Savingo</Text>
      <Text style={styles.subtitle}>Your Personal Money Management App</Text>
      <ActivityIndicator
        size="large"
        color="#007AFF"
        style={styles.loader}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 10,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 16,
    resizeMode: 'contain',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 40,
  },
  loader: {
    marginTop: 20,
  },
});

export default SplashScreen;
