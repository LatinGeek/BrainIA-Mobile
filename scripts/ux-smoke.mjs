import { chromium } from 'playwright';

const baseUrl = process.argv[2] || process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8090';
const viewport = { width: 390, height: 844 };

const checks = [
  { path: '/', marker: 'Daily brief', label: 'home' },
  { path: '/search', marker: 'Universal retrieval', label: 'search' },
  { path: '/settings', marker: 'Appearance', label: 'settings' },
  { path: '/financials', marker: 'At a glance', label: 'financials' },
  { path: '/entity/entity_spotify', marker: 'What this is', label: 'entity' },
  { path: '/insight/insight_finance', marker: 'Key takeaways', label: 'insight' },
  { path: '/digest/digest_week', marker: 'Activity metrics', label: 'digest' },
  { path: '/transaction/tx_spotify', marker: 'Transaction summary', label: 'transaction' },
];

async function checkPage(page, path, marker, label) {
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByText(marker, { exact: false }).first().waitFor({ timeout: 120000 });
  console.log(`${label.toUpperCase()}_OK`);
}

async function checkProposalInteractions(page) {
  await page.goto(`${baseUrl}/search`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByLabel('Search BrainIA').fill('Spotify');
  await page.getByText('Transactions', { exact: false }).first().waitFor({ timeout: 120000 });
  await page.getByText('Insights', { exact: false }).first().waitFor({ timeout: 120000 });
  console.log('SEARCH_GROUPS_OK');

  await page.goto(`${baseUrl}/financials`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByRole('tab', { name: 'Year' }).click();
  await page.getByText('Annual projection', { exact: false }).first().waitFor({ timeout: 120000 });
  console.log('FINANCE_PERIODS_OK');

  await page.goto(`${baseUrl}/review`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByRole('tab', { name: /Reprocess/ }).waitFor({ timeout: 120000 });
  await page.getByRole('tab', { name: /Resolved/ }).waitFor({ timeout: 120000 });
  console.log('REVIEW_LANES_OK');
}

async function checkPreviewStates(page) {
  await page.goto(`${baseUrl}/financials?ux=empty`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByRole('tab', { name: /Transactions/ }).click();
  await page.getByText('No transactions', { exact: false }).first().waitFor({ timeout: 120000 });
  console.log('EMPTY_MONEY_OK');

  await page.goto(`${baseUrl}/review?ux=empty`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByText('Nothing here', { exact: false }).first().waitFor({ timeout: 120000 });
  console.log('EMPTY_REVIEW_OK');

  await page.goto(`${baseUrl}/financials?ux=edge`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByText('International Grocery Cooperative Downtown Branch', { exact: false }).first().waitFor({ timeout: 120000 });
  console.log('EDGE_MONEY_OK');

  await page.goto(`${baseUrl}/?ux=error`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByText('Saved view unavailable', { exact: false }).first().waitFor({ timeout: 120000 });
  console.log('ERROR_TODAY_OK');

  await page.goto(`${baseUrl}/?ux=loading`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByLabel('detail loading state').first().waitFor({ timeout: 120000 });
  console.log('LOADING_TODAY_OK');

  await page.goto(`${baseUrl}/financials?ux=loading`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByLabel('chart loading state').first().waitFor({ timeout: 120000 });
  console.log('LOADING_MONEY_OK');
}

try {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport });

  for (const check of checks) {
    await checkPage(page, check.path, check.marker, check.label);
  }

  await checkProposalInteractions(page);
  await checkPreviewStates(page);

  await browser.close();
  console.log('UX_SMOKE_OK');
} catch (error) {
  console.error(error);
  process.exit(1);
}
