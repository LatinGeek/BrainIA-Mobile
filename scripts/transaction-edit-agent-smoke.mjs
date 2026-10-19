import { chromium } from 'playwright';

const baseUrl = process.argv[2] || process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8090';
const runtimeErrors = [];
let savedPayload;

try {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (error) => runtimeErrors.push(error));
  await page.addInitScript((apiBaseUrl) => {
    window.localStorage.setItem('brainia_mobile.baseUrl', apiBaseUrl);
  }, baseUrl);

  await page.route('**/api/v1/financial/accounts**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'account_uyu', name: 'UYU Checking', type: 'bank', currency: 'UYU', color: '#2563EB', balance: '10000.00' },
        { id: 'account_usd', name: 'USD Credit', type: 'credit', currency: 'USD', color: '#E11D48', balance: '-250.00' },
      ]),
    });
  });
  await page.route('**/api/v1/financial/categories**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ categories: { expense: ['Inicio'], income: ['Salary'] } }) });
  });
  await page.route('**/api/v1/entities/aliases**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('**/api/v1/financial/transactions/tx_long_category', async (route) => {
    if (route.request().method() !== 'PATCH') {
      await route.continue();
      return;
    }
    savedPayload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'tx_long_category', merchantLabel: 'Card payment', amount: '4000.00', currency: 'UYU', kind: 'transfer',
        accountId: 'account_uyu', account: 'UYU Checking', destinationAccountId: 'account_usd', destinationAccount: 'USD Credit',
        destinationAmount: '100.00', destinationCurrency: 'USD', evidence: [],
      }),
    });
  });

  await page.goto(`${baseUrl}/transaction/tx_reclassify?ux=edge`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const editButton = page.getByText('Editar categoría y cuenta', { exact: true });
  await editButton.waitFor({ timeout: 120000 });
  await page.waitForTimeout(250);
  const accountsResponse = page.waitForResponse((response) => response.url().includes('/api/v1/financial/accounts') && response.request().method() === 'GET');
  const categoriesResponse = page.waitForResponse((response) => response.url().includes('/api/v1/financial/categories') && response.request().method() === 'GET');
  await editButton.click();
  await Promise.all([accountsResponse, categoriesResponse]);
  await page.getByText('Tipo de movimiento', { exact: true }).waitFor({ timeout: 120000 });
  await page.getByText('Transfer', { exact: true }).filter({ visible: true }).first().click();
  await page.getByText('From currency', { exact: true }).waitFor();
  await page.locator('[role="tab"][aria-label="UYU"]:visible').first().click();
  await page.getByText('UYU Checking', { exact: true }).filter({ visible: true }).first().click();
  await page.getByText('Moneda de destino', { exact: true }).waitFor();
  await page.locator('[role="tab"][aria-label="USD"]:visible').last().click();
  await page.getByText('USD Credit', { exact: true }).filter({ visible: true }).first().click();
  await page.getByLabel('Monto de destino editado', { exact: true }).fill('100');
  await page.getByText('Guardar', { exact: true }).click();
  await page.getByText('Tipo de movimiento', { exact: true }).waitFor({ state: 'hidden', timeout: 120000 });

  if (savedPayload?.kind !== 'transfer'
    || savedPayload.accountId !== 'account_uyu'
    || savedPayload.destinationAccountId !== 'account_usd'
    || savedPayload.destinationAmount !== 100
    || savedPayload.destinationCurrency !== 'USD') {
    throw new Error(`Incorrect transfer reclassification payload: ${JSON.stringify(savedPayload)}`);
  }
  if (runtimeErrors.length) {
    throw new Error(`Transaction editor runtime errors:\n${runtimeErrors.map((error) => error.stack || error.message).join('\n\n')}`);
  }

  await browser.close();
  console.log('TRANSACTION_RECLASSIFICATION_AGENT_SMOKE_OK');
} catch (error) {
  console.error(error);
  process.exit(1);
}
