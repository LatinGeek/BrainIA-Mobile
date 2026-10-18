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
  await emptyPage.getByText('Todo al día', { exact: true }).first().waitFor({ timeout: 120000 });
  await emptyPage.close();
  console.log('REVIEW_EMPTY_OK');

  const reviewPage = await openReview(browser, 'edge');
  await reviewPage.getByText('Pendientes', { exact: true }).first().waitFor({ timeout: 120000 });
  await reviewPage.getByText('Historial', { exact: true }).first().waitFor({ timeout: 120000 });
  await reviewPage.getByRole('button', { name: 'Revisar ahora' }).first().click();
  const input = reviewPage.getByLabel('Nombre principal');
  await input.waitFor({ timeout: 120000 });
  await input.fill('');
  await reviewPage.waitForTimeout(400);
  if (await input.inputValue() !== '') {
    throw new Error('Review friendly name repopulated after being intentionally cleared.');
  }
  await input.fill('La Casa Azul');
  await reviewPage.waitForTimeout(400);
  if (await input.inputValue() !== 'La Casa Azul') {
    throw new Error('Review friendly name did not preserve the user-entered draft.');
  }
  await reviewPage.getByText('Posibles coincidencias existentes', { exact: false }).first().waitFor({ timeout: 120000 });
  await reviewPage.close();
  console.log('REVIEW_EDITING_OK');

  if (runtimeErrors.length) {
    throw new Error(`Review runtime errors:\n${runtimeErrors.map((error) => error.stack || error.message).join('\n\n')}`);
  }

  await browser.close();
  console.log('REVIEW_AGENT_SMOKE_OK');
} catch (error) {
  console.error(error);
  process.exit(1);
}
