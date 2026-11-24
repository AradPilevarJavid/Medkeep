import test from 'node:test';
import assert from 'node:assert/strict';

import { digestFor } from '../../web/assets/js/fnv1a.js';
import { appendRecord, verifyRecords } from '../../web/assets/js/chain.js';
import { parseArchive, serializeArchive } from '../../web/assets/js/archive.js';

test('FNV-1a matches the C++ test vector for the first record', () => {
  assert.equal(digestFor('', 1, 'first patient'), '30d909a7a87b317c');
});

test('chain appends with increasing IDs and verifies', () => {
  let records = [];
  records = appendRecord(records, 1, 'first patient');
  records = appendRecord(records, 2, 'second patient');
  records = appendRecord(records, 3, 'third patient');

  const result = verifyRecords(records);
  assert.equal(result.ok, true);
  assert.equal(result.records.length, 3);
  assert.deepEqual(result.records.map((record) => record.content), [
    'first patient',
    'second patient',
    'third patient',
  ]);
});

test('appendRecord rejects non-increasing IDs', () => {
  const records = appendRecord([], 1, 'first');
  assert.throws(() => appendRecord(records, 1, 'duplicate'), /strictly increasing/);
  assert.throws(() => appendRecord(records, 0, 'zero'), /positive integer/);
});

test('tampered content fails verification at that record', () => {
  const records = appendRecord([], 1, 'original medical record');
  const tampered = [{ ...records[0], content: 'forged medical record' }];
  const result = verifyRecords(tampered);
  assert.equal(result.ok, false);
  assert.match(result.error, /record 1/);
});

test('tampering an earlier digest breaks the later link', () => {
  let records = [];
  records = appendRecord(records, 1, 'record one');
  records = appendRecord(records, 2, 'record two');
  const tampered = [
    { ...records[0], digest: records[0].digest === '0'.repeat(16) ? '1'.repeat(16) : '0'.repeat(16) },
    records[1],
  ];
  const result = verifyRecords(tampered);
  assert.equal(result.ok, false);
  assert.match(result.error, /Integrity verification failed/);
});

test('archive serialization round-trips UTF-8, tabs, newlines and empty content', () => {
  const contents = [
    'بیمار\tاول\nMedication: café',
    '',
    'Line one\r\nLine two',
  ];
  let records = [];
  contents.forEach((content, index) => {
    records = appendRecord(records, index + 1, content);
  });
  const pending = [
    { id: 4, content: 'queued \t request' },
    { id: 5, content: '' },
  ];

  const archive = serializeArchive(records, pending);
  assert.match(archive, /^MEDKEEP\t2\n/);

  const parsed = parseArchive(archive);
  assert.deepEqual(parsed.records.map((record) => record.content), contents);
  assert.deepEqual(parsed.pending, pending);
  assert.equal(parsed.nextId, 6);
});

test('parseArchive rejects tampered and malformed archives', () => {
  const records = appendRecord([], 1, 'safe content');
  const archive = serializeArchive(records, []);

  assert.throws(() => parseArchive('MEDKEEP\t1\n'), /header/);

  const tampered = archive.replace(
    /C\t1\t([0-9a-f]{16})\t/,
    (_match, digest) => `C\t1\t${digest === '0'.repeat(16) ? '1'.repeat(16) : '0'.repeat(16)}\t`,
  );
  assert.notEqual(tampered, archive);
  assert.throws(() => parseArchive(tampered), /Integrity verification failed/);

  const outOfOrder = 'MEDKEEP\t2\nQ\t1\t6100\nC\t2\t0000000000000000\t6100\n';
  assert.throws(() => parseArchive(outOfOrder), /after pending|increasing/);
});

test('empty archive parses to an empty chain', () => {
  const parsed = parseArchive('MEDKEEP\t2\n');
  assert.deepEqual(parsed.records, []);
  assert.deepEqual(parsed.pending, []);
  assert.equal(parsed.nextId, 1);
});
