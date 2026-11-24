import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createToastRegion } from '../../src/ui/toast';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('toast region', () => {
  it('uses a status role for success and an alert role for errors', () => {
    const region = createToastRegion();
    document.body.append(region.node);

    region.show('Saved', 'success');
    region.show('Failed', 'error');

    const toasts = region.node.querySelectorAll('.toast');
    expect(toasts[0]?.getAttribute('role')).toBe('status');
    expect(toasts[1]?.getAttribute('role')).toBe('alert');
    expect(toasts[0]?.textContent).toContain('Saved');
    expect(toasts[1]?.textContent).toContain('Failed');
  });

  it('dismisses after the timeout', () => {
    const region = createToastRegion();
    document.body.append(region.node);
    region.show('Saved', 'info');

    vi.advanceTimersByTime(4300);
    vi.advanceTimersByTime(200);

    expect(region.node.querySelectorAll('.toast')).toHaveLength(0);
  });
});
