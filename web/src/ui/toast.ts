import { el } from './dom';

export type ToastTone = 'info' | 'success' | 'error';

export interface ToastRegion {
  readonly node: HTMLElement;
  show(message: string, tone?: ToastTone): void;
}

export function createToastRegion(): ToastRegion {
  const region = el('div', {
    class: 'toast-region',
    'aria-live': 'polite',
    'aria-atomic': 'false',
  });

  function show(message: string, tone: ToastTone = 'info'): void {
    let timeout = 0;

    const item = el('div', {
      class: `toast toast--${tone}`,
      role: tone === 'error' ? 'alert' : 'status',
    });
    const dot = el('span', { class: 'toast__dot', 'aria-hidden': 'true' });
    const body = el('span', { class: 'toast__message', text: message });

    const dismiss = (): void => {
      if (!item.isConnected) {
        return;
      }
      item.classList.add('is-leaving');
      window.setTimeout(() => {
        item.remove();
      }, 160);
    };

    const close = el(
      'button',
      {
        class: 'toast__close',
        type: 'button',
        'aria-label': 'Dismiss notification',
        onclick: dismiss,
      },
      '×',
    );

    const startTimer = (): void => {
      timeout = window.setTimeout(dismiss, tone === 'error' ? 7000 : 4200);
    };

    item.addEventListener('mouseenter', () => {
      window.clearTimeout(timeout);
    });
    item.addEventListener('mouseleave', startTimer);
    item.addEventListener('focusin', () => {
      window.clearTimeout(timeout);
    });
    item.addEventListener('focusout', startTimer);

    item.append(dot, body, close);
    region.append(item);
    startTimer();
  }

  return { node: region, show };
}
