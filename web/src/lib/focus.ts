/**
 * Focus helpers for the native `<dialog>` confirmations.
 */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function focusableWithin(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (node) => node.offsetParent !== null || node === document.activeElement,
  );
}

export function focusFirst(root: HTMLElement): void {
  const target = focusableWithin(root)[0];
  target?.focus();
}

/**
 * Open a dialog modally and restore focus to the trigger on close.
 */
export function openDialog(dialog: HTMLDialogElement, trigger: HTMLElement | null): void {
  const returnTarget =
    trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  dialog.returnValue = '';
  dialog.showModal();
  focusFirst(dialog);
  dialog.addEventListener(
    'close',
    () => {
      returnTarget?.focus();
    },
    { once: true },
  );
}
