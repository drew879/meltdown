// Rough stand-ins for the melt's loose pieces, so the game can be built before
// the real ones are drawn (art/prompts/round-7-melt-pieces.md). Each is cut
// from an existing melt stage or drawn as a simple shape, under the name the
// real piece will have in public/art/. src/paper/melt-art.ts uses a stand-in
// only while the manifest has no piece of that name, so each real piece takes
// over as soon as `npm run art` has cut it. These are NOT game art and must
// not go live: delete this folder once all eleven real pieces are in.
//
//   node src/paper/melt-standins/make-standins.mjs
//
// Writes, next to this file:
//   puddle.png              stage 8 with the hat, carrot and eyes taken out (holes filled with puddle felt)
//   puddle-hat.png          the hat lying in the puddle
//   puddle-carrot.png       the carrot lying in the puddle
//   puddle-eyes.png         the two eyes, open
//   puddle-eyes-closed.svg  the same two discs with closed lids
//   hat-6.png, hat-7.png    the hats cut off stages 6 and 7
//   sun-flare.svg, heat-1.svg, heat-2.svg, drop.svg   simple shapes
//   standins.json           each piece's size, and where its middle sat in its source picture
//                           (x from the middle of the snowman's feet, y up from them), which is
//                           where REST and HAT_ON in melt-timeline.ts come from
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

// the eyes come out as their own piece, and their holes are filled the same way
const eyeHoles = new Uint8Array(s8.W * s8.H);
const baseImg = { data: base, W: s8.W, H: s8.H };
for (const [x0, x1] of [[150, 232], [232, 312]])
  for (let y = 135; y < 228; y++)
    for (let x = x0; x < x1; x++) if (base[(y * s8.W + x) * 4 + 3] > 0 && !isBlue(at(baseImg, x, y))) eyeHoles[y * s8.W + x] = 1;
const eyes = await cutOut(s8, eyeHoles, 'puddle-eyes.png');
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
const plainImg = { data: plain, W: s8.W, H: s8.H };
const solid = new Uint8Array(s8.W * s8.H);
for (let p = 0; p < solid.length; p++) solid[p] = plain[p * 4 + 3] > 40 ? 1 : 0;
const puddle = await cutOut(plainImg, solid, 'puddle.png');


// ---- stages 6 and 7: their hats, for the hat that is left hanging in the air ----
const s7 = await load('snowman-7');
const hat7 = await cutOut(s7, flood(s7, [[290, 40], [330, 20]], hatColour), 'hat-7.png');
const s6 = await load('snowman-6');
const hat6 = await cutOut(s6, flood(s6, [[230, 60], [260, 25]], hatColour), 'hat-6.png');

// ---- simple shapes ----
const svg = (w, h, inner, viewBox = `0 0 ${w} ${h}`) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${viewBox}">${inner}</svg>\n`;
// the closed eyes: the open pair's two discs, each with one curved lid line
const lid = (cx, cy, r) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#efe5cf" stroke="#3a3531" stroke-width="3"/>` +
  `<path d="M ${cx - r * 0.62} ${cy - r * 0.03} Q ${cx} ${cy + r * 0.5} ${cx + r * 0.62} ${cy - r * 0.03}" fill="none" stroke="#3a3531" stroke-width="5" stroke-linecap="round"/>`;
const r = Math.round(eyes.h / 2) - 2;
writeFileSync(join(here, 'puddle-eyes-closed.svg'), svg(eyes.w, eyes.h, lid(r + 2, eyes.h / 2, r) + lid(eyes.w - r - 2, eyes.h / 2, r)));
const ray = (turn) => `<polygon points="0,-50 6.5,-30 -6.5,-30" transform="rotate(${turn})"/>`;
writeFileSync(
  join(here, 'sun-flare.svg'),
  svg(640, 640, `<g fill="#f39a3c" stroke="#d9762a" stroke-width="0.8" stroke-linejoin="round">${Array.from({ length: 12 }, (_, i) => ray(i * 30)).join('')}<circle r="31"/></g>`, '-50 -50 100 100'),
);
const wiggle = (d) =>
  `<path d="${d}" fill="none" stroke="#f7a24a" stroke-width="17" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#ffe08a" stroke-width="7" stroke-linecap="round"/>`;
writeFileSync(join(here, 'heat-1.svg'), svg(100, 160, wiggle('M50 148 C 10 118 90 98 50 70 C 10 42 90 32 50 12')));
writeFileSync(join(here, 'heat-2.svg'), svg(100, 160, wiggle('M50 148 C 90 118 10 98 50 70 C 90 42 10 32 50 12')));
writeFileSync(
  join(here, 'drop.svg'),
  svg(92, 120, '<path d="M46 5 C 60 37 83 55 83 78 A 37 37 0 0 1 9 78 C 9 55 32 37 46 5 Z" fill="#89c6e4" stroke="#3f86ad" stroke-width="5"/><ellipse cx="32" cy="74" rx="9" ry="14" fill="#fff" opacity="0.75"/>'),
);

// where each piece's middle sat, from the middle of the feet (x right, y up), in the stage's own pixels
const mid = (b, src) => ({ w: b.w, h: b.h, x: b.x + b.w / 2 - src.W / 2, y: src.H - (b.y + b.h / 2) });
const info = {
  note: "Written by make-standins.mjs: each stand-in's size and where its middle sat in the stage it was cut from.",
  puddle: mid(puddle, s8),
  'puddle-hat': mid(hat, s8),
  'puddle-carrot': mid(carrot, s8),
  'puddle-eyes': mid(eyes, s8),
  'puddle-eyes-closed': { w: eyes.w, h: eyes.h },
  'hat-6': mid(hat6, s6),
  'hat-7': mid(hat7, s7),
  'sun-flare': { w: 640, h: 640 },
  'heat-1': { w: 100, h: 160 },
  'heat-2': { w: 100, h: 160 },
  drop: { w: 92, h: 120 },
};
writeFileSync(join(here, 'standins.json'), JSON.stringify(info, null, 2) + '\n');
console.log(JSON.stringify(info));
