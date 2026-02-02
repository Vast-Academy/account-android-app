import messaging from '@react-native-firebase/messaging';
import auth from '@react-native-firebase/auth';
import notifee from '@notifee/react-native';
import {
  insertMessage,
  updateMessageStatus,
  updateConversation,
  queueMessage,
  getPendingMessages,
  removeFromQueue,
  incrementRetryCount,
} from './chatDatabase';

// Backend API base URL
const API_URL = 'https://account-android-app-backend.vercel.app/api';

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
    const token = await getAuthToken();

    const response = await fetch(`${API_URL}/messages/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        receiverId,
        messageId,
        messageText: messageData.messageText || '',
        messageType: messageData.messageType || 'text',
        imageUri: messageData.imageUri || null,
        transactionRequestData: messageData.transactionRequestData || null,
        timestamp: messageData.timestamp || Date.now(),
      }),
    });

    if (response.ok) {
      // Update delivery status to "sent"
      await updateMessageStatus(messageId, 'sent');
    } else {
      // Queue for retry
      await queueMessage(messageId, receiverId, messageData);
      await updateMessageStatus(messageId, 'queued');
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
export const handleIncomingMessage = async (remoteMessage) => {
  try {
    const {data} = remoteMessage;

    if (!data || !data.type) {
      console.log('Invalid message data');
      return;
    }

    if (data.type === 'chat_message') {
      // Save message to local database
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

      // Update conversation
      await updateConversation(data.conversationId, {
        lastMessageText: data.messageText,
        lastMessageTimestamp: parseInt(data.timestamp),
        unreadCount: 'INCREMENT',
      });

      // Send delivery receipt back
      await sendDeliveryReceipt(data.senderId, data.messageId, 'delivered');

      // Show local notification
      await displayLocalNotification({
        title: data.senderName || 'New Message',
        body: data.messageText || 'You have a new message',
        conversationId: data.conversationId,
        senderId: data.senderId,
      });
    }

    if (data.type === 'delivery_receipt') {
      // Update message delivery status
      await updateMessageStatus(data.messageId, data.status);
    }

    if (data.type === 'read_receipt') {
      // Update message read status
      await updateMessageStatus(data.messageId, 'read');
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
        smallIcon: 'ic_notification',
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
  notifee.onBackgroundEvent(async ({type, detail}) => {
    if (type === 1) {
      // PRESS event
      const {conversationId} = detail.notification?.data || {};
      if (conversationId) {
        // Navigate to chat screen
        // This will be handled by navigation logic
        console.log('Open conversation:', conversationId);
      }
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
    // Request permission
    const fcmToken = await requestNotificationPermission();

    if (fcmToken) {
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
    }

    // Setup listeners
    setupFCMListeners();
    setupTokenRefreshListener();
    setupNetworkListener();

    console.log('Messaging service initialized');
  } catch (error) {
    console.error('Error initializing messaging service:', error);
  }
};

export default {
  requestNotificationPermission,
  sendMessageToUser,
  handleIncomingMessage,
  sendDeliveryReceipt,
  displayLocalNotification,
  setupFCMListeners,
  processPendingMessages,
  setupNetworkListener,
  setupTokenRefreshListener,
  initMessagingService,
};
