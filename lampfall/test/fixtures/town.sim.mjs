// A long, deterministic SYS-TOWN simulation (clock + economy + letters + memory + threads +
// schedule + the overnight) for the adversarial tests. Importable by a child process, so it holds
// no node:test calls. Every random choice comes from the run seed's labelled forks.
import { createNewWorld, validateWorld } from '../../js/state/schema.js';
import { createStore } from '../../js/state/store.js';
import { createRngs } from '../../js/state/rngs.js';
import { TUNING } from '../../js/data/tuning.js';
import * as letters from '../../js/systems/letters.js';
import * as memory from '../../js/systems/memory.js';
import * as threads from '../../js/systems/threads.js';
import * as schedule from '../../js/systems/schedule.js';
import * as dayPage from '../../js/systems/dayPage.js';
import * as loans from '../../js/systems/loans.js';
import * as wallet from '../../js/systems/wallet.js';
import * as gather from '../../js/systems/gather.js';
import * as weather from '../../js/systems/weather.js';
import { makeData, serialLetters } from './town.fixture.mjs';

const H = 60;
/** The flats map the Glint hook places on. */
export const FLATS = Object.freeze({ id: 'flats', flats: { glint: true, spots: [[1, 1], [2, 3], [4, 4], [6, 2], [7, 7]] } });
const FORWARD = ['wallet:changed', 'loan:paid', 'loan:built', 'loan:tier', 'letter:read', 'letter:heirloom', 'thread:beat', 'thread:done'];

/** Town fixture tables plus the real tuning table (wrapping porch window, real ids). */
export function simData() {
  return { ...makeData(), letters: serialLetters(), tuning: TUNING };
}

/**
 * A fresh game: store, rngs, forwarding of tally events into dayPage.noteEvent.
 * @param {string} seedCode
 * @param {any} [world]  a loaded world to continue from
 */
export function makeGame(seedCode, world = null) {
  const store = createStore(world ?? createNewWorld({ seedCode }));
  const rngs = createRngs(store);
  const data = simData();
  const counts = {};
  for (const evt of FORWARD) {
    store.bus.on(evt, (p) => { store.world && dayPage.noteEvent(store.world, evt, p); });
  }
  const tap = (evt) => { counts[evt] = (counts[evt] ?? 0) + 1; };
  for (const evt of [...FORWARD, 'letter:delivered', 'letter:collected', 'letter:door', 'npc:talked', 'dayPage:written', 'dayPage:error', 'letters:late-delivery']) store.bus.on(evt, () => tap(evt));
  return { store, rngs, data, counts, problems: [] };
}

const setClock = (w, day, minute) => { w.clock.total = day * 1440 + minute; };

/**
 * Runs core days `[from, to)`. Each day: the morning (overnight in one of three styles), errands and
 * earnings, talk and lines, the string wall, the family letter at 18:00 and its door, a loan
 * payment, thread beats, schedule queries; the night. Records invariant problems in `g.problems`.
 * @param {ReturnType<typeof makeGame>} g
 * @param {number} from
 * @param {number} to
 */
export function runDays(g, from, to) {
  const { store, rngs, data } = g;
  const bus = store.bus;
  const ectx = { data, tuning: TUNING, bus };
  const check = (label) => {
    const w = store.world;
    const p = validateWorld(w);
    if (p.length) g.problems.push(`${label}: ${p[0]}`);
    for (const k of ['earned', 'paid']) if (!Number.isFinite(w.dayPage[k])) g.problems.push(`${label}: dayPage.${k} ${w.dayPage[k]}`);
    for (const k of ['main', 'starsalt', 'anchors', 'purse']) if (!Number.isFinite(w.wallet[k])) g.problems.push(`${label}: wallet.${k}`);
    if (!Number.isFinite(w.loans.paid)) g.problems.push(`${label}: loans.paid`);
  };
  for (let d = from; d < to; d++) {
    // how this morning was handled: 0 the overnight ran at last night's Sleep (22:00) · 1 the
    // overnight runs now, after the Sleep skipped to 06:00 · 2 no overnight (FLOW's deliverMorning)
    const style = d % 3;
    if (d === 0) {
      store.tx('arrive', (w) => {
        setClock(w, 0, 18 * H + 40);
        wallet.earn(w, 6000, { ...ectx, source: 'errands' });
        loans.pay(w, 6000, ectx);
      });
    }
    if (d > 0 && style === 1) {
      // the night before ended in a Sleep that skipped to dawn: the overnight runs now
      store.tx('wake', (w) => {
        setClock(w, d, 6 * H);
        const r = runOvernight(g, w);
        if (!r.ran) g.problems.push(`day ${d}: after-skip overnight did not run (${r.reason})`);
        if (r.day !== d) g.problems.push(`day ${d}: after-skip overnight led into ${r.day}`);
      });
    }
    if (d > 0 && style === 2) {
      store.tx('dawn', (w) => {
        setClock(w, d, 6 * H);
        letters.deliverMorning(w, data, { bus, tuning: TUNING });
        loans.landDue(w, { ...ectx, now: d * 1440 + 6 * H });
      });
    }
    const r = rngs.day('sim', d);
    store.tx('day', (w) => {
      setClock(w, d, 9 * H);
      wallet.earn(w, r.int(5, 30) * 100, { ...ectx, source: 'sell' });
      for (const id of ['wren', 'tully', 'odile', 'thessaly', 'juniper']) {
        memory.talk(w, id, data, { bus });
        memory.talkLine(w, data, id, { rng: rngs.fresh(`line:${id}:${d}`) });
      }
      if (r.next() < 0.5) memory.giveGift(w, data, 'wren', r.pick(['pear', 'plum', 'rust', 'shell']), { bus });
      setClock(w, d, 10 * H);
      for (const n of letters.collectMail(w, data, { bus })) letters.markRead(w, data, n, { bus });
      for (const n of letters.unread(w)) letters.markRead(w, data, n, { bus });
      if (d % 4 === 1) letters.pinFind(w, data, `find-${(d % 18) + 1}`, { bus });
      for (const b of threads.eligibleBeats(w, data, { tuning: TUNING })) {
        threads.advance(w, data, b.threadId, { bus, tuning: TUNING, loans: { residentShare: loans.residentShare } });
      }
      for (const m of [0, 6 * H, 12 * H, 19 * H + 30, 23 * H + 59]) {
        for (const npc of data.npcs) {
          const p = schedule.whereIs(npc.id, w, data, { day: d, minute: m });
          if (p && (!Number.isInteger(p.x) || !Number.isInteger(p.y) || typeof p.mapId !== 'string' || !Number.isFinite(p.since))) g.problems.push(`day ${d} ${m}: bad placement for ${npc.id}`);
        }
      }
      setClock(w, d, 18 * H);
      letters.deliverEvening(w, data, { bus, tuning: TUNING });
      setClock(w, d, 19 * H);
      if (letters.carry(w, data, { bus, tuning: TUNING }).ok) {
        for (const n of w.letters.carrying.slice()) {
          const row = letters.letterByN(data, n);
          letters.deliverToDoor(w, data, n, row.door, { bus, tuning: TUNING, giveItem: () => {}, addCreature: () => {} });
        }
      }
      setClock(w, d, 20 * H);
      const owed = loans.balance(w, ectx);
      const pay = Math.min(owed, Math.floor(w.wallet.main / 2));
      if (pay > 0) loans.pay(w, pay, ectx);
    });
    check(`day ${d}`);
    // the night: when tomorrow's morning style is 0 the overnight runs at Sleep (22:00, before the skip)
    store.tx('night', (w) => {
      setClock(w, d, 22 * H);
      if ((d + 1) % 3 !== 0) return;
      const o = runOvernight(g, w);
      if (!o.ran || o.day !== d + 1) g.problems.push(`day ${d}: evening overnight ran=${o.ran} day=${o.day}`);
    });
    check(`night ${d}`);
  }
  return g;
}

/**
 * One overnight with the collaborators wired the way FLOW will: builds through loans.landDue,
 * the Glint and the weather on the base source.
 */
function runOvernight(g, w) {
  const { data, rngs, store } = g;
  return dayPage.overnight(w, data, rngs, {
    bus: store.bus,
    tuning: TUNING,
    loans: { landDue: loans.landDue },
    hooks: {
      glint: (world, d, s) => {
        const spot = gather.glintFor(world, FLATS, s.base, { day: s.day });
        const same = gather.glintFor(world, FLATS, gather.planRng(world), { day: s.day });
        if (!spot || spot.x !== same.x || spot.y !== same.y) g.problems.push(`glint ${s.day}: overnight and overworld disagree`);
        return spot;
      },
      weather: (world, d, s) => weather.rollDay(world, d, s.base, { day: s.gameDay, bus: s.bus }),
    },
    giveItem: () => {},
    addCreature: () => {},
  });
}

/** A stable digest of the world (FNV-1a over its JSON). */
export function digest(world) {
  const s = JSON.stringify(world);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16);
}

// child-process entry: `node town.sim.mjs <seed> <days>` prints the digest
if (process.argv[1] && process.argv[1].endsWith('town.sim.mjs')) {
  const g = runDays(makeGame(process.argv[2] ?? 'SIM'), 0, Number(process.argv[3] ?? 60));
  process.stdout.write(JSON.stringify({ digest: digest(g.store.world), problems: g.problems.length }));
}
