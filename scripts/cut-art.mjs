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
 * Stages 4 to 7 were redrawn on two later sheets so that the arms and hat
 * carry through from one stage to the next; the figures they replace are
 * skipped with null.
 * join: how far apart (in source pixels) two bits can be and still count as
 * one piece (a sweat drop beside a head, an arm lying beside a body).
 */
const SHEETS = [
  { src: 'snowman-0-2.png', order: 'x', join: 14, names: ['snowman-0', 'snowman-1', 'snowman-2'], hat: true },
  { src: 'snowman-3-5.png', order: 'x', join: 14, names: ['snowman-3', null, null], hat: true },
  { src: 'snowman-4-5-fix.png', order: 'x', join: 14, names: ['snowman-4', 'snowman-5'], hat: true },
  { src: 'snowman-6-7-fix.png', order: 'x', join: 14, names: ['snowman-6', 'snowman-7'], hat: true },
  { src: 'snowman-6-8.png', order: 'x', join: 14, names: [null, null, 'snowman-8'], hat: true },
  // Round 4 (art/prompts/round-4-stage-3-and-win.md). Stage 3 redrawn between
  // stages 2 and 4: only the middle figure is used, and when the sheet is
  // there it replaces the stage 3 cut from snowman-3-5.png above. join is 10
  // here: at 12 or more the middle and right puddles run together into one piece.
  { src: 'snowman-3-redraw.png', order: 'x', join: 10, names: [null, 'snowman-3', null], hat: true },
  // Two win celebrations for Drew to choose from, four poses each, read
  // top left, top right, bottom left, bottom right.
  { src: 'win-backflip.png', order: 'grid', join: 14, names: ['win-backflip-1', 'win-backflip-2', 'win-backflip-3', 'win-backflip-4'], hat: true },
  { src: 'win-dance.png', order: 'grid', join: 14, names: ['win-dance-1', 'win-dance-2', 'win-dance-3', 'win-dance-4'], hat: true },
  // Optional: a cloud to roll over the sun, then six snowflakes.
  { src: 'win-sky.png', order: 'grid', join: 10, names: ['cloud', 'flake-1', 'flake-2', 'flake-3', 'flake-4', 'flake-5', 'flake-6'], maxSide: 900 },
  { src: 'sun.png', order: 'grid', join: 20, names: ['sun-smug', 'sun-gleeful', 'sun-annoyed', 'sun-dismayed'], maxSide: 460 },
  { src: 'signs.png', order: 'y', join: 12, names: ['sign-1', 'sign-2', 'sign-3'], maxSide: 960, unnail: true },
  {
    src: 'garden.png',
    order: 'grid',
    join: 10,
    maxSide: 220,
    names: [
      'crocus-purple-1', 'crocus-purple-2', 'crocus-yellow-1', 'crocus-yellow-2',
      'snow-1', 'snow-2', null, 'post',
      null, 'grass-2', null, 'grass-4',
    ],
  },
];

/** Pixels of hat brim the snowman is scaled to, so every stage shares one scale. */
const HAT_WIDTH = 190;
/**
 * Corrections where the sheet's scale lands a figure the wrong size beside its
 * neighbours. hatWidth() counts black pixels on one row, so a hat that sits
 * straight reads wider than the same hat tilted, and its sheet is cut too small.
 * snowman-6: came out a touch too tall for its place in the melt.
 * snowman-3 (redrawn 2026-11-21): its hat sits straight (224 px on a row), where
 * every earlier stage's hat is tilted, so it was cut 9.6% small: 689 px tall,
 * shorter than stage 4's 729. At 1.096 the hat's area is within 1% of stage 2's
 * and the figure steps evenly between stages 2 and 4: 780, 755, 729 tall and
 * 499, 487, 476 across the snow. This is the right size, not a fudge.
 * Win poses: the same effect left them 6 to 19 percent small (by hat area)
 * beside the fresh snowman, so each sheet is scaled up to match stage 0's hat.
 */
const TWEAK = {
  'snowman-3': 1.096,
  'snowman-6': 0.9,
  ...Object.fromEntries([1, 2, 3, 4].map((n) => [`win-backflip-${n}`, 1.1])),
  ...Object.fromEntries([1, 2, 3, 4].map((n) => [`win-dance-${n}`, 1.19])),
};
/** The three sign boards came out in slightly different browns; these bring them to one tone. */
const TONE = { 'sign-2': { brightness: 0.86, saturation: 0.9 }, 'sign-3': { brightness: 0.94 } };

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
  const specks = new Set(); // islands too small to be a piece; left in any crop they fall in, as before
  const stack = [];
  let nextId = 0;
  for (let i = 0; i < grown.length; i++) {
    if (!grown[i] || label[i]) continue;
    const id = ++nextId;
    const box = { id, x0: mw, y0: mh, x1: -1, y1: -1, area: 0 };
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
    else specks.add(id);
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
      // which island this is and who owns each quarter-size cell, so a crop can drop a neighbour's pixels
      owner: { id: b.id, label, mw, S, specks },
    };
  });
}

/**
 * A piece is cropped as a rectangle, so the tip of a neighbouring figure's
 * arm can poke into it when two figures sit close together. Clear every pixel
 * in the crop that belongs to some other island. Returns how many it cleared.
 */
function clearNeighbours(px, box) {
  const { id, label, mw, S, specks } = box.owner;
  let cleared = 0;
  for (let cy = 0; cy < box.h; cy++) {
    const row = Math.floor((box.y + cy) / S) * mw;
    for (let cx = 0; cx < box.w; cx++) {
      const who = label[row + Math.floor((box.x + cx) / S)];
      if (who === 0 || who === id || specks.has(who)) continue;
      const i = (cy * box.w + cx) * 4;
      if (px[i + 3] > 0) {
        px[i + 3] = 0;
        cleared++;
      }
    }
  }
  return cleared;
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

/**
 * Paint out the nail heads near each end of a sign board: with the post in
 * the middle, nails at the ends hold nothing (Drew, 2026-11-20). A nail is a
 * round, grey blob in the outer fifth of the board. Each is covered with the
 * wood a little further in, which shares the horizontal grain, blended in
 * towards the edge of the patch. Returns how many nails it removed.
 */
function removeNails(px, w, h) {
  const grey = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const x = i % w;
    if (x > w * 0.2 && x < w * 0.8) continue;
    const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
    if (px[i * 4 + 3] > 200 && Math.max(r, g, b) - Math.min(r, g, b) < 28 && r < 150) grey[i] = 1;
  }
  let removed = 0;
  const seen = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (!grey[i] || seen[i]) continue;
    let x0 = w, y0 = h, x1 = -1, y1 = -1, area = 0;
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const p = stack.pop();
      const px0 = p % w;
      const py0 = (p - px0) / w;
      area++;
      x0 = Math.min(x0, px0); x1 = Math.max(x1, px0);
      y0 = Math.min(y0, py0); y1 = Math.max(y1, py0);
      for (const q of [p - 1, p + 1, p - w, p + w]) {
        if (q < 0 || q >= w * h || !grey[q] || seen[q]) continue;
        if ((q === p - 1 && px0 === 0) || (q === p + 1 && px0 === w - 1)) continue;
        seen[q] = 1;
        stack.push(q);
      }
    }
    const bw = x1 - x0 + 1;
    const bh = y1 - y0 + 1;
    if (area < 300 || bw / bh > 1.6 || bh / bw > 1.6) continue; // specks and grain, not nails
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const rad = Math.max(bw, bh) / 2;
    const dx = Math.round(rad * 3) * (cx < w / 2 ? 1 : -1);
    const inner = rad * 1.3; // the head and its shadow
    const outer = rad * 1.75; // blended out to here
    for (let y = Math.floor(cy - outer); y <= Math.ceil(cy + outer); y++) {
      for (let x = Math.floor(cx - outer); x <= Math.ceil(cx + outer); x++) {
        const d = Math.hypot(x - cx, y - cy);
        const sx = x + dx;
        if (d > outer || y < 0 || y >= h || x < 0 || x >= w || sx < 0 || sx >= w) continue;
        const u = d <= inner ? 0 : (d - inner) / (outer - inner);
        const t = 1 - u * u * (3 - 2 * u);
        const o = (y * w + x) * 4;
        const so = (y * w + sx) * 4;
        for (let c = 0; c < 3; c++) px[o + c] = Math.round(px[o + c] * (1 - t) + px[so + c] * t);
      }
    }
    removed++;
  }
  return removed;
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
    if (sheet.hat && sheetHat > 40) scale = (HAT_WIDTH / sheetHat) * (TWEAK[name] ?? 1);
    else if (sheet.maxSide) scale = Math.min(1, sheet.maxSide / Math.max(box.w, box.h));
    const outW = Math.max(1, Math.round(box.w * scale));
    const outH = Math.max(1, Math.round(box.h * scale));
    const crop = { left: box.x, top: box.y, width: box.w, height: box.h };
    let piece = sharp(file).extract(crop);
    // Look at the crop's pixels: drop any neighbour's pixels, paint out nails.
    // A piece is only rebuilt from them when something changed, so pieces that
    // need neither stay byte for byte as before.
    const { data, info } = await sharp(file).extract(crop).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const cleared = clearNeighbours(data, box);
    if (cleared) console.log(`    cleared ${cleared} pixels that belong to the next piece`);
    if (sheet.unnail) console.log(`    removed ${removeNails(data, info.width, info.height)} nail heads`);
    if (cleared || sheet.unnail) piece = sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });
    if (TONE[name]) piece = piece.modulate(TONE[name]);
    await piece
      .resize(outW, outH, { kernel: 'lanczos3' })
      .webp({ quality: 80, alphaQuality: 88, effort: 6 })
      .toFile(path.join(OUT, `${name}.webp`));
    manifest[name] = { w: outW, h: outH };
  }
}

// The backyard is a plain picture, not a sheet.
try {
  const plate = sharp(path.join(SRC, 'backyard.png'));
  const meta = await plate.metadata();
  const w = 1242;
  const h = Math.round((meta.height / meta.width) * w);
  if (!listOnly) {
    await plate.resize(w, h).webp({ quality: 78, effort: 6 }).toFile(path.join(OUT, 'backyard.webp'));
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
