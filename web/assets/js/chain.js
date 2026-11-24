/**
 * Pure hash-chain domain logic. No DOM or storage access so it can be unit
 * tested under Node and reused by the browser store.
 */

import { digestFor } from './fnv1a.js';

/**
 * @typedef {{ id: number, content: string, digest: string }} RecordEntry
 */

/**
 * Append a record, computing its chained digest from the current tail.
 * Returns a new array; the input is never mutated.
 *
 * @param {ReadonlyArray<RecordEntry>} records
 * @param {number} id
 * @param {string} content
 * @returns {RecordEntry[]}
 */
export function appendRecord(records, id, content) {
  if (!Number.isInteger(id) || id <= 0) {
    throw new RangeError('Record ID must be a positive integer.');
  }
  const previous = records.length > 0 ? records[records.length - 1] : null;
  if (previous && id <= previous.id) {
    throw new RangeError('Record IDs must be strictly increasing.');
  }

  const digest = digestFor(previous ? previous.digest : '', id, content);
  return [...records, Object.freeze({ id, content, digest })];
}

/**
 * Recompute the entire chain and compare every stored digest.
 *
 * @param {ReadonlyArray<RecordEntry>} records
 * @returns {{ ok: boolean, error: string, records: RecordEntry[] }}
 */
export function verifyRecords(records) {
  let previousDigest = '';
  let previousId = 0;
  const verified = [];

  for (const record of records) {
    if (!Number.isInteger(record.id) || record.id <= 0) {
      return failure(`Record with an invalid ID was found.`);
    }
    if (record.id <= previousId) {
      return failure('Record IDs are not in strictly increasing order.');
    }
    if (typeof record.content !== 'string') {
      return failure(`Record ${record.id} has a non-text body.`);
    }

    const expected = digestFor(previousDigest, record.id, record.content);
    if (expected !== record.digest) {
      return failure(`Integrity verification failed at record ${record.id}.`);
    }

    verified.push(Object.freeze({
      id: record.id,
      content: record.content,
      digest: record.digest,
    }));
    previousId = record.id;
    previousDigest = record.digest;
  }

  return { ok: true, error: '', records: verified };
}

/**
 * @param {string} message
 * @returns {{ ok: false, error: string, records: [] }}
 */
function failure(message) {
  return { ok: false, error: message, records: [] };
}
