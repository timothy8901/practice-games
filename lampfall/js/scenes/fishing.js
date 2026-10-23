/** The fishing reach: readable feints, timed bites, Patient reeling, and keep / release. */
import { drawText } from '../core/font.js';
import { drawPanel } from '../ui/panel.js';
import { COLORS, PALETTE } from '../ui/theme.js';
import { t } from '../data/strings.js';
import { TUNING } from '../data/tuning.js';
import * as fishing from '../systems/fishing.js';
import * as clockSys from '../systems/clockSys.js';
import * as weather from '../systems/weather.js';
import * as stats from '../systems/stats.js';
import * as bag from '../systems/bag.js';
import { planRng } from '../systems/gather.js';
import { hasAliveParty } from '../state/selectors.js';
import { startBattle } from '../systems/flow/battleFlow.js';
import { drawWaxButton, inRect, hintFor, cardFromWorld } from './flowKit.js';
import { playerSprite } from '../art/chars/index.js';
import { drawSprite } from '../core/pixelart.js';
import { drawIcon } from '../ui/icons.js';

const BUTTONS = [{ x: 140, y: 218, w: 94, h: 18 }, { x: 246, y: 218, w: 94, h: 18 }];
const FRAME_MS = 1000 / 60;

export function createFishingScene(G) {
  let map = null, reach = null, view = null, session = null;
  let elapsed = 0, frameBank = 0, pulseAt = -1000, choice = 0, result = null, note = '', waiting = false;
  const ctx = () => ({ data: G.data, tuning: TUNING, bus: G.bus, mode: G.world.settings.fishingMode ?? G.world.settings.fishing ?? 'standard' });
  const fishRow = () => session?.shadow?.fishId ? G.data.tryGet('collections', session.shadow.fishId) : null;
  const active = () => session && !fishing.isOver(session);
  const sfx = (name, opts) => { try { G.audio?.sfx?.(name, opts); } catch { /* optional audio */ } };

  function events() {
    for (const ev of session?.events ?? []) {
      if (ev.type === 'feint') { pulseAt = elapsed; sfx('bite', { volume: 0.25, semitones: -5 }); }
      if (ev.type === 'bite') { pulseAt = elapsed; sfx('bite'); }
      if (ev.type === 'landed') { choice = 0; sfx('catchFish'); }
      if (ev.type === 'miss') { note = ev.reason === 'early' ? 'A nibble. Wait for the bobber to go under.' : t('fishing.lost'); sfx('splash'); }
    }
  }

  function cast() {
    result = null; note = ''; choice = 0; frameBank = 0;
    if (!map || !reach) { session = null; note = t('fishing.empty'); return; }
    const rng = G.rngs.stream(fishing.streamLabel(reach.id));
    view = fishing.reachShadows(G.world, map, reach, rng, ctx());
    session = fishing.cast(G.world, map, reach.id, view.shadows, null, rng, ctx());
    if (!session) note = t('fishing.empty');
    else { sfx('splash'); events(); }
  }

  function settle(which) {
    if (!session || session.phase !== 'landed') return;
    if (which === 'release' && session.shadow.creature) {
      session.phase = 'released';
      result = { ok: true, kind: 'creature', released: true };
      note = 'The creature swims back into the reach.';
      return;
    }
    result = G.store.tx('fishing:resolve', (w) => fishing.resolve(w, session, which, {
      ...ctx(), give: (id, n) => bag.give(w, id, n, { ...ctx(), source: 'fishing' }),
    }));
    if (result.kind === 'creature' && result.encounter) {
      if (!hasAliveParty(G.world)) { note = 'A creature splashes free. Bring a rested companion next time.'; return; }
      waiting = true;
      startBattle(G, { kind: 'wild', wild: { ...result.encounter, habitat: 'water' }, source: 'fishing' })
        .then(() => { waiting = false; note = 'The reach settles again.'; }, () => { waiting = false; note = 'The creature slipped back into the water.'; });
    } else if (result.kind === 'fish') {
      const row = fishRow();
      note = which === 'release' ? 'Released. The reach is a little healthier.' : 'Kept in your satchel.';
      if (result.log?.record) note += ` ${t('fishing.record')}`;
      if (result.log?.tellNew) note += ` ${t('fishing.tell', { tell: row?.tell?.word ?? 'Watch the bobber.' })}`;
    }
  }

  function close() {
    if (waiting) return;
    if (session?.phase === 'landed') settle('release');
    else if (active()) fishing.cancel(session);
    else if (session?.phase === 'missed') G.store.tx('fishing:miss', (w) => fishing.resolve(w, session, 'release', ctx()));
    if (G.scenes.size > 1) G.scenes.pop({ fishing: true, result });
    else G.replaceWith('overworld', {});
  }

  function status() {
    if (!session) return t('fishing.empty');
    if (session.phase === 'landed') return session.shadow.creature ? 'A creature took the line!' : t('fishing.caught', { name: fishRow()?.name ?? session.shadow.fishId, size: session.shadow.size.toFixed(1) });
    if (session.phase === 'bite') return session.mode === 'patient' ? t('fishing.hold') : t('fishing.bite');
    if (session.phase === 'missed') return t('fishing.lost');
    if (result?.kind === 'fish') return t('fishing.caught', { name: fishRow()?.name ?? session.shadow.fishId, size: session.shadow.size.toFixed(1) });
    if (result) return 'The water settles.';
    return t('fishing.wait');
  }

  const scene = {
    name: 'fishing', opaque: true,
    enter(p = {}) {
      elapsed = 0; waiting = false; pulseAt = -1000;
      map = G.data.tryGet('maps', p.mapId ?? G.world.player.mapId);
      reach = fishing.reachDefOf(map, p.reachId ?? map?.reaches?.[0]?.id);
      cast();
    },
    exit() { if (active()) fishing.cancel(session); },
    pause() { if (session) fishing.release(session); },
    resume() { G.input?.flush?.(); },
    update(dt) {
      elapsed += dt;
      if (waiting || G.scenes.top() !== scene) return;
      G.store.tx('fishing:clock', (w) => {
        clockSys.tick(w, G.clock, dt, ctx());
        stats.addPlayMs(w, dt);
        weather.update(w, G.data, planRng(w), { bus: G.bus });
      });
      if (!active()) return;
      frameBank += dt;
      const frames = Math.floor((frameBank + 0.0001) / FRAME_MS);
      frameBank -= frames * FRAME_MS;
      if (frames) { fishing.tick(session, frames, ctx()); events(); }
    },
    handleInput(input) {
      if (waiting) return;
      if (input.pressed('cancel') || (input.pressed('menu') && !input.pressed('confirm'))) { close(); return; }
      if (session?.phase === 'landed') {
        if (input.repeat('left')) choice = 0;
        if (input.repeat('right')) choice = 1;
        const p = input.pointer;
        if (p?.justDown) {
          const i = BUTTONS.findIndex((r) => inRect(p, r));
          if (i >= 0) { const activate = p.type !== 'touch' || choice === i; choice = i; if (activate) settle(i ? 'release' : 'keep'); return; }
        }
        if (input.pressed('confirm')) settle(choice ? 'release' : 'keep');
        return;
      }
      if (!active()) {
        if (input.pressed('confirm')) {
          if (session?.phase === 'missed') G.store.tx('fishing:miss', (w) => fishing.resolve(w, session, 'release', ctx()));
          cast();
        }
        return;
      }
      if (input.pressed('confirm') || input.pointer?.justDown) { fishing.press(session); events(); }
      if (session.mode === 'patient') {
        if (input.held('confirm') || input.pointer?.down) session.held = true;
        else fishing.release(session);
      }
    },
    draw(c) {
      const night = clockSys.isNight(G.world, G.data);
      const motionMs = G.world.settings.reducedMotion ? 0 : elapsed;
      c.fillStyle = night ? '#101A35' : '#466C82'; c.fillRect(0, 0, 480, 270);
      c.fillStyle = night ? '#1E3650' : '#63989E'; c.fillRect(0, 36, 480, 168);
      for (let y = 48; y < 202; y += 12) {
        c.fillStyle = night ? '#2A465E' : '#82B5B4';
        for (let x = -40; x < 500; x += 67) c.fillRect(x + Math.round(Math.sin(motionMs / 1800 + y) * 9), y, 24, 1);
      }
      const bx = 274, by = 122 + (session?.phase === 'bite' ? 12 : Math.round(Math.sin(motionMs / 600) * 2));
      for (let i = 0; i < (view?.shadows?.length ?? 0); i++) {
        const sh = view.shadows[i], x = 90 + (i * 71) % 330, y = 70 + (i * 37) % 108;
        c.fillStyle = night ? '#0B152C' : '#355A70';
        c.fillRect(x + Math.round(Math.sin(motionMs / 1400 + i) * 12), y, sh.silhouette === 'large' ? 24 : 14, 4);
      }
      // The same keeper and rod as the field, on a weathered timber jetty.
      c.fillStyle = '#3E302C'; c.fillRect(0, 159, 118, 25);
      c.fillStyle = '#977554'; c.fillRect(0, 152, 118, 18);
      for (let x = 0; x < 118; x += 13) { c.fillStyle = '#5B4538'; c.fillRect(x, 152, 1, 18); c.fillStyle = '#C1A17B'; c.fillRect(x + 2, 153, 9, 1); }
      c.fillStyle = '#544134'; c.fillRect(94, 151, 8, 34); c.fillStyle = '#B08E65'; c.fillRect(93, 148, 10, 4);
      const keeper = playerSprite(cardFromWorld(G.world), 'fish', session?.phase === 'bite' ? 3 : elapsed < 350 ? 2 : 0, { scale: 2 });
      drawSprite(c, keeper, 54, 152 - keeper.h + 7);
      c.strokeStyle = PALETTE.paperShade; c.beginPath(); c.moveTo(89, 124); c.lineTo(bx, by); c.stroke();
      c.fillStyle = PALETTE.waxRed; c.fillRect(bx - 2, by - 6, 4, 5);
      c.fillStyle = PALETTE.paperLightest; c.fillRect(bx - 2, by - 1, 4, 3);
      if (elapsed - pulseAt < 500) {
        c.strokeStyle = PALETTE.paperLightest; c.beginPath(); c.ellipse(bx, by + 4, 5 + (elapsed - pulseAt) / 16, 2 + (elapsed - pulseAt) / 40, 0, 0, Math.PI * 2); c.stroke();
      }
      if (session?.phase === 'bite') drawText(c, '!', bx, by - 29, { align: 'center', scale: 3, color: PALETTE.porchAmber });
      drawPanel(c, { x: 14, y: 10, w: 452, h: 27 }, 'paper');
      drawText(c, map?.name ?? 'The reach', 25, 18, { color: COLORS.paper.ink });
      drawText(c, `${session?.mode ?? ctx().mode}  ·  ${view?.status ?? 'quiet'} reach`, 453, 19, { align: 'right', color: COLORS.paper.inkSoft, font: 'small' });
      drawPanel(c, { x: 14, y: 184, w: 452, h: 74 }, 'paper');
      drawText(c, status(), 240, 194, { align: 'center', color: session?.phase === 'bite' ? PALETTE.waxRed : COLORS.paper.ink, maxWidth: 426 });
      if (session?.phase === 'landed') {
        drawIcon(c, session.shadow.creature ? 'lantern' : 'fish', 352, 216, { scale: 2 });
        drawWaxButton(c, session.shadow.creature ? 'Meet it' : 'Keep', BUTTONS[0], { focused: choice === 0 });
        drawWaxButton(c, 'Release', BUTTONS[1], { focused: choice === 1 });
      } else {
        const prompt = active() ? (session.mode === 'patient' ? 'Hold confirm to reel when it bites. No timing window.' : 'A nibble is a small ripple. Reel when the bobber plunges!') : 'Confirm: cast again   Back: leave the reach';
        drawText(c, note || prompt, 240, 216, { align: 'center', color: COLORS.paper.inkSoft, maxWidth: 420, font: 'small' });
        if (active() && session.mode === 'patient' && session.phase === 'bite') {
          c.fillStyle = COLORS.paper.shade; c.fillRect(160, 232, 160, 5);
          c.fillStyle = PALETTE.porchAmber; c.fillRect(160, 232, Math.min(160, session.reel / (TUNING.fishPatientReelFrames ?? 60) * 160), 5);
        }
      }
      drawText(c, hintFor(G.input, { keyboard: 'Z / Enter: reel   X / Esc: leave', gamepad: 'A: reel   B: leave', touch: 'Tap: reel   B: leave' }), 240, 261, { align: 'center', color: PALETTE.paperLightest, font: 'small' });
    },
    state: () => ({ mapId: map?.id, reachId: reach?.id, session, view, result, note, waiting, choice }),
    debugText: () => `fishing ${map?.id ?? '-'} ${reach?.id ?? '-'} ${session?.phase ?? 'empty'} ${session?.mode ?? ctx().mode}\n${status()}${note ? `\n${note}` : ''}`,
  };
  return scene;
}
