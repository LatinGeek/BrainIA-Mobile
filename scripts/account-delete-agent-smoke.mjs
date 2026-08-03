import { chromium } from 'playwright';

const baseUrl = process.argv[2] || process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8090';
const runtimeErrors = [];
let accountDeleted = false;
let deleteRequest;

try {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (error) => runtimeErrors.push(error));
  page.on('dialog', (dialog) => void dialog.accept());
  await page.addInitScript((apiBaseUrl) => {
    window.localStorage.setItem('brainia_mobile.baseUrl', apiBaseUrl);
  }, baseUrl);

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    if (url.pathname === '/api/v1/financial/accounts/account_delete' && method === 'DELETE') {
      deleteRequest = { headers: request.headers(), postData: request.postData() };
      accountDeleted = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ deleted: true, detachedTransactions: 0 }) });
      return;
    }
    if (url.pathname === '/api/v1/financial/accounts') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(accountDeleted ? [] : [
          { id: 'account_delete', name: 'Delete test account', type: 'bank', currency: 'UYU', color: '#2563EB', balance: '259.00' },
        ]),
      });
      return;
    }
    if (url.pathname === '/api/v1/financial/transactions') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ transactions: [] }) });
      return;
    }
    if (url.pathname === '/api/v1/insights/history' || url.pathname === '/api/v1/digests/history') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ runs: [] }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto(`${baseUrl}/financials`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByText('Accounts', { exact: true }).first().click();
  const accountRow = page.getByRole('button', { name: /Delete test account.*Expand account options/ });
  await accountRow.waitFor({ timeout: 120000 });
  await accountRow.click();
  await page.getByText('Delete account', { exact: true }).click();
  await accountRow.waitFor({ state: 'hidden', timeout: 120000 });

  if (!deleteRequest) throw new Error('The account DELETE request was not sent.');
  if (deleteRequest.postData !== null) throw new Error(`DELETE unexpectedly included a body: ${deleteRequest.postData}`);
  if ('content-type' in deleteRequest.headers) throw new Error(`Bodyless DELETE unexpectedly included content-type: ${deleteRequest.headers['content-type']}`);
  if (runtimeErrors.length) throw new Error(`Account delete runtime errors:\n${runtimeErrors.map((error) => error.stack || error.message).join('\n\n')}`);

  await browser.close();
  console.log('ACCOUNT_DELETE_AGENT_SMOKE_OK');
} catch (error) {
  console.error(error);
  process.exit(1);
}
