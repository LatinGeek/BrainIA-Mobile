// Renders the glass backdrop images the app uses (the ambient light field, unblurred and at the three blur
// levels) from the same shapes, positions and theme colours as components/glass/GlassBackdrop.tsx, so they
// can be opened in an image editor and tried with effects. Output: docs/assets/backdrops/*.png
//
//   node scripts/export-backdrops.mjs            (Playwright + a Chromium-based browser required)
//
// The app draws these with Skia at runtime and stores them in its cache folder; this script is a faithful
// reproduction, not a copy of those private cache files.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const THEME = { base: '#091315', orbs: ['#1F6E78', '#24465A', '#B9E85A'], ring: '#5BB3BE' };
const SCREEN = { width: 412, height: 892 }; // dp of the test phone
const SCALE = 3; // output pixels per dp (the app renders at 0.5-0.75 and stretches; this is for editing)
const BLURS = { field: 0, thin: 8, regular: 12, strong: 18 }; // blur sigma in dp, as in GlassSurface

mkdirSync('docs/assets/backdrops', { recursive: true });
let browser;
try { browser = await chromium.launch({ channel: 'msedge' }); } catch { browser = await chromium.launch({ channel: 'chrome' }); }
const page = await browser.newPage();

for (const [name, blur] of Object.entries(BLURS)) {
  const dataUrl = await page.evaluate(({ THEME, SCREEN, SCALE, blur }) => {
    const { width: W, height: H } = SCREEN;
    const PAD = Math.ceil(blur * 3); // dp of extra canvas around the screen, so the blur has real pixels to sample at the edges
    const c = document.createElement('canvas'); c.width = (W + PAD * 2) * SCALE; c.height = (H + PAD * 2) * SCALE;
    const ctx = c.getContext('2d'); ctx.scale(SCALE, SCALE); ctx.translate(PAD, PAD);
    const rgba = (hex, a) => { const v = hex.replace('#', ''); return `rgba(${parseInt(v.slice(0, 2), 16)},${parseInt(v.slice(2, 4), 16)},${parseInt(v.slice(4, 6), 16)},${a})`; };
    const orb = (cx, cy, r, color, peak, mid) => {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, rgba(color, peak));
      if (mid !== undefined) g.addColorStop(0.55, rgba(color, mid));
      g.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    };
    ctx.fillStyle = THEME.base; ctx.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
    orb(W * 0.12, H * 0.04, 240, THEME.orbs[0], 0.55, 0.18);
    ctx.fillStyle = rgba(THEME.orbs[0], 0.16); ctx.beginPath(); ctx.arc(70, 60, 150, 0, Math.PI * 2); ctx.fill();
    orb(W * 0.92, H * 0.32, 210, THEME.orbs[1], 0.6, 0.18);
    orb(W * 0.46, H * 0.96, 200, THEME.orbs[2], 0.24);
    orb(W * 0.9, H * 0.62, 170, THEME.orbs[2], 0.14);
    orb(W * 0.04, H * 0.46, 170, THEME.orbs[0], 0.3);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H * 0.62); ctx.clip();
    ctx.strokeStyle = rgba(THEME.ring, 0.18); ctx.lineWidth = 18; ctx.beginPath(); ctx.arc(W * 1.06, -H * 0.08, 190, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    ctx.strokeStyle = rgba(THEME.ring, 0.1); ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(-W * 0.14, H * 0.74, 150, 0, Math.PI * 2); ctx.stroke();
    const src = blur <= 0 ? c : (() => {
      const o = document.createElement('canvas'); o.width = c.width; o.height = c.height;
      const oc = o.getContext('2d'); oc.filter = `blur(${blur * SCALE}px)`; oc.drawImage(c, 0, 0); return o;
    })();
    // crop the padding away
    const out = document.createElement('canvas'); out.width = W * SCALE; out.height = H * SCALE;
    out.getContext('2d').drawImage(src, PAD * SCALE, PAD * SCALE, W * SCALE, H * SCALE, 0, 0, W * SCALE, H * SCALE);
    return out.toDataURL('image/png');  }, { THEME, SCREEN, SCALE, blur });
  const file = `docs/assets/backdrops/backdrop-${name}.png`;
  writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log('wrote', file);
}
await browser.close();
