import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {auth} from '../config/firebase';
import {colors, spacing, fontSize, fontWeight} from '../utils/theme';
import {updateProfile, checkUsername} from '../services/api';
import {queueBackupFromStorage} from '../utils/backupQueue';
import {isSetupComplete} from '../services/userSetup';
import {initAccountsDatabase} from '../services/accountsDatabase';

const ProfileSetupScreen = ({navigation, route}) => {
  const routeUser = route.params?.user || null;
  const [currentUser, setCurrentUser] = React.useState(routeUser);
  const [displayName, setDisplayName] = React.useState('');
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [checkingUsername, setCheckingUsername] = React.useState(false);
  const [usernameAvailable, setUsernameAvailable] = React.useState(null);
  const [suggestions, setSuggestions] = React.useState([]);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    const loadUser = async () => {
      if (routeUser) {
        setCurrentUser(routeUser);
        setDisplayName(routeUser.displayName || routeUser.name || '');
        setPhoneNumber(routeUser.phoneNumber || routeUser.mobile || '');
        return;
      }
      try {
        const storedUser = await AsyncStorage.getItem('user');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          setCurrentUser(parsed);
          setDisplayName(parsed.displayName || parsed.name || '');
          setPhoneNumber(parsed.phoneNumber || parsed.mobile || '');
        }
      } catch (error) {
        console.error('Failed to load user for profile setup:', error);
      }
    };
    loadUser();
  }, [routeUser]);

  // Validate username format
  const validateUsernameFormat = (text) => {
    const regex = /^[a-zA-Z0-9._-]+$/;
    return regex.test(text);
  };

  // Check username availability (debounced)
  React.useEffect(() => {
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
        setUsernameAvailable(false);
      } finally {
        setCheckingUsername(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [username]);

  const handleContinue = async () => {
    if (!displayName.trim()) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }
    if (!phoneNumber.trim()) {
      Alert.alert('Error', 'Please enter a phone number');
      return;
    }
    if (!/^\d{10}$/.test(phoneNumber.trim())) {
      Alert.alert('Error', 'Please enter a valid 10-digit mobile number');
      return;
    }

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

    setSaving(true);
    try {
      initAccountsDatabase();
      const storedUser = currentUser
        ? currentUser
        : JSON.parse((await AsyncStorage.getItem('user')) || '{}');
      const firebaseUid =
        storedUser?.firebaseUid || (await AsyncStorage.getItem('firebaseUid'));
      if (!firebaseUid) {
        Alert.alert('Error', 'User authentication error. Please login again.');
        return;
      }
      const response = await updateProfile(firebaseUid, {
        displayName: displayName.trim(),
        username: username.trim().toLowerCase(),
        mobile: phoneNumber.trim(),
        gender: storedUser?.gender || null,
        occupation: storedUser?.occupation || null,
        currencySymbol: storedUser?.currencySymbol || null,
        setupComplete: true,
      });
      if (!response?.success) {
        Alert.alert('Error', response?.message || 'Failed to update profile');
        return;
      }
      if (auth().currentUser) {
        await auth().currentUser.updateProfile({
          displayName: displayName.trim(),
        });
      }
      const updatedUser = {
        ...storedUser,
        ...response.user,
        displayName: displayName.trim(),
        username: username.trim().toLowerCase(),
        phoneNumber: phoneNumber.trim(),
        mobile: phoneNumber.trim(),
        setupComplete: true,
      };
      setCurrentUser(updatedUser);
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      queueBackupFromStorage();
      const showTutorial = !isSetupComplete();
      navigation.replace('Home', {user: updatedUser, showTutorial});
    } catch (error) {
      console.error('Failed to save profile setup:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile Setup</Text>
        <Text style={styles.subtitle}>
          Set your name, phone number, and unique username to continue.
        </Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Enter your name"
          editable={!saving}
        />

        <Text style={styles.label}>Phone Number</Text>
        <TextInput
          style={styles.input}
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          placeholder="Enter your phone number"
          keyboardType="phone-pad"
          editable={!saving}
        />

        <Text style={styles.label}>Username</Text>
        <Text style={styles.note}>
          ⓘ Username can only be set once and cannot be changed later
        </Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder="Choose your username"
          autoCapitalize="none"
          editable={!saving}
        />

        {/* Username Status */}
        {username.length > 0 && (
          <View style={styles.usernameStatusContainer}>
            {checkingUsername && (
              <View style={styles.statusRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.checkingText}>Checking username...</Text>
              </View>
            )}
            {!checkingUsername && username.length < 3 && (
              <Text style={styles.errorText}>Username must be at least 3 characters</Text>
            )}
            {!checkingUsername && username.length >= 3 && !validateUsernameFormat(username) && (
              <Text style={styles.errorText}>
                Username can only contain letters, numbers, dots, hyphens, and underscores
              </Text>
            )}
            {!checkingUsername && usernameAvailable === true && (
              <View style={styles.statusRow}>
                <Text style={styles.successText}>✓ Username available</Text>
              </View>
            )}
            {!checkingUsername && usernameAvailable === false && (
              <View>
                <Text style={styles.errorText}>✗ Username already taken</Text>
                {suggestions.length > 0 && (
                  <View style={styles.suggestionsContainer}>
                    <Text style={styles.suggestionsTitle}>Suggestions:</Text>
                    {suggestions.map((suggestion, index) => (
                      <TouchableOpacity
                        key={index}
                        onPress={() => setUsername(suggestion)}
                        style={styles.suggestionButton}>
                        <Text style={styles.suggestionText}>{suggestion}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[styles.continueButton, saving && styles.continueButtonDisabled]}
        onPress={handleContinue}
        disabled={saving}>
        {saving ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.continueButtonText}>Continue</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingBottom: spacing.lg,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.xlarge,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.medium,
    color: colors.text.secondary,
  },
  form: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  label: {
    fontSize: fontSize.small,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
    fontWeight: fontWeight.semibold,
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    fontSize: fontSize.medium,
    color: colors.text.primary,
  },
  continueButton: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.6,
  },
  continueButtonText: {
    color: colors.white,
    fontSize: fontSize.medium,
    fontWeight: fontWeight.semibold,
  },
  note: {
    fontSize: fontSize.small,
    color: colors.text.secondary,
    fontStyle: 'italic',
    marginBottom: spacing.xs,
  },
  usernameStatusContainer: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  checkingText: {
    fontSize: fontSize.small,
    color: colors.primary,
  },
  successText: {
    fontSize: fontSize.small,
    color: '#10B981',
    fontWeight: fontWeight.semibold,
  },
  errorText: {
    fontSize: fontSize.small,
    color: '#EF4444',
    fontWeight: fontWeight.semibold,
  },
  suggestionsContainer: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  suggestionsTitle: {
    fontSize: fontSize.small,
    color: colors.text.secondary,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  suggestionButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  suggestionText: {
    fontSize: fontSize.small,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
});

export default ProfileSetupScreen;