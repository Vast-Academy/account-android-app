import AsyncStorage from '@react-native-async-storage/async-storage';
import {performBackup} from '../services/backupService';
import {ensureDriveScopes} from '../services/driveService';

const BACKUP_ENABLED_KEY = 'backup.enabled';
const DEFAULT_DEBOUNCE_MS = 90 * 1000;

let queuedPayload = null;
let timer = null;
let running = false;

export const isAutoBackupEnabled = async () => {
  const value = await AsyncStorage.getItem(BACKUP_ENABLED_KEY);
  if (value === null) {
    return true;
  }
  return value === 'true';
};

export const setAutoBackupEnabled = async enabled => {
  await AsyncStorage.setItem(BACKUP_ENABLED_KEY, enabled ? 'true' : 'false');
};

const runBackup = async () => {
  if (running || !queuedPayload) {
    return;
  }
  running = true;
  const payload = queuedPayload;
  queuedPayload = null;
  try {
    await ensureDriveScopes();
    await performBackup(payload);
  } catch (error) {
    console.error('Auto-backup failed:', error);
  } finally {
    running = false;
  }
};

export const queueBackup = async (payload, debounceMs = DEFAULT_DEBOUNCE_MS) => {
  const enabled = await isAutoBackupEnabled();
  if (!enabled) {
    return;
  }
  queuedPayload = payload;
  if (timer) {
    clearTimeout(timer);
  }
  timer = setTimeout(() => {
    timer = null;
    runBackup();
  }, debounceMs);
};

export const flushBackupQueue = async () => {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  await runBackup();
};

export const queueBackupFromStorage = async (
  debounceMs = DEFAULT_DEBOUNCE_MS,
) => {
  const restorePending = await AsyncStorage.getItem('backup.restorePending');
  if (restorePending === 'true') {
    return;
  }
  const firebaseUid = await AsyncStorage.getItem('firebaseUid');
  const accountEmail = await AsyncStorage.getItem('backup.accountEmail');
  if (!accountEmail) {
    return;
  }
  return queueBackup({firebaseUid, accountEmail}, debounceMs);
};
