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
import {processPendingLedgerEvents} from './src/services/ledgerSyncService';
// import { initializeChatFeature } from './src/services/chatInitializer';

const keyboardModule = (() => {
  try {
    return require('react-native-keyboard-controller/lib/commonjs/animated');
  } catch {
    return null;
  }
})();

const KeyboardProvider: React.ComponentType<React.PropsWithChildren<object>> =
  keyboardModule?.KeyboardProvider ?? (({ children }) => <>{children}</>);

enableScreens(true);

function App() {
  useEffect(() => {
    GoogleSignin.configure({
      webClientId: '787026486912-0od795pc1mv0tffcu13usmq73i0vvvkv.apps.googleusercontent.com',
    });

    // Initialize chat feature
    // initializeChatFeature();

    processPendingLedgerEvents().catch(error => {
      console.error('Failed to process pending ledger events:', error);
    });
  }, []);

  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        {/* <ChatStoreProvider> */}
        <ToastProvider>
          <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
          <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }} edges={['top', 'bottom']}>
            <AppNavigator />
            <ToastContainer />
          </SafeAreaView>
        </ToastProvider>
        {/* </ChatStoreProvider> */}
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}

export default App;
