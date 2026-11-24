import type { DashboardState } from '../../domain/types';
import { COPY } from '../copy';
import { clear, el } from '../dom';
import { emptyState } from './empty-state';

export interface QueueOptions {
  readonly onProcessNext: () => void;
  readonly onProcessAll: () => void;
}

export interface QueuePanel {
  readonly node: HTMLElement;
  update(state: DashboardState): void;
}

export function createQueuePanel(options: QueueOptions): QueuePanel {
  const count = el('span', { class: 'badge', text: '0' });
  const list = el('ol', { class: 'queue-list' });
  const emptyContainer = el('div', { class: 'empty-slot' });

  const nextButton = el(
    'button',
    { class: 'button button--ghost', type: 'button', onclick: options.onProcessNext },
    'Process next',
  );
  const allButton = el(
    'button',
    { class: 'button button--ghost', type: 'button', onclick: options.onProcessAll },
    'Process all',
  );

  const node = el(
    'section',
    { class: 'panel queue', 'aria-labelledby': 'queue-title' },
    el(
      'div',
      { class: 'panel__header' },
      el(
        'div',
        { class: 'panel__heading' },
        el('h2', { id: 'queue-title', class: 'panel__title', text: 'Pending queue' }),
        count,
      ),
      el('div', { class: 'panel__actions' }, nextButton, allButton),
    ),
    list,
    emptyContainer,
  );

  function update(state: DashboardState): void {
    count.textContent = String(state.pending.length);
    nextButton.disabled = state.pending.length === 0;
    allButton.disabled = state.pending.length === 0;

    clear(list);
    clear(emptyContainer);

    if (state.pending.length === 0) {
      emptyContainer.append(emptyState('Queue is clear', COPY.emptyQueue));
      return;
    }

    state.pending.forEach((request, index) => {
      list.append(
        el(
          'li',
          { class: 'queue-item' },
          el(
            'div',
            { class: 'queue-item__top' },
            el('span', { class: 'badge', text: `#${request.id}` }),
            index === 0 ? el('span', { class: 'tag tag--next', text: 'Next' }) : null,
          ),
          el('p', {
            class: 'queue-item__content',
            text: request.content.trim().length > 0 ? request.content : '(empty record)',
          }),
        ),
      );
    });
  }

  return { node, update };
}
