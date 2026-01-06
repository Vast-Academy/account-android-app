import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  Animated,
  Easing,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  HandDeposit as PiHandDepositLight,
  HandWithdraw as PiHandWithdrawLight,
} from 'phosphor-react-native';
import {colors, spacing, fontSize, fontWeight} from '../utils/theme';
import {
  initTransactionsDatabase,
  createTransaction,
  getTransactionsByAccount,
  calculateAccountBalance,
  deleteTransactionsByAccount,
} from '../services/transactionsDatabase';
import {deleteAccount, getAccountsByType} from '../services/accountsDatabase';

const QUICK_PERIODS = [
  {label: 'This Week', value: '1week'},
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

const LiabilityAccountDetailScreen = ({route, navigation}) => {
  const account = route?.params?.account || {
    id: null,
    account_name: '',
    is_primary: 0,
  };

  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [requestModalVisible, setRequestModalVisible] = useState(false);
  const [requestSelectVisible, setRequestSelectVisible] = useState(false);
  const [requestAmount, setRequestAmount] = useState('');
  const [requestAccounts, setRequestAccounts] = useState([]);
  const [requestAmountValue, setRequestAmountValue] = useState(0);
  const [lowBalanceVisible, setLowBalanceVisible] = useState(false);
  const [lowBalanceMessage, setLowBalanceMessage] = useState('');
  const [quickPeriod, setQuickPeriod] = useState('1month');
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [showQuickDropdown, setShowQuickDropdown] = useState(false);
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [availableYears, setAvailableYears] = useState([]);
  const [filteredAdded, setFilteredAdded] = useState(0);
  const [filteredWithdrawals, setFilteredWithdrawals] = useState(0);
  const [monthStartDay, setMonthStartDay] = useState(DEFAULT_MONTH_START_DAY);
  const scrollViewRef = useRef(null);
  const lowBalanceTimerRef = useRef(null);
  const modalSlideAnim = useRef(new Animated.Value(0)).current;

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
    if (withdrawModalVisible || requestModalVisible || requestSelectVisible) {
      Animated.timing(modalSlideAnim, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      modalSlideAnim.setValue(0);
    }
  }, [withdrawModalVisible, requestModalVisible, requestSelectVisible, modalSlideAnim]);

  useEffect(() => {
    return () => {
      if (lowBalanceTimerRef.current) {
        clearTimeout(lowBalanceTimerRef.current);
      }
    };
  }, []);

  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return false;
    }

    setLoading(true);
    try {
      const amountValue = Math.abs(parseFloat(withdrawAmount));
      await createTransaction(account.id, -amountValue, '');
      Alert.alert('Success', 'Transaction added successfully!');
      setWithdrawAmount('');
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
    const earningAccounts = getAccountsByType('earning');
    if (!earningAccounts || earningAccounts.length === 0) {
      Alert.alert('No Accounts', 'No earning accounts available for request.');
      return false;
    }

    setRequestAmountValue(amountValue);
    setRequestAccounts(earningAccounts);
    setRequestSelectVisible(true);
    return true;
  };

  const handleRequestFromAccount = async earningAccount => {
    if (!earningAccount || !requestAmountValue) {
      return;
    }
    setLoading(true);
    try {
      const earningBalance = calculateAccountBalance(earningAccount.id);
      if (earningBalance < requestAmountValue) {
        setLowBalanceMessage(
          `Low balance on ${earningAccount.account_name}.`
        );
        setLowBalanceVisible(true);
        if (lowBalanceTimerRef.current) {
          clearTimeout(lowBalanceTimerRef.current);
        }
        lowBalanceTimerRef.current = setTimeout(() => {
          setLowBalanceVisible(false);
        }, 1600);
        return;
      }

      await createTransaction(
        earningAccount.id,
        -requestAmountValue,
        `Requested by ${account.account_name}`
      );
      await createTransaction(
        account.id,
        requestAmountValue,
        `Requested from ${earningAccount.account_name}`
      );
      setRequestAmount('');
      setRequestAmountValue(0);
      setRequestSelectVisible(false);
      loadTransactions();
      Alert.alert('Success', 'Request completed successfully!');
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
        const day = now.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        const monday = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + diff
        );
        monday.setHours(0, 0, 0, 0);
        startTime = monday.getTime();
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
    setShowQuickDropdown(false);
  };

  const handleMonthSelect = month => {
    setSelectedMonth(month);
    setShowMonthDropdown(false);
  };

  const handleYearSelect = year => {
    setSelectedYear(year);
    setShowYearDropdown(false);
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
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
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
        <TouchableOpacity
          onPress={() => {
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
          }}
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
                      setShowQuickDropdown(!showQuickDropdown);
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
                  onPress={() => setShowMonthDropdown(!showMonthDropdown)}>
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
                  onPress={() => setShowYearDropdown(!showYearDropdown)}>
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
                  <View
                    style={[
                      styles.accountMetricIcon,
                      {
                        backgroundColor:
                          account.icon_color ||
                          (account.account_type === 'liability'
                            ? '#F59E0B'
                            : '#10B981'),
                      },
                    ]}>
                    <PiHandDepositLight size={24} color="#FFFFFF" weight="light" />
                  </View>
                  <Text style={styles.accountMetricLabel}>Added</Text>
                </View>
                <Text
                  style={[
                    styles.accountMetricValue,
                    styles.accountMetricValueIndented,
                    account.icon_color && {color: account.icon_color},
                  ]}>
                  {formatCurrency(filteredAdded)}
                </Text>
              </View>
              <View style={styles.accountMetricDivider} />
              <View style={styles.accountMetricHalf}>
                <View style={styles.accountMetricLabelRow}>
                  <View
                    style={[
                      styles.accountMetricIcon,
                      styles.accountMetricIconNegative,
                    ]}>
                    <PiHandWithdrawLight size={24} color="#FFFFFF" weight="light" />
                  </View>
                  <Text style={styles.accountMetricLabel}>Withdrawals</Text>
                </View>
                <Text
                  style={[
                    styles.accountMetricValue,
                    styles.accountMetricValueIndented,
                    styles.accountMetricNegative,
                  ]}>
                  {formatCurrency(filteredWithdrawals)}
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

      {lowBalanceVisible && (
        <View style={styles.toastContainer}>
          <View style={styles.toast}>
            <Text style={styles.toastText}>{lowBalanceMessage}</Text>
          </View>
        </View>
      )}

      {/* Bottom Fixed Section */}
      <View style={styles.bottomSection}>
        {/* Bottom Navigation Icons */}
        <View style={styles.bottomNav}>
          <TouchableOpacity
            style={styles.bottomNavIcon}
            onPress={() => Alert.alert('Notes', 'Notes feature coming soon')}>
            <Icon name="document-text-outline" size={24} color={colors.text.secondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bottomNavIcon}
            onPress={() => Alert.alert('Messages', 'Messages feature coming soon')}>
            <Icon name="chatbubble-outline" size={24} color={colors.text.secondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bottomNavIcon}
            onPress={() => Alert.alert('Call', 'Call feature coming soon')}>
            <Icon name="call-outline" size={24} color={colors.text.secondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bottomNavIcon}
            onPress={() => Alert.alert('WhatsApp', 'WhatsApp feature coming soon')}>
            <Icon name="logo-whatsapp" size={24} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Balance Display */}
        <View style={styles.balanceRow}>
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <View style={styles.balanceAmount}>
              <Text
                style={[
                  styles.balanceValue,
                  account.icon_color && {color: account.icon_color},
                ]}>
                {formatCurrency(totalBalance)}
              </Text>
              <Icon
                name="chevron-forward"
                size={20}
                color={account.icon_color || '#10B981'}
              />
          </View>
        </View>

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
        onRequestClose={() => setWithdrawModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setWithdrawModalVisible(false)}
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
              editable={!loading}
            />
            <TouchableOpacity
              style={[styles.modalAddButton, loading && styles.buttonDisabled]}
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
        onRequestClose={() => setRequestModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setRequestModalVisible(false)}
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
            <Text style={styles.modalTitle}>Request Amount</Text>
            <TextInput
              style={styles.modalAmountInput}
              value={requestAmount}
              onChangeText={setRequestAmount}
              keyboardType="numeric"
              editable={!loading}
            />
            <TouchableOpacity
              style={[styles.modalAddButton, loading && styles.buttonDisabled]}
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
          </Animated.View>
        </View>
      </Modal>

      <Modal
        visible={requestSelectVisible}
        transparent
        animationType="none"
        onRequestClose={() => setRequestSelectVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setRequestSelectVisible(false)}
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
            <Text style={styles.modalTitle}>Select Earning Account</Text>
            <ScrollView style={styles.transferList} showsVerticalScrollIndicator={false}>
              {requestAccounts.map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.transferItem}
                  onPress={() => handleRequestFromAccount(item)}>
                  <Text style={styles.transferName}>{item.account_name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      <Modal
        visible={showQuickDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQuickDropdown(false)}>
        <TouchableOpacity
          style={styles.periodOverlay}
          activeOpacity={1}
          onPress={() => setShowQuickDropdown(false)}>
          <View style={styles.periodDropdownModal}>
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
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showMonthDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMonthDropdown(false)}>
        <TouchableOpacity
          style={styles.periodOverlay}
          activeOpacity={1}
          onPress={() => setShowMonthDropdown(false)}>
          <View style={styles.periodDropdownModalScrollable}>
            <ScrollView showsVerticalScrollIndicator={true}>
              {selectedMonth !== null && (
                <TouchableOpacity
                  style={styles.periodDropdownOptionClear}
                  onPress={() => {
                    setSelectedMonth(null);
                    setShowMonthDropdown(false);
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
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showYearDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowYearDropdown(false)}>
        <TouchableOpacity
          style={styles.periodOverlay}
          activeOpacity={1}
          onPress={() => setShowYearDropdown(false)}>
          <View style={styles.periodDropdownModalScrollable}>
            <ScrollView showsVerticalScrollIndicator={true}>
              {selectedYear !== null && (
                <TouchableOpacity
                  style={styles.periodDropdownOptionClear}
                  onPress={() => {
                    setSelectedYear(null);
                    setShowYearDropdown(false);
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
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
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
    fontSize: fontSize.small,
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
    backgroundColor: '#F3F4F6',
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
    paddingVertical: spacing.sm,
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
    paddingVertical: spacing.sm,
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
});

export default LiabilityAccountDetailScreen;








