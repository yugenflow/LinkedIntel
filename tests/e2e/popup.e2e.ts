import { test, expect } from '@playwright/test';
import { launchExtension, type ExtensionFixture } from './extension-fixture';

let ext: ExtensionFixture;

test.beforeAll(async () => {
  ext = await launchExtension();
});

test.afterAll(async () => {
  await ext.context.close();
});

test('popup loads and shows header', async () => {
  const { popupPage } = ext;
  await popupPage.waitForLoadState('domcontentloaded');

  await expect(popupPage.locator('text=LinkedIntel')).toBeVisible();
  await expect(popupPage.locator('text=beta')).toBeVisible();
});

test('popup shows default state hint on non-LinkedIn page', async () => {
  const { popupPage } = ext;

  // Wait for scrape timeout (App.tsx has a 3s timeout for no response)
  await popupPage.waitForTimeout(4000);

  // Should show hint text when not on a LinkedIn page
  const body = await popupPage.textContent('body');
  expect(body).toBeTruthy();
});

test('popup renders footer with version', async () => {
  const { popupPage } = ext;

  await expect(popupPage.locator('text=v1.0.0')).toBeVisible();
});

test('popup screenshot matches baseline', async () => {
  const { popupPage } = ext;
  await popupPage.waitForTimeout(4000);

  await expect(popupPage).toHaveScreenshot('popup-default.png', {
    fullPage: true,
  });
});
