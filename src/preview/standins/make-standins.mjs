// Rough stand-ins for the melt preview page (melt.html), cut from the existing
// melt stages so the page can show options before any new art is generated.
// They are NOT game art: they live here, not in public/art, and are never
// cut by `npm run art`. If Drew picks an option, the real pieces are drawn
// on Higgsfield and these are deleted with the preview page.
//
//   node src/preview/standins/make-standins.mjs
//
// Writes, next to this file:
//   puddle-base.png   stage 8 with the hat and carrot taken out (holes filled with puddle felt)
//   puddle-plain.png  the same with the eyes gone too
//   puddle-hat.png    the hat lying in the puddle
//   puddle-carrot.png the carrot lying in the puddle
//   hat-6.png, hat-7.png  the hat cut off stages 6 and 7, for the "hat left hanging" gag
//   standins.json     where each piece sat in its source picture, and where the puddle's eyes are
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const artDir = join(here, '../../../public/art');

async function load(name) {
  const { data, info } = await sharp(join(artDir, `${name}.webp`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, W: info.width, H: info.height };
}
const at = (img, x, y) => {
  const i = (y * img.W + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
};
const isBlue = ([r, , b, a]) => a > 100 && b > r + 25;
const isSnow = ([r, g, b]) => Math.min(r, g, b) > 165;

/** Flood fill from a seed over pixels that pass `ok`, then grow by `grow` pixels over any opaque, non-blue pixel (the soft edge). */
function flood(img, seeds, ok, grow = 2) {
  const mask = new Uint8Array(img.W * img.H);
  const stack = seeds.map(([x, y]) => y * img.W + x);
  while (stack.length) {
    const p = stack.pop();
    if (mask[p]) continue;
    const x = p % img.W;
    const y = (p / img.W) | 0;
    if (!ok(at(img, x, y))) continue;
    mask[p] = 1;
    if (x > 0) stack.push(p - 1);
    if (x < img.W - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - img.W);
    if (y < img.H - 1) stack.push(p + img.W);
  }
  for (let g = 0; g < grow; g++) {
    const next = mask.slice();
    for (let p = 0; p < mask.length; p++) {
      if (mask[p]) continue;
      const x = p % img.W;
      const y = (p / img.W) | 0;
      const near = (x > 0 && mask[p - 1]) || (x < img.W - 1 && mask[p + 1]) || (y > 0 && mask[p - img.W]) || (y < img.H - 1 && mask[p + img.W]);
      const px = at(img, x, y);
      if (near && px[3] > 20 && !isBlue(px) && !isSnow(px)) next[p] = 1;
    }
    mask.set(next);
  }
  return mask;
}

function bbox(img, mask) {
  let x0 = img.W, y0 = img.H, x1 = 0, y1 = 0;
  for (let p = 0; p < mask.length; p++) {
    if (!mask[p]) continue;
    const x = p % img.W;
    const y = (p / img.W) | 0;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Writes the masked pixels as their own transparent PNG, cropped to their box. */
async function cutOut(img, mask, file) {
  const b = bbox(img, mask);
  const out = Buffer.alloc(b.w * b.h * 4);
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++) {
      const p = (y + b.y) * img.W + x + b.x;
      if (!mask[p]) continue;
      img.data.copy(out, (y * b.w + x) * 4, p * 4, p * 4 + 4);
    }
  await sharp(out, { raw: { width: b.w, height: b.h, channels: 4 } }).png().toFile(join(here, file));
  return b;
}

// felt-black crown and brim, or the salmon band (a stricter test than "not snow", so the flood cannot
// creep through the grey shading on his head into the scarf)
const hatColour = ([r, g, b, a]) => a > 120 && ((Math.max(r, g, b) < 115 && b < r + 25) || (r > 150 && r - b > 45 && g < 175));
const carrotColour = ([r, g, b, a]) => a > 120 && r > g + 25 && r > b + 70;

// ---- stage 8: the puddle ----
const s8 = await load('snowman-8');
const hatMask = flood(s8, [[380, 50], [300, 110]], hatColour);
const carrotMask = flood(s8, [[180, 240], [215, 225]], carrotColour);
const hat = await cutOut(s8, hatMask, 'puddle-hat.png');
const carrot = await cutOut(s8, carrotMask, 'puddle-carrot.png');

// the puddle without them: where a hole is inside the puddle, fill it with felt cloned from a plain patch;
// where it is above the puddle's top edge (the hat's crown), leave it clear
const holes = new Uint8Array(s8.W * s8.H);
for (let p = 0; p < holes.length; p++) holes[p] = hatMask[p] || carrotMask[p];
// widen the holes over the dark felt of the shadows the hat and carrot cast, so no shadow is left behind
for (let g = 0; g < 7; g++) {
  const next = holes.slice();
  for (let p = 0; p < holes.length; p++) {
    if (holes[p]) continue;
    const x = p % s8.W;
    const near = (x > 0 && holes[p - 1]) || (x < s8.W - 1 && holes[p + 1]) || holes[p - s8.W] || holes[p + s8.W];
    if (near && isBlue(at(s8, x, (p / s8.W) | 0))) next[p] = 1;
  }
  holes.set(next);
}
const edge = new Array(s8.W).fill(-1); // the puddle's top edge in each column, -1 where the hat hides it
for (let x = 0; x < s8.W; x++) {
  for (let y = 0; y < s8.H; y++) {
    const p = y * s8.W + x;
    if (holes[p]) break; // a hole reached before any felt: the edge is hidden
    if (isBlue(at(s8, x, y))) {
      edge[x] = y;
      break;
    }
  }
}
for (let x = 0; x < s8.W; x++) {
  if (edge[x] >= 0) continue;
  let l = x, r = x;
  while (l > 0 && edge[l] < 0) l--;
  while (r < s8.W - 1 && edge[r] < 0) r++;
  const el = edge[l] >= 0 ? edge[l] : edge[r];
  const er = edge[r] >= 0 ? edge[r] : edge[l];
  edge[x] = Math.round(el + ((er - el) * (x - l)) / Math.max(1, r - l));
}
// Fill each hole with felt mirrored in from just outside it (the nearest side whose mirror image is
// plain puddle), so the tone and texture match what is around it.
const base = Buffer.from(s8.data);
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const inside = (x, y) => x >= 0 && y >= 0 && x < s8.W && y < s8.H;
for (let p = 0; p < holes.length; p++) {
  if (!holes[p]) continue;
  const x = p % s8.W;
  const y = (p / s8.W) | 0;
  if (y < edge[x] + 2) {
    base[p * 4 + 3] = 0;
    continue;
  }
  let best = null;
  for (const [dx, dy] of DIRS) {
    let d = 1;
    while (inside(x + dx * d, y + dy * d) && holes[(y + dy * d) * s8.W + x + dx * d]) d++;
    const sx = x + dx * (2 * d + 3);
    const sy = y + dy * (2 * d + 3);
    if (!inside(sx, sy) || holes[sy * s8.W + sx] || !isBlue(at(s8, sx, sy))) continue;
    if (!best || d < best.d) best = { d, sx, sy };
  }
  if (best) s8.data.copy(base, p * 4, (best.sy * s8.W + best.sx) * 4, (best.sy * s8.W + best.sx) * 4 + 4);
  else base.set([96, 152, 190, 255], p * 4);
}
// the hat's soft shadow above the puddle's edge has nothing to fall on once the hat is gone
for (let x = hat.x - 6; x < hat.x + hat.w + 6; x++)
  for (let y = 0; y < edge[x] - 1; y++) base[(y * s8.W + x) * 4 + 3] = 0;
await sharp(base, { raw: { width: s8.W, height: s8.H, channels: 4 } }).png().toFile(join(here, 'puddle-base.png'));

// and a plain puddle with the eyes gone too, for the puddle that spreads under him as he sinks:
// felt mirrored in from beside each eye, as for the hat and carrot
const eyeHoles = new Uint8Array(s8.W * s8.H);
const baseImg = { data: base, W: s8.W, H: s8.H };
for (const [x0, x1] of [[150, 232], [232, 312]])
  for (let y = 135; y < 228; y++)
    for (let x = x0; x < x1; x++) if (base[(y * s8.W + x) * 4 + 3] > 0 && !isBlue(at(baseImg, x, y))) eyeHoles[y * s8.W + x] = 1;
for (let g = 0; g < 4; g++) {
  const next = eyeHoles.slice();
  for (let p = 0; p < eyeHoles.length; p++) if (!eyeHoles[p] && (eyeHoles[p - 1] || eyeHoles[p + 1] || eyeHoles[p - s8.W] || eyeHoles[p + s8.W])) next[p] = 1;
  eyeHoles.set(next);
}
const plain = Buffer.from(base);
for (let p = 0; p < eyeHoles.length; p++) {
  if (!eyeHoles[p]) continue;
  const x = p % s8.W;
  const y = (p / s8.W) | 0;
  let best = null;
  for (const [dx, dy] of DIRS) {
    let d = 1;
    while (inside(x + dx * d, y + dy * d) && eyeHoles[(y + dy * d) * s8.W + x + dx * d]) d++;
    const sx = x + dx * (2 * d + 3);
    const sy = y + dy * (2 * d + 3);
    if (!inside(sx, sy) || eyeHoles[sy * s8.W + sx] || !isBlue(at(baseImg, sx, sy))) continue;
    if (!best || d < best.d) best = { d, sx, sy };
  }
  if (best) base.copy(plain, p * 4, (best.sy * s8.W + best.sx) * 4, (best.sy * s8.W + best.sx) * 4 + 4);
}
await sharp(plain, { raw: { width: s8.W, height: s8.H, channels: 4 } }).png().toFile(join(here, 'puddle-plain.png'));

// the eyes: two cream circles; find each one's box from its cream pixels
function eyeBox(img, x0, x1, y0, y1) {
  let ax = img.W, ay = img.H, bx = 0, by = 0;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const [r, g, b, a] = at(img, x, y);
      if (a > 200 && r > 200 && g > 190 && b > 160) {
        ax = Math.min(ax, x); ay = Math.min(ay, y); bx = Math.max(bx, x); by = Math.max(by, y);
      }
    }
  return { cx: (ax + bx) / 2, cy: (ay + by) / 2, rx: (bx - ax) / 2, ry: (by - ay) / 2 };
}
const eyes = [eyeBox(s8, 150, 232, 130, 230), eyeBox(s8, 232, 310, 130, 230)];

// ---- stages 6 and 7: their hats, for the hat that is left hanging in the air ----
const s7 = await load('snowman-7');
const hat7 = await cutOut(s7, flood(s7, [[290, 40], [330, 20]], hatColour), 'hat-7.png');
const s6 = await load('snowman-6');
const hat6 = await cutOut(s6, flood(s6, [[230, 60], [260, 25]], hatColour), 'hat-6.png');

const info = {
  note: 'Written by make-standins.mjs. Boxes are in the source picture\'s pixels.',
  puddle: { w: s8.W, h: s8.H, hat, carrot, eyes },
  'hat-7': { w: s7.W, h: s7.H, box: hat7 },
  'hat-6': { w: s6.W, h: s6.H, box: hat6 },
};
writeFileSync(join(here, 'standins.json'), JSON.stringify(info, null, 2) + '\n');
console.log(JSON.stringify(info, null, 1));
