/**
 * FNV-1a 64-bit hashing with the exact domain-separated construction used by
 * the C++ MedKeep core (`src/log_chain.cpp`). Keeping this byte-for-byte in
 * sync means a dashboard export can be loaded by the CLI and vice versa.
 *
 * The digest of a record is:
 *   FNV1a64( "MedKeep/FNV1a64/v1\0" || previous_digest_ascii
 *            || id_be_u64 || content_length_be_u64 || content_bytes )
 *
 * BigInt is used because 64-bit values exceed Number.MAX_SAFE_INTEGER.
 */

export const OFFSET_BASIS = 14695981039346656037n;
export const FNV_PRIME = 1099511628211n;

const MASK_64 = 0xffffffffffffffffn;
const DOMAIN = 'MedKeep/FNV1a64/v1';
const encoder = new TextEncoder();

/**
 * @param {string} value
 * @returns {Uint8Array}
 */
export function utf8Bytes(value) {
  return encoder.encode(value);
}

/**
 * @param {string} value
 * @returns {Uint8Array} UTF-8 bytes followed by a NUL terminator, matching a
 * C string literal iterated as a character array.
 */
function domainBytes() {
  const text = utf8Bytes(DOMAIN);
  const bytes = new Uint8Array(text.length + 1);
  bytes.set(text);
  return bytes;
}

/**
 * @param {Uint8Array} bytes
 * @returns {bigint}
 */
export function fnv1a64(bytes) {
  let hash = OFFSET_BASIS;
  for (let index = 0; index < bytes.length; index += 1) {
    hash = ((hash ^ BigInt(bytes[index])) * FNV_PRIME) & MASK_64;
  }
  return hash;
}

/**
 * @param {bigint} hash
 * @returns {string} 16 lowercase hexadecimal characters.
 */
export function toHex64(hash) {
  return hash.toString(16).padStart(16, '0');
}

/**
 * @param {bigint | number} value
 * @returns {Uint8Array} 8-byte big-endian unsigned integer.
 */
function bigEndianU64(value) {
  let remaining = BigInt(value);
  const bytes = new Uint8Array(8);
  for (let index = 7; index >= 0; index -= 1) {
    bytes[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  return bytes;
}

/**
 * Compute the chained digest for a single record.
 *
 * @param {string} previousDigest Hex digest of the previous record, or "".
 * @param {number} id Positive record identifier.
 * @param {string} content Record body.
 * @returns {string}
 */
export function digestFor(previousDigest, id, content) {
  if (!Number.isInteger(id) || id <= 0) {
    throw new RangeError('Record ID must be a positive integer.');
  }

  const contentBytes = utf8Bytes(content);
  const idBytes = bigEndianU64(id);
  const sizeBytes = bigEndianU64(contentBytes.length);
  const previousBytes = utf8Bytes(previousDigest ?? '');

  const hash = fnv1a64(
    concatBytes(domainBytes(), previousBytes, idBytes, sizeBytes, contentBytes),
  );
  return toHex64(hash);
}

/**
 * @param {Uint8Array[]} parts
 * @returns {Uint8Array}
 */
export function concatBytes(...parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    merged.set(part, offset);
    offset += part.length;
  }
  return merged;
}
