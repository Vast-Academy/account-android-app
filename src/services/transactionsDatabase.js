import {open} from 'react-native-quick-sqlite';
import {queueBackupFromStorage} from '../utils/backupQueue';

const DB_NAME = 'accountsDB.db';

// Get database instance
const getDB = () => {
  try {
    return open({name: DB_NAME});
  } catch (error) {
    console.error('Failed to open database:', error);
    throw error;
  }
};

// Initialize transactions table
export const initTransactionsDatabase = () => {
  try {
    const db = getDB();

    db.execute(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        remark TEXT,
        edit_history TEXT,
        edit_count INTEGER DEFAULT 0,
        is_deleted INTEGER DEFAULT 0,
        deleted_at INTEGER,
        transaction_date INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (account_id) REFERENCES accounts (id)
      );
    `);

    try {
      db.execute('ALTER TABLE transactions ADD COLUMN edit_history TEXT');
    } catch (e) {
      // Column already exists, ignore
    }
    try {
      db.execute('ALTER TABLE transactions ADD COLUMN edit_count INTEGER DEFAULT 0');
    } catch (e) {
      // Column already exists, ignore
    }
    try {
      db.execute('ALTER TABLE transactions ADD COLUMN is_deleted INTEGER DEFAULT 0');
    } catch (e) {
      // Column already exists, ignore
    }
    try {
      db.execute('ALTER TABLE transactions ADD COLUMN deleted_at INTEGER');
    } catch (e) {
      // Column already exists, ignore
    }
    try {
      db.execute('UPDATE transactions SET is_deleted = 0 WHERE is_deleted IS NULL');
    } catch (e) {
      // Ignore update errors
    }

    console.log('Transactions database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize transactions database:', error);
    throw error;
  }
};

// Create new transaction
export const createTransaction = async (
  accountId,
  amount,
  remark,
  transactionDate = null
) => {
  try {
    const db = getDB();
    const timestamp = Date.now();
    const transactionTimestamp = Number.isFinite(transactionDate)
      ? transactionDate
      : timestamp;

    const result = db.execute(
      `INSERT INTO transactions (account_id, amount, remark, transaction_date, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [accountId, amount, remark || '', transactionTimestamp, timestamp]
    );

    console.log('Transaction created successfully');

    // Update account balance
    await updateAccountBalance(accountId);

    queueBackupFromStorage();
    return {success: true, insertId: result.insertId};
  } catch (error) {
    console.error('Failed to create transaction:', error);
    throw error;
  }
};

// Get all transactions for an account
export const getTransactionsByAccount = (accountId) => {
  try {
    const db = getDB();
    const result = db.execute(
      'SELECT * FROM transactions WHERE account_id = ? ORDER BY transaction_date ASC',
      [accountId]
    );

    // Handle different result formats
    let transactions = [];
    if (result.rows) {
      if (result.rows._array) {
        transactions = result.rows._array;
      } else if (result.rows.length > 0) {
        for (let i = 0; i < result.rows.length; i++) {
          transactions.push(result.rows.item(i));
        }
      }
    }

    return transactions;
  } catch (error) {
    console.error('Failed to get transactions:', error);
    return [];
  }
};

// Calculate total balance for an account
export const calculateAccountBalance = (accountId) => {
  try {
    const db = getDB();
    const result = db.execute(
      'SELECT SUM(amount) as total FROM transactions WHERE account_id = ? AND is_deleted = 0',
      [accountId]
    );

    let total = 0;
    if (result.rows) {
      if (result.rows._array && result.rows._array.length > 0) {
        total = result.rows._array[0].total || 0;
      } else if (result.rows.length > 0) {
        total = result.rows.item(0).total || 0;
      }
    }

    return total;
  } catch (error) {
    console.error('Failed to calculate balance:', error);
    return 0;
  }
};

// Update account balance in accounts table
const updateAccountBalance = async (accountId) => {
  try {
    const db = getDB();
    const totalBalance = calculateAccountBalance(accountId);
    const timestamp = Date.now();

    db.execute(
      'UPDATE accounts SET balance = ?, updated_at = ? WHERE id = ?',
      [totalBalance, timestamp, accountId]
    );

    console.log('Account balance updated:', totalBalance);
  } catch (error) {
    console.error('Failed to update account balance:', error);
  }
};

// Delete transaction
export const deleteTransaction = async (
  transactionId,
  accountId,
  editHistory = null
) => {
  try {
    const db = getDB();
    const timestamp = Date.now();
    if (editHistory !== null) {
      db.execute(
        'UPDATE transactions SET is_deleted = 1, deleted_at = ?, edit_history = ? WHERE id = ?',
        [timestamp, editHistory, transactionId]
      );
    } else {
      db.execute(
        'UPDATE transactions SET is_deleted = 1, deleted_at = ? WHERE id = ?',
        [timestamp, transactionId]
      );
    }

    // Update account balance
    await updateAccountBalance(accountId);

    console.log('Transaction deleted successfully');
    queueBackupFromStorage();
    return {success: true};
  } catch (error) {
    console.error('Failed to delete transaction:', error);
    throw error;
  }
};

// Delete all transactions for an account
export const deleteTransactionsByAccount = async (accountId) => {
  try {
    const db = getDB();
    db.execute('DELETE FROM transactions WHERE account_id = ?', [accountId]);
    console.log('Transactions deleted for account:', accountId);
    queueBackupFromStorage();
    return {success: true};
  } catch (error) {
    console.error('Failed to delete account transactions:', error);
    throw error;
  }
};

// Update transaction amount
export const updateTransactionAmount = async (
  transactionId,
  accountId,
  amount,
  editHistory = null,
  editCount = null
) => {
  try {
    const db = getDB();
    if (editHistory !== null || editCount !== null) {
      db.execute(
        'UPDATE transactions SET amount = ?, edit_history = ?, edit_count = ? WHERE id = ?',
        [
          amount,
          editHistory,
          Number.isFinite(editCount) ? editCount : 0,
          transactionId,
        ]
      );
    } else {
      db.execute('UPDATE transactions SET amount = ? WHERE id = ?', [
        amount,
        transactionId,
      ]);
    }

    await updateAccountBalance(accountId);

    console.log('Transaction amount updated:', transactionId);
    queueBackupFromStorage();
    return {success: true};
  } catch (error) {
    console.error('Failed to update transaction amount:', error);
    throw error;
  }
};

// Update transaction remark
export const updateTransactionRemark = async (transactionId, remark) => {
  try {
    const db = getDB();
    db.execute('UPDATE transactions SET remark = ? WHERE id = ?', [
      remark || '',
      transactionId,
    ]);

    console.log('Transaction remark updated:', transactionId);
    queueBackupFromStorage();
    return {success: true};
  } catch (error) {
    console.error('Failed to update transaction remark:', error);
    throw error;
  }
};

// Get transaction count for an account
export const getTransactionCount = (accountId) => {
  try {
    const db = getDB();
    const result = db.execute(
      'SELECT COUNT(*) as count FROM transactions WHERE account_id = ?',
      [accountId]
    );

    let count = 0;
    if (result.rows) {
      if (result.rows._array && result.rows._array.length > 0) {
        count = result.rows._array[0].count || 0;
      } else if (result.rows.length > 0) {
        count = result.rows.item(0).count || 0;
      }
    }

    return count;
  } catch (error) {
    console.error('Failed to get transaction count:', error);
    return 0;
  }
};
