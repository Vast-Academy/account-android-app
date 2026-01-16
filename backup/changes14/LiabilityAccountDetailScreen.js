import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  Animated,
  Easing,
  Keyboard,
  InteractionManager,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {colors, spacing, fontSize, fontWeight} from '../utils/theme';
import BottomSheet from '../components/BottomSheet';
import {useUniversalToast} from '../hooks/useToast';
import {
  initTransactionsDatabase,
  createTransaction,
  getTransactionsByAccount,
  calculateAccountBalance,
  deleteTransactionsByAccount,
} from '../services/transactionsDatabase';
import {
  deleteAccount,
  getAccountsByType,
  getPrimaryEarningAccount,
  renameAccount,
} from '../services/accountsDatabase';

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

const METRIC_ICON_SIZE = 28;
const METRIC_LABEL_GAP = 6;
const METRIC_LABEL_OFFSET = METRIC_ICON_SIZE + METRIC_LABEL_GAP;
const LOW_BALANCE_PREF_KEY = 'liabilityLowBalancePref';

const withAlpha = (hex, alpha) => {
  if (!hex || typeof hex !== 'string') {
    return hex;
  }
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) {
    return hex;
  }
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const tintWithWhite = (hex, whiteRatio = 0.94) => {
  if (!hex || typeof hex !== 'string') {
    return hex;
  }
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) {
    return hex;
  }
  const ratio = Math.min(1, Math.max(0, whiteRatio));
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  const mix = channel => Math.round(255 * ratio + channel * (1 - ratio));
  const toHex = value => value.toString(16).padStart(2, '0');
  return `#${toHex(mix(red))}${toHex(mix(green))}${toHex(mix(blue))}`;
};

const LiabilityAccountDetailScreen = ({route, navigation}) => {
  const account = route?.params?.account || {
    id: null,
    account_name: '',
    is_primary: 0,
  };

  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawNote, setWithdrawNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [requestModalVisible, setRequestModalVisible] = useState(false);
  const [requestSelectVisible, setRequestSelectVisible] = useState(false);
  const [requestAmount, setRequestAmount] = useState('');
  const [requestNote, setRequestNote] = useState('');
  const [requestAccounts, setRequestAccounts] = useState([]);
  const [requestTarget, setRequestTarget] = useState(null);
  const [requestFieldHeight, setRequestFieldHeight] = useState(0);
  const [requestAccountWidth, setRequestAccountWidth] = useState(0);
  const [menuVisible, setMenuVisible] = useState(false);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [lowBalancePromptVisible, setLowBalancePromptVisible] = useState(false);
  const [rememberLowBalanceChoice, setRememberLowBalanceChoice] = useState(false);
  const [lowBalancePreference, setLowBalancePreference] = useState(null);
  const [pendingWithdrawAmount, setPendingWithdrawAmount] = useState(null);
  const [pendingWithdrawTotal, setPendingWithdrawTotal] = useState(null);
  const [primaryEarningAccount, setPrimaryEarningAccount] = useState(null);
  const [quickPeriod, setQuickPeriod] = useState('1month');
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [isBottomSheetVisible, setBottomSheetVisible] = useState(false);
  const [bottomSheetContent, setBottomSheetContent] = useState(null);
  const [availableYears, setAvailableYears] = useState([]);
  const [filteredAdded, setFilteredAdded] = useState(0);
  const [filteredWithdrawals, setFilteredWithdrawals] = useState(0);
  const [monthStartDay, setMonthStartDay] = useState(DEFAULT_MONTH_START_DAY);
  const {showUniversalToast} = useUniversalToast();
  const scrollViewRef = useRef(null);
  const requestAmountInputRef = useRef(null);
  const withdrawAmountInputRef = useRef(null);
  const modalSlideAnim = useRef(new Animated.Value(0)).current;
  const menuOverlayOpacity = useRef(new Animated.Value(0)).current;
  const menuContentTranslateY = useRef(new Animated.Value(300)).current;

  const loadTransactions = useCallback(() => {
    if (!account.id) {
      setTransactions([]);
      setTotalBalance(0);
      return;
    }
    try {
      const txns = getTransactionsByAccount(account.id);
      setTransactions(txns);

      const balance = calculateAccountBalance(account.id);
      setTotalBalance(balance);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    }
  }, [account.id]);

  useEffect(() => {
    initTransactionsDatabase();
    loadTransactions();
    loadMonthStartDay();
  }, [loadTransactions]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadMonthStartDay();
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (!scrollViewRef.current) {
      return;
    }
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({animated: true});
    });
  }, [transactions]);

  useEffect(() => {
    const years = new Set();
    transactions.forEach(txn => {
      const year = new Date(txn.transaction_date).getFullYear();
      years.add(year);
    });
    setAvailableYears(Array.from(years).sort((a, b) => b - a));
  }, [transactions]);

  useEffect(() => {
    if (!account?.id) {
      setLowBalancePreference(null);
      return;
    }
    let isActive = true;
    AsyncStorage.getItem(`${LOW_BALANCE_PREF_KEY}:${account.id}`)
      .then(value => {
        if (!isActive) {
          return;
        }
        if (value === 'auto' || value === 'never') {
          setLowBalancePreference(value);
        } else {
          setLowBalancePreference(null);
        }
      })
      .catch(error => {
        console.error('Failed to load low balance preference:', error);
      });
    return () => {
      isActive = false;
    };
  }, [account?.id]);

  useEffect(() => {
    if (withdrawModalVisible || requestModalVisible || renameModalVisible) {
      Animated.timing(modalSlideAnim, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      modalSlideAnim.setValue(0);
    }
  }, [
    withdrawModalVisible,
    requestModalVisible,
    renameModalVisible,
    modalSlideAnim,
  ]);

  useEffect(() => {
    if (!requestModalVisible) {
      setRequestSelectVisible(false);
      return;
    }
    try {
      const earningAccounts = getAccountsByType('earning');
      setRequestAccounts(earningAccounts);
      if (earningAccounts.length === 0) {
        setRequestTarget(null);
        return;
      }
      setRequestTarget(current =>
        current && earningAccounts.some(item => item.id === current.id)
          ? current
          : earningAccounts[0]
      );
    } catch (error) {
      console.error('Failed to load earning accounts:', error);
      setRequestAccounts([]);
      setRequestTarget(null);
    }
  }, [requestModalVisible]);

  const focusWithdrawAmountInput = useCallback(() => {
    const focus = () => withdrawAmountInputRef.current?.focus();
    Keyboard.dismiss();
    focus();
    requestAnimationFrame(focus);
    InteractionManager.runAfterInteractions(focus);
    setTimeout(focus, 300);
    setTimeout(focus, 600);
  }, []);

  const focusRequestAmountInput = useCallback(() => {
    const focus = () => requestAmountInputRef.current?.focus();
    Keyboard.dismiss();
    focus();
    requestAnimationFrame(focus);
    InteractionManager.runAfterInteractions(focus);
    setTimeout(focus, 300);
    setTimeout(focus, 600);
  }, []);

  useEffect(() => {
    if (!withdrawModalVisible) {
      return;
    }
    const timer = setTimeout(() => {
      focusWithdrawAmountInput();
    }, 250);
    return () => clearTimeout(timer);
  }, [withdrawModalVisible, focusWithdrawAmountInput]);

  useEffect(() => {
    if (!requestModalVisible) {
      return;
    }
    const timer = setTimeout(() => {
      focusRequestAmountInput();
    }, 250);
    return () => clearTimeout(timer);
  }, [requestModalVisible, focusRequestAmountInput]);

  const openAccountMenu = () => {
    setMenuVisible(true);
    menuOverlayOpacity.setValue(0);
    menuContentTranslateY.setValue(300);
    requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(menuOverlayOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(menuContentTranslateY, {
          toValue: 0,
          tension: 65,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const closeAccountMenu = () => {
    Animated.parallel([
      Animated.timing(menuOverlayOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(menuContentTranslateY, {
        toValue: 300,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setMenuVisible(false);
    });
  };

  const openRenameModal = () => {
    setNewAccountName(account.account_name || '');
    setRenameModalVisible(true);
  };

  const closeRenameModal = () => {
    setRenameModalVisible(false);
    setNewAccountName('');
  };

  const handleSaveAccountName = async () => {
    if (!account?.id || !newAccountName.trim()) {
      Alert.alert('Invalid Name', 'Account name cannot be empty.');
      return;
    }
    setLoading(true);
    try {
      await renameAccount(account.id, newAccountName.trim());
      navigation.setParams({
        account: {
          ...account,
          account_name: newAccountName.trim(),
        },
      });
      showUniversalToast('Account renamed successfully', 'success');
      closeRenameModal();
    } catch (error) {
      console.error('Failed to rename account:', error);
      Alert.alert('Error', 'Failed to rename account.');
    } finally {
      setLoading(false);
    }
  };

  const requestFromPrimaryEarning = async (
    amountValue,
    note,
    {finalizeWithdrawal = false, withdrawalAmount = null} = {}
  ) => {
    const primary = getPrimaryEarningAccount();
    if (!primary) {
      Alert.alert(
        'No Primary Account',
        'Please set a primary earning account first.'
      );
      return false;
    }
    setPrimaryEarningAccount(primary);
    setLoading(true);
    try {
      const earningBalance = calculateAccountBalance(primary.id);
      if (earningBalance < amountValue) {
        showUniversalToast(
          `Low balance on ${primary.account_name}.`,
          'error'
        );
        return false;
      }
      const trimmedNote = String(note || '').trim();
      const fromRemark = trimmedNote
        ? `Requested by ${account.account_name} - ${trimmedNote}`
        : `Requested by ${account.account_name}`;
      const toRemark = trimmedNote
        ? `Requested from ${primary.account_name} - ${trimmedNote}`
        : `Requested from ${primary.account_name}`;
      await createTransaction(primary.id, -amountValue, fromRemark);
      await createTransaction(account.id, amountValue, toRemark);
      if (finalizeWithdrawal) {
        const withdrawalRemark = String(note || '').trim();
        const finalAmount =
          withdrawalAmount !== null ? withdrawalAmount : amountValue;
        await createTransaction(account.id, -finalAmount, withdrawalRemark);
      }
      setWithdrawAmount('');
      setWithdrawNote('');
      loadTransactions();
      showUniversalToast(
        `Amount requested from ${primary.account_name}.`,
        'success'
      );
      return true;
    } catch (error) {
      console.error('Failed to request amount:', error);
      Alert.alert('Error', 'Failed to request amount. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const saveLowBalancePreference = async value => {
    if (!account?.id) {
      return;
    }
    try {
      await AsyncStorage.setItem(
        `${LOW_BALANCE_PREF_KEY}:${account.id}`,
        value
      );
      setLowBalancePreference(value);
    } catch (error) {
      console.error('Failed to save low balance preference:', error);
    }
  };

  const closeLowBalancePrompt = () => {
    setLowBalancePromptVisible(false);
    setPendingWithdrawAmount(null);
    setPendingWithdrawTotal(null);
  };

  const handleLowBalancePromptYes = async () => {
    if (!pendingWithdrawAmount) {
      closeLowBalancePrompt();
      return;
    }
    if (rememberLowBalanceChoice) {
      await saveLowBalancePreference('auto');
    }
    const success = await requestFromPrimaryEarning(
      pendingWithdrawAmount,
      withdrawNote,
      {
        finalizeWithdrawal: true,
        withdrawalAmount:
          pendingWithdrawTotal !== null
            ? pendingWithdrawTotal
            : pendingWithdrawAmount,
      }
    );
    closeLowBalancePrompt();
    if (success) {
      setWithdrawModalVisible(false);
    }
  };

  const handleLowBalancePromptNo = async () => {
    if (rememberLowBalanceChoice) {
      await saveLowBalancePreference('never');
    }
    closeLowBalancePrompt();
    showUniversalToast(`Low balance on ${account.account_name}.`, 'error');
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return false;
    }

    const amountValue = Math.abs(parseFloat(withdrawAmount));
    if (amountValue > totalBalance) {
      const shortfall = Math.max(0, amountValue - totalBalance);
      if (lowBalancePreference === 'never') {
        showUniversalToast(`Low balance on ${account.account_name}.`, 'error');
        return false;
      }
      if (lowBalancePreference === 'auto') {
        const success = await requestFromPrimaryEarning(
          shortfall,
          withdrawNote,
          {finalizeWithdrawal: true, withdrawalAmount: amountValue}
        );
        if (success) {
          setWithdrawModalVisible(false);
        }
        return success;
      }
      const primary = getPrimaryEarningAccount();
      if (!primary) {
        Alert.alert(
          'No Primary Account',
          'Please set a primary earning account first.'
        );
        return false;
      }
      setPrimaryEarningAccount(primary);
      setPendingWithdrawAmount(shortfall);
      setPendingWithdrawTotal(amountValue);
      setRememberLowBalanceChoice(false);
      setLowBalancePromptVisible(true);
      return false;
    }

    setLoading(true);
    try {
      const remark = withdrawNote.trim();
      await createTransaction(account.id, -amountValue, remark);
      showUniversalToast('Withdrawal recorded.', 'success');
      setWithdrawAmount('');
      setWithdrawNote('');
      loadTransactions();
      return true;
    } catch (error) {
      console.error('Failed to add withdrawal:', error);
      Alert.alert('Error', 'Failed to add entry. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleRequestStart = async () => {
    if (!requestAmount || parseFloat(requestAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return false;
    }

    const amountValue = Math.abs(parseFloat(requestAmount));
    if (!requestAccounts || requestAccounts.length === 0) {
      Alert.alert('No Accounts', 'No earning accounts available for request.');
      return false;
    }

    if (!requestTarget) {
      Alert.alert('Select Account', 'Please select an earning account.');
      return false;
    }

    await handleRequestFromAccount(requestTarget, amountValue);
    return true;
  };

  const handleRequestFromAccount = async (earningAccount, amountValue) => {
    if (!earningAccount || !amountValue) {
      return;
    }
    setLoading(true);
    try {
      const earningBalance = calculateAccountBalance(earningAccount.id);
      if (earningBalance < amountValue) {
        showUniversalToast(
          `Low balance on ${earningAccount.account_name}.`,
          'error'
        );
        return;
      }

      const trimmedNote = requestNote.trim();
      const fromRemark = trimmedNote
        ? `Requested by ${account.account_name} - ${trimmedNote}`
        : `Requested by ${account.account_name}`;
      const toRemark = trimmedNote
        ? `Requested from ${earningAccount.account_name} - ${trimmedNote}`
        : `Requested from ${earningAccount.account_name}`;
      await createTransaction(earningAccount.id, -amountValue, fromRemark);
      await createTransaction(account.id, amountValue, toRemark);
      setRequestAmount('');
      setRequestNote('');
      setRequestSelectVisible(false);
      loadTransactions();
      showUniversalToast(
        `Amount requested from ${earningAccount.account_name}.`,
        'success'
      );
    } catch (error) {
      console.error('Failed to request amount:', error);
      Alert.alert('Error', 'Failed to request amount. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = value => {
    return `\u20B9 ${value.toLocaleString('en-IN')}`;
  };

  const formatDateLabel = timestamp => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTimeLabel = timestamp => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const calculateQuickPeriodData = period => {
    const now = new Date();
    let startTime = now.getTime() - 30 * 24 * 60 * 60 * 1000;
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

    let added = 0;
    let withdrawals = 0;

    transactions.forEach(txn => {
      if (
        txn.transaction_date >= startTime &&
        (endTime === null || txn.transaction_date <= endTime)
      ) {
        const amount = Number(txn.amount) || 0;
        if (amount > 0) {
          added += amount;
        } else if (amount < 0) {
          withdrawals += Math.abs(amount);
        }
      }
    });

    setFilteredAdded(added);
    setFilteredWithdrawals(withdrawals);
  };

  const calculateMonthYearData = (month, year) => {
    if (month === null || year === null) {
      return;
    }

    const {startTime, endTime} = getMonthYearRange(
      month,
      year,
      monthStartDay
    );
    let added = 0;
    let withdrawals = 0;

    transactions.forEach(txn => {
      if (
        txn.transaction_date >= startTime &&
        txn.transaction_date <= endTime
      ) {
        const amount = Number(txn.amount) || 0;
        if (amount > 0) {
          added += amount;
        } else if (amount < 0) {
          withdrawals += Math.abs(amount);
        }
      }
    });

    setFilteredAdded(added);
    setFilteredWithdrawals(withdrawals);
  };

  const updateFilteredData = () => {
    if (selectedMonth !== null && selectedYear !== null) {
      calculateMonthYearData(selectedMonth, selectedYear);
    } else {
      calculateQuickPeriodData(quickPeriod);
    }
  };

  const handleQuickPeriodSelect = period => {
    setQuickPeriod(period);
    setSelectedMonth(null);
    setSelectedYear(null);
    setBottomSheetVisible(false);
  };

  const handleMonthSelect = month => {
    setSelectedMonth(month);
    setBottomSheetVisible(false);
  };

  const handleYearSelect = year => {
    setSelectedYear(year);
    setBottomSheetVisible(false);
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
                styles.periodDropdownOption,
                quickPeriod === period.value && styles.periodDropdownOptionActive,
              ]}
              onPress={() => handleQuickPeriodSelect(period.value)}>
              <Text
                style={[
                  styles.periodDropdownOptionText,
                  quickPeriod === period.value &&
                    styles.periodDropdownOptionTextActive,
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
              style={styles.periodDropdownOptionClear}
              onPress={() => {
                setSelectedMonth(null);
                setBottomSheetVisible(false);
              }}>
              <Text style={styles.periodDropdownOptionClearText}>
                Clear Selection
              </Text>
              <Icon name="close-circle" size={18} color="#EF4444" />
            </TouchableOpacity>
          )}
          {MONTHS.map(month => (
            <TouchableOpacity
              key={month.value}
              style={[
                styles.periodDropdownOption,
                selectedMonth === month.value &&
                  styles.periodDropdownOptionActive,
              ]}
              onPress={() => handleMonthSelect(month.value)}>
              <Text
                style={[
                  styles.periodDropdownOptionText,
                  selectedMonth === month.value &&
                    styles.periodDropdownOptionTextActive,
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
              style={styles.periodDropdownOptionClear}
              onPress={() => {
                setSelectedYear(null);
                setBottomSheetVisible(false);
              }}>
              <Text style={styles.periodDropdownOptionClearText}>
                Clear Selection
              </Text>
              <Icon name="close-circle" size={18} color="#EF4444" />
            </TouchableOpacity>
          )}
          {availableYears.map(year => (
            <TouchableOpacity
              key={year}
              style={[
                styles.periodDropdownOption,
                selectedYear === year && styles.periodDropdownOptionActive,
              ]}
              onPress={() => handleYearSelect(year)}>
              <Text
                style={[
                  styles.periodDropdownOptionText,
                  selectedYear === year &&
                    styles.periodDropdownOptionTextActive,
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

  useEffect(() => {
    updateFilteredData();
  }, [quickPeriod, selectedMonth, selectedYear, transactions, monthStartDay]);

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

  const renderTransactions = () => {
    if (transactions.length === 0) {
      return (
        <View style={styles.emptyHistory}>
          <Icon name="receipt-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyText}>No transactions yet</Text>
        </View>
      );
    }

    let lastDateKey = '';
    let runningBalance = 0;

    return (
      <View style={styles.chatList}>
        {transactions.map(txn => {
          const dateKey = new Date(txn.transaction_date).toDateString();
          const showDate = dateKey !== lastDateKey;
          lastDateKey = dateKey;

          const balanceAfter = runningBalance + (Number(txn.amount) || 0);
          runningBalance = balanceAfter;
          const isDebit = Number(txn.amount) < 0;

          return (
            <View key={txn.id}>
              {showDate && (
                <View style={styles.datePill}>
                  <Text style={styles.datePillText}>
                    {formatDateLabel(txn.transaction_date)}
                  </Text>
                </View>
              )}
              <View style={[styles.chatRow, isDebit && styles.chatRowDebit]}>
                <View style={[styles.chatBubble, isDebit && styles.chatBubbleDebit]}>
                  <View style={styles.chatHeader}>
                    <View
                      style={[
                        styles.chatIcon,
                        isDebit && styles.chatIconDebit,
                      ]}>
                      <Icon
                        name={isDebit ? 'arrow-down' : 'arrow-up'}
                        size={16}
                        color={isDebit ? '#EF4444' : '#10B981'}
                      />
                    </View>
                    <Text style={[styles.chatAmount, isDebit && styles.chatAmountDebit]}>
                      {(isDebit ? '-' : '+') +
                        formatCurrency(Math.abs(Number(txn.amount) || 0))}
                    </Text>
                    <Text style={styles.chatTime}>
                      {formatTimeLabel(txn.transaction_date)}
                    </Text>
                  </View>
                  {txn.remark ? (
                    <Text style={styles.chatRemark}>{txn.remark}</Text>
                  ) : null}
                </View>
                <View style={[styles.chatMeta, isDebit && styles.chatMetaDebit]}>
                  <Text style={styles.chatBalance}>
                    {formatCurrency(balanceAfter)}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View
      style={[
        styles.container,
        account.icon_color && {
          backgroundColor: tintWithWhite(account.icon_color, 0.94),
        },
      ]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          account.icon_color && {
            borderBottomColor: withAlpha(account.icon_color, 0.3),
          },
        ]}>
        <View style={styles.headerTopRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
          <Text
            style={[
              styles.headerTitle,
              account.icon_color && {color: account.icon_color},
            ]}>
            {account.account_name}
          </Text>
        <TouchableOpacity onPress={openAccountMenu} style={styles.menuButton}>
          <Icon name="ellipsis-vertical" size={22} color={colors.text.primary} />
        </TouchableOpacity>
        </View>
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
                    size={14}
                    color={
                      selectedMonth !== null && selectedYear !== null
                        ? '#9CA3AF'
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
                      : 'Select'}
                  </Text>
                  <Icon
                    name="chevron-down"
                    size={14}
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
                    {selectedYear !== null ? selectedYear : 'Select'}
                  </Text>
                  <Icon
                    name="chevron-down"
                    size={14}
                    color={colors.text.secondary}
                  />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.accountMetricsRow}>
              <View style={styles.accountMetricHalf}>
                <View style={styles.accountMetricLabelRow}>
                  <Text style={styles.accountMetricLabel}>Added</Text>
                </View>
                <Text
                  style={[
                    styles.accountMetricValue,
                    account.icon_color && {color: account.icon_color},
                  ]}>
                  {formatCurrency(filteredAdded)}
                </Text>
              </View>
              <View style={styles.accountMetricDivider} />
              <View style={styles.accountMetricHalf}>
                <View style={styles.accountMetricLabelRow}>
                  <Text style={styles.accountMetricLabel}>Withdrawals</Text>
                </View>
                <Text
                  style={[
                    styles.accountMetricValue,
                    styles.accountMetricNegative,
                  ]}>
                  {formatCurrency(filteredWithdrawals)}
                </Text>
              </View>
              <View style={styles.accountMetricDivider} />
              <View style={styles.accountMetricHalf}>
                <View style={styles.accountMetricLabelRow}>
                  <Text style={styles.accountMetricLabel}>Balance</Text>
                </View>
                <Text
                  style={[
                    styles.accountMetricValue,
                    account.icon_color && {color: account.icon_color},
                  ]}>
                  {formatCurrency(totalBalance)}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({animated: false})}>
        {/* Transaction History */}
        <View style={styles.historySection}>{renderTransactions()}</View>
      </ScrollView>

      <Modal
        visible={lowBalancePromptVisible}
        transparent
        animationType="fade"
        onRequestClose={closeLowBalancePrompt}>
        <View style={styles.promptOverlay}>
          <View style={styles.promptCard}>
            <Text style={styles.promptTitle}>Low balance</Text>
            <Text style={styles.promptMessage}>
              Balance is low in{' '}
              <Text
                style={[
                  styles.promptAccountName,
                  account.icon_color && {color: account.icon_color},
                ]}>
                {account.account_name}
              </Text>
              . Request {formatCurrency(pendingWithdrawAmount || 0)} from{' '}
              <Text
                style={[
                  styles.promptAccountName,
                  primaryEarningAccount?.icon_color && {
                    color: primaryEarningAccount.icon_color,
                  },
                ]}>
                {primaryEarningAccount?.account_name || 'primary account'}
              </Text>
              ?
            </Text>
            <TouchableOpacity
              style={styles.promptRemember}
              onPress={() =>
                setRememberLowBalanceChoice(current => !current)
              }>
              <View
                style={[
                  styles.promptCheckbox,
                  rememberLowBalanceChoice && styles.promptCheckboxChecked,
                ]}>
                {rememberLowBalanceChoice && (
                  <Icon name="checkmark" size={14} color={colors.white} />
                )}
              </View>
              <Text style={styles.promptRememberText}>
                Remember my choice for this account
              </Text>
            </TouchableOpacity>
            <View style={styles.promptActions}>
              <TouchableOpacity
                style={[styles.promptButton, styles.promptButtonSecondary]}
                onPress={handleLowBalancePromptNo}>
                <Text style={styles.promptButtonTextSecondary}>No</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.promptButton, styles.promptButtonPrimary]}
                onPress={handleLowBalancePromptYes}>
                <Text style={styles.promptButtonTextPrimary}>Yes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bottom Fixed Section */}
      <View
        style={[
          styles.bottomSection,
          account.icon_color && {
            borderTopColor: withAlpha(account.icon_color, 0.3),
          },
        ]}>
        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.receivedButton}
            onPress={() => setWithdrawModalVisible(true)}>
            <Icon name="arrow-down" size={20} color="#EF4444" />
            <Text style={styles.receivedButtonText}>Withdraw</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.givenButton}
            onPress={() => setRequestModalVisible(true)}>
            <Icon name="arrow-up" size={20} color="#10B981" />
            <Text style={styles.givenButtonText}>Request Amount</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={withdrawModalVisible}
        transparent
        animationType="none"
        onRequestClose={() => {
          setWithdrawModalVisible(false);
          setWithdrawNote('');
        }}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => {
              setWithdrawModalVisible(false);
              setWithdrawNote('');
            }}
          />
          <Animated.View
            style={[
              styles.modalSheet,
              {
                transform: [
                  {
                    translateY: modalSlideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [260, 0],
                    }),
                  },
                ],
              },
            ]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Withdraw</Text>
            <TextInput
              style={styles.modalAmountInput}
              value={withdrawAmount}
              onChangeText={setWithdrawAmount}
              keyboardType="numeric"
              autoFocus
              ref={withdrawAmountInputRef}
              showSoftInputOnFocus
              editable={!loading}
            />
            <Text style={styles.modalNoteLabel}>Note (Optional)</Text>
            <TextInput
              style={styles.modalNoteInput}
              value={withdrawNote}
              onChangeText={setWithdrawNote}
              placeholder="Add a note"
              placeholderTextColor={colors.text.light}
              multiline
              numberOfLines={3}
              editable={!loading}
            />
            <TouchableOpacity
              style={[
                styles.modalAddButton,
                account.icon_color && {backgroundColor: account.icon_color},
                loading && styles.buttonDisabled,
              ]}
              onPress={async () => {
                const didAdd = await handleWithdraw();
                if (didAdd) {
                  setWithdrawModalVisible(false);
                }
              }}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.modalAddButtonText}>Withdraw</Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      <Modal
        visible={requestModalVisible}
        transparent
        animationType="none"
        onRequestClose={() => {
          setRequestModalVisible(false);
          setRequestNote('');
        }}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => {
              setRequestModalVisible(false);
              setRequestNote('');
            }}
          />
          <Animated.View
            style={[
              styles.modalSheet,
              {
                transform: [
                  {
                    translateY: modalSlideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [260, 0],
                    }),
                  },
                ],
              },
            ]}>
            {requestSelectVisible && (
              <Pressable
                style={styles.transferDismissOverlay}
                onPress={() => setRequestSelectVisible(false)}
              />
            )}
            <View style={styles.modalContent}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Request Amount</Text>
              <View style={styles.amountFieldWrapper}>
                <View
                  style={styles.amountFieldRow}
                  onLayout={event =>
                    setRequestFieldHeight(event.nativeEvent.layout.height)
                  }>
                  <TextInput
                    style={styles.amountInputBare}
                    value={requestAmount}
                    onChangeText={setRequestAmount}
                    keyboardType="numeric"
                    autoFocus
                    ref={requestAmountInputRef}
                    showSoftInputOnFocus
                    editable={!loading}
                  />
                  <View style={styles.amountFieldDivider} />
                  <TouchableOpacity
                    style={styles.amountAccountButton}
                    onPress={() =>
                      setRequestSelectVisible(current => !current)
                    }
                    onLayout={event =>
                      setRequestAccountWidth(event.nativeEvent.layout.width)
                    }
                    disabled={requestAccounts.length === 0}>
                    <Text
                      style={[
                        styles.amountAccountText,
                        requestTarget?.icon_color && {
                          color: requestTarget.icon_color,
                        },
                      ]}
                      numberOfLines={1}>
                      {requestTarget?.account_name ||
                        (requestAccounts.length
                          ? 'Select account'
                          : 'No accounts')}
                    </Text>
                    <Icon
                      name="chevron-down"
                      size={16}
                      color={colors.text.secondary}
                    />
                  </TouchableOpacity>
                </View>
                {requestSelectVisible && (
                  <View
                    style={[
                      styles.floatingAccountList,
                      {
                        bottom: requestFieldHeight + 6,
                        right: 0,
                        width: requestAccountWidth || 140,
                      },
                    ]}>
                    <ScrollView
                      style={styles.floatingAccountScroll}
                      showsVerticalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled">
                      {requestAccounts.map(item => {
                        const isSelected = requestTarget?.id === item.id;
                        const itemColor =
                          item.icon_color || colors.text.primary;
                        return (
                          <TouchableOpacity
                            key={item.id}
                            style={[
                              styles.floatingAccountItem,
                              isSelected && styles.floatingAccountItemSelected,
                            ]}
                            onPress={() => {
                              setRequestTarget(item);
                              setRequestSelectVisible(false);
                            }}>
                            <Text
                              style={[
                                styles.floatingAccountText,
                                {color: itemColor},
                                isSelected && styles.floatingAccountTextSelected,
                              ]}>
                              {item.account_name}
                            </Text>
                            {isSelected && (
                              <Icon
                                name="checkmark-circle"
                                size={16}
                                color={itemColor}
                              />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>
              <Text style={styles.modalNoteLabel}>Note (Optional)</Text>
              <TextInput
                style={styles.modalNoteInput}
                value={requestNote}
                onChangeText={setRequestNote}
                placeholder="Add a note"
                placeholderTextColor={colors.text.light}
                multiline
                numberOfLines={3}
                editable={!loading}
              />
              <TouchableOpacity
                style={[
                  styles.modalAddButton,
                  account.icon_color && {backgroundColor: account.icon_color},
                  loading && styles.buttonDisabled,
                ]}
                onPress={async () => {
                  const didOpen = await handleRequestStart();
                  if (didOpen) {
                    setRequestModalVisible(false);
                  }
                }}
                disabled={loading}>
                {loading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.modalAddButtonText}>Request</Text>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      <Modal
        visible={menuVisible}
        transparent
        animationType="none"
        onRequestClose={closeAccountMenu}>
        <Animated.View
          style={[
            styles.optionsOverlay,
            {opacity: menuOverlayOpacity},
          ]}>
          <TouchableOpacity
            style={styles.optionsOverlayTouchable}
            activeOpacity={1}
            onPress={closeAccountMenu}
          />
          <Animated.View
            style={[
              styles.optionsContainer,
              {transform: [{translateY: menuContentTranslateY}]},
            ]}>
            <View style={styles.optionsHeader}>
              <Text style={styles.optionsTitle}>{account.account_name}</Text>
            </View>
            <TouchableOpacity
              style={styles.optionButton}
              onPress={() => {
                closeAccountMenu();
                openRenameModal();
              }}>
              <View style={styles.optionItemRow}>
                <Icon
                  name="create-outline"
                  size={20}
                  color={colors.text.primary}
                />
                <Text style={styles.optionText}>Rename Account</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.optionButton}
              onPress={() => {
                closeAccountMenu();
                Alert.alert(
                  'Personalization',
                  'Personalization options not yet implemented.'
                );
              }}>
              <View style={styles.optionItemRow}>
                <Icon
                  name="color-palette-outline"
                  size={20}
                  color={colors.text.primary}
                />
                <Text style={styles.optionText}>Personalization</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.optionButton, styles.optionDelete]}
              onPress={() => {
                closeAccountMenu();
                if (Math.abs(Number(totalBalance) || 0) > 0.000001) {
                  Alert.alert(
                    'Balance Not Settled',
                    'This account balance is not settled. Please settle it to 0 before removing the account.'
                  );
                  return;
                }
                Alert.alert(
                  'Delete Account',
                  'Are you sure you want to delete this account? This will remove all transactions.',
                  [
                    {text: 'Cancel', style: 'cancel'},
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await deleteTransactionsByAccount(account.id);
                          await deleteAccount(account.id);
                          navigation.goBack();
                        } catch (error) {
                          console.error('Failed to delete account:', error);
                          Alert.alert(
                            'Error',
                            'Failed to delete account. Please try again.'
                          );
                        }
                      },
                    },
                  ]
                );
              }}>
              <View style={styles.optionItemRow}>
                <Icon name="trash-outline" size={20} color="#B91C1C" />
                <Text style={[styles.optionText, styles.optionDeleteText]}>
                  Delete Account
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.optionButton, styles.optionButtonCancel]}
              onPress={closeAccountMenu}>
              <View style={styles.optionItemRow}>
                <Icon
                  name="close"
                  size={20}
                  color={colors.text.secondary}
                />
                <Text style={styles.optionTextCancel}>Cancel</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </Modal>

      <Modal
        visible={renameModalVisible}
        transparent
        animationType="none"
        onRequestClose={closeRenameModal}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={closeRenameModal}
          />
          <Animated.View
            style={[
              styles.modalSheet,
              {
                transform: [
                  {
                    translateY: modalSlideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [260, 0],
                    }),
                  },
                ],
              },
            ]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Rename Account</Text>
            <TextInput
              style={styles.modalTextInput}
              placeholder="Account name"
              value={newAccountName}
              onChangeText={setNewAccountName}
              editable={!loading}
            />
            <TouchableOpacity
              style={[styles.modalAddButton, loading && styles.buttonDisabled]}
              onPress={handleSaveAccountName}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.modalAddButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      <BottomSheet
        visible={isBottomSheetVisible}
        onClose={() => setBottomSheetVisible(false)}>
        {renderBottomSheetContent()}
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
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    elevation: 2,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: fontSize.xlarge,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    flex: 1,
    textAlign: 'center',
  },
  menuButton: {
    padding: 4,
  },
  optionsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  optionsOverlayTouchable: {
    flex: 1,
  },
  optionsContainer: {
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
  optionsHeader: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionsTitle: {
    fontSize: fontSize.large,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    textAlign: 'center',
  },
  optionButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  optionItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionText: {
    fontSize: fontSize.regular,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
  },
  optionDelete: {
    backgroundColor: 'transparent',
  },
  optionDeleteText: {
    color: '#B91C1C',
  },
  optionButtonCancel: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
  },
  optionTextCancel: {
    fontSize: fontSize.regular,
    fontWeight: fontWeight.medium,
    color: colors.text.secondary,
  },
  accountMetricsWrapper: {
    paddingTop: spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    padding: spacing.md,
    paddingBottom: spacing.xl,
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
    gap: 8,
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
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    backgroundColor: '#F3F4F6',
    opacity: 0.6,
  },
  dropdownTextDisabled: {
    color: '#9CA3AF',
  },
  accountMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountMetricHalf: {
    flex: 1,
  },
  accountMetricDivider: {
    width: 1,
    height: 44,
    backgroundColor: '#E5E7EB',
    marginHorizontal: spacing.sm,
  },
  accountMetricLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
    marginLeft: METRIC_LABEL_OFFSET,
  },
  accountMetricIconNegative: {
    backgroundColor: '#EF4444',
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
    color: '#EF4444',
  },
  periodOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  periodDropdownModal: {
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
  periodDropdownModalScrollable: {
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
  periodDropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  periodDropdownOptionActive: {
    backgroundColor: '#F0F9FF',
  },
  periodDropdownOptionText: {
    fontSize: fontSize.medium,
    color: colors.text.primary,
    fontWeight: fontWeight.medium,
  },
  periodDropdownOptionTextActive: {
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
  periodDropdownOptionClear: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    backgroundColor: '#FEF2F2',
    borderBottomWidth: 1,
    borderBottomColor: '#FCA5A5',
  },
  periodDropdownOptionClearText: {
    fontSize: fontSize.medium,
    color: '#EF4444',
    fontWeight: fontWeight.semibold,
  },
  historySection: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  chatList: {
    gap: spacing.md,
  },
  datePill: {
    alignSelf: 'center',
    backgroundColor: '#D9E7E3',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: spacing.sm,
  },
  datePillText: {
    fontSize: fontSize.small,
    color: '#4B5563',
    fontWeight: fontWeight.semibold,
  },
  chatRow: {
    alignItems: 'flex-end',
    marginBottom: spacing.sm,
  },
  chatRowDebit: {
    alignItems: 'flex-start',
  },
  chatBubble: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    minWidth: '70%',
  },
  chatBubbleDebit: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  chatIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatIconDebit: {
    backgroundColor: '#FEE2E2',
  },
  chatAmount: {
    fontSize: fontSize.large,
    fontWeight: fontWeight.bold,
    color: '#10B981',
    flex: 1,
  },
  chatAmountDebit: {
    color: '#EF4444',
  },
  chatTime: {
    fontSize: fontSize.small,
    color: colors.text.secondary,
  },
  chatRemark: {
    fontSize: fontSize.medium,
    color: colors.text.primary,
  },
  chatMeta: {
    alignItems: 'flex-end',
    gap: 6,
  },
  chatMetaDebit: {
    alignItems: 'flex-start',
  },
  chatBalance: {
    marginTop: 6,
    fontSize: fontSize.small,
    color: colors.text.secondary,
  },
  emptyHistory: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: fontSize.medium,
    color: colors.text.secondary,
    marginTop: 12,
  },
  bottomSection: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: spacing.md,
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bottomNavIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xs,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  balanceLabel: {
    fontSize: fontSize.medium,
    color: colors.text.primary,
  },
  balanceAmount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  balanceValue: {
    fontSize: fontSize.large,
    fontWeight: fontWeight.bold,
    color: '#10B981',
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  receivedButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    paddingVertical: spacing.md,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  receivedButtonText: {
    fontSize: fontSize.medium,
    fontWeight: fontWeight.semibold,
    color: '#EF4444',
  },
  givenButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    paddingVertical: spacing.md,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  givenButtonText: {
    fontSize: fontSize.medium,
    fontWeight: fontWeight.semibold,
    color: '#10B981',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalBackdrop: {
    flex: 1,
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: spacing.md,
    paddingBottom: spacing.lg,
    position: 'relative',
  },
  modalContent: {
    position: 'relative',
    zIndex: 2,
  },
  transferDismissOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    marginBottom: spacing.sm,
  },
  modalTitle: {
    fontSize: fontSize.large,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  modalAmountInput: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 22,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  modalTextInput: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    fontSize: fontSize.medium,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  modalNoteLabel: {
    fontSize: fontSize.medium,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  modalNoteInput: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    fontSize: fontSize.medium,
    color: colors.text.primary,
    marginBottom: spacing.md,
    textAlignVertical: 'top',
  },
  amountFieldWrapper: {
    position: 'relative',
    zIndex: 5,
    marginBottom: spacing.md,
    overflow: 'visible',
  },
  amountFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.white,
    paddingLeft: 14,
  },
  amountInputBare: {
    flex: 55,
    fontSize: 22,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    paddingVertical: 14,
    paddingRight: 8,
  },
  amountFieldDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
  },
  amountAccountButton: {
    flex: 45,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  amountAccountText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  floatingAccountList: {
    position: 'absolute',
    right: 0,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.white,
    zIndex: 10,
    elevation: 8,
    overflow: 'hidden',
  },
  floatingAccountScroll: {
    maxHeight: 180,
  },
  floatingAccountItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  floatingAccountItemSelected: {
    backgroundColor: '#F3F4F6',
  },
  floatingAccountText: {
    fontSize: 13,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  floatingAccountTextSelected: {
    fontWeight: fontWeight.bold,
  },
  modalAddButton: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  modalAddButtonText: {
    fontSize: fontSize.regular,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  transferList: {
    maxHeight: 280,
  },
  transferItem: {
    paddingVertical: 12,
    paddingHorizontal: spacing.sm,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    marginBottom: spacing.xs,
  },
  transferName: {
    fontSize: fontSize.medium,
    color: colors.text.primary,
    fontWeight: fontWeight.semibold,
  },
  promptOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  promptCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
  },
  promptTitle: {
    fontSize: fontSize.large,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  promptMessage: {
    fontSize: fontSize.medium,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  promptAccountName: {
    fontWeight: fontWeight.semibold,
  },
  promptRemember: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  promptCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    backgroundColor: colors.white,
  },
  promptCheckboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  promptRememberText: {
    fontSize: fontSize.small,
    color: colors.text.secondary,
  },
  promptActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  promptButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  promptButtonSecondary: {
    backgroundColor: '#F3F4F6',
  },
  promptButtonPrimary: {
    backgroundColor: colors.primary,
  },
  promptButtonTextSecondary: {
    fontSize: fontSize.medium,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  promptButtonTextPrimary: {
    fontSize: fontSize.medium,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
});

export default LiabilityAccountDetailScreen;
