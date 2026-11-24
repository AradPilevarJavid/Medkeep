import { el } from '../dom';

export interface EmptyStateAction {
  readonly label: string;
  readonly onClick: () => void;
}

export function emptyState(title: string, body: string, action?: EmptyStateAction): HTMLElement {
  return el(
    'div',
    { class: 'empty-state' },
    el('p', { class: 'empty-state__title', text: title }),
    el('p', { class: 'empty-state__body', text: body }),
    action
      ? el('button', {
          class: 'button button--ghost',
          type: 'button',
          text: action.label,
          onclick: action.onClick,
        })
      : null,
  );
}
