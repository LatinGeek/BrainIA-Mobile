import { chromium } from 'playwright';

const baseUrl = process.argv[2] || process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8090';
const viewport = { width: 390, height: 844 };

const checks = [
  { path: '/', marker: 'Tu día, en perspectiva', label: 'home' },
  { path: '/search', marker: 'Descubrir', label: 'search' },
  { path: '/settings', marker: 'Tipo de cambio de referencia', label: 'settings' },
  { path: '/financials', marker: 'Dinero', label: 'financials' },
  { path: '/entity/entity_spotify', marker: 'Spotify', label: 'entity' },
  { path: '/insight/insight_finance', marker: 'Conclusión clara', label: 'insight' },
  { path: '/digest/digest_week', marker: 'Resumen del período', label: 'digest' },
  { path: '/transaction/tx_spotify', marker: 'Movimiento de dinero', label: 'transaction' },
];

async function checkPage(page, path, marker, label) {
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'commit', timeout: 120000 });
  await page.getByText(marker, { exact: false }).first().waitFor({ timeout: 120000 });
  console.log(`${label.toUpperCase()}_OK`);
}

async function checkReviewDraft(page, navigate = true) {
  if (navigate) {
    await page.goto(`${baseUrl}/review?ux=edge`, { waitUntil: 'commit', timeout: 120000 });
  }
  await page.getByText('Continue ·', { exact: false }).first().waitFor({ timeout: 120000 });
  await page.getByText('Continue ·', { exact: false }).first().click();
  await page.getByText('ACCEPT', { exact: true }).first().waitFor({ timeout: 120000 });
  await page.keyboard.press('Escape');
  await page.getByText('Continue ·', { exact: false }).first().waitFor({ timeout: 120000 });
  console.log('REVIEW_SESSION_OK');
}

async function checkProposalInteractions(page) {
  await page.goto(`${baseUrl}/search`, { waitUntil: 'commit', timeout: 120000 });
  const searchInput = page.getByLabel('Busca en tu mapa de conocimiento');
  await searchInput.fill('Spotify');
  if (await searchInput.inputValue() !== 'Spotify') throw new Error('Search did not preserve the entered query.');
  await page.getByText('Resultados agrupados', { exact: false }).first().waitFor({ timeout: 120000 });
  console.log('SEARCH_INPUT_OK');

  await page.goto(`${baseUrl}/financials?ux=edge`, { waitUntil: 'commit', timeout: 120000 });
  await page.getByRole('radio', { name: 'Período financiero: Año' }).click();
  await page.getByText('Proyección anual', { exact: false }).first().waitFor({ timeout: 120000 });
  console.log('FINANCE_PERIODS_OK');

  await page.goto(`${baseUrl}/review?ux=edge`, { waitUntil: 'commit', timeout: 120000 });
  await page.getByText('Continue ·', { exact: false }).first().waitFor({ timeout: 120000 });
  await page.getByText('This week', { exact: true }).first().waitFor({ timeout: 120000 });
  console.log('REVIEW_LANES_OK');

  await page.goto(`${baseUrl}/insight/insight_spotify?ux=edge`, { waitUntil: 'commit', timeout: 120000 });
  await page.getByText('Perspectiva asistida', { exact: false }).first().waitFor({ timeout: 120000 });
  await page.getByText('Fuentes de respaldo', { exact: false }).first().waitFor({ timeout: 120000 });
  console.log('TRUST_EVIDENCE_OK');
}

async function checkPreviewStates(page) {
  await page.goto(`${baseUrl}/financials?ux=empty`, { waitUntil: 'commit', timeout: 120000 });
  await page.getByRole('tab', { name: /Movimientos/ }).click();
  await page.getByText('Sin movimientos', { exact: false }).first().waitFor({ timeout: 120000 });
  console.log('EMPTY_MONEY_OK');

  await page.goto(`${baseUrl}/review?ux=empty`, { waitUntil: 'commit', timeout: 120000 });
  await page.getByText('All clear', { exact: true }).first().waitFor({ timeout: 120000 });
  console.log('EMPTY_REVIEW_OK');

  await page.goto(`${baseUrl}/review?ux=loading`, { waitUntil: 'commit', timeout: 120000 });
  await page.getByLabel('card loading state').first().waitFor({ timeout: 120000 });
  console.log('LOADING_REVIEW_OK');

  await page.goto(`${baseUrl}/financials?ux=edge`, { waitUntil: 'commit', timeout: 120000 });
  await page.getByText('International Grocery Cooperative Downtown Branch', { exact: false }).first().waitFor({ timeout: 120000 });
  console.log('EDGE_MONEY_OK');

  await page.goto(`${baseUrl}/?ux=error`, { waitUntil: 'commit', timeout: 120000 });
  await page.getByText('Datos en vivo no disponibles', { exact: false }).first().waitFor({ timeout: 120000 });
  console.log('ERROR_TODAY_OK');

  await page.goto(`${baseUrl}/?ux=loading`, { waitUntil: 'commit', timeout: 120000 });
  await page.getByLabel('detail loading state').first().waitFor({ timeout: 120000 });
  console.log('LOADING_TODAY_OK');

  await page.goto(`${baseUrl}/financials?ux=loading`, { waitUntil: 'commit', timeout: 120000 });
  await page.getByLabel('chart loading state').first().waitFor({ timeout: 120000 });
  console.log('LOADING_MONEY_OK');
}

try {
  const browser = await chromium.launch({ headless: true });
  const runtimeErrors = [];
  const createPage = async () => {
    const nextPage = await browser.newPage({ viewport });
    nextPage.on('pageerror', (error) => runtimeErrors.push(error));
    return nextPage;
  };
  let page = await createPage();

  for (const check of checks) {
    await checkPage(page, check.path, check.marker, check.label);
  }

  await checkProposalInteractions(page);
  await checkReviewDraft(page);
  await page.close();
  page = await createPage();
  await checkPreviewStates(page);

  if (runtimeErrors.length) {
    throw new Error(`Browser runtime errors:\n${runtimeErrors.map((error) => error.stack || error.message).join('\n\n')}`);
  }

  await browser.close();
  console.log('UX_SMOKE_OK');
} catch (error) {
  console.error(error);
  process.exit(1);
}
