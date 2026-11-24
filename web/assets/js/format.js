/**
 * Presentation helpers shared across UI modules.
 */

/**
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '—';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

/**
 * @param {string} content
 * @param {number} [limit]
 * @returns {string}
 */
export function truncate(content, limit = 90) {
  const singleLine = content.replace(/\s+/g, ' ').trim();
  if (singleLine.length <= limit) {
    return singleLine;
  }
  return `${singleLine.slice(0, limit - 1)}…`;
}

/**
 * Locale-aware, human readable timestamp for "last verified" style labels.
 * @param {number} timestamp
 * @returns {string}
 */
export function formatTime(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(timestamp);
}

/**
 * @param {string} filename
 * @param {string} contents
 * @param {string} mimeType
 */
export function downloadFile(filename, contents, mimeType = 'text/plain') {
  const blob = new Blob([contents], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
