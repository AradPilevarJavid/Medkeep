import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearState, loadState, saveState } from '../../src/data/storage';
import { appendRecord } from '../../src/domain/chain';
import type { DashboardState } from '../../src/domain/types';

const STORAGE_KEY = 'medkeep.dashboard.v1';

function validState(): DashboardState {
  let records = appendRecord([], 1, 'first');
  records = appendRecord(records, 2, 'second');
  return {
    records,
    pending: [{ id: 3, content: 'queued' }],
    nextId: 4,
    updatedAt: 123,
    seeded: false,
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('storage', () => {
  it('round-trips a valid state', () => {
    saveState(validState());
    const loaded = loadState();
    expect(loaded.error).toBe('');
    expect(loaded.state?.records.map((record) => record.content)).toEqual(['first', 'second']);
    expect(loaded.state?.pending).toEqual([{ id: 3, content: 'queued' }]);
    expect(loaded.state?.nextId).toBe(4);
  });

  it('returns an empty result when nothing is saved', () => {
    expect(loadState()).toEqual({ state: null, error: '' });
  });

  it('reports unparseable JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    const loaded = loadState();
    expect(loaded.state).toBeNull();
    expect(loaded.error).toMatch(/could not be parsed/);
  });

  it('reports a tampered chain instead of repairing it', () => {
    const state = validState();
    const first = state.records[0]!;
    saveState({ ...state, records: [{ ...first, content: 'tampered' }] });
    const loaded = loadState();
    expect(loaded.state).toBeNull();
    expect(loaded.error).toMatch(/failed verification/);
  });

  it('rejects pending IDs that are not increasing', () => {
    const state = validState();
    saveState({ ...state, pending: [{ id: 2, content: 'out of order' }], nextId: 3 });
    const loaded = loadState();
    expect(loaded.state).toBeNull();
    expect(loaded.error).toMatch(/strictly increasing/);
  });

  it('rejects a nextId that is not ahead of existing entries', () => {
    const state = validState();
    saveState({ ...state, pending: [{ id: 3, content: 'queued' }], nextId: 3 });
    const loaded = loadState();
    expect(loaded.state).toBeNull();
    expect(loaded.error).toMatch(/not ahead/);
  });

  it('translates a quota error into a helpful message', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(() => {
      saveState(validState());
    }).toThrow(/storage is full/);
  });

  it('clears the saved state', () => {
    saveState(validState());
    clearState();
    expect(loadState()).toEqual({ state: null, error: '' });
  });
});
