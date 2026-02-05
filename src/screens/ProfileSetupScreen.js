import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
  FlatList,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {auth} from '../config/firebase';
import {colors, spacing, fontSize, fontWeight} from '../utils/theme';
import {updateProfile, checkUsername} from '../services/api';
import {queueBackupFromStorage} from '../utils/backupQueue';
import {isSetupComplete} from '../services/userSetup';
import {initAccountsDatabase} from '../services/accountsDatabase';
import {COUNTRIES, countryToCurrency, getCurrencyNameByCountry} from '../utils/countries';

const ProfileSetupScreen = ({navigation, route}) => {
  const routeUser = route.params?.user || null;
  const [currentUser, setCurrentUser] = React.useState(routeUser);
  const [displayName, setDisplayName] = React.useState('');
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const [selectedCountry, setSelectedCountry] = React.useState('IN');
  const [selectedCurrency, setSelectedCurrency] = React.useState('₹');
  const [username, setUsername] = React.useState('');
  const [checkingUsername, setCheckingUsername] = React.useState(false);
  const [usernameAvailable, setUsernameAvailable] = React.useState(null);
  const [suggestions, setSuggestions] = React.useState([]);
  const [saving, setSaving] = React.useState(false);
  const [showCountryPicker, setShowCountryPicker] = React.useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = React.useState(false);
  const [phoneError, setPhoneError] = React.useState('');

  React.useEffect(() => {
    const loadUser = async () => {
      if (routeUser) {
        setCurrentUser(routeUser);
        setDisplayName(routeUser.displayName || routeUser.name || '');
        setPhoneNumber(routeUser.phoneNumber || routeUser.mobile || '');
        if (routeUser.country) {
          setSelectedCountry(routeUser.country);
        }
        const currency = routeUser.currencySymbol || countryToCurrency[routeUser.country] || '₹';
        setSelectedCurrency(currency);
        return;
      }
      try {
        const storedUser = await AsyncStorage.getItem('user');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          setCurrentUser(parsed);
          setDisplayName(parsed.displayName || parsed.name || '');
          setPhoneNumber(parsed.phoneNumber || parsed.mobile || '');
          if (parsed.country) {
            setSelectedCountry(parsed.country);
          }
          const currency = parsed.currencySymbol || countryToCurrency[parsed.country] || '₹';
          setSelectedCurrency(currency);
        }
      } catch (error) {
        console.error('Failed to load user for profile setup:', error);
      }
    };
    loadUser();
  }, [routeUser]);

  // Auto-fill currency when country changes
  React.useEffect(() => {
    const currency = countryToCurrency[selectedCountry];
    if (currency) {
      setSelectedCurrency(currency);
    }
  }, [selectedCountry]);

  // Validate phone number format based on country
  const validatePhoneFormat = (phone, country) => {
    if (!phone.trim()) {
      return 'Phone number is required';
    }

    // Basic validation - allow digits, spaces, dashes, parentheses
    const cleanedPhone = phone.replace(/[\s\-\(\)]/g, '');
    if (!/^\d+$/.test(cleanedPhone)) {
      return 'Phone number can only contain digits, spaces, and dashes';
    }

    // For now, basic length check (actual validation will be done on backend)
    if (cleanedPhone.length < 7) {
      return `Phone number must be at least 7 digits for ${selectedCountry}`;
    }

    setPhoneError('');
    return null;
  };

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
    // Validate name
    if (!displayName.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    // Validate country
    if (!selectedCountry) {
      Alert.alert('Error', 'Please select a country');
      return;
    }

    // Validate phone
    const phoneValidationError = validatePhoneFormat(phoneNumber, selectedCountry);
    if (phoneValidationError) {
      setPhoneError(phoneValidationError);
      Alert.alert('Error', phoneValidationError);
      return;
    }

    // Validate username
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
        country: selectedCountry,
        currency: selectedCurrency,
        gender: storedUser?.gender || null,
        occupation: storedUser?.occupation || null,
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
        country: selectedCountry,
        currencySymbol: selectedCurrency,
        setupComplete: true,
      };

      setCurrentUser(updatedUser);
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      queueBackupFromStorage();
      const showTutorial = !isSetupComplete();
      navigation.replace('Home', {user: updatedUser, showTutorial});
    } catch (error) {
      console.error('Failed to save profile setup:', error);
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const countryObject = COUNTRIES.find(c => c.code === selectedCountry);
  const currencyName = getCurrencyNameByCountry(selectedCountry);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile Setup</Text>
        <Text style={styles.subtitle}>
          Set your profile details to continue.
        </Text>
      </View>

      <View style={styles.form}>
        {/* Name Field */}
        <View>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Enter your name"
            editable={!saving}
            placeholderTextColor={colors.text.secondary}
          />
        </View>

        {/* Country Picker */}
        <View>
          <Text style={styles.label}>Country</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowCountryPicker(true)}
            disabled={saving}>
            <Text style={styles.pickerButtonText}>
              {countryObject?.name || 'Select Country'} ({selectedCountry})
            </Text>
            <Text style={styles.pickerArrow}>▼</Text>
          </TouchableOpacity>
        </View>

        {/* Phone Number Field */}
        <View>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={[styles.input, phoneError && styles.inputError]}
            value={phoneNumber}
            onChangeText={(text) => {
              setPhoneNumber(text);
              setPhoneError('');
            }}
            placeholder="Enter phone number"
            keyboardType="phone-pad"
            editable={!saving}
            placeholderTextColor={colors.text.secondary}
          />
          {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}
          {/* {selectedCountry && (
            <Text style={styles.helperText}>
              Country code: {countryObject?.dialCode}
            </Text>
          )} */}
        </View>

        {/* Currency Picker */}
        <View>
          <Text style={styles.label}>Currency</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowCurrencyPicker(true)}
            disabled={saving}>
            <Text style={styles.pickerButtonText}>
              {selectedCurrency} {currencyName}
            </Text>
            <Text style={styles.pickerArrow}>▼</Text>
          </TouchableOpacity>
          {/* <Text style={styles.helperText}>Auto-selected from {selectedCountry}</Text> */}
        </View>

        {/* Username Field */}
        <View>
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
            placeholderTextColor={colors.text.secondary}
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

      {/* Country Picker Modal */}
      <Modal
        visible={showCountryPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCountryPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Country</Text>
              <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={COUNTRIES}
              keyExtractor={(item) => item.code}
              renderItem={({item}) => (
                <TouchableOpacity
                  style={[
                    styles.countryOption,
                    selectedCountry === item.code && styles.countryOptionSelected,
                  ]}
                  onPress={() => {
                    setSelectedCountry(item.code);
                    setShowCountryPicker(false);
                  }}>
                  <Text
                    style={[
                      styles.countryOptionText,
                      selectedCountry === item.code && styles.countryOptionTextSelected,
                    ]}>
                    {item.name} ({item.code}) {item.dialCode}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Currency Picker Modal */}
      <Modal
        visible={showCurrencyPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCurrencyPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Currency</Text>
              <TouchableOpacity onPress={() => setShowCurrencyPicker(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={COUNTRIES}
              keyExtractor={(item) => item.code}
              renderItem={({item}) => (
                <TouchableOpacity
                  style={[
                    styles.countryOption,
                    selectedCurrency === item.currency && styles.countryOptionSelected,
                  ]}
                  onPress={() => {
                    setSelectedCurrency(item.currency);
                    setShowCurrencyPicker(false);
                  }}>
                  <Text
                    style={[
                      styles.countryOptionText,
                      selectedCurrency === item.currency && styles.countryOptionTextSelected,
                    ]}>
                    {item.currency} - {item.name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
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
    gap: spacing.lg,
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
  inputError: {
    borderColor: '#EF4444',
  },
  pickerButton: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerButtonText: {
    fontSize: fontSize.medium,
    color: colors.text.primary,
  },
  pickerArrow: {
    color: colors.text.secondary,
    fontSize: fontSize.small,
  },
  helperText: {
    fontSize: fontSize.small,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    fontStyle: 'italic',
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
    marginTop: spacing.xs,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: spacing.md,
    maxHeight: '80%',
  },
  modalHeader: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: fontSize.medium,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  closeButton: {
    fontSize: fontSize.xlarge,
    color: colors.text.secondary,
  },
  countryOption: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  countryOptionSelected: {
    backgroundColor: '#F0F9FF',
  },
  countryOptionText: {
    fontSize: fontSize.medium,
    color: colors.text.primary,
  },
  countryOptionTextSelected: {
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
});

export default ProfileSetupScreen;
