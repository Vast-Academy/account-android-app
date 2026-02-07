import messaging from '@react-native-firebase/messaging';
import auth from '@react-native-firebase/auth';
import notifee from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { navigationRef } from '../navigation/AppNavigator';
import { chatStore } from '../context/ChatStore';
import {DeviceEventEmitter} from 'react-native';
import {
  initLedgerDatabase,
  createTransaction as createLedgerTransaction,
} from './ledgerDatabase';
import {
  initChatDatabase,
  insertMessage,
  updateMessageStatus,
  updateConversation,
  queueMessage,
  getPendingMessages,
  removeFromQueue,
  incrementRetryCount,
  getMessageById,
} from './chatDatabase';

// Backend API base URL
const API_URL = 'https://account-android-app-backend.vercel.app/api';

const incomingMessageListeners = new Set();

const PENDING_CHAT_NAV_KEY = 'pendingChatNavigation';
const LEDGER_CONTACTS_KEY = 'ledgerContacts';
const PROCESSED_LEDGER_EVENTS_KEY = 'processedLedgerEvents:v1';

/**
 * Get Firebase auth token
 */
const getAuthToken = async () => {
  const currentUser = auth().currentUser;
  if (!currentUser) {
    throw new Error('User not authenticated');
  }
  return await currentUser.getIdToken();
};

/**
 * Request notification permissions from user
 */
export const requestNotificationPermission = async () => {
  try {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
      const fcmToken = await messaging().getToken();
      console.log('FCM Token:', fcmToken);
      return fcmToken;
    }

    console.log('Notification permission denied');
    return null;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return null;
  }
};


const storePendingChatNavigation = async (data) => {
  try {
    const payload = {
      conversationId: data?.conversationId || '',
      senderId: data?.senderId || '',
      senderName: data?.senderName || 'Contact',
    };
    await AsyncStorage.setItem(PENDING_CHAT_NAV_KEY, JSON.stringify(payload));
  } catch (error) {
    console.error('Failed to store pending chat navigation:', error);
  }
};


const navigateToChatFromNotification = async (data) => {
  await storePendingChatNavigation(data);
  if (!data?.conversationId) {
    return;
  }
  const attemptNavigate = () => {
    if (!navigationRef.isReady()) {
      return false;
    }
    navigationRef.navigate('LedgerContactDetail', {
      contact: {
        recordID: '',
        userId: data.senderId || '',
        displayName: data.senderName || 'Contact',
        phoneNumbers: [],
        isAppUser: true,
      },
    });
    return true;
  };

  if (attemptNavigate()) {
    return;
  }

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (attemptNavigate() || attempts >= 6) {
      clearInterval(timer);
    }
  }, 300);
};

export const subscribeToIncomingMessages = (listener) => {
  incomingMessageListeners.add(listener);
  return () => {
    incomingMessageListeners.delete(listener);
  };
};

/**
 * Send message to another user via backend
 */
export const sendMessageToUser = async (receiverId, messageData) => {
  const currentUserId = auth().currentUser?.uid;
  if (!currentUserId) {
    throw new Error('User not authenticated');
  }

  const messageId =
    messageData.messageId ||
    `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    // 1. Save message locally first (with "sending" status)
    await insertMessage({
      messageId,
      conversationId: messageData.conversationId,
      senderId: currentUserId,
      receiverId,
      messageText: messageData.messageText || '',
      messageType: messageData.messageType || 'text',
      imageUri: messageData.imageUri || null,
      transactionRequestData: messageData.transactionRequestData || null,
      deliveryStatus: 'sending',
      timestamp: messageData.timestamp || Date.now(),
      isRead: 0,
    });

    // Update conversation
    await updateConversation(messageData.conversationId, {
      lastMessageText: messageData.messageText,
      lastMessageTimestamp: messageData.timestamp || Date.now(),
    });

    // 2. Send to backend for relay
    console.log('📤 [BACKEND] Preparing to send to backend...');
    const token = await getAuthToken();
    console.log('✅ [BACKEND] Auth token obtained');

    console.log('📤 [BACKEND] Calling /api/messages/send endpoint...');
    const response = await fetch(`${API_URL}/messages/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        conversationId: messageData.conversationId,
        senderId: currentUserId,
        receiverId,
        messageId,
        messageText: messageData.messageText || '',
        messageType: messageData.messageType || 'text',
        imageUri: messageData.imageUri || null,
        transactionRequestData: messageData.transactionRequestData || null,
        timestamp: messageData.timestamp || Date.now(),
      }),
    });

    console.log('📥 [BACKEND] Response status:', response.status);
    const responseData = await response.json();
    console.log('📥 [BACKEND] Response data:', responseData);

    if (response.ok) {
      console.log('✅ [BACKEND] Message relayed successfully to backend');
      // Update delivery status to "sent"
      await updateMessageStatus(messageId, 'sent');
      console.log('✅ [DB] Message status updated to "sent"');
    } else {
      console.error('❌ [BACKEND] Backend returned error:', responseData);
      // Queue for retry
      await queueMessage(messageId, receiverId, messageData);
      await updateMessageStatus(messageId, 'queued');
      console.log('⏳ [DB] Message queued for retry');
    }

    return messageId;
  } catch (error) {
    console.error('Error sending message:', error);

    // Queue for retry
    await queueMessage(messageId, receiverId, messageData);
    await updateMessageStatus(messageId, 'queued');

    return messageId;
  }
};

/**
 * Handle incoming FCM messages (foreground & background)
 */

const readLedgerContacts = async () => {
  try {
    const raw = await AsyncStorage.getItem(LEDGER_CONTACTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to read ledger contacts:', error);
    return [];
  }
};

const writeLedgerContacts = async contacts => {
  try {
    await AsyncStorage.setItem(LEDGER_CONTACTS_KEY, JSON.stringify(contacts));
  } catch (error) {
    console.error('Failed to write ledger contacts:', error);
  }
};

const resolveLedgerContactRecordId = async (sourceUserId, sourceName = 'App User') => {
  const contacts = await readLedgerContacts();
  const sourceId = String(sourceUserId || '');
  if (!sourceId) return null;

  const existing = contacts.find(item => String(item?.userId || item?.firebaseUid || '') === sourceId);
  if (existing?.recordID) {
    return String(existing.recordID);
  }

  const recordID = 'app_' + sourceId;
  contacts.push({
    recordID,
    displayName: sourceName || 'App User',
    givenName: '',
    familyName: '',
    phoneNumbers: [],
    isAppUser: 1,
    userId: sourceId,
  });
  await writeLedgerContacts(contacts);
  return recordID;
};

const wasLedgerEventProcessed = async idempotencyKey => {
  try {
    const raw = await AsyncStorage.getItem(PROCESSED_LEDGER_EVENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return false;
    return parsed.includes(idempotencyKey);
  } catch {
    return false;
  }
};

const markLedgerEventProcessed = async idempotencyKey => {
  try {
    const raw = await AsyncStorage.getItem(PROCESSED_LEDGER_EVENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(parsed) ? parsed : [];
    if (!list.includes(idempotencyKey)) {
      list.push(idempotencyKey);
    }
    const trimmed = list.slice(-500);
    await AsyncStorage.setItem(PROCESSED_LEDGER_EVENTS_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error('Failed to mark ledger event processed:', error);
  }
};

const handleLedgerEvent = async data => {
  const sourceUserId = String(data?.sourceUserId || data?.senderId || '');
  const originTxnId = String(data?.originTxnId || data?.transactionId || '');
  const op = String(data?.op || 'create');
  const idempotencyKey = String(
    data?.idempotencyKey || ('ledger:' + sourceUserId + ':' + originTxnId + ':' + op)
  );

  if (!sourceUserId || !originTxnId) {
    return;
  }

  if (await wasLedgerEventProcessed(idempotencyKey)) {
    return;
  }

  if (op !== 'create') {
    await markLedgerEventProcessed(idempotencyKey);
    return;
  }

  initLedgerDatabase();

  const amount = Math.abs(Number(data?.amount || 0));
  if (!amount) {
    await markLedgerEventProcessed(idempotencyKey);
    return;
  }

  const sourceType =
    data?.entryType === 'get' || data?.transactionType === 'get' || data?.type === 'get'
      ? 'get'
      : 'paid';
  const mirroredType = sourceType === 'paid' ? 'get' : 'paid';
  const sourceName = data?.sourceUserName || data?.senderName || 'App User';
  const contactRecordId = await resolveLedgerContactRecordId(sourceUserId, sourceName);

  if (!contactRecordId) {
    return;
  }

  createLedgerTransaction(contactRecordId, amount, mirroredType, String(data?.note || ''));
  await markLedgerEventProcessed(idempotencyKey);

  DeviceEventEmitter.emit('ledger:updated', {
    contactRecordId,
    sourceUserId,
    originTxnId,
    op,
  });
};

export const handleIncomingMessage = async (remoteMessage) => {
  try {
    const {data} = remoteMessage;

    if (!data || !data.type) {
      console.log('Invalid message data');
      return;
    }

    if (data.type === 'ledger_event') {
      await handleLedgerEvent(data);
      return;
    }

    if (data.type === 'chat_message') {
      console.log('💬 [RECEIVE] Incoming message received:', {
        messageId: data.messageId,
        conversationId: data.conversationId,
        senderName: data.senderName,
        messageText: data.messageText?.substring(0, 50) + '...',
      });

      // Skip duplicate message insert
      if (getMessageById(data.messageId)) {
        console.log('⚠️ [RECEIVE] Duplicate message skipped:', data.messageId);
        return;
      }

      // Save message to local database
      console.log('💾 [RECEIVE] Saving message to local database...');
      await insertMessage({
        messageId: data.messageId,
        conversationId: data.conversationId,
        senderId: data.senderId,
        receiverId: auth().currentUser?.uid,
        messageText: data.messageText || '',
        messageType: data.messageType || 'text',
        imageUri: data.imageUri || null,
        transactionRequestData: data.transactionRequestData || null,
        timestamp: parseInt(data.timestamp),
        deliveryStatus: 'delivered',
        isRead: 0,
      });
      console.log('✅ [RECEIVE] Message saved to database');

      // Update conversation
      console.log('🔄 [RECEIVE] Updating conversation...');
      await updateConversation(data.conversationId, {
        lastMessageText: data.messageText,
        lastMessageTimestamp: parseInt(data.timestamp),
        unreadCount: 'INCREMENT',
      });
      console.log('✅ [RECEIVE] Conversation updated');

      // Send delivery receipt back
      console.log('📤 [RECEIVE] Sending delivery receipt to sender...');
      await sendDeliveryReceipt(data.senderId, data.messageId, 'delivered');
      console.log('✅ [RECEIVE] Delivery receipt sent');

      // Notify central chat store
      chatStore.emitIncomingMessage(data);

      // Notify listeners
      incomingMessageListeners.forEach(listener => {
        try {
          listener(data);
        } catch (listenerError) {
          console.error('❌ Incoming message listener error:', listenerError);
        }
      });

      // Show local notification
      console.log('🔔 [RECEIVE] Showing local notification...');
      await displayLocalNotification({
        title: data.senderName || 'New Message',
        body: data.messageText || 'You have a new message',
        conversationId: data.conversationId,
        senderId: data.senderId,
      });
      console.log('✅ [RECEIVE] Notification shown');
    }

    if (data.type === 'delivery_receipt') {
      console.log('📦 [RECEIPT] Delivery receipt received:', {
        messageId: data.messageId,
        status: data.status,
      });
      // Update message delivery status
      await updateMessageStatus(data.messageId, data.status);
      console.log('✅ [RECEIPT] Message status updated to:', data.status);
    }

    if (data.type === 'read_receipt') {
      console.log('👁️ [RECEIPT] Read receipt received:', {
        messageId: data.messageId,
      });
      // Update message read status
      await updateMessageStatus(data.messageId, 'read');
      console.log('✅ [RECEIPT] Message status updated to: read');
    }
  } catch (error) {
    console.error('Error handling incoming message:', error);
  }
};

/**
 * Send delivery receipt back to sender
 */
export const sendDeliveryReceipt = async (senderId, messageId, status) => {
  try {
    const token = await getAuthToken();

    await fetch(`${API_URL}/messages/delivery-receipt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        senderId,
        messageId,
        status, // 'delivered' or 'read'
      }),
    });
  } catch (error) {
    console.error('Error sending delivery receipt:', error);
  }
};

/**
 * Display local notification
 */
export const displayLocalNotification = async (messageData) => {
  try {
    // Create notification channel
    const channelId = await notifee.createChannel({
      id: 'chat_messages',
      name: 'Chat Messages',
      importance: 4, // High importance
      sound: 'default',
    });

    // Display notification
    await notifee.displayNotification({
      title: messageData.title,
      body: messageData.body,
      android: {
        channelId,
        smallIcon: 'ic_launcher',
        pressAction: {
          id: 'open_chat',
          launchActivity: 'default',
        },
        importance: 4,
      },
      data: {
        conversationId: messageData.conversationId,
        senderId: messageData.senderId,
      },
    });
  } catch (error) {
    console.error('Error displaying notification:', error);
  }
};

/**
 * Setup FCM listeners (foreground & background)
 */
export const setupFCMListeners = () => {
  // Foreground message handler
  messaging().onMessage(async remoteMessage => {
    console.log('Foreground message received:', remoteMessage);
    await handleIncomingMessage(remoteMessage);
  });

  // Background message handler
  messaging().setBackgroundMessageHandler(async remoteMessage => {
    console.log('Background message received:', remoteMessage);
    await handleIncomingMessage(remoteMessage);
  });


  // Notification opened handler (when user taps on notification)
  messaging().onNotificationOpenedApp(async remoteMessage => {
    if (remoteMessage) {
      await handleIncomingMessage(remoteMessage);
      const data = remoteMessage?.data || {};
      await navigateToChatFromNotification(data);
    }
  });

  // App opened from quit state by notification
  messaging().getInitialNotification().then(async remoteMessage => {
    if (remoteMessage) {
      await handleIncomingMessage(remoteMessage);
      const data = remoteMessage?.data || {};
      await navigateToChatFromNotification(data);
    }
  });


  // Notifee foreground notification tap
  notifee.onForegroundEvent(async ({type, detail}) => {
    if (type === 1) {
      const data = detail?.notification?.data || {};
      await navigateToChatFromNotification(data);
    }
  });

  // Notifee background notification tap
  notifee.onBackgroundEvent(async ({type, detail}) => {
    if (type === 1) {
      const data = detail?.notification?.data || {};
      await navigateToChatFromNotification(data);
    }
  });
  console.log('FCM listeners setup complete');
};

/**
 * Process pending messages (retry failed sends)
 */
export const processPendingMessages = async () => {
  try {
    const pendingMessages = getPendingMessages();

    if (pendingMessages.length === 0) {
      return;
    }

    console.log(`Processing ${pendingMessages.length} pending messages...`);

    for (const queuedMessage of pendingMessages) {
      try {
        const messageData = JSON.parse(queuedMessage.message_data);
        const token = await getAuthToken();

        // Retry sending
        const response = await fetch(`${API_URL}/messages/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            conversationId: messageData.conversationId,
            senderId: messageData.senderId,
            receiverId: queuedMessage.receiver_id,
            messageId: queuedMessage.message_id,
            messageText: messageData.messageText,
            messageType: messageData.messageType,
            imageUri: messageData.imageUri,
            timestamp: messageData.timestamp,
          }),
        });

        if (response.ok) {
          // Success - remove from queue
          removeFromQueue(queuedMessage.queue_id);
          await updateMessageStatus(queuedMessage.message_id, 'sent');
          console.log(`Message ${queuedMessage.message_id} sent successfully`);
        } else {
          // Failed - increment retry count
          incrementRetryCount(queuedMessage.queue_id);
          console.log(
            `Message ${queuedMessage.message_id} retry ${queuedMessage.retry_count + 1}/3 failed`,
          );
        }
      } catch (error) {
        // Error - increment retry count
        incrementRetryCount(queuedMessage.queue_id);
        console.error('Error retrying message:', error);
      }
    }
  } catch (error) {
    console.error('Error processing pending messages:', error);
  }
};

/**
 * Setup network state listener for auto-retry
 */
export const setupNetworkListener = () => {
  const NetInfo = require('@react-native-community/netinfo');

  NetInfo.addEventListener(state => {
    if (state.isConnected) {
      console.log('Online - processing pending messages');
      processPendingMessages();
    }
  });
};

/**
 * Update FCM token on token refresh
 */
export const setupTokenRefreshListener = () => {
  messaging().onTokenRefresh(async fcmToken => {
    console.log('FCM token refreshed:', fcmToken);

    try {
      // Update token in backend
      const token = await getAuthToken();

      await fetch(`${API_URL}/users/update-fcm-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({fcmToken}),
      });
    } catch (error) {
      console.error('Error updating FCM token:', error);
    }
  });
};

/**
 * Initialize messaging service
 */
export const initMessagingService = async () => {
  try {
    // Initialize chat database first (creates all tables)
    console.log('🗄️ Initializing chat database...');
    initChatDatabase();
    console.log('✅ Chat database initialized');

    // Request permission
    const fcmToken = await requestNotificationPermission();
    console.log('✅ FCM Token obtained:', fcmToken ? `${fcmToken.substring(0, 20)}...` : 'null');

    if (fcmToken) {
      // Update token in backend
      console.log('📤 Sending FCM token to backend...');
      try {
        const token = await getAuthToken();
        console.log('✅ Auth token obtained');

        // Get current user data
        const firebaseUser = auth().currentUser;
        const firebaseUid = firebaseUser?.uid;
        const displayName = firebaseUser?.displayName || 'User';

        if (!firebaseUid) {
          console.warn('⚠️ No Firebase UID found');
          return;
        }

        // Use update-profile endpoint (which exists and works!)
        const response = await fetch(`${API_URL}/auth/update-profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            firebaseUid,
            displayName,
            fcmToken,
          }),
        });

        console.log('📥 Backend response status:', response.status);
        const responseData = await response.json();
        console.log('📥 Backend response:', responseData);

        if (response.ok) {
          console.log('✅ FCM token saved to backend successfully!');
        } else {
          console.error('❌ Backend error:', responseData.error || responseData.message);
        }
      } catch (tokenError) {
        console.error('❌ Error sending FCM token to backend:', tokenError.message);
      }
    } else {
      console.warn('⚠️ No FCM token received');
    }

    // Setup listeners
    setupFCMListeners();
    setupTokenRefreshListener();
    setupNetworkListener();

    console.log('✅ Messaging service initialized');
  } catch (error) {
    console.error('❌ Error initializing messaging service:', error);
  }
};

export default {
  requestNotificationPermission,
  sendMessageToUser,
  handleIncomingMessage,
  sendDeliveryReceipt,
  displayLocalNotification,
  setupFCMListeners,
  subscribeToIncomingMessages,
  processPendingMessages,
  setupNetworkListener,
  setupTokenRefreshListener,
  initMessagingService,
};

