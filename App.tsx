/**
 * Account Android App
 * Main App Entry Point
 */

import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import AppNavigator from './src/navigation/AppNavigator';
import { ToastProvider } from './src/context/ToastContext';
import ToastContainer from './src/components/ToastContainer';
import './src/services/NotificationService';

function App() {
  useEffect(() => {
    GoogleSignin.configure({
      webClientId: '787026486912-0od795pc1mv0tffcu13usmq73i0vvvkv.apps.googleusercontent.com',
    });
  }, []);

  return (
    <SafeAreaProvider>
      <ToastProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }} edges={['top', 'bottom']}>
        <AppNavigator />
        <ToastContainer />
      </SafeAreaView>
      </ToastProvider>
    </SafeAreaProvider>
  );
}

export default App;
