import { expectTypeOf, test } from 'vitest';

import { dashboardStateSchema } from '../../src/domain/schema';
import { fail, ok, type RecordEntry, type Result, type Verification } from '../../src/domain/types';

test('Result narrows on the ok flag', () => {
  const result: Result<number> = ok(1);
  if (result.ok) {
    expectTypeOf(result.value).toEqualTypeOf<number>();
  } else {
    expectTypeOf(result.error).toEqualTypeOf<string>();
  }

  expectTypeOf(fail('x')).toEqualTypeOf<Result<never>>();
});

test('Verification narrows to records only on success', () => {
  function inspect(verification: Verification): void {
    if (verification.ok) {
      expectTypeOf(verification.records).toEqualTypeOf<RecordEntry[]>();
    } else {
      expectTypeOf(verification.error).toEqualTypeOf<string>();
    }
  }

  inspect({ ok: true, records: [] });
});

test('schema output matches the record shape', () => {
  const parsed = dashboardStateSchema.parse({ records: [], pending: [], nextId: 1 });
  expectTypeOf(parsed.records).toEqualTypeOf<{ id: number; content: string; digest: string }[]>();
  expectTypeOf(parsed.pending).toEqualTypeOf<{ id: number; content: string }[]>();
});
