import React, {useState, useEffect, useCallback, useRef} from 'react';
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
  Dimensions,
  Animated,
  Easing,
  Keyboard,
  InteractionManager,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Picker} from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/Ionicons';
import {colors, spacing, fontSize, fontWeight} from '../utils/theme';
import {useToast} from '../hooks/useToast';
import BottomSheet from '../components/BottomSheet';
import {
  initTransactionsDatabase,
  createTransaction,
  deleteTransaction,
  getTransactionsByAccount,
  calculateAccountBalance,
  updateTransactionAmount,
  updateTransactionRemark,
  deleteTransactionsByAccount,
} from '../services/transactionsDatabase';
import {
  initRecurringDatabase,
  createRecurringSchedule,
} from '../services/recurringDatabase';
import {
  deleteAccount,
  getAllAccounts,
  renameAccount,
  updateAccountPrimary,
} from '../services/accountsDatabase';

const SCHEDULE_TYPES = [
  {label: 'Once', value: 'once'},
  {label: 'Weekly', value: 'weekly'},
  {label: '2 Weeks', value: '2weeks'},
  {label: 'Monthly', value: 'monthly'},
  {label: '2 Months', value: '2months'},
  {label: '3 Months', value: '3months'},
  {label: '6 Months', value: '6months'},
];

const DAYS_OF_WEEK = [
  {label: 'Monday', value: 'monday'},
  {label: 'Tuesday', value: 'tuesday'},
  {label: 'Wednesday', value: 'wednesday'},
  {label: 'Thursday', value: 'thursday'},
  {label: 'Friday', value: 'friday'},
  {label: 'Saturday', value: 'saturday'},
  {label: 'Sunday', value: 'sunday'},
];

const DATES_OF_MONTH = Array.from({length: 31}, (_, i) => ({
  label: `${i + 1}`,
  value: i + 1,
}));

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
const TRANSFER_LAST_ACCOUNT_KEY = 'transferLastAccountId';

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

const tintWithWhite = (hex, whiteRatio = 0.9) => {
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

const AccountDetailScreen = ({route, navigation}) => {
  const account = route?.params?.account || {
    id: null,
    account_name: '',
    is_primary: 0,
  };
  const {showToast} = useToast();

  const [amount, setAmount] = useState('');
  const [addNote, setAddNote] = useState('');
  const [scheduleType, setScheduleType] = useState('once');
  const [selectedDay, setSelectedDay] = useState('monday');
  const [selectedDate, setSelectedDate] = useState(1);
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [isPrimary, setIsPrimary] = useState(account.is_primary === 1);
  const [menuVisible, setMenuVisible] = useState(false);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [editAmountVisible, setEditAmountVisible] = useState(false);
  const [editRemarkVisible, setEditRemarkVisible] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editRemark, setEditRemark] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawNote, setWithdrawNote] = useState('');
  const [withdrawMode, setWithdrawMode] = useState(null);
  const [withdrawDefaultMode, setWithdrawDefaultMode] = useState(null);
  const [transferSelectVisible, setTransferSelectVisible] = useState(false);
  const [transferAccounts, setTransferAccounts] = useState([]);
  const [transferTarget, setTransferTarget] = useState(null);
  const [transferAmount, setTransferAmount] = useState(0);
  const [amountFieldHeight, setAmountFieldHeight] = useState(0);
  const [amountAccountWidth, setAmountAccountWidth] = useState(0);
  const [quickPeriod, setQuickPeriod] = useState('1month');
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [isBottomSheetVisible, setBottomSheetVisible] = useState(false);
  const [bottomSheetContent, setBottomSheetContent] = useState(null);
  const [availableYears, setAvailableYears] = useState([]);
  const [filteredAdded, setFilteredAdded] = useState(0);
  const [filteredWithdrawals, setFilteredWithdrawals] = useState(0);
  const [monthStartDay, setMonthStartDay] = useState(DEFAULT_MONTH_START_DAY);
  const scrollViewRef = useRef(null);
  const addAmountInputRef = useRef(null);
  const withdrawAmountInputRef = useRef(null);
  const modalSlideAnim = useRef(new Animated.Value(0)).current;
  const optionsOverlayOpacity = useRef(new Animated.Value(0)).current;
  const optionsContentTranslateY = useRef(new Animated.Value(300)).current;
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
    initRecurringDatabase();
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
    const loadWithdrawDefault = async () => {
      try {
        const stored = await AsyncStorage.getItem('withdrawDefaultMode');
        if (stored === 'withdraw' || stored === 'transfer') {
          setWithdrawDefaultMode(stored);
        }
      } catch (error) {
        console.error('Failed to load withdraw default mode:', error);
      }
    };
    loadWithdrawDefault();
  }, []);

  useEffect(() => {
    if (withdrawModalVisible) {
      if (withdrawDefaultMode) {
        setWithdrawMode(withdrawDefaultMode);
      }
    } else {
      setWithdrawMode(null);
      setWithdrawAmount('');
      setWithdrawNote('');
      setTransferSelectVisible(false);
    }
  }, [withdrawModalVisible, withdrawDefaultMode]);

  useEffect(() => {
    if (!withdrawModalVisible || withdrawMode !== 'transfer') {
      return;
    }
    const loadTransferAccounts = async () => {
      try {
        const accountsList = getAllAccounts().filter(
          item => item.id !== account.id
        );
        setTransferAccounts(accountsList);
        if (accountsList.length === 0) {
          setTransferTarget(null);
          return;
        }
        const storedId = await AsyncStorage.getItem(
          TRANSFER_LAST_ACCOUNT_KEY
        );
        const selected =
          accountsList.find(item => String(item.id) === storedId) ||
          accountsList[0];
        setTransferTarget(selected);
      } catch (error) {
        console.error('Failed to load transfer accounts:', error);
        setTransferAccounts([]);
        setTransferTarget(null);
      }
    };
    loadTransferAccounts();
  }, [withdrawModalVisible, withdrawMode, account.id]);

  useEffect(() => {
    const isAnyModalOpen =
      addModalVisible ||
      withdrawModalVisible ||
      editAmountVisible ||
      editRemarkVisible ||
      renameModalVisible;
    if (isAnyModalOpen) {
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
    addModalVisible,
    withdrawModalVisible,
    editAmountVisible,
    editRemarkVisible,
    modalSlideAnim,
  ]);

  const closeOptionsMenu = (keepSelection = false) => {
    Animated.parallel([
      Animated.timing(optionsOverlayOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(optionsContentTranslateY, {
        toValue: 300,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setOptionsVisible(false);
      if (!keepSelection) {
        setSelectedTransaction(null);
      }
    });
  };

  useEffect(() => {
    if (!optionsVisible) {
      return;
    }
    optionsOverlayOpacity.setValue(0);
    optionsContentTranslateY.setValue(300);
    requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(optionsOverlayOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(optionsContentTranslateY, {
          toValue: 0,
          tension: 65,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [optionsVisible, optionsOverlayOpacity, optionsContentTranslateY]);

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

  const focusAddAmountInput = useCallback(() => {
    const focus = () => addAmountInputRef.current?.focus();
    Keyboard.dismiss();
    focus();
    requestAnimationFrame(focus);
    InteractionManager.runAfterInteractions(focus);
    setTimeout(focus, 300);
    setTimeout(focus, 600);
  }, []);

  const focusWithdrawAmountInput = useCallback(() => {
    const focus = () => withdrawAmountInputRef.current?.focus();
    Keyboard.dismiss();
    focus();
    requestAnimationFrame(focus);
    InteractionManager.runAfterInteractions(focus);
    setTimeout(focus, 300);
    setTimeout(focus, 600);
  }, []);

  useEffect(() => {
    if (!addModalVisible) {
      return;
    }
    const timer = setTimeout(() => {
      focusAddAmountInput();
    }, 250);
    return () => clearTimeout(timer);
  }, [addModalVisible, focusAddAmountInput]);

  useEffect(() => {
    if (!withdrawModalVisible) {
      return;
    }
    const timer = setTimeout(() => {
      focusWithdrawAmountInput();
    }, 250);
    return () => clearTimeout(timer);
  }, [withdrawModalVisible, focusWithdrawAmountInput]);

  const handleTogglePrimary = async () => {
    try {
      const newPrimaryStatus = !isPrimary;
      await updateAccountPrimary(account.id, newPrimaryStatus);
      setIsPrimary(newPrimaryStatus);
      Alert.alert(
        'Success',
        newPrimaryStatus
          ? 'This account is now set as your primary earning account'
          : 'Primary status removed from this account'
      );
    } catch (error) {
      console.error('Failed to update primary status:', error);
      Alert.alert('Error', 'Failed to update primary status. Please try again.');
    }
  };

  const handleAddEntry = async () => {
    // Validation
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return false;
    }

    const remark = addNote.trim();

    setLoading(true);
    try {
      const amountValue = parseFloat(amount);

      if (scheduleType === 'once') {
        // Create immediate transaction
        await createTransaction(account.id, amountValue, remark);
        showToast('Amount added successfully', 'success');
      } else {
        // Create recurring schedule
        const needsDay = scheduleType === 'weekly' || scheduleType === '2weeks';
        const needsDate = ['monthly', '2months', '3months', '6months'].includes(scheduleType);

        await createRecurringSchedule(
          account.id,
          amountValue,
          remark,
          scheduleType,
          needsDay ? selectedDay : null,
          needsDate ? selectedDate : null
        );

        showToast(`Recurring ${scheduleType} schedule created.`, 'success');
      }

      // Reset form
      setAmount('');
      setScheduleType('once');
      setAddNote('');

      // Reload transactions
      loadTransactions();
      return true;
    } catch (error) {
      console.error('Failed to add entry:', error);
      Alert.alert('Error', 'Failed to add entry. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return false;
    }

    const remark = withdrawNote.trim();

    setLoading(true);
    try {
      const amountValue = Math.abs(parseFloat(withdrawAmount));
      if (amountValue > totalBalance) {
        showToast('Balance is low. Add amount first to withdraw.', 'error');
        return false;
      }
      await createTransaction(account.id, -amountValue, remark);
      showToast('Withdrawal recorded successfully', 'success');

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

  const handleTransfer = async targetAccount => {
    if (!targetAccount) {
      Alert.alert('Select Account', 'Please select a transfer account.');
      return false;
    }
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return false;
    }

    const amountValue = Math.abs(parseFloat(withdrawAmount));
    if (amountValue > totalBalance) {
      showToast('Balance is low. Add amount first to withdraw.', 'error');
      return false;
    }

    await handleTransferToAccount(targetAccount, amountValue);
    return true;
  };

  const handleTransferToAccount = async (targetAccount, amountValueOverride) => {
    const amountValue = amountValueOverride ?? transferAmount;
    if (!targetAccount || !amountValue) {
      return;
    }
    const transferNote = withdrawNote.trim();
    const toRemark = transferNote
      ? `Transferred to ${targetAccount.account_name} - ${transferNote}`
      : `Transferred to ${targetAccount.account_name}`;
    const fromRemark = transferNote
      ? `Transferred from ${account.account_name} - ${transferNote}`
      : `Transferred from ${account.account_name}`;
    setLoading(true);
    try {
      await createTransaction(
        account.id,
        -amountValue,
        toRemark
      );
      await createTransaction(
        targetAccount.id,
        amountValue,
        fromRemark
      );
      setWithdrawAmount('');
      setWithdrawNote('');
      setTransferAmount(0);
      setTransferSelectVisible(false);
      setTransferTarget(targetAccount);
      AsyncStorage.setItem(
        TRANSFER_LAST_ACCOUNT_KEY,
        String(targetAccount.id)
      ).catch(error => {
        console.error('Failed to save transfer account:', error);
      });
      loadTransactions();
      showToast('Transfer completed successfully', 'success');
    } catch (error) {
      console.error('Failed to transfer:', error);
      Alert.alert('Error', 'Failed to transfer. Please try again.');
    } finally {
      setLoading(false);
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
      showToast('Account renamed successfully', 'success');
      closeRenameModal();
    } catch (error) {
      console.error('Failed to rename account:', error);
      Alert.alert('Error', 'Failed to rename account.');
    } finally {
      setLoading(false);
    }
  };

  const canEditRemark = txn => {
    if (!txn) {
      return false;
    }
    const amount = Number(txn.amount);
    return Number.isFinite(amount);
  };

  const canEditAmount = txn => {
    if (!txn) {
      return false;
    }
    const amount = Number(txn.amount);
    if (!Number.isFinite(amount)) {
      return false;
    }
    return amount < 0 && !isTransferTransaction(txn);
  };

  const canDeleteTransaction = txn => canEditAmount(txn);

  const openTransactionMenu = txn => {
    setSelectedTransaction(txn);
    setOptionsVisible(true);
  };

  const handleUpdateAmount = async () => {
    if (!selectedTransaction) {
      return;
    }
    if (!editAmount || parseFloat(editAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    setLoading(true);
    try {
      await updateTransactionAmount(
        selectedTransaction.id,
        account.id,
        parseFloat(editAmount)
      );
      setEditAmountVisible(false);
      setSelectedTransaction(null);
      setEditAmount('');
      loadTransactions();
    } catch (error) {
      console.error('Failed to update amount:', error);
      Alert.alert('Error', 'Failed to update amount. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRemark = async () => {
    if (!selectedTransaction) {
      return;
    }
    setLoading(true);
    try {
      await updateTransactionRemark(selectedTransaction.id, editRemark.trim());
      setEditRemarkVisible(false);
      setSelectedTransaction(null);
      setEditRemark('');
      loadTransactions();
    } catch (error) {
      console.error('Failed to update remark:', error);
      Alert.alert('Error', 'Failed to update remark. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = value => {
    return `\u20B9 ${value.toLocaleString('en-IN')}`;
  };

  const formatDateTime = timestamp => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
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

          return (
            <View key={txn.id}>
              {showDate && (
                <View style={styles.datePill}>
                  <Text style={styles.datePillText}>
                    {formatDateLabel(txn.transaction_date)}
                  </Text>
                </View>
              )}
              <View
                style={[
                  styles.chatRow,
                  Number(txn.amount) < 0 && styles.chatRowDebit,
                ]}>
                <View
                  style={[
                    styles.chatBubble,
                    Number(txn.amount) > 0 && styles.chatBubbleCredit,
                    Number(txn.amount) < 0 && styles.chatBubbleDebit,
                  ]}>
                  <View style={styles.chatHeader}>
                    <View
                      style={[
                        styles.chatIcon,
                        Number(txn.amount) < 0 && styles.chatIconDebit,
                      ]}>
                      <Icon
                        name={Number(txn.amount) < 0 ? 'arrow-down' : 'arrow-up'}
                        size={16}
                        color={Number(txn.amount) < 0 ? '#EF4444' : '#10B981'}
                      />
                    </View>
                    <Text
                      style={[
                        styles.chatAmount,
                        Number(txn.amount) < 0 && styles.chatAmountDebit,
                      ]}>
                      {(Number(txn.amount) < 0 ? '-' : '+') +
                        formatCurrency(Math.abs(Number(txn.amount) || 0))}
                    </Text>
                    <View style={styles.chatHeaderRight}>
                      <Text style={styles.chatTime}>
                        {formatTimeLabel(txn.transaction_date)}
                    </Text>
                      <TouchableOpacity
                        style={styles.moreDots}
                        hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                      onPress={() => openTransactionMenu(txn)}>
                      <Icon
                        name="ellipsis-vertical"
                        size={16}
                        color={colors.text.secondary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
                {txn.remark ? (
                  <Text style={styles.chatRemark}>{txn.remark}</Text>
                ) : null}
              </View>
                <View
                  style={[
                    styles.chatMeta,
                    Number(txn.amount) < 0 && styles.chatMetaDebit,
                  ]}>
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

  const showDayPicker = scheduleType === 'weekly' || scheduleType === '2weeks';
  const showDatePicker = ['monthly', '2months', '3months', '6months'].includes(scheduleType);

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
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}>
            <Icon name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text
            style={[
              styles.headerTitle,
              account.icon_color && {color: account.icon_color},
            ]}>
            {account.account_name}
          </Text>
          <TouchableOpacity
            onPress={openAccountMenu}
            style={styles.menuButton}>
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
        <View style={styles.historySection}>
          {renderTransactions()}
        </View>
      </ScrollView>

      {/* Bottom Fixed Section */}
      <View
        style={[
          styles.bottomSection,
          account.icon_color && {
            borderTopColor: withAlpha(account.icon_color, 0.3),
          },
        ]}>
        {/* Received and Given Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.receivedButton}
            onPress={() => {
              setWithdrawModalVisible(true);
              focusWithdrawAmountInput();
            }}>
            <Icon name="arrow-down" size={20} color="#EF4444" />
            <Text style={styles.receivedButtonText}>Withdraw / Transfer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.givenButton}
            onPress={() => {
              setAddModalVisible(true);
              focusAddAmountInput();
            }}>
            <Icon name="arrow-up" size={20} color="#10B981" />
            <Text style={styles.givenButtonText}>Add Ammount</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={addModalVisible}
        transparent
        animationType="none"
        onRequestClose={() => setAddModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => {
              setAddModalVisible(false);
              setAddNote('');
              setAmount('');
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
            <Text style={styles.modalTitle}>Add Amount</Text>
            <TextInput
              style={styles.modalAmountInput}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
                autoFocus
                ref={addAmountInputRef}
                showSoftInputOnFocus
                editable={!loading}
                onLayout={focusAddAmountInput}
              />
            <Text style={styles.modalNoteLabel}>Note (Optional)</Text>
            <TextInput
              style={styles.modalNoteInput}
              value={addNote}
              onChangeText={setAddNote}
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
                const didAdd = await handleAddEntry();
                if (didAdd) {
                  setAddModalVisible(false);
                }
              }}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.modalAddButtonText}>Add</Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      <Modal
        visible={withdrawModalVisible}
        transparent
        animationType="none"
        onRequestClose={() => setWithdrawModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => {
              setWithdrawModalVisible(false);
              setWithdrawAmount('');
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
            {transferSelectVisible && (
              <Pressable
                style={styles.transferDismissOverlay}
                onPress={() => setTransferSelectVisible(false)}
              />
            )}
            <View style={styles.modalContent}>
              <View style={styles.modalHandle} />
              <View style={styles.modeToggle}>
                <View style={styles.modeOption}>
                  <TouchableOpacity
                    style={[
                      styles.modeButton,
                      withdrawMode === 'withdraw' && styles.modeButtonActive,
                    ]}
                    onPress={() => setWithdrawMode('withdraw')}>
                    <View style={styles.modeButtonContent}>
                      <Text
                        style={[
                          styles.modeButtonText,
                          withdrawMode === 'withdraw' && styles.modeButtonTextActive,
                        ]}>
                        Withdraw
                      </Text>
                      {withdrawDefaultMode === 'withdraw' && (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultBadgeText}>Default</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                </View>
                <View style={styles.modeOption}>
                  <TouchableOpacity
                    style={[
                      styles.modeButton,
                      withdrawMode === 'transfer' && styles.modeButtonActive,
                    ]}
                    onPress={() => setWithdrawMode('transfer')}>
                    <View style={styles.modeButtonContent}>
                      <Text
                        style={[
                          styles.modeButtonText,
                          withdrawMode === 'transfer' && styles.modeButtonTextActive,
                        ]}>
                        Transfer
                      </Text>
                      {withdrawDefaultMode === 'transfer' && (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultBadgeText}>Default</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
              {withdrawMode &&
                withdrawMode !== withdrawDefaultMode && (
                  <TouchableOpacity
                    style={styles.setDefaultButton}
                    onPress={() => {
                      const message =
                        withdrawMode === 'withdraw'
                          ? 'Now withdraw is your default option.'
                          : 'Now transfer is your default option.';
                      showToast(message, 'success');
                      AsyncStorage.setItem('withdrawDefaultMode', withdrawMode)
                        .then(() => {
                          setWithdrawDefaultMode(withdrawMode);
                        })
                        .catch(error => {
                          console.error('Failed to save withdraw default mode:', error);
                        });
                    }}>
                    <Text style={styles.setDefaultText}>Set as default</Text>
                  </TouchableOpacity>
                )}
              <Text style={styles.modalTitle}>
                {withdrawMode === 'transfer' ? 'Transfer' : 'Withdraw'}
              </Text>
              {withdrawMode === 'transfer' ? (
                <View style={styles.amountFieldWrapper}>
                  <View
                    style={styles.amountFieldRow}
                    onLayout={event =>
                      setAmountFieldHeight(event.nativeEvent.layout.height)
                    }>
                    <TextInput
                      style={styles.amountInputBare}
                      value={withdrawAmount}
                      onChangeText={setWithdrawAmount}
                      keyboardType="numeric"
                      autoFocus
                      ref={withdrawAmountInputRef}
                      showSoftInputOnFocus
                      editable={!loading}
                    />
                    <View style={styles.amountFieldDivider} />
                    <TouchableOpacity
                      style={styles.amountAccountButton}
                      onPress={() =>
                        setTransferSelectVisible(current => !current)
                      }
                      onLayout={event =>
                        setAmountAccountWidth(event.nativeEvent.layout.width)
                      }
                      disabled={transferAccounts.length === 0}>
                      <Text
                        style={[
                          styles.amountAccountText,
                          transferTarget?.icon_color && {
                            color: transferTarget.icon_color,
                          },
                        ]}
                        numberOfLines={1}>
                        {transferTarget?.account_name ||
                          (transferAccounts.length
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
                  {transferSelectVisible && (
                    <View
                      style={[
                        styles.floatingAccountList,
                        {
                          bottom: amountFieldHeight + 6,
                          right: 0,
                          width: amountAccountWidth || 140,
                        },
                      ]}>
                      <ScrollView
                        style={styles.floatingAccountScroll}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled">
                        {transferAccounts.map(item => {
                          const isSelected = transferTarget?.id === item.id;
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
                                setTransferTarget(item);
                                setTransferSelectVisible(false);
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
              ) : (
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
              )}
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
                  if (!withdrawMode) {
                    Alert.alert('Select Option', 'Please select Withdraw or Transfer first.');
                    return;
                  }
                  if (withdrawMode === 'transfer') {
                    const didTransfer = await handleTransfer(transferTarget);
                    if (didTransfer) {
                      setWithdrawModalVisible(false);
                    }
                    return;
                  }
                  const didAdd = await handleWithdraw();
                  if (didAdd) {
                    setWithdrawModalVisible(false);
                  }
                }}
                disabled={loading}>
                {loading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.modalAddButtonText}>
                    {withdrawMode === 'transfer' ? 'Transfer' : 'Withdraw'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      <BottomSheet
        visible={isBottomSheetVisible}
        onClose={() => setBottomSheetVisible(false)}>
        {renderBottomSheetContent()}
      </BottomSheet>

      <Modal
        visible={optionsVisible}
        transparent
        animationType="none"
        onRequestClose={closeOptionsMenu}>
        <Animated.View
          style={[
            styles.optionsOverlay,
            {opacity: optionsOverlayOpacity},
          ]}>
          <TouchableOpacity
            style={styles.optionsOverlayTouchable}
            activeOpacity={1}
            onPress={closeOptionsMenu}
          />
          <Animated.View
            style={[
              styles.optionsContainer,
              {transform: [{translateY: optionsContentTranslateY}]},
            ]}>
            <View style={styles.optionsHeader}>
              <Text style={styles.optionsTitle}>Transaction Options</Text>
            </View>
            {canEditAmount(selectedTransaction) && (
              <TouchableOpacity
                style={styles.optionButton}
                onPress={() => {
                  if (!selectedTransaction) {
                    return;
                  }
                  closeOptionsMenu(true);
                  setEditAmount(String(selectedTransaction.amount ?? ''));
                  setEditAmountVisible(true);
                }}>
                <Text style={styles.optionText}>Edit Amount</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.optionButton}
              onPress={() => {
                if (!selectedTransaction) {
                  return;
                }
                if (!canEditRemark(selectedTransaction)) {
                  return;
                }
                closeOptionsMenu(true);
                setEditRemark(selectedTransaction.remark || '');
                setEditRemarkVisible(true);
              }}>
              <Text style={styles.optionText}>Edit Remark</Text>
            </TouchableOpacity>
            {canDeleteTransaction(selectedTransaction) && (
              <TouchableOpacity
                style={[styles.optionButton, styles.optionDelete]}
                onPress={async () => {
                  if (!selectedTransaction) {
                    return;
                  }
                  closeOptionsMenu(true);
                  try {
                    await deleteTransaction(selectedTransaction.id, account.id);
                    loadTransactions();
                    setSelectedTransaction(null);
                  } catch (error) {
                    console.error('Failed to delete entry:', error);
                    Alert.alert('Error', 'Failed to delete entry. Please try again.');
                  }
                }}>
                <Text style={[styles.optionText, styles.optionDeleteText]}>
                  Delete Entry
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.optionButton, styles.optionButtonCancel]}
              onPress={closeOptionsMenu}>
              <Text style={styles.optionTextCancel}>Cancel</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </Modal>

      <Modal
        visible={editAmountVisible}
        transparent
        animationType="none"
        onRequestClose={() => setEditAmountVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setEditAmountVisible(false)}
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
            <Text style={styles.modalTitle}>Edit Amount</Text>
            <TextInput
              style={styles.modalAmountInput}
                value={editAmount}
                onChangeText={setEditAmount}
                keyboardType="numeric"
              editable={!loading}
            />
            <TouchableOpacity
              style={[styles.modalAddButton, loading && styles.buttonDisabled]}
              onPress={handleUpdateAmount}
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

      <Modal
        visible={editRemarkVisible}
        transparent
        animationType="none"
        onRequestClose={() => setEditRemarkVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setEditRemarkVisible(false)}
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
            <Text style={styles.modalTitle}>Edit Remark</Text>
            <TextInput
              style={styles.modalAmountInput}
              placeholder="Remark"
              value={editRemark}
              onChangeText={setEditRemark}
              editable={!loading}
            />
            <TouchableOpacity
              style={[styles.modalAddButton, loading && styles.buttonDisabled]}
              onPress={handleUpdateRemark}
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
              <Text style={styles.optionText}>Rename Account</Text>
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
              <Text style={styles.optionText}>Personalization</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.optionButton}
              onPress={() => {
                if (!isPrimary) {
                  handleTogglePrimary();
                }
                closeAccountMenu();
              }}
              disabled={isPrimary}>
              <View style={styles.optionRow}>
                <Text
                  style={[
                    styles.optionText,
                    isPrimary && styles.optionTextSelected,
                  ]}>
                  {isPrimary ? 'Primary Account' : 'Set as Primary'}
                </Text>
                {isPrimary && (
                  <Icon name="checkmark" size={18} color="#10B981" />
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.optionButton, styles.optionDelete]}
              onPress={() => {
                closeAccountMenu();
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
              <Text style={[styles.optionText, styles.optionDeleteText]}>
                Delete Account
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.optionButton, styles.optionButtonCancel]}
              onPress={closeAccountMenu}>
              <Text style={styles.optionTextCancel}>Cancel</Text>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    padding: spacing.md,
    paddingBottom: spacing.xl,
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
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
    padding: 4,
    marginBottom: spacing.sm,
    gap: 8,
  },
  modeOption: {
    flex: 1,
  },
  modeButton: {
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 999,
  },
  modeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modeButtonActive: {
    backgroundColor: colors.white,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  modeButtonText: {
    fontSize: fontSize.medium,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
  },
  modeButtonTextActive: {
    color: colors.text.primary,
  },
  setDefaultButton: {
    alignItems: 'center',
    paddingTop: 6,
  },
  setDefaultText: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
    color: '#10B981',
  },
  defaultBadge: {
    marginLeft: 6,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    color: '#166534',
  },
  defaultToast: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    top: spacing.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    zIndex: 10,
    elevation: 6,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  defaultToastText: {
    color: colors.white,
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
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
  modalAddButtonText: {
    fontSize: fontSize.regular,
    fontWeight: fontWeight.bold,
    color: colors.white,
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
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionText: {
    fontSize: fontSize.regular,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
  },
  optionTextSelected: {
    color: '#10B981',
    fontWeight: fontWeight.semibold,
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
  section: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: fontSize.medium,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  amountInput: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    marginHorizontal: spacing.md,
    fontSize: fontSize.small,
    color: colors.text.secondary,
  },
  pickerContainer: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  addButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: spacing.md,
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  addButtonText: {
    fontSize: fontSize.regular,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  totalSection: {
    backgroundColor: '#10B981',
    padding: 20,
    borderRadius: 12,
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: fontSize.medium,
    color: 'rgba(255,255,255,0.9)',
  },
  totalAmount: {
    fontSize: 32,
    fontWeight: fontWeight.bold,
    color: colors.white,
    marginTop: 4,
  },
  historySection: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  historyTitle: {
    fontSize: fontSize.large,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
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
  chatBubbleCredit: {
    backgroundColor: colors.white,
    borderColor: colors.border,
  },
  chatBubbleDebit: {
    backgroundColor: colors.white,
    borderColor: colors.border,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  chatHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  toastContainer: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    top: spacing.md,
    alignItems: 'center',
  },
  toast: {
    backgroundColor: 'rgba(220, 38, 38, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  toastText: {
    color: colors.white,
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
  },
  moreDots: {
    paddingHorizontal: 4,
    paddingVertical: 2,
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
  moreText: {
    fontSize: 10,
    color: colors.text.secondary,
    marginTop: 2,
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
    fontSize: fontSize.xlarge,
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
});

export default AccountDetailScreen;
