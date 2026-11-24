import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addRequest,
  exportArchive,
  getState,
  initStore,
  loadSeed,
  processAll,
  processNext,
  replaceArchive,
  resetAll,
  verify,
} from '../../src/data/store';
import { parseArchive } from '../../src/domain/archive';

beforeEach(() => {
  localStorage.clear();
  resetAll();
});

describe('store', () => {
  it('starts empty after a reset', () => {
    const state = getState();
    expect(state.records).toHaveLength(0);
    expect(state.pending).toHaveLength(0);
    expect(state.nextId).toBe(1);
  });

  it('queues and commits a request', () => {
    const request = addRequest('Patient: Test');
    expect(request.id).toBe(1);
    expect(getState().pending).toHaveLength(1);

    const record = processNext();
    expect(record?.id).toBe(1);
    expect(getState().pending).toHaveLength(0);
    expect(getState().records).toHaveLength(1);
    expect(verify().ok).toBe(true);
  });

  it('rejects empty content', () => {
    expect(() => addRequest('   ')).toThrow(/Enter a record/);
  });

  it('returns null when processing an empty queue', () => {
    expect(processNext()).toBeNull();
    expect(processAll()).toBe(0);
  });

  it('commits every pending request in FIFO order', () => {
    addRequest('one');
    addRequest('two');
    addRequest('three');
    expect(processAll()).toBe(3);
    expect(getState().records.map((record) => record.content)).toEqual(['one', 'two', 'three']);
  });

  it('exports and re-imports an archive', () => {
    addRequest('committed');
    processNext();
    addRequest('pending');
    const archive = exportArchive();

    resetAll();
    replaceArchive(parseArchive(archive.contents));

    expect(getState().records.map((record) => record.content)).toEqual(['committed']);
    expect(getState().pending.map((request) => request.content)).toEqual(['pending']);
  });

  it('loads demo data and clears it', () => {
    loadSeed();
    expect(getState().records.length).toBeGreaterThan(0);
    expect(getState().seeded).toBe(true);

    resetAll();
    expect(getState().records).toHaveLength(0);
    expect(getState().seeded).toBe(false);
  });

  it('restores persisted state through initStore', () => {
    addRequest('persisted');
    const result = initStore();
    expect(result.error).toBe('');
    expect(getState().pending.map((request) => request.content)).toEqual(['persisted']);
  });

  it('does not mutate state when persistence fails', () => {
    initStore();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(() => addRequest('unsaved')).toThrow(/storage is full/);
    expect(getState().pending).toHaveLength(0);
    vi.restoreAllMocks();
  });

  it('keeps corrupt saved data untouched while working in memory', () => {
    localStorage.setItem('medkeep.dashboard.v1', '{broken');
    expect(initStore().persisted).toBe(false);
    addRequest('temporary');
    expect(localStorage.getItem('medkeep.dashboard.v1')).toBe('{broken');
    expect(getState().pending).toHaveLength(1);
    localStorage.clear();
    initStore();
  });
});
