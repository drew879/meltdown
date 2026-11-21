// Frame strips of the melt in the real game, for reading it without playing:
// a wrong guess at each difficulty, and the loss from Normal (stage 7) and Hard
// (stage 6). The page's clock is driven by hand, so each frame is taken at an
// exact moment after the guess. Needs the dev server running.
//
//   node scripts/melt-frames.mjs [out-dir] [width] [height]
import { webkit } from '@playwright/test';
import sharp from 'sharp';

const out = process.argv[2] ?? 'docs/phase-2/melt';
const W = Number(process.argv[3] ?? 393);
const H = Number(process.argv[4] ?? 852);
const base = process.env.MELTDOWN_URL ?? 'http://localhost:5173/meltdown/';
const SCALE = 2;
const THUMB = 0.5;

const missTimes = [0, 130, 250, 370, 460, 540, 620, 700, 820, 960, 1100, 1400];
const lossTimes = [0, 130, 250, 370, 480, 580, 820, 1010, 1100, 1510, 1590, 1670, 1740, 1870, 2000, 2400, 3050, 3700];
const RUNS = [
  { file: 'game-miss-easy', title: 'Wrong guess on Easy: the 4th of 8 (stage 3 to 4)', query: 'limit=8&g=XQZ', key: 'J', times: missTimes },
  { file: 'game-miss-normal', title: 'Wrong guess on Normal: the 2nd of 6 (stage 1 to 3)', query: 'limit=6&g=X', key: 'Q', times: missTimes },
  { file: 'game-miss-hard', title: 'Wrong guess on Hard: the 3rd of 4 (stage 4 to 6)', query: 'limit=4&g=XQ', key: 'Z', times: missTimes },
  { file: 'game-loss-normal', title: 'The loss on Normal: the hat left hanging, from stage 7', query: 'limit=6&g=XQZJK', key: 'W', times: lossTimes },
  { file: 'game-loss-hard', title: 'The loss on Hard: from stage 6', query: 'limit=4&g=XQZ', key: 'W', times: lossTimes },
];

const browser = await webkit.launch();
const errors = [];

async function strip(file, frames, title) {
  const cropH = Math.round(H * 0.72); // the scene and the sign; the keys add nothing
  const tw = Math.round(W * SCALE * THUMB);
  const th = Math.round(cropH * SCALE * THUMB);
  const gap = 8;
  const label = 26;
  const perRow = 6;
  const rows = Math.ceil(frames.length / perRow);
  const width = perRow * tw + (perRow + 1) * gap;
  const height = 44 + rows * (th + label + gap) + gap;
  const comps = [];
  const svg = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><style>text{font:600 20px -apple-system,Helvetica,sans-serif;fill:#3a3531}</style><text x="${gap}" y="30" style="font-size:24px;font-weight:800">${title}</text>`];
  for (const [i, frame] of frames.entries()) {
    const x = gap + (i % perRow) * (tw + gap);
    const y = 44 + Math.floor(i / perRow) * (th + label + gap);
    comps.push({ input: await sharp(frame.png).extract({ left: 0, top: 0, width: W * SCALE, height: cropH * SCALE }).resize(tw, th).png().toBuffer(), left: x, top: y });
    svg.push(`<text x="${x + 4}" y="${y + th + 20}">${frame.label}</text>`);
  }
  svg.push('</svg>');
  await sharp({ create: { width, height, channels: 4, background: '#efe7d4' } })
    .composite([{ input: Buffer.from(svg.join('')), left: 0, top: 0 }, ...comps])
    .flatten({ background: '#efe7d4' })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(file);
  console.log('wrote', file);
}

for (const run of RUNS) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE });
  page.on('console', (m) => m.type() === 'error' && errors.push(`${run.file}: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`${run.file}: ${e}`));
  await page.clock.install();
  await page.goto(`${base}?a=Polar%20Bear&c=Animal&${run.query}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.clock.runFor(1500); // let the pictures load and the screen settle
  await page.waitForFunction(() => [...document.querySelectorAll('.pp-melt img')].every((i) => i.complete));
  await page.clock.runFor(300);
  // idle wobbles would differ from frame to frame; hold them still
  await page.addStyleTag({ content: '.pp-snowman, .pp-sun { animation: none !important; }' });
  // from here the clock only moves when it is told to
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 500));
  await page.keyboard.press(run.key);
  const frames = [];
  let now = 0;
  for (const t of run.times) {
    if (t > now) await page.clock.runFor(t - now);
    now = Math.max(now, t);
    await page.waitForTimeout(60); // real time, for the frame to reach the screen before it is photographed
    frames.push({ label: `${t} ms`, png: await page.screenshot() });
  }
  await strip(`${out}/${run.file}.jpg`, frames, run.title);
  await page.close();
}
await browser.close();
if (errors.length) {
  console.error('console errors:\n' + errors.join('\n'));
  process.exitCode = 1;
}
