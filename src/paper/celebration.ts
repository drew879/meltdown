// Draws the win celebration over the play screen's scene: the snowman does a
// backflip, the sun sulks, a cloud rolls over it and snow falls. What happens
// when is in celebration-timeline.ts; this draws one frame of it at a time.
//
// While it plays, the plain snowman is faded out (not removed, so screen
// readers still get his description) and a copy of him made of the win poses
// takes his place, standing exactly where he stood. Its pictures load as soon
// as the play screen is made (art.ts leaves them out of the first-load preload).
import './celebration.css';
import { art, manifest, type Piece } from './art';
import {
  CLOUD_TO,
  FLAKES,
  TOTAL_MS,
  clampedLift,
  cloudProgress,
  flakeFall,
  keyAt,
} from './celebration-timeline';

/** Where things are in the scene, worked out by the play screen. All in pixels. */
export interface SceneMetrics {
  width: number;
  height: number;
  /** how tall the fresh snowman stands */
  full: number;
  /** pixels per source pixel of every snowman piece */
  k: number;
  /** the grass line his feet stand on */
  baseY: number;
  /** the middle of him, left to right */
  centerX: number;
  /** the middle of the sun and its width */
  sunX: number;
  sunY: number;
  sunSize: number;
}

export interface Celebration {
  layout(metrics: SceneMetrics): void;
  /** A win has just happened and the snowman has sprung back to full size: play it. */
  play(): void;
  /** A won round is on screen without having just been won (a refresh, or reduced motion): show how it ends. */
  showRest(): void;
  /** The round is not won: the plain snowman stands in the scene. */
  reset(): void;
  destroy(): void;
}

type Mode = 'idle' | 'playing' | 'rest';

function img(piece: Piece, className = ''): HTMLImageElement {
  const el = new Image();
  el.alt = '';
  el.src = art(piece);
  el.className = className;
  el.draggable = false;
  return el;
}

export function createCelebration(scene: HTMLElement, snowman: HTMLImageElement): Celebration {
  // ---- the pieces, all inside one box that clips what leaves the scene ----
  const poseImgs = new Map<Piece, HTMLImageElement>();
  const actor = document.createElement('div');
  actor.className = 'pp-cel-actor';
  for (const piece of ['snowman-0', 'win-backflip-1', 'win-backflip-2', 'win-backflip-3', 'win-backflip-4'] as Piece[]) {
    const pose = img(piece);
    pose.hidden = piece !== 'snowman-0';
    poseImgs.set(piece, pose);
    actor.append(pose);
  }
  const ground = document.createElement('div');
  ground.className = 'pp-cel-ground';
  const cloud = img('cloud', 'pp-cel-cloud');
  const flakeImgs = FLAKES.map((f) => {
    const flake = img(f.piece, 'pp-cel-flake');
    flake.hidden = true;
    return flake;
  });
  const box = document.createElement('div');
  box.className = 'pp-cel';
  box.hidden = true;
  box.append(
    cloud,
    ...flakeImgs.filter((_, i) => FLAKES[i]!.behind),
    ground,
    actor,
    ...flakeImgs.filter((_, i) => !FLAKES[i]!.behind),
  );
  scene.append(box);

  // ---- layout, from the play screen's numbers ----
  let m: SceneMetrics | null = null;
  let cloudW = 0;
  let cloudH = 0;
  let cloudLeft = 0;
  let cloudTop = 0;

  function layout(metrics: SceneMetrics) {
    m = metrics;
    for (const [piece, pose] of poseImgs) {
      const size = manifest[piece];
      pose.style.width = `${size.w * m.k}px`;
      pose.style.height = `${size.h * m.k}px`;
      pose.style.left = `${(-size.w * m.k) / 2}px`;
      pose.style.top = `${-size.h * m.k}px`;
    }
    actor.style.left = `${m.centerX}px`;
    actor.style.top = `${m.baseY}px`;
    ground.style.width = `${m.full * 0.7}px`;
    ground.style.left = `${m.centerX - m.full * 0.35}px`;
    ground.style.top = `${m.baseY - 8}px`;

    // wide enough that its big middle puff (just over half way along, about a third of its width)
    // sits right over the sun, even when the sun has grown with the heat
    cloudW = Math.min(m.width * 1.6, Math.max(m.width * 1.15, m.sunSize * 4));
    cloudH = (cloudW * manifest.cloud.h) / manifest.cloud.w;
    cloudLeft = m.sunX - cloudW * 0.52;
    cloudTop = m.sunY - cloudH * 0.52;
    cloud.style.width = `${cloudW}px`;
    cloud.style.height = `${cloudH}px`;
    FLAKES.forEach((f, i) => (flakeImgs[i]!.style.width = `${f.size * m!.width}px`));
    draw(lastT);
  }

  // ---- one frame: where is everything at t ms? ----
  let lastT = 0;
  let shown: Piece = 'snowman-0';
  function draw(t: number) {
    lastT = t;
    if (!m || mode === 'idle') return;
    const key = keyAt(t);
    if (key.piece !== shown) {
      poseImgs.get(shown)!.hidden = true;
      poseImgs.get(key.piece)!.hidden = false;
      shown = key.piece;
    }
    const size = manifest[key.piece];
    const ph = size.h * m.k;
    const lift = clampedLift(key, size.w * m.k, ph, m.full, m.baseY);
    actor.style.transformOrigin = key.centre ? `0px ${-ph / 2}px` : '0px 0px';
    actor.style.transform = `translateY(${-lift}px) rotate(${key.rot ?? 0}deg) scale(${key.sx ?? 1}, ${key.sy ?? 1})`;
    // his shadow on the grass shrinks and fades as he rises
    const up = Math.min(1, lift / (0.5 * m.full));
    ground.style.transform = `scale(${1 - 0.5 * up}, ${1 - 0.4 * up})`;
    ground.style.opacity = String(1 - 0.6 * up);

    // the cloud rolls in over the sun, then bobs a little until the end
    const q = cloudProgress(t);
    cloud.hidden = q === null;
    if (q !== null) {
      const bob = t > CLOUD_TO && t < TOTAL_MS && Math.floor(t / 600) % 2 === 1 ? 3 : 0;
      cloud.style.transform = `translate(${cloudLeft + (1 - q) * (m.width - cloudLeft)}px, ${cloudTop + bob}px)`;
    }

    // snow
    FLAKES.forEach((f, i) => {
      const flake = flakeImgs[i]!;
      const fall = flakeFall(f, t);
      flake.hidden = fall === null;
      if (fall === null || !m) return;
      const size = f.size * m.width;
      const x0 = 0.03 * m.width + f.across * (cloudLeft + cloudW * 0.88 - 0.03 * m.width);
      const y0 = cloudTop + cloudH * 0.8;
      const y1 = m.baseY - f.land * m.full - size;
      const x = x0 + f.drift * m.width * fall + Math.sin(f.phase + fall * 7) * f.sway * m.width;
      const y = y0 + (y1 - y0) * fall;
      const fade = fall < 0.1 ? fall / 0.1 : fall > 0.85 ? (1 - fall) / 0.15 : 1;
      flake.style.opacity = String(Math.max(0, fade));
      flake.style.transform = `translate(${x}px, ${y}px) rotate(${f.turn0 + f.turn * fall}deg)`;
    });
  }

  // ---- the clock ----
  let mode: Mode = 'idle';
  let raf = 0;
  let t0 = 0;
  /** Bumped whenever the celebration is stopped, so a wait for the pictures that began earlier knows it is out of date. */
  let run = 0;

  // The plain snowman must not fade out before the pictures that replace him are loaded.
  const loaded = Promise.all(
    [...poseImgs.values(), cloud].map((picture) => picture.decode().catch(() => undefined)),
  );
  function whenLoaded(go: () => void) {
    const mine = run;
    void loaded.then(() => mine === run && go());
  }

  function stopClock() {
    run++;
    cancelAnimationFrame(raf);
  }
  function show(active: boolean) {
    box.hidden = !active;
    snowman.classList.toggle('away', active);
  }
  function frame(now: number) {
    const t = now - t0;
    if (t >= TOTAL_MS) return finish();
    draw(t);
    raf = requestAnimationFrame(frame);
  }
  function begin() {
    t0 = performance.now();
    show(true);
    draw(0);
    raf = requestAnimationFrame(frame);
  }
  function finish() {
    mode = 'rest';
    show(true);
    draw(TOTAL_MS);
  }

  return {
    layout,
    play() {
      if (mode !== 'idle') return;
      stopClock();
      mode = 'playing'; // claimed now, so a second call before the pictures are ready does nothing
      whenLoaded(begin);
    },
    showRest() {
      if (mode !== 'idle') return; // already playing, or already at rest
      stopClock();
      mode = 'rest';
      whenLoaded(finish);
    },
    reset() {
      stopClock();
      mode = 'idle';
      show(false);
    },
    destroy() {
      stopClock();
      mode = 'idle';
      box.remove();
    },
  };
}
