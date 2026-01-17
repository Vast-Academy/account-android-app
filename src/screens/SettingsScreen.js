import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {colors, spacing, fontSize, fontWeight} from '../utils/theme';
import {queueBackupFromStorage} from '../utils/backupQueue';
import {useToast} from '../hooks/useToast';
import {DEFAULT_CURRENCY} from '../hooks/useCurrencySymbol';
import {updateProfile} from '../services/api';
import BottomSheet from '../components/BottomSheet';

const MONTH_START_DAY_KEY = 'monthStartDay';
const MONTH_START_DAY_OPTIONS = Array.from({length: 28}, (_, index) => index + 1);

const COMMON_SETTINGS = [
  {id: 'language', title: 'Language', icon: 'globe-outline'},
  {id: 'notifications', title: 'Notifications', icon: 'notifications-outline'},
  {id: 'privacy', title: 'Privacy', icon: 'lock-closed-outline'},
];

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

const getSymbolFromUser = userData => {
  return (
    userData?.currencySymbol ||
    userData?.currency ||
    userData?.currency_symbol ||
    DEFAULT_CURRENCY
  );
};

const getCurrencyLabel = symbol => {
  const match = CURRENCY_OPTIONS.find(item => item.symbol === symbol);
  return match ? match.label : symbol;
};

const SettingsScreen = ({navigation}) => {
  const [monthStartDay, setMonthStartDay] = React.useState(1);
  const [monthStartModalVisible, setMonthStartModalVisible] = React.useState(false);
  const [currencyModalVisible, setCurrencyModalVisible] = React.useState(false);
  const [currencySymbol, setCurrencySymbol] = React.useState(DEFAULT_CURRENCY);
  const [currentUser, setCurrentUser] = React.useState(null);
  const {showToast} = useToast();

  React.useEffect(() => {
    const loadMonthStartDay = async () => {
      try {
        const stored = await AsyncStorage.getItem(MONTH_START_DAY_KEY);
        const parsed = Number(stored);
        if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 28) {
          setMonthStartDay(parsed);
        } else {
          setMonthStartDay(1);
        }
      } catch (error) {
        console.error('Failed to load month start day:', error);
      }
    };
    const loadUser = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user');
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setCurrentUser(parsedUser);
          setCurrencySymbol(getSymbolFromUser(parsedUser));
          return;
        }
      } catch (error) {
        console.error('Failed to load user for settings:', error);
      }
      setCurrentUser(null);
      setCurrencySymbol(DEFAULT_CURRENCY);
    };
    const handleFocus = () => {
      loadMonthStartDay();
      loadUser();
    };
    const unsubscribe = navigation.addListener('focus', handleFocus);
    handleFocus();
    return unsubscribe;
  }, [navigation]);

  const handleMonthStartSelect = async day => {
    setMonthStartDay(day);
    setMonthStartModalVisible(false);
    try {
      await AsyncStorage.setItem(MONTH_START_DAY_KEY, String(day));
      queueBackupFromStorage();
    } catch (error) {
      console.error('Failed to save month start day:', error);
    }
  };

  const handleCurrencySelect = async symbol => {
    const previousSymbol = currencySymbol;
    setCurrencySymbol(symbol);
    setCurrencyModalVisible(false);
    try {
      const storedUser = currentUser
        ? currentUser
        : JSON.parse((await AsyncStorage.getItem('user')) || '{}');
      const firebaseUid =
        storedUser?.firebaseUid || (await AsyncStorage.getItem('firebaseUid'));
      if (!firebaseUid) {
        setCurrencySymbol(previousSymbol);
        Alert.alert('Error', 'User authentication error. Please login again.');
        return;
      }
      const displayName =
        storedUser?.displayName ||
        storedUser?.name ||
        storedUser?.username ||
        null;
      if (!displayName) {
        setCurrencySymbol(previousSymbol);
        Alert.alert('Error', 'Please update your name in profile first.');
        return;
      }
      const response = await updateProfile(firebaseUid, {
        displayName,
        mobile:
          storedUser?.phoneNumber || storedUser?.mobile || null,
        dob: storedUser?.dob || null,
        gender: storedUser?.gender || null,
        occupation: storedUser?.occupation || null,
        currencySymbol: symbol,
        setupComplete:
          typeof storedUser?.setupComplete === 'boolean'
            ? storedUser.setupComplete
            : true,
      });
      if (!response?.success) {
        setCurrencySymbol(previousSymbol);
        Alert.alert('Error', response?.message || 'Failed to update currency');
        return;
      }
      const updatedUser = {
        ...storedUser,
        ...response.user,
        currencySymbol: symbol,
      };
      setCurrentUser(updatedUser);
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      queueBackupFromStorage();
      showToast('Currency updated.', 'success');
    } catch (error) {
      setCurrencySymbol(previousSymbol);
      console.error('Failed to save currency:', error);
      Alert.alert('Error', 'Failed to update currency');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={22} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Common Settings</Text>
          {COMMON_SETTINGS.map(item => (
            <TouchableOpacity
              key={item.id}
              style={styles.settingRow}
              onPress={() => Alert.alert('Coming Soon', `${item.title} setting`)}>
              <View style={styles.settingLeft}>
                <Icon name={item.icon} size={22} color={colors.text.primary} />
                <Text style={styles.settingText}>{item.title}</Text>
              </View>
              <Icon name="chevron-forward" size={20} color={colors.text.light} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => setCurrencyModalVisible(true)}>
            <View style={styles.settingLeft}>
              <Icon name="cash-outline" size={22} color={colors.text.primary} />
              <Text style={styles.settingText}>Currency</Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={styles.settingValue}>
                {getCurrencyLabel(currencySymbol)}
              </Text>
              <Icon name="chevron-forward" size={20} color={colors.text.light} />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dashboard</Text>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => setMonthStartModalVisible(true)}>
            <View style={styles.settingLeft}>
              <Icon name="calendar-outline" size={22} color={colors.text.primary} />
              <Text style={styles.settingText}>Quick Period</Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={styles.settingValue}>Day {monthStartDay}</Text>
              <Icon name="chevron-forward" size={20} color={colors.text.light} />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <BottomSheet
        visible={monthStartModalVisible}
        onClose={() => setMonthStartModalVisible(false)}>
        <View style={styles.sheetHeaderCentered}>
          <Text style={styles.sheetTitleCentered}>Quick Period Reset Day</Text>
        </View>
        <View style={styles.dayGridContainer}>
          <View style={styles.dayGrid}>
          {MONTH_START_DAY_OPTIONS.map(day => {
            const isActive = day === monthStartDay;
            return (
              <View key={day} style={styles.dayCell}>
                <TouchableOpacity
                  style={[
                    styles.dayButton,
                    isActive && styles.dayButtonActive,
                  ]}
                  onPress={() => handleMonthStartSelect(day)}>
                  <Text
                    style={[styles.dayText, isActive && styles.dayTextActive]}>
                    {day}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
          </View>
        </View>
      </BottomSheet>

      <BottomSheet
        visible={currencyModalVisible}
        onClose={() => setCurrencyModalVisible(false)}>
        <View style={styles.sheetHeaderCentered}>
          <Text style={styles.sheetTitleCentered}>Select Currency</Text>
        </View>
        {CURRENCY_OPTIONS.map(option => {
          const isActive = option.symbol === currencySymbol;
          return (
            <TouchableOpacity
              key={option.symbol}
              style={[
                styles.sheetOption,
                isActive && styles.dropdownOptionActive,
              ]}
              onPress={() => handleCurrencySelect(option.symbol)}>
              <View style={styles.sheetOptionRow}>
                <View style={styles.sheetOptionIcon}>
                  <Text style={styles.sheetOptionSymbol}>{option.symbol}</Text>
                </View>
                <Text
                  style={[
                    styles.dropdownOptionText,
                    isActive && styles.dropdownOptionTextActive,
                  ]}>
                  {option.label}
                </Text>
              </View>
              {isActive && (
                <Icon name="checkmark" size={18} color={colors.primary} />
              )}
            </TouchableOpacity>
          );
        })}
      </BottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    elevation: 2,
  },
  backButton: {
    padding: 6,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSize.large,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  headerSpacer: {
    width: 34,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: colors.white,
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  settingText: {
    fontSize: fontSize.regular,
    color: colors.text.primary,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  settingValue: {
    fontSize: fontSize.regular,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sheetHeaderCentered: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  sheetTitle: {
    fontSize: fontSize.large,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  sheetTitleCentered: {
    fontSize: fontSize.large,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  sheetClose: {
    padding: 4,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
  },
  dropdownOptionActive: {
    backgroundColor: '#F0F9FF',
  },
  dropdownOptionText: {
    fontSize: fontSize.medium,
    color: colors.text.primary,
    fontWeight: fontWeight.medium,
  },
  dropdownOptionTextActive: {
    color: colors.primary,
    fontWeight: fontWeight.bold,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: spacing.md,
  },
  sheetOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sheetOptionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetOptionSymbol: {
    fontSize: fontSize.regular,
    color: colors.text.primary,
  },
  dayGridContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.2857%',
    padding: 4,
  },
  dayButton: {
    aspectRatio: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  dayButtonActive: {
    backgroundColor: '#F0F9FF',
    borderColor: colors.primary,
  },
  dayText: {
    fontSize: fontSize.medium,
    color: colors.text.primary,
  },
  dayTextActive: {
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
});

export default SettingsScreen;
