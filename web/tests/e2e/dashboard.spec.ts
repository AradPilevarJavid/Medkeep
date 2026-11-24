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
