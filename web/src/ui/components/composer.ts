import { MAX_CONTENT_LENGTH } from '../../data/store';
import { el } from '../dom';

export interface ComposerOptions {
  readonly onAdd: (content: string) => void;
}

export interface Composer {
  readonly node: HTMLElement;
  setError(message: string | null): void;
  clear(): void;
  focus(): void;
}

export function createComposer(options: ComposerOptions): Composer {
  const inputId = 'composer-content';
  const helpId = 'composer-help';
  const errorId = 'composer-error';

  const textarea = el('textarea', {
    id: inputId,
    class: 'composer__input',
    rows: 5,
    maxlength: String(MAX_CONTENT_LENGTH),
    placeholder: 'Patient: A. Rivera\nVisit: Annual physical\nNotes: No acute concerns.',
    'aria-describedby': `${helpId} ${errorId}`,
  });

  const counter = el('span', { class: 'composer__counter', 'aria-live': 'off' });
  const error = el('p', { class: 'field-error', id: errorId, role: 'alert', hidden: true });
  const help = el('p', {
    class: 'field-help',
    id: helpId,
    text: 'Multi-line records are supported. Add to the queue, then commit it to the chain.',
  });

  const submit = el('button', { class: 'button button--primary', type: 'submit' }, 'Add to queue');

  const form = el(
    'form',
    { class: 'composer__form', novalidate: true },
    el('label', { class: 'field-label', for: inputId, text: 'New medical record' }),
    textarea,
    help,
    error,
    el('div', { class: 'composer__footer' }, counter, submit),
  );

  function updateCounter(): void {
    const length = textarea.value.length;
    counter.textContent = `${length.toLocaleString()} / ${MAX_CONTENT_LENGTH.toLocaleString()}`;
    counter.dataset.state = length > MAX_CONTENT_LENGTH ? 'error' : 'ok';
    submit.disabled = textarea.value.trim().length === 0 || length > MAX_CONTENT_LENGTH;
  }

  function setError(message: string | null): void {
    if (message !== null) {
      error.hidden = false;
      error.textContent = message;
      textarea.setAttribute('aria-invalid', 'true');
    } else {
      error.hidden = true;
      error.textContent = '';
      textarea.removeAttribute('aria-invalid');
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (textarea.value.trim().length === 0 || textarea.value.length > MAX_CONTENT_LENGTH) {
      setError('Enter a record within the character limit.');
      return;
    }
    try {
      options.onAdd(textarea.value);
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : 'Could not add the request.');
      return;
    }
    textarea.value = '';
    updateCounter();
    setError(null);
  });

  textarea.addEventListener('input', updateCounter);
  textarea.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  updateCounter();

  return {
    node: form,
    setError,
    clear() {
      textarea.value = '';
      updateCounter();
      setError(null);
    },
    focus() {
      textarea.focus();
    },
  };
}
