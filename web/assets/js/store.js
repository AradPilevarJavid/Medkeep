/**
 * Single source of truth for the dashboard. Mutations are validated, persisted
 * to localStorage, then broadcast to subscribers. The state object is replaced
 * (never mutated in place) so the UI can render deterministically.
 */

import { appendRecord, verifyRecords } from './chain.js';
import { createSeedState } from './seed.js';
import { loadState, saveState } from './storage.js';
import { serializeArchive } from './archive.js';

export const MAX_CONTENT_LENGTH = 20000;

/**
 * @typedef {{
 *   records: Array<{ id: number, content: string, digest: string }>,
 *   pending: Array<{ id: number, content: string }>,
 *   nextId: number,
 *   updatedAt: number,
 *   seeded: boolean
 * }} DashboardState
 */

/** @type {DashboardState} */
let state = createSeedState();
/** @type {Set<(state: DashboardState) => void>} */
const listeners = new Set();

/**
 * Load persisted state, falling back to the demo seed.
 * @returns {{ error: string }}
 */
export function initStore() {
  const loaded = loadState();
  if (loaded.state) {
    state = loaded.state;
    return { error: '' };
  }

  const seeded = createSeedState();
  state = seeded;
  try {
    saveState(state);
  } catch (error) {
    return {
      error: `${loaded.error ? `${loaded.error} ` : ''}${error instanceof Error ? error.message : 'Could not persist data.'}`,
    };
  }
  return { error: loaded.error ? `${loaded.error} Started with demo data.` : '' };
}

/**
 * @returns {DashboardState}
 */
export function getState() {
  return state;
}

/**
 * @param {(state: DashboardState) => void} listener
 * @returns {() => void} unsubscribe
 */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * @param {string} rawContent
 * @returns {{ id: number, content: string }}
 */
export function addRequest(rawContent) {
  const content = typeof rawContent === 'string' ? rawContent : '';
  if (content.trim().length === 0) {
    throw new Error('Enter a record before adding it to the queue.');
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    throw new Error(`Records are limited to ${MAX_CONTENT_LENGTH.toLocaleString()} characters.`);
  }
  if (!Number.isSafeInteger(state.nextId) || state.nextId <= 0) {
    throw new Error('The request ID range has been exhausted.');
  }

  const request = Object.freeze({ id: state.nextId, content });
  commit({
    ...state,
    pending: [...state.pending, request],
    nextId: state.nextId + 1,
    updatedAt: Date.now(),
  });
  return { id: request.id, content: request.content };
}

/**
 * Commit the oldest pending request to the hash chain.
 * @returns {{ id: number, content: string, digest: string } | null}
 */
export function processNext() {
  if (state.pending.length === 0) {
    return null;
  }
  const [request, ...remaining] = state.pending;
  const records = appendRecord(state.records, request.id, request.content);
  const record = records[records.length - 1];
  commit({
    ...state,
    records,
    pending: remaining,
    updatedAt: Date.now(),
  });
  return record;
}

/**
 * @returns {number} number of requests committed
 */
export function processAll() {
  if (state.pending.length === 0) {
    return 0;
  }
  let records = state.records;
  for (const request of state.pending) {
    records = appendRecord(records, request.id, request.content);
  }
  const committed = state.pending.length;
  commit({
    ...state,
    records,
    pending: [],
    updatedAt: Date.now(),
  });
  return committed;
}

/**
 * @param {{
 *   records: Array<{ id: number, content: string, digest: string }>,
 *   pending: Array<{ id: number, content: string }>,
 *   nextId: number
 * }} data
 */
export function replaceArchive(data) {
  const verification = verifyRecords(data.records);
  if (!verification.ok) {
    throw new Error(verification.error);
  }
  commit({
    records: verification.records,
    pending: data.pending.map((request) => Object.freeze({ ...request })),
    nextId: data.nextId,
    updatedAt: Date.now(),
    seeded: false,
  });
}

export function resetToSeed() {
  commit({ ...createSeedState(), updatedAt: Date.now() });
}

/**
 * @returns {{ ok: boolean, error: string }}
 */
export function verify() {
  const result = verifyRecords(state.records);
  return { ok: result.ok, error: result.error };
}

/**
 * @returns {{ filename: string, contents: string }}
 */
export function exportArchive() {
  return {
    filename: 'medkeep-archive.db',
    contents: serializeArchive(state.records, state.pending),
  };
}

/**
 * @param {DashboardState} next
 */
function commit(next) {
  state = Object.freeze(next);
  let persistenceError = null;
  try {
    saveState(state);
  } catch (error) {
    persistenceError = error;
  }
  for (const listener of listeners) {
    listener(state);
  }
  if (persistenceError) {
    throw persistenceError;
  }
}
