import { describe, expect, it } from 'vitest';

import { hexDecode, hexEncode, parseArchive, serializeArchive } from '../../src/domain/archive';
import { appendRecord } from '../../src/domain/chain';

describe('archive', () => {
  it('round-trips UTF-8, tabs, newlines and empty content', () => {
    const contents = ['بیمار\tاول\nMedication: café', '', 'Line one\r\nLine two'];
    let records = appendRecord([], 1, contents[0] ?? '');
    records = appendRecord(records, 2, contents[1] ?? '');
    records = appendRecord(records, 3, contents[2] ?? '');
    const pending = [
      { id: 4, content: 'queued \t request' },
      { id: 5, content: '' },
    ];

    const archive = serializeArchive(records, pending);
    expect(archive).toMatch(/^MEDKEEP\t2\n/);

    const parsed = parseArchive(archive);
    expect(parsed.records.map((record) => record.content)).toEqual(contents);
    expect(parsed.pending).toEqual(pending);
    expect(parsed.nextId).toBe(6);
  });

  it('rejects tampered and malformed archives', () => {
    const records = appendRecord([], 1, 'safe content');
    const archive = serializeArchive(records, []);

    expect(() => parseArchive('MEDKEEP\t1\n')).toThrow(/header/);

    const tampered = archive.replace(/C\t1\t([0-9a-f]{16})\t/, (_match, digest: string) => {
      const next = digest === '0'.repeat(16) ? '1'.repeat(16) : '0'.repeat(16);
      return `C\t1\t${next}\t`;
    });
    expect(tampered).not.toBe(archive);
    expect(() => parseArchive(tampered)).toThrow(/Integrity verification failed/);

    const outOfOrder = 'MEDKEEP\t2\nQ\t1\t6100\nC\t2\t0000000000000000\t6100\n';
    expect(() => parseArchive(outOfOrder)).toThrow(/after pending|increasing/);
  });

  it('parses an empty archive', () => {
    const parsed = parseArchive('MEDKEEP\t2\n');
    expect(parsed.records).toEqual([]);
    expect(parsed.pending).toEqual([]);
    expect(parsed.nextId).toBe(1);
  });

  it('rejects odd or non-hex content', () => {
    expect(() => hexDecode('abc')).toThrow(/hexadecimal/);
    expect(() => hexDecode('zz')).toThrow(/hexadecimal/);
    expect(hexEncode('A')).toBe('41');
    expect(hexDecode('41')).toBe('A');
  });
});
