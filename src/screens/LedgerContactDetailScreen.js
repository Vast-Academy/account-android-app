import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Modal,
  TextInput,
  Alert,
  Animated,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import {colors, spacing, fontSize, fontWeight} from '../utils/theme';
import {useToast} from '../hooks/useToast';
import {useCurrencySymbol} from '../hooks/useCurrencySymbol';
import {
  initLedgerDatabase,
  createTransaction as createLedgerTransaction,
  getTransactionsByContact,
  calculateContactBalance,
} from '../services/ledgerDatabase';
import {
  initAccountsDatabase,
  getAccountsByType,
  getPrimaryEarningAccount,
} from '../services/accountsDatabase';
import {
  initTransactionsDatabase,
  createTransaction as createAccountTransaction,
} from '../services/transactionsDatabase';

const LEDGER_GET_DEFAULT_MODE_KEY = 'ledgerGetDefaultMode';
const LEDGER_TRANSFER_LAST_ACCOUNT_KEY = 'ledgerTransferLastAccountId';

const LedgerContactDetailScreen = ({route, navigation}) => {
  const {contact} = route.params || {};
  const {showToast} = useToast();
  const currencySymbol = useCurrencySymbol();

  const [transactions, setTransactions] = useState([]);
  const [balance, setBalance] = useState({
    netBalance: 0,
    totalPaid: 0,
    totalGet: 0,
    transactionCount: 0,
  });
  const [transactionModalVisible, setTransactionModalVisible] = useState(false);
  const [transactionType, setTransactionType] = useState('paid'); // 'paid' or 'get'
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [getMode, setGetMode] = useState(null);
  const [getDefaultMode, setGetDefaultMode] = useState(null);
  const [transferSelectVisible, setTransferSelectVisible] = useState(false);
  const [transferAccounts, setTransferAccounts] = useState([]);
  const [transferTarget, setTransferTarget] = useState(null);
  const [amountFieldHeight, setAmountFieldHeight] = useState(0);
  const [amountAccountWidth, setAmountAccountWidth] = useState(0);
  const [paidPromptVisible, setPaidPromptVisible] = useState(false);
  const [primaryEarningAccount, setPrimaryEarningAccount] = useState(null);

  // Animation values
  const modalSlideAnim = useRef(new Animated.Value(300)).current;
  const scrollViewRef = useRef(null);
  const amountInputRef = useRef(null);
  const noteInputRef = useRef(null);

  useEffect(() => {
    initLedgerDatabase();
    initAccountsDatabase();
    initTransactionsDatabase();
    loadData();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    // Auto-scroll to bottom when transactions change (instantly, no animation)
    if (transactions.length > 0 && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: false });
      }, 0);
    }
  }, [transactions]);

  useEffect(() => {
    // Auto-focus keyboard when modal opens
    if (transactionModalVisible && amountInputRef.current) {
      setTimeout(() => {
        amountInputRef.current?.focus();
      }, 300);
    }
  }, [transactionModalVisible]);

  useEffect(() => {
    const loadGetDefault = async () => {
      try {
        const stored = await AsyncStorage.getItem(LEDGER_GET_DEFAULT_MODE_KEY);
        if (stored === 'withdraw' || stored === 'transfer') {
          setGetDefaultMode(stored);
        }
      } catch (error) {
        console.error('Failed to load ledger get default mode:', error);
      }
    };
    loadGetDefault();
  }, []);

  useEffect(() => {
    if (transactionModalVisible && transactionType === 'get') {
      if (getDefaultMode) {
        setGetMode(getDefaultMode);
      }
    } else {
      setGetMode(null);
      setTransferSelectVisible(false);
    }
  }, [transactionModalVisible, transactionType, getDefaultMode]);

  useEffect(() => {
    if (!transactionModalVisible || transactionType !== 'get' || getMode !== 'transfer') {
      return;
    }
    const loadTransferAccounts = async () => {
      try {
        const accountsList = getAccountsByType('earning');
        setTransferAccounts(accountsList);
        if (accountsList.length === 0) {
          setTransferTarget(null);
          return;
        }
        const storedId = await AsyncStorage.getItem(
          LEDGER_TRANSFER_LAST_ACCOUNT_KEY
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
  }, [transactionModalVisible, transactionType, getMode]);

  useEffect(() => {
    if (!transactionModalVisible || transactionType !== 'paid') {
      return;
    }
    const account = getPrimaryEarningAccount();
    setPrimaryEarningAccount(account);
  }, [transactionModalVisible, transactionType]);

  const loadData = () => {
    if (!contact?.recordID) {
      return;
    }
    const txns = getTransactionsByContact(contact.recordID);
    setTransactions(txns);

    const bal = calculateContactBalance(contact.recordID);
    setBalance(bal);
  };

  const getContactName = () => {
    const fullName = [contact?.givenName, contact?.familyName]
      .filter(Boolean)
      .join(' ')
      .trim();
    return fullName || contact?.displayName || 'Unknown Contact';
  };

  const getContactPhone = () => {
    const phone = contact?.phoneNumbers?.find(item =>
      String(item.number || '').trim()
    )?.number;
    return phone || 'No phone number';
  };

  const openTransactionModal = type => {
    setTransactionType(type);
    setAmount('');
    setNote('');
    setTransactionModalVisible(true);
    Animated.spring(modalSlideAnim, {
      toValue: 0,
      tension: 65,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };

  const closeTransactionModal = () => {
    Keyboard.dismiss();
    Animated.timing(modalSlideAnim, {
      toValue: 300,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setTransactionModalVisible(false);
      setAmount('');
      setNote('');
    });
  };

  const submitTransaction = async debitPrimaryAccount => {
    setLoading(true);
    try {
      const amountValue = Number(amount);
      createLedgerTransaction(contact.recordID, amountValue, transactionType, note);
      if (transactionType === 'get' && getMode === 'transfer' && transferTarget) {
        const trimmedNote = note.trim();
        const accountRemark = trimmedNote
          ? `Ledger receipt from ${getContactName()} - ${trimmedNote}`
          : `Ledger receipt from ${getContactName()}`;
        await createAccountTransaction(
          transferTarget.id,
          amountValue,
          accountRemark
        );
        setTransferSelectVisible(false);
        AsyncStorage.setItem(
          LEDGER_TRANSFER_LAST_ACCOUNT_KEY,
          String(transferTarget.id)
        ).catch(error => {
          console.error('Failed to save ledger transfer account:', error);
        });
      }
      if (transactionType === 'paid' && debitPrimaryAccount && primaryEarningAccount) {
        const trimmedNote = note.trim();
        const accountRemark = trimmedNote
          ? `Ledger payment to ${getContactName()} - ${trimmedNote}`
          : `Ledger payment to ${getContactName()}`;
        await createAccountTransaction(
          primaryEarningAccount.id,
          -Math.abs(amountValue),
          accountRemark
        );
      }
      closeTransactionModal();
      loadData();
      if (transactionType === 'get' && getMode === 'transfer') {
        showToast('Receipt recorded and transferred successfully', 'success');
      } else if (transactionType === 'paid' && debitPrimaryAccount) {
        showToast('Payment recorded and deducted from primary account', 'success');
      } else {
        showToast(
          `${transactionType === 'paid' ? 'Payment' : 'Receipt'} recorded successfully`,
          'success'
        );
      }
    } catch (error) {
      console.error('Failed to add transaction:', error);
      showToast('Failed to record transaction', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePaidPromptYes = async () => {
    if (!primaryEarningAccount) {
      Alert.alert(
        'No Primary Account',
        'Please set a primary earning account first.'
      );
      return;
    }
    setPaidPromptVisible(false);
    await submitTransaction(true);
  };

  const handlePaidPromptNo = async () => {
    setPaidPromptVisible(false);
    await submitTransaction(false);
  };

  const handlePaidPromptCancel = () => {
    setPaidPromptVisible(false);
  };

  const handleAddTransaction = async () => {
    if (!amount || Number(amount) <= 0) {
      showToast('Please enter a valid amount greater than 0', 'error');
      return;
    }

    if (!contact?.recordID) {
      showToast('Contact information not found', 'error');
      return;
    }

    if (transactionType === 'get') {
      if (!getMode) {
        Alert.alert('Select Option', 'Please select Withdraw or Transfer first.');
        return;
      }
      if (getMode === 'transfer' && !transferTarget) {
        Alert.alert('Select Account', 'Please select an earning account.');
        return;
      }
    }

    if (transactionType === 'paid') {
      const account = getPrimaryEarningAccount();
      setPrimaryEarningAccount(account);
      setPaidPromptVisible(true);
      return;
    }

    await submitTransaction(false);
  };

  const formatCurrency = amount => {
    return `${currencySymbol} ${Math.abs(amount).toLocaleString('en-IN')}`;
  };

  const formatSignedBalance = amount => {
    if (amount < 0) {
      return `- ${formatCurrency(amount)}`;
    }
    return formatCurrency(amount);
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
        {transactions.map(transaction => {
          const dateKey = new Date(transaction.transaction_date).toDateString();
          const showDate = dateKey !== lastDateKey;
          lastDateKey = dateKey;

          const amountValue = Number(transaction.amount) || 0;
          const isPaid = transaction.type === 'paid';
          const delta = isPaid ? amountValue : -amountValue;
          runningBalance += delta;
          const balanceAfter = runningBalance;

          return (
            <View key={transaction.id}>
              {showDate && (
                <View style={styles.datePill}>
                  <Text style={styles.datePillText}>
                    {formatDateLabel(transaction.transaction_date)}
                  </Text>
                </View>
              )}
              <View style={[styles.chatRow, isPaid && styles.chatRowDebit]}>
                <View
                  style={[
                    styles.chatBubble,
                    isPaid ? styles.chatBubbleDebit : styles.chatBubbleCredit,
                  ]}>
                  <View style={styles.chatHeader}>
                    <View
                      style={[styles.chatIcon, isPaid && styles.chatIconDebit]}>
                      <Icon
                        name={isPaid ? 'arrow-up' : 'arrow-down'}
                        size={16}
                        color={isPaid ? '#EF4444' : '#10B981'}
                      />
                    </View>
                    <Text
                      style={[styles.chatAmount, isPaid && styles.chatAmountDebit]}>
                      {`${isPaid ? '-' : '+'} ${formatCurrency(amountValue)}`}
                    </Text>
                    <View style={styles.chatHeaderRight}>
                      <Text style={styles.chatTime}>
                        {formatTimeLabel(transaction.transaction_date)}
                      </Text>
                    </View>
                  </View>
                  {transaction.note ? (
                    <Text style={styles.chatRemark}>{transaction.note}</Text>
                  ) : null}
                </View>
                <View style={[styles.chatMeta, isPaid && styles.chatMetaDebit]}>
                  <Text style={styles.chatBalance}>
                    {formatSignedBalance(balanceAfter)}
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
      {/* Header + Totals */}
      <View style={styles.headerBlock}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{getContactName()}</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.metricsRow}>
          <View style={styles.metricColumn}>
            <View style={styles.metricLabelRow}>
              <Text style={styles.metricLabel}>Total Paid</Text>
            </View>
            <Text style={[styles.metricValue, styles.metricNegative]}>
              {formatCurrency(balance.totalPaid)}
            </Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricColumn}>
            <View style={styles.metricLabelRow}>
              <Text style={styles.metricLabel}>Total Received</Text>
            </View>
            <Text style={[styles.metricValue, styles.metricPositive]}>
              {formatCurrency(balance.totalGet)}
            </Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricColumn}>
            <View style={styles.metricLabelRow}>
              <Text style={styles.metricLabel}>Net Balance</Text>
            </View>
            <Text
              style={[
                styles.metricValue,
                balance.netBalance < 0
                  ? styles.metricPositive
                  : balance.netBalance > 0
                  ? styles.metricNegative
                  : null,
              ]}>
              {formatSignedBalance(balance.netBalance)}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.historySection}>{renderTransactions()}</View>
      </ScrollView>

      {/* Bottom Buttons */}
      <View style={styles.bottomButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.paidButton]}
          onPress={() => openTransactionModal('paid')}>
          <Icon name="arrow-up" size={20} color="#EF4444" />
          <Text style={[styles.actionButtonText, styles.paidButtonText]}>
            Paid
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.getButton]}
          onPress={() => openTransactionModal('get')}>
          <Icon name="arrow-down" size={20} color="#10B981" />
          <Text style={[styles.actionButtonText, styles.getButtonText]}>
            Get
          </Text>
        </TouchableOpacity>
      </View>

      {/* Transaction Modal */}
      <Modal
        visible={transactionModalVisible}
        transparent
        animationType="none"
        onRequestClose={closeTransactionModal}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={closeTransactionModal}
          />
          <Animated.View
            style={[
              styles.modalContainer,
              {transform: [{translateY: modalSlideAnim}]},
            ]}>
            {transferSelectVisible && (
              <Pressable
                style={styles.transferDismissOverlay}
                onPress={() => setTransferSelectVisible(false)}
              />
            )}
            <View style={styles.modalContent}>
              <View style={styles.modalHandle} />
              {transactionType === 'get' && (
                <>
                  <View style={styles.modeToggle}>
                    <View style={styles.modeOption}>
                      <TouchableOpacity
                        style={[
                          styles.modeButton,
                          getMode === 'withdraw' && styles.modeButtonActive,
                        ]}
                        onPress={() => setGetMode('withdraw')}>
                        <View style={styles.modeButtonContent}>
                          <Text
                            style={[
                              styles.modeButtonText,
                              getMode === 'withdraw' && styles.modeButtonTextActive,
                            ]}>
                            Withdraw
                          </Text>
                          {getDefaultMode === 'withdraw' && (
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
                          getMode === 'transfer' && styles.modeButtonActive,
                        ]}
                        onPress={() => setGetMode('transfer')}>
                        <View style={styles.modeButtonContent}>
                          <Text
                            style={[
                              styles.modeButtonText,
                              getMode === 'transfer' && styles.modeButtonTextActive,
                            ]}>
                            Transfer
                          </Text>
                          {getDefaultMode === 'transfer' && (
                            <View style={styles.defaultBadge}>
                              <Text style={styles.defaultBadgeText}>Default</Text>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    </View>
                  </View>
                  {getMode && getMode !== getDefaultMode && (
                    <TouchableOpacity
                      style={styles.setDefaultButton}
                      onPress={() => {
                        const message =
                          getMode === 'withdraw'
                            ? 'Now withdraw is your default option.'
                            : 'Now transfer is your default option.';
                        showToast(message, 'success');
                        AsyncStorage.setItem(LEDGER_GET_DEFAULT_MODE_KEY, getMode)
                          .then(() => {
                            setGetDefaultMode(getMode);
                          })
                          .catch(error => {
                            console.error('Failed to save ledger get default mode:', error);
                          });
                      }}>
                      <Text style={styles.setDefaultText}>Set as default</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
              <Text style={styles.modalTitle}>
                {transactionType === 'paid'
                  ? 'Paid'
                  : getMode === 'transfer'
                  ? 'Transfer'
                  : 'Withdraw'}
              </Text>
              {transactionType === 'get' && getMode === 'transfer' ? (
                <View style={styles.amountFieldWrapper}>
                  <View
                    style={styles.amountFieldRow}
                    onLayout={event =>
                      setAmountFieldHeight(event.nativeEvent.layout.height)
                    }>
                    <TextInput
                      ref={amountInputRef}
                      style={styles.amountInputBare}
                      value={amount}
                      onChangeText={setAmount}
                      keyboardType="numeric"
                      editable={!loading}
                      onSubmitEditing={() => noteInputRef.current?.focus()}
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
                      <Text style={styles.amountAccountText} numberOfLines={1}>
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
                  ref={amountInputRef}
                  style={styles.modalAmountInput}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                  editable={!loading}
                  onSubmitEditing={() => noteInputRef.current?.focus()}
                />
              )}
              <Text style={styles.modalNoteLabel}>Note (Optional)</Text>
              <TextInput
                ref={noteInputRef}
                style={styles.modalNoteInput}
                value={note}
                onChangeText={setNote}
                placeholder="Add a note"
                placeholderTextColor={colors.text.light}
                multiline
                numberOfLines={3}
                editable={!loading}
              />
              <TouchableOpacity
                style={[
                  styles.modalAddButton,
                  transactionType === 'paid'
                    ? styles.modalAddButtonPaid
                    : styles.modalAddButtonGet,
                  loading && styles.buttonDisabled,
                ]}
                onPress={handleAddTransaction}
                disabled={loading}>
                {loading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.modalAddButtonText}>
                    {transactionType === 'paid'
                      ? 'Record Payment'
                      : getMode === 'transfer'
                      ? 'Transfer'
                      : 'Record Receipt'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      <Modal
        visible={paidPromptVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPaidPromptVisible(false)}>
        <View style={styles.promptOverlay}>
          <TouchableOpacity
            style={styles.promptBackdrop}
            activeOpacity={1}
            onPress={handlePaidPromptCancel}
          />
          <View style={styles.promptCard}>
            <TouchableOpacity
              style={styles.promptCloseButton}
              onPress={handlePaidPromptCancel}
              disabled={loading}
              hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
              <Icon name="close" size={18} color={colors.text.secondary} />
            </TouchableOpacity>
            <Text style={styles.promptTitle}>Get from primary account?</Text>
            <Text style={styles.promptMessage}>
              Do you want to get {formatCurrency(Number(amount) || 0)} from{' '}
              <Text
                style={[
                  styles.promptAccountName,
                  primaryEarningAccount?.icon_color && {
                    color: primaryEarningAccount.icon_color,
                  },
                ]}>
                {primaryEarningAccount?.account_name || 'primary account'}
              </Text>{' '}
              for payment to{' '}
              <Text style={styles.promptAccountName}>{getContactName()}</Text>?
            </Text>
            <View style={styles.promptActions}>
              <TouchableOpacity
                style={[styles.promptButton, styles.promptButtonSecondary]}
                onPress={handlePaidPromptNo}
                disabled={loading}>
                <Text style={styles.promptButtonTextSecondary}>Just record</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.promptButton,
                  styles.promptButtonPrimary,
                  primaryEarningAccount?.icon_color && {
                    backgroundColor: primaryEarningAccount.icon_color,
                  },
                ]}
                onPress={handlePaidPromptYes}
                disabled={loading}>
                <Text style={styles.promptButtonTextPrimary}>Get</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerBlock: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: fontSize.large,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  headerRight: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    padding: spacing.md,
    paddingBottom: 120,
  },
  contactCard: {
    backgroundColor: colors.white,
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.sm,
  },
  contactAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  contactAvatarText: {
    fontSize: 36,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  contactName: {
    fontSize: fontSize.xxlarge,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  contactPhone: {
    fontSize: fontSize.regular,
    color: colors.text.secondary,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricColumn: {
    flex: 1,
  },
  metricDivider: {
    width: 1,
    height: 44,
    backgroundColor: '#E5E7EB',
    marginHorizontal: spacing.sm,
  },
  metricLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: 'left',
  },
  metricValue: {
    fontSize: fontSize.large,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    textAlign: 'left',
  },
  metricPositive: {
    color: '#10B981',
  },
  metricNegative: {
    color: '#EF4444',
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
  bottomButtons: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: 12,
    gap: spacing.xs,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  paidButton: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#EF4444',
    elevation: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  getButton: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#10B981',
    elevation: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  actionButtonText: {
    fontSize: fontSize.regular,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  paidButtonText: {
    color: '#EF4444',
  },
  getButtonText: {
    color: '#10B981',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContainer: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: spacing.md,
    paddingBottom: spacing.lg,
    elevation: 5,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 8,
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
    flex: 75,
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
    flex: 25,
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
  modalAddButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalAddButtonPaid: {
    backgroundColor: '#EF4444',
  },
  modalAddButtonGet: {
    backgroundColor: '#10B981',
  },
  modalAddButtonText: {
    fontSize: fontSize.regular,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  promptOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  promptBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  promptCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    position: 'relative',
  },
  promptCloseButton: {
    position: 'absolute',
    right: 8,
    top: 8,
    padding: 6,
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

export default LedgerContactDetailScreen;
