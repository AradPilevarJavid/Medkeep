import { COPY } from '../copy';
import { el } from '../dom';
import type { Theme } from '../theme';

export interface TopBarOptions {
  readonly onToggleTheme: () => void;
  readonly onImport: () => void;
  readonly onExport: () => void;
}

export interface TopBar {
  readonly node: HTMLElement;
  setTheme(theme: Theme): void;
}

export function createTopBar(options: TopBarOptions): TopBar {
  const themeLabel = el('span', { class: 'theme-toggle__label', text: 'Dark theme' });
  const themeButton = el(
    'button',
    {
      class: 'button button--ghost theme-toggle',
      type: 'button',
      'aria-pressed': 'false',
      onclick: options.onToggleTheme,
    },
    el('span', { class: 'theme-toggle__glyph', 'aria-hidden': 'true' }),
    themeLabel,
  );

  const importButton = el(
    'button',
    {
      class: 'button button--ghost',
      type: 'button',
      onclick: options.onImport,
    },
    'Import',
  );

  const exportButton = el(
    'button',
    {
      class: 'button button--primary',
      type: 'button',
      onclick: options.onExport,
    },
    'Export',
  );

  const node = el(
    'header',
    { class: 'top-bar' },
    el(
      'div',
      { class: 'brand' },
      el('span', { class: 'brand__mark', 'aria-hidden': 'true' }),
      el(
        'div',
        { class: 'brand__text' },
        el('p', { class: 'brand__name', text: COPY.appName }),
        el('p', { class: 'brand__tagline', text: COPY.tagline }),
      ),
    ),
    el(
      'nav',
      { class: 'top-bar__actions', 'aria-label': 'Ledger actions' },
      themeButton,
      importButton,
      exportButton,
    ),
  );

  return {
    node,
    setTheme(theme) {
      const dark = theme === 'dark';
      themeButton.setAttribute('aria-pressed', String(dark));
    },
  };
}
