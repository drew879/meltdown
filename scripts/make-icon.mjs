// Makes the Home Screen icon files from one master picture.
//
//   node scripts/make-icon.mjs               resize art/icon/icon-master.png into public/
//   node scripts/make-icon.mjs --from-sheet  cut the master again from the round 2 concept
//                                            sheet (needs the local original, which is not
//                                            in git: art/concepts/round-2/originals/5-app-icons.png)
//
// The icon is the top left tile of that sheet: the snowman's nervous face (chosen 2026-11-19).
// iOS wants a square with no transparency and no rounded corners, because it rounds the
// corners itself, so the master is the tile with its corners filled out to a full square.

import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHEET = resolve(root, 'art/concepts/round-2/originals/5-app-icons.png');
const MASTER = resolve(root, 'art/icon/icon-master.png');

/** Every file made from the master: name in public/, then its size in pixels. */
const OUTPUTS = [
  ['apple-touch-icon.png', 180], // what iOS uses for "Add to Home Screen"
  ['icon-192.png', 192], // web app manifest
  ['icon-512.png', 512], // web app manifest
  ['favicon-32.png', 32], // browser tab
];

/** The tile's corner radius as a share of its width, measured on the sheet (about 190 of 842 px). */
const CORNER = 0.2257;
/** Pixels trimmed off the tile's outer edge, where it blends into the grey sheet. */
const EDGE = 3;

async function cutMaster() {
  const { data, info } = await sharp(SHEET).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const isBlue = (x, y) => {
    const i = (y * W + x) * 3;
    return data[i + 2] - data[i] > 40;
  };
  // The tile's edges, read along lines through plain sky blue on the top left tile.
  let left = 0;
  while (!isBlue(left, 400)) left++;
  let right = 1010;
  while (!isBlue(right, 400)) right--;
  let top = 0;
  while (!isBlue(700, top)) top++;
  const size = right - left + 1; // the tile is square

  const inner = size - 2 * EDGE;
  const tile = await sharp(SHEET)
    .extract({ left: left + EDGE, top: top + EDGE, width: inner, height: inner })
    .removeAlpha()
    .raw()
    .toBuffer();

  // Fill the four rounded corners out to square by mirroring the tile across its curved edge,
  // which carries the felt grain and stripes on without smearing.
  const r = CORNER * size - EDGE;
  const out = Buffer.from(tile);
  const centres = [
    [r, r],
    [inner - 1 - r, r],
    [r, inner - 1 - r],
    [inner - 1 - r, inner - 1 - r],
  ];
  for (let y = 0; y < inner; y++) {
    for (let x = 0; x < inner; x++) {
      const [cx, cy] = centres[(y > inner / 2 ? 2 : 0) + (x > inner / 2 ? 1 : 0)];
      const inCornerX = x < r || x > inner - 1 - r;
      const inCornerY = y < r || y > inner - 1 - r;
      if (!inCornerX || !inCornerY) continue;
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy);
      if (d <= r - 1) continue;
      const mirrored = 2 * (r - 2) - d; // distance from the arc's centre after reflecting
      const sx = Math.round(cx + (dx / d) * mirrored);
      const sy = Math.round(cy + (dy / d) * mirrored);
      for (let c = 0; c < 3; c++) out[(y * inner + x) * 3 + c] = tile[(sy * inner + sx) * 3 + c];
    }
  }
  mkdirSync(dirname(MASTER), { recursive: true });
  await sharp(out, { raw: { width: inner, height: inner, channels: 3 } })
    .png({ compressionLevel: 9 })
    .toFile(MASTER);
  console.log(`master: ${inner} x ${inner} from tile at ${left},${top} (${size} px)`);
}

async function makeSizes() {
  for (const [name, size] of OUTPUTS) {
    await sharp(MASTER)
      .resize(size, size, { kernel: 'lanczos3' })
      .removeAlpha() // iOS fills any transparency with black
      .png({ compressionLevel: 9 })
      .toFile(resolve(root, 'public', name));
    console.log(`public/${name}: ${size} x ${size}`);
  }
}

if (process.argv.includes('--from-sheet')) await cutMaster();
await makeSizes();
