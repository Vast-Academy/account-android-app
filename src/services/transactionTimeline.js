const buildTimelineWithPending = (entries, pendingEntries = []) => {
  return [...entries, ...pendingEntries]
    .filter(entry => Number(entry?.is_deleted) !== 1)
    .sort((a, b) => {
      const timeDiff = Number(a.transaction_date) - Number(b.transaction_date);
      if (timeDiff !== 0) {
        return timeDiff;
      }
      const orderA = Number.isFinite(a.orderIndex) ? a.orderIndex : null;
      const orderB = Number.isFinite(b.orderIndex) ? b.orderIndex : null;
      if (orderA !== null || orderB !== null) {
        if (orderA === null) {
          return 1;
        }
        if (orderB === null) {
          return -1;
        }
        if (orderA !== orderB) {
          return orderA - orderB;
        }
      }
      return String(a.id).localeCompare(String(b.id));
    });
};

// IMPORTANT: This timestamp rule must not be changed unless the user explicitly requests it in writing.
// Rule: A new backdated debit is allowed only if the running balance never goes negative
// from the new entry's timestamp forward through the entire timeline.
const canWithdrawAtTimestampWithEntries = (
  withdrawValue,
  timestamp,
  entries,
  pendingEntries = []
) => {
  if (!Number.isFinite(withdrawValue) || withdrawValue <= 0) {
    return false;
  }
  if (!Number.isFinite(timestamp)) {
    return false;
  }
  const timeline = buildTimelineWithPending(entries, pendingEntries);
  let running = 0;
  let enforceFromTimestamp = false;
  for (const entry of timeline) {
    running += Number(entry.amount) || 0;
    if (String(entry.id) === 'pending-entry' || String(entry.id) === 'pending' || Number(entry.transaction_date) >= timestamp) {
      enforceFromTimestamp = true;
    }
    if (enforceFromTimestamp && running < 0) {
      return false;
    }
  }
  return true;
};


const validateTimestampRuleGuard = () => {
  const baseTime = 1700000000000;
  const entries = [
    {id: 'a', amount: 500, transaction_date: baseTime, is_deleted: 0},
    {id: 'b', amount: -200, transaction_date: baseTime + 86400000, is_deleted: 0},
    {id: 'c', amount: -100, transaction_date: baseTime + 2 * 86400000, is_deleted: 0},
  ];
  const okPending = [
    {
      id: 'pending-entry',
      amount: -200,
      transaction_date: baseTime + 3 * 86400000,
      is_deleted: 0,
      orderIndex: 1,
    },
  ];
  const shouldAllow = canWithdrawAtTimestampWithEntries(
    200,
    baseTime + 3 * 86400000,
    entries,
    okPending
  );
  if (!shouldAllow) {
    throw new Error('Timestamp rule guard failed: expected allow for safe future debit.');
  }

  const blockedPending = [
    {
      id: 'pending-entry',
      amount: -300,
      transaction_date: baseTime + 0.5 * 86400000,
      is_deleted: 0,
      orderIndex: 1,
    },
  ];
  const shouldBlock = canWithdrawAtTimestampWithEntries(
    300,
    baseTime + 0.5 * 86400000,
    entries,
    blockedPending
  );
  if (shouldBlock) {
    throw new Error('Timestamp rule guard failed: expected block for backdated debit causing negative later.');
  }
};

// Run guard in dev to detect accidental rule changes.
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  try {
    validateTimestampRuleGuard();
  } catch (error) {
    console.error(error?.message || error);
  }
}

const getBalanceAtTimestampWithEntries = (
  entries,
  timestamp,
  pendingEntries = []
) => {
  if (!Number.isFinite(timestamp)) {
    return 0;
  }
  const timeline = buildTimelineWithPending(entries, pendingEntries);
  let running = 0;
  for (const entry of timeline) {
    if (Number(entry.transaction_date) > timestamp) {
      break;
    }
    running += Number(entry.amount) || 0;
  }
  return running;
};

export {
  buildTimelineWithPending,
  canWithdrawAtTimestampWithEntries,
  getBalanceAtTimestampWithEntries,
};
