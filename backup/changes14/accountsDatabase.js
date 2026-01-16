import {open} from 'react-native-quick-sqlite';
import {deleteTransactionsByAccount} from './transactionsDatabase';
import {queueBackupFromStorage} from '../utils/backupQueue';

const DB_NAME = 'accountsDB.db';
const LEGACY_RED_400 = '#F87171';
const BROWN_400 = '#8D6E63';


const normalizeAccountColor = account => {
  if (!account || !account.icon_color) {
    return account;
  }
  if (account.icon_color === LEGACY_RED_400) {
    return {...account, icon_color: BROWN_400};
  }
  return account;
};

// Get database instance
const getDB = () => {
  try {
    return open({name: DB_NAME});
  } catch (error) {
    console.error('Failed to open database:', error);
    throw error;
  }
};

// Initialize database and create tables
export const initAccountsDatabase = () => {
  try {
    const db = getDB();

    db.execute(`
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_name TEXT NOT NULL,
        account_type TEXT NOT NULL CHECK(account_type IN ('earning', 'liability')),
        icon TEXT,
        icon_color TEXT,
        balance REAL DEFAULT 0,
        is_primary INTEGER DEFAULT 0,
        sort_index INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // Add is_primary column if it doesn't exist (for existing databases)
    try {
      db.execute('ALTER TABLE accounts ADD COLUMN is_primary INTEGER DEFAULT 0');
    } catch (e) {
      // Column already exists, ignore
    }
    try {
      db.execute('ALTER TABLE accounts ADD COLUMN icon TEXT');
    } catch (e) {
      // Column already exists, ignore
    }
    try {
      db.execute('ALTER TABLE accounts ADD COLUMN icon_color TEXT');
    } catch (e) {
      // Column already exists, ignore
    }
    try {
      db.execute('ALTER TABLE accounts ADD COLUMN sort_index INTEGER');
    } catch (e) {
      // Column already exists, ignore
    }
    try {
      db.execute('UPDATE accounts SET icon_color = ? WHERE icon_color = ?', [
        BROWN_400,
        LEGACY_RED_400,
      ]);
    } catch (e) {
      // Ignore update errors (db may be locked/empty)
    }
    try {
      const missingResult = db.execute(
        'SELECT COUNT(*) as count FROM accounts WHERE sort_index IS NULL'
      );
      const missing = missingResult.rows?._array?.[0]?.count ?? 0;
      if (missing > 0) {
        const orderResult = db.execute(
          'SELECT id FROM accounts ORDER BY updated_at DESC'
        );
        const rows = orderResult.rows?._array || [];
        db.execute('BEGIN');
        rows.forEach((row, index) => {
          db.execute('UPDATE accounts SET sort_index = ? WHERE id = ?', [
            index,
            row.id,
          ]);
        });
        db.execute('COMMIT');
      }
    } catch (e) {
      console.warn('Failed to backfill sort_index:', e);
    }

    console.log('Accounts database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize accounts database:', error);
    throw error;
  }
};

// Create new account
export const createAccount = async (accountName, accountType, icon, iconColor) => {
  try {
    const db = getDB();
    const timestamp = Date.now();
    const minResult = db.execute(
      'SELECT MIN(sort_index) as minIndex FROM accounts'
    );
    const minIndex = minResult.rows?._array?.[0]?.minIndex;
    const sortIndex = Number.isFinite(minIndex) ? minIndex - 1 : 0;

    const result = db.execute(
      `INSERT INTO accounts (account_name, account_type, icon, icon_color, balance, sort_index, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?)`,
      [
        accountName.trim(),
        accountType,
        icon || null,
        iconColor || null,
        sortIndex,
        timestamp,
        timestamp,
      ]
    );

    try {
      const countResult = db.execute('SELECT COUNT(*) as count FROM accounts');
      const count = countResult.rows?._array?.[0]?.count ?? 0;
      console.log('Accounts table count:', count);
      const pathResult = db.execute('PRAGMA database_list');
      const pathRow = pathResult.rows?._array?.find(row => row.name === 'main');
      if (pathRow?.file) {
        console.log('Accounts DB path:', pathRow.file);
      }
    } catch (countError) {
      console.warn('Accounts count check failed:', countError);
    }

    console.log('Account created successfully:', accountName);
    queueBackupFromStorage();
    return {success: true, insertId: result.insertId};
  } catch (error) {
    console.error('Failed to create account:', error);
    throw error;
  }
};

// Get all accounts
export const getAllAccounts = () => {
  try {
    const db = getDB();
    const result = db.execute(
      'SELECT * FROM accounts ORDER BY sort_index ASC, updated_at DESC'
    );
    return (result.rows?._array || []).map(normalizeAccountColor);
  } catch (error) {
    console.error('Failed to get accounts:', error);
    return [];
  }
};

// Get accounts by type
export const getAccountsByType = (type) => {
  try {
    const db = getDB();
    const result = db.execute(
      'SELECT * FROM accounts WHERE account_type = ? ORDER BY sort_index ASC, updated_at DESC',
      [type]
    );
    return (result.rows?._array || []).map(normalizeAccountColor);
  } catch (error) {
    console.error('Failed to get accounts by type:', error);
    return [];
  }
};

// Get earning accounts count
export const getEarningAccountsCount = () => {
  try {
    const db = getDB();
    const result = db.execute(
      "SELECT COUNT(*) as count FROM accounts WHERE account_type = 'earning'"
    );

    // Handle different result formats
    let count = 0;
    if (result.rows) {
      if (result.rows._array && result.rows._array.length > 0) {
        count = result.rows._array[0].count || 0;
      } else if (result.rows.length > 0) {
        count = result.rows.item(0).count || 0;
      }
    }

    console.log('Earning accounts count:', count);
    return count;
  } catch (error) {
    console.error('Failed to get earning accounts count:', error);
    return 0;
  }
};

// Check if account name already exists
export const isAccountNameExists = (accountName) => {
  try {
    const db = getDB();
    const result = db.execute(
      'SELECT COUNT(*) as count FROM accounts WHERE LOWER(account_name) = LOWER(?)',
      [accountName.trim()]
    );
    return (result.rows?._array[0]?.count || 0) > 0;
  } catch (error) {
    console.error('Failed to check account name:', error);
    return false;
  }
};

// Update account
export const updateAccount = async (id, accountName, accountType) => {
  try {
    const db = getDB();
    const timestamp = Date.now();

    db.execute(
      'UPDATE accounts SET account_name = ?, account_type = ?, updated_at = ? WHERE id = ?',
      [accountName.trim(), accountType, timestamp, id]
    );

    console.log('Account updated successfully');
    queueBackupFromStorage();
    return {success: true};
  } catch (error) {
    console.error('Failed to update account:', error);
    throw error;
  }
};

// Delete account
export const deleteAccount = async (id) => {
  try {
    const db = getDB();
    db.execute('DELETE FROM accounts WHERE id = ?', [id]);
    console.log('Account deleted successfully');
    queueBackupFromStorage();
    return {success: true};
  } catch (error) {
    console.error('Failed to delete account:', error);
    throw error;
  }
};

// Rename account
export const renameAccount = async (id, newName) => {
  try {
    const db = getDB();
    const timestamp = Date.now();
    db.execute(
      'UPDATE accounts SET account_name = ?, updated_at = ? WHERE id = ?',
      [newName.trim(), timestamp, id]
    );
    console.log('Account renamed successfully');
    queueBackupFromStorage();
    return {success: true};
  } catch (error) {
    console.error('Failed to rename account:', error);
    throw error;
  }
};

// Delete account and all its transactions
export const deleteAccountAndTransactions = async (id) => {
  try {
    // First, delete all transactions associated with the account
    await deleteTransactionsByAccount(id);
    // Then, delete the account itself
    await deleteAccount(id);
    console.log(`Account ${id} and all its transactions deleted successfully.`);
    queueBackupFromStorage();
    return {success: true};
  } catch (error) {
    console.error(`Failed to delete account ${id} and its transactions:`, error);
    throw error;
  }
};

// Clear all accounts data
export const clearAllAccountsData = async () => {
  try {
    const db = getDB();
    db.execute('DELETE FROM accounts');
    console.log('All accounts data cleared successfully.');
    queueBackupFromStorage();
    return {success: true};
  } catch (error) {
    console.error('Failed to clear all accounts data:', error);
    throw error;
  }
};


// Update account balance
export const updateAccountBalance = async (id, newBalance) => {
  try {
    const db = getDB();
    const timestamp = Date.now();

    db.execute(
      'UPDATE accounts SET balance = ?, updated_at = ? WHERE id = ?',
      [newBalance, timestamp, id]
    );

    return {success: true};
  } catch (error) {
    console.error('Failed to update account balance:', error);
    throw error;
  }
};

// Set account as primary (and unmark all others)
export const setPrimaryAccount = async (accountId) => {
  try {
    const db = getDB();
    const timestamp = Date.now();

    // First, unmark all accounts as primary
    db.execute('UPDATE accounts SET is_primary = 0');

    // Then mark the selected account as primary
    db.execute(
      'UPDATE accounts SET is_primary = 1, updated_at = ? WHERE id = ?',
      [timestamp, accountId]
    );

    console.log('Primary account updated:', accountId);
    queueBackupFromStorage();
    return {success: true};
  } catch (error) {
    console.error('Failed to set primary account:', error);
    throw error;
  }
};

// Get current primary earning account
export const getPrimaryEarningAccount = () => {
  try {
    const db = getDB();
    const result = db.execute(
      "SELECT * FROM accounts WHERE account_type = 'earning' AND is_primary = 1 LIMIT 1"
    );

    if (result.rows) {
      if (result.rows._array && result.rows._array.length > 0) {
        return normalizeAccountColor(result.rows._array[0]);
      } else if (result.rows.length > 0) {
        return normalizeAccountColor(result.rows.item(0));
      }
    }
    return null;
  } catch (error) {
    console.error('Failed to get primary account:', error);
    return null;
  }
};

// Update account primary status
export const updateAccountPrimary = async (accountId, isPrimary) => {
  try {
    const db = getDB();
    const timestamp = Date.now();

    if (isPrimary) {
      // If setting as primary, unmark all others first
      db.execute('UPDATE accounts SET is_primary = 0');
    }

    db.execute(
      'UPDATE accounts SET is_primary = ?, updated_at = ? WHERE id = ?',
      [isPrimary ? 1 : 0, timestamp, accountId]
    );

    queueBackupFromStorage();
    return {success: true};
  } catch (error) {
    console.error('Failed to update primary status:', error);
    throw error;
  }
};

export const updateAccountSortIndex = async (id, sortIndex) => {
  try {
    const db = getDB();
    db.execute('UPDATE accounts SET sort_index = ? WHERE id = ?', [
      sortIndex,
      id,
    ]);
    queueBackupFromStorage();
    return {success: true};
  } catch (error) {
    console.error('Failed to update account sort index:', error);
    throw error;
  }
};
