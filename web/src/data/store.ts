/**
 * Single source of truth for the dashboard. Mutations are validated, persisted
 * to localStorage, then broadcast to subscribers. The state object is replaced
 * (never mutated in place) so the UI can render deterministically.
 */

import { parseArchive, serializeArchive, type ParsedArchive } from '../domain/archive';
import { appendRecord, verifyRecords } from '../domain/chain';
import { createSeedState } from '../domain/seed';
import type { DashboardState, PendingRequest, RecordEntry, Verification } from '../domain/types';
import { clearState, loadState, saveState } from './storage';

export const MAX_CONTENT_LENGTH = 20_000;

export interface InitResult {
  readonly error: string;
  readonly persisted: boolean;
}

let state: DashboardState = createEmptyState();
let memoryOnly = false;
const listeners = new Set<(next: DashboardState) => void>();

export function createEmptyState(now: number = Date.now()): DashboardState {
  return {
    records: Object.freeze([] as RecordEntry[]),
    pending: Object.freeze([] as PendingRequest[]),
    nextId: 1,
    updatedAt: now,
    seeded: false,
  };
}

/**
 * Load persisted state. Corrupt data is never overwritten automatically: the
 * dashboard starts empty in memory and reports the error so the user can
 * export or clear the damaged archive deliberately.
 */
export function initStore(): InitResult {
  memoryOnly = false;
  const loaded = loadState();
  if (loaded.state) {
    state = loaded.state;
    return { error: '', persisted: true };
  }

  if (loaded.error) {
    state = createEmptyState();
    memoryOnly = true;
    return { error: loaded.error, persisted: false };
  }

  state = createEmptyState();
  try {
    saveState(state);
    return { error: '', persisted: true };
  } catch (error) {
    memoryOnly = true;
    return { error: errorMessage(error), persisted: false };
  }
}

export function getState(): DashboardState {
  return state;
}

export function subscribe(listener: (next: DashboardState) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function addRequest(rawContent: string): PendingRequest {
  const content = rawContent;
  if (content.trim().length === 0) {
    throw new Error('Enter a record before adding it to the queue.');
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    throw new Error(`Records are limited to ${MAX_CONTENT_LENGTH.toLocaleString()} characters.`);
  }
  if (!Number.isSafeInteger(state.nextId + 1) || state.nextId <= 0) {
    throw new Error('The request ID range has been exhausted.');
  }

  const request: PendingRequest = Object.freeze({ id: state.nextId, content });
  commit({
    ...state,
    pending: Object.freeze([...state.pending, request]),
    nextId: state.nextId + 1,
    updatedAt: Date.now(),
  });
  return request;
}

export function processNext(): RecordEntry | null {
  const [request, ...remaining] = state.pending;
  if (request === undefined) {
    return null;
  }

  const records = appendRecord(state.records, request.id, request.content);
  const record = records[records.length - 1];
  if (record === undefined) {
    throw new Error('Failed to commit the queued request.');
  }

  commit({
    ...state,
    records: Object.freeze(records),
    pending: Object.freeze(remaining),
    updatedAt: Date.now(),
  });
  return record;
}

export function processAll(): number {
  if (state.pending.length === 0) {
    return 0;
  }

  let records: RecordEntry[] = [...state.records];
  for (const request of state.pending) {
    records = appendRecord(records, request.id, request.content);
  }

  const committed = state.pending.length;
  commit({
    ...state,
    records: Object.freeze(records),
    pending: Object.freeze([] as PendingRequest[]),
    updatedAt: Date.now(),
  });
  return committed;
}

export function replaceArchive(data: ParsedArchive): void {
  const validated = parseArchive(serializeArchive(data.records, data.pending));

  commit({
    records: Object.freeze(validated.records),
    pending: Object.freeze(validated.pending.map((request) => Object.freeze({ ...request }))),
    nextId: validated.nextId,
    updatedAt: Date.now(),
    seeded: false,
  });
}

export function loadSeed(): void {
  commit(createSeedState());
}

export function resetAll(): void {
  if (memoryOnly) {
    clearState();
  }
  commit(createEmptyState());
}

export function verify(): Verification {
  return verifyRecords(state.records);
}

export function exportArchive(): { readonly filename: string; readonly contents: string } {
  return {
    filename: 'medkeep-archive.db',
    contents: serializeArchive(state.records, state.pending),
  };
}

function commit(next: DashboardState): void {
  if (!memoryOnly) {
    saveState(next);
  }
  state = Object.freeze(next);

  for (const listener of listeners) {
    listener(state);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Could not persist data.';
}
