import {open} from 'react-native-quick-sqlite';

const DB_NAME = 'ledgerDB.db';

// Get database instance
const getDB = () => {
  try {
    return open({name: DB_NAME});
  } catch (error) {
    console.error('Failed to open ledger database:', error);
    throw error;
  }
};

// Initialize database and create tables
export const initLedgerDatabase = () => {
  try {
    const db = getDB();

    db.execute(`
            CREATE TABLE IF NOT EXISTS ledger_transactions (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              contact_record_id TEXT NOT NULL,
              amount REAL NOT NULL,
              type TEXT NOT NULL CHECK(type IN ('paid', 'get')),
              note TEXT,
              transaction_date INTEGER NOT NULL,
              created_at INTEGER NOT NULL
            );
          `);
      
          
          db.execute(`
            CREATE TABLE IF NOT EXISTS contact_names (
              contact_record_id TEXT PRIMARY KEY,
              display_name TEXT NOT NULL,
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL
            );
          `);
          // Migrate legacy nicknames into contact_names
          try {
            db.execute(`
              INSERT OR IGNORE INTO contact_names (contact_record_id, display_name, created_at, updated_at)
              SELECT contact_record_id, nickname, created_at, updated_at
              FROM contact_nicknames
            `);
          } catch (e) {
            // Legacy table missing or migration already handled
          }

          // Remove legacy nickname table
          try {
            db.execute('DROP TABLE IF EXISTS contact_nicknames');
          } catch (e) {
            // Ignore drop failures
          }
      
          // Create index for faster lookups
          try {
            db.execute(`
              CREATE INDEX IF NOT EXISTS idx_contact_record_id
              ON ledger_transactions(contact_record_id);
            `);
          } catch (e) {
            // Index already exists, ignore
          }
      
          console.log('Ledger database initialized successfully');
        } catch (error) {
          console.error('Failed to initialize ledger database:', error);
          throw error;
        }
      };
      
      // Create new transaction
      export const createTransaction = (contactRecordId, amount, type, note = '') => {
        try {
          const db = getDB();
          const timestamp = Date.now();
      
          // Validate amount
          const numAmount = Number(amount);
          if (!numAmount || numAmount <= 0) {
            throw new Error('Amount must be greater than 0');
          }
      
          // Validate type
          if (type !== 'paid' && type !== 'get') {
            throw new Error('Type must be either "paid" or "get"');
          }
      
          const result = db.execute(
            `INSERT INTO ledger_transactions (contact_record_id, amount, type, note, transaction_date, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              String(contactRecordId),
              numAmount,
              type,
              note || '',
              timestamp,
              timestamp,
            ]
          );
      
          console.log('Transaction created successfully for contact:', contactRecordId);
          return {success: true, insertId: result.insertId};
        } catch (error) {
          console.error('Failed to create transaction:', error);
          throw error;
        }
      };
      
      // Get all transactions for a specific contact
      export const getTransactionsByContact = contactRecordId => {
        try {
          const db = getDB();
          const result = db.execute(
            `SELECT * FROM ledger_transactions
             WHERE contact_record_id = ?
             ORDER BY transaction_date ASC`,
            [String(contactRecordId)]
          );
      
          return result.rows?._array || [];
        } catch (error) {
          console.error('Failed to get transactions:', error);
          return [];
        }
      };
      
      // Calculate net balance for a contact
      // Positive balance = Contact owes you (you paid more than received)
      // Negative balance = You owe contact (you received more than paid)
      export const calculateContactBalance = contactRecordId => {
        try {
          const transactions = getTransactionsByContact(contactRecordId);
      
          let totalPaid = 0;  // Money you gave to contact (udhar diya)
          let totalGet = 0;   // Money you received back from contact (wapas liya)
      
          transactions.forEach(txn => {
            const amount = Number(txn.amount) || 0;
            if (txn.type === 'paid') {
              totalPaid += amount;
            } else if (txn.type === 'get') {
              totalGet += amount;
            }
          });
      
          // Net balance = Total Paid - Total Received
          // Positive = Contact owes you
          // Negative = You owe contact
          const netBalance = totalPaid - totalGet;
      
          return {
            netBalance,
            totalPaid,
            totalGet,
            transactionCount: transactions.length,
          };
        } catch (error) {
          console.error('Failed to calculate balance:', error);
          return {
            netBalance: 0,
            totalPaid: 0,
            totalGet: 0,
            transactionCount: 0,
          };
        }
      };
      
      // Get balances for all contacts (for displaying in list)
      export const getAllContactBalances = () => {
        try {
          const db = getDB();
          const result = db.execute(`
            SELECT
              contact_record_id,
              SUM(CASE WHEN type = 'paid' THEN amount ELSE 0 END) as total_paid,
              SUM(CASE WHEN type = 'get' THEN amount ELSE 0 END) as total_get,
              COUNT(*) as transaction_count
            FROM ledger_transactions
            GROUP BY contact_record_id
          `);
      
          const balances = {};
          const rows = result.rows?._array || [];
      
          rows.forEach(row => {
            const totalPaid = Number(row.total_paid) || 0;
            const totalGet = Number(row.total_get) || 0;
            const netBalance = totalPaid - totalGet;
      
            balances[row.contact_record_id] = {
              netBalance,
              totalPaid,
              totalGet,
              transactionCount: row.transaction_count,
            };
          });
      
          return balances;
        } catch (error) {
          console.error('Failed to get all contact balances:', error);
          return {};
        }
      };
      
      // Delete a transaction
      export const deleteTransaction = transactionId => {
        try {
          const db = getDB();
          db.execute('DELETE FROM ledger_transactions WHERE id = ?', [transactionId]);
          console.log('Transaction deleted successfully:', transactionId);
          return {success: true};
        } catch (error) {
          console.error('Failed to delete transaction:', error);
          throw error;
        }
      };
      
      // Delete all transactions for a specific contact
      
      export const deleteContactAndTransactions = contactRecordId => {
      
        try {
      
          const db = getDB();
      
          db.execute('DELETE FROM ledger_transactions WHERE contact_record_id = ?', [
      
            String(contactRecordId),
      
          ]);
      
          console.log(
      
            `All transactions for contact ${contactRecordId} deleted successfully.`
      
          );
      
          // Also delete any stored name for this contact
      
          deleteContactName(contactRecordId);
      
          return {success: true};
      
        } catch (error) {
      
          console.error(`Failed to delete transactions for contact ${contactRecordId}:`, error);
      
          throw error;
      
        }
      
      };
      
      
      
      // Clear all ledger data
      
      export const clearAllLedgerData = async () => {
      
        try {
      
          const db = getDB();
      
          db.execute('DELETE FROM ledger_transactions');
      
          db.execute('DELETE FROM contact_names');

      
          console.log('All ledger data cleared successfully.');
      
          return {success: true};
      
        } catch (error) {
      
          console.error('Failed to clear all ledger data:', error);
      
          throw error;
      
        }
      
      };
      
      
      
      
      
      // Get transaction by ID
      export const getTransactionById = transactionId => {
        try {
          const db = getDB();
          const result = db.execute(
            'SELECT * FROM ledger_transactions WHERE id = ?',
            [transactionId]
          );
      
          const rows = result.rows?._array || [];
          return rows.length > 0 ? rows[0] : null;
        } catch (error) {
          console.error('Failed to get transaction:', error);
          return null;
        }
      };

      // Set (insert or update) a display name for a contact
      export const setContactName = (contactRecordId, displayName) => {
        try {
          const db = getDB();
          const timestamp = Date.now();
          db.execute(
            `INSERT OR REPLACE INTO contact_names (contact_record_id, display_name, created_at, updated_at)
             VALUES (?, ?, COALESCE((SELECT created_at FROM contact_names WHERE contact_record_id = ?), ?), ?)`,
            [String(contactRecordId), displayName, String(contactRecordId), timestamp, timestamp]
          );
          console.log(`Contact name set for contact ${contactRecordId}: ${displayName}`);
          return {success: true};
        } catch (error) {
          console.error(`Failed to set contact name for contact ${contactRecordId}:`, error);
          throw error;
        }
      };

      // Get a display name for a contact
      export const getContactName = contactRecordId => {
        try {
          const db = getDB();
          const result = db.execute(
            'SELECT display_name FROM contact_names WHERE contact_record_id = ?',
            [String(contactRecordId)]
          );
          const rows = result.rows?._array || [];
          return rows.length > 0 ? rows[0].display_name : null;
        } catch (error) {
          console.error(`Failed to get contact name for contact ${contactRecordId}:`, error);
          return null;
        }
      };

      // Delete a contact name
      export const deleteContactName = contactRecordId => {
        try {
          const db = getDB();
          db.execute('DELETE FROM contact_names WHERE contact_record_id = ?', [
            String(contactRecordId),
          ]);
          console.log(`Contact name deleted for contact ${contactRecordId}.`);
          return {success: true};
        } catch (error) {
          console.error(`Failed to delete contact name for contact ${contactRecordId}:`, error);
          throw error;
        }
      };

      // Get total statistics (optional - for dashboard/reports)
      export const getLedgerStatistics = () => {
        try {
          const db = getDB();
          const result = db.execute(`
            SELECT
              COUNT(DISTINCT contact_record_id) as total_contacts,
              COUNT(*) as total_transactions,
              SUM(CASE WHEN type = 'paid' THEN amount ELSE 0 END) as total_paid,
              SUM(CASE WHEN type = 'get' THEN amount ELSE 0 END) as total_get
            FROM ledger_transactions
          `);
      
          const rows = result.rows?._array || [];
          if (rows.length > 0) {
            const row = rows[0];
            const totalPaid = Number(row.total_paid) || 0;
            const totalGet = Number(row.total_get) || 0;
      
            return {
              totalContacts: row.total_contacts || 0,
              totalTransactions: row.total_transactions || 0,
              totalPaid,
              totalGet,
              netBalance: totalPaid - totalGet,
            };
          }
      
          return {
            totalContacts: 0,
            totalTransactions: 0,
            totalPaid: 0,
            totalGet: 0,
            netBalance: 0,
          };
        } catch (error) {
          console.error('Failed to get statistics:', error);
          return {
            totalContacts: 0,
            totalTransactions: 0,
            totalPaid: 0,
            totalGet: 0,
            netBalance: 0,
          };
        }
      };

      // Get latest transaction date for each contact (for sorting)
      export const getLatestTransactionDateByContact = () => {
        try {
          const db = getDB();
          const result = db.execute(`
            SELECT
              contact_record_id,
              MAX(transaction_date) as latest_date
            FROM ledger_transactions
            GROUP BY contact_record_id
          `);

          const latestDates = {};
          const rows = result.rows?._array || [];

          rows.forEach(row => {
            latestDates[row.contact_record_id] = row.latest_date || 0;
          });

          return latestDates;
        } catch (error) {
          console.error('Failed to get latest transaction dates:', error);
          return {};
        }
      };

      // Get distinct contact IDs that have ledger transactions
      export const getDistinctContactRecordIds = () => {
        try {
          const db = getDB();
          const result = db.execute(`
            SELECT DISTINCT contact_record_id
            FROM ledger_transactions
          `);
          const rows = result.rows?._array || [];
          return rows
            .map(row => String(row.contact_record_id || '').trim())
            .filter(Boolean);
        } catch (error) {
          console.error('Failed to get distinct contact IDs:', error);
          return [];
        }
      };
      











