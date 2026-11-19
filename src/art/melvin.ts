import { C } from './palette';
import { blob, cel, clamp01, ellipse, ink, inkLine, lerp, smooth, stroke, teardrop, type Blob, type Ctx } from './draw';

/**
 * Melvin, the snowman.
 *
 * He is drawn from numbers, not pictures: `melt` runs from 0 (pristine) to 1
 * (as far gone as he gets before the final melt), and every part of him is a
 * function of it. The origin is the spot on the ground under his middle, and
 * up is negative y. Pristine, he is about 280 units tall.
 */
export interface MelvinState {
  melt: number;
  /** Seconds, for idle motion. 0 gives a still pose. */
  t: number;
}

const LW = 5;

export function drawMelvin(ctx: Ctx, s: MelvinState): void {
  const m = clamp01(s.melt);
  const t = s.t;
  const worry = smooth(0.05, 0.85, m);

  // ---- idle motion ----
  const breath = Math.sin(t * 2.1) * (1.6 - m);
  const shiver = Math.sin(t * 27) * 0.7 * smooth(0.55, 1, m);
  const lean = -12 * m + shiver;

  // ---- the three snowballs, sagging as he melts ----
  const baseH = lerp(108, 46, m);
  const base: Blob = { cx: 0, top: -baseH, bottom: 0, rx: lerp(64, 104, m), f: lerp(0.52, 0.8, m), flat: lerp(0.12, 1, m) };
  const chestH = lerp(84, 36, m) + breath * 0.6;
  const chestBottom = base.top + lerp(22, 19, m);
  const chest: Blob = {
    cx: lean * 0.45,
    top: chestBottom - chestH,
    bottom: chestBottom,
    rx: lerp(46, 66, m),
    f: lerp(0.5, 0.76, m),
    flat: lerp(0, 0.9, m),
    lean: lean * 0.2,
  };
  const headH = lerp(90, 66, m) + breath * 0.5;
  const headBottom = chest.top + lerp(12, 17, m);
  const head: Blob = {
    cx: lean,
    top: headBottom - headH,
    bottom: headBottom,
    rx: lerp(50, 54, m),
    f: lerp(0.5, 0.64, m),
    flat: lerp(0, 0.55, m),
    lean: lean * 0.15,
  };

  // ---- shadow and puddle ----
  ctx.fillStyle = C.sandShade;
  ctx.fill(ellipse(-16, 5, base.rx * 1.12, 10));
  if (m > 0.06) {
    const prx = base.rx + lerp(-14, 44, m);
    const pry = lerp(4, 15, m);
    const p = ellipse(2, 3, prx, pry);
    ink(ctx, p, C.puddle, 4);
    ctx.fillStyle = C.snow;
    ctx.fill(ellipse(prx * 0.45, 3 - pry * 0.25, prx * 0.22, pry * 0.22));
  }

  // ---- twig arms (behind the body) ----
  const arm = (side: 1 | -1, angle: number, dropped: boolean) => {
    const x = dropped ? side * base.rx * 0.78 : chest.cx + side * chest.rx * 0.8;
    const y = dropped ? -5 : chest.top + chestH * 0.42;
    const a = dropped ? (side > 0 ? 0.1 : Math.PI - 0.1) : angle;
    const L = 58;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const p = new Path2D();
    p.moveTo(x, y);
    p.quadraticCurveTo(x + ux * L * 0.5 - uy * 7 * side, y + uy * L * 0.5 + ux * 7 * side, x + ux * L, y + uy * L);
    const bx = x + ux * L * 0.8;
    const by = y + uy * L * 0.8;
    for (const [d, len] of [[-0.7, 13], [0.75, 12]] as const) {
      p.moveTo(bx, by);
      p.lineTo(bx + Math.cos(a + d) * len, by + Math.sin(a + d) * len);
    }
    inkLine(ctx, p, C.twig, 5.5, 3.5);
  };
  const wave = Math.sin(t * 2.6) * 0.12 * (1 - worry);
  const leftDropped = m >= 0.36;
  const rightDropped = m >= 0.68;
  arm(-1, lerp(Math.PI + 0.55, Math.PI - 1.05, smooth(0.1, 0.3, m)), leftDropped);
  arm(1, lerp(-0.95 + wave, 1.05, smooth(0.42, 0.62, m)), rightDropped);

  // ---- body ----
  const ball = (b: Blob) => {
    const p = blob(b);
    cel(ctx, p, C.snow, C.snowShade, b.rx * 0.17, -b.rx * 0.13);
    ink(ctx, p, null, LW);
  };
  const coal = (x: number, y: number, r: number, rot = 0) => {
    ctx.fillStyle = C.ink;
    ctx.fill(ellipse(x, y, r, r * 0.86, rot));
    ctx.fillStyle = '#8d84c9';
    ctx.fill(ellipse(x + r * 0.3, y - r * 0.34, r * 0.27, r * 0.2, -0.5));
  };

  ball(base);
  coal(5, base.top + 22 + (baseH - 22) * 0.34, 6.2, 0.3);
  ball(chest);
  if (m < 0.8) coal(chest.cx + 3, chest.top + chestH * 0.42, 5.8, -0.2);
  else coal(-base.rx - 4, 2, 5.8, 0.6);
  if (m < 0.45) coal(chest.cx + 4, chest.top + chestH * (0.72 + 0.1 * smooth(0.25, 0.45, m)), 5.8, 0.4);
  else coal(base.rx + 8, 3, 5.8, 1.1);
  ball(head);

  // ---- scarf ----
  const neckY = head.bottom - 1;
  const ncx = (head.cx + chest.cx) / 2;
  const halfW = Math.min(head.rx, chest.rx) * 0.88;
  const droop = smooth(0.04, 0.22, m);
  const flick = (1 - droop) * (1 + 0.2 * Math.sin(t * 3));
  const scarf = (p: Path2D, w: number) => {
    inkLine(ctx, p, C.coral, w, 3.5, 'butt');
    ctx.save();
    ctx.setLineDash([6, 9]);
    ctx.lineDashOffset = 3;
    ctx.strokeStyle = C.cream;
    ctx.lineWidth = w;
    ctx.lineCap = 'butt';
    ctx.stroke(p);
    ctx.restore();
  };
  const kx = ncx - halfW * 0.5;
  const ky = neckY + 8;
  const tailB = new Path2D();
  tailB.moveTo(kx, ky);
  tailB.quadraticCurveTo(kx + 6, ky + 14, kx + 8 - 5 * flick, ky + 26 + 8 * droop);
  scarf(tailB, 12);
  const tailA = new Path2D();
  tailA.moveTo(kx, ky);
  tailA.quadraticCurveTo(kx - 3 - 6 * flick, ky + 22, kx - 10 - 22 * flick, ky + 40 + 14 * droop);
  scarf(tailA, 13);
  const band = new Path2D();
  band.moveTo(ncx - halfW, neckY - 5);
  band.quadraticCurveTo(ncx, neckY + 13, ncx + halfW, neckY - 5);
  scarf(band, 16);
  ink(ctx, ellipse(kx, ky, 8.5, 7.5, 0.3), C.coralDeep, 3.5);

  // ---- face ----
  const fx = head.cx + 5;
  const fy = head.top + headH * 0.5;
  const blinking = t > 0 && t % 3.7 < 0.12;
  const glance = t > 0 ? smooth(0.55, 0.95, Math.sin(t * 0.9)) : 0.5;
  const lookX = lerp(0.5, 2.6, glance);
  const lookY = lerp(0, -2.2, glance);
  const eyeSize = 1 + 0.24 * smooth(0.45, 0.9, m);

  ctx.globalAlpha = 0.9;
  ctx.fillStyle = C.blush;
  ctx.fill(ellipse(fx - 31, fy + 9, 8, 5));
  ctx.fill(ellipse(fx + 34, fy + 12, 6, 4));
  ctx.globalAlpha = 1;

  for (const side of [-1, 1] as const) {
    const ex = fx + side * 17 + lookX;
    const ey = fy - 9 + lookY;
    if (blinking) {
      const lid = new Path2D();
      lid.moveTo(ex - 7, ey + 1);
      lid.quadraticCurveTo(ex, ey + 5, ex + 7, ey + 1);
      stroke(ctx, lid, 4);
    } else {
      const rx = 6.6 * eyeSize;
      const ry = 8.8 * eyeSize;
      ctx.fillStyle = C.ink;
      ctx.fill(ellipse(ex, ey, rx, ry, side * 0.1));
      ctx.fillStyle = C.snow;
      ctx.fill(ellipse(ex + rx * 0.3, ey - ry * 0.36, rx * 0.34, ry * 0.26));
    }
    // brows: the inner ends lift as he worries; pristine, one is cocked like a ham
    const by = ey - 17 * eyeSize - 3 * worry;
    const cocky = side > 0 ? (1 - worry) * 4 : 0;
    const brow = new Path2D();
    brow.moveTo(ex + side * 9, by + lerp(-1, 5, worry) - cocky);
    brow.lineTo(ex - side * 6, by + lerp(1, -5, worry) - cocky * 1.4);
    stroke(ctx, brow, 4);
  }

  // carrot nose, which wilts late on
  const wilt = smooth(0.72, 0.95, m);
  const nx = fx + 4;
  const ny = fy + 7;
  const tipX = nx + 31 - 7 * wilt;
  const tipY = ny + 7 + 17 * wilt;
  const nose = new Path2D();
  nose.moveTo(nx - 1, ny - 7.5);
  nose.quadraticCurveTo((nx + tipX) / 2, ny - 6 + 4 * wilt, tipX, tipY);
  nose.quadraticCurveTo((nx + tipX) / 2, ny + 11 + 8 * wilt, nx - 1, ny + 7.5);
  nose.bezierCurveTo(nx - 8, ny + 6, nx - 8, ny - 6, nx - 1, ny - 7.5);
  nose.closePath();
  cel(ctx, nose, C.carrot, C.carrotShade, 1, -5);
  ink(ctx, nose, null, 4);
  const ridges = new Path2D();
  ridges.moveTo(nx + 9, ny - 5 + 2 * wilt);
  ridges.lineTo(nx + 10.5, ny + 1 + 2 * wilt);
  ridges.moveTo(nx + 18, ny - 2 + 5 * wilt);
  ridges.lineTo(nx + 19, ny + 2.5 + 5 * wilt);
  stroke(ctx, ridges, 2.5);

  // mouth: a ham's smile, then a wobble, then an "oh no"
  const mx = fx - 3;
  const my = fy + 25;
  const mouth = new Path2D();
  if (worry < 0.3) {
    const curve = 11 * (1 - worry * 2);
    mouth.moveTo(mx - 17, my - 3);
    mouth.quadraticCurveTo(mx - 1, my + curve + 3, mx + 16, my - 4);
    mouth.moveTo(mx + 14, my - 8);
    mouth.quadraticCurveTo(mx + 19, my - 5, mx + 17, my);
    stroke(ctx, mouth, 4);
  } else if (worry < 0.7) {
    mouth.moveTo(mx - 13, my + 2);
    mouth.quadraticCurveTo(mx - 9, my - 4, mx - 4.5, my + 2);
    mouth.quadraticCurveTo(mx, my + 8, mx + 4.5, my + 2);
    mouth.quadraticCurveTo(mx + 9, my - 4, mx + 13, my + 2);
    stroke(ctx, mouth, 4);
  } else {
    const open = lerp(5, 10, smooth(0.7, 1, worry));
    const o = ellipse(mx, my + 2, 8.5, open);
    ink(ctx, o, C.mouth, 0);
    ctx.save();
    ctx.clip(o);
    ctx.fillStyle = C.coral;
    ctx.fill(ellipse(mx, my + 2 + open, 7, 5));
    ctx.restore();
    ink(ctx, o, null, 4);
  }

  // sweat
  const drops: [number, number][] = [
    [head.cx - head.rx - 9, head.top + 26],
    [head.cx + head.rx + 8, head.top + 40],
    [chest.cx - chest.rx - 8, chest.top + 26],
    [head.cx - head.rx * 0.2, head.top - 30],
    [chest.cx + chest.rx + 9, chest.top + 30],
    [base.cx - base.rx - 6, base.top + 20],
  ];
  const count = Math.min(drops.length, Math.round(m * 7));
  for (let i = 0; i < count; i++) {
    const phase = (t * 0.55 + i * 0.37) % 1;
    const [dx, dy] = drops[i]!;
    ctx.globalAlpha = t > 0 ? 1 - phase * phase : 1;
    ink(ctx, teardrop(dx, dy + phase * 20, 4.6), C.drop, 3);
    ctx.globalAlpha = 1;
  }

  // ---- bowler hat, which slips as things get bad ----
  ctx.save();
  const slip = smooth(0.7, 0.92, m);
  ctx.translate(head.cx + (head.lean ?? 0) - 3 - 9 * slip, head.top + 5 + 5 * slip);
  ctx.rotate(-0.13 - 0.3 * slip + Math.sin(t * 2.1) * 0.012);
  const crown = new Path2D();
  crown.moveTo(-31, 3);
  crown.bezierCurveTo(-35, -46, 35, -46, 31, 3);
  crown.closePath();
  ink(ctx, crown, C.hat, 0);
  ctx.save();
  ctx.clip(crown);
  ctx.fillStyle = C.hatLight;
  ctx.fill(ellipse(13, -23, 9, 5, -0.5));
  ctx.fillStyle = C.coral;
  ctx.fillRect(-36, -10, 72, 11);
  ctx.restore();
  const bandEdge = new Path2D();
  bandEdge.moveTo(-34, -10);
  bandEdge.lineTo(34, -10);
  ctx.save();
  ctx.clip(crown);
  stroke(ctx, bandEdge, 3);
  ctx.restore();
  ink(ctx, crown, null, LW);
  ink(ctx, ellipse(0, 3, 47, 9), C.hat, LW);
  const shine = new Path2D();
  shine.moveTo(16, 0);
  shine.quadraticCurveTo(29, 0.5, 37, 2.5);
  stroke(ctx, shine, 2.5, C.hatLight);
  ctx.restore();
}
