import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { auth } from '../config/firebase';
import { googleSignIn, getUserDetails } from '../services/api';
import { saveUserData, initDatabase } from '../services/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveFirebaseToken } from '../utils/tokenManager';
import {ensureDriveScopes} from '../services/driveService';
import {findLatestBackupFile, restoreFromBackup} from '../services/backupService';
import { initMessagingService } from '../services/messagingService';
import RNRestart from 'react-native-restart';

const LoginScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
  const normalizeUser = rawUser => {
    const normalized = {...rawUser};
    const currencySymbol =
      normalized.currencySymbol ||
      normalized.currency ||
      normalized.currency_symbol ||
      '';
    if (!normalized.displayName && normalized.name) {
      normalized.displayName = normalized.name;
    }
    if (!normalized.phoneNumber && normalized.mobile) {
      normalized.phoneNumber = normalized.mobile;
    }
    if (!normalized.currencySymbol && currencySymbol) {
      normalized.currencySymbol = currencySymbol;
    }
    return normalized;
  };

  // Initialize database on mount
  React.useEffect(() => {
    initDatabase();
  }, []);

  // Google Sign-In
  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      console.log('=== STEP 1: Starting Google Sign-In ===');

      // Check if device supports Google Play
      try {
        await GoogleSignin.hasPlayServices();
        console.log('=== STEP 2: Play Services Available ===');
      } catch (playServicesError) {
        console.error('❌ STEP 2 FAILED: Google Play Services not available');
        console.error('Error:', playServicesError.message || JSON.stringify(playServicesError));
        throw playServicesError;
      }

      // Ensure chooser shows by clearing any cached Google session
      try {
        await GoogleSignin.signOut();
        console.log('Previous session cleared');
      } catch (signOutError) {
        console.log('⚠️ Sign-out warning (ignored):', signOutError.message);
        // Ignore sign-out errors and continue with sign-in
      }

      // Sign in with Google
      console.log('🔵 Attempting Google Sign-In...');
      let userInfo;
      try {
        userInfo = await GoogleSignin.signIn();
        console.log('=== STEP 3: Google Sign-In Response ===');
        console.log('Full userInfo object:', JSON.stringify(userInfo, null, 2));
      } catch (signInError) {
        console.error('❌ STEP 3 FAILED: Google Sign-In failed');
        console.error('Error message:', signInError.message);
        console.error('Error code:', signInError.code);
        console.error('Full error:', JSON.stringify(signInError));
        throw signInError;
      }

      // Extract data from new response structure
      const { idToken: googleIdToken } = userInfo.data || userInfo;
      const googleUser = userInfo.data?.user || userInfo.user;

      console.log('Extracted googleIdToken:', googleIdToken);
      console.log('Extracted user:', googleUser);

      // Check if idToken exists
      if (!googleIdToken) {
        console.error('ERROR: googleIdToken is missing from userInfo');
        console.log('userInfo structure:', userInfo);
        throw new Error('Failed to get idToken from Google Sign-In');
      }

      console.log('=== STEP 4: Creating Firebase Credential ===');
      // Sign in to Firebase
      try {
        const googleCredential = auth.GoogleAuthProvider.credential(
          googleIdToken,
        );
        console.log('✅ Firebase credential created');

        console.log('=== STEP 5: Signing in to Firebase ===');
        const firebaseAuthResult = await auth().signInWithCredential(googleCredential);
        console.log('✅ Firebase sign-in successful');

        // Get Firebase ID token
        console.log('=== STEP 6: Getting Firebase User ===');
        const firebaseUser = auth().currentUser;
        console.log('✅ Firebase user:', firebaseUser ? firebaseUser.uid : 'null');

        const firebaseIdToken = await firebaseUser.getIdToken();
        console.log('=== STEP 7: Got Firebase ID Token ===');

        // Save Firebase token
        await saveFirebaseToken(firebaseIdToken);
        await AsyncStorage.setItem('firebaseUid', firebaseUser.uid);
        console.log('=== STEP 8: Saved tokens locally ===');

        // Send to backend
        console.log('=== STEP 9: Sending to backend ===');
        const response = await googleSignIn(firebaseIdToken);
        console.log('✅ Backend response:', response);

        if (!response.success) {
          console.error('❌ Backend returned error:', response.message);
          throw new Error(response.message || 'Backend authentication failed');
        }

        // Handle successful authentication
        await AsyncStorage.setItem('backup.restorePending', 'true');

        let resolvedUser = response.user;
        try {
          const details = await getUserDetails(firebaseIdToken);
          if (details?.user) {
            resolvedUser = details.user;
          }
        } catch (error) {
          console.warn('Failed to refresh user details:', error);
        }
        const normalizedUser = normalizeUser(resolvedUser);

        // Save user data locally
        saveUserData(normalizedUser);
        await AsyncStorage.setItem('user', JSON.stringify(normalizedUser));

        if (normalizedUser?.firebaseUid) {
          await AsyncStorage.setItem('firebaseUid', normalizedUser.firebaseUid);
        }

        // Auto-set backup email from Google Sign-In (cannot be changed)
        if (normalizedUser?.email) {
          await AsyncStorage.setItem('backup.accountEmail', normalizedUser.email);
          await AsyncStorage.setItem('backup.enabled', 'true');
        }

        // Initialize messaging service to get FCM token
        console.log('🔔 Initializing messaging service for FCM token...');
        try {
          await initMessagingService();
          console.log('✅ Messaging service initialized successfully');
        } catch (msgError) {
          console.warn('⚠️ Failed to initialize messaging service:', msgError);
          // Continue even if messaging init fails
        }

        // Check for restore, then navigate based on setupComplete flag
        const restored = await promptRestoreIfAvailable(normalizedUser);
        if (!restored) {
          await AsyncStorage.setItem('backup.restorePending', 'false');
          if (normalizedUser.setupComplete === true) {
            navigation.replace('Home', { user: normalizedUser });
          } else {
            navigation.replace('ProfileSetup', { user: normalizedUser });
          }
        }
      } catch (firebaseError) {
        console.error('❌ Firebase/Backend error:', firebaseError.message);
        throw firebaseError;
      }
    } catch (error) {
      console.error('=== GOOGLE SIGN-IN ERROR ===');
      console.error('Error type:', typeof error);
      console.error('Error object:', error);
      console.error('Error message:', error.message);
      console.error('Error code:', error.code);
      console.error('Error stack:', error.stack);
      console.error('Full error JSON:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      Alert.alert('Error', error.message || 'Google Sign-In failed');
    } finally {
      setLoading(false);
    }
  };

  const promptRestoreIfAvailable = async currentUser => {
    try {
      console.log('🔐 [LOGIN] ===== Checking for Restore =====');
      console.log('🔐 [LOGIN] currentUser:', JSON.stringify(currentUser, null, 2));

      const existingFirebaseToken = await AsyncStorage.getItem('firebaseToken');
      console.log('🔐 [LOGIN] Firebase token exists:', !!existingFirebaseToken);

      await ensureDriveScopes();
      console.log('✅ [LOGIN] Drive scopes ensured');

      const firebaseUid =
        currentUser?.firebaseUid || (await AsyncStorage.getItem('firebaseUid'));
      console.log('🔐 [LOGIN] Using firebaseUid:', firebaseUid);

      const latest = await findLatestBackupFile(firebaseUid);
      console.log('🔐 [LOGIN] Latest backup found:', latest);

      if (!latest) {
        console.log('❌ [LOGIN] No backup available');
        return false;
      }

      return new Promise(resolve => {
        Alert.alert(
          'Restore Backup',
          'Backup found in Google Drive. Restore now?',
          [
            {text: 'Skip', style: 'cancel', onPress: () => resolve(false)},
            {
              text: 'Restore',
              onPress: async () => {
                try {
                  setLoading(true);
                  await restoreFromBackup({fileId: latest.id});
                  if (currentUser) {
                    await AsyncStorage.setItem(
                      'user',
                      JSON.stringify(currentUser),
                    );
                  }
                  if (currentUser?.firebaseUid) {
                    await AsyncStorage.setItem(
                      'firebaseUid',
                      currentUser.firebaseUid,
                    );
                  }
                  if (existingFirebaseToken) {
                    await AsyncStorage.setItem(
                      'firebaseToken',
                      existingFirebaseToken,
                    );
                  }
                  await AsyncStorage.setItem('backup.restorePending', 'false');
                  Alert.alert('Restore Complete', 'Backup restored successfully.', [
                    {
                      text: 'OK',
                      onPress: () => RNRestart.Restart(),
                    },
                  ]);
                  resolve(true);
                } catch (error) {
                  console.error('❌ [LOGIN] Restore failed:', error);
                  console.error('❌ [LOGIN] Error message:', error.message);
                  console.error('❌ [LOGIN] Error stack:', error.stack);
                  Alert.alert('Restore Failed', `Unable to restore backup.\n\nError: ${error.message}`);
                  resolve(false);
                } finally {
                  setLoading(false);
                }
              },
            },
          ],
        );
      });
    } catch (error) {
      console.error('❌ [LOGIN] Restore check failed:', error);
      console.error('❌ [LOGIN] Error message:', error.message);
      console.error('❌ [LOGIN] Error stack:', error.stack);
      return false;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.innerContainer}>
        <Text style={styles.title}>Savingo</Text>
        <Text style={styles.subtitle}>Welcome Back!</Text>
        <Text style={styles.description}>Sign in to continue</Text>

        <View style={styles.formContainer}>
          <TouchableOpacity
            style={[styles.googleButton, loading && styles.buttonDisabled]}
            onPress={handleGoogleSignIn}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  innerContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
  },
  formContainer: {
    width: '100%',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    marginBottom: 15,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 30,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  dividerText: {
    marginHorizontal: 15,
    color: '#666',
    fontSize: 14,
  },
  googleButton: {
    backgroundColor: '#4285F4',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  googleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default LoginScreen;




