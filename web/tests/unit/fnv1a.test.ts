import { describe, expect, it } from 'vitest';

import { concatBytes, digestFor, fnv1a64, toHex64, utf8Bytes } from '../../src/domain/fnv1a';

describe('fnv1a', () => {
  it('matches the C++ test vector for the first record', () => {
    expect(digestFor('', 1, 'first patient')).toBe('30d909a7a87b317c');
  });

  it('hashes empty input to the FNV offset basis', () => {
    expect(toHex64(fnv1a64(new Uint8Array()))).toBe('cbf29ce484222325');
  });

  it('is deterministic and sensitive to content and previous digest', () => {
    expect(digestFor('', 1, 'alpha')).toBe(digestFor('', 1, 'alpha'));
    expect(digestFor('', 1, 'alpha')).not.toBe(digestFor('', 1, 'beta'));
    expect(digestFor('', 1, 'alpha')).not.toBe(digestFor('abcd', 1, 'alpha'));
  });

  it('concatenates byte arrays in order', () => {
    expect([...concatBytes(utf8Bytes('ab'), utf8Bytes('cd'))]).toEqual([97, 98, 99, 100]);
  });

  it('rejects non-positive identifiers', () => {
    expect(() => digestFor('', 0, 'x')).toThrow(RangeError);
    expect(() => digestFor('', -1, 'x')).toThrow(RangeError);
    expect(() => digestFor('', 1.5, 'x')).toThrow(RangeError);
  });
});
