/**
 * The Relighting. [SCN-FLOW] — GDD-00 §2 (the six lit flags), §11 (the-relighting, the-crossing,
 * the-reading, credits-dawn, coda-morning), GDD-09 §3.26 and the §5 beam juice.
 *
 * The scene is the visual director of the finale. It plays its set-pieces in order and hands the
 * story to the story scripts between them:
 *
 *   lamp-room  the Lamp Room at dusk: the beehive lens dark, the town small through the panes
 *   hand       Ambrose's paw flat on the curved stone wall
 *   lens       the lamp lit from your porch lamp (12 f flare); the lens catches in three dither
 *              steps × 10 f, ring by ring from the burner out
 *   beam       the shore at dusk: the first sweep takes 16 s (render/lightPass.BEAM_FIRST_SWEEP_MS),
 *              then one every 8 s; the Skyband fills amber over 240 f
 *   porches    every lit porch pulses once as the beam passes, staggered 2 f by distance
 *   horn       out past the Bar a horn answers with Your Signal (the player's six chimes, an octave
 *              down)
 *   -> story   `the-crossing`, then `the-reading` (story scripts drive the Reading's battle phases),
 *              each pushed as a cutscene over this scene when the data has it
 *   descent    (only when no Reading script exists) the comet comes down to the Lantern Stack
 *   dawn       the beam fading into morning: the coda's first light
 *   -> credits
 *
 * **Ops for the cutscene host.** {@link SET_PIECES} names the set-pieces; {@link playSetPiece}
 * plays one (pushes this scene with `{single: id}`) and resolves when it ends, so a host can map an
 * op such as `{op: 'relight', piece: 'lens'}` onto it. A running ending scene also answers
 * `scene.play(id) -> Promise`.
 *
 * **Trigger.** {@link installEndingTrigger} (boot installs it once) watches `flag:set lit.calls`:
 * when the story's Relighting script has set it and the stack is back on the overworld, the
 * ending is pushed (once per run; `sp.credits-seen` ends it). `?scene=ending` opens it directly.
 *
 * Input: `confirm` hurries a caption; holding `cancel` for 0.7 s skips the current set-piece (never
 * the story scripts). Reduced motion swaps the sweeps for dither fades.
 * @module scenes/ending
 */
import { drawText, measureText } from '../core/font.js';
import { t } from '../data/strings.js';
import { COLORS, PALETTE } from '../ui/theme.js';
import { drawPanel } from '../ui/panel.js';
import { drawShoreView } from '../render/sky.js';
import { ditherDisc } from '../render/lightPass.js';
import { BAYER4, hash2 } from '../render/surface.js';
import { charSprite, playerSprite, walkStep } from '../art/chars/index.js';
import { getCreatureSprite } from '../art/creatures/index.js';
import { drawSprite } from '../core/pixelart.js';
import {
  cardFromWorld, signalOfWorld, DEFAULT_SIGNAL, CHIME_SEMIS, litPorchCount, reducedMotionOf, flowFade,
} from './flowKit.js';

/** Set-pieces in their default order. */
export const SET_PIECES = Object.freeze(['lamp-room', 'hand', 'lens', 'beam', 'porches', 'horn', 'descent', 'dawn']);

/** Story scripts the ending hands to, in order, when the data has them. */
export const STORY_SCRIPTS = Object.freeze({ crossing: 'the-crossing', reading: 'the-reading', dawn: 'credits-dawn', coda: 'coda-morning' });

/** Set-piece lengths (ms) and their captions. */
export const PIECES = Object.freeze({
  'lamp-room': { ms: 5200, caption: 'The Lamp Room, at dusk. Thirty years of dust and one new wick.' }, // str
  hand: { ms: 3800, caption: 'Ambrose lays a paw flat on the wall, the way he reads a stick.' }, // str
  lens: { ms: 4200, caption: 'You light it from your own porch lamp. The lens catches.' }, // str
  beam: { ms: 16000, caption: 'The beam goes round. It takes its time the first time.' }, // str
  porches: { ms: 4500, caption: 'Every lit porch pulses once.' }, // str
  horn: { ms: 5200, caption: 'Out past the Bar, a horn answers with your Signal.' }, // str
  descent: { ms: 6500, caption: 'Light calls the change.' }, // str
  dawn: { ms: 6000, caption: '' },
});

/** Hold cancel this long to skip a set-piece. */
export const SKIP_HOLD_MS = 700;

/**
 * The step queue for a full ending (pure): set-pieces and story scripts.
 * @param {(id: string) => boolean} hasScript
 * @returns {Array<{kind: 'piece'|'script', id: string}>}
 */
export function endingSteps(hasScript) {
  const P = (id) => ({ kind: 'piece', id });
  const S = (id) => ({ kind: 'script', id });
  const out = [P('lamp-room'), P('hand'), P('lens'), P('beam'), P('porches'), P('horn')];
  if (hasScript(STORY_SCRIPTS.crossing)) out.push(S(STORY_SCRIPTS.crossing));
  if (hasScript(STORY_SCRIPTS.reading)) out.push(S(STORY_SCRIPTS.reading));
  else out.push(P('descent'));
  out.push(P('dawn'));
  if (hasScript(STORY_SCRIPTS.dawn)) out.push(S(STORY_SCRIPTS.dawn));
  return out;
}

/**
 * Plays one set-piece over whatever is on the stack and resolves when it ends.
 * @param {any} G
 * @param {string} id  one of {@link SET_PIECES}
 * @param {{caption?: string}} [o]
 * @returns {Promise<void>}
 */
export function playSetPiece(G, id, o = {}) {
  return new Promise((resolve) => {
    if (!SET_PIECES.includes(id)) { resolve(); return; }
    G.push('ending', { single: id, caption: o.caption, onDone: resolve });
  });
}

/**
 * Installs the bus listeners that start the ending once per run (idempotent per G).
 * @param {any} G
 * @returns {() => void} uninstall
 */
export function installEndingTrigger(G) {
  if (!G || !G.bus || typeof G.bus.on !== 'function') return () => {};
  if (G.__endingTrigger) return G.__endingTrigger;
  let pending = Boolean(G.world?.flags?.['lit.calls'] && !G.world?.flags?.['sp.credits-seen']);
  const seen = () => G.world?.flags?.['sp.credits-seen'] === true;
  const tryStart = () => {
    if (!pending || seen()) return;
    const top = G.scenes?.top?.();
    if (!top || top.name !== 'overworld' || G.scenes.isTransitioning) return;
    if (G.scenes.find?.('ending') || G.scenes.find?.('credits')) return;
    pending = false;
    const start = () => G.push('ending', {});
    if (!G.scenes.transition('fade', flowFade(G, 600), start, { color: PALETTE.nightInk })) start();
  };
  const offs = [
    G.bus.on('flag:set', (p) => { if (p && p.id === 'lit.calls' && p.value && !p.prev) { pending = true; Promise.resolve().then(tryStart); } }),
    G.bus.on('scene:change', () => { Promise.resolve().then(tryStart); }),
    G.bus.on('world:replaced', () => { pending = Boolean(G.world?.flags?.['lit.calls'] && !seen()); Promise.resolve().then(tryStart); }),
  ];
  G.__endingTrigger = () => { for (const off of offs) { try { if (typeof off === 'function') off(); } catch { /* already gone */ } } G.__endingTrigger = null; };
  return G.__endingTrigger;
}

// ---------------------------------------------------------------------------------------------
// Drawing helpers (pure canvas work; each takes the piece's progress k in 0..1 and its ms)
// ---------------------------------------------------------------------------------------------

const GLASS = ['#2B3A67', '#3B5DC9', '#41A6F6', '#94B0C2'];
const AMBER = ['#7A4A1E', '#C98A2E', '#FFB547', '#FFE29A'];

function sky(ctx, top, bottom, x, y, w, h) {
  const steps = 10;
  for (let i = 0; i < steps; i++) {
    ctx.fillStyle = mix(top, bottom, i / (steps - 1));
    ctx.fillRect(x, y + Math.floor((i * h) / steps), w, Math.ceil(h / steps) + 1);
  }
}

function mix(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - k) + ((pb >> 16) & 255) * k);
  const g = Math.round(((pa >> 8) & 255) * (1 - k) + ((pb >> 8) & 255) * k);
  const bl = Math.round((pa & 255) * (1 - k) + (pb & 255) * k);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

/** Dithered rect fill at a density 0..1 (Bayer 4×4). */
function dither(ctx, x, y, w, h, color, density) {
  if (density <= 0) return;
  ctx.fillStyle = color;
  if (density >= 1) { ctx.fillRect(x, y, w, h); return; }
  const th = density * 16;
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (BAYER4[((yy & 3) << 2) | (xx & 3)] < th) ctx.fillRect(xx, yy, 1, 1);
}

/** The lantern room: panes onto the dusk, the iron frame, the gallery rail, the town far below. */
function drawLampRoom(ctx, lit, ms, G) {
  sky(ctx, '#1B2140', '#C46A4A', 0, 0, 480, 170);
  // the sea and the town below the panes
  ctx.fillStyle = '#26294F'; ctx.fillRect(0, 140, 480, 40);
  ctx.fillStyle = '#3B2D5E'; ctx.fillRect(0, 150, 480, 2);
  for (let i = 0; i < 28; i++) {
    const x = 20 + ((i * 53) % 440), y = 142 + ((i * 7) % 8);
    ctx.fillStyle = i % 3 === 0 ? PALETTE.porchAmber : '#1E2236';
    ctx.fillRect(x, y, i % 3 === 0 ? 1 : 3, i % 3 === 0 ? 1 : 2);
  }
  // window frames: four tall panes with iron astragals
  ctx.fillStyle = '#141B33';
  for (const x of [0, 118, 236, 354, 472]) ctx.fillRect(x, 0, 8, 186);
  ctx.fillRect(0, 0, 480, 10); ctx.fillRect(0, 92, 480, 4);
  // the stone and iron floor of the lantern room
  ctx.fillStyle = '#2A2433'; ctx.fillRect(0, 186, 480, 84);
  ctx.fillStyle = '#3E3A4A';
  for (let x = 0; x < 480; x += 12) ctx.fillRect(x, 190, 10, 2);
  ctx.fillStyle = '#4A4458'; ctx.fillRect(0, 186, 480, 3);
  // brass rail
  ctx.fillStyle = COLORS.brass.dark; ctx.fillRect(0, 176, 480, 3);
  ctx.fillStyle = COLORS.brass.fill; ctx.fillRect(0, 176, 480, 1);
  for (let x = 20; x < 480; x += 40) { ctx.fillStyle = COLORS.brass.dark; ctx.fillRect(x, 176, 2, 12); }
  drawLens(ctx, 240, 112, lit, ms);
  // figures: you by the lens, Wick and Juniper behind
  try {
    const you = playerSprite(cardFromWorld(G.world), 'right', 0, { scale: 2 });
    drawSprite(ctx, you, 150, 186 - you.h + 4);
    const wick = charSprite('wick', 'left', 0, { scale: 2 });
    drawSprite(ctx, wick, 300, 186 - wick.h + 4);
    const jun = charSprite('juniper', 'down', walkStep(0), { scale: 2 });
    drawSprite(ctx, jun, 330, 186 - jun.h + 2);
  } catch { /* figures are decoration */ }
  void ms;
}

/** The beehive Fresnel lens: stacked prism rings; `lit` 0..1 warms them ring by ring from the burner. */
function drawLens(ctx, cx, cy, lit, ms) {
  const rings = 15;
  // brass pedestal
  ctx.fillStyle = COLORS.brass.dark; ctx.fillRect(cx - 26, cy + 58, 52, 16);
  ctx.fillStyle = COLORS.brass.fill; ctx.fillRect(cx - 24, cy + 58, 48, 2);
  ctx.fillStyle = COLORS.brass.dark; ctx.fillRect(cx - 34, cy + 72, 68, 6);
  for (let i = 0; i < rings; i++) {
    const t = i / (rings - 1);
    const y = cy - 56 + i * 8;
    const half = Math.round(18 + Math.sin(t * Math.PI) * 26);
    const d = Math.abs(i - 7);
    // ring catches at lit*3 steps: centre first, then outward
    const step = Math.max(0, Math.min(3, Math.floor(lit * 3 * (1 + 7 / 7) - d * 0.45)));
    const ramp = step > 0 ? AMBER : GLASS;
    const base = step > 0 ? Math.min(3, step) : 0;
    ctx.fillStyle = ramp[base]; ctx.fillRect(cx - half, y, half * 2, 6);
    ctx.fillStyle = ramp[Math.min(3, base + 1)]; ctx.fillRect(cx - half + 2, y + 1, half * 2 - 4, 2);
    ctx.fillStyle = '#141B33'; ctx.fillRect(cx - half, y + 6, half * 2, 2);
    // glints sliding over the glass
    const g = (Math.floor(ms / 90) + i * 5) % (half * 2);
    ctx.fillStyle = step > 0 ? '#FFF1C4' : '#C8E4F0';
    ctx.fillRect(cx - half + g, y + 1, 2, 1);
  }
  // the burner at the heart
  if (lit > 0) {
    const halo = ditherDisc(30 + lit * 40, 24 + lit * 30, '#FFB547', Math.min(1, 0.3 + lit * 0.6));
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(halo.canvas, cx - halo.rx, cy - halo.ry);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.fillStyle = lit > 0 ? '#FFE29A' : '#3B4A6B';
  ctx.fillRect(cx - 3, cy - 4, 6, 8);
}

/** Close-up: curved sandstone blocks in dusk light; a beaver's paw slides in and rests flat. */
function drawHand(ctx, k, ms) {
  sky(ctx, '#7D4D5C', '#C98A5E', 0, 0, 480, 270);
  for (let row = 0; row < 8; row++) {
    const y = row * 36 - 10;
    const off = row % 2 ? 0 : 60;
    for (let col = -1; col < 5; col++) {
      const x = col * 120 + off;
      const shade = (hash2(row, col + 9) % 3);
      ctx.fillStyle = ['#B98A62', '#A87C58', '#C69A70'][shade];
      ctx.fillRect(x + 2, y + 2, 116, 32);
      ctx.fillStyle = '#8A6446'; ctx.fillRect(x + 2, y + 32, 116, 2); ctx.fillRect(x + 116, y + 2, 2, 32);
      ctx.fillStyle = '#D8B088'; ctx.fillRect(x + 2, y + 2, 116, 1);
      for (let s = 0; s < 7; s++) { ctx.fillStyle = '#9A7050'; ctx.fillRect(x + 8 + ((s * 37 + row * 11) % 100), y + 8 + ((s * 13) % 20), 2, 1); }
    }
  }
  // warm light raking from the left
  dither(ctx, 0, 0, 160, 270, '#F9C46B', 0.12);
  // the paw: brown, broad, four fingers, short claws; slides up from the bottom right then rests
  const e = 1 - Math.pow(1 - Math.min(1, k * 2.2), 3);
  const px = 250 + Math.round((1 - e) * 120), py = 120 + Math.round((1 - e) * 140) + (k > 0.6 ? Math.round(Math.sin((k - 0.6) * 20) * 0.6) : 0);
  ctx.fillStyle = '#4A2E1C'; // shadow on the stone
  ctx.globalAlpha = 0.35; ctx.fillRect(px + 6, py + 8, 96, 150); ctx.globalAlpha = 1;
  ctx.fillStyle = '#6A4228';
  ctx.fillRect(px + 10, py + 46, 70, 130); // wrist / forearm
  ctx.fillStyle = '#7A4E30';
  ctx.fillRect(px, py + 20, 90, 50);       // palm
  for (let f = 0; f < 4; f++) {
    const fx = px + 2 + f * 22, fl = [26, 32, 30, 22][f];
    ctx.fillStyle = '#7A4E30'; ctx.fillRect(fx, py + 20 - fl, 18, fl + 4);
    ctx.fillStyle = '#8E5E3A'; ctx.fillRect(fx + 2, py + 22 - fl, 6, fl);
    ctx.fillStyle = '#E6DCC3'; ctx.fillRect(fx + 6, py + 16 - fl, 6, 4);   // claw
  }
  ctx.fillStyle = '#5A3820'; ctx.fillRect(px, py + 66, 90, 4);
  void ms;
}

/** The comet coming down to the Lantern Stack under the beam (no Reading script in the data). */
function drawDescent(ctx, k, ms, G) {
  sky(ctx, '#0D1021', '#26224F', 0, 0, 480, 190);
  for (let i = 0; i < 70; i++) { ctx.fillStyle = i % 5 ? '#94B0C2' : '#EAF2F8'; ctx.fillRect((i * 97) % 480, (i * 31) % 170, 1, 1); }
  ctx.fillStyle = '#141B33'; ctx.fillRect(0, 190, 480, 80);
  ctx.fillStyle = '#1E2747'; for (let y = 194; y < 270; y += 6) ctx.fillRect(0, y, 480, 1);
  // the Lantern Stack: a sea stack right of centre
  ctx.fillStyle = '#0B0F22';
  ctx.fillRect(300, 150, 40, 42); ctx.fillRect(306, 136, 26, 16); ctx.fillRect(312, 128, 12, 10);
  // the comet descends from top right to the stack
  const e = Math.min(1, k * 1.25);
  const cx = Math.round(470 - e * 152), cy = Math.round(10 + e * 112);
  ctx.fillStyle = PALETTE.m;
  for (let i = 0; i < 40; i++) { const tx = cx + i * 3, ty = cy - i * 2; if ((i + Math.floor(ms / 80)) % 3) ctx.fillRect(tx, ty, 2, 1); }
  const halo = ditherDisc(14 + e * 20, 14 + e * 20, PALETTE.m, 0.5);
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(halo.canvas, cx - halo.rx, cy - halo.ry);
  ctx.globalCompositeOperation = 'source-over';
  if (k > 0.75) {
    try {
      const v = getCreatureSprite('vagary');
      if (v) { ctx.globalAlpha = Math.min(1, (k - 0.75) * 4); drawSprite(ctx, v, 320 - Math.round(v.w / 2), 128 - v.h + 8); ctx.globalAlpha = 1; }
    } catch { /* the Vagary is drawn by the Reading */ }
  }
  ctx.fillStyle = '#FFE29A'; ctx.fillRect(cx - 1, cy - 1, 3, 3);
  // the beam from the point at the left
  const a = (ms / 8000) * Math.PI * 2;
  const reach = 300 * Math.abs(Math.cos(a)) + 20;
  if (Math.cos(a) > 0) dither(ctx, 40, 150, Math.round(reach), 6, '#FFB547', 0.25);
  ctx.fillStyle = '#0B0F22'; ctx.fillRect(20, 150, 24, 40); ctx.fillStyle = '#FFB547'; ctx.fillRect(30, 146, 4, 4);
  void G;
}

// ---------------------------------------------------------------------------------------------
// The scene
// ---------------------------------------------------------------------------------------------

/**
 * @param {object} G
 * @returns {import('../core/scene.js').Scene & {debugText: () => string, play: (id: string) => Promise<void>, step: () => object|null}}
 */
export function createEndingScene(G) {
  let params = {};
  let steps = [];
  let si = -1;
  let piece = null;      // current set-piece id
  let pms = 0;           // ms into the piece
  let total = 0;         // ms since enter
  let caption = '';
  let capMs = 0;
  let hurry = 1;
  let skipHold = 0;
  let waiting = false;   // a story script is running above us
  let done = false;
  let fadeIn = 0;
  let pulsed = new Set();
  let hornAt = -1;
  let beamStart = 0;
  let porches = 7;
  let single = null;

  const hasScript = (id) => { try { return Boolean(G.data?.has?.('scripts', id)); } catch { return false; } };

  function startStep() {
    const prev = steps[si];
    if (prev && typeof prev.resolve === 'function') { try { prev.resolve(); } catch { /* caller */ } prev.resolve = null; }
    si += 1;
    if (si >= steps.length) { finish(); return; }
    const s = steps[si];
    if (s.kind === 'script') {
      waiting = true;
      piece = s.id === STORY_SCRIPTS.reading ? 'descent' : piece; // keep a fitting backdrop under the letterbox
      G.push('cutscene', { scriptId: s.id, letterbox: true, onDone: () => { waiting = false; startStep(); } });
      return;
    }
    piece = s.id;
    pms = 0;
    caption = s.caption ?? PIECES[piece]?.caption ?? '';
    capMs = 0;
    skipHold = 0;
    onPieceStart(piece);
  }

  function onPieceStart(id) {
    try {
      if (id === 'lens') G.audio?.sfx?.('lantern', { volume: 0.8 });
      if (id === 'beam') { beamStart = 0; pulsed = new Set(); G.audio?.sfx?.('bell', { semitones: -12, volume: 0.6 }); }
      if (id === 'porches') pulsed = new Set();
      if (id === 'horn') hornAt = 600;
    } catch { /* audio is optional */ }
  }

  function finish() {
    if (done) return;
    done = true;
    if (single) {
      if (typeof params.onDone === 'function') { try { params.onDone(); } catch { /* caller */ } }
      if (G.scenes.top() === scene) G.scenes.pop({ piece: single });
      return;
    }
    const showCredits = () => G.replaceWith('credits', { fromEnding: true });
    if (!G.scenes.transition('fade', flowFade(G, 800), showCredits, { color: PALETTE.nightInk })) showCredits();
  }

  function playHorn() {
    const sig = signalOfWorld(G.world) ?? DEFAULT_SIGNAL;
    try {
      sig.forEach((n, k) => G.audio?.sfx?.('bell', { semitones: CHIME_SEMIS[n] - 12, volume: 0.7, delay: k * 0.34 }));
    } catch { /* audio is optional */ }
    try { G.bus?.emit?.('sfx', { name: 'signalSting' }); } catch { /* optional */ }
  }

  function drawCaption(ctx) {
    if (!caption) return;
    const shown = Math.min(caption.length, Math.floor(capMs / 28));
    const w = Math.min(420, measureText(caption, { maxWidth: 400 }).w + 28);
    const x = Math.round(240 - w / 2), y = 226;
    drawPanel(ctx, { x, y, w, h: 24 }, 'paper', { alpha: Math.min(1, capMs / 100) });
    drawText(ctx, caption.slice(0, shown), x + 14, y + 8, { color: COLORS.paper.ink, maxWidth: w - 28 });
  }

  function letterbox(ctx) {
    ctx.fillStyle = PALETTE.nightInk;
    ctx.fillRect(0, 0, 480, 16);
    ctx.fillRect(0, 254, 480, 16);
  }

  /** Shore view with the relit lamp; porch pulses as the beam passes. */
  function drawBeam(ctx, minute, sweepMs, opts = {}) {
    const rm = reducedMotionOf(G);
    drawShoreView(ctx, { x: 0, y: 0, w: 480, h: 270 }, {
      minute, weather: 'clear', ms: sweepMs, day: 14, tide: 0.55, comet: 0.95,
      lighthouse: { stage: 7, lit: true, relitAt: 0 }, porches, reducedMotion: rm,
    });
    // the Skyband fills: a warm wash at the top over 240 f
    const fill = Math.min(1, sweepMs / 4000) * (opts.fill ?? 1);
    if (fill > 0) dither(ctx, 0, 0, 480, 40, '#F9C46B', 0.12 * fill);
    // porch pulses: one 3-step dither in, 3 out, staggered by distance from the lamp
    const hx = 336, horizon = Math.round(270 * 0.48);
    for (let i = 0; i < porches; i++) {
      const px = hx - 90 - i * 9 - (hash2(i, 41) % 4);
      const py = horizon - 1 - (hash2(i, 9) % 2);
      const at = (opts.pulseFrom ?? 2600) + i * 33;
      const tt = sweepMs - at;
      if (tt < 0 || tt > 400) continue;
      const step = tt < 200 ? Math.ceil(tt / 67) : Math.ceil((400 - tt) / 67);
      const d = ditherDisc(2 + step * 2, 1 + step, PALETTE.porchAmber, 0.25 + step * 0.2);
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(d.canvas, px - d.rx, py - d.ry);
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  function drawPiece(ctx) {
    const def = PIECES[piece] ?? { ms: 1000 };
    const k = Math.min(1, pms / def.ms);
    switch (piece) {
      case 'lamp-room': drawLampRoom(ctx, 0, total, G); break;
      case 'hand': drawHand(ctx, k, pms); break;
      case 'lens': {
        // Juniper's lantern flare (12 f), then three dither steps × 10 f per ring outward
        const lit = pms < 200 ? 0 : Math.min(1, (pms - 200) / 1500);
        drawLampRoom(ctx, lit, total, G);
        if (pms < 200) { const f = ditherDisc(10, 10, '#FFE29A', 1 - pms / 200); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(f.canvas, 240 - f.rx, 112 - f.ry); ctx.globalCompositeOperation = 'source-over'; }
        dither(ctx, 0, 0, 480, 270, '#FFB547', Math.min(0.18, lit * 0.18));
        break;
      }
      case 'beam': drawBeam(ctx, 18 * 60 + 50, pms, { pulseFrom: 999999 }); break;
      case 'porches': drawBeam(ctx, 18 * 60 + 55, 16000 + pms, { pulseFrom: 16000 + 600 }); break;
      case 'horn': {
        drawBeam(ctx, 19 * 60, 20500 + pms, { pulseFrom: 999999 });
        // a punt's lamp far out on the horizon, sound rings when the horn plays
        const bx = 70, by = Math.round(270 * 0.48) - 2;
        ctx.fillStyle = '#141B33'; ctx.fillRect(bx - 6, by, 12, 2); ctx.fillRect(bx - 1, by - 5, 1, 5);
        ctx.fillStyle = PALETTE.porchAmber; ctx.fillRect(bx + 3, by - 2, 1, 1);
        if (pms > 600) {
          for (let r = 0; r < 3; r++) {
            const rr = ((pms - 600) / 18 + r * 20) % 60;
            ctx.globalAlpha = Math.max(0, 0.5 - rr / 120);
            ctx.strokeStyle = PALETTE.paperShade; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.ellipse(bx, by, rr, rr * 0.35, 0, Math.PI, Math.PI * 2); ctx.stroke();
          }
          ctx.globalAlpha = 1;
          if (G.world?.settings?.captions !== false) drawText(ctx, t('caption.signal'), bx, by - 20, { color: PALETTE.paperLightest, align: 'center', font: 'small', shadow: { color: PALETTE.nightInk, dx: 1, dy: 1 } });
        }
        break;
      }
      case 'descent': drawDescent(ctx, k, total, G); break;
      case 'dawn': {
        // the beam fading into morning: 05:20 -> 06:20 over the piece
        const minute = 5 * 60 + 20 + Math.round(k * 60);
        drawBeam(ctx, minute, 30000 + pms, { pulseFrom: 999999, fill: 1 - k });
        if (k > 0.4) drawText(ctx, t('ending.credits'), 240, 92, { color: PALETTE.paperLightest, align: 'center', scale: 2, alpha: Math.min(1, (k - 0.4) * 3), shadow: { color: PALETTE.nightInk, dx: 1, dy: 1 } });
        break;
      }
      default: drawBeam(ctx, 19 * 60, total); break;
    }
  }

  const scene = {
    name: 'ending',
    opaque: true,
    enter(p = {}) {
      params = p;
      single = typeof p.single === 'string' ? p.single : null;
      si = -1; piece = null; pms = 0; total = 0; caption = ''; done = false; waiting = false; fadeIn = 0;
      porches = Math.max(7, litPorchCount(G.world, G.data));
      steps = single ? [{ kind: 'piece', id: single, caption: p.caption }] : (Array.isArray(p.steps) ? p.steps.map((x) => ({ ...x })) : endingSteps(hasScript));
      startStep();
    },
    exit() {},
    pause() {},
    resume() {},
    update(dt) {
      total += dt;
      fadeIn = Math.min(1, fadeIn + dt / 400);
      if (waiting || done || !piece) return;
      const d = dt * hurry;
      pms += d;
      capMs += d;
      if (piece === 'horn' && hornAt >= 0 && pms >= hornAt) { hornAt = -1; playHorn(); }
      const def = PIECES[piece] ?? { ms: 1000 };
      if (pms >= def.ms) startStep();
    },
    handleInput(input) {
      if (waiting || done) return;
      hurry = input.held('confirm') ? 2 : 1;
      if (input.pressed('confirm') && caption && capMs < caption.length * 28) capMs = caption.length * 28;
      if (input.held('cancel')) {
        skipHold += 1000 / 60;
        if (skipHold >= SKIP_HOLD_MS) { skipHold = 0; startStep(); }
      } else skipHold = 0;
    },
    draw(ctx) {
      ctx.fillStyle = PALETTE.nightInk;
      ctx.fillRect(0, 0, 480, 270);
      if (piece) drawPiece(ctx);
      letterbox(ctx);
      if (!waiting) drawCaption(ctx);
      if (skipHold > 0) {
        const w = Math.round((skipHold / SKIP_HOLD_MS) * 60);
        ctx.fillStyle = PALETTE.paperShade; ctx.fillRect(412, 258, w, 2);
        drawText(ctx, 'hold to skip', 472, 260, { color: PALETTE.paperShade, align: 'right', font: 'small' }); // str
      }
      if (fadeIn < 1) { ctx.globalAlpha = 1 - fadeIn; ctx.fillStyle = PALETTE.nightInk; ctx.fillRect(0, 0, 480, 270); ctx.globalAlpha = 1; }
    },
    /** Plays one set-piece from here and resolves when it ends (cutscene-host op). */
    play(id) {
      return new Promise((resolve) => {
        if (!SET_PIECES.includes(id)) { resolve(); return; }
        steps.splice(si + 1, 0, { kind: 'piece', id, resolve });
        startStep();
      });
    },
    step: () => (si >= 0 && si < steps.length ? { ...steps[si], ms: Math.round(pms) } : null),
    debugText: () => `ending: ${piece ?? '-'}${waiting ? ' (story script)' : ''} ${Math.round(pms)}ms\n${caption}`,
  };
  return scene;
}
