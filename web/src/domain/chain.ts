/**
 * Pure hash-chain domain logic. No DOM or storage access, so it can be unit
 * tested under Node and reused by the browser store.
 */

import { digestFor } from './fnv1a';
import type { RecordEntry, Verification } from './types';

/**
 * Append a record, computing its chained digest from the current tail.
 * Returns a new array; the input is never mutated.
 */
export function appendRecord(
  records: readonly RecordEntry[],
  id: number,
  content: string,
): RecordEntry[] {
  if (!Number.isInteger(id) || id <= 0) {
    throw new RangeError('Record ID must be a positive integer.');
  }

  const previous = records.length > 0 ? records[records.length - 1] : undefined;
  if (previous !== undefined && id <= previous.id) {
    throw new RangeError('Record IDs must be strictly increasing.');
  }

  const digest = digestFor(previous ? previous.digest : '', id, content);
  return [...records, Object.freeze({ id, content, digest })];
}

/**
 * Recompute the entire chain and compare every stored digest.
 */
export function verifyRecords(records: readonly RecordEntry[]): Verification {
  let previousDigest = '';
  let previousId = 0;
  const verified: RecordEntry[] = [];

  for (const record of records) {
    if (!Number.isInteger(record.id) || record.id <= 0) {
      return { ok: false, error: 'Record with an invalid ID was found.' };
    }
    if (record.id <= previousId) {
      return { ok: false, error: 'Record IDs are not in strictly increasing order.' };
    }

    const expected = digestFor(previousDigest, record.id, record.content);
    if (expected !== record.digest) {
      return { ok: false, error: `Integrity verification failed at record ${record.id}.` };
    }

    verified.push(Object.freeze({ id: record.id, content: record.content, digest: record.digest }));
    previousId = record.id;
    previousDigest = record.digest;
  }

  return { ok: true, records: verified };
}
