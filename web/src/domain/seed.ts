/**
 * Fictional demo dataset. Digests are computed at load time through the real
 * chain algorithm so the dashboard always starts from a verifiable archive.
 */

import { appendRecord } from './chain';
import type { DashboardState, PendingRequest, RecordEntry } from './types';

const SEED_RECORDS = [
  'Patient: A. Rivera\nVisit: Annual physical\nBP: 118/76 mmHg\nNotes: No acute concerns.',
  'Patient: M. Chen\nVisit: Follow-up (2 weeks)\nMedication: Lisinopril 10 mg daily\nNotes: BP improving; continue plan.',
  'Patient: S. Okafor\nVisit: Lab review\nResults: CBC within range; ferritin low-normal\nPlan: dietary iron, recheck in 6 weeks.',
  'Patient: J. Alvarez\nVisit: Telehealth\nNotes: Reports improved sleep; continue current regimen.',
];

const SEED_PENDING = [
  'Patient: L. Haddad\nVisit: Intake\nNotes: New patient; allergies pending confirmation.',
  'Patient: R. Singh\nVisit: Post-op check\nNotes: Wound healing well; sutures removed.',
  'Patient: T. Bakker\nVisit: Vaccination\nNotes: Influenza vaccine administered; observe 15 minutes.',
];

export function createSeedState(now: number = Date.now()): DashboardState {
  let records: RecordEntry[] = [];
  SEED_RECORDS.forEach((content, index) => {
    records = appendRecord(records, index + 1, content);
  });

  let nextId = SEED_RECORDS.length + 1;
  const pending: PendingRequest[] = SEED_PENDING.map((content) => {
    const request = Object.freeze({ id: nextId, content });
    nextId += 1;
    return request;
  });

  return {
    records: Object.freeze(records),
    pending: Object.freeze(pending),
    nextId,
    updatedAt: now,
    seeded: true,
  };
}
