import { openDialog } from '../../lib/focus';
import { COPY } from '../copy';
import { el } from '../dom';

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export interface ImportOptions {
  readonly onImport: (text: string) => void;
}

export interface ImportDialog {
  readonly node: HTMLDialogElement;
  open(trigger: HTMLElement | null): void;
}

export function createImportDialog(options: ImportOptions): ImportDialog {
  const dialog = el('dialog', { class: 'dialog', 'aria-labelledby': 'import-title' });

  const fileInput = el('input', {
    id: 'import-file',
    class: 'field-input',
    type: 'file',
    accept: '.db,.txt,text/plain',
    'aria-describedby': 'import-error',
  });
  const error = el('p', { id: 'import-error', class: 'field-error', role: 'alert', hidden: true });

  const cancel = el(
    'button',
    {
      class: 'button button--ghost',
      type: 'button',
      onclick: () => {
        dialog.close('cancel');
      },
    },
    'Cancel',
  );
  const submit = el(
    'button',
    { class: 'button button--primary', type: 'submit' },
    'Replace ledger',
  );

  const form = el(
    'form',
    { class: 'dialog__form' },
    el('h2', { id: 'import-title', class: 'dialog__title', text: 'Import archive' }),
    el('p', { class: 'dialog__body', text: COPY.importWarning }),
    el('label', { class: 'field-label', for: 'import-file', text: 'MedKeep archive file' }),
    fileInput,
    error,
    el('div', { class: 'dialog__actions' }, cancel, submit),
  );
  dialog.append(form);

  function showError(message: string): void {
    error.hidden = false;
    error.textContent = message;
    fileInput.setAttribute('aria-invalid', 'true');
  }

  async function submitFile(): Promise<void> {
    error.hidden = true;
    error.textContent = '';
    fileInput.removeAttribute('aria-invalid');

    const file = fileInput.files?.[0];
    if (!file) {
      showError('Choose a MedKeep archive file to import.');
      return;
    }
    if (file.size > MAX_IMPORT_BYTES) {
      showError('That file is too large to be a MedKeep archive.');
      return;
    }

    let text: string;
    try {
      text = await file.text();
    } catch {
      showError('The selected file could not be read.');
      return;
    }

    try {
      options.onImport(text);
    } catch (thrown) {
      showError(thrown instanceof Error ? thrown.message : 'The archive could not be imported.');
      return;
    }

    dialog.close('imported');
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void submitFile();
  });

  return {
    node: dialog,
    open(trigger) {
      error.hidden = true;
      error.textContent = '';
      fileInput.removeAttribute('aria-invalid');
      fileInput.value = '';
      openDialog(dialog, trigger);
    },
  };
}

export type ConfirmTone = 'primary' | 'danger';

export interface ConfirmOptions {
  readonly title: string;
  readonly body: string;
  readonly confirmLabel: string;
  readonly tone?: ConfirmTone;
  readonly onConfirm: () => void;
}

export interface ConfirmDialog {
  readonly node: HTMLDialogElement;
  open(options: ConfirmOptions, trigger: HTMLElement | null): void;
}

export function createConfirmDialog(): ConfirmDialog {
  const dialog = el('dialog', { class: 'dialog', 'aria-labelledby': 'confirm-title' });
  let current: ConfirmOptions | null = null;

  const title = el('h2', { id: 'confirm-title', class: 'dialog__title' });
  const body = el('p', { class: 'dialog__body' });
  const cancel = el(
    'button',
    {
      class: 'button button--ghost',
      type: 'button',
      onclick: () => {
        dialog.close('cancel');
      },
    },
    'Cancel',
  );
  const confirm = el('button', { class: 'button button--primary', type: 'submit' }, 'Confirm');

  const form = el(
    'form',
    { class: 'dialog__form' },
    title,
    body,
    el('div', { class: 'dialog__actions' }, cancel, confirm),
  );
  dialog.append(form);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const options = current;
    dialog.close('confirmed');
    options?.onConfirm();
  });

  return {
    node: dialog,
    open(options, trigger) {
      current = options;
      title.textContent = options.title;
      body.textContent = options.body;
      confirm.textContent = options.confirmLabel;
      confirm.className = `button ${options.tone === 'danger' ? 'button--danger' : 'button--primary'}`;
      openDialog(dialog, trigger);
    },
  };
}
