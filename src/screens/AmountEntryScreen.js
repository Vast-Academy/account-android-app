import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Keyboard,
  BackHandler,
  InteractionManager,
  Platform,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import {CommonActions} from '@react-navigation/native';
import {Picker} from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/Ionicons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import BsCashCoin from '../components/icons/BsCashCoin';
import {colors, spacing, fontSize, fontWeight} from '../utils/theme';
import {useToast} from '../hooks/useToast';
import {useCurrencySymbol} from '../hooks/useCurrencySymbol';
import AmountActionButton from '../components/AmountActionButton';
import {getAllAccounts, getPrimaryEarningAccount} from '../services/accountsDatabase';
import {createTransaction, calculateAccountBalance, getTransactionsByAccount} from '../services/transactionsDatabase';
import {canWithdrawAtTimestampWithEntries, getBalanceAtTimestampWithEntries} from '../services/transactionTimeline';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const LIST_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const LIST_PADDING = (LIST_HEIGHT - ITEM_HEIGHT) / 2;

const LAST_TRANSFER_ACCOUNT_KEY = 'lastTransferAccountId';

const renderAccountIcon = (iconName, size, color) => {
  if (iconName === 'bs-cash-coin') {
    return <BsCashCoin size={size} color={color} />;
  }
  return <Icon name={iconName} size={size} color={color} />;
};


const getAccountTypeLabel = type => {
  if (type === 'earning') {
    return 'Earning account';
  }
  if (type === 'saving') {
    return 'Savings account';
  }
  if (type === 'expenses') {
    return 'Expenses account';
  }
  return 'Bank account';
};

const AmountEntryScreen = ({route, navigation}) => {
  const {showToast} = useToast();
  const currencySymbol = useCurrencySymbol();
  const insets = useSafeAreaInsets();

  const {
    mode = 'add',
    account,
    prevRouteKey,
    initialEntryDate,
    transferOnly = false,
    returnOnly = false,
    ledgerAction = null,
  } = route?.params ?? {};

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [entryDate, setEntryDate] = useState(
    initialEntryDate ? new Date(initialEntryDate) : new Date(),
  );
  const [scheduleApplied, setScheduleApplied] = useState(false);
  const [schedulePopupVisible, setSchedulePopupVisible] = useState(false);
  const [draftEntryDate, setDraftEntryDate] = useState(null);

  const [transferAccounts, setTransferAccounts] = useState([]);
  const [transferTargetId, setTransferTargetId] = useState(null);
  const [transferSelected, setTransferSelected] = useState(false);
  const [transferPopupVisible, setTransferPopupVisible] = useState(false);
  const [selectedTransferAccount, setSelectedTransferAccount] = useState(null);
  const [transferListExpanded, setTransferListExpanded] = useState(false);

  const amountInputRef = useRef(null);
  const noteInputRef = useRef(null);
  const dateListRef = useRef(null);
  const hourListRef = useRef(null);
  const minuteListRef = useRef(null);
  const lastDateIndexRef = useRef(-1);
  const lastHourIndexRef = useRef(-1);
  const lastMinuteIndexRef = useRef(-1);

  const isWithdrawMode = mode === 'withdraw';
  const isRequestMode = mode === 'request';
  const isLedgerFlow = returnOnly && (ledgerAction === 'paid' || ledgerAction === 'get');
  const isExpenseAccount = account?.account_type === 'expenses';

  useEffect(() => {
    navigation.setOptions({headerShown: false, gestureEnabled: false});
  }, [navigation]);

  useEffect(() => {
    const onBackPress = () => {
      if (transferPopupVisible) {
        closeTransferPopup();
        return true;
      }
      if (schedulePopupVisible) {
        closeSchedulePopup();
        return true;
      }
      return false;
    };

    const backSub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    const navSub = navigation.addListener('beforeRemove', e => {
      if (transferPopupVisible || schedulePopupVisible) {
        e.preventDefault();
        if (transferPopupVisible) {
          closeTransferPopup();
        }
        if (schedulePopupVisible) {
          closeSchedulePopup();
        }
      }
    });

    return () => {
      backSub.remove();
      navSub();
    };
  }, [navigation, transferPopupVisible, schedulePopupVisible]);

  useEffect(() => {
    const focus = () => amountInputRef.current?.focus();
    requestAnimationFrame(focus);
    const t1 = setTimeout(focus, 120);
    return () => clearTimeout(t1);
  }, []);


  useEffect(() => {
    if ((!isWithdrawMode && !isRequestMode) || !account?.id) {
      return;
    }
    const loadTransferAccounts = async () => {
      try {
        const accounts = getAllAccounts()
          .filter(acc => {
            if (isRequestMode) {
              return (
                acc.account_type === 'earning' &&
                String(acc.id) !== String(account.id)
              );
            }
            return acc.id !== account.id;
          })
          .sort((a, b) => String(a.account_name).localeCompare(String(b.account_name)));
        setTransferAccounts(accounts);

        let preferredAccount = null;
        if (isWithdrawMode) {
          try {
            const preferredId = await AsyncStorage.getItem(LAST_TRANSFER_ACCOUNT_KEY);
            preferredAccount = accounts.find(
              acc => String(acc.id) === String(preferredId)
            );
          } catch (error) {
            console.warn('Failed to read last transfer account:', error);
          }
        }

        const nextAccount = preferredAccount || accounts[0] || null;
        setSelectedTransferAccount(nextAccount);
        setTransferTargetId(nextAccount?.id ?? null);
      } catch (error) {
        console.error('Failed to load transfer accounts:', error);
      }
    };

    loadTransferAccounts();
  }, [isWithdrawMode, isRequestMode, account?.id]);


  const title = useMemo(() => {
    if (isLedgerFlow) {
      return ledgerAction === 'paid' ? 'Paid' : 'Get';
    }
    if (isWithdrawMode) {
      return 'Withdraw / Transfer';
    }
    if (isRequestMode) {
      return 'Request Amount';
    }
    return 'Add Amount';
  }, [isLedgerFlow, ledgerAction, isWithdrawMode, isRequestMode]);

  const isFutureEntryDate = value => {
    if (!(value instanceof Date)) {
      return false;
    }
    return value.getTime() > Date.now();
  };

  const sendResultAndGoBack = payload => {
    let didSet = false;
    if (prevRouteKey) {
      try {
        navigation.dispatch(
          CommonActions.setParams({
            params: {amountEntryResult: payload},
            source: prevRouteKey,
          }),
        );
        didSet = true;
      } catch (error) {
        console.warn('Failed to set params on prev route:', error);
      }
    }

    if (!didSet) {
      const state = navigation.getState?.();
      const routes = state?.routes ?? [];
      const prevRoute = routes.length > 1 ? routes[routes.length - 2] : null;
      if (prevRoute?.name) {
        navigation.navigate({
          name: prevRoute.name,
          params: {amountEntryResult: payload},
          merge: true,
        });
      }
    }

    navigation.goBack();
  };

  const openLowBalancePrompt = () => {
    const message = isExpenseAccount
      ? 'Add amount first or enable Auto Get option.'
      : 'Add amount first.';
    if (isExpenseAccount) {
      Alert.alert(
        'Balance is low',
        message,
        [
          {
            text: 'Open Auto Get option',
            onPress: () => {
              if (account?.id) {
                navigation.navigate('PersonalizeAccount', {accountId: account.id});
              }
            },
          },
          {text: 'OK', style: 'cancel'},
        ],
        {cancelable: false},
      );
      return;
    }
    Alert.alert(
      'Balance is low',
      message,
      [{text: 'OK', style: 'cancel'}],
      {cancelable: false},
    );
  };

  const handleSubmit = async action => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      showToast('Please enter a valid amount.', 'error');
      return;
    }
    if (isFutureEntryDate(entryDate)) {
      showToast('Future entry not allowed.', 'error');
      return;
    }
    if ((action === 'transfer' || action === 'request') && !transferTargetId) {
      showToast('Please select an account.', 'error');
      return;
    }

    if (!isLedgerFlow && !account?.id) {
      showToast('Account not found.', 'error');
      return;
    }

    const noteText = note?.trim?.() ?? note ?? '';
    const entryTimestamp = entryDate?.getTime?.() ?? Date.now();

    if (isLedgerFlow) {
      sendResultAndGoBack({
        action: ledgerAction,
        amount: parsedAmount,
        note: noteText,
        entryDateIso: entryDate?.toISOString?.() || null,
      });
      return;
    }

    const requestFromPrimaryEarning = async (amountValue) => {
      const primary = getPrimaryEarningAccount();
      if (!primary) {
        showToast(
          'Please set a primary earning account first.',
          'error'
        );
        return false;
      }
      try {
        const earningEntries = getTransactionsByAccount(primary.id);
        const earningPending = [
          {
            id: 'pending-earning-request',
            amount: -Math.abs(amountValue),
            transaction_date: entryTimestamp,
            is_deleted: 0,
            orderIndex: 1,
          },
        ];
        if (
          !canWithdrawAtTimestampWithEntries(
            Math.abs(amountValue),
            entryTimestamp,
            earningEntries,
            earningPending
          )
        ) {
          showToast(
            `Request not allowed. ${primary.account_name} had insufficient balance at that time.`,
            'error'
          );
          return false;
        }
        const earningBalance = calculateAccountBalance(primary.id);
        if (earningBalance < Math.abs(amountValue)) {
          showToast(`Low balance on ${primary.account_name}.`, 'error');
          return false;
        }

        const trimmedNote = noteText.trim();
        const fromRemark = trimmedNote
          ? `Requested by ${account.account_name} - ${trimmedNote}`
          : `Requested by ${account.account_name}`;
        const toRemark = trimmedNote
          ? `Requested from ${primary.account_name} - ${trimmedNote}`
          : `Requested from ${primary.account_name}`;

        await createTransaction(
          primary.id,
          -Math.abs(amountValue),
          fromRemark,
          entryTimestamp
        );
        await createTransaction(
          account.id,
          Math.abs(amountValue),
          toRemark,
          entryTimestamp
        );
        return true;
      } catch (error) {
        console.error('Failed to request amount:', error);
        showToast('Failed to request amount. Please try again.', 'error');
        return false;
      }
    };

    if (action === 'add') {
      try {
        await createTransaction(
          account.id,
          parsedAmount,
          noteText,
          entryTimestamp
        );
        showToast('Amount added successfully', 'success');
        navigation.goBack();
      } catch (error) {
        console.error('Failed to add amount:', error);
        showToast('Failed to add amount. Please try again.', 'error');
      }
      return;
    }

    if (action === 'withdraw' || action === 'transfer') {
      const accountEntries = getTransactionsByAccount(account.id);
      const balanceAtTimestamp = getBalanceAtTimestampWithEntries(
        accountEntries,
        entryTimestamp
      );
      const freshAccount = getAllAccounts().find(
        acc => String(acc.id) === String(account.id)
      );
      const autoFundEnabled =
        action === 'withdraw' &&
        isExpenseAccount &&
        Number((freshAccount || account)?.auto_fund_primary) === 1;
      const needsAutoFund = autoFundEnabled && parsedAmount > balanceAtTimestamp;
      const shortfall = needsAutoFund
        ? Math.max(0, parsedAmount - balanceAtTimestamp)
        : 0;
      const pendingEntries = needsAutoFund
        ? [
            {
              id: 'pending-auto-fund',
              amount: shortfall,
              transaction_date: entryTimestamp,
              is_deleted: 0,
              orderIndex: 0,
            },
            {
              id: 'pending-entry',
              amount: -Math.abs(parsedAmount),
              transaction_date: entryTimestamp,
              is_deleted: 0,
              orderIndex: 1,
            },
          ]
        : [
            {
              id: 'pending-entry',
              amount: -Math.abs(parsedAmount),
              transaction_date: entryTimestamp,
              is_deleted: 0,
              orderIndex: 1,
            },
          ];
      if (
        !canWithdrawAtTimestampWithEntries(
          Math.abs(parsedAmount),
          entryTimestamp,
          accountEntries,
          pendingEntries
        )
      ) {
        if (action === 'withdraw' && !scheduleApplied) {
          openLowBalancePrompt();
          return;
        }
        const actionLabel = action === 'transfer' ? 'Transfer' : 'Withdrawal';
        showToast(
          `${actionLabel} not allowed. Balance was insufficient at that time.`,
          'error'
        );
        return;
      }
      if (!needsAutoFund) {
        const balance = calculateAccountBalance(account.id);
        if (parsedAmount > balance) {
          if (action === 'withdraw' && !scheduleApplied) {
            openLowBalancePrompt();
            return;
          }
          showToast('Balance is low. Add amount first to withdraw.', 'error');
          return;
        }
      }
    }

    if (action === 'withdraw') {
      try {
        const accountEntries = getTransactionsByAccount(account.id);
        const balanceAtTimestamp = getBalanceAtTimestampWithEntries(
          accountEntries,
          entryTimestamp
        );
        const freshAccount = getAllAccounts().find(
          acc => String(acc.id) === String(account.id)
        );
        const autoFundEnabled =
          isExpenseAccount &&
          Number((freshAccount || account)?.auto_fund_primary) === 1;
        const needsAutoFund = autoFundEnabled && parsedAmount > balanceAtTimestamp;
        if (needsAutoFund) {
          const shortfall = Math.max(0, parsedAmount - balanceAtTimestamp);
          const autoFunded = await requestFromPrimaryEarning(shortfall);
          if (!autoFunded) {
            return;
          }
        }
        await createTransaction(
          account.id,
          -Math.abs(parsedAmount),
          noteText,
          entryTimestamp
        );
        showToast('Withdrawal recorded successfully', 'success');
        navigation.goBack();
      } catch (error) {
        console.error('Failed to add withdrawal:', error);
        showToast('Failed to add withdrawal. Please try again.', 'error');
      }
      return;
    }

    if (action === 'request') {
      try {
        const accounts = getAllAccounts();
        const targetAccount = accounts.find(
          acc => String(acc.id) === String(transferTargetId)
        );
        if (!targetAccount || targetAccount.account_type !== 'earning') {
          showToast('Please select a valid earning account.', 'error');
          return;
        }
        const entryTimestamp = entryDate?.getTime?.() ?? Date.now();
        const earningEntries = getTransactionsByAccount(targetAccount.id);
        const earningPending = [
          {
            id: 'pending-earning-request',
            amount: -Math.abs(parsedAmount),
            transaction_date: entryTimestamp,
            is_deleted: 0,
            orderIndex: 1,
          },
        ];
        if (
          !canWithdrawAtTimestampWithEntries(
            Math.abs(parsedAmount),
            entryTimestamp,
            earningEntries,
            earningPending
          )
        ) {
          showToast(
            `Request not allowed. ${targetAccount.account_name} had insufficient balance at that time.`,
            'error'
          );
          return;
        }
        const earningBalance = calculateAccountBalance(targetAccount.id);
        if (earningBalance < Math.abs(parsedAmount)) {
          showToast(`Low balance on ${targetAccount.account_name}.`, 'error');
          return;
        }

        const trimmedNote = noteText.trim();
        const fromRemark = trimmedNote
          ? `Requested by ${account.account_name} - ${trimmedNote}`
          : `Requested by ${account.account_name}`;
        const toRemark = trimmedNote
          ? `Requested from ${targetAccount.account_name} - ${trimmedNote}`
          : `Requested from ${targetAccount.account_name}`;

        await createTransaction(
          targetAccount.id,
          -Math.abs(parsedAmount),
          fromRemark,
          entryTimestamp
        );
        await createTransaction(
          account.id,
          Math.abs(parsedAmount),
          toRemark,
          entryTimestamp
        );
        showToast(
          `Amount requested from ${targetAccount.account_name}.`,
          'success'
        );
        navigation.goBack();
      } catch (error) {
        console.error('Failed to request amount:', error);
        showToast('Failed to request amount. Please try again.', 'error');
      }
      return;
    }

    if (action === 'transfer') {
      try {
        const accounts = getAllAccounts();
        const targetAccount = accounts.find(acc => acc.id === transferTargetId);
        if (!targetAccount) {
          showToast('Please select a valid transfer account.', 'error');
          return;
        }
        const toRemark = noteText
          ? `Transferred to ${targetAccount.account_name} - ${noteText}`
          : `Transferred to ${targetAccount.account_name}`;
        const fromRemark = noteText
          ? `Transferred from ${account.account_name} - ${noteText}`
          : `Transferred from ${account.account_name}`;
        await createTransaction(
          account.id,
          -Math.abs(parsedAmount),
          toRemark,
          entryTimestamp
        );
        await createTransaction(
          targetAccount.id,
          Math.abs(parsedAmount),
          fromRemark,
          entryTimestamp
        );
        try {
          await AsyncStorage.setItem(
            LAST_TRANSFER_ACCOUNT_KEY,
            String(targetAccount.id)
          );
        } catch (error) {
          console.warn('Failed to store last transfer account:', error);
        }
        showToast('Transfer completed successfully', 'success');
        navigation.goBack();
      } catch (error) {
        console.error('Failed to transfer:', error);
        showToast('Failed to transfer. Please try again.', 'error');
      }
    }
  };

  const focusAmountInput = () => {
    amountInputRef.current?.focus();
  };

  const focusNoteInput = () => {
    noteInputRef.current?.focus();
  };

  const now = new Date();
  now.setSeconds(0, 0);
  const nowHour = now.getHours();
  const nowMinute = now.getMinutes();

  const dateOptions = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 365);
    const totalDays = 365;
    const items = [];
    for (let i = 0; i <= totalDays; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      items.push(d);
    }
    return items;
  }, []);

  const isSameDate = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const isSameTime = (date, hour, minute) =>
    date.getHours() === hour && date.getMinutes() === minute;

  const formatDateDisplay = value => {
    const day = String(value.getDate()).padStart(2, '0');
    const month = value.toLocaleDateString([], {month: 'short'});
    return `${day} ${month}`;
  };

  const formatTimeDisplay = value => {
    const hours = value.getHours();
    const minutes = value.getMinutes();
    const suffix = hours >= 12 ? 'pm' : 'am';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${String(minutes).padStart(2, '0')}${suffix}`;
  };

  const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const clampToNow = value => {
    if (!value) {
      return value;
    }
    const base = value.getTime() > now.getTime() ? new Date(now) : new Date(value);
    const minute = base.getMinutes();
    base.setMinutes(minute - (minute % 5), 0, 0);
    return base;
  };

  const pickerValue = draftEntryDate ?? entryDate;
  const isTodaySelected = isSameDay(pickerValue, now);

  const hourOptions = useMemo(() => {
    const maxHour = isTodaySelected ? nowHour : 23;
    const items = [];
    for (let hour = 0; hour <= maxHour; hour += 1) {
      const label = String(hour).padStart(2, '0');
      items.push({hour, label});
    }
    return items;
  }, [isTodaySelected, nowHour]);

  const minuteOptions = useMemo(() => {
    const currentHour = pickerValue.getHours();
    const isCurrentHourToday = isTodaySelected && currentHour === nowHour;
    const maxMinute = isCurrentHourToday ? nowMinute : 59;
    const items = [];
    for (let minute = 0; minute <= maxMinute; minute += 5) {
      const label = String(minute).padStart(2, '0');
      items.push({minute, label});
    }
    return items;
  }, [pickerValue, isTodaySelected, nowHour, nowMinute]);

  const findDateIndex = useCallback(
    target =>
      dateOptions.findIndex(option => isSameDate(option, target)),
    [dateOptions],
  );

  const findHourIndex = useCallback(
    hour => hourOptions.findIndex(option => option.hour === hour),
    [hourOptions],
  );

  const findMinuteIndex = useCallback(
    minute => minuteOptions.findIndex(option => option.minute === minute),
    [minuteOptions],
  );

  const scrollToIndexSafe = (ref, index) => {
    if (!ref?.current || index < 0) {
      return;
    }
    try {
      ref.current.scrollToIndex({index, animated: false});
    } catch {
      // ignore scroll errors for short lists
    }
  };

  const openTransferPopup = () => {
    Keyboard.dismiss();
    if (!selectedTransferAccount && transferAccounts.length > 0) {
      setSelectedTransferAccount(transferAccounts[0]);
      setTransferTargetId(transferAccounts[0].id);
    }
    setTransferListExpanded(false);
    setTransferPopupVisible(true);
  };

  const closeTransferPopup = () => setTransferPopupVisible(false);

  const openSchedulePopup = () => {
    setDraftEntryDate(clampToNow(new Date(entryDate)));
    setSchedulePopupVisible(true);
    InteractionManager.runAfterInteractions(() => {
      const base = clampToNow(new Date(entryDate));
      scrollToIndexSafe(dateListRef, findDateIndex(base));
      scrollToIndexSafe(hourListRef, findHourIndex(base.getHours()));
      scrollToIndexSafe(minuteListRef, findMinuteIndex(base.getMinutes()));
    });
  };
  const closeSchedulePopup = () => setSchedulePopupVisible(false);

  const applyDateSelection = selectedDate => {
    const base = draftEntryDate ? new Date(draftEntryDate) : new Date(entryDate);
    const updated = new Date(base);
    updated.setFullYear(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
    );
    setDraftEntryDate(clampToNow(updated));
  };

  const applyTimeSelection = (hour, minute) => {
    const base = draftEntryDate ? new Date(draftEntryDate) : new Date(entryDate);
    const updated = new Date(base);
    updated.setHours(hour, minute, 0, 0);
    setDraftEntryDate(clampToNow(updated));
  };

  const updateDraftDate = nextDate => {
    setDraftEntryDate(clampToNow(nextDate));
  };

  const handleDateScrollEnd = event => {
    const index = Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    const next = dateOptions[index];
    if (!next) {
      return;
    }
    const base = draftEntryDate ? new Date(draftEntryDate) : new Date(entryDate);
    base.setFullYear(next.getFullYear(), next.getMonth(), next.getDate());
    updateDraftDate(base);
  };

  const handleHourScrollEnd = event => {
    const index = Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    const option = hourOptions[index];
    if (!option) {
      return;
    }
    applyTimeSelection(option.hour, pickerValue.getMinutes());
  };

  const handleMinuteScrollEnd = event => {
    const index = Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    const option = minuteOptions[index];
    if (!option) {
      return;
    }
    applyTimeSelection(pickerValue.getHours(), option.minute);
  };

  const handleDateScroll = event => {
    const index = Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    if (index === lastDateIndexRef.current) {
      return;
    }
    lastDateIndexRef.current = index;
    const next = dateOptions[index];
    if (!next) {
      return;
    }
    const base = draftEntryDate ? new Date(draftEntryDate) : new Date(entryDate);
    base.setFullYear(next.getFullYear(), next.getMonth(), next.getDate());
    updateDraftDate(base);
  };

  const handleHourScroll = event => {
    const index = Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    if (index === lastHourIndexRef.current) {
      return;
    }
    lastHourIndexRef.current = index;
    const option = hourOptions[index];
    if (!option) {
      return;
    }
    applyTimeSelection(option.hour, pickerValue.getMinutes());
  };

  const handleMinuteScroll = event => {
    const index = Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    if (index === lastMinuteIndexRef.current) {
      return;
    }
    lastMinuteIndexRef.current = index;
    const option = minuteOptions[index];
    if (!option) {
      return;
    }
    applyTimeSelection(pickerValue.getHours(), option.minute);
  };

  const guardTransferOpen = () => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      showToast('Please enter a valid amount.', 'error');
      return false;
    }
    return true;
  };

  const handleScheduleDone = () => {
    if (draftEntryDate) {
      setEntryDate(clampToNow(new Date(draftEntryDate)));
    }
    setScheduleApplied(true);
    setSchedulePopupVisible(false);
  };

  const scheduleCtaLabel = scheduleApplied
    ? `${formatDateDisplay(entryDate)} ${formatTimeDisplay(entryDate)}`
    : 'Schedule';

  const scheduleDoneLabel = `Set at ${formatDateDisplay(pickerValue)} ${formatTimeDisplay(
    pickerValue,
  )}`;

  const transferPopupTitleText = isRequestMode
    ? 'Select account to request from'
    : 'Select account to transfer from';

  const transferPopupCtaLabel = isRequestMode
    ? amount
      ? `Request ${currencySymbol}${amount}`
      : 'Request'
    : amount
    ? `Transfer ${currencySymbol}${amount}`
    : 'Transfer';

  const transferActionLabel = isRequestMode
    ? 'Request'
    : transferSelected
    ? 'Transfer Now'
    : 'Transfer';

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}>
      <Pressable style={styles.screen} onPress={Keyboard.dismiss} pointerEvents="box-none">
        <View style={styles.container}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={22} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={styles.headerSpacer} />
            </View>

            <View style={styles.centerArea}>
          <Pressable style={styles.tapZone} onPress={focusAmountInput}>
            <View style={styles.amountBlock}>
              <Text style={styles.currencySymbol}>{currencySymbol}</Text>
              <TextInput
                ref={amountInputRef}
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#C0C4CC"
                showSoftInputOnFocus
              />
            </View>
          </Pressable>
          <Pressable style={styles.tapZone} onPress={focusNoteInput}>
            <TextInput
              ref={noteInputRef}
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder="Add note"
              placeholderTextColor={colors.text.light}
              multiline
              numberOfLines={2}
            />
          </Pressable>
          <View style={styles.centerScheduleBlock}>
            <TouchableOpacity
              style={styles.scheduleCta}
              onPress={openSchedulePopup}
              activeOpacity={0.9}>
              <Text style={styles.scheduleCtaText}>{scheduleCtaLabel}</Text>
            </TouchableOpacity>
          </View>
            </View>

          </ScrollView>

          <View style={[styles.bottomArea, {paddingBottom: spacing.lg + insets.bottom}]}>
          {isLedgerFlow ? (
            <AmountActionButton
              label={ledgerAction === 'paid' ? 'Paid' : 'Get'}
              variant="successOutline"
              style={styles.singleActionButton}
              textStyle={styles.addText}
              onPress={() => handleSubmit('add')}
            />
          ) : isWithdrawMode ? (
            <>

              <View style={styles.actionRow}>
                {!transferOnly && (
                  <AmountActionButton
                    label="Withdraw"
                    variant="dangerOutline"
                    style={styles.actionButton}
                    textStyle={styles.withdrawText}
                    onPress={() => handleSubmit('withdraw')}
                  />
                )}
                {!isExpenseAccount && (
                  <AmountActionButton
                    label={transferActionLabel}
                    variant="primaryOutline"
                    style={styles.actionButton}
                    textStyle={styles.transferText}
                    onPress={() => {
                      if (!guardTransferOpen()) {
                        return;
                      }
                      if (!transferSelected) {
                        setTransferSelected(true);
                        openTransferPopup();
                        return;
                      }
                      openTransferPopup();
                    }}
                  />
                )}
              </View>
            </>
          ) : isRequestMode ? (
            <View style={styles.actionRow}>
              <AmountActionButton
                label={transferActionLabel}
                variant="primaryOutline"
                style={styles.actionButton}
                textStyle={styles.transferText}
                onPress={() => {
                  if (!guardTransferOpen()) {
                    return;
                  }
                  openTransferPopup();
                }}
              />
            </View>
          ) : (
            <AmountActionButton
              label="Add Amount"
              variant="successOutline"
              style={styles.singleActionButton}
              textStyle={styles.addText}
              onPress={() => handleSubmit('add')}
            />
          )}
            </View>

          {transferPopupVisible && (
          <View style={styles.transferOverlay}>
            <Pressable style={styles.transferBackdrop} onPress={closeTransferPopup} />
            <View style={styles.transferSheet}>
              <View style={styles.transferSheetHeader}>
                <TouchableOpacity
                  onPress={closeTransferPopup}
                  style={styles.transferSheetClose}>
                  <Icon name="arrow-back" size={22} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.transferSheetTitle}>{transferPopupTitleText}</Text>
              </View>

              <TouchableOpacity
                style={styles.transferSelectedRow}
                activeOpacity={0.85}
                onPress={() => setTransferListExpanded(prev => !prev)}>
                <View
                  style={[
                    styles.transferAccountIconWrap,
                    {
                      backgroundColor:
                        selectedTransferAccount?.icon_color || colors.secondary,
                    },
                  ]}>
                  {renderAccountIcon(
                    selectedTransferAccount?.icon || 'wallet',
                    22,
                    selectedTransferAccount?.icon_color ? colors.white : colors.text.primary
                  )}
                </View>
                <View style={styles.transferAccountText}>
                  <Text style={styles.transferAccountName}>
                    {selectedTransferAccount?.account_name || 'Select account'}
                  </Text>
                  <Text style={styles.transferAccountSub}>
                    {selectedTransferAccount
                      ? getAccountTypeLabel(selectedTransferAccount.account_type)
                      : 'Tap to choose account'}
                  </Text>
                </View>
                <Icon
                  name={transferListExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={colors.text.secondary}
                />
              </TouchableOpacity>

              {transferListExpanded && (
                <View style={styles.transferListBox}>
                  <FlatList
                    data={transferAccounts}
                    keyExtractor={item => String(item.id)}
                    showsVerticalScrollIndicator={false}
                    renderItem={({item}) => {
                      const selected = selectedTransferAccount?.id === item.id;
                      return (
                        <TouchableOpacity
                          style={[
                            styles.transferListRow,
                            selected && styles.transferListRowSelected,
                          ]}
                          onPress={() => {
                            setSelectedTransferAccount(item);
                            setTransferTargetId(item.id);
                            setTransferListExpanded(false);
                          }}>
                          <View
                            style={[
                              styles.transferAccountIconWrap,
                              {backgroundColor: item.icon_color || colors.secondary},
                            ]}>
                            {renderAccountIcon(
                              item.icon || 'wallet',
                              20,
                              item.icon_color ? colors.white : colors.text.primary
                            )}
                          </View>
                          <View style={styles.transferAccountText}>
                            <Text style={styles.transferAccountName}>{item.account_name}</Text>
                            <Text style={styles.transferAccountSub}>
                              {getAccountTypeLabel(item.account_type)}
                            </Text>
                          </View>
                          {selected && (
                            <View style={styles.transferSelectedTick}>
                              <Icon name="checkmark" size={14} color="#FFFFFF" />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    }}
                  />
                </View>
              )}

              <TouchableOpacity
                style={styles.transferPrimaryButton}
                activeOpacity={0.85}
                disabled={!selectedTransferAccount}
                onPress={() => {
                  if (!selectedTransferAccount) {
                    showToast('Please select an account.', 'error');
                    return;
                  }
                  setTransferTargetId(selectedTransferAccount.id);
                  closeTransferPopup();
                  handleSubmit(isRequestMode ? 'request' : 'transfer');
                }}>
                <Text style={styles.transferPrimaryButtonText}>
                  {transferPopupCtaLabel}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

          {schedulePopupVisible && (
          <View style={styles.scheduleOverlay}>
            <Pressable style={styles.scheduleBackdrop} onPress={closeSchedulePopup} />
            <View style={styles.schedulePanel}>
              <View style={styles.scheduleHeader}>
                <TouchableOpacity
                  onPress={closeSchedulePopup}
                  style={styles.scheduleCloseButton}>
                  <Icon name="close" size={20} color={colors.text.primary} />
                </TouchableOpacity>
              </View>

                <View style={styles.schedulePickerBox}>
                <View style={styles.schedulePickerSelectionBarTop} />
                <View style={styles.schedulePickerSelectionBarBottom} />
                <View style={styles.schedulePickerColumn}>
                  <FlatList
                    ref={dateListRef}
                    data={dateOptions}
                    keyExtractor={item => item.toISOString()}
                    style={styles.schedulePickerList}
                    contentContainerStyle={styles.schedulePickerListContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    initialNumToRender={24}
                    maxToRenderPerBatch={24}
                    windowSize={7}
                    removeClippedSubviews
                    getItemLayout={(_, index) => ({
                      length: ITEM_HEIGHT,
                      offset: ITEM_HEIGHT * index,
                      index,
                    })}
                    snapToInterval={ITEM_HEIGHT}
                    decelerationRate="fast"
                    onMomentumScrollEnd={handleDateScrollEnd}
                    onScrollEndDrag={handleDateScrollEnd}
                    onScroll={handleDateScroll}
                    scrollEventThrottle={16}
                    renderItem={({item: optionDate}) => {
                      const selected = isSameDate(pickerValue, optionDate);
                      return (
                        <Pressable
                          style={[
                            styles.inlinePickerItem,
                            selected && styles.inlinePickerItemSelected,
                          ]}
                          onPress={() => applyDateSelection(optionDate)}>
                          <Text
                            style={[
                              styles.inlinePickerItemText,
                              selected && styles.inlinePickerItemTextSelected,
                            ]}>
                            {formatDateDisplay(optionDate)}
                          </Text>
                        </Pressable>
                      );
                    }}
                  />
                </View>
                <View style={styles.schedulePickerColumn}>
                  <FlatList
                    ref={hourListRef}
                    data={hourOptions}
                    keyExtractor={item => `${item.hour}`}
                    style={styles.schedulePickerList}
                    contentContainerStyle={styles.schedulePickerListContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    initialNumToRender={24}
                    maxToRenderPerBatch={24}
                    windowSize={7}
                    removeClippedSubviews
                    getItemLayout={(_, index) => ({
                      length: ITEM_HEIGHT,
                      offset: ITEM_HEIGHT * index,
                      index,
                    })}
                    snapToInterval={ITEM_HEIGHT}
                    decelerationRate="fast"
                    onMomentumScrollEnd={handleHourScrollEnd}
                    onScrollEndDrag={handleHourScrollEnd}
                    onScroll={handleHourScroll}
                    scrollEventThrottle={16}
                    renderItem={({item}) => {
                      const selected = pickerValue.getHours() === item.hour;
                      return (
                        <Pressable
                          style={[
                            styles.inlinePickerItem,
                            selected && styles.inlinePickerItemSelected,
                          ]}
                          onPress={() =>
                            applyTimeSelection(item.hour, pickerValue.getMinutes())
                          }>
                          <Text
                            style={[
                              styles.inlinePickerItemText,
                              selected && styles.inlinePickerItemTextSelected,
                            ]}>
                            {item.label}
                          </Text>
                        </Pressable>
                      );
                    }}
                  />
                </View>
                <View style={styles.schedulePickerColumn}>
                  <FlatList
                    ref={minuteListRef}
                    data={minuteOptions}
                    keyExtractor={item => `${item.minute}`}
                    style={styles.schedulePickerList}
                    contentContainerStyle={styles.schedulePickerListContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    initialNumToRender={24}
                    maxToRenderPerBatch={24}
                    windowSize={7}
                    removeClippedSubviews
                    getItemLayout={(_, index) => ({
                      length: ITEM_HEIGHT,
                      offset: ITEM_HEIGHT * index,
                      index,
                    })}
                    snapToInterval={ITEM_HEIGHT}
                    decelerationRate="fast"
                    onMomentumScrollEnd={handleMinuteScrollEnd}
                    onScrollEndDrag={handleMinuteScrollEnd}
                    onScroll={handleMinuteScroll}
                    scrollEventThrottle={16}
                    renderItem={({item}) => {
                      const selected = pickerValue.getMinutes() === item.minute;
                      return (
                        <Pressable
                          style={[
                            styles.inlinePickerItem,
                            selected && styles.inlinePickerItemSelected,
                          ]}
                          onPress={() =>
                            applyTimeSelection(pickerValue.getHours(), item.minute)
                          }>
                          <Text
                            style={[
                              styles.inlinePickerItemText,
                              selected && styles.inlinePickerItemTextSelected,
                            ]}>
                            {item.label}
                          </Text>
                        </Pressable>
                      );
                    }}
                  />
                </View>
              </View>

              <AmountActionButton
                label={scheduleDoneLabel}
                variant="primaryOutline"
                style={styles.scheduleDoneButton}
                textStyle={styles.scheduleDoneText}
                onPress={handleScheduleDone}
              />
            </View>
          </View>
        )}
        </View>
      </Pressable>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerButton: {
    padding: 6,
  },
  headerTitle: {
    fontSize: fontSize.large,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  headerSpacer: {
    width: 34,
  },
  centerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl * 1.6,
  },
  tapZone: {
    alignItems: 'center',
  },
  centerScheduleBlock: {
    width: '100%',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  scheduleCta: {
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: '#EFF6FF',
  },
  scheduleCtaText: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  amountBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencySymbol: {
    fontSize: 28,
    color: '#9CA3AF',
    marginRight: 6,
  },
  amountInput: {
    fontSize: 48,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    minWidth: 120,
    textAlign: 'center',
    paddingVertical: 4,
  },
  bottomArea: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    marginTop: 'auto',
  },
  panel: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 6},
    elevation: 8,
    gap: spacing.sm,
  },
  entryDateTimeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  entryDateTimeButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  entryDateTimeButtonActive: {
    borderColor: colors.primary,
    backgroundColor: '#EFF6FF',
  },
  entryDateTimeLabel: {
    fontSize: fontSize.small,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  entryDateTimeValue: {
    fontSize: fontSize.medium,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  inlinePickerList: {
    marginTop: spacing.xs,
    maxHeight: 180,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  inlinePickerItem: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 0,
    borderRadius: 10,
    marginHorizontal: 6,
  },
  inlinePickerItemSelected: {
    backgroundColor: 'transparent',
    transform: [{scale: 1.1}],
  },
  inlinePickerItemText: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '500',
    textAlign: 'center',
    opacity: 0.4,
  },
  inlinePickerItemTextSelected: {
    color: '#3B82F6',
    fontWeight: '700',
    opacity: 1,
    fontSize: 18,
  },
  scheduleOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 9999,
    elevation: 9999,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
  },
  transferOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 9999,
    elevation: 9999,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  transferBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  scheduleBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
  },
  schedulePanel: {
    zIndex: 10000,
    elevation: 10000,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
    maxHeight: '62%',
    marginBottom: 0,
    shadowColor: '#0F172A',
    shadowOffset: {width: 0, height: -8},
    shadowOpacity: 0.25,
    shadowRadius: 32,
  },
  scheduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: spacing.xs,
  },
  scheduleCloseButton: {
    padding: 4,
  },
  schedulePickerBox: {
    position: 'relative',
    flexDirection: 'row',
    gap: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    maxHeight: 260,
    overflow: 'hidden',
    shadowColor: '#475569',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  schedulePickerSelectionBarTop: {
    position: 'absolute',
    top: '50%',
    left: spacing.xs,
    right: spacing.xs,
    height: 2,
    marginTop: -(ITEM_HEIGHT / 2) - 2,
    backgroundColor: '#3B82F6',
    borderRadius: 2,
    opacity: 0.7,
  },
  schedulePickerSelectionBarBottom: {
    position: 'absolute',
    top: '50%',
    left: spacing.xs,
    right: spacing.xs,
    height: 2,
    marginTop: (ITEM_HEIGHT / 2) + 8,
    backgroundColor: '#3B82F6',
    borderRadius: 2,
    opacity: 0.7,
  },
  transferPopupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: spacing.xs,
  },
  transferPopupCloseButton: {
    position: 'absolute',
    right: 0,
    top: 0,
  },
  transferPopupPanel: {
    transform: [{translateY: 56}],
  },
  transferPopupTitle: {
    fontSize: fontSize.xLarge,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: spacing.sm,
  },
  transferList: {
    maxHeight: 320,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    shadowColor: '#475569',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  transferListContent: {
    paddingVertical: spacing.xs,
  },
  transferListItem: {
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  transferListItemSelected: {
    backgroundColor: '#EFF6FF',
  },
  transferListItemText: {
    fontSize: 15,
    color: colors.text.primary,
  },
  transferListItemTextSelected: {
    color: '#3B82F6',
    fontWeight: '700',
  },
  transferConfirmButton: {
    marginTop: spacing.xs,
    backgroundColor: '#3B82F6',
    borderWidth: 0,
    borderRadius: 20,
    shadowColor: '#3B82F6',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  transferConfirmText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  transferSheet: {
    zIndex: 10000,
    elevation: 10000,
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
    marginBottom: 0,
    shadowColor: '#0F172A',
    shadowOffset: {width: 0, height: -8},
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  transferSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  transferSheetClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2E8F0',
  },
  transferSheetTitle: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '600',
  },
  transferSelectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  transferAccountIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transferAccountText: {
    flex: 1,
  },
  transferAccountName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  transferAccountSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  transferListBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    maxHeight: 240,
    overflow: 'hidden',
  },
  transferListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  transferListRowSelected: {
    backgroundColor: '#EFF6FF',
  },
  transferSelectedTick: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transferAddBank: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
  },
  transferAddBankText: {
    fontSize: 13,
    color: '#93C5FD',
    fontWeight: '600',
  },
  transferPrimaryButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
  },
  transferPrimaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  schedulePickerColumn: {
    flex: 1,
    zIndex: 10,
    position: 'relative',
    elevation: 10,
  },
  schedulePickerList: {
    height: LIST_HEIGHT,
  },
  schedulePickerListContent: {
    paddingVertical: LIST_PADDING,
  },
  scheduleDoneButton: {
    marginTop: spacing.xs,
    backgroundColor: '#3B82F6',
    borderWidth: 0,
    borderRadius: 20,
    shadowColor: '#3B82F6',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  scheduleDoneText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  transferPickerBlock: {
    gap: 6,
  },
  transferLabel: {
    fontSize: fontSize.small,
    color: colors.text.secondary,
    fontWeight: fontWeight.semibold,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  noteInput: {
    fontSize: fontSize.medium,
    color: colors.text.primary,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    width: '82%',
    textAlign: 'center',
    marginTop: spacing.sm,
    minHeight: 44,
    textAlignVertical: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  actionButton: {
    flex: 1,
  },
  singleActionButton: {
    borderColor: '#4ADE80',
  },
  addText: {
    color: '#16A34A',
  },
  withdrawText: {
    color: '#EF4444',
  },
  transferText: {
    color: '#1D4ED8',
  },
});

export default AmountEntryScreen;


