import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import {colors, spacing, fontSize, fontWeight} from '../utils/theme';
import {updateProfile} from '../services/api';
import CurrencyPickerModal, {CURRENCIES} from '../components/CurrencyPickerModal';

const getCurrencyLabel = symbol => {
  const match = CURRENCIES.find(item => item.symbol === symbol);
  return match ? match.label : symbol;
};

const CurrencySetupScreen = ({navigation, route}) => {
  const routeUser = route.params?.user || null;
  const fromSettings = route.params?.fromSettings || false;
  const [selectedSymbol, setSelectedSymbol] = React.useState('');
  const [currentUser, setCurrentUser] = React.useState(routeUser);
  const [isLoading, setIsLoading] = React.useState(false);
  const [currencyModalVisible, setCurrencyModalVisible] = React.useState(
    !fromSettings
  );

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

  React.useEffect(() => {
    if (!fromSettings && !selectedSymbol) {
      setCurrencyModalVisible(true);
    }
  }, [fromSettings, selectedSymbol]);

  const handleCurrencySelect = async currency => {
    if (!currency) {
      return;
    }
    const symbol = currency.symbol;
    setSelectedSymbol(symbol);
    setCurrencyModalVisible(false);
    setIsLoading(true);
    try {
      const storedUser = currentUser
        ? currentUser
        : JSON.parse((await AsyncStorage.getItem('user')) || '{}');

      const firebaseUid =
        storedUser?.firebaseUid || (await AsyncStorage.getItem('firebaseUid'));

      if (!firebaseUid) {
        Alert.alert('Error', 'User authentication error. Please login again.');
        setIsLoading(false);
        return;
      }

      // Save currency to backend
      const response = await updateProfile(firebaseUid, {
        displayName: storedUser.displayName || storedUser.name || storedUser.email?.split('@')[0] || 'User',
        currencySymbol: symbol,
      });

      if (!response?.success) {
        Alert.alert('Error', response?.message || 'Failed to save currency');
        setIsLoading(false);
        return;
      }

      const updatedUser = {
        ...storedUser,
        ...response.user,
        currencySymbol: symbol,
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
      if (!fromSettings) {
        setCurrencyModalVisible(true);
      }
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

      <View style={styles.selectorContainer}>
        <TouchableOpacity
          style={styles.selectorRow}
          onPress={() => setCurrencyModalVisible(true)}
          disabled={isLoading}>
          <View style={styles.selectorLeft}>
            <View style={styles.selectorSymbol}>
              <Text style={styles.selectorSymbolText}>
                {selectedSymbol || '₹'}
              </Text>
            </View>
            <Text style={styles.selectorLabel}>
              {selectedSymbol
                ? `${selectedSymbol} ${getCurrencyLabel(selectedSymbol)}`
                : 'Select a currency'}
            </Text>
          </View>
          <Icon name="chevron-forward" size={20} color={colors.text.light} />
        </TouchableOpacity>
      </View>

      <CurrencyPickerModal
        visible={currencyModalVisible}
        onClose={() => setCurrencyModalVisible(false)}
        onSelect={handleCurrencySelect}
        currentSymbol={selectedSymbol}
        isSaving={isLoading}
      />
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
  selectorContainer: {
    paddingHorizontal: spacing.md,
  },
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  selectorSymbol: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorSymbolText: {
    fontSize: fontSize.medium,
    color: colors.text.primary,
  },
  selectorLabel: {
    fontSize: fontSize.medium,
    color: colors.text.primary,
    fontWeight: fontWeight.medium,
  },
});

export default CurrencySetupScreen;
