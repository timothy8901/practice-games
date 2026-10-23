/** Credits over the town you restored, followed by the run's Seed Card and the playable coda. */
import { drawText } from '../core/font.js';
import { CREDITS } from '../data/credits.js';
import { PALETTE } from '../ui/theme.js';
import { drawShoreView } from '../render/sky.js';
import { drawRunCard, CARD } from './seedCard.js';
import { litPorchCount, reducedMotionOf, flowFade } from './flowKit.js';
import { setFlag } from '../systems/flags.js';
import * as eventScripts from '../systems/flow/eventScripts.js';
import * as clockSys from '../systems/clockSys.js';

export const SEED_HOLD_MS = 5000;
export const creditDuration = (row) => 2500 + row.lines.length * 400;

export function createCreditsScene(G) {
  let row = 0, rowMs = 0, ms = 0, speed = 1, leaving = false, viewed = false;
  const seedPage = () => row >= CREDITS.length;

  function finish() {
    if (leaving) return;
    leaving = true;
    G.store.tx('credits:complete', (w) => {
      setFlag(w, 'sp.credits-seen', true, { bus: G.bus });
      if (w.flags['lit.calls']) {
        clockSys.setTime(w, G.clock, 6 * 60, { silent: true });
        if (G.data?.has?.('scripts', 'coda-morning') && !w.flags['seen.coda-morning']) eventScripts.queue(w, 'coda-morning');
      }
    });
    const returnToTown = () => {
      if (G.scenes.find?.('overworld')) G.scenes.pop({ credits: true });
      else G.replaceWith('overworld', { fromCredits: true });
      try { G.persist?.autosave?.(G, 'credits'); } catch { /* saves report their own failure */ }
    };
    if (!G.scenes.transition('fade', flowFade(G, 800), returnToTown, { color: PALETTE.nightInk })) returnToTown();
  }

  function background(c) {
    const kind = row % 4;
    drawShoreView(c, { x: 0, y: 0, w: 480, h: 270 }, {
      minute: 340 + Math.min(70, ms / 1600), weather: 'clear', ms, day: 14, tide: 0.4, comet: 0.1,
      lighthouse: { stage: 7, lit: true }, porches: litPorchCount(G.world, G.data), reducedMotion: reducedMotionOf(G),
    });
    if (kind === 1) {
      c.fillStyle = '#4A3328'; c.fillRect(34, 24, 412, 222);
      for (let i = 0; i < 7; i++) {
        const x = 60 + i * 53, count = i < (G.world.loans?.tier ?? 1) - 1 ? 20 : G.world.loans?.notches ?? 0;
        c.fillStyle = PALETTE.tallyLight; c.fillRect(x, 40, 20, 174);
        for (let k = 0; k < 20; k++) { c.fillStyle = k < count ? PALETTE.nightInk : PALETTE.tallyDark; c.fillRect(x + 2, 48 + k * 8, k < count ? 14 : 4, 1); }
      }
    } else if (kind === 2) {
      c.fillStyle = '#40304C'; c.fillRect(0, 0, 480, 270);
      for (let i = 0; i < 3; i++) {
        const x = 22 + i * 154;
        c.fillStyle = PALETTE.tallyLight; c.fillRect(x, 46, 132, 160);
        c.fillStyle = ['#70465E', '#467C8D', '#BC7D5C'][i]; c.fillRect(x + 6, 52, 120, 148);
        c.fillStyle = PALETTE.deepBlue; c.fillRect(x + 6, 138 - i * 17, 120, 62 + i * 17);
        c.fillStyle = PALETTE.porchAmber; c.fillRect(x + 70, 126 - i * 17, 2, 24);
      }
    }
    c.fillStyle = 'rgba(20,27,51,0.72)'; c.fillRect(0, 0, 480, 270);
  }

  return {
    name: 'credits', opaque: true,
    enter() { row = 0; rowMs = 0; ms = 0; speed = 1; leaving = false; viewed = G.world.flags['sp.credits-seen'] === true; },
    update(dt) {
      if (leaving) return;
      const step = dt * speed * (G.world.settings.skipAnims ? 2 : 1);
      ms += step; rowMs += step;
      if (seedPage()) return;
      while (!seedPage() && rowMs >= creditDuration(CREDITS[row])) { rowMs -= creditDuration(CREDITS[row]); row++; }
    },
    handleInput(input) {
      if (leaving) return;
      speed = input.held('confirm') ? 2 : 1;
      if (seedPage() && rowMs >= SEED_HOLD_MS && (input.pressed('confirm') || input.pressed('cancel') || input.pointer?.justDown)) finish();
      else if (viewed && input.pressed('cancel')) finish();
    },
    draw(c) {
      background(c);
      if (seedPage()) {
        drawRunCard(c, G, CARD.x, CARD.y, { ms });
        drawText(c, rowMs >= SEED_HOLD_MS ? 'Confirm: return to Pellwick. Your season continues.' : 'Your season, written in the book.', 240, 254, { align: 'center', color: PALETTE.paperLightest, font: 'small' });
        return;
      }
      const r = CREDITS[row];
      const y = r.lines.length > 12 ? 96 - Math.min(72, rowMs / 1000 * 12) : 96;
      drawText(c, r.heading, 240, Math.round(y), { align: 'center', color: PALETTE.porchAmber, scale: 2, maxWidth: 440 });
      r.lines.forEach((line, i) => drawText(c, line, 240, Math.round(y + 28 + i * 10), { align: 'center', color: PALETTE.paperLightest, font: 'small', maxWidth: 440 }));
      const fade = reducedMotionOf(G) ? Math.min(1, rowMs / 200) : Math.min(1, rowMs / 500);
      if (fade < 1) { c.fillStyle = `rgba(20,27,51,${1 - fade})`; c.fillRect(0, 0, 480, 270); }
      drawText(c, viewed ? 'Hold confirm: faster   Back: return to town' : 'Hold confirm: faster', 240, 258, { align: 'center', color: PALETTE.paperShade, font: 'small' });
    },
    state: () => ({ row, rowMs, seedPage: seedPage(), leaving, viewed }),
    debugText: () => seedPage() ? `credits: Seed Card ${Math.round(rowMs)}ms` : `credits: ${CREDITS[row].heading}\n${CREDITS[row].lines.join('\n')}`,
  };
}
