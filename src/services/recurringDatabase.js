import {open} from 'react-native-quick-sqlite';
import {createTransaction} from './transactionsDatabase';
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

// Initialize recurring schedules table
export const initRecurringDatabase = () => {
  try {
    const db = getDB();

    db.execute(`
      CREATE TABLE IF NOT EXISTS recurring_schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        remark TEXT,
        schedule_type TEXT NOT NULL,
        schedule_day TEXT,
        schedule_date INTEGER,
        next_execution INTEGER NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (account_id) REFERENCES accounts (id)
      );
    `);

    console.log('Recurring schedules database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize recurring database:', error);
    throw error;
  }
};

// Calculate next execution timestamp
const calculateNextExecution = (scheduleType, scheduleDay, scheduleDate) => {
  const now = new Date();
  let nextDate = new Date();

  switch (scheduleType) {
    case 'weekly':
      // Find next occurrence of the selected day
      const targetDay = getDayNumber(scheduleDay);
      const currentDay = now.getDay();
      let daysUntilNext = (targetDay - currentDay + 7) % 7;
      if (daysUntilNext === 0) daysUntilNext = 7; // Next week if today
      nextDate.setDate(now.getDate() + daysUntilNext);
      nextDate.setHours(0, 0, 0, 0);
      break;

    case '2weeks':
      // Same as weekly but 2 weeks from now
      const targetDay2w = getDayNumber(scheduleDay);
      const currentDay2w = now.getDay();
      let daysUntilNext2w = (targetDay2w - currentDay2w + 7) % 7;
      if (daysUntilNext2w === 0) daysUntilNext2w = 7;
      nextDate.setDate(now.getDate() + daysUntilNext2w + 7); // Add 1 more week
      nextDate.setHours(0, 0, 0, 0);
      break;

    case 'monthly':
      // Next occurrence of the selected date
      nextDate.setDate(scheduleDate);
      if (nextDate <= now) {
        nextDate.setMonth(nextDate.getMonth() + 1);
      }
      nextDate.setHours(0, 0, 0, 0);
      break;

    case '2months':
      nextDate.setDate(scheduleDate);
      if (nextDate <= now) {
        nextDate.setMonth(nextDate.getMonth() + 2);
      }
      nextDate.setHours(0, 0, 0, 0);
      break;

    case '3months':
      nextDate.setDate(scheduleDate);
      if (nextDate <= now) {
        nextDate.setMonth(nextDate.getMonth() + 3);
      }
      nextDate.setHours(0, 0, 0, 0);
      break;

    case '6months':
      nextDate.setDate(scheduleDate);
      if (nextDate <= now) {
        nextDate.setMonth(nextDate.getMonth() + 6);
      }
      nextDate.setHours(0, 0, 0, 0);
      break;

    default:
      nextDate = now;
  }

  return nextDate.getTime();
};

// Helper: Convert day name to number (0-6, Sunday-Saturday)
const getDayNumber = (dayName) => {
  const days = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };
  return days[dayName.toLowerCase()] || 0;
};

// Create recurring schedule
export const createRecurringSchedule = async (
  accountId,
  amount,
  remark,
  scheduleType,
  scheduleDay = null,
  scheduleDate = null
) => {
  try {
    const db = getDB();
    const timestamp = Date.now();
    const nextExecution = calculateNextExecution(scheduleType, scheduleDay, scheduleDate);

    const result = db.execute(
      `INSERT INTO recurring_schedules
       (account_id, amount, remark, schedule_type, schedule_day, schedule_date, next_execution, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        accountId,
        amount,
        remark || '',
        scheduleType,
        scheduleDay || null,
        scheduleDate || null,
        nextExecution,
        timestamp,
      ]
    );

    console.log('Recurring schedule created successfully');
    queueBackupFromStorage();
    return {success: true, insertId: result.insertId};
  } catch (error) {
    console.error('Failed to create recurring schedule:', error);
    throw error;
  }
};

// Get all active recurring schedules for an account
export const getActiveRecurringSchedules = (accountId) => {
  try {
    const db = getDB();
    const result = db.execute(
      'SELECT * FROM recurring_schedules WHERE account_id = ? AND is_active = 1 ORDER BY created_at DESC',
      [accountId]
    );

    let schedules = [];
    if (result.rows) {
      if (result.rows._array) {
        schedules = result.rows._array;
      } else if (result.rows.length > 0) {
        for (let i = 0; i < result.rows.length; i++) {
          schedules.push(result.rows.item(i));
        }
      }
    }

    return schedules;
  } catch (error) {
    console.error('Failed to get recurring schedules:', error);
    return [];
  }
};

// Process due recurring schedules (create transactions)
export const processDueSchedules = async () => {
  try {
    const db = getDB();
    const now = Date.now();

    // Get all active schedules that are due
    const result = db.execute(
      'SELECT * FROM recurring_schedules WHERE is_active = 1 AND next_execution <= ?',
      [now]
    );

    let schedules = [];
    if (result.rows) {
      if (result.rows._array) {
        schedules = result.rows._array;
      } else if (result.rows.length > 0) {
        for (let i = 0; i < result.rows.length; i++) {
          schedules.push(result.rows.item(i));
        }
      }
    }

    console.log(`Processing ${schedules.length} due schedules`);

    for (const schedule of schedules) {
      // Create transaction
      await createTransaction(
        schedule.account_id,
        schedule.amount,
        schedule.remark
      );

      // Calculate next execution
      const nextExecution = calculateNextExecution(
        schedule.schedule_type,
        schedule.schedule_day,
        schedule.schedule_date
      );

      // Update next_execution
      db.execute(
        'UPDATE recurring_schedules SET next_execution = ? WHERE id = ?',
        [nextExecution, schedule.id]
      );

      console.log(`Processed schedule ${schedule.id}, next execution: ${new Date(nextExecution)}`);
    }

    if (schedules.length > 0) {
      queueBackupFromStorage();
    }
    return schedules.length;
  } catch (error) {
    console.error('Failed to process due schedules:', error);
    return 0;
  }
};

// Deactivate recurring schedule
export const deactivateSchedule = (scheduleId) => {
  try {
    const db = getDB();
    db.execute('UPDATE recurring_schedules SET is_active = 0 WHERE id = ?', [scheduleId]);
    console.log('Schedule deactivated successfully');
    queueBackupFromStorage();
    return {success: true};
  } catch (error) {
    console.error('Failed to deactivate schedule:', error);
    throw error;
  }
};

// Delete recurring schedule
export const deleteRecurringSchedule = (scheduleId) => {
  try {
    const db = getDB();
    db.execute('DELETE FROM recurring_schedules WHERE id = ?', [scheduleId]);
    console.log('Recurring schedule deleted successfully');
    queueBackupFromStorage();
    return {success: true};
  } catch (error) {
    console.error('Failed to delete recurring schedule:', error);
    throw error;
  }
};
