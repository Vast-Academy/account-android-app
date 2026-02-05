/**
 * Account Android App
 * Main App Entry Point
 */

import React, { useEffect } from 'react';
import { enableScreens } from 'react-native-screens';
import { StatusBar } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import AppNavigator from './src/navigation/AppNavigator';
// import { ChatStoreProvider } from './src/context/ChatStore';
import { ToastProvider } from './src/context/ToastContext';
import ToastContainer from './src/components/ToastContainer';
import './src/services/NotificationService';
// import { initializeChatFeature } from './src/services/chatInitializer';

enableScreens(true);

function App() {
  useEffect(() => {
    GoogleSignin.configure({
      webClientId: '787026486912-0od795pc1mv0tffcu13usmq73i0vvvkv.apps.googleusercontent.com',
    });

    // Initialize chat feature
    // initializeChatFeature();
  }, []);

  return (
    <SafeAreaProvider>
      {/* <ChatStoreProvider> */}
      <ToastProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }} edges={['top', 'bottom']}>
        <AppNavigator />
        <ToastContainer />
      </SafeAreaView>
      </ToastProvider>
      {/* </ChatStoreProvider> */}
    </SafeAreaProvider>
  );
}

export default App;
