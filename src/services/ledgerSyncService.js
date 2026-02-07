import auth from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://account-android-app-backend.vercel.app/api';
const LEDGER_SYNC_QUEUE_KEY = 'ledgerSyncQueue:v1';

const getAuthToken = async () => {
  const currentUser = auth().currentUser;
  if (!currentUser) {
    throw new Error('User not authenticated');
  }
  return currentUser.getIdToken();
};

const readQueue = async () => {
  try {
    const raw = await AsyncStorage.getItem(LEDGER_SYNC_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to read ledger sync queue:', error);
    return [];
  }
};

const writeQueue = async queue => {
  try {
    await AsyncStorage.setItem(LEDGER_SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error('Failed to write ledger sync queue:', error);
  }
};

const makeIdempotencyKey = event => {
  const originTxn = String(event?.originTxnId || '');
  const op = String(event?.op || 'create');
  const source = String(event?.sourceUserId || '');
  return `ledger:${source}:${originTxn}:${op}`;
};

const postLedgerEvent = async event => {
  const token = await getAuthToken();
  const payload = {
    ...event,
    idempotencyKey: event.idempotencyKey || makeIdempotencyKey(event),
  };

  const response = await fetch(`${API_URL}/ledger/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let body = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    const message = body?.error || body?.message || `HTTP ${response.status}`;
    throw new Error(message);
  }

  return true;
};

export const enqueueLedgerEvent = async event => {
  const queue = await readQueue();
  queue.push({
    ...event,
    idempotencyKey: event.idempotencyKey || makeIdempotencyKey(event),
    queuedAt: Date.now(),
    retryCount: Number(event.retryCount || 0),
  });
  await writeQueue(queue);
};

export const sendLedgerEvent = async event => {
  const payload = {
    ...event,
    idempotencyKey: event.idempotencyKey || makeIdempotencyKey(event),
  };
  try {
    await postLedgerEvent(payload);
    return true;
  } catch (error) {
    console.error('Ledger event sync failed, queued for retry:', error?.message || error);
    await enqueueLedgerEvent(payload);
    return false;
  }
};

export const processPendingLedgerEvents = async () => {
  const queue = await readQueue();
  if (!queue.length) return;

  const pending = [];
  for (const item of queue) {
    try {
      await postLedgerEvent(item);
    } catch (error) {
      pending.push({
        ...item,
        retryCount: Number(item.retryCount || 0) + 1,
        lastError: String(error?.message || error),
      });
    }
  }

  await writeQueue(pending);
};

export const buildLedgerCreateEvent = params => {
  const sourceUserId = String(params?.sourceUserId || '');
  const peerUserId = String(params?.peerUserId || '');
  const originTxnId = String(params?.originTxnId || '');
  const amount = Number(params?.amount || 0);
  const type = params?.type === 'get' ? 'get' : 'paid';

  return {
    op: 'create',
    originTxnId,
    sourceUserId,
    peerUserId,
    contactRecordId: String(params?.contactRecordId || ''),
    type,
    entryType: type,
    amount,
    note: String(params?.note || ''),
    timestamp: Number(params?.timestamp || Date.now()),
    version: 1,
    idempotencyKey: `ledger:${sourceUserId}:${originTxnId}:create`,
  };
};

