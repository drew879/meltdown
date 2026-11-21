// Frame strips of the melt preview (melt.html), for reading the options without
// playing them: one strip per miss beat and per loss, frames left to right.
// Needs the dev server running.
//
//   node scripts/strip-melt.mjs [out-dir] [webkit|chromium]
import { chromium, webkit } from '@playwright/test';
import sharp from 'sharp';

const out = process.argv[2] ?? 'docs/phase-2/melt';
const engine = process.argv[3] ?? 'webkit';
const base = process.env.MELTDOWN_URL ?? 'http://localhost:5173/meltdown/';
const W = 393;
const H = 520;
const SCALE = 2;
const THUMB = 0.5; // each frame in the strip, as a share of the screenshot

const MISS = ['flare', 'slump', 'beam'];
const LOSS = ['sploosh', 'hat', 'sink'];
// a miss on Normal (2 of 6 misses: stage 1 to 3, one stage skipped) and the loss from Normal
const missTimes = [0, 140, 300, 420, 520, 600, 700, 820, 960, 1150];
const lossTimes = {
  sploosh: [0, 200, 420, 550, 650, 760, 880, 1000, 1200, 1500, 2150, 2900],
  hat: [0, 250, 390, 520, 800, 1000, 1350, 1560, 1660, 1740, 1850, 2500],
  sink: [0, 300, 500, 800, 1100, 1400, 1700, 1800, 2160, 2300, 2620, 3100],
};

const browser = await (engine === 'webkit' ? webkit : chromium).launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`${base}melt.html?bare=1`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.getElementById('pp')?.dataset.ready === '1');
await page.addStyleTag({ content: '.mp-sun-img, .mp-body-img { animation: none !important; }' });

async function shoot(o) {
  await page.evaluate((o) => window.meltAt(o), o);
  await page.waitForTimeout(60);
  return page.screenshot({ clip: { x: 0, y: 0, width: W, height: H } });
}

async function strip(file, frames, title) {
  const tw = Math.round(W * SCALE * THUMB);
  const th = Math.round(H * SCALE * THUMB);
  const gap = 8;
  const label = 26;
  const perRow = 6;
  const rows = Math.ceil(frames.length / perRow);
  const width = perRow * tw + (perRow + 1) * gap;
  const height = 44 + rows * (th + label + gap) + gap;
  const comps = [];
  const svg = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><style>text{font:600 20px -apple-system,Helvetica,sans-serif;fill:#3a3531}</style><text x="${gap}" y="30" style="font-size:24px;font-weight:800">${title}</text>`];
  for (let i = 0; i < frames.length; i++) {
    const r = Math.floor(i / perRow);
    const c = i % perRow;
    const x = gap + c * (tw + gap);
    const y = 44 + r * (th + label + gap);
    comps.push({ input: await sharp(frames[i].png).resize(tw, th).png().toBuffer(), left: x, top: y });
    svg.push(`<text x="${x + 4}" y="${y + th + 20}">${frames[i].label}</text>`);
  }
  svg.push('</svg>');
  await sharp({ create: { width, height, channels: 4, background: '#efe7d4' } })
    .composite([{ input: Buffer.from(svg.join('')), left: 0, top: 0 }, ...comps])
    .flatten({ background: '#efe7d4' })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(file);
  console.log('wrote', file);
}

const names = { flare: 'a-flare', slump: 'b-slump', beam: 'c-sunbeam', sploosh: 'a-sploosh', hat: 'b-hat-left-hanging', sink: 'c-sink-and-bloop' };
for (const miss of MISS) {
  const frames = [];
  for (const t of missTimes) frames.push({ label: `${t} ms`, png: await shoot({ diff: 'normal', miss, loss: 'sploosh', misses: 2, kind: 'miss', t }) });
  await strip(`${out}/miss-${names[miss]}.jpg`, frames, `Wrong guess, option ${names[miss]}: Normal, 2nd miss (stage 1 to 3)`);
}
for (const loss of LOSS) {
  const frames = [];
  for (const t of lossTimes[loss]) frames.push({ label: `${t} ms`, png: await shoot({ diff: 'normal', miss: 'flare', loss, misses: 6, kind: 'loss', t }) });
  await strip(`${out}/loss-${names[loss]}.jpg`, frames, `Loss, option ${names[loss]}: Normal, from stage 7`);
}
// every difficulty end to end with option A, the stage each miss lands on
for (const [diff, n] of [['easy', 8], ['normal', 6], ['hard', 4]]) {
  const frames = [];
  for (let m = 0; m < n; m++) frames.push({ label: `${m} missed`, png: await shoot({ diff, miss: 'flare', loss: 'sploosh', misses: Math.max(1, m), kind: 'miss', t: m === 0 ? -1 : 99999 }) });
  frames.push({ label: `${n} missed (rest)`, png: await shoot({ diff, miss: 'flare', loss: 'sploosh', misses: n, kind: 'loss', t: 9000 }) });
  await strip(`${out}/stages-${diff}.jpg`, frames, `${diff}: where each miss lands`);
}
await browser.close();
if (errors.length) {
  console.error('console errors:\n' + errors.join('\n'));
  process.exitCode = 1;
}
