/**
 * Shared domain types. Values crossing a trust boundary are validated by
 * `schema.ts` before they are typed as one of these.
 */

export interface RecordEntry {
  readonly id: number;
  readonly content: string;
  readonly digest: string;
}

export interface PendingRequest {
  readonly id: number;
  readonly content: string;
}

export interface DashboardState {
  readonly records: readonly RecordEntry[];
  readonly pending: readonly PendingRequest[];
  readonly nextId: number;
  readonly updatedAt: number;
  readonly seeded: boolean;
}

export type Result<T, E = string> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function fail<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export type Verification =
  | { readonly ok: true; readonly records: RecordEntry[] }
  | { readonly ok: false; readonly error: string };
