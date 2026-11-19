import { C, mix } from './palette';
import { cel, clamp01, ellipse, ink, lerp, smooth, stroke, type Ctx } from './draw';

/**
 * Ray, the sun. Smug, theatrical, and far too pleased with himself.
 * Drawn around (0, 0) with a disc radius of 40 units; the caller scales him.
 * `heat` runs from 0 (a pleasant day) to 1 (gloating).
 */
export interface RayState {
  heat: number;
  t: number;
}

const LW = 5;

export function drawRay(ctx: Ctx, s: RayState): void {
  const h = clamp01(s.heat);
  const t = s.t;
  const R = 40;

  // rays: twelve chunky spikes, slowly turning, alternately long and short
  const rayFill = mix(C.ray, C.sunHot, h);
  const spin = t * 0.22;
  for (let i = 0; i < 12; i++) {
    const a = spin + (i * Math.PI) / 6;
    const long = i % 2 === 0;
    const pulse = 1 + 0.035 * Math.sin(t * 3 + i * 1.3);
    const outer = R * (long ? 1.56 : 1.36) * pulse;
    const half = long ? 0.23 : 0.19;
    const p = new Path2D();
    p.moveTo(Math.cos(a - half) * R * 0.96, Math.sin(a - half) * R * 0.96);
    p.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
    p.lineTo(Math.cos(a + half) * R * 0.96, Math.sin(a + half) * R * 0.96);
    p.closePath();
    ink(ctx, p, rayFill, LW);
  }

  // the disc
  const disc = ellipse(0, 0, R, R);
  cel(ctx, disc, mix(C.sun, '#ffc233', h), mix(C.sunShade, C.sunHot, h * 0.7), 6, -6);
  ink(ctx, disc, null, LW);

  // cheeks
  ctx.fillStyle = mix(C.ray, C.sunHot, 0.4 + h * 0.6);
  ctx.fill(ellipse(-24, 9, 6, 4.5));
  ctx.fill(ellipse(25, 8, 6, 4.5));

  // eyes: half-lidded, looking down at the snowman
  const gloat = smooth(0.55, 1, h);
  for (const side of [-1, 1] as const) {
    const ex = side * 13.5;
    const ey = -7;
    const eye = ellipse(ex, ey, 9, 10.5);
    ink(ctx, eye, C.snow, 0);
    ctx.save();
    ctx.clip(eye);
    ctx.fillStyle = C.ink;
    ctx.fill(ellipse(ex - 3 + Math.sin(t * 0.8) * 0.6, ey + 3.5, 4.6, 5.2));
    // the lid: lower means smugger
    const lidY = ey - 10.5 + lerp(9.5, 7, gloat) + (side > 0 ? -2.5 : 0);
    ctx.fillStyle = mix(C.sunShade, C.sunHot, h * 0.7);
    ctx.fillRect(ex - 12, ey - 14, 24, lidY - (ey - 14));
    const lid = new Path2D();
    lid.moveTo(ex - 12, lidY);
    lid.lineTo(ex + 12, lidY);
    stroke(ctx, lid, 3.5);
    ctx.restore();
    ink(ctx, eye, null, 3.5);
  }
  // brows: one flat and low, one arched high
  const browL = new Path2D();
  browL.moveTo(-24, -19);
  browL.lineTo(-6, -16.5);
  stroke(ctx, browL, 4.5);
  const browR = new Path2D();
  browR.moveTo(5, -22);
  browR.quadraticCurveTo(15, -31 - 2 * gloat, 26, -22);
  stroke(ctx, browR, 4.5);

  // mouth: a smirk that opens into a toothy grin as the heat rises
  if (gloat < 0.5) {
    const m = new Path2D();
    m.moveTo(-12, 15);
    m.quadraticCurveTo(3, 24, 16, 11);
    m.moveTo(14.5, 7.5);
    m.lineTo(18, 13);
    stroke(ctx, m, 4.5);
  } else {
    const g = new Path2D();
    g.moveTo(-15, 12);
    g.quadraticCurveTo(2, 15, 18, 8);
    g.quadraticCurveTo(15, 29, -2, 27);
    g.quadraticCurveTo(-13, 25, -15, 12);
    g.closePath();
    ink(ctx, g, C.mouth, 0);
    ctx.save();
    ctx.clip(g);
    ctx.fillStyle = C.snow;
    ctx.fillRect(-20, 6, 44, 10.5);
    ctx.fillStyle = C.coral;
    ctx.fill(ellipse(3, 29, 9, 6));
    ctx.restore();
    ink(ctx, g, null, 4);
  }
}
