import type { Verification } from '../../domain/types';
import { formatTime } from '../../lib/format';
import { COPY } from '../copy';
import { clear, el } from '../dom';

export interface IntegrityView {
  readonly result: Verification;
  readonly at: number;
}

export interface IntegrityOptions {
  readonly onVerify: () => void;
}

export interface IntegrityPanel {
  readonly node: HTMLElement;
  update(view: IntegrityView | null): void;
}

export function createIntegrityPanel(options: IntegrityOptions): IntegrityPanel {
  const message = el('div', { class: 'integrity__message' });
  const verifyButton = el(
    'button',
    { class: 'button button--primary', type: 'button', onclick: options.onVerify },
    COPY.verifyAction,
  );

  const node = el(
    'section',
    { class: 'panel integrity', 'aria-labelledby': 'integrity-title' },
    el(
      'div',
      { class: 'panel__header' },
      el(
        'div',
        { class: 'panel__heading' },
        el('h2', { id: 'integrity-title', class: 'panel__title', text: 'Integrity' }),
      ),
      verifyButton,
    ),
    message,
    el('p', { class: 'note', text: COPY.integrityNote }),
  );

  function update(view: IntegrityView | null): void {
    clear(message);

    if (view === null) {
      node.dataset.state = 'idle';
      message.append(
        el('p', {
          class: 'integrity__lead',
          text: 'Not checked in this session.',
        }),
        el('p', {
          class: 'integrity__body',
          text: 'Run verification to recompute every digest from genesis to tip.',
        }),
      );
      return;
    }

    node.dataset.state = view.result.ok ? 'ok' : 'error';
    message.append(
      el('p', {
        class: 'integrity__lead',
        text: view.result.ok ? 'Chain verified.' : 'Chain verification failed.',
      }),
      el('p', {
        class: 'integrity__body',
        text: view.result.ok
          ? `All digests match as of ${formatTime(view.at)}.`
          : view.result.error,
      }),
    );
  }

  return { node, update };
}
