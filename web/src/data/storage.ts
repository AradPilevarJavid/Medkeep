/**
 * Versioned localStorage adapter. Loading validates the full hash chain before
 * returning data; a corrupt payload is reported instead of silently repaired.
 */

import { verifyRecords } from '../domain/chain';
import { dashboardStateSchema } from '../domain/schema';
import type { DashboardState, PendingRequest, RecordEntry } from '../domain/types';

const STORAGE_KEY = 'medkeep.dashboard.v1';

export interface LoadStateResult {
  readonly state: DashboardState | null;
  readonly error: string;
}

function browserStorage(): Storage | null {
  try {
    const storage: Storage | null = globalThis.localStorage;
    return storage;
  } catch {
    return null;
  }
}

export function loadState(): LoadStateResult {
  const storage = browserStorage();
  if (!storage) {
    return { state: null, error: 'Browser storage is unavailable in this context.' };
  }

  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { state: null, error: 'Browser storage is unavailable in this context.' };
  }

  if (!raw) {
    return { state: null, error: '' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { state: null, error: 'Saved dashboard data could not be parsed.' };
  }

  const result = dashboardStateSchema.safeParse(parsed);
  if (!result.success) {
    return { state: null, error: 'Saved dashboard data has an unexpected shape.' };
  }

  const verification = verifyRecords(result.data.records);
  if (!verification.ok) {
    return { state: null, error: `Saved chain failed verification: ${verification.error}` };
  }

  const records: readonly RecordEntry[] = verification.records;
  const pending: readonly PendingRequest[] = result.data.pending.map((request) =>
    Object.freeze({ id: request.id, content: request.content }),
  );

  const lastRecordId = records.length > 0 ? (records[records.length - 1]?.id ?? 0) : 0;
  let previousPendingId = lastRecordId;
  for (const request of pending) {
    if (request.id <= previousPendingId) {
      return { state: null, error: 'Saved request IDs are not strictly increasing.' };
    }
    previousPendingId = request.id;
  }

  if (result.data.nextId <= previousPendingId) {
    return { state: null, error: 'Saved next ID is not ahead of existing entries.' };
  }

  return {
    state: {
      records,
      pending,
      nextId: result.data.nextId,
      updatedAt: result.data.updatedAt ?? Date.now(),
      seeded: result.data.seeded ?? false,
    },
    error: '',
  };
}

export function saveState(state: DashboardState): void {
  const storage = browserStorage();
  if (!storage) {
    throw new Error('Browser storage is unavailable in this context.');
  }

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      throw new Error('Browser storage is full. Export your archive before continuing.', {
        cause: error,
      });
    }
    throw new Error('Could not persist dashboard data to browser storage.', { cause: error });
  }
}

export function clearState(): void {
  try {
    globalThis.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage may be unavailable; clearing is best-effort */
  }
}
