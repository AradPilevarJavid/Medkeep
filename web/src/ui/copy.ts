/**
 * Centralized English copy. Keeping the strings in one place makes a future
 * translation pass tractable.
 */

export const COPY = {
  appName: 'MedKeep',
  tagline: 'Offline medical record ledger',
  heroTitle: 'A verifiable chain of medical records',
  heroBody:
    'Requests wait in a FIFO queue, then commit to a chained FNV-1a ledger. Every digest is recomputed from genesis before records are shown.',
  privacy:
    'Records live only in this browser. They are not encrypted, and FNV-1a detects accidental tampering but does not authenticate the archive. Do not use real patient data.',
  integrityNote:
    'Integrity is not authentication. Anyone who can rewrite the whole archive can recompute every digest.',
  storageUnavailable: 'Browser storage is unavailable, so changes will not survive a reload.',
  importWarning: 'Importing replaces the current ledger. Export first if you need a copy.',
  emptyQueue: 'The queue is clear. Add a request to begin.',
  emptyRecords: 'No committed records yet. Add a request and process the queue to start the chain.',
  demoAction: 'Load demo data',
  clearAction: 'Clear all data',
  exportAction: 'Export archive',
  importAction: 'Import archive',
  verifyAction: 'Verify now',
} as const;
