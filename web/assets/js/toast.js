import { el } from './dom.js';

const region = document.getElementById('toast-region');

/**
 * @param {string} message
 * @param {'info' | 'success' | 'error'} [tone]
 */
export function toast(message, tone = 'info') {
  if (!region) {
    return;
  }

  const item = el(
    'div',
    { class: `toast toast--${tone}`, role: tone === 'error' ? 'alert' : 'status' },
    el('span', { class: 'toast__dot', 'aria-hidden': 'true' }),
    el('span', { class: 'toast__message', text: message }),
    el('button', {
      class: 'toast__close',
      type: 'button',
      'aria-label': 'Dismiss notification',
      onclick: () => dismiss(item),
    }, '×'),
  );

  region.append(item);
  window.setTimeout(() => dismiss(item), tone === 'error' ? 7000 : 4200);
}

/**
 * @param {HTMLElement} item
 */
function dismiss(item) {
  if (!item.isConnected) {
    return;
  }
  item.classList.add('is-leaving');
  window.setTimeout(() => item.remove(), 180);
}
