import {open} from 'react-native-quick-sqlite';

const DB_NAME = 'chatDB.db';

let db = null;

// Get or create database connection
const getDB = () => {
  if (!db) {
    db = open({name: DB_NAME});
  }
  return db;
};

/**
 * Initialize chat database with required tables
 */
export const initChatDatabase = () => {
  const database = getDB();

  // Create conversations table
  database.execute(`
    CREATE TABLE IF NOT EXISTS conversations (
      conversation_id TEXT PRIMARY KEY,
      other_user_id TEXT NOT NULL,
      other_user_username TEXT,
      other_user_name TEXT,
      other_user_phone TEXT,
      other_user_photo TEXT,
      last_message_text TEXT,
      last_message_timestamp INTEGER,
      unread_count INTEGER DEFAULT 0,
      is_pinned INTEGER DEFAULT 0,
      is_muted INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // Create messages table
  database.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      message_id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      receiver_id TEXT NOT NULL,
      message_text TEXT,
      message_type TEXT DEFAULT 'text',
      image_uri TEXT,
      transaction_request_data TEXT,
      delivery_status TEXT DEFAULT 'pending',
      is_read INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      deleted_at INTEGER,
      edit_history TEXT,
      timestamp INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations (conversation_id)
    )
  `);

  // Create user cache table
  database.execute(`
    CREATE TABLE IF NOT EXISTS user_cache (
      user_id TEXT PRIMARY KEY,
      username TEXT,
      display_name TEXT,
      phone_number TEXT,
      photo_url TEXT,
      is_online INTEGER DEFAULT 0,
      last_seen INTEGER,
      cached_at INTEGER
    )
  `);

  // Create message queue table for offline support
  database.execute(`
    CREATE TABLE IF NOT EXISTS message_queue (
      queue_id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT NOT NULL,
      conversation_id TEXT NOT NULL,
      receiver_id TEXT NOT NULL,
      message_data TEXT NOT NULL,
      retry_count INTEGER DEFAULT 0,
      last_retry_at INTEGER,
      created_at INTEGER NOT NULL
    )
  `);

  console.log('Chat database initialized successfully');
};

/**
 * Create or get existing conversation
 */
export const createConversation = (otherUserId, userData) => {
  const database = getDB();
  const currentUserId = global.currentUserId || 'temp_user'; // Get from auth context

  // Create conversation ID (sorted to ensure consistency)
  const conversationId = [currentUserId, otherUserId].sort().join('_');

  const now = Date.now();

  database.execute(
    `INSERT OR REPLACE INTO conversations
     (conversation_id, other_user_id, other_user_username, other_user_name,
      other_user_phone, other_user_photo, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      conversationId,
      otherUserId,
      userData.username || '',
      userData.displayName || '',
      userData.phoneNumber || '',
      userData.photoURL || '',
      now,
      now,
    ]
  );

  return conversationId;
};

/**
 * Get all conversations, sorted by last message timestamp
 */
export const getConversations = () => {
  const database = getDB();

  const result = database.execute(`
    SELECT * FROM conversations
    ORDER BY is_pinned DESC, last_message_timestamp DESC
  `);

  return result.rows?._array || [];
};

/**
 * Get conversation by ID
 */
export const getConversation = (conversationId) => {
  const database = getDB();

  const result = database.execute(
    'SELECT * FROM conversations WHERE conversation_id = ?',
    [conversationId]
  );

  return result.rows?._array?.[0] || null;
};

/**
 * Update conversation metadata
 */
export const updateConversation = (conversationId, updates) => {
  const database = getDB();
  const now = Date.now();

  const fields = [];
  const values = [];

  if (updates.lastMessageText !== undefined) {
    fields.push('last_message_text = ?');
    values.push(updates.lastMessageText);
  }

  if (updates.lastMessageTimestamp !== undefined) {
    fields.push('last_message_timestamp = ?');
    values.push(updates.lastMessageTimestamp);
  }

  if (updates.unreadCount === 'INCREMENT') {
    fields.push('unread_count = unread_count + 1');
  } else if (updates.unreadCount !== undefined) {
    fields.push('unread_count = ?');
    values.push(updates.unreadCount);
  }

  if (updates.isPinned !== undefined) {
    fields.push('is_pinned = ?');
    values.push(updates.isPinned ? 1 : 0);
  }

  if (updates.isMuted !== undefined) {
    fields.push('is_muted = ?');
    values.push(updates.isMuted ? 1 : 0);
  }

  fields.push('updated_at = ?');
  values.push(now);

  values.push(conversationId);

  database.execute(
    `UPDATE conversations SET ${fields.join(', ')} WHERE conversation_id = ?`,
    values
  );
};

/**
 * Insert a new message
 */
export const insertMessage = (messageData) => {
  const database = getDB();
  const now = Date.now();

  const messageId = messageData.messageId || `msg_${now}_${Math.random().toString(36).substr(2, 9)}`;

  database.execute(
    `INSERT INTO messages
     (message_id, conversation_id, sender_id, receiver_id, message_text,
      message_type, image_uri, transaction_request_data, delivery_status,
      is_read, timestamp, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      messageId,
      messageData.conversationId,
      messageData.senderId,
      messageData.receiverId,
      messageData.messageText || '',
      messageData.messageType || 'text',
      messageData.imageUri || null,
      messageData.transactionRequestData || null,
      messageData.deliveryStatus || 'pending',
      messageData.isRead ? 1 : 0,
      messageData.timestamp || now,
      now,
    ]
  );

  return messageId;
};

/**
 * Get messages for a conversation with pagination
 */
export const getMessages = (conversationId, limit = 50, offset = 0) => {
  const database = getDB();

  const result = database.execute(
    `SELECT * FROM messages
     WHERE conversation_id = ? AND is_deleted = 0
     ORDER BY timestamp DESC
     LIMIT ? OFFSET ?`,
    [conversationId, limit, offset]
  );

  return result.rows?._array || [];
};

/**
 * Update message status (pending → sending → sent → delivered → read)
 */
export const updateMessageStatus = (messageId, status) => {
  const database = getDB();

  database.execute(
    'UPDATE messages SET delivery_status = ? WHERE message_id = ?',
    [status, messageId]
  );
};

/**
 * Update message (for editing)
 */
export const updateMessage = (messageId, updates) => {
  const database = getDB();

  const fields = [];
  const values = [];

  if (updates.messageText !== undefined) {
    // Save edit history
    const result = database.execute(
      'SELECT message_text, edit_history FROM messages WHERE message_id = ?',
      [messageId]
    );

    if (result.rows?._array?.length > 0) {
      const oldMessage = result.rows._array[0];
      const editHistory = oldMessage.edit_history
        ? JSON.parse(oldMessage.edit_history)
        : [];

      editHistory.push({
        text: oldMessage.message_text,
        editedAt: Date.now(),
      });

      fields.push('edit_history = ?');
      values.push(JSON.stringify(editHistory));
    }

    fields.push('message_text = ?');
    values.push(updates.messageText);
  }

  if (updates.transactionRequestData !== undefined) {
    fields.push('transaction_request_data = ?');
    values.push(updates.transactionRequestData);
  }

  if (updates.isRead !== undefined) {
    fields.push('is_read = ?');
    values.push(updates.isRead ? 1 : 0);
  }

  values.push(messageId);

  if (fields.length > 0) {
    database.execute(
      `UPDATE messages SET ${fields.join(', ')} WHERE message_id = ?`,
      values
    );
  }
};

/**
 * Soft delete a message
 */
export const deleteMessage = (messageId) => {
  const database = getDB();
  const now = Date.now();

  database.execute(
    'UPDATE messages SET is_deleted = 1, deleted_at = ? WHERE message_id = ?',
    [now, messageId]
  );
};

/**
 * Cache user data locally
 */
export const cacheUserData = (userData) => {
  const database = getDB();
  const now = Date.now();

  database.execute(
    `INSERT OR REPLACE INTO user_cache
     (user_id, username, display_name, phone_number, photo_url,
      is_online, last_seen, cached_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userData.userId,
      userData.username || '',
      userData.displayName || '',
      userData.phoneNumber || '',
      userData.photoURL || '',
      userData.isOnline ? 1 : 0,
      userData.lastOnline || now,
      now,
    ]
  );
};

/**
 * Get cached user data
 */
export const getCachedUser = (userId) => {
  const database = getDB();

  const result = database.execute(
    'SELECT * FROM user_cache WHERE user_id = ?',
    [userId]
  );

  return result.rows?._array?.[0] || null;
};

/**
 * Queue message for retry when offline
 */
export const queueMessage = (messageId, receiverId, messageData) => {
  const database = getDB();
  const now = Date.now();

  database.execute(
    `INSERT INTO message_queue
     (message_id, conversation_id, receiver_id, message_data, retry_count, created_at)
     VALUES (?, ?, ?, ?, 0, ?)`,
    [
      messageId,
      messageData.conversationId,
      receiverId,
      JSON.stringify(messageData),
      now,
    ]
  );
};

/**
 * Get pending messages for retry
 */
export const getPendingMessages = () => {
  const database = getDB();

  const result = database.execute(
    'SELECT * FROM message_queue WHERE retry_count < 3 ORDER BY created_at ASC'
  );

  return result.rows?._array || [];
};

/**
 * Remove message from queue after successful send
 */
export const removeFromQueue = (queueId) => {
  const database = getDB();

  database.execute('DELETE FROM message_queue WHERE queue_id = ?', [queueId]);
};

/**
 * Increment retry count for a queued message
 */
export const incrementRetryCount = (queueId) => {
  const database = getDB();
  const now = Date.now();

  database.execute(
    'UPDATE message_queue SET retry_count = retry_count + 1, last_retry_at = ? WHERE queue_id = ?',
    [now, queueId]
  );
};

/**
 * Mark all messages in a conversation as read
 */
export const markConversationAsRead = (conversationId) => {
  const database = getDB();

  database.execute(
    'UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND is_read = 0',
    [conversationId]
  );

  database.execute(
    'UPDATE conversations SET unread_count = 0 WHERE conversation_id = ?',
    [conversationId]
  );
};

/**
 * Get unread count for a conversation
 */
export const getUnreadCount = (conversationId) => {
  const database = getDB();

  const result = database.execute(
    'SELECT unread_count FROM conversations WHERE conversation_id = ?',
    [conversationId]
  );

  return result.rows?._array?.[0]?.unread_count || 0;
};

/**
 * Search conversations locally
 */
export const searchConversations = (query) => {
  const database = getDB();

  const searchTerm = `%${query}%`;

  const result = database.execute(
    `SELECT * FROM conversations
     WHERE other_user_name LIKE ?
        OR other_user_username LIKE ?
        OR last_message_text LIKE ?
     ORDER BY last_message_timestamp DESC`,
    [searchTerm, searchTerm, searchTerm]
  );

  return result.rows?._array || [];
};

/**
 * Clear all chat data (for logout/reset)
 */
export const clearChatData = () => {
  const database = getDB();

  database.execute('DELETE FROM conversations');
  database.execute('DELETE FROM messages');
  database.execute('DELETE FROM user_cache');
  database.execute('DELETE FROM message_queue');

  console.log('Chat data cleared');
};

export default {
  initChatDatabase,
  getDB,
  createConversation,
  getConversations,
  getConversation,
  updateConversation,
  insertMessage,
  getMessages,
  updateMessageStatus,
  updateMessage,
  deleteMessage,
  cacheUserData,
  getCachedUser,
  queueMessage,
  getPendingMessages,
  removeFromQueue,
  incrementRetryCount,
  markConversationAsRead,
  getUnreadCount,
  searchConversations,
  clearChatData,
};
