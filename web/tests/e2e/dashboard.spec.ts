import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('queue, verify, export and import a ledger', async ({ page }) => {
  await page.goto('/');
  const input = page.getByLabel('New medical record');
  await input.fill('First fictional record');
  await page.getByRole('button', { name: 'Add to queue' }).click();
  await page.getByRole('button', { name: 'Process next' }).click();
  await input.fill('Second fictional record');
  await page.getByRole('button', { name: 'Add to queue' }).click();
  await page.getByRole('button', { name: 'Process all' }).click();
  await page.getByRole('button', { name: 'Verify now' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const download = await downloadPromise;
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await page.getByLabel('MedKeep archive file').setInputFiles(await download.path());
  await page.getByRole('button', { name: 'Replace ledger' }).click();
  await expect(page.getByText('Second fictional record').first()).toBeVisible();
});

test('theme persists and both themes pass accessibility checks', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  for (const theme of ['light', 'dark']) {
    if ((await page.locator('html').getAttribute('data-theme')) !== theme) {
      await page.getByRole('button', { name: /theme/i }).click();
    }
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  }
});

test('loads demo data only after confirmation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Load demo data' }).click();
  const dialog = page.getByRole('dialog', { name: 'Load demo data?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Load demo data' }).click();
  await expect(page.getByText('Demo data loaded.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Process next' })).toBeEnabled();
});

test('supports keyboard entry and reflows at 320 pixels', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: /skip/i })).toBeFocused();
  await page.keyboard.press('Enter');
  const input = page.getByLabel('New medical record');
  await input.focus();
  await page.keyboard.type('Fictional keyboard record');
  await page.keyboard.press('Control+Enter');
  await expect(page.getByText('Fictional keyboard record')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('reports invalid imports without replacing the ledger', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('New medical record').fill('Keep this request');
  await page.getByRole('button', { name: 'Add to queue' }).click();
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import archive' });
  await page.getByLabel('MedKeep archive file').setInputFiles({
    name: 'invalid.db',
    mimeType: 'text/plain',
    buffer: Buffer.from('invalid archive'),
  });
  await dialog.getByRole('button', { name: 'Replace ledger' }).click();
  await expect(dialog.getByRole('alert')).toContainText('invalid');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByText('Keep this request')).toBeVisible();
});

test('allows clearing corrupt saved data', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('medkeep.dashboard.v1', '{invalid');
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Clear all data' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Clear all data' }).click();
  expect(await page.evaluate(() => localStorage.getItem('medkeep.dashboard.v1'))).toBeNull();
});
