/**
 * Chat Feature Initializer
 * Call this from App.js useEffect to initialize chat functionality
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {initChatDatabase} from './chatDatabase';
import {initMessagingService} from './messagingService';
import {syncUserProfileToCloud, updateFCMToken} from './userProfileService';
import auth from '@react-native-firebase/auth';

/**
 * Initialize chat database
 */
export const initializeChatDatabase = async () => {
  try {
    console.log('🗂️ Initializing chat database...');
    initChatDatabase();
    console.log('✅ Chat database initialized');
  } catch (error) {
    console.error('❌ Error initializing chat database:', error);
    throw error;
  }
};

/**
 * Initialize FCM messaging
 */
export const initializeFCM = async () => {
  try {
    console.log('📲 Initializing Firebase Cloud Messaging...');
    await initMessagingService();
    console.log('✅ FCM initialized');
  } catch (error) {
    console.error('❌ Error initializing FCM:', error);
    // FCM initialization failure should not block app startup
    console.warn('⚠️ FCM initialization failed, app will continue without messaging');
  }
};

/**
 * Sync user profile to cloud (after login)
 */
export const syncProfileAfterLogin = async (user) => {
  try {
    console.log('👤 Syncing user profile to cloud...');

    if (!user) {
      throw new Error('User not provided');
    }

    // Get FCM token
    const fcmToken = await AsyncStorage.getItem('fcmToken') || '';

    // Sync profile
    await syncUserProfileToCloud({
      username: user.username || user.displayName?.replace(/\s+/g, '_').toLowerCase() || '',
      displayName: user.displayName || '',
      phoneNumber: user.phoneNumber || '',
      email: user.email || '',
      photoURL: user.photoURL || '',
      fcmToken,
    });

    console.log('✅ Profile synced to cloud');
  } catch (error) {
    console.error('❌ Error syncing profile:', error);
    // Profile sync failure should not block app startup
    console.warn('⚠️ Profile sync failed, user can still use app');
  }
};

/**
 * Main initialization function to call from App.js
 */
export const initializeChatFeature = async () => {
  try {
    console.log('🚀 Starting chat feature initialization...');

    // 1. Initialize local database
    await initializeChatDatabase();

    // 2. Initialize FCM
    await initializeFCM();

    console.log('🎉 Chat feature initialized successfully!');
    return true;
  } catch (error) {
    console.error('❌ Chat feature initialization failed:', error);
    // Continue app startup even if chat fails
    return false;
  }
};

/**
 * Sync profile on user login
 * Call this after successful user authentication
 */
export const onUserLogin = async (user) => {
  try {
    console.log('📝 User logged in, syncing profile...');

    if (!user) {
      throw new Error('User data not available');
    }

    // Sync user profile to MongoDB
    await syncProfileAfterLogin(user);

    console.log('✅ User profile synced');
  } catch (error) {
    console.error('❌ Error on user login:', error);
    // Don't throw - user can continue using app
  }
};

/**
 * Clean up chat data on logout
 */
export const onUserLogout = async () => {
  try {
    console.log('👋 User logging out, cleaning up...');

    // Optional: Clear FCM token from AsyncStorage
    // await AsyncStorage.removeItem('fcmToken');

    // Optional: Clear chat database (if desired)
    // await clearChatData();

    console.log('✅ Cleanup complete');
  } catch (error) {
    console.error('❌ Error during logout cleanup:', error);
  }
};

/**
 * Example usage in App.js:
 *
 * import { initializeChatFeature, onUserLogin, onUserLogout } from './src/services/chatInitializer';
 *
 * export default function App() {
 *   const [user, setUser] = useState(null);
 *
 *   // Initialize chat on app start
 *   useEffect(() => {
 *     initializeChatFeature();
 *   }, []);
 *
 *   // Sync profile after login
 *   const handleLogin = async (user) => {
 *     setUser(user);
 *     await onUserLogin(user);
 *   };
 *
 *   // Cleanup on logout
 *   const handleLogout = async () => {
 *     await onUserLogout();
 *     setUser(null);
 *   };
 *
 *   // ... rest of app
 * }
 */

export default {
  initializeChatDatabase,
  initializeFCM,
  syncProfileAfterLogin,
  initializeChatFeature,
  onUserLogin,
  onUserLogout,
};
