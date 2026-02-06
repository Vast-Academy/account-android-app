import React, {useState, useEffect, useMemo, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Pressable,
  Modal,
  TextInput,
  Alert,
  Animated,
  Keyboard,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import {colors, spacing, fontSize, fontWeight} from '../utils/theme';
import {useToast} from '../hooks/useToast';
import {useCurrencySymbol} from '../hooks/useCurrencySymbol';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
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
import {
  initChatDatabase,
  createConversation,
  getMessages,
} from '../services/chatDatabase';
import { sendMessageToUser } from '../services/messagingService';
import { searchUsersByPhone, batchSearchUsers } from '../services/userProfileService';
import {useChatStore} from '../context/ChatStore';

const LEDGER_GET_DEFAULT_MODE_KEY = 'ledgerGetDefaultMode';
const LEDGER_GET_DEFAULT_PREFIX = 'ledgerGetDefault:';
const LEDGER_GET_DEFAULT_WITHDRAW = 'withdraw';
const LEDGER_GET_DEFAULT_TRANSFER = 'transfer';
const LEDGER_PAID_DEFAULT_PREFIX = 'ledgerPaidDefault:';
const LEDGER_PAID_DEFAULT_DEBIT = 'debit';
const LEDGER_PAID_DEFAULT_RECORD = 'record';
const LEDGER_CHAT_CACHE_PREFIX = 'ledgerChatCache:';

const LedgerContactDetailScreen = ({route, navigation}) => {
  const {contact} = route.params || {};
  const {showToast} = useToast();
  const currencySymbol = useCurrencySymbol();
  const insets = useSafeAreaInsets();

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
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [editAmountVisible, setEditAmountVisible] = useState(false);
  const [editRemarkVisible, setEditRemarkVisible] = useState(false);
  const [editAmount, setEditAmount] = useState('');
  const [editRemark, setEditRemark] = useState('');
  const [rememberGetChoice, setRememberGetChoice] = useState(false);
  const [getDefaultChoice, setGetDefaultChoice] = useState(null);

  // Chat-related states
  const [appUser, setAppUser] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [isAppUser, setIsAppUser] = useState(false);
  const [unifiedTimeline, setUnifiedTimeline] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const chatStoreState = useChatStore();
  const conversationVersion = chatStoreState.conversationVersion?.[conversationId] || 0;

  // Animation values
  const modalSlideAnim = useRef(new Animated.Value(300)).current;
  const optionsOverlayOpacity = useRef(new Animated.Value(0)).current;
  const optionsContentTranslateY = useRef(new Animated.Value(300)).current;
  const listRef = useRef(null);
  const amountInputRef = useRef(null);
  const noteInputRef = useRef(null);
  const chatInputRef = useRef(null);

  useEffect(() => {
    if (optionsVisible) {
      optionsOverlayOpacity.setValue(0);
      optionsContentTranslateY.setValue(300);
      Animated.parallel([
        Animated.timing(optionsOverlayOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(optionsContentTranslateY, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(optionsOverlayOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(optionsContentTranslateY, {
          toValue: 300,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [optionsVisible, optionsOverlayOpacity, optionsContentTranslateY]);

  useEffect(() => {
    initLedgerDatabase();
    initAccountsDatabase();
    initTransactionsDatabase();
    initChatDatabase(); // Initialize chat tables
    loadData();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });
    return unsubscribe;
  }, [navigation]);


  useEffect(() => {
    // Auto-focus keyboard when modal opens
    if (transactionModalVisible && amountInputRef.current) {
      setTimeout(() => {
        amountInputRef.current?.focus();
      }, 300);
    }
  }, [transactionModalVisible]);

  useEffect(() => {
    if (conversationId && isAppUser) {
      loadUnifiedTimeline(conversationId);
    }
  }, [conversationId, conversationVersion, isAppUser]);

  useEffect(() => {
    const showListener = Keyboard.addListener('keyboardDidShow', event => {
      setIsKeyboardVisible(true);
      setKeyboardHeight(event.endCoordinates?.height || 0);
    });
    const hideListener = Keyboard.addListener('keyboardDidHide', () => {
      setIsKeyboardVisible(false);
      setKeyboardHeight(0);
    });
    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);


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

  const getChatCacheKey = () => {
    if (!contact?.recordID) {
      return null;
    }
    return `${LEDGER_CHAT_CACHE_PREFIX}${contact.recordID}`;
  };

  const loadCachedChatIdentity = async () => {
    const cacheKey = getChatCacheKey();
    if (!cacheKey) {
      return null;
    }
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Failed to load chat cache:', error);
      return null;
    }
  };

  const saveCachedChatIdentity = async (payload) => {
    const cacheKey = getChatCacheKey();
    if (!cacheKey || !payload) {
      return;
    }
    try {
      await AsyncStorage.setItem(cacheKey, JSON.stringify(payload));
    } catch (error) {
      console.error('Failed to save chat cache:', error);
    }
  };

  const resolveAppUserFromContact = () => {
    const contactUser = contact?.appUser || null;
    const contactUserId = contact?.userId || contact?.firebaseUid || '';
    const contactIsAppUser = contact?.isAppUser === true || Number(contact?.isAppUser) === 1;

    if (contactUser) {
      return contactUser;
    }
    if (contactIsAppUser || contactUserId) {
      return {
        userId: contactUserId,
        firebaseUid: contactUserId,
        displayName: contact?.displayName || contact?.savedName || 'Contact',
      };
    }
    return null;
  };

  // Map contact to app user for chat functionality
  const mapContactToAppUser = async () => {
    const cachedIdentity = await loadCachedChatIdentity();
    if (cachedIdentity?.userId) {
      const cachedUser = {
        userId: cachedIdentity.userId,
        firebaseUid: cachedIdentity.firebaseUid || cachedIdentity.userId,
        displayName: cachedIdentity.displayName || contact?.displayName || contact?.savedName || 'Contact',
      };
      setAppUser(cachedUser);
      setIsAppUser(true);

      if (cachedIdentity.conversationId) {
        setConversationId(cachedIdentity.conversationId);
        await loadUnifiedTimeline(cachedIdentity.conversationId);
        return;
      }

      const currentUserId = await AsyncStorage.getItem('firebaseUid');
      if (currentUserId) {
        const convId = await createConversation(
          cachedUser.firebaseUid || cachedUser.userId,
          cachedUser,
          currentUserId
        );
        setConversationId(convId);
        await saveCachedChatIdentity({
          ...cachedIdentity,
          conversationId: convId,
        });
        await loadUnifiedTimeline(convId);
      } else {
        await loadUnifiedTimeline(null);
      }
      return;
    }

    const resolved = resolveAppUserFromContact();
    if (resolved) {
      console.log('✅ [CHAT] Contact already has app user data:', resolved);
      setAppUser(resolved);
      setIsAppUser(true);
      await saveCachedChatIdentity({
        userId: resolved.userId || resolved.firebaseUid || '',
        firebaseUid: resolved.firebaseUid || resolved.userId || '',
        displayName: resolved.displayName || contact?.displayName || contact?.savedName || 'Contact',
        conversationId: null,
      });
      const currentUserId = await AsyncStorage.getItem('firebaseUid');
      if (currentUserId) {
        const convId = await createConversation(
          resolved.firebaseUid || resolved.userId,
          resolved,
          currentUserId
        );
        setConversationId(convId);
        await saveCachedChatIdentity({
          userId: resolved.userId || resolved.firebaseUid || '',
          firebaseUid: resolved.firebaseUid || resolved.userId || '',
          displayName: resolved.displayName || contact?.displayName || contact?.savedName || 'Contact',
          conversationId: convId,
        });
        await loadUnifiedTimeline(convId);
      }
      return;
    }
    try {
      setLoadingChat(true);
      const phoneNumber = getContactPhone();
      console.log('🔍 [CHAT] Extracted phone number (raw):', phoneNumber);

      if (!phoneNumber || phoneNumber === 'No phone number') {
        console.log('❌ [CHAT] No phone number found');
        setIsAppUser(false);
        setLoadingChat(false);
        return;
      }

      // Try multiple phone formats for better matching
      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      console.log('🔍 [CHAT] Normalized phone number:', normalizedPhone);

      if (!normalizedPhone) {
        console.log('❌ [CHAT] Phone number normalization failed');
        setIsAppUser(false);
        setLoadingChat(false);
        return;
      }

      // Try batch search with multiple formats
      console.log('🔍 [CHAT] Searching for user with phones:', [phoneNumber, normalizedPhone, `+91${normalizedPhone}`]);
      const usersMap = await batchSearchUsers([
        phoneNumber,           // Original format: +919256537003
        normalizedPhone,       // Normalized: 9256537003
        `+91${normalizedPhone}`  // With country code: +919256537003
      ]);
      console.log('📱 [CHAT] Search results map:', usersMap);
      const users = Object.values(usersMap || {});
      const user = users && users.length > 0 ? users[0] : null;

      if (user) {
        console.log('✅ [CHAT] App user found:', user);
        setAppUser(user);
        setIsAppUser(true);
        await saveCachedChatIdentity({
          userId: user.userId || user.firebaseUid || '',
          firebaseUid: user.firebaseUid || user.userId || '',
          displayName: user.displayName || contact?.displayName || contact?.savedName || 'Contact',
          conversationId: null,
        });

        // Get or create conversation
        const currentUserId = await AsyncStorage.getItem('firebaseUid');
        const convId = await createConversation(
          user.firebaseUid || user.userId,
          user,
          currentUserId
        );
        setConversationId(convId);
        await saveCachedChatIdentity({
          userId: user.userId || user.firebaseUid || '',
          firebaseUid: user.firebaseUid || user.userId || '',
          displayName: user.displayName || contact?.displayName || contact?.savedName || 'Contact',
          conversationId: convId,
        });

        // Load chat messages
        await loadUnifiedTimeline(convId);
      } else {
        console.log('❌ [CHAT] No app user found for phone:', phoneNumber);
        setIsAppUser(false);
      }
    } catch (error) {
      console.error('❌ [CHAT] Failed to map contact to user:', error);
      setIsAppUser(false);
    } finally {
      setLoadingChat(false);
    }
  };

  // Load unified timeline (transactions + messages)
  const loadUnifiedTimeline = async (convId = null) => {
    if (!contact?.recordID) {
      return;
    }

    try {
      const messages = convId ? await getMessages(convId, 50, 0) : [];
      const timeline = getUnifiedTimeline(contact.recordID, messages);
      const sorted = [...(timeline || [])].sort(
        (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
      );
      setUnifiedTimeline(sorted);
    } catch (error) {
      console.error('Failed to load unified timeline:', error);
      setUnifiedTimeline([]);
    }
  };

  // Load current user ID on mount
  useEffect(() => {
    const loadCurrentUserId = async () => {
      try {
        const uid = await AsyncStorage.getItem('firebaseUid');
        setCurrentUserId(uid);
      } catch (error) {
        console.error('Failed to load current user ID:', error);
      }
    };
    loadCurrentUserId();
  }, []);

  // Map contact to app user on mount
  useEffect(() => {
    if (contact) {
      mapContactToAppUser();
    }
  }, [contact?.recordID, contact?.phoneNumbers]);

  // Send message handler
  const handleSendMessage = async () => {
    if (!messageText.trim() || !conversationId || !appUser) return;

    chatInputRef.current?.focus();
    setSendingMessage(true);
    const now = Date.now();
    const messageId = `msg_${now}_${Math.random().toString(36).substr(2, 9)}`;
    const messageValue = messageText.trim();

    const optimisticMessage = {
      id: `msg-${messageId}`,
      type: 'message',
      timestamp: now,
      data: {
        message_id: messageId,
        message_text: messageValue,
        sender_id: currentUserId || '',
        receiver_id: appUser.firebaseUid || appUser.userId,
        delivery_status: 'sending',
        is_read: 0,
        timestamp: now,
      },
    };

    setUnifiedTimeline(prev => [optimisticMessage, ...(prev || [])]);
    setMessageText('');
    setTimeout(() => {
      chatInputRef.current?.focus();
    }, 0);

    try {
      console.log('???? [SEND] Starting message send...');
      console.log('???? [SEND] Message:', {
        messageId,
        conversationId,
        receiverId: appUser.firebaseUid || appUser.userId,
        messageText: messageValue.substring(0, 50) + '...',
      });

      // Send message via messaging service
      const result = await sendMessageToUser(
        appUser.firebaseUid || appUser.userId,
        {
          conversationId,
          messageId,
          messageText: messageValue,
          messageType: 'text',
          timestamp: now,
        }
      );

      console.log('??? [SEND] Backend response received:', result);

      // Reload messages
      console.log('???? [SEND] Loading messages from database...');
      await loadUnifiedTimeline(conversationId);
      console.log('??? [SEND] Messages loaded');

      console.log('??? [SEND] Message sent successfully!');
      showToast('Message sent', 'success');
    } catch (error) {
      console.error('??? [SEND] Failed to send message:', error);
      console.error('??? [SEND] Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      showToast('Failed to send message', 'error');
      await loadUnifiedTimeline(conversationId);
    } finally {
      setSendingMessage(false);
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

    // Ledger-first: show ledger entries immediately
    loadUnifiedTimeline(null);

    if (conversationId) {
      loadUnifiedTimeline(conversationId);
    }
  };

  const getContactName = () => {
    if (contact?.savedName) {
      return contact.savedName;
    }
    const fullName = [contact?.givenName, contact?.familyName]
      .filter(Boolean)
      .join(' ')
      .trim();
    return fullName || contact?.displayName || 'Unknown Contact';
  };

  const normalizePhoneNumber = (phone) => {
    if (!phone) return '';
    // Remove all non-digits
    const digits = String(phone).replace(/\D/g, '');
    // Return last 10 digits (remove country code)
    if (digits.length > 10) {
      return digits.slice(-10);
    }
    return digits.length >= 8 ? digits : '';
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

  const getLatestTransactionId = () => {
    if (!transactions || transactions.length === 0) {
      return null;
    }
    const last = transactions[transactions.length - 1];
    return last?.id ?? null;
  };

  const canEditTransaction = txn => {
    if (!txn) {
      return false;
    }
    if (Number(txn.edit_count) >= 3) {
      return false;
    }
    const latestId = getLatestTransactionId();
    return latestId && txn.id === latestId;
  };

  const canDeleteTransaction = txn => {
    if (!txn) {
      return false;
    }
    const latestId = getLatestTransactionId();
    return latestId && txn.id === latestId;
  };

  const openTransactionMenu = txn => {
    setSelectedTransaction(txn);
    setOptionsVisible(true);
  };

  const closeTransactionMenu = () => {
    setOptionsVisible(false);
    setSelectedTransaction(null);
  };

  const handleEditAmount = () => {
    if (!selectedTransaction || !canEditTransaction(selectedTransaction)) {
      return;
    }
    const currentAbs = Math.abs(Number(selectedTransaction.amount) || 0);
    setEditAmount(String(currentAbs || ''));
    setEditAmountVisible(true);
    closeTransactionMenu();
  };

  const handleEditRemark = () => {
    if (!selectedTransaction || !canEditTransaction(selectedTransaction)) {
      return;
    }
    setEditRemark(selectedTransaction.note || '');
    setEditRemarkVisible(true);
    closeTransactionMenu();
  };

  const handleSaveEditAmount = async () => {
    if (!selectedTransaction) {
      return;
    }
    const parsed = parseFloat(String(editAmount).replace(/[^0-9.]/g, ''));
    if (!parsed || parsed <= 0) {
      showToast('Please enter a valid amount.', 'error');
      return;
    }
    if (!canEditTransaction(selectedTransaction)) {
      showToast('Edit not allowed.', 'error');
      return;
    }
    const nextAmount = selectedTransaction.type === 'paid' ? parsed : parsed;
    const nextEditCount = Number(selectedTransaction.edit_count || 0) + 1;
    setLoading(true);
    try {
      await updateLedgerTransactionAmount(selectedTransaction.id, nextAmount, nextEditCount);
      setEditAmountVisible(false);
      setEditAmount('');
      setSelectedTransaction(null);
      loadTransactions();
    } catch (error) {
      console.error('Failed to update amount:', error);
      Alert.alert('Error', 'Failed to update amount. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEditRemark = async () => {
    if (!selectedTransaction) {
      return;
    }
    if (!canEditTransaction(selectedTransaction)) {
      showToast('Edit not allowed.', 'error');
      return;
    }
    setLoading(true);
    try {
      await updateLedgerTransactionNote(selectedTransaction.id, editRemark.trim());
      setEditRemarkVisible(false);
      setEditRemark('');
      setSelectedTransaction(null);
      loadTransactions();
    } catch (error) {
      console.error('Failed to update remark:', error);
      Alert.alert('Error', 'Failed to update remark. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTransaction = () => {
    if (!selectedTransaction || !canDeleteTransaction(selectedTransaction)) {
      return;
    }
    Alert.alert('Delete Entry', 'Are you sure you want to delete this entry?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            await deleteTransaction(selectedTransaction.id);
            closeTransactionMenu();
            loadTransactions();
          } catch (error) {
            console.error('Failed to delete transaction:', error);
            Alert.alert('Error', 'Failed to delete entry.');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const formatTimeLabel = timestamp => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const balanceAfterById = useMemo(() => {
    const map = {};
    let running = 0;
    const ordered = [...(transactions || [])].sort(
      (a, b) => (a.transaction_date || 0) - (b.transaction_date || 0)
    );
    ordered.forEach(txn => {
      const amountValue = Number(txn.amount) || 0;
      const isPaid = txn.type === 'paid';
      running += isPaid ? amountValue : -amountValue;
      map[txn.id] = running;
    });
    return map;
  }, [transactions]);

  const timelineForList = useMemo(() => {
    let lastDateKey = '';
    return (unifiedTimeline || []).map(item => {
      if (item.type !== 'transaction' || !item.data) {
        return {...item, showDate: false};
      }
      const dateKey = new Date(item.data.transaction_date).toDateString();
      const showDate = dateKey !== lastDateKey;
      lastDateKey = dateKey;
      return {...item, showDate};
    });
  }, [unifiedTimeline]);

  // Render chat message bubble (using currentUserId from state)
  const renderChatMessage = (message, currentUserId) => {
    const isSent = message.sender_id === currentUserId;

    return (
      <View key={`msg-${message.message_id || message.id}`} style={styles.chatRow}>
        <View style={[
          styles.chatBubble,
          isSent ? styles.chatBubbleSent : styles.chatBubbleReceived
        ]}>
          <Text style={styles.chatMessageText}>{message.message_text}</Text>
          <Text style={styles.chatTime}>
            {formatTimeLabel(message.timestamp)}
          </Text>
        </View>
      </View>
    );
  };

  const renderTimelineItem = (item) => {
    if (!item) {
      return null;
    }

    if (item.type === 'message') {
      return renderChatMessage(item.data, currentUserId);
    }

    const transaction = item.data;
    if (!transaction) {
      return null;
    }

    const amountValue = Number(transaction.amount) || 0;
    const isPaid = transaction.type === 'paid';

    return (
      <View>
        {item.showDate && (
          <View style={styles.datePill}>
            <Text style={styles.datePillText}>
              {formatDateLabel(transaction.transaction_date)}
            </Text>
          </View>
        )}
        <Pressable
          style={[styles.chatRow, isPaid && styles.chatRowDebit]}
          onLongPress={() => openTransactionMenu(transaction)}
          delayLongPress={250}>
          <View
            style={[
              styles.chatBubble,
              isPaid ? styles.chatBubbleDebit : styles.chatBubbleCredit,
            ]}>
            <View style={styles.chatHeader}>
              <View style={[styles.chatIcon, isPaid && styles.chatIconDebit]}>
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
              {formatSignedBalance(balanceAfterById[transaction.id] || 0)}
            </Text>
          </View>
        </Pressable>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      enabled={Platform.OS === 'ios'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}>
      <View style={styles.content}>
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

      <FlatList
        ref={listRef}
        data={timelineForList}
        keyExtractor={item => item.id}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          styles.historySection,
          styles.chatList,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        inverted
        renderItem={({item}) => renderTimelineItem(item)}
        ListEmptyComponent={
          <View style={styles.emptyHistory}>
            <Icon name="receipt-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyText}>No transactions or messages yet</Text>
          </View>
        }
      />

      {/* Bottom Buttons */}
      {!isKeyboardVisible && (
        <View style={[styles.bottomButtons, {paddingBottom: spacing.md + insets.bottom}]}>
        <TouchableOpacity
          style={[styles.actionButton, styles.paidButton]}
          onPress={() => openTransactionModal('paid')}>
          <Icon name="arrow-up" size={20} color="#EF4444" />
          <Text style={styles.paidButtonText}>Paid</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.getButton]}
          onPress={() => openTransactionModal('get')}>
          <Icon name="arrow-down" size={20} color="#10B981" />
          <Text style={styles.getButtonText}>Get</Text>
        </TouchableOpacity>
        </View>
      )}

      {/* Chat Input (only if app user) */}
      {isAppUser && (
        <View style={[styles.chatInputContainer, {paddingBottom: spacing.sm + insets.bottom + (Platform.OS === 'android' ? keyboardHeight : 0)}]}>
          <TextInput
            ref={chatInputRef}
            style={styles.chatInput}
            placeholder="Type a message..."
            value={messageText}
            onChangeText={setMessageText}
            multiline
            blurOnSubmit={false}
            placeholderTextColor={colors.text.secondary}
            editable={true}
          />
          <TouchableOpacity
            style={styles.sendButton}
            onPress={handleSendMessage}
            disabled={!messageText.trim() || sendingMessage}>
            <Icon
              name="send"
              size={20}
              color={messageText.trim() && !sendingMessage ? colors.primary : colors.text.light}
            />
          </TouchableOpacity>
        </View>
      )}

      {/* Invite Banner (if not app user) */}
      {!isAppUser && !loadingChat && (
        <View style={[styles.inviteBanner, {paddingBottom: spacing.md + insets.bottom}]}>
          <Text style={styles.inviteText}>
            Invite {getContactName()} to enable chat feature.
          </Text>
          <TouchableOpacity style={styles.inviteButton}>
            <Text style={styles.inviteButtonText}>Invite</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Entry Options */}
      <Modal
        visible={optionsVisible}
        transparent
        animationType="none"
        onRequestClose={closeTransactionMenu}>
        <Animated.View
          style={[styles.optionsOverlay, {opacity: optionsOverlayOpacity}]}
        >
          <TouchableOpacity
            style={styles.optionsOverlayTouchable}
            activeOpacity={1}
            onPress={closeTransactionMenu}
          />
          <Animated.View
            style={[
              styles.optionsContainer,
              {transform: [{translateY: optionsContentTranslateY}]},
            ]}>
            <View style={styles.optionsHeader}>
              <Text style={styles.optionsTitle}>
                {selectedTransaction
                  ? `Options for ${formatCurrency(
                      Math.abs(Number(selectedTransaction.amount) || 0)
                    )}`
                  : 'Options'}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.optionButton,
                !canEditTransaction(selectedTransaction) &&
                  styles.optionButtonDisabled,
              ]}
              disabled={!canEditTransaction(selectedTransaction)}
              onPress={handleEditAmount}>
              <View style={styles.optionItemRow}>
                <Icon
                  name="create-outline"
                  size={20}
                  color={
                    canEditTransaction(selectedTransaction)
                      ? colors.text.primary
                      : colors.text.light
                  }
                />
                <Text
                  style={[
                    styles.optionText,
                    !canEditTransaction(selectedTransaction) &&
                      styles.optionTextDisabled,
                  ]}>
                  Edit Amount
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.optionButton,
                !canEditTransaction(selectedTransaction) &&
                  styles.optionButtonDisabled,
              ]}
              disabled={!canEditTransaction(selectedTransaction)}
              onPress={handleEditRemark}>
              <View style={styles.optionItemRow}>
                <Icon
                  name="chatbubble-ellipses-outline"
                  size={20}
                  color={
                    canEditTransaction(selectedTransaction)
                      ? colors.text.primary
                      : colors.text.light
                  }
                />
                <Text
                  style={[
                    styles.optionText,
                    !canEditTransaction(selectedTransaction) &&
                      styles.optionTextDisabled,
                  ]}>
                  Edit Remark
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.optionButton,
                styles.optionDelete,
                !canDeleteTransaction(selectedTransaction) &&
                  styles.optionButtonDisabled,
              ]}
              disabled={!canDeleteTransaction(selectedTransaction)}
              onPress={handleDeleteTransaction}>
              <View style={styles.optionItemRow}>
                <Icon
                  name="trash-outline"
                  size={20}
                  color={
                    canDeleteTransaction(selectedTransaction)
                      ? '#B91C1C'
                      : colors.text.light
                  }
                />
                <Text
                  style={[
                    styles.optionText,
                    styles.optionDeleteText,
                    !canDeleteTransaction(selectedTransaction) &&
                      styles.optionTextDisabled,
                  ]}>
                  Delete Entry
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.optionButton, styles.optionButtonCancel]}
              onPress={closeTransactionMenu}>
              <View style={styles.optionItemRow}>
                <Icon name="close" size={20} color={colors.text.secondary} />
                <Text style={styles.optionTextCancel}>Cancel</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* Edit Amount Modal */}
      <Modal
        visible={editAmountVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditAmountVisible(false)}>
        <View style={styles.promptOverlay}>
          <TouchableOpacity
            style={styles.promptBackdrop}
            activeOpacity={1}
            onPress={() => setEditAmountVisible(false)}
          />
          <View style={styles.editModalCard}>
            <Text style={styles.editModalTitle}>Edit Amount</Text>
            <TextInput
              style={styles.editModalInput}
              value={editAmount}
              onChangeText={setEditAmount}
              keyboardType="numeric"
              editable={!loading}
            />
            <TouchableOpacity
              style={[styles.editModalButton, loading && styles.buttonDisabled]}
              onPress={handleSaveEditAmount}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.editModalButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit Remark Modal */}
      <Modal
        visible={editRemarkVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditRemarkVisible(false)}>
        <View style={styles.promptOverlay}>
          <TouchableOpacity
            style={styles.promptBackdrop}
            activeOpacity={1}
            onPress={() => setEditRemarkVisible(false)}
          />
          <View style={styles.editModalCard}>
            <Text style={styles.editModalTitle}>Edit Remark</Text>
            <TextInput
              style={styles.editModalInput}
              value={editRemark}
              onChangeText={setEditRemark}
              placeholder="Add a remark"
              placeholderTextColor={colors.text.light}
              editable={!loading}
              multiline
            />
            <TouchableOpacity
              style={[styles.editModalButton, loading && styles.buttonDisabled]}
              onPress={handleSaveEditRemark}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.editModalButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
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
    padding: spacing.md,
    paddingBottom: spacing.md,
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
    marginBottom: 0,
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
  chatMessageText: {
    fontSize: fontSize.medium,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  chatBubbleSent: {
    backgroundColor: '#DCF8C6',
    alignSelf: 'flex-end',
  },
  chatBubbleReceived: {
    backgroundColor: '#E8E8E8',
    alignSelf: 'flex-start',
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.medium,
    maxHeight: 100,
    color: colors.text.primary,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: '#FFF3CD',
    borderTopWidth: 1,
    borderTopColor: '#FFE69C',
  },
  inviteText: {
    fontSize: fontSize.small,
    color: '#856404',
    flex: 1,
  },
  inviteButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: '#FFC107',
    borderRadius: 8,
  },
  inviteButtonText: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
    color: '#856404',
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
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    paddingVertical: spacing.md,
    borderRadius: 999,
    gap: 6,
    borderWidth: 1,
    zIndex: 999,
  },
  paidButton: {
    backgroundColor: colors.white,
    borderColor: '#EF4444',
  },
  getButton: {
    backgroundColor: colors.white,
    borderColor: '#10B981',
  },
  actionButtonText: {
    fontSize: fontSize.medium,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  paidButtonText: {
    fontSize: fontSize.medium,
    fontWeight: fontWeight.semibold,
    color: '#EF4444',
  },
  getButtonText: {
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
    ...StyleSheet.absoluteFillObject,
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
  optionTextDisabled: {
    color: colors.text.light,
  },
  optionDelete: {
    backgroundColor: 'transparent',
  },
  optionDeleteText: {
    color: '#B91C1C',
  },
  optionButtonDisabled: {
    opacity: 0.6,
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
});

export default LedgerContactDetailScreen;

