import { chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ExtensionFixture {
  context: BrowserContext;
  extensionId: string;
  popupPage: Page;
}

/**
 * Launch Chrome with the built LinkedIntel extension loaded.
 * Uses --headless=new which supports MV3 extensions.
 * Requires `npm run build` to have been run first (dist/ must exist).
 */
export async function launchExtension(): Promise<ExtensionFixture> {
  const extensionPath = path.resolve(__dirname, '../../dist');

  // Must use launchPersistentContext — regular newContext() cannot load extensions
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    channel: 'chromium',
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--headless=new',
    ],
  });

  // Get extension ID from the service worker URL
  let serviceWorker;
  if (context.serviceWorkers().length > 0) {
    serviceWorker = context.serviceWorkers()[0];
  } else {
    serviceWorker = await context.waitForEvent('serviceworker');
  }
  const extensionId = serviceWorker.url().split('/')[2];

  // Open popup as a regular page
  const popupPage = await context.newPage();
  await popupPage.goto(`chrome-extension://${extensionId}/popup/index.html`);

  return { context, extensionId, popupPage };
}
