// Shared driver for test/flow.threads-complete.test.mjs and the letters tests (fixture, not a test).
// Every resident thread can be finished in play (MID-03, MID-02, LG-RN35/RN62): each of the ten
// threads is driven from beat 1 to done through the real systems: neighbour talk resolves the beat
// topic (scenes/scriptHost.resolveTalk -> script/registry), the beat script runs in the real runner
// with the production script bindings (scriptHost.scriptSystems), family letters reach Hesper's
// counter at 18:00 (dayFlow.eveningLetter), are carried, read and handed in at their door
// (interactFlow.deliverCarriedTo), Keeper letters come at 06:00 (letters.deliverMorning), and a
// finished lead thread pays its resident share (storyHooks). Story-chapter flags the threads read
// (sp.tamsin-arrived, sp.relighting ...) are set the way those chapters set them, on the day the
// driver reaches them.
import { createStore } from '../../js/state/store.js';
import { createRngs } from '../../js/state/rngs.js';
import { createNewWorld } from '../../js/state/schema.js';
import { createRegistry } from '../../js/data/registry.js';
import { DATA_CONTENT } from '../../js/data/content.js';
import { TUNING } from '../../js/data/tuning.js';
import { resolveTalk } from '../../js/scenes/scriptHost.js';
import * as threads from '../../js/systems/threads.js';
import * as letters from '../../js/systems/letters.js';
import * as loans from '../../js/systems/loans.js';
import * as wallet from '../../js/systems/wallet.js';
import * as bag from '../../js/systems/bag.js';
import * as memory from '../../js/systems/memory.js';
import * as flags from '../../js/systems/flags.js';
import * as dayFlow from '../../js/systems/flow/dayFlow.js';
import { deliverCarriedTo } from '../../js/systems/flow/interactFlow.js';
import { installStoryHooks } from '../../js/systems/flow/storyHooks.js';
import { isLowTide } from '../../js/state/selectors.js';

const DAY = 1440;
const STEP = 30;

/** A game context over the real registry, with the story bridges installed. */
export function makeGame(seed = 'THREADS') {
  const store = createStore(createNewWorld({ seedCode: seed }), { strict: true });
  const toasts = [];
  const G = {
    store, get world() { return store.world; }, bus: store.bus, data: createRegistry(DATA_CONTENT),
    push() {}, toasts: { show: (t) => toasts.push(t) },
  };
  G.rngs = createRngs(store);
  store.bus.on('toast', (p) => toasts.push(typeof p === 'string' ? p : p?.text));
  installStoryHooks(G);
  G.toastLog = toasts;
  return G;
}

/** Sets the clock (test harness: the clock system is not under test here). */
function setTotal(G, total) {
  G.store.tx('test:clock', (w) => { w.clock.total = total; });
}

/** A choice picker that walks the options in turn (so a loop like Maud's practice table ends). */
export function rotate() {
  let n = 0;
  return (req) => (n++) % Math.max(1, req.options?.length ?? 1);
}

/** Runs a session to its end, answering every host request the way a player would. */
export function runSession(G, session, pick = rotate()) {
  let answer;
  for (let guard = 0; guard < 2000; guard++) {
    const req = session.next(answer);
    if (!req || req.done) return;
    answer = undefined;
    if (req.op === 'choice') answer = pick(req);
    else if (req.op === 'take') answer = true;
    else if (req.op === 'startBattle') answer = { result: 'win', win: true };
  }
  throw new Error(`session ${session.scriptId} never ended`);
}

/** Story flags the threads read, set by other chapters: here as soon as the driver's day allows. */
const STORY = [
  { flag: 'sp.field-log', day: 2 },
  { flag: 'sp.dock-battle', day: 1 },
  { flag: 'sp.tamsin-arrived', day: 4 },
  { flag: 'sp.first-forecast', day: 4 },
  { flag: 'sp.linnet-rematch', day: 5 },
  { flag: 'sp.linnet-fell', day: 7 },
  { flag: 'sp.linnet-returned', day: 9 },
  { flag: 'sp.ansel-confessed', when: (w) => (w.threads['empty-creek']?.beat ?? 0) >= 4 },
  { flag: 'sp.act-3', day: 10 },
  { flag: 'sp.relighting', day: 22 },
  { flag: 'lit.fleetHome', day: 22 },
  { flag: 'seen.linnet-gate-after', day: 10 },
];

/** One step of the town's day the real way: 06:00 post, 18:00 counter, carrying and reading letters. */
function townStep(G, hour) {
  const ctx = { bus: G.bus, tuning: TUNING };
  if (hour === 6) {
    G.store.tx('test:morning', (w) => letters.deliverMorning(w, G.data, ctx));
    const got = G.store.tx('test:mail', (w) => letters.collectMail(w, G.data, ctx));
    for (const n of got) G.store.tx('test:read', (w) => letters.markRead(w, G.data, n, ctx));
  }
  dayFlow.eveningLetter(G);
  if (G.world.letters.counter !== null && hour >= 18) {
    const r = G.store.tx('test:carry', (w) => letters.carry(w, G.data, ctx));
    if (r.ok) G.store.tx('test:read', (w) => letters.markRead(w, G.data, r.n, ctx));
  }
  for (const n of G.world.letters.carrying.slice()) deliverCarriedTo(G, letters.letterByN(G.data, n).door, null);
  // heirlooms waiting on a dark porch come home overnight
  if (hour === 6) G.store.tx('test:heirlooms', (w) => letters.releaseHeirlooms(w, G.data, { ...ctx, ...dayFlow.letterHands(G.data, G.bus) }));
}

function storyStep(G) {
  const gd = Math.floor(G.world.clock.total / DAY) + 1;
  for (const s of STORY) {
    if (flags.hasFlag(G.world, s.flag)) continue;
    if ((s.day !== undefined && gd >= s.day) || (s.when && s.when(G.world))) G.store.tx('test:story', (w) => flags.setFlag(w, s.flag, true, { bus: G.bus }));
  }
}

/** Badges by day (Spire wins are another chapter's): water-pack reads them. */
function badgeStep(G) {
  const gd = Math.floor(G.world.clock.total / DAY) + 1;
  const want = ['turn', 'ward', 'weather'].slice(0, Math.max(0, Math.floor((gd - 2) / 2)));
  G.store.tx('test:badges', (w) => { for (const b of want) if (!w.badges.includes(b)) w.badges.push(b); });
}

/**
 * Drives one thread to done. Returns the beats seen, in order, with the day each landed.
 * @param {any} G
 * @param {string} threadId
 * @param {{maxDays?: number, pick?: Function, setup?: Function}} [o]
 */
export function driveThread(G, threadId, o = {}) {
  const def = G.data.get('threads', threadId);
  const seen = [];
  const maxDays = o.maxDays ?? 40;
  const end = G.world.clock.total + maxDays * DAY;
  while (G.world.clock.total < end) {
    const st = threads.stateOf(G.world, threadId);
    if (st.done) return seen;
    const minute = G.world.clock.total % DAY;
    const hour = Math.floor(minute / 60);
    if (minute % 60 === 0) { storyStep(G); badgeStep(G); townStep(G, hour); }
    if (o.setup) o.setup(G, st.beat + 1);
    const beat = def.beats.find((b) => b.id === st.beat + 1);
    const npc = beat.npcId ?? def.npcId;
    // stand where the beat happens (a beat cond can read the player's map and region: oyster-boat 2)
    if (beat.where && Number.isInteger(beat.where.x) && Number.isInteger(beat.where.y)
      && (G.world.player.x !== beat.where.x || G.world.player.y !== beat.where.y + 1 || G.world.player.mapId !== beat.where.mapId)) {
      G.store.tx('test:place', (w) => { w.player.mapId = beat.where.mapId ?? 'pellwick'; w.player.x = beat.where.x; w.player.y = beat.where.y + 1; });
    }
    const top = threads.beatTopics(G.world, G.data, npc, { atPorch: true, tuning: TUNING }).find((t) => t.threadId === threadId);
    if (top) {
      G.store.tx('test:map', (w) => { w.player.mapId = beat.where?.mapId ?? 'pellwick'; });
      for (let tries = 0; tries < 4 && threads.stateOf(G.world, threadId).beat < beat.id; tries++) {
        const session = resolveTalk(G, { kind: beat.porch ? 'porch' : 'npc', id: npc, atPorch: beat.porch === true, mapId: G.world.player.mapId });
        runSession(G, session, o.pick);
      }
      const after = threads.stateOf(G.world, threadId);
      if (after.beat >= beat.id) { seen.push({ beat: beat.id, day: Math.floor(G.world.clock.total / DAY) + 1 }); continue; }
    }
    setTotal(G, G.world.clock.total + STEP);
  }
  const st = threads.stateOf(G.world, threadId);
  const def2 = G.data.get('threads', threadId);
  const next = def2.beats.find((b) => b.id === st.beat + 1);
  throw new Error(`${threadId} stuck at beat ${st.beat} (next: ${JSON.stringify(next?.cond)}, block ${threads.beatBlock(G.world, G.data, def2, { tuning: TUNING })})`);
}

/** Meets every resident (the talks the first hour has), pays loan 1 so the home porch lights. */
export function prepare(G) {
  G.store.tx('test:meet', (w) => {
    for (const npc of G.data.list('npcs')) { memory.ensure(w, npc.id); w.npcs[npc.id].met = true; }
    wallet.earn(w, 200_000, { data: G.data, bus: G.bus });
    loans.pay(w, loans.balance(w, { data: G.data }), { data: G.data, bus: G.bus, tuning: TUNING });
  });
  setTotal(G, 1 * DAY + 6 * 60);
}

