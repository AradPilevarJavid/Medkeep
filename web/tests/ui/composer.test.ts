import { afterEach, describe, expect, it, vi } from 'vitest';

import { createComposer } from '../../src/ui/components/composer';

function submit(form: HTMLElement): void {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('composer', () => {
  it('adds content and clears the field', () => {
    const onAdd = vi.fn();
    const composer = createComposer({ onAdd });
    document.body.append(composer.node);

    const textarea = composer.node.querySelector('textarea')!;
    textarea.value = 'Patient: Test';
    submit(composer.node);

    expect(onAdd).toHaveBeenCalledWith('Patient: Test');
    expect(textarea.value).toBe('');
  });

  it('shows an inline error when adding fails', () => {
    const onAdd = vi.fn((): void => {
      throw new Error('Enter a record before adding it to the queue.');
    });
    const composer = createComposer({ onAdd });
    document.body.append(composer.node);

    const textarea = composer.node.querySelector('textarea')!;
    textarea.value = ' ';
    submit(composer.node);

    const error = composer.node.querySelector<HTMLElement>('.field-error')!;
    expect(error.hidden).toBe(false);
    expect(error.textContent).toMatch(/Enter a record/);
    expect(textarea.getAttribute('aria-invalid')).toBe('true');
    expect(textarea.value).toBe(' ');
  });

  it('updates the character counter', () => {
    const composer = createComposer({ onAdd: vi.fn() });
    const textarea = composer.node.querySelector('textarea')!;

    textarea.value = 'abcd';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    expect(composer.node.querySelector('.composer__counter')?.textContent).toBe('4 / 20,000');
  });
});
