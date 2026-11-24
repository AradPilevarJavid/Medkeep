import { beforeEach, describe, expect, it } from 'vitest';

import { getStoredTheme, initTheme, setTheme, toggleTheme } from '../../src/ui/theme';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('theme', () => {
  it('persists an explicit choice', () => {
    setTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(getStoredTheme()).toBe('dark');
  });

  it('toggles from the resolved theme', () => {
    setTheme('light');
    expect(toggleTheme()).toBe('dark');
    expect(getStoredTheme()).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('initializes without persisting a system default', () => {
    const theme = initTheme();
    expect(document.documentElement.dataset.theme).toBe(theme);
    expect(getStoredTheme()).toBeNull();
  });
});
