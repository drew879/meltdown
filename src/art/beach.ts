import { C, mix } from './palette';
import { clamp01, ellipse, ink, inkLine, stroke, type Ctx } from './draw';

/**
 * The beach: a snowman's worst holiday. Drawn in screen pixels to fill
 * `w` by `h`. `heat` (0 to 1) bakes the sky from blue to orange.
 * Returns the y of the horizon and of the top of the sand.
 */
export function drawBeach(
  ctx: Ctx,
  w: number,
  h: number,
  heat: number,
  t: number,
  sun?: { x: number; y: number; r: number },
): { horizon: number; shore: number } {
  const k = clamp01(heat);
  const u = Math.min(w, h) / 400;
  const horizon = h * 0.6;
  const shore = h * 0.71;

  // sky, in two flat bands with a wavy seam
  ctx.fillStyle = C.sky;
  ctx.fillRect(0, 0, w, horizon);
  ctx.fillStyle = C.skyLow;
  ctx.beginPath();
  const seam = h * 0.36;
  ctx.moveTo(0, seam);
  const humps = 5;
  for (let i = 0; i < humps; i++) {
    const x0 = (w / humps) * i;
    const x1 = (w / humps) * (i + 1);
    ctx.quadraticCurveTo((x0 + x1) / 2, seam + (i % 2 ? -1 : 1) * 16 * u, x1, seam);
  }
  ctx.lineTo(w, horizon);
  ctx.lineTo(0, horizon);
  ctx.closePath();
  ctx.fill();

  // heat: flat rings spread out from the sun, one more with each step, and
  // turn from pale yellow to orange. The blue itself never goes muddy.
  if (sun) {
    const count = 1 + Math.min(4, Math.floor(k * 4.999));
    for (let i = count - 1; i >= 0; i--) {
      const r = sun.r * (1.72 + i * 0.78) * (0.92 + 0.5 * k) * (1 + 0.012 * Math.sin(t * 1.6 + i));
      ctx.fillStyle = mix(C.skyHotLow, C.skyHot, k * 1.25 - i * 0.26 - 0.12);
      ctx.fill(ellipse(sun.x, sun.y, r, r));
    }
  }

  // clouds, which thin out as it heats up
  const cloud = (cx: number, cy: number, s: number) => {
    const p = new Path2D();
    p.moveTo(cx - 44 * s, cy);
    p.bezierCurveTo(cx - 52 * s, cy - 20 * s, cx - 28 * s, cy - 30 * s, cx - 16 * s, cy - 20 * s);
    p.bezierCurveTo(cx - 10 * s, cy - 40 * s, cx + 22 * s, cy - 38 * s, cx + 22 * s, cy - 18 * s);
    p.bezierCurveTo(cx + 44 * s, cy - 26 * s, cx + 54 * s, cy - 4 * s, cx + 42 * s, cy);
    p.closePath();
    ctx.fillStyle = C.cloud;
    ctx.fill(p);
  };
  ctx.globalAlpha = 1 - k * 0.6;
  const drift = (t * 4 * u) % (w + 200 * u);
  cloud(((w * 0.2 + drift) % (w + 200 * u)) - 60 * u, h * 0.17, 0.95 * u);
  cloud(((w * 0.62 + drift * 0.6) % (w + 200 * u)) - 60 * u, h * 0.3, 0.6 * u);
  ctx.globalAlpha = 1;

  // sea
  ctx.fillStyle = C.sea;
  ctx.fillRect(0, horizon, w, shore - horizon + 12 * u);
  ctx.fillStyle = C.seaDeep;
  ctx.fillRect(0, horizon, w, 7 * u);
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 3.5 * u;
  ctx.lineCap = 'round';
  const waves: [number, number, number][] = [
    [0.08, 0.3, 28],
    [0.3, 0.62, 20],
    [0.56, 0.36, 30],
    [0.8, 0.7, 22],
    [0.93, 0.3, 16],
  ];
  for (const [fx, fy, len] of waves) {
    const wx = fx * w + Math.sin(t * 0.8 + fx * 9) * 6 * u;
    const wy = horizon + 8 * u + fy * (shore - horizon - 14 * u);
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.quadraticCurveTo(wx + (len * u) / 2, wy - 4 * u, wx + len * u, wy);
    ctx.stroke();
  }

  // sand, with a foamy edge
  const edge = (yOff: number) => {
    ctx.beginPath();
    ctx.moveTo(0, shore + yOff);
    const n = 6;
    for (let i = 0; i < n; i++) {
      const x0 = (w / n) * i;
      const x1 = (w / n) * (i + 1);
      const bump = (i % 2 ? 1 : -1) * (7 + Math.sin(t * 0.9 + i) * 2) * u;
      ctx.quadraticCurveTo((x0 + x1) / 2, shore + yOff + bump, x1, shore + yOff);
    }
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
  };
  ctx.fillStyle = C.snow;
  edge(-5 * u);
  ctx.fill();
  ctx.fillStyle = C.sandShade;
  edge(0);
  ctx.fill();
  ctx.fillStyle = C.sand;
  edge(9 * u);
  ctx.fill();

  // specks, a shell and a starfish
  ctx.fillStyle = C.sandDark;
  const specks: [number, number][] = [
    [0.07, 0.9], [0.2, 0.8], [0.33, 0.95], [0.6, 0.93], [0.74, 0.82], [0.9, 0.9], [0.5, 0.79], [0.83, 0.97], [0.13, 0.97],
  ];
  for (const [sx, sy] of specks) ctx.fill(ellipse(sx * w, sy * h, 2.2 * u, 1.6 * u));

  const star = new Path2D();
  const scx = w * 0.9;
  const scy = h - 20 * u;
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5 + 0.3;
    const r = (i % 2 ? 6 : 14) * u;
    const px = scx + Math.cos(a) * r;
    const py = scy + Math.sin(a) * r * 0.8;
    if (i === 0) star.moveTo(px, py);
    else star.lineTo(px, py);
  }
  star.closePath();
  ink(ctx, star, C.coral, 3.5 * u);

  return { horizon, shore };
}

/** A striped beach umbrella planted at (x, y), standing `size` tall. Melvin is, of course, not under it. */
export function drawUmbrella(ctx: Ctx, x: number, y: number, size: number, t: number): void {
  const s = size / 150;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(0.16 + Math.sin(t * 1.1) * 0.008);
  const pole = new Path2D();
  pole.moveTo(0, 6 * s);
  pole.lineTo(0, -128 * s);
  inkLine(ctx, pole, C.cream, 5 * s, 3 * s);

  const top = -150 * s;
  const rim = -100 * s;
  const R = 82 * s;
  const canopy = new Path2D();
  canopy.moveTo(-R, rim);
  canopy.bezierCurveTo(-R * 0.9, top - 10 * s, R * 0.9, top - 10 * s, R, rim);
  // scalloped edge
  const scallops = 4;
  for (let i = scallops; i > 0; i--) {
    const x1 = -R + ((2 * R) / scallops) * (i - 1);
    const x0 = -R + ((2 * R) / scallops) * i;
    canopy.quadraticCurveTo((x0 + x1) / 2, rim - 15 * s, x1, rim);
  }
  canopy.closePath();
  ink(ctx, canopy, C.coral, 0);
  ctx.save();
  ctx.clip(canopy);
  ctx.fillStyle = C.cream;
  for (const i of [1, 3]) {
    const x0 = -R + ((2 * R) / scallops) * i;
    const x1 = x0 + (2 * R) / scallops;
    ctx.beginPath();
    ctx.moveTo(x0, rim);
    ctx.quadraticCurveTo(x0 * 0.72, (top + rim) / 2, 0, top - 8 * s);
    ctx.quadraticCurveTo(x1 * 0.72, (top + rim) / 2, x1, rim);
    ctx.quadraticCurveTo((x0 + x1) / 2, rim - 15 * s, x0, rim);
    ctx.fill();
  }
  ctx.restore();
  ink(ctx, canopy, null, 4.5 * s);
  ink(ctx, ellipse(0, top - 6 * s, 5 * s, 5 * s), C.cream, 3.5 * s);
  ctx.restore();
}

/** Melvin's suitcase, packed for the wrong holiday. (x, y) is the middle of its bottom edge. */
export function drawSuitcase(ctx: Ctx, x: number, y: number, size: number): void {
  const s = size / 60;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.07);
  ctx.fillStyle = C.sandShade;
  ctx.fill(ellipse(-4 * s, 2 * s, 40 * s, 6 * s));
  const handle = new Path2D();
  handle.moveTo(-11 * s, -44 * s);
  handle.bezierCurveTo(-11 * s, -58 * s, 11 * s, -58 * s, 11 * s, -44 * s);
  inkLine(ctx, handle, C.leatherShade, 4 * s, 3 * s);
  const body = new Path2D();
  body.roundRect(-34 * s, -46 * s, 68 * s, 46 * s, 8 * s);
  ink(ctx, body, C.leather, 0);
  ctx.save();
  ctx.clip(body);
  ctx.fillStyle = C.leatherShade;
  ctx.fillRect(-34 * s, -12 * s, 68 * s, 12 * s);
  ctx.fillStyle = C.cream;
  ctx.fillRect(-22 * s, -46 * s, 7 * s, 46 * s);
  ctx.fillRect(15 * s, -46 * s, 7 * s, 46 * s);
  ctx.restore();
  ink(ctx, body, null, 4.5 * s);
  // a snowflake sticker: he packed for the slopes
  ctx.save();
  ctx.translate(-1 * s, -25 * s);
  ctx.rotate(0.2);
  const sticker = ellipse(0, 0, 10 * s, 10 * s);
  ink(ctx, sticker, C.sky, 3 * s);
  const flake = new Path2D();
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI) / 3;
    flake.moveTo(Math.cos(a) * 6 * s, Math.sin(a) * 6 * s);
    flake.lineTo(-Math.cos(a) * 6 * s, -Math.sin(a) * 6 * s);
  }
  stroke(ctx, flake, 2.2 * s, C.snow);
  ctx.restore();
  ctx.restore();
}
