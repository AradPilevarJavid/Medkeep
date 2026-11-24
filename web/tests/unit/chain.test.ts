import { describe, expect, it } from 'vitest';

import { appendRecord, verifyRecords } from '../../src/domain/chain';

describe('chain', () => {
  it('appends with increasing IDs and verifies', () => {
    let records = appendRecord([], 1, 'first patient');
    records = appendRecord(records, 2, 'second patient');
    records = appendRecord(records, 3, 'third patient');

    const result = verifyRecords(records);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.records.map((record) => record.content)).toEqual([
      'first patient',
      'second patient',
      'third patient',
    ]);
  });

  it('rejects non-increasing and non-positive IDs', () => {
    const records = appendRecord([], 1, 'first');
    expect(() => appendRecord(records, 1, 'duplicate')).toThrow(/strictly increasing/);
    expect(() => appendRecord(records, 0, 'zero')).toThrow(/positive integer/);
  });

  it('does not mutate the input array', () => {
    const original = appendRecord([], 1, 'first');
    const next = appendRecord(original, 2, 'second');
    expect(original).toHaveLength(1);
    expect(next).toHaveLength(2);
  });

  it('fails verification at the tampered record', () => {
    const records = appendRecord([], 1, 'original medical record');
    const original = records[0]!;
    const tampered = [{ ...original, content: 'forged medical record' }];
    const result = verifyRecords(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/record 1/);
    }
  });

  it('breaks the later link when an earlier digest is tampered', () => {
    let records = appendRecord([], 1, 'record one');
    records = appendRecord(records, 2, 'record two');
    const first = records[0];
    expect(first).toBeDefined();
    if (!first) {
      return;
    }
    const tampered = [
      {
        ...first,
        digest: first.digest === '0'.repeat(16) ? '1'.repeat(16) : '0'.repeat(16),
      },
      records[1]!,
    ];
    const result = verifyRecords(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Integrity verification failed/);
    }
  });
});
