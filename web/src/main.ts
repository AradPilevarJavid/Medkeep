import './styles/main.css';
import { initStore } from './data/store';
import { createApp } from './ui/app';
import { el } from './ui/dom';

function bootstrap(): void {
  const root = document.getElementById('app');
  if (!root) {
    throw new Error('Missing #app root element.');
  }

  const init = initStore();
  const app = createApp({ initialError: init.error, persisted: init.persisted });
  root.append(app.node);
}

function renderFatal(error: unknown): void {
  const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
  document.body.replaceChildren(
    el(
      'div',
      { class: 'fatal' },
      el('h1', { class: 'fatal__title', text: 'MedKeep could not start' }),
      el('p', { class: 'fatal__body', text: message }),
      el('p', {
        class: 'fatal__hint',
        text: 'Reload the page. If the problem persists, clear the saved data from another tab.',
      }),
    ),
  );
}

try {
  bootstrap();
} catch (error) {
  renderFatal(error);
}
