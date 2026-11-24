import { afterEach, describe, expect, it, vi } from 'vitest';

import type { RecordEntry } from '../../src/domain/types';
import { createRecordsPanel } from '../../src/ui/components/records';

const records: RecordEntry[] = [
  { id: 1, content: 'alpha patient', digest: 'a'.repeat(16) },
  { id: 2, content: 'beta patient', digest: 'b'.repeat(16) },
];

afterEach(() => {
  document.body.replaceChildren();
});

describe('records panel', () => {
  it('renders newest first', () => {
    const panel = createRecordsPanel({ onSearch: vi.fn(), onCopy: vi.fn() });
    document.body.append(panel.node);

    panel.update(records, '');

    const items = panel.node.querySelectorAll('.record');
    expect(items).toHaveLength(2);
    expect(items[0]?.textContent).toContain('beta patient');
  });

  it('filters records and reports search changes', () => {
    const onSearch = vi.fn();
    const panel = createRecordsPanel({ onSearch, onCopy: vi.fn() });
    document.body.append(panel.node);
    panel.update(records, '');

    const search = panel.node.querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = 'alpha';
    search.dispatchEvent(new Event('input', { bubbles: true }));

    expect(onSearch).toHaveBeenCalledWith('alpha');

    panel.update(records, 'alpha');
    expect(panel.node.querySelectorAll('.record')).toHaveLength(1);
    expect(panel.node.querySelector('.record')?.textContent).toContain('alpha patient');
  });

  it('copies a digest', () => {
    const onCopy = vi.fn();
    const panel = createRecordsPanel({ onSearch: vi.fn(), onCopy });
    document.body.append(panel.node);
    panel.update(records, '');

    const copy = panel.node.querySelector<HTMLButtonElement>('.button--tiny')!;
    copy.click();

    expect(onCopy).toHaveBeenCalledWith(records[1]!.digest);
  });
});
