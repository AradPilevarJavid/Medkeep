export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'medkeep.theme';

export function getStoredTheme(): Theme | null {
  try {
    const value = globalThis.localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

export function getSystemTheme(): Theme {
  const matchMedia = (
    globalThis as typeof globalThis & {
      matchMedia?: (query: string) => MediaQueryList;
    }
  ).matchMedia;

  if (typeof matchMedia !== 'function') {
    return 'light';
  }

  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveTheme(): Theme {
  return getStoredTheme() ?? getSystemTheme();
}

/**
 * Apply the resolved theme without persisting, so a system preference keeps
 * following the OS until the user makes an explicit choice.
 */
export function initTheme(): Theme {
  const theme = resolveTheme();
  document.documentElement.dataset.theme = theme;
  return theme;
}

export function setTheme(theme: Theme, persist = true): void {
  document.documentElement.dataset.theme = theme;
  if (!persist) {
    return;
  }
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* a blocked storage write should not break the theme toggle */
  }
}

export function toggleTheme(): Theme {
  const next: Theme = resolveTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}
