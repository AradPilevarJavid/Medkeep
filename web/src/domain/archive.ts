/**
 * Serialization for the `MEDKEEP\t2` archive format consumed by the C++ CLI.
 * Content is hexadecimal encoded so tabs, newlines and arbitrary UTF-8 survive
 * the line-based file format.
 */

import { verifyRecords } from './chain';
import { utf8Bytes } from './fnv1a';
import { pendingRequestSchema, recordSchema } from './schema';
import type { PendingRequest, RecordEntry } from './types';

const HEADER = 'MEDKEEP\t2';
const HEX_DIGITS = '0123456789abcdef';
const decoder = new TextDecoder('utf-8', { fatal: true });

export interface ParsedArchive {
  readonly records: RecordEntry[];
  readonly pending: PendingRequest[];
  readonly nextId: number;
}

export function hexEncode(value: string): string {
  const bytes = utf8Bytes(value);
  let output = '';
  for (const byte of bytes) {
    output += HEX_DIGITS.charAt(byte >> 4);
    output += HEX_DIGITS.charAt(byte & 0x0f);
  }
  return output;
}

export function hexDecode(value: string): string {
  if (value.length % 2 !== 0) {
    throw new Error('Invalid hexadecimal content in archive.');
  }

  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    const high = HEX_DIGITS.indexOf(value.charAt(index).toLowerCase());
    const low = HEX_DIGITS.indexOf(value.charAt(index + 1).toLowerCase());
    if (high < 0 || low < 0) {
      throw new Error('Invalid hexadecimal content in archive.');
    }
    bytes[index / 2] = (high << 4) | low;
  }

  try {
    return decoder.decode(bytes);
  } catch {
    throw new Error('Archive content is not valid UTF-8.');
  }
}

export function serializeArchive(
  records: readonly RecordEntry[],
  pending: readonly PendingRequest[],
): string {
  const lines = [HEADER];
  for (const record of records) {
    lines.push(`C\t${record.id}\t${record.digest}\t${hexEncode(record.content)}`);
  }
  for (const request of pending) {
    lines.push(`Q\t${request.id}\t${hexEncode(request.content)}`);
  }
  return `${lines.join('\n')}\n`;
}

/**
 * Parse and fully validate an archive. Integrity is re-verified before the
 * data is returned, so a tampered file is rejected rather than repaired.
 */
export function parseArchive(text: string): ParsedArchive {
  const lines = text.split(/\r?\n/);
  if (lines.length === 0 || lines[0]?.trimEnd() !== HEADER) {
    throw new Error('Unsupported or invalid MedKeep archive header.');
  }

  const records: RecordEntry[] = [];
  const pending: PendingRequest[] = [];
  let previousId = 0;
  let sawPending = false;

  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === undefined || line.length === 0) {
      continue;
    }

    const fields = line.split('\t');
    const kind = fields[0];

    if (kind === 'C') {
      if (sawPending) {
        throw new Error('Committed records cannot appear after pending requests.');
      }
      if (fields.length !== 4) {
        throw new Error('A committed-record entry has an invalid format.');
      }
      const id = parseId(fields[1]);
      if (id <= previousId) {
        throw new Error('Archive request IDs must be unique and increasing.');
      }
      previousId = id;
      records.push({
        id,
        content: hexDecode(fields[3] ?? ''),
        digest: normalizeDigest(fields[2] ?? ''),
      });
    } else if (kind === 'Q') {
      sawPending = true;
      if (fields.length !== 3) {
        throw new Error('A pending-request entry has an invalid format.');
      }
      const id = parseId(fields[1]);
      if (id <= previousId) {
        throw new Error('Archive request IDs must be unique and increasing.');
      }
      previousId = id;
      pending.push({ id, content: hexDecode(fields[2] ?? '') });
    } else {
      throw new Error(`Unknown archive entry type: ${String(kind)}`);
    }
  }

  if (
    !records.every((record) => recordSchema.safeParse(record).success) ||
    !pending.every((request) => pendingRequestSchema.safeParse(request).success) ||
    !Number.isSafeInteger(previousId + 1)
  ) {
    throw new Error('Archive contains an invalid or oversized entry.');
  }
  const verification = verifyRecords(records);
  if (!verification.ok) {
    throw new Error(verification.error);
  }

  return { records: verification.records, pending, nextId: previousId + 1 };
}

function parseId(value: string | undefined): number {
  if (value === undefined || !/^[0-9]+$/.test(value)) {
    throw new Error('An archive entry has an invalid ID.');
  }
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error('An archive entry has an invalid ID.');
  }
  return id;
}

function normalizeDigest(value: string): string {
  if (!/^[0-9a-fA-F]{16}$/.test(value)) {
    throw new Error('A stored FNV-1a 64-bit hash must contain 16 hex characters.');
  }
  return value.toLowerCase();
}
