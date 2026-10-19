import { chromium } from 'playwright';

const baseUrl = process.argv[2] || process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8090';
const viewport = { width: 390, height: 844 };
const runtimeErrors = [];

async function openReview(browser, state) {
  const page = await browser.newPage({ viewport });
  page.on('pageerror', (error) => runtimeErrors.push(error));
  await page.goto(`${baseUrl}/review?ux=${state}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  return page;
}

try {
  const browser = await chromium.launch({ headless: true });

  const loadingPage = await openReview(browser, 'loading');
  await loadingPage.getByLabel('card loading state').first().waitFor({ timeout: 120000 });
  await loadingPage.close();
  console.log('REVIEW_LOADING_OK');

  const emptyPage = await openReview(browser, 'empty');
  await emptyPage.getByText('All clear', { exact: true }).first().waitFor({ timeout: 120000 });
  await emptyPage.close();
  console.log('REVIEW_EMPTY_OK');

  const reviewPage = await openReview(browser, 'edge');
  await reviewPage.getByText('Continue ·', { exact: false }).first().waitFor({ timeout: 120000 });
  await reviewPage.getByText('Continue ·', { exact: false }).first().click();
  await reviewPage.getByText('ACCEPT', { exact: true }).first().waitFor({ timeout: 120000 });

  // Accept with a tap, then undo from the toast.
  await reviewPage.getByRole('button', { name: 'Accept', exact: true }).first().click();
  await reviewPage.getByRole('button', { name: 'Undo', exact: true }).first().waitFor({ timeout: 60000 });
  await reviewPage.getByRole('button', { name: 'Undo', exact: true }).first().click();
  console.log('REVIEW_ACCEPT_UNDO_OK');

  // Skip with the keyboard, then accept the remaining cards with keys.
  await reviewPage.keyboard.press('ArrowLeft');
  await reviewPage.waitForTimeout(400);
  await reviewPage.keyboard.press('Enter');
  await reviewPage.waitForTimeout(600);
  await reviewPage.keyboard.press('Enter');
  await reviewPage.getByText(/Nice work|All clear/).first().waitFor({ timeout: 60000 });
  console.log('REVIEW_KEYBOARD_OK');

  await reviewPage.getByRole('button', { name: 'Done', exact: true }).first().click();
  await reviewPage.getByText('Continue ·', { exact: false }).first().waitFor({ timeout: 60000 });
  await reviewPage.close();
  console.log('REVIEW_SUMMARY_OK');

  if (runtimeErrors.length) {
    throw new Error(`Review runtime errors:\n${runtimeErrors.map((error) => error.stack || error.message).join('\n\n')}`);
  }

  await browser.close();
  console.log('REVIEW_AGENT_SMOKE_OK');
} catch (error) {
  console.error(error);
  process.exit(1);
}
