import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import {colors, spacing, fontSize, fontWeight} from '../utils/theme';
import {updateProfile} from '../services/api';

const CURRENCY_OPTIONS = [
  {label: '\u20B9 Rupee', symbol: '\u20B9'},
  {label: '$ Dollar', symbol: '$'},
  {label: '\u20AC Euro', symbol: '\u20AC'},
  {label: '\u00A3 Pound', symbol: '\u00A3'},
  {label: '\u00A5 Yen', symbol: '\u00A5'},
  {label: '\u20A9 Won', symbol: '\u20A9'},
  {label: '\u20BD Ruble', symbol: '\u20BD'},
  {label: '\u20BA Lira', symbol: '\u20BA'},
  {label: '\u09F3 Taka', symbol: '\u09F3'},
  {label: '\u20B1 Peso', symbol: '\u20B1'},
];

const CurrencySetupScreen = ({navigation, route}) => {
  const routeUser = route.params?.user || null;
  const fromSettings = route.params?.fromSettings || false;
  const [selectedSymbol, setSelectedSymbol] = React.useState('');
  const [currentUser, setCurrentUser] = React.useState(routeUser);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    const loadUser = async () => {
      let user = routeUser;
      if (!user) {
        try {
          const storedUser = await AsyncStorage.getItem('user');
          if (storedUser) {
            user = JSON.parse(storedUser);
          }
        } catch (error) {
          console.error('Failed to load user for currency setup:', error);
        }
      }
      if (user) {
        setCurrentUser(user);
        // Pre-select current currency if coming from settings
        if (fromSettings && user.currencySymbol) {
          setSelectedSymbol(user.currencySymbol);
        }
      }
    };
    loadUser();
  }, [routeUser, fromSettings]);

  const handleContinue = async () => {
    if (!selectedSymbol) {
      Alert.alert('Select Currency', 'Please select a currency to continue.');
      return;
    }

    setIsLoading(true);
    try {
      const storedUser = currentUser
        ? currentUser
        : JSON.parse((await AsyncStorage.getItem('user')) || '{}');

      const firebaseUid = storedUser?.firebaseUid || await AsyncStorage.getItem('firebaseUid');

      if (!firebaseUid) {
        Alert.alert('Error', 'User authentication error. Please login again.');
        setIsLoading(false);
        return;
      }

      // Save currency to backend
      const response = await updateProfile(firebaseUid, {
        displayName: storedUser.displayName || storedUser.name || storedUser.email?.split('@')[0] || 'User',
        currencySymbol: selectedSymbol,
      });

      if (!response?.success) {
        Alert.alert('Error', response?.message || 'Failed to save currency');
        setIsLoading(false);
        return;
      }

      const updatedUser = {
        ...storedUser,
        ...response.user,
        currencySymbol: selectedSymbol,
      };
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));

      if (fromSettings) {
        // Go back to More screen
        navigation.goBack();
      } else {
        // Initial setup - go to ProfileSetup
        navigation.replace('ProfileSetup', {user: updatedUser});
      }
    } catch (error) {
      console.error('Failed to save currency selection:', error);
      Alert.alert('Error', 'Failed to save currency. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {fromSettings && (
        <View style={styles.headerBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerBarTitle}>Currency Sign</Text>
          <View style={styles.backButton} />
        </View>
      )}
      <View style={styles.header}>
        {!fromSettings && <Text style={styles.title}>Select Currency</Text>}
        <Text style={styles.subtitle}>
          {fromSettings
            ? 'Change your preferred currency symbol.'
            : 'Choose the currency you want to use in the app.'}
        </Text>
      </View>

      <ScrollView style={styles.list}>
        {CURRENCY_OPTIONS.map(option => {
          const isActive = option.symbol === selectedSymbol;
          return (
            <TouchableOpacity
              key={option.symbol}
              style={[
                styles.optionRow,
                isActive && styles.optionRowActive,
              ]}
              onPress={() => setSelectedSymbol(option.symbol)}>
              <View style={styles.optionLeft}>
                <View style={styles.optionSymbol}>
                  <Text style={styles.optionSymbolText}>{option.symbol}</Text>
                </View>
                <Text
                  style={[
                    styles.optionLabel,
                    isActive && styles.optionLabelActive,
                  ]}>
                  {option.label}
                </Text>
              </View>
              {isActive && (
                <Icon name="checkmark" size={20} color={colors.primary} />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <TouchableOpacity
        style={[
          styles.continueButton,
          (!selectedSymbol || isLoading) && styles.continueButtonDisabled,
        ]}
        onPress={handleContinue}
        disabled={!selectedSymbol || isLoading}>
        {isLoading ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.continueButtonText}>
            {fromSettings ? 'Save' : 'Continue'}
          </Text>
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
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBarTitle: {
    fontSize: fontSize.large,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
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
  list: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionRowActive: {
    borderColor: colors.primary,
    backgroundColor: '#F0F9FF',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  optionSymbol: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionSymbolText: {
    fontSize: fontSize.medium,
    color: colors.text.primary,
  },
  optionLabel: {
    fontSize: fontSize.medium,
    color: colors.text.primary,
    fontWeight: fontWeight.medium,
  },
  optionLabelActive: {
    color: colors.primary,
    fontWeight: fontWeight.bold,
  },
  continueButton: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
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
});

export default CurrencySetupScreen;