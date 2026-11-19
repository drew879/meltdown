// Screenshot helper for checking layouts by eye.
// usage: node scripts/shot.mjs <url> <out.png> [width] [height] [scale] [chromium|webkit] [selector]
import { chromium, webkit } from '@playwright/test';

const [url, out, w = '440', h = '956', scale = '3', engine = 'chromium', selector = ''] = process.argv.slice(2);
const browser = await (engine === 'webkit' ? webkit : chromium).launch();
const page = await browser.newPage({
  viewport: { width: Number(w), height: Number(h) },
  deviceScaleFactor: Number(scale),
});
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(url, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
if (selector) await page.locator(selector).screenshot({ path: out });
else await page.screenshot({ path: out, fullPage: !!process.env.FULL });
await browser.close();
if (errors.length) {
  console.error('console errors:\n' + errors.join('\n'));
  process.exitCode = 1;
}
console.log('wrote', out);
