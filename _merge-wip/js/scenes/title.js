/**
 * Title scene. [SCN-FLOW] (day 1)
 *
 * Drawn title with Continue / New Game / Seed / Dial. Keyboard and pointer focus come from the
 * day-1 local list until `ui/*` exists. New Game routes through the lease card when
 * `FEATURES.leaseCard` is on; until then it starts a run with a default lease directly.
 * @module scenes/title
 */
import { drawText } from '../core/font.js';
import { encodeSeedCode, decodeSeedCode, randomSeedCode } from '../core/rng.js';
import { TITLE, VERSION, FEATURES } from '../config.js';
import { createLocalList, drawPaper, KIT } from './day1kit.js';
import { newGame, continueGame, fadeMs } from './boot.js';

const SKY = ['#0d1021', '#15193a', '#26224f', '#3b2d5e', '#5a3a63', '#7d4d5c'];

/**
 * Human label for a save entry.
 * @param {object|null} entry  core/save SlotEntry
 * @param {() => number} [now]
 * @returns {string}
 */
export function describeSave(entry, now = Date.now) {
  if (!entry || entry.state !== 'ok') return '';
  const s = entry.summary ?? {};
  const mins = entry.time ? Math.max(0, Math.round((now() - entry.time) / 60000)) : null;
  const ago = mins === null ? '' : mins < 1 ? 'just now' : mins < 60 ? `${mins} min ago` : `${Math.round(mins / 60)} h ago`;
  return [s.place, s.time, ago].filter(Boolean).join(', ');
}

/**
 * @param {object} G
 * @returns {import('../core/scene.js').Scene & {debugText: () => string}}
 */
export function createTitleScene(G) {
  /** Dial rows from the data registry (`DATA.dials`, display order). */
  const dialRows = () => G.data.list('dials');
  const dialName = (id) => dialRows().find((d) => d.id === id)?.name ?? id;
  let seedCode = G.world.run.seedCode;
  let dial = G.world.run.dial;
  let latest = null;
  let crashed = false;
  let error = '';
  let t = 0;
  const motes = Array.from({ length: 28 }, () => ({
    x: G.entropy.int(0, 479), y: G.entropy.int(0, 269), v: 2 + G.entropy.next() * 6, a: G.entropy.next(),
  }));

  const list = createLocalList({
    items: [],
    x: 170, y: 150, w: 180, rowH: 14,
    onPick: (i, item) => pick(item.value),
    onAdjust: (i, dir, item) => adjust(item.value, dir),
  });

  function items() {
    const canContinue = Boolean(latest && latest.state === 'ok');
    const out = [];
    if (crashed && canContinue) out.push({ label: 'Resume autosave', value: 'resume', hint: describeSave(latest) });
    out.push({ label: 'Continue', value: 'continue', enabled: canContinue, hint: canContinue && !crashed ? describeSave(latest) : '' });
    out.push({ label: 'New Game', value: 'new' });
    out.push({ label: 'Seed', value: 'seed', hint: seedCode });
    out.push({ label: 'Dial', value: 'dial', hint: `◀ ${dialName(dial)} ▶` });
    return out;
  }
  function refresh() { list.setItems(items()); }

  function pick(value) {
    error = '';
    switch (value) {
      case 'resume':
      case 'continue': {
        const res = continueGame(G, latest.slot);
        if (!res.ok) error = `Could not load: ${res.error?.message ?? res.error?.code ?? 'unknown'}`;
        break;
      }
      case 'new':
        if (FEATURES.leaseCard) {
          G.scenes.transition('iris', fadeMs(G), () => G.replaceWith('leaseCard', { seedCode }));
        } else {
          newGame(G, { seedCode });
        }
        break;
      case 'seed':
        seedCode = randomSeedCode(dial.toUpperCase(), G.entropy);
        refresh();
        break;
      case 'dial':
        adjust('dial', 1);
        break;
      default:
        break;
    }
  }

  function adjust(value, dir) {
    if (value === 'seed') { pick('seed'); return; }
    if (value !== 'dial') return;
    const ids = dialRows().map((d) => d.id);
    if (ids.length === 0) return;
    const i = ids.indexOf(dial);
    dial = ids[(i + dir + ids.length) % ids.length];
    const parts = decodeSeedCode(seedCode);
    seedCode = encodeSeedCode({ dial: dial.toUpperCase(), seed: parts ? parts.seed : 0, toggles: parts ? parts.toggles : [] });
    refresh();
  }

  return {
    name: 'title',
    opaque: true,
    enter(params = {}) {
      latest = params.latest ?? null;
      crashed = Boolean(params.crashed);
      seedCode = G.world.run.seedCode;
      dial = G.world.run.dial;
      error = '';
      refresh();
      list.index = crashed && latest ? 0 : latest && latest.state === 'ok' ? 0 : list.items.findIndex((it) => it.value === 'new');
      if (list.index < 0) list.index = 0;
    },
    resume() { refresh(); },
    update(dt) {
      t += dt;
      for (const m of motes) {
        m.y -= m.v * dt / 1000;
        if (m.y < -2) { m.y = 272; m.x = G.entropy.int(0, 479); }
      }
    },
    handleInput(input) { list.handleInput(input); },
    draw(ctx) {
      const band = 270 / SKY.length;
      SKY.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, Math.floor(i * band), 480, Math.ceil(band)); });
      ctx.fillStyle = '#0a0c18';
      ctx.fillRect(0, 232, 480, 38);
      for (const m of motes) {
        ctx.globalAlpha = 0.35 + 0.5 * Math.abs(Math.sin(t / 700 + m.a * 6));
        ctx.fillStyle = '#f6e7b0';
        ctx.fillRect(Math.floor(m.x), Math.floor(m.y), 1, 1);
      }
      ctx.globalAlpha = 1;
      drawText(ctx, TITLE, 240, 56, { color: KIT.paper, align: 'center', scale: 4, shadow: true });
      drawText(ctx, '[GDD] working title', 240, 96, { color: '#c9b7d6', align: 'center', font: 'small' });
      drawPaper(ctx, 160, 140, 200, 14 * list.items.length + 20);
      list.draw(ctx);
      if (error) drawText(ctx, error, 240, 140 + 14 * list.items.length + 26, { color: KIT.wax, align: 'center', maxWidth: 300 });
      drawText(ctx, `v${VERSION}`, 476, 258, { color: '#8a86a0', align: 'right', font: 'small' });
      drawText(ctx, 'arrows: move  confirm: Z/Enter  ◀▶: adjust', 4, 258, { color: '#8a86a0', font: 'small' });
    },
    debugText: () => [TITLE, ...list.texts(), error].filter(Boolean).join('\n'),
  };
}
