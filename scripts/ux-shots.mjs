import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const baseUrl = process.argv[2] || 'http://127.0.0.1:8093';
const outDir = process.argv[3] || 'output/audit';
mkdirSync(outDir, { recursive: true });

const shots = [
  { path: '/', label: 'home' },
  { path: '/search', label: 'search' },
  { path: '/capture', label: 'capture' },
  { path: '/financials', label: 'money' },
  { path: '/review', label: 'review' },
  { path: '/settings', label: 'settings' },
  { path: '/entity/entity_spotify', label: 'entity' },
  { path: '/insight/insight_finance', label: 'insight' },
  { path: '/digest/digest_week', label: 'digest' },
  { path: '/transaction/tx_spotify', label: 'transaction' },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
for (const { path, label } of shots) {
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${outDir}/${label}.png`, fullPage: true });
  console.log(`SHOT ${label}`);
}
await browser.close();
