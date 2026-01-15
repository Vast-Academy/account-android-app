import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import {GoogleSignin} from '@react-native-google-signin/google-signin';
import { checkUsername, completeSetup } from '../services/api';
import { saveUserData } from '../services/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {ensureDriveScopes, getStorageQuota} from '../services/driveService';
import {isAutoBackupEnabled, setAutoBackupEnabled} from '../utils/backupQueue';

const SetupScreen = ({ route, navigation }) => {
  const { firebaseUid, email, displayName, photoURL } = route.params;

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [backupAccountEmail, setBackupAccountEmail] = useState(email || '');
  const [quotaText, setQuotaText] = useState('');
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [autoBackupEnabled, setAutoBackupEnabledState] = useState(true);
  const [selectingAccount, setSelectingAccount] = useState(false);

  const formatBytes = value => {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) {
      return '0 B';
    }
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = num;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  // Validate username format
  const validateUsernameFormat = (text) => {
    const regex = /^[a-zA-Z0-9._-]+$/;
    return regex.test(text);
  };

  // Check username availability (debounced)
  useEffect(() => {
    if (username.length < 3) {
      setUsernameAvailable(null);
      setSuggestions([]);
      return;
    }

    if (!validateUsernameFormat(username)) {
      setUsernameAvailable(false);
      setSuggestions([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setCheckingUsername(true);
      try {
        const response = await checkUsername(username);
        setUsernameAvailable(response.available);
        setSuggestions(response.suggestions || []);
      } catch (error) {
        console.error('Username check error:', error);
      } finally {
        setCheckingUsername(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [username]);

  useEffect(() => {
    const loadBackupSettings = async () => {
      const enabled = await isAutoBackupEnabled();
      setAutoBackupEnabledState(enabled);
      const storedEmail = await AsyncStorage.getItem('backup.accountEmail');
      if (storedEmail) {
        setBackupAccountEmail(storedEmail);
      } else if (email) {
        setBackupAccountEmail(email);
      }
    };
    loadBackupSettings();
  }, [email]);

  useEffect(() => {
    const loadQuota = async () => {
      if (!backupAccountEmail) {
        setQuotaText('');
        return;
      }
      setQuotaLoading(true);
      try {
        await ensureDriveScopes();
        const quota = await getStorageQuota();
        if (quota?.limit) {
          const used = quota.usageInDrive || quota.usage || 0;
          setQuotaText(`${formatBytes(used)} of ${formatBytes(quota.limit)}`);
        } else {
          setQuotaText('');
        }
      } catch (error) {
        console.error('Failed to load Drive quota:', error);
        setQuotaText('');
      } finally {
        setQuotaLoading(false);
      }
    };
    loadQuota();
  }, [backupAccountEmail]);

  // Handle setup completion
  const handleCompleteSetup = async () => {
    // Validations
    if (!username.trim()) {
      Alert.alert('Error', 'Please enter a username');
      return;
    }

    if (!validateUsernameFormat(username)) {
      Alert.alert(
        'Invalid Username',
        'Username can only contain letters, numbers, dots, hyphens, and underscores',
      );
      return;
    }

    if (usernameAvailable === false) {
      Alert.alert('Error', 'Username is already taken. Please choose another.');
      return;
    }

    if (!password.trim()) {
      Alert.alert('Error', 'Please enter a password');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const response = await completeSetup(firebaseUid, username, password);

      if (response.success) {
        // Save user data locally
        saveUserData(response.user);
        await AsyncStorage.setItem('user', JSON.stringify(response.user));
        if (response.user?.firebaseUid) {
          await AsyncStorage.setItem('firebaseUid', response.user.firebaseUid);
        }
        if (backupAccountEmail) {
          await AsyncStorage.setItem('backup.accountEmail', backupAccountEmail);
        }
        await setAutoBackupEnabled(autoBackupEnabled);

        Alert.alert('Success', 'Account setup completed!', [
          {
            text: 'OK',
            onPress: () =>
              navigation.replace('Home', {
                user: response.user,
                showTutorial: true,
              }),
          },
        ]);
      }
    } catch (error) {
      console.error('Setup error:', error);
      Alert.alert('Error', error.message || 'Failed to complete setup');

      // If username taken, show suggestions
      if (error.suggestions) {
        setSuggestions(error.suggestions);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBackupAccount = async () => {
    try {
      setSelectingAccount(true);
      await GoogleSignin.hasPlayServices();
      await GoogleSignin.signOut();
      const userInfo = await GoogleSignin.signIn();
      const selectedEmail = userInfo?.data?.user?.email || userInfo?.user?.email;
      if (selectedEmail) {
        setBackupAccountEmail(selectedEmail);
        await AsyncStorage.setItem('backup.accountEmail', selectedEmail);
      }
    } catch (error) {
      console.error('Failed to select backup account:', error);
      Alert.alert('Error', 'Unable to select Google account');
    } finally {
      setSelectingAccount(false);
    }
  };

  const handleAutoBackupToggle = async value => {
    setAutoBackupEnabledState(value);
    await setAutoBackupEnabled(value);
  };

  // Handle suggestion press
  const handleSuggestionPress = (suggested) => {
    setUsername(suggested);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled">
        <View style={styles.innerContainer}>
          <Text style={styles.title}>Create Your Account</Text>
          <Text style={styles.subtitle}>Welcome, {displayName}!</Text>

          <View style={styles.formContainer}>
            {/* Username Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Choose Username</Text>
              <TextInput
                style={styles.input}
                placeholder="username"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                editable={!loading}
              />

              {checkingUsername && (
                <Text style={styles.checkingText}>Checking...</Text>
              )}

              {!checkingUsername && usernameAvailable === true && (
                <Text style={styles.availableText}>âœ“ Available</Text>
              )}

              {!checkingUsername &&
                usernameAvailable === false &&
                username.length >= 3 && (
                  <Text style={styles.takenText}>âœ— Already taken</Text>
                )}

              {!validateUsernameFormat(username) && username.length > 0 && (
                <Text style={styles.errorText}>
                  Only letters, numbers, dots, hyphens, and underscores allowed
                </Text>
              )}
            </View>

            {/* Username Suggestions */}
            {suggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                <Text style={styles.suggestionsTitle}>Suggestions:</Text>
                {suggestions.map((suggestion, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.suggestionButton}
                    onPress={() => handleSuggestionPress(suggestion)}>
                    <Text style={styles.suggestionText}>{suggestion}</Text>
                    <Text style={styles.useText}>Use</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Create Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Password (min 6 characters)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!loading}
              />
            </View>

            {/* Confirm Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                editable={!loading}
              />
            </View>
            {/* Google Account Info */}
            <View style={styles.googleInfo}>
              <Text style={styles.googleInfoTitle}>Backup Account</Text>
              <View style={styles.googleRow}>
                <Text style={styles.googleInfoText}>
                  {backupAccountEmail || 'Not selected'}
                </Text>
                <TouchableOpacity
                  style={styles.googleChangeButton}
                  onPress={handleSelectBackupAccount}
                  disabled={selectingAccount || loading}>
                  {selectingAccount ? (
                    <ActivityIndicator size="small" />
                  ) : (
                    <Text style={styles.googleChangeText}>Change</Text>
                  )}
                </TouchableOpacity>
              </View>
              <Text style={styles.googleInfoSubtext}>
                {quotaLoading
                  ? 'Loading storage...'
                  : quotaText || 'Storage unavailable'}
              </Text>
              <View style={styles.googleRow}>
                <Text style={styles.googleInfoSubtext}>Auto backup</Text>
                <Switch
                  value={autoBackupEnabled}
                  onValueChange={handleAutoBackupToggle}
                />
              </View>
            </View>

            {/* Complete Setup Button */}
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleCompleteSetup}
              disabled={loading || checkingUsername || usernameAvailable === false}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Complete Setup</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flexGrow: 1,
  },
  innerContainer: {
    flex: 1,
    padding: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  formContainer: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
  },
  checkingText: {
    marginTop: 5,
    color: '#666',
    fontSize: 12,
  },
  availableText: {
    marginTop: 5,
    color: '#28a745',
    fontSize: 12,
    fontWeight: '600',
  },
  takenText: {
    marginTop: 5,
    color: '#dc3545',
    fontSize: 12,
    fontWeight: '600',
  },
  errorText: {
    marginTop: 5,
    color: '#dc3545',
    fontSize: 12,
  },
  suggestionsContainer: {
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  suggestionButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    marginBottom: 8,
  },
  suggestionText: {
    fontSize: 14,
    color: '#333',
  },
  useText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  googleInfo: {
    backgroundColor: '#e8f5e9',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  googleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  googleInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  googleInfoText: {
    fontSize: 14,
    color: '#28a745',
    fontWeight: '600',
    marginBottom: 5,
    flex: 1,
  },
  googleChangeButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  googleChangeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
  },
  googleInfoSubtext: {
    fontSize: 12,
    color: '#666',
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
});

export default SetupScreen;

