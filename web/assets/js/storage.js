/**
 * Versioned localStorage adapter. Loading validates the full hash chain before
 * returning data; a corrupt payload is reported instead of silently repaired.
 */

import { verifyRecords } from './chain.js';

const STORAGE_KEY = 'medkeep.dashboard.v1';

/**
 * @typedef {{
 *   records: Array<{ id: number, content: string, digest: string }>,
 *   pending: Array<{ id: number, content: string }>,
 *   nextId: number,
 *   updatedAt: number,
 *   seeded: boolean
 * }} DashboardState
 */

/**
 * @returns {{ state: DashboardState | null, error: string }}
 */
export function loadState() {
  let raw;
  try {
    raw = globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return { state: null, error: 'Browser storage is unavailable in this context.' };
  }
  if (!raw) {
    return { state: null, error: '' };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { state: null, error: 'Saved dashboard data could not be parsed.' };
  }

  const validation = validateState(parsed);
  return validation.ok
    ? { state: validation.state, error: '' }
    : { state: null, error: validation.error };
}

/**
 * @param {DashboardState} state
 */
export function saveState(state) {
  const storage = globalThis.localStorage;
  if (!storage) {
    throw new Error('Browser storage is unavailable in this context.');
  }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    if (error && error.name === 'QuotaExceededError') {
      throw new Error('Browser storage is full. Export your archive before continuing.');
    }
    throw new Error('Could not persist dashboard data to browser storage.');
  }
}

export function clearState() {
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * @param {unknown} value
 * @returns {{ ok: true, state: DashboardState } | { ok: false, error: string }}
 */
function validateState(value) {
  if (!value || typeof value !== 'object') {
    return { ok: false, error: 'Saved dashboard data has an unexpected shape.' };
  }
  const candidate = /** @type {Record<string, unknown>} */ (value);
  const { records, pending, nextId, updatedAt, seeded } = candidate;

  if (!Array.isArray(records) || !Array.isArray(pending)) {
    return { ok: false, error: 'Saved dashboard data is missing record lists.' };
  }
  if (!Number.isSafeInteger(nextId) || Number(nextId) <= 0) {
    return { ok: false, error: 'Saved dashboard data has an invalid next ID.' };
  }

  const normalizedRecords = records.map((entry) => {
    if (!entry || typeof entry !== 'object') {
      return null;
    }
    const record = /** @type {Record<string, unknown>} */ (entry);
    if (
      !Number.isSafeInteger(record.id)
      || Number(record.id) <= 0
      || typeof record.content !== 'string'
      || typeof record.digest !== 'string'
    ) {
      return null;
    }
    return /** @type {{ id: number, content: string, digest: string }} */ ({
      id: record.id,
      content: record.content,
      digest: record.digest,
    });
  });
  if (normalizedRecords.some((entry) => entry === null)) {
    return { ok: false, error: 'Saved dashboard data contains a malformed record.' };
  }

  const normalizedPending = pending.map((entry) => {
    if (!entry || typeof entry !== 'object') {
      return null;
    }
    const request = /** @type {Record<string, unknown>} */ (entry);
    if (
      !Number.isSafeInteger(request.id)
      || Number(request.id) <= 0
      || typeof request.content !== 'string'
    ) {
      return null;
    }
    return /** @type {{ id: number, content: string }} */ ({
      id: request.id,
      content: request.content,
    });
  });
  if (normalizedPending.some((entry) => entry === null)) {
    return { ok: false, error: 'Saved dashboard data contains a malformed request.' };
  }

  const verification = verifyRecords(
    /** @type {Array<{ id: number, content: string, digest: string }>} */ (normalizedRecords),
  );
  if (!verification.ok) {
    return { ok: false, error: `Saved chain failed verification: ${verification.error}` };
  }

  const lastRecordId = normalizedRecords.length
    ? /** @type {{ id: number }} */ (normalizedRecords[normalizedRecords.length - 1]).id
    : 0;
  let previousPendingId = lastRecordId;
  for (const request of normalizedPending) {
    const id = /** @type {{ id: number }} */ (request).id;
    if (id <= previousPendingId) {
      return { ok: false, error: 'Saved request IDs are not strictly increasing.' };
    }
    previousPendingId = id;
  }
  if (Number(nextId) <= previousPendingId) {
    return { ok: false, error: 'Saved next ID is not ahead of existing entries.' };
  }

  return {
    ok: true,
    state: {
      records: verification.records,
      pending: /** @type {Array<{ id: number, content: string }>} */ (normalizedPending),
      nextId: Number(nextId),
      updatedAt: Number.isFinite(updatedAt) ? Number(updatedAt) : Date.now(),
      seeded: Boolean(seeded),
    },
  };
}
