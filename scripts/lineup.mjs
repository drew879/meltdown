// Lines up cut pieces side by side on one baseline, at the scale they were
// cut to, with a faint line at the top of each, so sizes can be compared by
// eye (for example, that each melt stage is shorter than the one before).
//
//   node scripts/lineup.mjs <out.png> <piece> [piece...]
//   node scripts/lineup.mjs docs/phase-1/stages.png snowman-2 snowman-3 snowman-4
//
// Pieces are names from src/paper/art-manifest.json. Add *factor to preview a
// piece scaled, e.g. snowman-3*0.94.
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

const [out, ...names] = process.argv.slice(2);
if (!out || names.length === 0) {
  console.error('usage: node scripts/lineup.mjs <out.png> <piece> [piece...]');
  process.exit(1);
}
const manifest = JSON.parse(await readFile('src/paper/art-manifest.json', 'utf8'));
const K = 0.5; // half size keeps the picture manageable
const GAP = 30;
const PAD = 40;
const LABEL = 30;

const items = names.map((arg) => {
  const [name, f = '1'] = arg.split('*');
  const size = manifest[name];
  if (!size) {
    console.error(`no piece called "${name}" in the manifest`);
    process.exit(1);
  }
  const factor = Number(f);
  return { name, factor, w: Math.round(size.w * K * factor), h: Math.round(size.h * K * factor), tall: Math.round(size.h * factor) };
});

const H = Math.max(...items.map((i) => i.h)) + PAD * 2 + LABEL;
const W = items.reduce((sum, i) => sum + i.w + GAP, GAP);
const base = H - PAD;
const layers = [];
const marks = [];
let x = GAP;
for (const i of items) {
  const input = await sharp(`public/art/${i.name}.webp`).resize(i.w, i.h).png().toBuffer();
  layers.push({ input, left: x, top: base - i.h });
  marks.push(`<line x1="0" x2="${W}" y1="${base - i.h}" y2="${base - i.h}" stroke="rgba(200,0,0,0.35)"/>`);
  const label = `${i.name}${i.factor !== 1 ? ` at ${Math.round(i.factor * 100)}%` : ''} · ${i.tall} tall`;
  marks.push(`<text x="${x + i.w / 2}" y="${H - 10}" font-size="20" font-family="sans-serif" text-anchor="middle">${label}</text>`);
  x += i.w + GAP;
}
marks.push(`<line x1="0" x2="${W}" y1="${base}" y2="${base}" stroke="#333" stroke-width="2"/>`);
const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${marks.join('')}</svg>`);

await sharp({ create: { width: W, height: H, channels: 4, background: '#a9d4e6' } })
  .composite([...layers, { input: svg, left: 0, top: 0 }])
  .png()
  .toFile(out);
console.log(`wrote ${out} (${W}x${H})`);
