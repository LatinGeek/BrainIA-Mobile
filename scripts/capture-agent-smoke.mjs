import { chromium } from 'playwright';

const baseUrl = process.argv[2] || process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8090';
const runtimeErrors = [];

try {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (error) => runtimeErrors.push(error));
  await page.addInitScript((apiBaseUrl) => {
    window.localStorage.setItem('brainia_mobile.baseUrl', apiBaseUrl);
  }, baseUrl);
  await page.route('**/api/v1/financial/accounts**', async (route) => {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
    };
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify([
        { id: 'account_uyu', name: 'UYU Checking', type: 'bank', currency: 'UYU', color: '#2563EB', balance: '10000.00' },
        { id: 'account_usd', name: 'USD Credit', type: 'credit', currency: 'USD', color: '#E11D48', balance: '-250.00' },
      ]),
    });
  });
  await page.route('**/api/v1/financial/categories**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ categories: { expense: ['Inicio'], income: ['Salary'] } }),
    });
  });

  const accountsResponse = page.waitForResponse((response) => response.url().includes('/api/v1/financial/accounts') && response.request().method() === 'GET');
  const categoriesResponse = page.waitForResponse((response) => response.url().includes('/api/v1/financial/categories') && response.request().method() === 'GET');
  await page.goto(`${baseUrl}/capture`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const mockedAccountsResponse = await accountsResponse;
  const mockedAccounts = await mockedAccountsResponse.json();
  if (!Array.isArray(mockedAccounts) || mockedAccounts.length !== 2) {
    throw new Error(`Account fixture was not loaded: ${JSON.stringify(mockedAccounts)}`);
  }
  await categoriesResponse;

  await page.getByText('Captura una idea', { exact: true }).waitFor({ timeout: 120000 });
  await page.getByText('Capturar nota', { exact: true }).waitFor({ timeout: 120000 });
  await page.getByLabel('La captura de voz está disponible en Android', { exact: true }).waitFor({ timeout: 120000 });
  for (const removedLabel of ['Alert', 'Email', 'Event', 'Optional capture details']) {
    if (await page.getByText(removedLabel, { exact: true }).count()) {
      throw new Error(`${removedLabel} unexpectedly rendered in the note capture flow.`);
    }
  }

  await page.getByText('Dinero', { exact: true }).first().click();
  await page.getByText('Transferir', { exact: true }).first().click();
  await page.getByLabel('Monto de origen de la transferencia', { exact: true }).waitFor({ timeout: 120000 });
  await page.getByText('Cuenta de origen', { exact: true }).waitFor({ timeout: 120000 });
  await page.getByText('Cuenta destino', { exact: true }).waitFor({ timeout: 120000 });

  if (await page.getByText('Categoría', { exact: true }).count()) {
    throw new Error('Transfer mode unexpectedly rendered the transaction category selector.');
  }
  if (await page.getByText('Merchant or payee', { exact: true }).count()) {
    throw new Error('Transfer mode unexpectedly rendered the merchant input.');
  }

  await page.getByLabel('Monto de origen de la transferencia', { exact: true }).fill('1250.50');
  await page.getByText('Guardar transferencia', { exact: true }).click();
  await page.getByText('Elegí la cuenta desde la que sale la transferencia.', { exact: true }).waitFor({ timeout: 120000 });
  await page.getByText('Reintentar', { exact: true }).click();

  await page.getByText('Cuenta de origen', { exact: true }).click();
  await page.getByText('UYU Checking', { exact: true }).click();
  await page.getByText('Cuenta destino', { exact: true }).click();
  await page.getByText('USD Credit', { exact: true }).click();
  await page.getByLabel('Monto de origen de la transferencia', { exact: true }).fill('4000');
  await page.getByLabel('Monto de destino de la transferencia').fill('100');
  await page.getByText('1 UYU = 0.025 USD', { exact: true }).waitFor({ timeout: 120000 });

  if (runtimeErrors.length) {
    throw new Error(`Capture runtime errors:\n${runtimeErrors.map((error) => error.stack || error.message).join('\n\n')}`);
  }

  await browser.close();
  console.log('CAPTURE_TRANSFER_AGENT_SMOKE_OK');
} catch (error) {
  console.error(error);
  process.exit(1);
}
