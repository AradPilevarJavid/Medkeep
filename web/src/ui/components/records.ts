import type { RecordEntry } from '../../domain/types';
import { COPY } from '../copy';
import { clear, el } from '../dom';
import { emptyState } from './empty-state';

export interface RecordsOptions {
  readonly onSearch: (query: string) => void;
  readonly onCopy: (digest: string) => void;
}

export interface RecordsPanel {
  readonly node: HTMLElement;
  update(records: readonly RecordEntry[], query: string): void;
  focusSearch(): void;
}

export function createRecordsPanel(options: RecordsOptions): RecordsPanel {
  const searchId = 'records-search';
  const helpId = 'records-search-help';

  const search = el('input', {
    id: searchId,
    class: 'search__input',
    type: 'search',
    placeholder: 'Search by ID, digest, or text',
    autocomplete: 'off',
    'aria-describedby': helpId,
  });

  const count = el('span', { class: 'badge', text: '0' });
  const list = el('ol', { class: 'record-list' });
  const emptyContainer = el('div', { class: 'empty-slot' });

  const node = el(
    'section',
    { class: 'panel records', 'aria-labelledby': 'records-title' },
    el(
      'div',
      { class: 'panel__header' },
      el(
        'div',
        { class: 'panel__heading' },
        el('h2', { id: 'records-title', class: 'panel__title', text: 'Committed records' }),
        count,
      ),
      el(
        'div',
        { class: 'search' },
        el('label', { class: 'sr-only', for: searchId, text: 'Search records' }),
        search,
      ),
    ),
    el('p', {
      class: 'field-help',
      id: helpId,
      text: 'Newest records are shown first. Search matches IDs, digests, and record text.',
    }),
    list,
    emptyContainer,
  );

  search.addEventListener('input', () => {
    options.onSearch(search.value);
  });

  function update(records: readonly RecordEntry[], query: string): void {
    if (search.value !== query) {
      search.value = query;
    }

    const normalized = query.trim().toLowerCase();
    const newestFirst = [...records].reverse();
    const filtered = normalized
      ? newestFirst.filter((record) => matches(record, normalized))
      : newestFirst;

    count.textContent = normalized
      ? `${filtered.length} of ${records.length}`
      : String(records.length);

    clear(list);
    clear(emptyContainer);

    if (filtered.length === 0) {
      emptyContainer.append(
        emptyState(
          records.length === 0 ? 'No records yet' : 'No matches',
          records.length === 0 ? COPY.emptyRecords : 'No records match your search.',
        ),
      );
      return;
    }

    for (const record of filtered) {
      list.append(renderRecord(record, options.onCopy));
    }
  }

  return {
    node,
    update,
    focusSearch() {
      search.focus();
    },
  };
}

function renderRecord(record: RecordEntry, onCopy: (digest: string) => void): HTMLElement {
  return el(
    'li',
    { class: 'record' },
    el(
      'div',
      { class: 'record__top' },
      el('span', { class: 'badge', text: `#${record.id}` }),
      el('code', {
        class: 'digest',
        title: 'FNV-1a 64-bit chained digest',
        text: record.digest,
      }),
      el(
        'button',
        {
          class: 'button button--tiny',
          type: 'button',
          'aria-label': `Copy digest for record ${record.id}`,
          onclick: () => {
            onCopy(record.digest);
          },
        },
        'Copy',
      ),
    ),
    el('p', {
      class: 'record__content',
      text: record.content.trim().length > 0 ? record.content : '(empty record)',
    }),
  );
}

function matches(record: RecordEntry, query: string): boolean {
  return (
    String(record.id) === query ||
    String(record.id).includes(query) ||
    record.digest.includes(query) ||
    record.content.toLowerCase().includes(query)
  );
}
