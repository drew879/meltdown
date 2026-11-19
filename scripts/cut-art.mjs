// Cuts the generated paper sheets in art/layers/originals/ into the separate
// pieces the game uses, and writes them to public/art/ as WebP.
//
//   npm run art            cut everything listed in SHEETS
//   npm run art -- --list  only print what was found in each sheet
//
// A sheet is a transparent PNG holding several pieces. Pieces are found as
// islands of opaque pixels, so nothing here depends on where the image model
// happened to put them.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const SRC = 'art/layers/originals';
const OUT = 'public/art';
const MANIFEST = 'src/paper/art-manifest.json';
const listOnly = process.argv.includes('--list');

/**
 * order: how the islands are numbered ('x' left to right, 'y' top to bottom,
 * 'grid' rows then columns). names: one per island, or null to skip it.
 * The two sheets of later snowman stages trade one figure each, so that the
 * stages get steadily shorter.
 * join: how far apart (in source pixels) two bits can be and still count as
 * one piece (a sweat drop beside a head, an arm lying beside a body).
 */
const SHEETS = [
  { src: 'snowman-0-2.png', order: 'x', join: 14, names: ['snowman-0', 'snowman-1', 'snowman-2'], hat: true },
  { src: 'snowman-3-5.png', order: 'x', join: 14, names: ['snowman-3', 'snowman-4', 'snowman-6'], hat: true },
  { src: 'snowman-6-8.png', order: 'x', join: 14, names: ['snowman-5', 'snowman-7', 'snowman-8'], hat: true },
  { src: 'sun.png', order: 'grid', join: 20, names: ['sun-smug', 'sun-gleeful', 'sun-annoyed', 'sun-dismayed'], maxSide: 560 },
  { src: 'banner-tray.png', order: 'y', join: 12, names: ['banner', 'tray'], maxSide: 1500 },
  { src: 'pieces.png', order: 'grid', join: 10, names: [], maxSide: 420 },
];

/** Pixels of hat brim the snowman is scaled to, so every stage shares one scale. */
const HAT_WIDTH = 190;

async function load(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

/** Find islands of opaque pixels. Works on a quarter-size mask for speed. */
function islands({ data, w, h }, join) {
  const S = 4;
  const mw = Math.ceil(w / S);
  const mh = Math.ceil(h / S);
  const solid = new Uint8Array(mw * mh);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 40) solid[Math.floor(y / S) * mw + Math.floor(x / S)] = 1;
    }
  }
  // grow the mask so nearby bits join up, then label what touches
  const r = Math.max(1, Math.round(join / S / 2));
  const grown = new Uint8Array(mw * mh);
  for (let y = 0; y < mh; y++) {
    for (let x = 0; x < mw; x++) {
      if (!solid[y * mw + x]) continue;
      for (let dy = -r; dy <= r; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= mh) continue;
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx;
          if (xx >= 0 && xx < mw) grown[yy * mw + xx] = 1;
        }
      }
    }
  }
  const label = new Int32Array(mw * mh);
  const found = [];
  const stack = [];
  for (let i = 0; i < grown.length; i++) {
    if (!grown[i] || label[i]) continue;
    const id = found.length + 1;
    const box = { x0: mw, y0: mh, x1: -1, y1: -1, area: 0 };
    stack.push(i);
    label[i] = id;
    while (stack.length) {
      const p = stack.pop();
      const px = p % mw;
      const py = (p - px) / mw;
      if (solid[p]) {
        box.area++;
        if (px < box.x0) box.x0 = px;
        if (px > box.x1) box.x1 = px;
        if (py < box.y0) box.y0 = py;
        if (py > box.y1) box.y1 = py;
      }
      for (const q of [p - 1, p + 1, p - mw, p + mw]) {
        if (q < 0 || q >= grown.length || !grown[q] || label[q]) continue;
        if ((q === p - 1 && px === 0) || (q === p + 1 && px === mw - 1)) continue;
        label[q] = id;
        stack.push(q);
      }
    }
    if (box.area * S * S > 900) found.push(box);
  }
  const pad = 6;
  return found.map((b) => {
    const x = Math.max(0, b.x0 * S - pad);
    const y = Math.max(0, b.y0 * S - pad);
    return {
      x,
      y,
      w: Math.min(w, (b.x1 + 1) * S + pad) - x,
      h: Math.min(h, (b.y1 + 1) * S + pad) - y,
    };
  });
}

function sortBoxes(boxes, order) {
  const cx = (b) => b.x + b.w / 2;
  const cy = (b) => b.y + b.h / 2;
  if (order === 'x') return [...boxes].sort((a, b) => cx(a) - cx(b));
  if (order === 'y') return [...boxes].sort((a, b) => cy(a) - cy(b));
  // grid: group into rows by vertical overlap, then left to right
  const rows = [];
  for (const b of [...boxes].sort((a, c) => cy(a) - cy(c))) {
    const row = rows.find((r) => Math.abs(r.cy - cy(b)) < Math.max(r.h, b.h) * 0.5);
    if (row) row.items.push(b);
    else rows.push({ cy: cy(b), h: b.h, items: [b] });
  }
  return rows.flatMap((r) => r.items.sort((a, c) => cx(a) - cx(c)));
}

/** Width of the hat brim: the most near-black pixels found on any one row. */
function hatWidth({ data, w }, box) {
  let best = 0;
  for (let y = box.y; y < box.y + box.h; y++) {
    let count = 0;
    for (let x = box.x; x < box.x + box.w; x++) {
      const i = (y * w + x) * 4;
      if (data[i + 3] > 200 && data[i] < 100 && data[i + 1] < 100 && data[i + 2] < 110) count++;
    }
    if (count > best) best = count;
  }
  return best;
}

const manifest = {};
await mkdir(OUT, { recursive: true });
await mkdir(path.dirname(MANIFEST), { recursive: true });

for (const sheet of SHEETS) {
  const file = path.join(SRC, sheet.src);
  let img;
  try {
    img = await load(file);
  } catch {
    console.log(`${sheet.src}: not there yet, skipped`);
    continue;
  }
  const boxes = sortBoxes(islands(img, sheet.join), sheet.order);
  console.log(`${sheet.src}: ${img.w}x${img.h}, ${boxes.length} pieces`);
  // Every figure on a sheet is drawn at one scale, so the widest hat found on
  // it (a tilted or missing hat reads narrower) sets the scale for all of them.
  const hats = sheet.hat ? boxes.map((box) => hatWidth(img, box)) : [];
  const sheetHat = Math.max(0, ...hats);
  for (const [i, box] of boxes.entries()) {
    const name = sheet.names[i] ?? null;
    console.log(`  ${i} ${name ?? '(unnamed)'}: ${box.w}x${box.h} at ${box.x},${box.y}${sheet.hat ? `, hat ${hats[i]}px` : ''}`);
    if (listOnly || !name) continue;
    let scale = 1;
    if (sheet.hat && sheetHat > 40) scale = HAT_WIDTH / sheetHat;
    else if (sheet.maxSide) scale = Math.min(1, sheet.maxSide / Math.max(box.w, box.h));
    const outW = Math.max(1, Math.round(box.w * scale));
    const outH = Math.max(1, Math.round(box.h * scale));
    await sharp(file)
      .extract({ left: box.x, top: box.y, width: box.w, height: box.h })
      .resize(outW, outH, { kernel: 'lanczos3' })
      .webp({ quality: 84, alphaQuality: 90, effort: 6 })
      .toFile(path.join(OUT, `${name}.webp`));
    manifest[name] = { w: outW, h: outH };
  }
}

// The backyard is a plain picture, not a sheet.
try {
  const plate = sharp(path.join(SRC, 'backyard.png'));
  const meta = await plate.metadata();
  const w = 1290;
  const h = Math.round((meta.height / meta.width) * w);
  if (!listOnly) {
    await plate.resize(w, h).webp({ quality: 80, effort: 6 }).toFile(path.join(OUT, 'backyard.webp'));
    manifest.backyard = { w, h };
  }
  console.log(`backyard.png: ${meta.width}x${meta.height} -> ${w}x${h}`);
} catch {
  console.log('backyard.png: not there yet, skipped');
}

if (!listOnly) {
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`wrote ${Object.keys(manifest).length} pieces to ${OUT} and ${MANIFEST}`);
}
