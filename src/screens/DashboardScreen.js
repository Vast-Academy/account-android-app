import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Platform,
  ToastAndroid,
  Alert,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import {
  HandDeposit as PiHandDepositLight,
  HandWithdraw as PiHandWithdrawLight,
} from 'phosphor-react-native';
import {colors, spacing, fontSize, fontWeight} from '../utils/theme';
import AddAccountModal from '../components/AddAccountModal';
import {initAccountsDatabase, getAllAccounts} from '../services/accountsDatabase';
import {
  initTransactionsDatabase,
  calculateAccountBalance,
  getTransactionsByAccount,
} from '../services/transactionsDatabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Quick Period Options
const QUICK_PERIODS = [
  {label: 'This Week', value: '1week'},
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

const METRIC_ICON_SIZE = 28;
const METRIC_LABEL_GAP = 6;
const METRIC_LABEL_OFFSET = METRIC_ICON_SIZE + METRIC_LABEL_GAP;

const DashboardScreen = ({route, navigation}) => {
  const {user} = route.params || {};

  // Period selection states
  const [quickPeriod, setQuickPeriod] = useState('1month');
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [showQuickDropdown, setShowQuickDropdown] = useState(false);
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);

  // Available years (will be populated from transactions)
  const [availableYears, setAvailableYears] = useState([]);

  // Filtered data states
  const [filteredEarning, setFilteredEarning] = useState(0);
  const [filteredWithdrawals, setFilteredWithdrawals] = useState(0);
  const [hasRecords, setHasRecords] = useState(true);

  // Other states
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [pinnedAccountIds, setPinnedAccountIds] = useState([]);
  const [accountOrderIds, setAccountOrderIds] = useState([]);
  const [monthStartDay, setMonthStartDay] = useState(DEFAULT_MONTH_START_DAY);

  // Initialize database and load accounts on mount
  useEffect(() => {
    try {
      initAccountsDatabase();
      initTransactionsDatabase();
      loadMonthStartDay();
      loadPinnedAccounts();
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

  useEffect(() => {
    if (accountOrderIds.length === 0) {
      return;
    }
    runPinReorderAnimation();
    setAccounts(current =>
      sortAccountsByPinned(current, pinnedAccountIds, accountOrderIds)
    );
  }, [pinnedAccountIds, accountOrderIds]);

  const loadPinnedAccounts = async () => {
    try {
      const stored = await AsyncStorage.getItem('pinnedAccountIds');
      if (stored) {
        const parsed = JSON.parse(stored);
        setPinnedAccountIds(Array.isArray(parsed) ? parsed : []);
      }
    } catch (error) {
      console.error('Failed to load pinned accounts:', error);
    }
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

  const sortAccountsByPinned = (accountsList, pinnedIds, orderIds) => {
    if (!accountsList || accountsList.length === 0) {
      return [];
    }
    if (!pinnedIds || pinnedIds.length === 0) {
      if (!orderIds || orderIds.length === 0) {
        return accountsList;
      }
      const orderMap = new Map();
      orderIds.forEach((id, index) => {
        orderMap.set(id, index);
      });
      return [...accountsList].sort(
        (first, second) =>
          (orderMap.get(first.id) ?? 0) - (orderMap.get(second.id) ?? 0)
      );
    }
    const pinnedOrder = new Map();
    pinnedIds.forEach((id, index) => {
      pinnedOrder.set(id, index);
    });
    const orderMap = new Map();
    if (orderIds && orderIds.length > 0) {
      orderIds.forEach((id, index) => {
        orderMap.set(id, index);
      });
    }
    const pinned = [];
    const unpinned = [];
    accountsList.forEach(account => {
      if (pinnedOrder.has(account.id)) {
        pinned.push(account);
      } else {
        unpinned.push(account);
      }
    });
    pinned.sort(
      (first, second) =>
        pinnedOrder.get(first.id) - pinnedOrder.get(second.id)
    );
    if (orderMap.size > 0) {
      unpinned.sort(
        (first, second) =>
          (orderMap.get(first.id) ?? 0) - (orderMap.get(second.id) ?? 0)
      );
    }
    return [...pinned, ...unpinned];
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
      setAccountOrderIds(accountsList.map(account => account.id));
      setAccounts(
        sortAccountsByPinned(
          accountsWithBalance,
          pinnedAccountIds,
          accountsList.map(account => account.id)
        )
      );
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

  // Calculate data for Quick Period
  const calculateQuickPeriodData = period => {
    try {
      const now = new Date();
      let startTime;
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

      let earning = 0;
      let withdrawals = 0;
      let recordCount = 0;

      const accountsList = getAllAccounts();
      accountsList.forEach(account => {
        const txns = getTransactionsByAccount(account.id);
        txns.forEach(txn => {
          if (
            txn.transaction_date >= startTime &&
            (endTime === null || txn.transaction_date <= endTime)
          ) {
            recordCount++;
            const amount = Number(txn.amount) || 0;
            if (amount > 0 && account.account_type === 'earning') {
              earning += amount;
            }
            if (amount < 0) {
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
          if (
            txn.transaction_date >= startTime &&
            txn.transaction_date <= endTime
          ) {
            recordCount++;
            const amount = Number(txn.amount) || 0;
            if (amount > 0 && account.account_type === 'earning') {
              earning += amount;
            }
            if (amount < 0) {
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
    setShowQuickDropdown(false);
    // Data will update via useEffect
  };

  // Handle Month selection
  const handleMonthSelect = month => {
    setSelectedMonth(month);
    setShowMonthDropdown(false);
    // Data will update via useEffect if year is also selected
  };

  // Handle Year selection
  const handleYearSelect = year => {
    setSelectedYear(year);
    setShowYearDropdown(false);
    // Data will update via useEffect if month is also selected
  };

  const formatCurrency = amount => {
    return `\u20B9 ${amount.toLocaleString('en-IN')}`;
  };

  const formatCurrencyRupee = amount => {
    const sign = amount < 0 ? '-' : '';
    const absAmount = Math.abs(amount);
    return `${sign}\u20B9 ${absAmount.toLocaleString('en-IN')}`;
  };

  const togglePinAccount = async account => {
    if (!account) {
      return;
    }
    const isPinned = pinnedAccountIds.includes(account.id);
    const updated = isPinned
      ? pinnedAccountIds.filter(id => id !== account.id)
      : [account.id, ...pinnedAccountIds];
    runPinReorderAnimation();
    setPinnedAccountIds(updated);
    setAccounts(current =>
      sortAccountsByPinned(current, updated, accountOrderIds)
    );
    if (Platform.OS === 'android') {
      ToastAndroid.show(
        isPinned ? 'Account unpinned' : 'Account pinned to top',
        ToastAndroid.SHORT
      );
    } else {
      Alert.alert(
        isPinned ? 'Unpinned' : 'Pinned',
        isPinned ? 'Account unpinned' : 'Account pinned to top'
      );
    }
    try {
      await AsyncStorage.setItem('pinnedAccountIds', JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save pinned accounts:', error);
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
                      {backgroundColor: '#10B981'},
                    ]}>
                    <PiHandDepositLight size={24} color="#FFFFFF" weight="light" />
                  </View>
                  <Text style={styles.accountMetricLabel}>Added</Text>
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
                  {formatCurrencyRupee(filteredWithdrawals)}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {!hasRecords && (
          <View style={styles.noRecordsContainer}>
            <Icon name="calendar-outline" size={48} color="#D1D5DB" />
            <Text style={styles.noRecordsText}>No records for this period</Text>
            <Text style={styles.noRecordsSubtext}>
              Try selecting a different period
            </Text>
          </View>
        )}

        {/* My Accounts */}
        <View style={styles.accountsSection}>
          <Text style={styles.sectionTitle}>My Accounts</Text>
          {accounts.length > 0 ? (
            <View style={styles.accountsList}>
              {accounts.map(account => (
                <TouchableOpacity
                  key={account.id}
                  style={styles.accountItem}
                  onPress={() => {
                    // Navigate to different screens based on account type
                    if (account.account_type === 'earning') {
                      navigation.navigate('AccountDetail', {account});
                    } else {
                      navigation.navigate('LiabilityAccountDetail', {account});
                    }
                  }}>
                  <View style={styles.pinnedBar}>
                    <TouchableOpacity
                      style={[
                        styles.pinnedButton,
                        pinnedAccountIds.includes(account.id)
                          ? styles.pinnedButtonActive
                          : styles.pinnedButtonInactive,
                      ]}
                      onPress={() => togglePinAccount(account)}>
                      <MaterialIcon
                        name="push-pin"
                        size={16}
                        color={
                          pinnedAccountIds.includes(account.id)
                            ? '#374151'
                            : '#374151'
                        }
                      />
                    </TouchableOpacity>
                      <View style={styles.titleBadges}>
                        <View
                          style={[
                            styles.accountBadge,
                            {
                              backgroundColor:
                                account.icon_color ||
                                (account.account_type === 'earning'
                                  ? '#D1FAE5'
                                  : '#FEF3C7'),
                            },
                          ]}>
                          <Text
                            style={[
                              styles.accountBadgeText,
                              {
                                color:
                                  account.icon_color
                                    ? colors.white
                                    : account.account_type === 'earning'
                                      ? '#10B981'
                                      : '#F59E0B',
                              },
                            ]}>
                          {account.account_type === 'earning'
                            ? 'Earning'
                            : 'Liability'}
                        </Text>
                      </View>
                      {account.is_primary === 1 && (
                        <View style={styles.primaryBadge}>
                          <Text style={styles.primaryBadgeText}>Primary</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={styles.accountRow}>
                    {/* Account Icon */}
                      <View
                      style={[
                        styles.accountIcon,
                        {
                          backgroundColor:
                            account.icon_color ||
                            (account.account_type === 'earning'
                              ? '#D1FAE5'
                              : '#FEF3C7'),
                        },
                      ]}>
                      <Icon
                        name={
                          account.icon ||
                          (account.account_type === 'earning'
                            ? 'trending-up'
                            : 'wallet')
                        }
                        size={22}
                        color={account.icon_color ? colors.white : colors.text.primary}
                      />
                    </View>

                    {/* Account Details */}
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
                              account.icon_color && {color: account.icon_color},
                            ]}>
                            {formatCurrency(account.balance || 0)}
                          </Text>
                        </Text>
                      <Text style={styles.accountDate}>
                        Created on{' '}
                        {new Date(account.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.emptyAccounts}>
              <Icon name="wallet-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>No accounts yet</Text>
              <Text style={styles.emptySubtext}>
                Create your first account to get started
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowAddAccountModal(true)}>
        <Icon name="person-add" size={22} color={colors.white} />
      </TouchableOpacity>

      {/* Add Account Modal */}
      <AddAccountModal
        visible={showAddAccountModal}
        onClose={() => setShowAddAccountModal(false)}
        onSuccess={() => {
          // Refresh accounts list
          console.log('Account added successfully - refreshing list');
          loadAccounts();
        }}
      />

      {/* Quick Period Dropdown Modal */}
      <Modal
        visible={showQuickDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQuickDropdown(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowQuickDropdown(false)}>
          <View style={styles.dropdownModal}>
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
                    quickPeriod === period.value &&
                      styles.dropdownOptionTextActive,
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

      {/* Month Dropdown Modal */}
      <Modal
        visible={showMonthDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMonthDropdown(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMonthDropdown(false)}>
          <View style={styles.dropdownModalScrollable}>
            <ScrollView showsVerticalScrollIndicator={true}>
              {selectedMonth !== null && (
                <TouchableOpacity
                  style={styles.dropdownOptionClear}
                  onPress={() => {
                    setSelectedMonth(null);
                    setShowMonthDropdown(false);
                  }}>
                  <Text style={styles.dropdownOptionClearText}>Clear Selection</Text>
                  <Icon name="close-circle" size={18} color="#EF4444" />
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
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Year Dropdown Modal */}
      <Modal
        visible={showYearDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowYearDropdown(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowYearDropdown(false)}>
          <View style={styles.dropdownModalScrollable}>
            <ScrollView showsVerticalScrollIndicator={true}>
              {selectedYear !== null && (
                <TouchableOpacity
                  style={styles.dropdownOptionClear}
                  onPress={() => {
                    setSelectedYear(null);
                    setShowYearDropdown(false);
                  }}>
                  <Text style={styles.dropdownOptionClearText}>Clear Selection</Text>
                  <Icon name="close-circle" size={18} color="#EF4444" />
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
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

    </View>
  );
};

const cardBase = {
  backgroundColor: colors.white,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: '#F3F4F6',
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
  accountItem: {
    flexDirection: 'column',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
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
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  accountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  accountBadgeText: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
  },
  primaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
  },
  primaryBadgeText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#111827',
  },
  pinnedBar: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 6,
    gap: 8,
    position: 'relative',
  },
  titleBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 60,
  },
  pinnedButton: {
    position: 'absolute',
    left: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{rotate: '-20deg'}],
  },
  pinnedButtonActive: {
    backgroundColor: '#D1D5DB',
    borderColor: '#9CA3AF',
  },
  pinnedButtonInactive: {
    backgroundColor: 'transparent',
    borderWidth: 0,
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
  // Empty State
  emptyAccounts: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
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
    borderColor: '#F3F4F6',
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
    borderBottomColor: '#F3F4F6',
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
  dropdownOptionClear: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    backgroundColor: '#FEF2F2',
    borderBottomWidth: 1,
    borderBottomColor: '#FCA5A5',
  },
  dropdownOptionClearText: {
    fontSize: fontSize.medium,
    color: '#EF4444',
    fontWeight: fontWeight.semibold,
  },
});

export default DashboardScreen;



