import type { Verification } from '../../domain/types';
import { el } from '../dom';

export interface StatusPill {
  readonly node: HTMLElement;
  update(verification: Verification): void;
}

export function createStatusPill(): StatusPill {
  const dot = el('span', { class: 'status-pill__dot', 'aria-hidden': 'true' });
  const label = el('span', { class: 'status-pill__label', text: 'Checking chain' });
  const node = el('span', { class: 'status-pill', dataset: { state: 'neutral' } }, dot, label);

  return {
    node,
    update(verification) {
      node.dataset.state = verification.ok ? 'ok' : 'error';
      label.textContent = verification.ok ? 'Chain verified' : 'Chain failed';
    },
  };
}
