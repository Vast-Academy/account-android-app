import React, { useEffect, useCallback } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { checkAuthStatus } from '../utils/tokenManager';

const SplashScreen = ({ navigation }) => {
  const checkAuthentication = useCallback(async () => {
    try {
      // Show splash for minimum 1.5 seconds
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Check if user is authenticated
      const authStatus = await checkAuthStatus();

      if (authStatus.isAuthenticated) {
        // User is logged in, go to Home
        navigation.replace('Home', { user: authStatus.user });
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
      <Text style={styles.title}>Account App</Text>
      <Text style={styles.subtitle}>Your Personal Finance Manager</Text>
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
