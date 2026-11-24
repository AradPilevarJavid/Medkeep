import { describe, expect, it } from 'vitest';
import { formatBytes, formatDateTime, formatTime, truncate } from '../../src/lib/format';

describe('presentation formatting', () => {
  it('formats sizes and handles invalid values', () => {
    expect(formatBytes(-1)).toBe('—');
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(10 * 1024 * 1024)).toBe('10 MB');
  });

  it('normalizes and truncates text', () => {
    expect(truncate('  hello\n world ')).toBe('hello world');
    expect(truncate('abcdefgh', 5)).toBe('abcd…');
  });

  it('formats timestamps', () => {
    expect(formatTime(0)).toBeTruthy();
    expect(formatDateTime(0)).toBeTruthy();
  });
});
