import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Platform,
  Alert,
  LayoutAnimation,
  UIManager,
  Animated,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import FaArrowCircleDown from '../components/icons/FaArrowCircleDown';
import BsCashCoin from '../components/icons/BsCashCoin';
import {colors, spacing, fontSize, fontWeight} from '../utils/theme';
import FaArrowCircleUp from '../components/icons/FaArrowCircleUp';
import BottomSheet from '../components/BottomSheet';
import {
  initAccountsDatabase,
  getAllAccounts,
  renameAccount,
  deleteAccountAndTransactions,
  updateAccountPrimary,
  updateAccountSortIndex,
} from '../services/accountsDatabase';
import {
  initTransactionsDatabase,
  calculateAccountBalance,
  getTransactionsByAccount,
} from '../services/transactionsDatabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useToast} from '../hooks/useToast';
import {useFocusEffect} from '@react-navigation/native';
import {useCurrencySymbol} from '../hooks/useCurrencySymbol';

// Quick Period Options
const QUICK_PERIODS = [
  {label: 'Last 5 Days', value: '1week'},
  {label: 'Last 10 Days', value: '10days'},
  {label: 'Last 15 Days', value: '15days'},
  {label: 'Last 30 Days', value: '30days'},
  {label: 'This Month', value: '1month'},
  {label: '3 Months', value: '3months'},
  {label: '6 Months', value: '6months'},
  {label: '1 Year', value: '1year'},
];

// Month Options
const MONTHS = [
  {label: 'January', value: 0},
  {label: 'February', value: 1},
  {label: 'March', value: 2},
  {label: 'April', value: 3},
  {label: 'May', value: 4},
  {label: 'June', value: 5},
  {label: 'July', value: 6},
  {label: 'August', value: 7},
  {label: 'September', value: 8},
  {label: 'October', value: 9},
  {label: 'November', value: 10},
  {label: 'December', value: 11},
];

const MONTH_START_DAY_KEY = 'monthStartDay';
const DEFAULT_MONTH_START_DAY = 1;

const METRIC_ICON_SIZE = 24;
const METRIC_LABEL_GAP = 8;
const METRIC_LABEL_OFFSET = METRIC_ICON_SIZE + METRIC_LABEL_GAP;

const renderAccountIcon = (iconName, size, color) => {
  if (iconName === 'bs-cash-coin') {
    return <BsCashCoin size={size} color={color} />;
  }
  return <Icon name={iconName} size={size} color={color} />;
};

const DashboardScreen = ({navigation}) => {

  // Period selection states
  const [quickPeriod, setQuickPeriod] = useState('1month');
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [isBottomSheetVisible, setBottomSheetVisible] = useState(false);
  const [bottomSheetContent, setBottomSheetContent] = useState(null);

  // Available years (will be populated from transactions)
  const [availableYears, setAvailableYears] = useState([]);

  // Filtered data states
  const [filteredEarning, setFilteredEarning] = useState(0);
  const [filteredWithdrawals, setFilteredWithdrawals] = useState(0);
  const [hasRecords, setHasRecords] = useState(true);
  const [fabExpanded, setFabExpanded] = useState(false);

  // Other states
  const [accounts, setAccounts] = useState([]);
  const [monthStartDay, setMonthStartDay] = useState(DEFAULT_MONTH_START_DAY);
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const selectedAccountRef = useRef(null);
  const deletePressGuardRef = useRef(false);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameTargetAccount, setRenameTargetAccount] = useState(null);
  const [newAccountName, setNewAccountName] = useState('');
  const {showToast} = useToast();
  const currencySymbol = useCurrencySymbol();

  // Setup completion popup states
  const [showSetupPopup, setShowSetupPopup] = useState(false);
  const [popupDismissedThisSession, setPopupDismissedThisSession] =
    useState(false);

  const fabRef = useRef(null);
  const fabAnim = useRef(new Animated.Value(0)).current;

  const netBalance = React.useMemo(() => {
    return accounts.reduce((total, account) => {
      const balance = Number(account?.balance) || 0;
      return total + balance;
    }, 0);
  }, [accounts]);

  const handleAddAccountPress = () => {
    const next = !fabExpanded;
    setFabExpanded(next);
    Animated.timing(fabAnim, {
      toValue: next ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const openAddAccount = type => {
    setFabExpanded(false);
    Animated.timing(fabAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
    navigation.navigate('AddAccount', {initialType: type});
  };

  const selectedAccountIndex = React.useMemo(() => {
    if (!selectedAccount) {
      return -1;
    }
    return accounts.findIndex(
      account => String(account.id) === String(selectedAccount.id)
    );
  }, [accounts, selectedAccount]);

  const selectedAccountType = selectedAccount?.account_type;
  const accountsOfType = React.useMemo(() => {
    if (!selectedAccountType) {
      return [];
    }
    return accounts.filter(
      account => account.account_type === selectedAccountType
    );
  }, [accounts, selectedAccountType]);
  const selectedAccountTypeIndex = React.useMemo(() => {
    if (!selectedAccount) {
      return -1;
    }
    return accountsOfType.findIndex(
      account => String(account.id) === String(selectedAccount.id)
    );
  }, [accountsOfType, selectedAccount]);
  const canMoveWithinType = accountsOfType.length >= 2;
  const isMoveUpDisabled = !canMoveWithinType || selectedAccountTypeIndex <= 0;
  const isMoveDownDisabled =
    !canMoveWithinType ||
    selectedAccountTypeIndex < 0 ||
    selectedAccountTypeIndex >= accountsOfType.length - 1;

  // Animation values
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(300)).current;

  // Initialize database and load accounts on mount
  useEffect(() => {
    try {
      initAccountsDatabase();
      initTransactionsDatabase();
      loadMonthStartDay();
      loadAccounts();
    } catch (error) {
      console.error('Failed to initialize accounts database:', error);
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === 'android') {
      UIManager.setLayoutAnimationEnabledExperimental?.(true);
    }
  }, []);

  const runPinReorderAnimation = () => {
    LayoutAnimation.configureNext({
      duration: 600,
      update: {type: LayoutAnimation.Types.easeInEaseOut},
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.scaleXY,
      },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });
  };

  // Refresh accounts when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadMonthStartDay();
      loadAccounts();
      generateAvailableYears();
      updateFilteredData();
    });

    return unsubscribe;
  }, [navigation]);

  // Update filtered data when period selection changes
  useEffect(() => {
    updateFilteredData();
  }, [quickPeriod, selectedMonth, selectedYear, accounts, monthStartDay]);

  // Generate years when accounts load
  useEffect(() => {
    generateAvailableYears();
  }, [accounts]);

  const hasBasicDetails = userData => {
    const name = String(userData?.displayName || userData?.name || '').trim();
    const phone = String(
      userData?.phoneNumber || userData?.mobile || ''
    ).trim();
    const currency = String(
      userData?.currencySymbol ||
        userData?.currency ||
        userData?.currency_symbol ||
        ''
    ).trim();
    return Boolean(name) && Boolean(phone) && Boolean(currency);
  };

  // Check setup completion status on screen focus
  useFocusEffect(
    React.useCallback(() => {
      const checkSetupStatus = async () => {
        try {
          const storedUser = await AsyncStorage.getItem('user');
          if (storedUser) {
            const userData = JSON.parse(storedUser);
            const setupComplete = Boolean(userData?.setupComplete);
            const missingDetails = !hasBasicDetails(userData);
            if (!setupComplete && missingDetails && !popupDismissedThisSession) {
              setShowSetupPopup(true);
            }
          }
        } catch (error) {
          console.error('Error checking setup status:', error);
        }
      };

      checkSetupStatus();
    }, [popupDismissedThisSession])
  );

  const handleGoToProfile = () => {
    setShowSetupPopup(false);
    navigation.navigate('More', {
      openProfileOnFocus: true,
      returnToDashboardOnSave: true,
    });
  };

  const handleRemindLater = () => {
    setShowSetupPopup(false);
    setPopupDismissedThisSession(true);
  };

  const normalizeMonthStartDay = value => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return DEFAULT_MONTH_START_DAY;
    }
    return Math.min(28, Math.max(1, Math.floor(parsed)));
  };

  const loadMonthStartDay = async () => {
    try {
      const stored = await AsyncStorage.getItem(MONTH_START_DAY_KEY);
      setMonthStartDay(normalizeMonthStartDay(stored));
    } catch (error) {
      console.error('Failed to load month start day:', error);
    }
  };

  const getMonthlyRangeFromStartDay = (startDay, referenceDate = new Date()) => {
    const start = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      startDay
    );
    if (referenceDate.getDate() < startDay) {
      start.setMonth(start.getMonth() - 1);
    }
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    end.setMilliseconds(end.getMilliseconds() - 1);
    return {startTime: start.getTime(), endTime: end.getTime()};
  };

  const getMonthYearRange = (month, year, startDay) => {
    const start = new Date(year, month, startDay);
    start.setHours(0, 0, 0, 0);
    const end = new Date(year, month + 1, startDay);
    end.setHours(0, 0, 0, 0);
    end.setMilliseconds(end.getMilliseconds() - 1);
    return {startTime: start.getTime(), endTime: end.getTime()};
  };

  // Load accounts from database with updated balances
  const loadAccounts = () => {
    try {
      const accountsList = getAllAccounts();

      // Update each account with current balance from transactions
      const accountsWithBalance = accountsList.map(account => {
        const balance = calculateAccountBalance(account.id);
        return {
          ...account,
          balance: balance,
        };
      });

      console.log('Loaded accounts with balances:', accountsWithBalance);
      setAccounts(accountsWithBalance);
      // Note: Filtered earning/withdrawal data will be calculated by updateFilteredData()
    } catch (error) {
      console.error('Failed to load accounts:', error);
    }
  };

  // Generate available years from user registration or first transaction
  const generateAvailableYears = () => {
    try {
      const accountsList = getAllAccounts();
      const allTransactions = [];

      accountsList.forEach(account => {
        const txns = getTransactionsByAccount(account.id);
        allTransactions.push(...txns);
      });

      if (allTransactions.length === 0) {
        // No transactions, use current year only
        setAvailableYears([new Date().getFullYear()]);
        return;
      }

      // Find oldest transaction
      const oldestDate = Math.min(
        ...allTransactions.map(txn => txn.transaction_date)
      );
      const oldestYear = new Date(oldestDate).getFullYear();
      const currentYear = new Date().getFullYear();

      // Generate years array from oldest to current
      const years = [];
      for (let year = currentYear; year >= oldestYear; year--) {
        years.push(year);
      }
      setAvailableYears(years);
    } catch (error) {
      console.error('Failed to generate years:', error);
      setAvailableYears([new Date().getFullYear()]);
    }
  };

  const isTransferTransaction = txn => {
    const remark = String(txn?.remark || '').trim().toLowerCase();
    return (
      remark.startsWith('transferred to ') ||
      remark.startsWith('transferred from ') ||
      remark.startsWith('requested to ') ||
      remark.startsWith('requested from ') ||
      remark.startsWith('requested by ')
    );
  };

  // Calculate data for Quick Period
  const calculateQuickPeriodData = period => {
    try {
      const now = new Date();
      let startTime;
      let endTime = null;

      switch (period) {
        case '1week': {
          const start = new Date(now);
          start.setDate(now.getDate() - 4);
          start.setHours(0, 0, 0, 0);
          startTime = start.getTime();
          break;
        }
        case '10days': {
          const start = new Date(now);
          start.setDate(now.getDate() - 9);
          start.setHours(0, 0, 0, 0);
          startTime = start.getTime();
          break;
        }
        case '15days': {
          const start = new Date(now);
          start.setDate(now.getDate() - 14);
          start.setHours(0, 0, 0, 0);
          startTime = start.getTime();
          break;
        }
        case '30days': {
          const start = new Date(now);
          start.setDate(now.getDate() - 29);
          start.setHours(0, 0, 0, 0);
          startTime = start.getTime();
          break;
        }
        case '1month': {
          const range = getMonthlyRangeFromStartDay(monthStartDay, now);
          startTime = range.startTime;
          endTime = range.endTime;
          break;
        }
        case '3months':
          startTime = now.getTime() - 90 * 24 * 60 * 60 * 1000;
          break;
        case '6months':
          startTime = now.getTime() - 180 * 24 * 60 * 60 * 1000;
          break;
        case '1year':
          startTime = now.getTime() - 365 * 24 * 60 * 60 * 1000;
          break;
        default:
          startTime = now.getTime() - 30 * 24 * 60 * 60 * 1000;
      }

      let earning = 0;
      let withdrawals = 0;
      let recordCount = 0;

      const accountsList = getAllAccounts();
      accountsList.forEach(account => {
        const txns = getTransactionsByAccount(account.id);
        txns.forEach(txn => {
          if (Number(txn.is_deleted) === 1) {
            return;
          }
          if (
            txn.transaction_date >= startTime &&
            (endTime === null || txn.transaction_date <= endTime)
          ) {
            recordCount++;
            const amount = Number(txn.amount) || 0;
            const isTransfer = isTransferTransaction(txn);
            if (isTransfer) {
              return;
            }
            if (amount > 0 && account.account_type === 'earning') {
              earning += amount;
            } else if (amount < 0) {
              withdrawals += Math.abs(amount);
            }
          }
        });
      });

      setFilteredEarning(earning);
      setFilteredWithdrawals(withdrawals);
      setHasRecords(recordCount > 0);
    } catch (error) {
      console.error('Failed to calculate quick period data:', error);
      setFilteredEarning(0);
      setFilteredWithdrawals(0);
      setHasRecords(false);
    }
  };

  // Calculate data for specific Month + Year
  const calculateMonthYearData = (month, year) => {
    try {
      if (month === null || year === null) {
        return;
      }

      const {startTime, endTime} = getMonthYearRange(
        month,
        year,
        monthStartDay
      );

      let earning = 0;
      let withdrawals = 0;
      let recordCount = 0;

      const accountsList = getAllAccounts();
      accountsList.forEach(account => {
        const txns = getTransactionsByAccount(account.id);
        txns.forEach(txn => {
          if (Number(txn.is_deleted) === 1) {
            return;
          }
          if (
            txn.transaction_date >= startTime &&
            txn.transaction_date <= endTime
          ) {
            recordCount++;
            const amount = Number(txn.amount) || 0;
            const isTransfer = isTransferTransaction(txn);
            if (isTransfer) {
              return;
            }
            if (amount > 0 && account.account_type === 'earning') {
              earning += amount;
            } else if (amount < 0) {
              withdrawals += Math.abs(amount);
            }
          }
        });
      });

      setFilteredEarning(earning);
      setFilteredWithdrawals(withdrawals);
      setHasRecords(recordCount > 0);
    } catch (error) {
      console.error('Failed to calculate month/year data:', error);
      setFilteredEarning(0);
      setFilteredWithdrawals(0);
      setHasRecords(false);
    }
  };

  // Update filtered data based on current selection
  const updateFilteredData = () => {
    if (selectedMonth !== null && selectedYear !== null) {
      // Month + Year selected - use them
      calculateMonthYearData(selectedMonth, selectedYear);
    } else {
      // Use Quick Period
      calculateQuickPeriodData(quickPeriod);
    }
  };

  // Handle Quick Period selection
  const handleQuickPeriodSelect = period => {
    setQuickPeriod(period);
    setSelectedMonth(null);
    setSelectedYear(null);
    setBottomSheetVisible(false);
    // Data will update via useEffect
  };

  // Handle Month selection
  const handleMonthSelect = month => {
    setSelectedMonth(month);
    setBottomSheetVisible(false);
    // Data will update via useEffect if year is also selected
  };

  // Handle Year selection
  const handleYearSelect = year => {
    setSelectedYear(year);
    setBottomSheetVisible(false);
    // Data will update via useEffect if month is also selected
  };

  const renderBottomSheetContent = () => {
    if (bottomSheetContent === 'quick') {
      return (
        <>
          <Text style={styles.bottomSheetTitle}>Select Period</Text>
          {QUICK_PERIODS.map(period => (
            <TouchableOpacity
              key={period.value}
              style={[
                styles.dropdownOption,
                quickPeriod === period.value && styles.dropdownOptionActive,
              ]}
              onPress={() => handleQuickPeriodSelect(period.value)}>
              <Text
                style={[
                  styles.dropdownOptionText,
                  quickPeriod === period.value && styles.dropdownOptionTextActive,
                ]}>
                {period.label}
              </Text>
              {quickPeriod === period.value && (
                <Icon name="checkmark" size={18} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </>
      );
    }

    if (bottomSheetContent === 'month') {
      return (
        <>
          <Text style={styles.bottomSheetTitle}>Select Month</Text>
          {selectedMonth !== null && (
            <TouchableOpacity
              style={styles.dropdownOptionClear}
              onPress={() => {
                setSelectedMonth(null);
                setBottomSheetVisible(false);
              }}>
              <Text style={styles.dropdownOptionClearText}>Clear Selection</Text>
              <Icon name="close-circle" size={18} color={colors.error} />
            </TouchableOpacity>
          )}
          {MONTHS.map(month => (
            <TouchableOpacity
              key={month.value}
              style={[
                styles.dropdownOption,
                selectedMonth === month.value && styles.dropdownOptionActive,
              ]}
              onPress={() => handleMonthSelect(month.value)}>
              <Text
                style={[
                  styles.dropdownOptionText,
                  selectedMonth === month.value &&
                    styles.dropdownOptionTextActive,
                ]}>
                {month.label}
              </Text>
              {selectedMonth === month.value && (
                <Icon name="checkmark" size={18} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </>
      );
    }

    if (bottomSheetContent === 'year') {
      return (
        <>
          <Text style={styles.bottomSheetTitle}>Select Year</Text>
          {selectedYear !== null && (
            <TouchableOpacity
              style={styles.dropdownOptionClear}
              onPress={() => {
                setSelectedYear(null);
                setBottomSheetVisible(false);
              }}>
              <Text style={styles.dropdownOptionClearText}>Clear Selection</Text>
              <Icon name="close-circle" size={18} color={colors.error} />
            </TouchableOpacity>
          )}
          {availableYears.map(year => (
            <TouchableOpacity
              key={year}
              style={[
                styles.dropdownOption,
                selectedYear === year && styles.dropdownOptionActive,
              ]}
              onPress={() => handleYearSelect(year)}>
              <Text
                style={[
                  styles.dropdownOptionText,
                  selectedYear === year && styles.dropdownOptionTextActive,
                ]}>
                {year}
              </Text>
              {selectedYear === year && (
                <Icon name="checkmark" size={18} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </>
      );
    }

    return null;
  };

  const formatCurrency = amount => {
    return `${currencySymbol} ${amount.toLocaleString('en-IN')}`;
  };

  const formatCurrencyRupee = amount => {
    const sign = amount < 0 ? '-' : '';
    const absAmount = Math.abs(amount);
    return `${sign}${currencySymbol} ${absAmount.toLocaleString('en-IN')}`;
  };

  const getSortIndexValue = (account, fallback) => {
    const value = Number(account?.sort_index);
    return Number.isFinite(value) ? value : fallback;
  };

  const moveSelectedAccount = async direction => {
    const account = selectedAccountRef.current || selectedAccount;
    if (!account) {
      return;
    }
    if (!canMoveWithinType) {
      return;
    }
    const currentIndex =
      selectedAccountIndex >= 0
        ? selectedAccountIndex
        : accounts.findIndex(
            item => String(item.id) === String(account.id)
          );
    if (currentIndex < 0) {
      return;
    }
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= accounts.length) {
      return;
    }
    const currentAccount = accounts[currentIndex];
    const targetAccount = accounts[targetIndex];
    const currentSortIndex = getSortIndexValue(currentAccount, currentIndex);
    const targetSortIndex = getSortIndexValue(targetAccount, targetIndex);
    runPinReorderAnimation();
    try {
      await updateAccountSortIndex(currentAccount.id, targetSortIndex);
      await updateAccountSortIndex(targetAccount.id, currentSortIndex);
      loadAccounts();
      showToast(
        `Account moved ${direction === 'up' ? 'up' : 'down'}`,
        'success',
        3000
      );
    } catch (error) {
      console.error('Failed to move account:', error);
      showToast('Failed to move account', 'error', 3000);
    } finally {
      closeContextMenu();
    }
  };

  const openContextMenu = account => {
    selectedAccountRef.current = account;
    setSelectedAccount(account);
    setContextMenuVisible(true);
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(contentTranslateY, {
        toValue: 0,
        tension: 65,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeContextMenu = () => {
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(contentTranslateY, {
        toValue: 300,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setContextMenuVisible(false);
      setSelectedAccount(null);
      selectedAccountRef.current = null;
    });
  };
  const handleSetPrimary = async () => {
    const account = selectedAccountRef.current || selectedAccount;
    if (!account) {
      return;
    }
    if (account.account_type !== 'earning') {
      return;
    }
    if (Number(account.is_primary) === 1) {
      closeContextMenu();
      return;
    }
    try {
      await updateAccountPrimary(account.id, true);
      showToast('Primary account updated.', 'success', 3000);
      loadAccounts();
    } catch (error) {
      console.error('Failed to update primary status:', error);
      showToast('Failed to update primary account.', 'error', 3000);
    } finally {
      closeContextMenu();
    }
  };

  const handleDeleteAccount = () => {
    const account = selectedAccountRef.current || selectedAccount;
    if (!account) return;
    const isSavingAccount = account.account_type === 'saving';
    if (isSavingAccount) {
      Alert.alert('Not Allowed', 'Saving account cannot be deleted.');
      closeContextMenu();
      return;
    }
    const isPrimaryEarning =
      account.account_type === 'earning' && Number(account.is_primary) === 1;
    if (isPrimaryEarning) {
      Alert.alert(
        'Primary Account',
        'Primary earning account cannot be deleted. Set another earning account as primary first.'
      );
      closeContextMenu();
      return;
    }
    const balance = Number(account?.balance) || 0;
    if (Math.abs(balance) > 0.000001) {
      Alert.alert(
        'Balance Not Settled',
        'This account balance is not settled. Please settle it to 0 before removing the account.'
      );
      return;
    }
    Alert.alert(
      'Delete Account',
      `Are you sure you want to delete the account "${account.account_name}"? All associated transactions will also be deleted. This action cannot be undone.`,
      [
        {text: 'Cancel', style: 'cancel', onPress: closeContextMenu},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccountAndTransactions(account.id);
              showToast('Account deleted successfully', 'success', 3000);
              loadAccounts(); // Refresh the list
            } catch (e) {
              Alert.alert('Error', 'Failed to delete account.');
            } finally {
              closeContextMenu();
            }
          },
        },
      ]
    );
  };

  const handleDeletePress = () => {
    if (deletePressGuardRef.current) {
      return;
    }
    deletePressGuardRef.current = true;
    handleDeleteAccount();
    setTimeout(() => {
      deletePressGuardRef.current = false;
    }, 400);
  };

  const openRenameModal = () => {
    const account = selectedAccountRef.current || selectedAccount;
    if (!account) return;
    setRenameTargetAccount(account);
    setNewAccountName(account?.account_name || ''); // Ensure newAccountName is always a string
    setRenameModalVisible(true);
    closeContextMenu();
  };

  const closeRenameModal = () => {
    setRenameModalVisible(false);
    setRenameTargetAccount(null);
    setNewAccountName('');
  };

  const handleSaveAccountName = async () => {
    const account = renameTargetAccount || selectedAccountRef.current || selectedAccount;
    if (!account || !newAccountName.trim()) {
      Alert.alert('Invalid Name', 'Account name cannot be empty.');
      return;
    }
    try {
      await renameAccount(account.id, newAccountName.trim());
      showToast('Account renamed successfully', 'success', 3000);
      loadAccounts(); // Refresh the list
    } catch (e) {
      Alert.alert('Error', 'Failed to rename account.');
    } finally {
      closeRenameModal();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.accountMetricsWrapper}>
          <View style={styles.accountMetricsCard}>
            <View style={styles.dropdownGrid}>
              <View style={styles.dropdownContainer}>
                <Text style={styles.dropdownLabel}>Quick Period</Text>
                <TouchableOpacity
                  style={[
                    styles.dropdown,
                    selectedMonth !== null &&
                      selectedYear !== null &&
                      styles.dropdownDisabled,
                  ]}
                  onPress={() => {
                    if (selectedMonth === null || selectedYear === null) {
                      setBottomSheetContent('quick');
                      setBottomSheetVisible(true);
                    }
                  }}
                  disabled={selectedMonth !== null && selectedYear !== null}>
                  <Text
                    style={[
                      styles.dropdownText,
                      selectedMonth !== null &&
                        selectedYear !== null &&
                        styles.dropdownTextDisabled,
                    ]}>
                    {QUICK_PERIODS.find(p => p.value === quickPeriod)?.label ||
                      'This Month'}
                  </Text>
                  <Icon
                    name="chevron-down"
                    size={16}
                    color={
                      selectedMonth !== null && selectedYear !== null
                        ? colors.text.light
                        : colors.text.secondary
                    }
                  />
                </TouchableOpacity>
              </View>
              <View style={styles.dropdownContainer}>
                <Text style={styles.dropdownLabel}>Month</Text>
                <TouchableOpacity
                  style={styles.dropdown}
                  onPress={() => {
                    setBottomSheetContent('month');
                    setBottomSheetVisible(true);
                  }}>
                  <Text style={styles.dropdownText}>
                    {selectedMonth !== null
                      ? MONTHS[selectedMonth].label
                      : 'Month'}
                  </Text>
                  <Icon
                    name="chevron-down"
                    size={16}
                    color={colors.text.secondary}
                  />
                </TouchableOpacity>
              </View>
              <View style={styles.dropdownContainer}>
                <Text style={styles.dropdownLabel}>Year</Text>
                <TouchableOpacity
                  style={styles.dropdown}
                  onPress={() => {
                    setBottomSheetContent('year');
                    setBottomSheetVisible(true);
                  }}>
                  <Text style={styles.dropdownText}>
                    {selectedYear !== null ? selectedYear : 'Year'}
                  </Text>
                  <Icon
                    name="chevron-down"
                    size={16}
                    color={colors.text.secondary}
                  />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.accountMetricsRow}>
              <View style={styles.accountMetricThird}>
                <View style={styles.accountMetricLabelRow}>
                  <View
                    style={[
                      styles.accountMetricIcon,
                      {backgroundColor: colors.white},
                    ]}>
                    <FaArrowCircleUp size={24} color={colors.success} />
                  </View>
                  <Text style={styles.accountMetricLabel}>Earning</Text>
                </View>
                <Text
                  style={[
                    styles.accountMetricValue,
                    styles.accountMetricValueIndented,
                  ]}>
                  {formatCurrencyRupee(filteredEarning)}
                </Text>
              </View>
              <View style={styles.accountMetricDivider} />
              <View style={styles.accountMetricThird}>
                <View style={styles.accountMetricLabelRow}>
                  <View
                    style={[
                      styles.accountMetricIcon,
                      {backgroundColor: colors.white},
                    ]}>
                    <FaArrowCircleDown size={24} color={colors.error} />
                  </View>
                  <Text style={styles.accountMetricLabel}>Expenses</Text>
                </View>
                <Text
                  style={[
                    styles.accountMetricValue,
                    styles.accountMetricValueIndented,
                    styles.accountMetricNegative,
                  ]}>
                  {formatCurrencyRupee(filteredWithdrawals)}
                </Text>
              </View>
              <View style={styles.accountMetricDivider} />
              <View style={styles.accountMetricThird}>
                <View style={styles.accountMetricLabelRow}>
                  <View
                    style={[
                      styles.accountMetricIcon,
                      {backgroundColor: colors.white},
                    ]}>
                    <Icon name="wallet" size={24} color="#2196F3" />
                  </View>
                  <Text style={styles.accountMetricLabel}>Net Balance</Text>
                </View>
                <Text
                  style={[
                    styles.accountMetricValue,
                    styles.accountMetricValueIndented,
                  ]}>
                  {formatCurrencyRupee(netBalance)}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}>
        {/* Earning Accounts */}
        <View style={styles.accountsSection}>
          <Text style={styles.sectionTitle}>Earning Accounts</Text>
          {accounts.length > 0 ? (
            <>
              <View style={styles.accountsList}>
                {accounts
                  .filter(account => account.account_type === 'earning')
                  .map(account => (
                    <TouchableOpacity
                      key={account.id}
                      style={styles.accountItem}
                      onPress={() => {
                        navigation.navigate('AccountDetail', {account});
                      }}
                      onLongPress={() => openContextMenu(account)}>
                      <View style={styles.badgeContainer}>
                        {account.is_primary === 1 && (
                          <View
                            style={[
                              styles.badge,
                              {backgroundColor: colors.text.light},
                            ]}>
                            <Icon name="star" size={12} color={fabExpanded ? colors.error : colors.white} />
                          </View>
                        )}
                      </View>

                      <View style={styles.accountRow}>
                        <View
                          style={[
                            styles.accountIcon,
                            {
                              backgroundColor:
                                account.icon_color || colors.successLight,
                            },
                          ]}>
                          {renderAccountIcon(
                            account.icon || 'trending-up',
                            22,
                            account.icon_color
                              ? colors.white
                              : colors.text.primary
                          )}
                        </View>

                        <View style={styles.accountDetails}>
                          <View style={styles.accountHeader}>
                            <View style={styles.accountHeaderContent}>
                              <Text style={styles.accountName}>
                                {account.account_name}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.accountBalanceRow}>
                            <Text style={styles.accountBalanceLabel}>
                              Balance{' '}
                            </Text>
                            <Text
                              style={[
                                styles.accountBalanceAmount,
                                account.icon_color && {
                                  color: account.icon_color,
                                },
                              ]}>
                              {formatCurrency(account.balance || 0)}
                            </Text>
                          </Text>
                          <Text style={styles.accountDate}>
                            Created on{' '}
                            {new Date(account.created_at).toLocaleDateString(
                              'en-IN',
                              {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              }
                            )}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
              </View>

              <View style={styles.accountsDivider} />

              <Text style={styles.sectionTitle}>Savings Accounts</Text>
              <View style={styles.accountsList}>
                {accounts
                  .filter(account => account.account_type === 'saving')
                  .map(account => (
                    <TouchableOpacity
                      key={account.id}
                      style={styles.accountItem}
                      onPress={() => {
                        navigation.navigate('ExpensesAccountDetail', {account});
                      }}
                      onLongPress={() => openContextMenu(account)}>
                      <View style={styles.badgeContainer} />

                      <View style={styles.accountRow}>
                        <View
                          style={[
                            styles.accountIcon,
                            {
                              backgroundColor:
                                account.icon_color || colors.warningLight,
                            },
                          ]}>
                          {renderAccountIcon(
                            account.icon || 'wallet',
                            22,
                            account.icon_color
                              ? colors.white
                              : colors.text.primary
                          )}
                        </View>

                        <View style={styles.accountDetails}>
                          <View style={styles.accountHeader}>
                            <View style={styles.accountHeaderContent}>
                              <Text style={styles.accountName}>
                                {account.account_name}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.accountBalanceRow}>
                            <Text style={styles.accountBalanceLabel}>
                              Balance{' '}
                            </Text>
                            <Text
                              style={[
                                styles.accountBalanceAmount,
                                account.icon_color && {
                                  color: account.icon_color,
                                },
                              ]}>
                              {formatCurrency(account.balance || 0)}
                            </Text>
                          </Text>
                          <Text style={styles.accountDate}>
                            Created on{' '}
                            {new Date(account.created_at).toLocaleDateString(
                              'en-IN',
                              {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              }
                            )}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
              </View>

              <View style={styles.accountsDivider} />

              <Text style={styles.sectionTitle}>Expenses Accounts</Text>
              <View style={styles.accountsList}>
                {accounts
                  .filter(account => account.account_type === 'expenses')
                  .map(account => (
                    <TouchableOpacity
                      key={account.id}
                      style={styles.accountItem}
                      onPress={() => {
                        navigation.navigate('ExpensesAccountDetail', {account});
                      }}
                      onLongPress={() => openContextMenu(account)}>
                      <View style={styles.badgeContainer} />

                      <View style={styles.accountRow}>
                        <View
                          style={[
                            styles.accountIcon,
                            {
                              backgroundColor:
                                account.icon_color || colors.warningLight,
                            },
                          ]}>
                          {renderAccountIcon(
                            account.icon || 'wallet',
                            22,
                            account.icon_color
                              ? colors.white
                              : colors.text.primary
                          )}
                        </View>

                        <View style={styles.accountDetails}>
                          <View style={styles.accountHeader}>
                            <View style={styles.accountHeaderContent}>
                              <Text style={styles.accountName}>
                                {account.account_name}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.accountBalanceRow}>
                            <Text style={styles.accountBalanceLabel}>
                              Balance{' '}
                            </Text>
                            <Text
                              style={[
                                styles.accountBalanceAmount,
                                account.icon_color && {
                                  color: account.icon_color,
                                },
                              ]}>
                              {formatCurrency(account.balance || 0)}
                            </Text>
                          </Text>
                          <Text style={styles.accountDate}>
                            Created on{' '}
                            {new Date(account.created_at).toLocaleDateString(
                              'en-IN',
                              {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              }
                            )}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
              </View>
            </>
          ) : (
            <View style={styles.emptyAccounts}>
              <Icon name="wallet-outline" size={48} color={colors.border} />
              <Text style={styles.emptyText}>No accounts yet</Text>
              <Text style={styles.emptySubtext}>
                Create your first account to get started
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      

      <Animated.View
        pointerEvents={fabExpanded ? 'auto' : 'none'}
        style={[
          styles.fabActions,
          {
            opacity: fabAnim,
            transform: [
              {
                translateY: fabAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [16, 0],
                }),
              },
            ],
          },
        ]}>
        <TouchableOpacity
          style={styles.fabActionRow}
          onPress={() => openAddAccount('earning')}>
          <Text style={styles.fabActionLabel}>Add Earning Account</Text>
          <View style={[styles.fabActionButton, styles.fabActionButtonEarning]}>
            <Icon name="person-add" size={20} color={colors.white} />
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.fabActionRow}
          onPress={() => openAddAccount('expenses')}>
          <Text style={styles.fabActionLabel}>Add Expenses Account</Text>
          <View style={[styles.fabActionButton, styles.fabActionButtonExpenses]}>
            <Icon name="person-add" size={20} color={colors.white} />
          </View>
        </TouchableOpacity>
      </Animated.View>
<TouchableOpacity
        ref={fabRef}
        style={[styles.fab, fabExpanded && styles.fabOpen]}
        onPress={handleAddAccountPress}>
        <Icon name={fabExpanded ? 'close' : 'person-add'} size={22} color={colors.white} />
      </TouchableOpacity>

      {/* Bottom Sheet for Period/Month/Year */}
      <BottomSheet
        visible={isBottomSheetVisible}
        onClose={() => setBottomSheetVisible(false)}>
        {renderBottomSheetContent()}
      </BottomSheet>

      {/* Context Menu Modal */}
      <Modal
        visible={contextMenuVisible}
        transparent
        animationType="none"
        onRequestClose={closeContextMenu}>
        <Animated.View
          style={[
            styles.contextMenuOverlay,
            {opacity: overlayOpacity},
          ]}>
          <TouchableOpacity
            style={styles.contextMenuOverlayTouchable}
            activeOpacity={1}
            onPress={closeContextMenu}
          />
          <Animated.View
            style={[
              styles.contextMenuContainer,
              {transform: [{translateY: contentTranslateY}]},
            ]}>
            <View style={styles.contextMenuHeader}>
              <Text style={styles.contextMenuTitle}>
                {selectedAccount?.account_name}
              </Text>
            </View>
            {canMoveWithinType && (
              <>
                <TouchableOpacity
                  style={[
                    styles.contextMenuItem,
                    isMoveUpDisabled && styles.contextMenuItemDisabled,
                  ]}
                  hitSlop={{top: 6, bottom: 6, left: 8, right: 8}}
                  disabled={isMoveUpDisabled}
                  onPress={() => moveSelectedAccount('up')}>
                  <Icon
                    name="arrow-up"
                    size={22}
                    color={
                      isMoveUpDisabled ? colors.text.light : colors.text.primary
                    }
                  />
                  <Text
                    style={[
                      styles.contextMenuItemText,
                      isMoveUpDisabled && styles.contextMenuItemTextDisabled,
                    ]}>
                    Move Up
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.contextMenuItem,
                    isMoveDownDisabled && styles.contextMenuItemDisabled,
                  ]}
                  hitSlop={{top: 6, bottom: 6, left: 8, right: 8}}
                  disabled={isMoveDownDisabled}
                  onPress={() => moveSelectedAccount('down')}>
                  <Icon
                    name="arrow-down"
                    size={22}
                    color={
                      isMoveDownDisabled
                        ? colors.text.light
                        : colors.text.primary
                    }
                  />
                  <Text
                    style={[
                      styles.contextMenuItemText,
                      isMoveDownDisabled &&
                        styles.contextMenuItemTextDisabled,
                    ]}>
                    Move Down
                  </Text>
                </TouchableOpacity>
              </>
            )}
            {selectedAccount?.account_type === 'earning' && (
              <TouchableOpacity
                style={[
                  styles.contextMenuItem,
                  Number(selectedAccount?.is_primary) === 1 &&
                    styles.contextMenuItemDisabled,
                ]}
                hitSlop={{top: 6, bottom: 6, left: 8, right: 8}}
                onPress={handleSetPrimary}
                disabled={Number(selectedAccount?.is_primary) === 1}>
                <Icon
                  name="star-outline"
                  size={22}
                  color={
                    Number(selectedAccount?.is_primary) === 1
                      ? '#10B981'
                      : colors.text.primary
                  }
                />
                <Text
                  style={[
                    styles.contextMenuItemText,
                    Number(selectedAccount?.is_primary) === 1 &&
                      styles.contextMenuItemTextSelected,
                  ]}>
                  {Number(selectedAccount?.is_primary) === 1
                    ? 'Primary Account'
                    : 'Set as Primary'}
                </Text>
                {Number(selectedAccount?.is_primary) === 1 && (
                  <Icon name="checkmark" size={18} color="#10B981" />
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.contextMenuItem}
              hitSlop={{top: 6, bottom: 6, left: 8, right: 8}}
              onPress={openRenameModal}>
              <Icon name="create-outline" size={22} color={colors.text.primary} />
              <Text style={styles.contextMenuItemText}>Rename</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.contextMenuItem}
              hitSlop={{top: 6, bottom: 6, left: 8, right: 8}}
              onPressIn={handleDeletePress}
              onPress={handleDeletePress}>
              <Icon name="trash-outline" size={22} color={colors.error} />
              <Text style={[styles.contextMenuItemText, {color: colors.error}]}>
                Delete
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.contextMenuItem}
              hitSlop={{top: 6, bottom: 6, left: 8, right: 8}}
              onPress={() => {
                Alert.alert('Personalization', 'Personalization options not yet implemented.');
                closeContextMenu();
              }}>
              <Icon name="color-palette-outline" size={22} color={colors.text.primary} />
              <Text style={styles.contextMenuItemText}>Personalization</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.contextMenuItem, styles.contextMenuItemCancel]}
              hitSlop={{top: 6, bottom: 6, left: 8, right: 8}}
              onPress={closeContextMenu}>
              <Icon name="close" size={22} color={colors.text.secondary} />
              <Text style={styles.contextMenuItemTextCancel}>Cancel</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* Rename Account Modal */}
      <Modal
        visible={renameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeRenameModal}>
        <View style={styles.renameModalOverlay}>
          <View style={styles.renameModalContainer}>
            <Text style={styles.renameModalTitle}>Rename Account</Text>
            <TextInput
              style={styles.renameModalInput}
              value={newAccountName}
              onChangeText={setNewAccountName}
              placeholder="Enter new account name"
              autoFocus
            />
            <View style={styles.renameModalButtons}>
              <TouchableOpacity
                style={[styles.renameModalButton, styles.renameModalCancelButton]}
                onPress={closeRenameModal}>
                <Text style={styles.renameModalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.renameModalButton, styles.renameModalSaveButton]}
                onPress={handleSaveAccountName}>
                <Text style={styles.renameModalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Setup Completion Popup */}
      <BottomSheet visible={showSetupPopup} onClose={handleRemindLater}>
        <View style={styles.setupSheetContent}>
          <Text style={styles.setupSheetTitle}>
            Complete your basic details
          </Text>
          <Text style={styles.setupSheetDescription}>
            Update your name and phone number to work smoothly with others.
          </Text>

          <TouchableOpacity
            style={styles.setupPrimaryButton}
            onPress={handleGoToProfile}>
            <Text style={styles.setupPrimaryButtonText}>
              Update basic details
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.setupSecondaryButton}
            onPress={handleRemindLater}>
            <Text style={styles.setupSecondaryButtonText}>Remind me later</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>

    </View>
  );
};

const cardBase = {
  backgroundColor: colors.white,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: colors.border,
  elevation: 1,
  shadowColor: colors.black,
  shadowOffset: {width: 0, height: 1},
  shadowOpacity: 0.05,
  shadowRadius: 2,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    elevation: 2,
  },
  scrollView: {
    flex: 1,
    padding: spacing.sm,
  },
  accountMetricsWrapper: {
    paddingTop: spacing.sm,
  },
  accountMetricsCard: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    padding: 0,
    marginBottom: 0,
  },
  dropdownGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  dropdownContainer: {
    flex: 1,
  },
  dropdownLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  dropdown: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownText: {
    fontSize: 13,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    flex: 1,
  },
  dropdownDisabled: {
    backgroundColor: colors.background,
    opacity: 0.6,
  },
  dropdownTextDisabled: {
    color: colors.text.light,
  },
  accountMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountMetricThird: {
    flex: 1,
  },
  accountMetricDivider: {
    width: 1,
    height: 44,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
  },
  accountMetricLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4,
  },
  accountMetricIcon: {
    width: METRIC_ICON_SIZE,
    height: METRIC_ICON_SIZE,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountMetricValueIndented: {
    textAlign: 'center',
  },
  accountMetricIconNegative: {
    backgroundColor: colors.error,
  },
  accountMetricLabel: {
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: 'left',
  },
  accountMetricValue: {
    fontSize: fontSize.large,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    textAlign: 'left',
  },
  accountMetricNegative: {
    color: colors.error,
  },

  fabActions: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg + 64,
    alignItems: 'flex-end',
  },
  fabActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  fabActionLabel: {
    marginRight: spacing.sm,
    fontSize: fontSize.medium,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: 12,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  fabActionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  fabActionButtonEarning: {
    backgroundColor: '#22C55E',
  },
  fabActionButtonExpenses: {
    backgroundColor: colors.primary,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  fabOpen: {
    backgroundColor: colors.error,
  },
  // Accounts Section
  accountsSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: 8,
  },
  accountsList: {
    ...cardBase, // Apply cardBase
    overflow: 'hidden', // Keep specific overflow property
  },
  accountsDivider: {
    height: spacing.lg,
  },
  accountItem: {
    position: 'relative',
    flexDirection: 'column',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'stretch',
  },
  accountRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  accountIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  accountDetails: {
    flex: 1,
    minWidth: 0,
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  accountHeaderContent: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
    marginRight: 8,
  },
  accountName: {
    fontSize: 16,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    flexShrink: 1,
  },
  accountBalanceRow: {
    marginBottom: 2,
  },
  accountBalanceLabel: {
    fontSize: 12,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
  },
  accountBalanceAmount: {
    fontSize: 18,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  accountDate: {
    fontSize: 11,
    color: colors.text.secondary,
  },
  badgeContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    gap: 4,
    zIndex: 10,
  },
  badge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Empty State
  emptyAccounts: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 4,
    textAlign: 'center',
  },
  // No Records Container
  noRecordsContainer: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    marginBottom: spacing.md,
    alignItems: 'center',
    elevation: 1,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  noRecordsText: {
    fontSize: fontSize.medium,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginTop: 12,
  },
  noRecordsSubtext: {
    fontSize: fontSize.small,
    color: colors.text.secondary,
    marginTop: 4,
  },
  // Dropdown Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  dropdownModal: {
    backgroundColor: colors.white,
    borderRadius: 12,
    width: '100%',
    maxWidth: 320,
    maxHeight: 400,
    elevation: 8,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  dropdownModalScrollable: {
    backgroundColor: colors.white,
    borderRadius: 12,
    width: '100%',
    maxWidth: 320,
    maxHeight: 400,
    elevation: 8,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownOptionActive: {
    backgroundColor: colors.primaryLight,
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
  bottomSheetTitle: {
    fontSize: fontSize.large,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  dropdownOptionClear: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.errorLight,
    borderBottomWidth: 1,
    borderBottomColor: colors.error,
  },
  dropdownOptionClearText: {
    fontSize: fontSize.medium,
    color: colors.error,
    fontWeight: fontWeight.semibold,
  },
  // Context Menu Styles
  contextMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  contextMenuOverlayTouchable: {
    flex: 1,
  },
  contextMenuContainer: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: spacing.lg,
    elevation: 10,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: -4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  contextMenuHeader: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  contextMenuTitle: {
    fontSize: fontSize.large,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    textAlign: 'center',
  },
  contextMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: 12,
  },
  contextMenuItemDisabled: {
    opacity: 0.45,
  },
  contextMenuItemText: {
    fontSize: fontSize.regular,
    color: colors.text.primary,
    fontWeight: fontWeight.medium,
  },
  contextMenuItemTextSelected: {
    color: '#10B981',
    fontWeight: fontWeight.semibold,
  },
  contextMenuItemTextDisabled: {
    color: colors.text.light,
  },
  contextMenuItemCancel: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
  },
  contextMenuItemTextCancel: {
    fontSize: fontSize.regular,
    color: colors.text.secondary,
    fontWeight: fontWeight.medium,
  },
  // Rename Modal
  renameModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  renameModalContainer: {
    width: '90%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: spacing.lg,
    elevation: 10,
  },
  renameModalTitle: {
    fontSize: fontSize.large,
    fontWeight: 'bold',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  renameModalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.lg,
    fontSize: fontSize.regular,
  },
  renameModalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  renameModalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  renameModalSaveButton: {
    backgroundColor: colors.primary,
  },
  renameModalButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  renameModalCancelButton: {
    backgroundColor: colors.border,
  },
  renameModalCancelButtonText: {
    color: colors.text.primary,
    fontWeight: 'bold',
  },
  setupSheetContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  setupSheetTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  setupSheetDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 20,
  },
  setupPrimaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  setupPrimaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  setupSecondaryButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  setupSecondaryButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default DashboardScreen;

