import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Animated,
  Keyboard,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
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
  getUnifiedTimeline,
} from '../services/ledgerDatabase';
import {
  initAccountsDatabase,
  getPrimaryEarningAccount,
} from '../services/accountsDatabase';
import {
  initTransactionsDatabase,
  createTransaction as createAccountTransaction,
} from '../services/transactionsDatabase';
import {searchUsersByPhone} from '../services/userProfileService';
import {
  createConversation,
  insertMessage,
  getMessages,
  initChatDatabase,
} from '../services/chatDatabase';
import {sendMessageToUser} from '../services/messagingService';
import auth from '@react-native-firebase/auth';

const LEDGER_GET_DEFAULT_MODE_KEY = 'ledgerGetDefaultMode';
const LEDGER_GET_DEFAULT_PREFIX = 'ledgerGetDefault:';
const LEDGER_GET_DEFAULT_WITHDRAW = 'withdraw';
const LEDGER_GET_DEFAULT_TRANSFER = 'transfer';
const LEDGER_PAID_DEFAULT_PREFIX = 'ledgerPaidDefault:';
const LEDGER_PAID_DEFAULT_DEBIT = 'debit';
const LEDGER_PAID_DEFAULT_RECORD = 'record';

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
  const [paidPromptVisible, setPaidPromptVisible] = useState(false);
  const [primaryEarningAccount, setPrimaryEarningAccount] = useState(null);
  const [rememberPaidChoice, setRememberPaidChoice] = useState(false);
  const [paidDefaultChoice, setPaidDefaultChoice] = useState(null);
  const [getPromptVisible, setGetPromptVisible] = useState(false);
  const [rememberGetChoice, setRememberGetChoice] = useState(false);
  const [getDefaultChoice, setGetDefaultChoice] = useState(null);

  // Chat state
  const [unifiedTimeline, setUnifiedTimeline] = useState([]);
  const [chatMessage, setChatMessage] = useState('');
  const [isAppUser, setIsAppUser] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // Animation values
  const modalSlideAnim = useRef(new Animated.Value(300)).current;
  const scrollViewRef = useRef(null);
  const flatListRef = useRef(null);
  const amountInputRef = useRef(null);
  const noteInputRef = useRef(null);
  const chatInputRef = useRef(null);

  useEffect(() => {
    initLedgerDatabase();
    initAccountsDatabase();
    initTransactionsDatabase();
    initChatDatabase();
    loadData();
    setupContactData();
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
    }
  }, [transactionModalVisible, transactionType, getDefaultMode]);

  useEffect(() => {
    if (!transactionModalVisible || (transactionType !== 'paid' && transactionType !== 'get')) {
      return;
    }
    const account = getPrimaryEarningAccount();
    setPrimaryEarningAccount(account);
  }, [transactionModalVisible, transactionType]);

  useEffect(() => {
    const loadGetDefaultChoice = async () => {
      if (!contact?.recordID) {
        setGetDefaultChoice(null);
        return;
      }
      try {
        const stored = await AsyncStorage.getItem(
          `${LEDGER_GET_DEFAULT_PREFIX}${contact.recordID}`
        );
        if (stored === LEDGER_GET_DEFAULT_WITHDRAW || stored === LEDGER_GET_DEFAULT_TRANSFER) {
          setGetDefaultChoice(stored);
        } else {
          setGetDefaultChoice(null);
        }
      } catch (error) {
        console.error('Failed to load ledger get default choice:', error);
        setGetDefaultChoice(null);
      }
    };
    loadGetDefaultChoice();
  }, [contact?.recordID]);

  useEffect(() => {
    const loadPaidDefault = async () => {
      if (!contact?.recordID) {
        setPaidDefaultChoice(null);
        return;
      }
      try {
        const stored = await AsyncStorage.getItem(
          `${LEDGER_PAID_DEFAULT_PREFIX}${contact.recordID}`
        );
        if (stored === LEDGER_PAID_DEFAULT_DEBIT || stored === LEDGER_PAID_DEFAULT_RECORD) {
          setPaidDefaultChoice(stored);
        } else {
          setPaidDefaultChoice(null);
        }
      } catch (error) {
        console.error('Failed to load ledger paid default choice:', error);
        setPaidDefaultChoice(null);
      }
    };
    loadPaidDefault();
  }, [contact?.recordID]);

  const setupContactData = async () => {
    if (!contact) {
      return;
    }

    // Check if contact is an app user
    if (contact.isAppUser && contact.userId) {
      setIsAppUser(true);

      // Get or create conversation
      try {
        const currentUserId = auth().currentUser?.uid;
        if (!currentUserId) {
          console.error('Current user not authenticated');
          return;
        }

        // Create or get conversation with the contact
        const convId = createConversation(contact.userId, {
          username: contact.username,
          displayName: contact.displayName || contact.givenName || 'Contact',
          phoneNumber: contact.phoneNumbers?.[0]?.number || '',
          photoURL: contact.photoURL || '',
        });

        setConversationId(convId);

        // Load chat messages for this conversation
        loadUnifiedTimeline(convId);
      } catch (error) {
        console.error('Error setting up conversation:', error);
      }
    } else {
      setIsAppUser(false);
      setConversationId(null);
    }
  };

  const loadUnifiedTimeline = async (convId) => {
    if (!contact?.recordID || !convId) {
      return;
    }

    try {
      setTimelineLoading(true);
      // Get messages for this conversation
      const messages = getMessages ? getMessages(convId) : [];

      // Get unified timeline (transactions + messages)
      const timeline = getUnifiedTimeline(contact.recordID, messages);
      setUnifiedTimeline(timeline);
    } catch (error) {
      console.error('Error loading unified timeline:', error);
    } finally {
      setTimelineLoading(false);
    }
  };

  const loadData = () => {
    if (!contact?.recordID) {
      return;
    }
    const txns = getTransactionsByContact(contact.recordID);
    setTransactions(txns);

    const bal = calculateContactBalance(contact.recordID);
    setBalance(bal);

    // Reload unified timeline if conversation exists
    if (conversationId && isAppUser) {
      loadUnifiedTimeline(conversationId);
    }
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
    setRememberPaidChoice(false);
    setRememberGetChoice(false);
    setGetPromptVisible(false);
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
      setRememberPaidChoice(false);
      setRememberGetChoice(false);
      setGetPromptVisible(false);
    });
  };

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || !isAppUser || !conversationId || !contact?.userId) {
      return;
    }

    const messageText = chatMessage.trim();
    setChatMessage('');

    try {
      setSendingMessage(true);

      // Send message via messaging service
      await sendMessageToUser(contact.userId, {
        text: messageText,
        messageType: 'text',
      });

      // Reload timeline to show new message
      if (conversationId) {
        await loadUnifiedTimeline(conversationId);
      }

      showToast('Message sent', 'success');
    } catch (error) {
      console.error('Error sending message:', error);
      showToast('Failed to send message', 'error');
      setChatMessage(messageText); // Restore message on error
    } finally {
      setSendingMessage(false);
    }
  };

  const resolvePrimaryEarningAccount = () => {
    const account = getPrimaryEarningAccount();
    setPrimaryEarningAccount(account);
    return account;
  };

  const storePaidDefaultChoice = async choice => {
    if (!rememberPaidChoice || !contact?.recordID) {
      return;
    }
    try {
      await AsyncStorage.setItem(
        `${LEDGER_PAID_DEFAULT_PREFIX}${contact.recordID}`,
        choice
      );
      setPaidDefaultChoice(choice);
    } catch (error) {
      console.error('Failed to save ledger paid default choice:', error);
    }
  };

  const storeGetDefaultChoice = async choice => {
    if (!rememberGetChoice || !contact?.recordID) {
      return;
    }
    try {
      await AsyncStorage.setItem(
        `${LEDGER_GET_DEFAULT_PREFIX}${contact.recordID}`,
        choice
      );
      setGetDefaultChoice(choice);
    } catch (error) {
      console.error('Failed to save ledger get default choice:', error);
    }
  };

  const submitTransaction = async (debitPrimaryAccount, overrideGetMode = null) => {
    setLoading(true);
    try {
      const amountValue = Number(amount);
      const resolvedGetMode = overrideGetMode || getMode;
      createLedgerTransaction(contact.recordID, amountValue, transactionType, note);
      if (transactionType === 'get' && resolvedGetMode === 'transfer') {
        const creditAccount = primaryEarningAccount || resolvePrimaryEarningAccount();
        if (!creditAccount) {
          Alert.alert(
            'No Primary Account',
            'Please set a primary earning account first.'
          );
          setLoading(false);
          return;
        }
        const trimmedNote = note.trim();
        const accountRemark = trimmedNote
          ? `Ledger receipt from ${getContactName()} - ${trimmedNote}`
          : `Ledger receipt from ${getContactName()}`;
        await createAccountTransaction(
          creditAccount.id,
          amountValue,
          accountRemark
        );
      }
      if (transactionType === 'paid' && debitPrimaryAccount) {
        const debitAccount = primaryEarningAccount || resolvePrimaryEarningAccount();
        if (!debitAccount) {
          Alert.alert(
            'No Primary Account',
            'Please set a primary earning account first.'
          );
          setLoading(false);
          return;
        }
        const trimmedNote = note.trim();
        const accountRemark = trimmedNote
          ? `Ledger payment to ${getContactName()} - ${trimmedNote}`
          : `Ledger payment to ${getContactName()}`;
        await createAccountTransaction(
          debitAccount.id,
          -Math.abs(amountValue),
          accountRemark
        );
      }
      closeTransactionModal();
      loadData();
      if (transactionType === 'get' && resolvedGetMode === 'transfer') {
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
    const account = resolvePrimaryEarningAccount();
    if (!account) {
      Alert.alert(
        'No Primary Account',
        'Please set a primary earning account first.'
      );
      return;
    }
    setPaidPromptVisible(false);
    await storePaidDefaultChoice(LEDGER_PAID_DEFAULT_DEBIT);
    await submitTransaction(true);
  };

  const handlePaidPromptNo = async () => {
    setPaidPromptVisible(false);
    await storePaidDefaultChoice(LEDGER_PAID_DEFAULT_RECORD);
    await submitTransaction(false);
  };

  const handlePaidPromptCancel = () => {
    setPaidPromptVisible(false);
  };

  const handleGetPromptWithdraw = async () => {
    setGetPromptVisible(false);
    await storeGetDefaultChoice(LEDGER_GET_DEFAULT_WITHDRAW);
    await submitTransaction(false, LEDGER_GET_DEFAULT_WITHDRAW);
  };

  const handleGetPromptTransfer = async () => {
    const account = resolvePrimaryEarningAccount();
    if (!account) {
      Alert.alert(
        'No Primary Account',
        'Please set a primary earning account first.'
      );
      return;
    }
    setGetPromptVisible(false);
    await storeGetDefaultChoice(LEDGER_GET_DEFAULT_TRANSFER);
    await submitTransaction(false, LEDGER_GET_DEFAULT_TRANSFER);
  };

  const handleGetPromptCancel = () => {
    setGetPromptVisible(false);
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
      if (getDefaultChoice === LEDGER_GET_DEFAULT_WITHDRAW) {
        await submitTransaction(false, LEDGER_GET_DEFAULT_WITHDRAW);
        return;
      }
      if (getDefaultChoice === LEDGER_GET_DEFAULT_TRANSFER) {
        await submitTransaction(false, LEDGER_GET_DEFAULT_TRANSFER);
        return;
      }
      if (
        getDefaultMode === LEDGER_GET_DEFAULT_WITHDRAW ||
        getDefaultMode === LEDGER_GET_DEFAULT_TRANSFER
      ) {
        await submitTransaction(false, getDefaultMode);
        return;
      }
      setGetPromptVisible(true);
      return;
    }

    if (transactionType === 'paid') {
      resolvePrimaryEarningAccount();
      if (paidDefaultChoice === LEDGER_PAID_DEFAULT_DEBIT) {
        await submitTransaction(true);
        return;
      }
      if (paidDefaultChoice === LEDGER_PAID_DEFAULT_RECORD) {
        await submitTransaction(false);
        return;
      }
      setPaidPromptVisible(true);
      return;
    }

    await submitTransaction(false);
  };

  const handleOpenChat = async () => {
    try {
      if (!contact?.phoneNumbers || contact.phoneNumbers.length === 0) {
        Alert.alert('No Phone Number', 'This contact does not have a phone number.');
        return;
      }

      const phoneNumber = contact.phoneNumbers[0].number;

      // Search if user exists on app
      const users = await searchUsersByPhone(phoneNumber);

      if (users.length === 0) {
        Alert.alert(
          'User Not Found',
          `${getContactName()} is not using the app yet.`,
          [
            {text: 'Cancel', style: 'cancel'},
            {
              text: 'Invite',
              onPress: () => {
                // Can add SMS invite functionality here
                console.log('Invite user');
              },
            },
          ]
        );
        return;
      }

      const user = users[0];

      // Create or get conversation
      const conversationId = createConversation(user.userId, {
        username: user.username,
        displayName: user.displayName,
        phoneNumber: user.phoneNumber,
        photoURL: user.photoURL,
      });

      // Navigate to chat
      navigation.navigate('ChatConversation', {
        conversationId,
        otherUserId: user.userId,
        otherUserName: user.displayName,
        otherUserUsername: user.username,
        otherUserPhoto: user.photoURL,
      });
    } catch (error) {
      console.error('Error opening chat:', error);
      Alert.alert('Error', 'Could not open chat');
    }
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

  const renderTimelineItem = ({item, index}) => {
    if (item.type === 'transaction') {
      const isGet = item.transactionType === 'get';
      const color = isGet ? '#10B981' : '#EF4444';
      const icon = isGet ? 'arrow-down' : 'arrow-up';
      const label = isGet ? 'Received' : 'Paid';

      return (
        <View style={[styles.timelineItem, {paddingVertical: 8}]}>
          <View
            style={[
              styles.transactionBubble,
              {borderLeftColor: color},
            ]}>
            <View style={styles.transactionHeader}>
              <Icon name={icon} size={16} color={color} />
              <Text style={[styles.transactionLabel, {color}]}>
                {label}
              </Text>
            </View>
            <Text style={styles.transactionAmount}>
              {formatCurrency(item.amount)}
            </Text>
            {item.note ? <Text style={styles.transactionNote}>{item.note}</Text> : null}
            <Text style={styles.timelineTime}>{formatTimeLabel(item.timestamp)}</Text>
          </View>
        </View>
      );
    }

    if (item.type === 'message') {
      const currentUserId = auth().currentUser?.uid;
      const isOwn = item.senderId === currentUserId;
      const bubbleStyle = isOwn ? styles.sentBubble : styles.receivedBubble;
      const textStyle = isOwn ? styles.sentText : styles.receivedText;

      return (
        <View style={[styles.timelineItem, {paddingVertical: 4}]}>
          <View style={bubbleStyle}>
            <Text style={textStyle}>{item.text}</Text>
            <Text style={styles.messageTime}>{formatTimeLabel(item.timestamp)}</Text>
          </View>
        </View>
      );
    }

    return null;
  };

  const renderTimelineEmpty = () => {
    if (timelineLoading) {
      return (
        <View style={styles.emptyTimeline}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.emptyText, {marginTop: spacing.md}]}>Loading...</Text>
        </View>
      );
    }

    if (!isAppUser) {
      return (
        <View style={styles.emptyTimeline}>
          <Icon name="receipt-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyText}>No transactions yet</Text>
          <Text style={styles.emptySubtext}>
            Tap "Paid" or "Get" to record a transaction
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyTimeline}>
        <Icon name="chatbubbles-outline" size={48} color="#D1D5DB" />
        <Text style={styles.emptyText}>
          Start a conversation or record a transaction
        </Text>
        <Text style={styles.emptySubtext}>
          Messages and transactions will appear here
        </Text>
      </View>
    );
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
          <TouchableOpacity
            style={styles.chatButton}
            onPress={handleOpenChat}>
            <Icon name="chatbubbles-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
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

      {/* Unified Timeline - FlatList with inverted property */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.timelineContainer}>
        {isAppUser && unifiedTimeline.length > 0 ? (
          <FlatList
            ref={flatListRef}
            data={unifiedTimeline}
            renderItem={renderTimelineItem}
            keyExtractor={(item) => item.id}
            inverted={true}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.timelineContent}
            ListEmptyComponent={renderTimelineEmpty}
          />
        ) : (
          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            <View style={styles.historySection}>{renderTransactions()}</View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      {/* Chat Input Bar - Only visible for app users */}
      {isAppUser && (
        <View style={styles.chatInputContainer}>
          <TextInput
            ref={chatInputRef}
            style={styles.chatInput}
            placeholder="Type message..."
            placeholderTextColor="#9CA3AF"
            value={chatMessage}
            onChangeText={setChatMessage}
            multiline
            maxLength={2000}
            editable={!sendingMessage}
          />
          <TouchableOpacity
            style={[
              styles.chatSendButton,
              (!chatMessage.trim() || sendingMessage) && styles.chatSendButtonDisabled,
            ]}
            onPress={handleSendMessage}
            disabled={!chatMessage.trim() || sendingMessage}>
            <Icon
              name="send"
              size={20}
              color={chatMessage.trim() && !sendingMessage ? colors.primary : '#D1D5DB'}
            />
          </TouchableOpacity>
        </View>
      )}

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
            <View style={styles.modalContent}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>
                {transactionType === 'paid' ? 'Paid' : 'Get'}
              </Text>
              <TextInput
                ref={amountInputRef}
                style={styles.modalAmountInput}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                editable={!loading}
                onSubmitEditing={() => noteInputRef.current?.focus()}
              />
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
                      : 'Record Receipt'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      <Modal
        visible={getPromptVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGetPromptVisible(false)}>
        <View style={styles.promptOverlay}>
          <TouchableOpacity
            style={styles.promptBackdrop}
            activeOpacity={1}
            onPress={handleGetPromptCancel}
          />
          <View style={styles.promptCard}>
            <TouchableOpacity
              style={styles.promptCloseButton}
              onPress={handleGetPromptCancel}
              disabled={loading}
              hitSlop={{top: 24, bottom: 24, left: 24, right: 24}}>
              <Icon name="close" size={20} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.promptTitle}>How should we record this?</Text>
            <Text style={styles.promptMessage}>
              Record{' '}
              <Text style={styles.promptAmount}>
                {formatCurrency(Number(amount) || 0)}
              </Text>{' '}
              or transfer to your primary{' '}
              <Text
                style={[
                  styles.promptAccountName,
                  primaryEarningAccount?.icon_color && {
                    color: primaryEarningAccount.icon_color,
                  },
                ]}>
                {primaryEarningAccount?.account_name || 'earning'}
              </Text>{' '}
              account?
            </Text>
            <TouchableOpacity
              style={styles.promptRemember}
              onPress={() =>
                setRememberGetChoice(current => !current)
              }
              disabled={loading}>
              <View
                style={[
                  styles.promptCheckbox,
                  rememberGetChoice && styles.promptCheckboxChecked,
                  rememberGetChoice &&
                    primaryEarningAccount?.icon_color && {
                      backgroundColor: primaryEarningAccount.icon_color,
                      borderColor: primaryEarningAccount.icon_color,
                    },
                ]}>
                {rememberGetChoice && (
                  <Icon name="checkmark" size={14} color={colors.white} />
                )}
              </View>
              <Text style={styles.promptRememberText}>
                Remember my choice for this contact
              </Text>
            </TouchableOpacity>
            <View style={styles.promptActions}>
              <TouchableOpacity
                style={[styles.promptButton, styles.promptButtonSecondary]}
                onPress={handleGetPromptWithdraw}
                disabled={loading}>
                <Text style={styles.promptButtonTextSecondary}>Withdraw</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.promptButton,
                  styles.promptButtonPrimary,
                  primaryEarningAccount?.icon_color && {
                    backgroundColor: primaryEarningAccount.icon_color,
                  },
                ]}
                onPress={handleGetPromptTransfer}
                disabled={loading}>
                <Text style={styles.promptButtonTextPrimary}>Transfer</Text>
              </TouchableOpacity>
            </View>
          </View>
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
              hitSlop={{top: 24, bottom: 24, left: 24, right: 24}}>
              <Icon name="close" size={20} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.promptTitle}>Get from primary account?</Text>
            <Text style={styles.promptMessage}>
              Do you want to get{' '}
              <Text style={styles.promptAmount}>
                {formatCurrency(Number(amount) || 0)}
              </Text>{' '}
              from{' '}
              primary earning account{' '}
              <Text
                style={[
                  styles.promptAccountName,
                  primaryEarningAccount?.icon_color && {
                    color: primaryEarningAccount.icon_color,
                  },
                ]}>
                {primaryEarningAccount?.account_name || 'primary earning account'}
              </Text>{' '}
              for payment to{' '}
              <Text style={styles.promptAccountName}>{getContactName()}</Text>?
            </Text>
            <TouchableOpacity
              style={styles.promptRemember}
              onPress={() =>
                setRememberPaidChoice(current => !current)
              }
              disabled={loading}>
              <View
                style={[
                  styles.promptCheckbox,
                  rememberPaidChoice && styles.promptCheckboxChecked,
                  rememberPaidChoice &&
                    primaryEarningAccount?.icon_color && {
                      backgroundColor: primaryEarningAccount.icon_color,
                      borderColor: primaryEarningAccount.icon_color,
                    },
                ]}>
                {rememberPaidChoice && (
                  <Icon name="checkmark" size={14} color={colors.white} />
                )}
              </View>
              <Text style={styles.promptRememberText}>
                Remember my choice for this contact
              </Text>
            </TouchableOpacity>
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
  chatButton: {
    padding: spacing.xs,
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
  promptAmount: {
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  promptRemember: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: spacing.md,
  },
  promptCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  promptCheckboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  promptRememberText: {
    fontSize: fontSize.medium,
    color: colors.text.primary,
    flex: 1,
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
  // Timeline styles
  timelineContainer: {
    flex: 1,
  },
  timelineContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  timelineItem: {
    marginVertical: spacing.xs,
  },
  transactionBubble: {
    backgroundColor: colors.white,
    borderLeftWidth: 4,
    borderRadius: 8,
    padding: spacing.md,
    elevation: 1,
  },
  transactionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.xs,
  },
  transactionLabel: {
    fontSize: fontSize.medium,
    fontWeight: fontWeight.semibold,
  },
  transactionAmount: {
    fontSize: fontSize.large,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  transactionNote: {
    fontSize: fontSize.small,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
    fontStyle: 'italic',
  },
  sentBubble: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignSelf: 'flex-end',
    maxWidth: '80%',
    marginLeft: '20%',
  },
  sentText: {
    color: colors.white,
    fontSize: fontSize.regular,
  },
  receivedBubble: {
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignSelf: 'flex-start',
    maxWidth: '80%',
    marginRight: '20%',
  },
  receivedText: {
    color: colors.text.primary,
    fontSize: fontSize.regular,
  },
  timelineTime: {
    fontSize: fontSize.small,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  messageTime: {
    fontSize: fontSize.small,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  emptyTimeline: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  emptySubtext: {
    fontSize: fontSize.small,
    color: colors.text.secondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  // Chat input styles
  chatInputContainer: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.regular,
    color: colors.text.primary,
    maxHeight: 100,
  },
  chatSendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  chatSendButtonDisabled: {
    backgroundColor: '#F3F4F6',
  },
});

export default LedgerContactDetailScreen;
