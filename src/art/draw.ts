import { C } from './palette';

export type Ctx = CanvasRenderingContext2D;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** 0 below `a`, 1 above `b`, eased in between. */
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export interface Blob {
  cx: number;
  top: number;
  bottom: number;
  rx: number;
  /** How far down the widest point sits: 0.5 is an ellipse, 0.8 is a gumdrop. */
  f?: number;
  /** 0 is a round bottom, 1 is flat on the ground. */
  flat?: number;
  /** Sideways shift of the top, so a ball can lean. */
  lean?: number;
}

/** A snowball that can sag from a round ball into a mound. */
export function blob(b: Blob): Path2D {
  const { cx, top, bottom, rx } = b;
  const f = b.f ?? 0.5;
  const flat = b.flat ?? 0;
  const tx = cx + (b.lean ?? 0);
  const k = 0.5523;
  const ym = top + (bottom - top) * f;
  const kb = k + (0.94 - k) * flat;
  const p = new Path2D();
  p.moveTo(tx, top);
  p.bezierCurveTo(tx + rx * k, top, cx + rx, ym - (ym - top) * k, cx + rx, ym);
  p.bezierCurveTo(cx + rx, ym + (bottom - ym) * k, cx + rx * kb, bottom, cx, bottom);
  p.bezierCurveTo(cx - rx * kb, bottom, cx - rx, ym + (bottom - ym) * k, cx - rx, ym);
  p.bezierCurveTo(cx - rx, ym - (ym - top) * k, tx - rx * k, top, tx, top);
  p.closePath();
  return p;
}

export function ellipse(cx: number, cy: number, rx: number, ry: number, rot = 0): Path2D {
  const p = new Path2D();
  p.ellipse(cx, cy, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, Math.PI * 2);
  return p;
}

/** Flat fill plus the ink outline. */
export function ink(ctx: Ctx, path: Path2D, fill: string | null, lw = 5, stroke: string = C.ink) {
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill(path);
  }
  if (lw > 0) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke(path);
  }
}

/**
 * Two-tone cel shading: the shape is filled with the shade colour, then the
 * same shape is filled again in the lit colour, shifted toward the light.
 * What is left uncovered is a crescent of shadow on the far side.
 */
export function cel(ctx: Ctx, path: Path2D, lit: string, shade: string, dx: number, dy: number) {
  ctx.save();
  ctx.clip(path);
  ctx.fillStyle = shade;
  ctx.fill(path);
  ctx.translate(dx, dy);
  ctx.fillStyle = lit;
  ctx.fill(path);
  ctx.restore();
}

/** A thick coloured line with an ink outline (scarves, twigs, poles). */
export function inkLine(ctx: Ctx, path: Path2D, color: string, w: number, lw = 4, cap: CanvasLineCap = 'round') {
  ctx.lineJoin = 'round';
  ctx.lineCap = cap;
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = w + lw * 2;
  ctx.stroke(path);
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.stroke(path);
}

/** A bare ink stroke. */
export function stroke(ctx: Ctx, path: Path2D, w: number, color: string = C.ink) {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.stroke(path);
}

/** A falling drop, point up. */
export function teardrop(x: number, y: number, r: number): Path2D {
  const p = new Path2D();
  p.moveTo(x, y - r * 1.9);
  p.bezierCurveTo(x + r * 0.2, y - r, x + r, y - r * 0.5, x + r, y + r * 0.1);
  p.arc(x, y + r * 0.1, r, 0, Math.PI);
  p.bezierCurveTo(x - r, y - r * 0.5, x - r * 0.2, y - r, x, y - r * 1.9);
  p.closePath();
  return p;
}
