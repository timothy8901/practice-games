/**
 * Interaction flow (ARCHITECTURE §4.5): `doInteraction(G, action, host)` executes the context action
 * `world/interact.resolveFacing` (or the overworld's own bug / Glint probes) produced. [SCN-WORLD]
 *
 * This is the ONLY place overworld verbs push scenes: dialogue (talk, signs, knocks), fishing,
 * shop and the Consignment Crate, letters (mailbox, Hesper's counter), the Day Page (bed, porch
 * bench), Forecasts (Waystones), the boards (gate boards, the Commons board, Tide Tables, dossiers),
 * the payment ceremony and Maud's ferry card. {@link VERB_HANDLERS} is the registry, so map authors
 * use verb names only; an unknown verb falls back to {@link VERB_LINES} (a short in-world line) and
 * never does nothing.
 *
 * The scene that calls it passes a `host` (see {@link Host}): the map it is standing on and the
 * small field effects a verb asks for (toast, wobble, floating text, a timed wait, a warp, sitting).
 * Every world write goes through `G.store.tx` and the owning system (gather, fishing, bag, wallet,
 * loans, shops, letters, memory through the dialogue host, dayFlow, flags). No DOM.
 *
 * Results: every handler returns (or resolves with) `{ok, verb, scene?, reason?, ...}`; a disabled
 * action returns `{ok: false, reason}` after toasting the reason (the HUD showed it greyed).
 * @module systems/flow/interactFlow
 */
import { TUNING } from '../../data/tuning.js';
import { t, CONFIRMS } from '../../data/strings.js';
import * as clockSys from '../clockSys.js';
import * as gather from '../gather.js';
import * as bag from '../bag.js';
import * as wallet from '../wallet.js';
import * as loans from '../loans.js';
import * as shops from '../shops.js';
import * as letters from '../letters.js';
import * as party from '../party.js';
import * as flags from '../flags.js';
import * as weather from '../weather.js';
import { isPorchLit, porchesOf } from '../townCommon.js';
import * as dayFlow from './dayFlow.js';
import { minuteOfDay, badgeCount, formatTime } from '../../state/selectors.js';
import { formatMinute } from '../../core/time.js';
import { hasAliveParty } from '../../state/selectors.js';
import { markTrigger } from '../../world/warps.js';

/** @typedef {import('../../world/interact.js').ContextAction} ContextAction */

/**
 * What the calling scene lends a verb. Every member is optional; a missing one is skipped.
 * @typedef {Object} Host
 * @property {string} [mapId]
 * @property {any} [mapDef]        the resolved MapDef (variants applied): gather / fishing read it
 * @property {any} [map]           RuntimeMap
 * @property {any} [ents]          EntityManager
 * @property {any} [player]        world/player controller
 * @property {(text: string, opts?: object) => void} [toast]
 * @property {(ms: number) => Promise<void>} [wait]        scene-time wait with the player locked
 * @property {(id: string, ms: number) => void} [wobble]   shake an entity (tree, nest)
 * @property {(text: string, x: number, y: number, opts?: object) => void} [float]   rising text over a tile
 * @property {(key: string, vars?: object) => void} [caption]
 * @property {(warp: object) => any} [warp]                take a door / edge warp (fade, tide gates)
 * @property {(to: {mapId: string, x: number, y: number, facing?: string}, opts?: object) => void} [travel]
 * @property {(kind: string, at?: {x: number, y: number}) => void} [sit]
 * @property {() => void} [refresh]                        re-read entity state (fruit, cracks, porches)
 * @property {(id: string) => void} [removeEntity]
 * @property {(id: string) => void} [faceToward]           turn an NPC to face the player
 * @property {(id: string) => string|null} [npcPose]
 * @property {(name: string, opts?: object) => void} [sfx]
 * @property {(tool: string|null) => void} [flashTool]     show a tool briefly (the auto-offered net)
 * @property {(opts: object) => Promise<number>} [ask]    confirm dialog (defaults to ui/confirm.openConfirm)
 * @property {(scene: object, params?: any) => void} [pushScene]   push a scene object (built-in overlays)
 * @property {{createBoardScene?: Function, createCeremonyScene?: Function, createFerryScene?: Function}} [overlays]
 */

/** Ctx every lane system takes: the registry, the tuning table and the bus. */
export function laneCtx(G, extra) {
  return { data: G.data, tuning: TUNING, bus: G.bus, ...(extra || {}) };
}

/** Town name for signs (`{town}`); the lease card's answer when the run stores one. */
export function townName(G) {
  const w = G.world;
  return (w && w.run && typeof w.run.town === 'string' && w.run.town) || (w && w.player && typeof w.player.town === 'string' && w.player.town) || 'Pellwick'; // str
}

/** Fills `{town}` in sign text. */
export function signText(G, text) {
  return String(text ?? '').replace(/\{town\}/g, townName(G));
}

/** Short in-world lines for verbs whose screens other lanes own or that are only atmosphere. */
export const VERB_LINES = Object.freeze({
  look: 'You take a good look.', // str
  inspect: 'A good, honest rock.', // str
  mirror: 'You look like someone who walked here. The mirror agrees.', // str
  chip: 'You chip at the stone. It keeps its secrets for now.', // str
  polish: 'The polisher waits for a relic.', // str
  graft: 'The grafting bench, swept clean. Bring a cutting.', // str
  gallery: 'Bare nails, waiting for canvases.', // str
  loft: 'The loft ladder creaks. The telescope is covered.', // str
  workshop: 'The bench smells of oil and old fossils.', // str
  commission: 'Wren\'s chalk plan of the rooms to come.', // str
  readersFund: 'A tin marked READERS. It rattles.', // str
  seasonBook: 'Dimity\'s Season Book. Most pages are still blank.', // str
  shiftlog: 'The Shiftlog wall. Your creatures will fill it.', // str
  stringWall: 'Barnaby\'s string wall: finds pinned, red string waiting.', // str
  summitBell: 'The Summit Bell hangs still.', // str
  tallyWall: 'Split sticks and wax seals. Room for more.', // str
  recall: 'Corin runs Recall here, when you are ready.', // str
  relearn: 'Old moves, kept in Barnaby\'s ledgers.', // str
  discs: 'Today\'s discs, behind glass.', // str
  wantedToday: 'Wanted Today, chalked on the slate.', // str
  board: 'The boat is not yours to take out.', // str
  launch: 'Beached. Ansel keeps her ready anyway.', // str
  weir: 'The weir wheel, rusted fast.', // str
});

/** Scenes a verb opens when another lane has built them (pushed by name). */
export const VERB_SCENES = Object.freeze({
  ledger: 'ledger', fieldLog: 'fieldLog', storage: 'box', cellar: 'box', tallyWall: 'ledger', seasonBook: 'fieldLog',
});

// ---------------------------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------------------------

const def = (action) => (action && action.target && action.target.def) || (action && action.target) || {};
const toast = (G, host, text, opts) => {
  if (host && typeof host.toast === 'function') host.toast(text, opts);
  else if (G.toasts && typeof G.toasts.show === 'function') G.toasts.show(text, opts);
  else if (G.bus) G.bus.emit('toast', typeof text === 'string' ? { text, ...(opts || {}) } : text);
};
const say = (G, text, who) => { G.push('dialogue', { text, who: who ?? null }); return 'dialogue'; };
const hasScene = (G, name) => Boolean(G.sceneFactories && typeof G.sceneFactories[name] === 'function');
const done = (verb, extra) => ({ ok: true, verb, ...(extra || {}) });
const fail = (verb, reason, extra) => ({ ok: false, verb, reason, ...(extra || {}) });

/** Confirm dialog through the host (tests) or ui/confirm (game). Resolves with the option index. */
async function ask(G, host, opts) {
  if (host && typeof host.ask === 'function') return host.ask(opts);
  if (typeof G.ask === 'function') return G.ask(opts);
  const { openConfirm } = await import('../../ui/confirm.js');
  return openConfirm(G, opts);
}

/** Pushes a built-in overlay scene (from the host's overlay kit). */
function pushOverlay(G, host, factoryName, params) {
  const make = host && host.overlays && host.overlays[factoryName];
  if (typeof make !== 'function') return false;
  const scene = make(G, params);
  if (host && typeof host.pushScene === 'function') host.pushScene(scene, params);
  else G.scenes.push(scene, params);
  return true;
}

/** Items the player holds that enable a verb (`use` field), on the ring or in hand. */
export function ringHas(world, itemId) {
  const p = world && world.player;
  if (!p) return false;
  return p.tool === itemId || (Array.isArray(p.toolRing) && p.toolRing.includes(itemId));
}

/** The reach a fishing cast at (x, y) belongs to: the one containing the tile, else the nearest within 3 tiles. */
export function reachAt(mapDef, x, y) {
  const list = Array.isArray(mapDef && mapDef.reaches) ? mapDef.reaches : [];
  let best = null, bestD = Infinity;
  for (const r of list) {
    const a = r && r.area;
    if (!a) continue;
    const dx = x < a.x ? a.x - x : x >= a.x + a.w ? x - (a.x + a.w - 1) : 0;
    const dy = y < a.y ? a.y - y : y >= a.y + a.h ? y - (a.y + a.h - 1) : 0;
    const d = Math.max(dx, dy);
    if (d < bestD) { bestD = d; best = r; }
  }
  return bestD <= 3 ? best : null;
}

/** Ferry stops: every map's boat whose verb is `ferry` (one per map), with its region's posted curve. */
export function ferryStops(data) {
  const out = [];
  const maps = data && typeof data.list === 'function' ? data.list('maps') : [];
  for (const m of maps) {
    const ents = Array.isArray(m && m.entities) ? m.entities : [];
    const boat = ents.find((e) => e && e.verb === 'ferry');
    if (!boat) continue;
    const region = data.has('regions', m.region) ? data.get('regions', m.region) : null;
    out.push({ mapId: m.id, name: (region && region.name) || m.name || m.id, curve: region ? region.curveLevel : null, x: boat.x, y: boat.y });
  }
  return out;
}

/** Whether Maud's punt runs at a minute of day (05:00-01:00, wrapping past midnight). */
export function ferryOpen(minute) {
  const [a, b] = TUNING.ferryHours || [300, 60];
  return a <= b ? minute >= a && minute < b : minute >= a || minute < b;
}

/** The fare now: 200 until badge 2, then free. */
export function ferryFare(world) {
  return badgeCount(world) >= (TUNING.ferryFreeFromBadge ?? 2) ? 0 : (TUNING.ferryFare ?? 200);
}

// ---------------------------------------------------------------------------------------------
// verbs
// ---------------------------------------------------------------------------------------------

function talk(G, action, host) {
  const e = action.target;
  const npcId = (e && e.npcId) || action.targetId;
  if (host && host.faceToward) host.faceToward(e && e.id ? e.id : npcId);
  const pose = host && host.npcPose ? host.npcPose(npcId) : null;
  G.push('dialogue', { target: { kind: 'npc', id: npcId, pose: pose || undefined, mapId: host && host.mapId ? host.mapId : G.world.player.mapId } });
  return done('talk', { scene: 'dialogue', npcId });
}

async function challenge(G, action, host) {
  const id = action.payload?.trainerId ?? def(action).trainerId;
  const trainer = G.data.tryGet('trainers', id);
  if (!trainer) return fail('challenge', 'unknown-trainer');
  if (host.faceToward) host.faceToward(action.targetId);
  if (G.world.flags[`sys.trainer.${id}`]) {
    say(G, trainer.lines.win, trainer.npc ?? trainer.name);
    return done('challenge', { scene: 'dialogue', defeated: true });
  }
  if (!hasAliveParty(G.world)) {
    toast(G, host, 'Bring a rested companion. The Waystones heal your party.');
    return fail('challenge', 'no-party');
  }
  const levels = trainer.party.map((c) => c.level);
  const pick = await ask(G, host, { title: trainer.name, body: `${trainer.title}. ${trainer.party.length} creatures, up to Lv${Math.max(...levels)}. ${trainer.tacticTag}.`,
    options: ['Come back later', 'Challenge'], defaultIndex: 0 });
  if (pick !== 1) return fail('challenge', 'declined');
  const setup = { kind: 'trainer', trainerId: id, source: trainer.expSource ?? (trainer.spire ? 'spire' : 'route') };
  if (host.startBattle) {
    G.push('dialogue', { who: trainer.npc ?? trainer.name, text: trainer.lines.intro, onDone: () => host.startBattle(setup) });
  } else G.push('battle', { setup });
  return done('challenge', { scene: 'battle', trainerId: id });
}

function read(G, action, host) {
  if (action.kind === 'sign' || (def(action) && def(action).kind === 'sign')) {
    const text = action.payload && action.payload.text ? action.payload.text : def(action).text;
    if (!text) { toast(G, host, t('warp.cond')); return fail('read', 'blank'); }
    return done('read', { scene: say(G, signText(G, text)) });
  }
  if (action.kind === 'roamer') {
    const e = action.target || {};
    if (e.def && e.def.bug) {
      const row = G.data.has('collections', e.def.bugId) ? G.data.get('collections', e.def.bugId) : null;
      return done('read', { scene: say(G, `${row ? row.name : 'A bug'}. ${ringHas(G.world, 'net') ? 'Hold still, then net it.' : 'A net would do it.'}`) }); // str
    }
    const sp = e.speciesId && G.data.has('species', e.speciesId) ? G.data.get('species', e.speciesId) : null;
    const lv = e.def && e.def.level ? ` Lv${e.def.level}` : '';
    return done('read', { scene: say(G, `${sp ? sp.name : 'Something wild'}${lv}. It watches you right back.`) }); // str
  }
  return look(G, action, host);
}

function look(G, action, host) {
  const d = def(action);
  const text = d.text || (d.name ? `${d.name}.` : null) || VERB_LINES[action.verb] || VERB_LINES.look;
  return done(action.verb, { scene: say(G, signText(G, text)) });
}

function pickUp(G, action, host) {
  const e = action.target;
  const itemId = e && e.itemId;
  if (!itemId) return fail('pickUp', 'nothing');
  const res = G.store.tx('field:pickUp', (w) => {
    const r = bag.give(w, itemId, 1, laneCtx(G, { source: 'pickup' }));
    if (r.ok) {
      const m = gather.ensureMap(w, host && host.mapId ? host.mapId : w.player.mapId);
      m.picked[e.id] = clockSys.gameDay(w);
    }
    return r;
  });
  if (!res.ok) { toast(G, host, 'Your satchel is full.'); return fail('pickUp', res.reason); } // str
  if (host && host.removeEntity) host.removeEntity(e.id);
  const row = G.data.has('items', itemId) ? G.data.get('items', itemId) : null;
  toast(G, host, `Picked up ${row ? row.name : itemId}.`); // str
  return done('pickUp', { itemId });
}

/** Wraps gather results into the world: fruit to the satchel, purses to the wallet. */
function gatherCtx(G, w, extra) {
  return laneCtx(G, {
    give: (id, n) => bag.give(w, id, n, laneCtx(G, { source: 'gather' })),
    earn: (amount, source) => wallet.earn(w, Math.max(0, Math.round(amount)), laneCtx(G, { source })),
    collectGlint: (o) => wallet.collectGlint(w, laneCtx(G, { gameDay: o && o.gameDay, source: 'glint' })),
    ...(extra || {}),
  });
}

async function shake(G, action, host) {
  const e = action.target;
  const mapDef = host && host.mapDef;
  if (!e || !mapDef) return fail('shake', 'no-tree');
  const net = ringHas(G.world, 'net');
  const res = G.store.tx('gather:shake', (w) => gather.shakeTree(w, mapDef, e.def || e.id, G.rngs.stream('loot'), gatherCtx(G, w, { net })));
  G.bus.emit('interact', { verb: 'shake', target: e.id });
  if (host && host.wobble) host.wobble(e.id, 260);
  const hum = res.events.find((ev) => ev.type === 'hum');
  if (hum) {
    // the bee hum warns 1 s before the outcome (GDD-00 §9); the net comes out on its own if it is on the ring
    if (host && host.caption) host.caption('caption.beeHum');
    if (host && host.sfx) host.sfx('lantern', { pitch: 0.5 });
    if (host && host.wobble) host.wobble(e.id, hum.delayMs ?? 1000, 2);
    if (host && host.wait) await host.wait(hum.delayMs ?? 1000);
    const h = res.hive;
    if (h && h.outcome === 'netted') {
      if (host && host.flashTool) host.flashTool('net');
      toast(G, host, 'Netted the nest. Honeycomb!'); // str
    } else if (h && h.outcome === 'blown-clear') toast(G, host, 'Your lead blew the nest clear. Honeycomb!'); // str
    else toast(G, host, 'Stung! The bees settle back in.'); // str
    if (host && host.refresh) host.refresh();
    return done('shake', { hive: h ? h.outcome : null, events: res.events });
  }
  if (res.fruit && res.fruit.n > 0) {
    const row = G.data.has('collections', res.fruit.id) ? G.data.get('collections', res.fruit.id) : G.data.has('items', res.fruit.id) ? G.data.get('items', res.fruit.id) : null;
    const name = row ? row.name : res.fruit.id;
    if (host && host.float) host.float(`+${res.fruit.n} ${name}${res.fruit.ripe ? ' (ripe)' : ''}`, e.x, e.y); // str
  }
  if (res.purse > 0 && host && host.float) host.float(`+${res.purse}◉`, e.x, e.y - 1, { color: 'brass' });
  if (res.shells && res.shells.length && host && host.float) host.float('A shell!', e.x, e.y + 1); // str
  if (!res.fruit && !res.purse && !(res.shells && res.shells.length)) toast(G, host, 'Nothing falls. It needs a day or two.'); // str
  if (host && host.refresh) host.refresh();
  return done('shake', { fruit: res.fruit, purse: res.purse, events: res.events });
}

function dig(G, action, host) {
  if (action.disabled) return disabled(G, action, host);
  const mapDef = host && host.mapDef;
  if (!mapDef) return fail('dig', 'no-map');
  const { x, y } = action.payload;
  const res = G.store.tx('gather:dig', (w) => {
    const r = gather.dig(w, mapDef, x, y, gather.planRng(w), gatherCtx(G, w));
    if (r.ok) return r;
    const c = mapDef.flats && mapDef.flats.cockles ? gather.rakeCockles(w, mapDef, x, y, G.rngs.stream('loot'), gatherCtx(G, w)) : null;
    return c && c.ok ? { ok: true, kind: 'cockles', item: c.item, n: c.n, events: [] } : r;
  });
  G.bus.emit('interact', { verb: 'dig', x, y });
  if (!res.ok) { toast(G, host, 'Just sand and water.'); return fail('dig', res.reason || 'nothing'); } // str
  const nameOf = (id) => (id && G.data.has('collections', id) ? G.data.get('collections', id).name : id && G.data.has('items', id) ? G.data.get('items', id).name : id);
  if (res.kind === 'glint') { toast(G, host, t('toast.glint', { amount: res.amount })); if (host && host.float) host.float(`+${res.amount}◉`, x, y, { color: 'brass' }); }
  else if (res.kind === 'skyglass') toast(G, host, t('toast.relic'));
  else if (res.kind === 'sparkle') toast(G, host, t('toast.sparkle', { item: nameOf(res.findId) }));
  else if (res.kind === 'cockles') toast(G, host, `${res.n} cockles.`); // str
  else toast(G, host, `Found: ${nameOf(res.findId) || 'something'}.`); // str
  if (host && host.refresh) host.refresh();
  return done('dig', { kind: res.kind, findId: res.findId ?? null, amount: res.amount ?? 0 });
}

function fish(G, action, host) {
  if (action.disabled) return disabled(G, action, host);
  const { x, y } = action.payload;
  const reach = reachAt(host && host.mapDef, x, y);
  if (!reach) { toast(G, host, t('fishing.empty')); return fail('fish', 'no-reach'); }
  G.bus.emit('interact', { verb: 'fish', x, y });
  G.push('fishing', { mapId: host && host.mapId ? host.mapId : G.world.player.mapId, reachId: reach.id, x, y });
  return done('fish', { scene: 'fishing', reachId: reach.id });
}

function catchVerb(G, action, host) {
  const e = action.target;
  if (!e || !e.def || !e.def.bug) return read(G, action, host);
  if (!ringHas(G.world, 'net')) { toast(G, host, t('verb.needsTool', { tool: 'net' })); return fail('catch', 'needs-net'); }
  const pl = host && host.player ? host.player.ent : { x: G.world.player.x, y: G.world.player.y };
  const gait = host && host.gait ? host.gait() : 'still';
  if (host && host.flashTool && G.world.player.tool !== 'net') host.flashTool('net');
  const res = G.store.tx('gather:net', (w) => gather.netBug(w, { id: e.def.bugId, x: e.x, y: e.y }, { x: pl.x, y: pl.y, gait }, G.rngs.stream('loot'), gatherCtx(G, w)));
  G.bus.emit('interact', { verb: 'catch' });
  if (host && host.removeEntity) host.removeEntity(e.id);
  const row = G.data.has('collections', e.def.bugId) ? G.data.get('collections', e.def.bugId) : null;
  if (res.ok) toast(G, host, `Netted a ${row ? row.name : 'bug'}!`); // str
  else toast(G, host, res.reason === 'spooked' ? 'Too quick. It saw you coming.' : 'It slipped through the mesh.'); // str
  return res.ok ? done('catch', { bugId: e.def.bugId }) : fail('catch', res.reason);
}

function enter(G, action, host) {
  const warp = action.target;
  if (host && typeof host.warp === 'function') return done('enter', { warp: host.warp(warp) });
  return fail('enter', 'no-host');
}

function board(G, action, host) {
  const d = def(action);
  if (d.verb === 'ferry') return ferry(G, action, host);
  if (d.verb === 'shop' && d.shop) return shop(G, action, host);
  return done('board', { scene: say(G, d.id === 'ansel-launch' ? VERB_LINES.launch : VERB_LINES.board) });
}

async function sit(G, action, host) {
  const d = def(action);
  const id = d.id || action.targetId;
  const at = action.target && Number.isInteger(action.target.x) ? { x: action.target.x, y: action.target.y } : action.payload;
  if (id === 'porch-bench') {
    // your porch bench: the Day Page, a verified save, then the clock runs x6 until you stand
    if (host && host.sit) host.sit('porch', at);
    await dayFlow.sit(G);
    return done('sit', { porch: true, scene: 'dayPage' });
  }
  if (host && host.sit) host.sit('bench', at);
  return done('sit', { porch: false });
}

function mailbox(G, action, host) {
  G.store.tx('letters:mailbox', (w) => letters.collectMail(w, G.data, laneCtx(G)));
  const unread = letters.unread(G.world);
  G.bus.emit('interact', { verb: 'mailbox' });
  if (!unread.length) { toast(G, host, 'Nothing in the box. Post comes at six.'); return fail('mailbox', 'empty'); } // str
  G.push('letter', { from: 'mailbox' });
  return done('mailbox', { scene: 'letter' });
}

function hesperCounter(G, action, host) {
  const m = minuteOfDay(G.world);
  if (!(m >= 18 * 60 || m < 2 * 60)) { toast(G, host, 'Hesper\'s counter opens at six in the evening.'); return fail('hesperCounter', 'closed'); } // str
  const got = G.store.tx('letters:carry', (w) => letters.carry(w, G.data, laneCtx(G)));
  if (!got.ok) { toast(G, host, 'Nothing for you tonight.'); return fail('hesperCounter', got.reason); } // str
  G.push('letter', { n: got.n, from: 'counter' });
  return done('hesperCounter', { scene: 'letter' });
}

/** Text panels for the boards: the Ledger pace line, the Tide Table and Augusta's honest odds. */
export function boardContent(G, kind) {
  const w = G.world;
  const ctx = laneCtx(G);
  const day = clockSys.gameDay(w);
  const tides = clockSys.tidesForDay(Math.max(1, day), G.data).filter((e) => e.kind === 'low' || e.type === 'low' || e.low === true);
  const lows = (tides.length ? tides : clockSys.nextLows(w, 2, G.data)).map((e) => formatMinute(((e.minute ?? e.total ?? 0) % 1440 + 1440) % 1440));
  const windows = clockSys.tideWindows(w, { data: G.data });
  const winLine = (kind2, label) => {
    const win = windows[kind2];
    if (!win) return null;
    if (win.always) return `${label}: open at any tide`; // str
    const mins = win.minutesUntilChange == null ? null : Math.round(win.minutesUntilChange);
    return win.open ? `${label}: open, ${mins == null ? '' : `closes in ${fmtSpan(mins)}`}` : `${label}: under, ${mins == null ? '' : `opens in ${fmtSpan(mins)}`}`; // str
  };
  const tide = [
    lows.length ? `Lows today: ${lows.join(' and ')}` : 'No low today.', // str
    clockSys.isSpringTide(w, G.data) ? t('tide.springNote') : null,
    winLine('stones', 'Lowmoor stones'), // str
    winLine('flats', 'The flats'), // str
    winLine('spur', 'The Bar to the spur'), // str
    winLine('bar', 'The Bar to Shardcrown'), // str
    (w.pendingShifts || []).length ? t('hud.shiftsPending', { n: w.pendingShifts.length }) : null,
  ].filter(Boolean);
  const pace = loans.paceEstimate(w, ctx);
  const st = loans.status(w, ctx);
  const ledger = [
    st.paidOff ? t('ledger.paidOff') : `Loan ${st.tier}: ${st.balance.toLocaleString('en-US')}◉ to go`, // str
    `${st.notches} of ${st.notchesPerStick} notches cut`, // str
    pace.text,
  ];
  const fc = w.weather && w.weather.forecast;
  const odds = fc ? weather.forecastText(fc, G.data) : 'Augusta hasn\'t chalked the odds yet. Six in the morning.'; // str
  const commons = [
    `Augusta's odds: ${odds}${fc && fc.minute != null ? ` (${weather.forecastTime(fc)})` : ''}`, // str
    `Commons Jar: ${(st.jar ?? 0).toLocaleString('en-US')}◉`, // str
    w.weather && w.weather.outlook ? `Tomorrow: ${weather.forecastText(w.weather.outlook, G.data)}` : null, // str
  ].filter(Boolean);
  if (kind === 'tide') return { title: t('board.tideTable'), lines: tide };
  if (kind === 'commons') return { title: t('board.commons'), lines: commons };
  if (kind === 'ledger') return { title: 'Ledger Board', lines: ledger }; // str
  return { title: 'The gate boards', sections: [{ title: 'Ledger', lines: ledger }, { title: t('board.tideTable'), lines: tide }, { title: t('board.commons'), lines: commons }] }; // str
}

function fmtSpan(mins) {
  const m = Math.max(0, Math.round(mins));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

function board_(G, action, host, kind) {
  const content = boardContent(G, kind);
  G.bus.emit('interact', { verb: 'read' });
  if (pushOverlay(G, host, 'createBoardScene', content)) return done(action.verb, { scene: 'board', content });
  const lines = content.sections ? content.sections.flatMap((s) => [s.title, ...s.lines]) : content.lines;
  return done(action.verb, { scene: say(G, lines.join('|')), content });
}

async function commonsJar(G, action, host) {
  const have = wallet.balance(G.world);
  if (have <= 0) { toast(G, host, 'The Commons Jar. Nothing to put in yet.'); return fail('commonsJar', 'empty-wallet'); } // str
  const amounts = [100, 500, 1000].filter((a) => a <= have);
  const opts = [...amounts.map((a) => `${a}◉`), t('confirm.option.later')];
  const pick = await ask(G, host, { body: 'Drop something in the Commons Jar?', options: opts, defaultIndex: opts.length - 1 }); // str
  if (pick < 0 || pick >= amounts.length) return fail('commonsJar', 'declined');
  const res = G.store.tx('commons:jar', (w) => loans.depositJar(w, amounts[pick], laneCtx(G, { source: 'jar' })));
  if (res && res.ok === false) { toast(G, host, 'The jar won\'t take that.'); return fail('commonsJar', res.reason); } // str
  toast(G, host, `Clink. ${amounts[pick]}◉ in the jar.`); // str
  return done('commonsJar', { amount: amounts[pick] });
}

async function pay(G, action, host) {
  const w = G.world;
  const ctx = laneCtx(G);
  if (!loans.yardOpen(minuteOfDay(w), ctx)) { toast(G, host, 'The yard is shut. Wren opens at six.'); return fail('pay', 'closed'); } // str
  if (loans.isPaidOff(w, ctx)) { toast(G, host, t('ledger.paidOff')); return fail('pay', 'paid-off'); }
  const owed = loans.balance(w, ctx);
  const have = wallet.balance(w);
  if (have <= 0) { toast(G, host, 'Wren taps the abacus. "When you have it."'); return fail('pay', 'empty-wallet'); } // str
  const all = Math.min(owed, have);
  const half = Math.max(1, Math.floor(all / 2));
  const amounts = all > 1 ? [all, half] : [all];
  const opts = [...amounts.map((a, i) => (i === 0 ? `${all === owed ? 'All of it' : 'All I have'}: ${a.toLocaleString('en-US')}◉` : `Half: ${a.toLocaleString('en-US')}◉`)), t('confirm.option.later')]; // str
  const pick = await ask(G, host, { title: t('ledger.pay'), body: `${owed.toLocaleString('en-US')}◉ owed on loan ${w.loans.tier}. Pay how much?`, options: opts, defaultIndex: opts.length - 1 }); // str
  if (pick < 0 || pick >= amounts.length) return fail('pay', 'declined');
  const res = G.store.tx('loan:pay', (ww) => loans.pay(ww, amounts[pick], ctx));
  if (!res.ok) { toast(G, host, 'Wren shakes her head.'); return fail('pay', res.reason); } // str
  const params = {
    ceremony: res.ceremony, cleared: res.cleared, paid: res.paid, tier: res.tier,
    roofChoices: res.cleared ? loans.roofChoices(res.cleared.tier, ctx) : [],
    onRoof: (colour) => G.store.tx('loan:roof', (ww) => loans.chooseRoof(ww, res.cleared.tier, colour, ctx)),
  };
  if (hasScene(G, 'ceremony')) G.push('ceremony', params);
  else if (!pushOverlay(G, host, 'createCeremonyScene', params)) toast(G, host, `Paid ${res.paid.toLocaleString('en-US')}◉. THWAP.`); // str
  return done('pay', { scene: 'ceremony', paid: res.paid, cleared: res.cleared });
}

function shop(G, action, host) {
  const d = def(action);
  const id = d.shop || (action.target && action.target.shop) || null;
  if (!id) return look(G, action, host);
  if (G.data.has('shops', id)) {
    const row = G.data.get('shops', id);
    if (!shops.isOpen(G.world, row, laneCtx(G))) {
      const h = Array.isArray(row.hours) ? row.hours : null;
      toast(G, host, h ? `${row.name || 'The shop'} opens ${formatMinute(h[0] % 1440)} to ${formatMinute(h[1] % 1440)}.` : 'Closed.'); // str
      return fail('shop', 'closed');
    }
  }
  G.push('shop', { shop: id });
  return done('shop', { scene: 'shop', shop: id });
}

function crate(G) {
  G.push('shop', { shop: 'consignment-crate', mode: 'crate' });
  return done('crate', { scene: 'shop' });
}

async function ferry(G, action, host) {
  const w = G.world;
  if (!ferryOpen(minuteOfDay(w))) { toast(G, host, t('ferry.closed')); return fail('ferry', 'closed'); }
  const here = host && host.mapId ? host.mapId : w.player.mapId;
  const stops = ferryStops(G.data).filter((s) => s.mapId !== here);
  if (!stops.length) { toast(G, host, t('ferry.closed')); return fail('ferry', 'no-stops'); }
  const fare = ferryFare(w);
  const go = async (stop) => {
    const spec = fare > 0 ? CONFIRMS.ferry : CONFIRMS.ferryFree;
    const pick = await ask(G, host, { title: t('ferry.destination', { place: stop.name, level: stop.curve ?? '?' }), body: t(spec.body, { place: stop.name, cost: fare }), options: spec.options.map((k) => t(k)), defaultIndex: 0 });
    if (pick !== 1) return fail('ferry', 'stayed');
    if (fare > 0) {
      const paid = G.store.tx('ferry:fare', (ww) => wallet.spend(ww, fare, laneCtx(G, { source: 'ferry' })));
      if (!paid.ok) { toast(G, host, `The fare is ${fare}◉. Maud waits.`); return fail('ferry', 'insufficient'); } // str
    }
    if (host && host.caption) host.caption('caption.horn');
    if (host && host.travel) host.travel({ mapId: stop.mapId, x: stop.x, y: stop.y, near: true }, { kind: 'ferry' });
    return done('ferry', { to: stop.mapId, fare });
  };
  if (stops.length === 1) return go(stops[0]);
  return new Promise((resolve) => {
    const params = { stops, fare, onPick: (stop) => { if (!stop) resolve(fail('ferry', 'stayed')); else go(stop).then(resolve); } };
    if (!pushOverlay(G, host, 'createFerryScene', params)) go(stops[0]).then(resolve);
  });
}

function knock(G, action, host) {
  const porchId = def(action).porch || (action.target && action.target.porch);
  const lit = porchId ? isPorchLit(G.world, G.data, porchId, { tuning: TUNING }) : false;
  const row = porchId ? porchesOf(G.data).find((p) => p.id === porchId) : null;
  const npcId = row && row.npcId;
  const here = npcId && host && host.ents ? host.ents.find(npcId) : null;
  G.bus.emit('interact', { verb: 'use' });
  if (here) {
    if (host.faceToward) host.faceToward(npcId);
    G.push('dialogue', { target: { kind: 'porch', id: npcId, mapId: host.mapId, atPorch: true } });
    return done('knock', { scene: 'dialogue', npcId });
  }
  toast(G, host, lit ? 'You knock. Nobody answers, but the lamp is on.' : 'The house is dark. Nobody has lived here for years.'); // str
  return fail('knock', lit ? 'no-answer' : 'dark');
}

async function waystone(G, action, host) {
  const id = def(action).waystone || def(action).id || action.targetId || '';
  const low = gather.lowInfo(G.world).lowIndex;
  const key = `sys.waystone.${String(id).replace(/[^a-z0-9-]/g, '') || 'stone'}`;
  const healed = flags.getFlag(G.world, key) === low;
  if (!healed) {
    G.store.tx('waystone:heal', (w) => { party.heal(w, { data: G.data, bus: G.bus }); flags.setFlag(w, key, low, { bus: G.bus }); });
  }
  G.bus.emit('interact', { verb: 'light' });
  const n = await dayFlow.atWaystone(G, id);
  toast(G, host, healed ? t('waystone.healedAlready') : t('waystone.saved'));
  return done('waystone', { healed: !healed, forecasts: n });
}

async function bed(G, action, host) {
  const r = clockSys.restOptions(G.world, G.data);
  const byKind = Object.fromEntries(r.options.map((o) => [o.kind, o]));
  const labels = [t('rest.lieDown'), t('rest.napTillDusk'), t('rest.sleepTillDawn'), t('confirm.option.later')];
  const pick = await ask(G, host, { title: t('rest.heading'), body: r.realClock ? t('rest.realClock') : `It's ${formatTime(G.world)}. The bed is soft enough.`, options: labels, defaultIndex: 3 }); // str
  const kind = ['lie', 'nap', 'sleep'][pick];
  if (!kind) return fail('bed', 'declined');
  const opt = byKind[kind];
  if (opt && !opt.available) {
    toast(G, host, kind === 'nap' ? t('rest.napTooEarly') : t('rest.tooEarly'));
    return fail('bed', opt.reason || 'too-early');
  }
  if (host && host.sit) host.sit('bed', action.payload);
  if (kind === 'sleep') {
    const report = await dayFlow.askSleep(G);
    return report ? done('bed', { kind, scene: 'dayPage' }) : fail('bed', 'kept-night');
  }
  await dayFlow.rest(G, kind);
  return done('bed', { kind });
}

function sceneVerb(G, action, host) {
  const name = VERB_SCENES[action.verb];
  if (name && hasScene(G, name)) { G.push(name, { from: 'field' }); return done(action.verb, { scene: name }); }
  return look(G, action, host);
}

function dossier(G, action, host) {
  const d = def(action);
  return done('dossier', { scene: say(G, signText(G, d.text || 'The Spire dossier, nailed to the door. Augusta\'s hand.')) }); // str
}

function disabled(G, action, host) {
  toast(G, host, action.disabled);
  if (host && host.sfx) host.sfx('blocked');
  G.bus.emit('player:bump', { reason: action.disabled });
  return fail(action.verb, 'disabled', { message: action.disabled });
}

/** verb -> handler. Map authors use these names; unknown verbs fall back to a look line. */
export const VERB_HANDLERS = Object.freeze({
  talk,
  challenge,
  read,
  look,
  inspect: look,
  pickUp,
  shake,
  dig,
  fish,
  catch: catchVerb,
  net: catchVerb,
  enter,
  board,
  sit,
  mailbox,
  hesperCounter,
  gateBoards: (G, a, h) => board_(G, a, h, 'gate'),
  tideTable: (G, a, h) => board_(G, a, h, 'tide'),
  commons: (G, a, h) => board_(G, a, h, 'commons'),
  ledgerBoard: (G, a, h) => board_(G, a, h, 'ledger'),
  commonsJar,
  pay,
  shop,
  crate,
  ferry,
  knock,
  waystone,
  bed,
  ledger: sceneVerb,
  fieldLog: sceneVerb,
  storage: sceneVerb,
  cellar: sceneVerb,
  tallyWall: sceneVerb,
  dossier,
  memory: (G) => { G.push('archive', { mode: 'memory' }); return done('memory', { scene: 'archive' }); },
  relearn: (G) => { G.push('archive', { mode: 'memory' }); return done('relearn', { scene: 'archive' }); },
  recall: (G) => { G.push('archive', { mode: 'recall' }); return done('recall', { scene: 'archive' }); },
});

/**
 * Executes a context action. The only place overworld verbs push scenes.
 * @param {any} G
 * @param {ContextAction|null} action   copy it first if it came from the reused resolveFacing record
 * @param {Host} [host]
 * @returns {any|Promise<any>}  `{ok, verb, scene?, reason?, ...}`
 */
export function doInteraction(G, action, host) {
  if (!action || typeof action.verb !== 'string') return fail('none', 'no-action');
  if (action.payload?.script && G.data.has('scripts', action.payload.script)) {
    if (action.target?.once) G.store.tx('trigger:use', (w) => markTrigger(w, host?.mapId ?? w.player.mapId, action.targetId));
    G.push('cutscene', { scriptId: action.payload.script });
    return done(action.verb, { scene: 'cutscene', script: action.payload.script });
  }
  if (action.disabled && action.verb !== 'dig' && action.verb !== 'fish') return disabled(G, action, host);
  const fn = VERB_HANDLERS[action.verb];
  if (fn) return fn(G, action, host || {});
  if (VERB_LINES[action.verb]) return done(action.verb, { scene: say(G, VERB_LINES[action.verb]) });
  return look(G, action, host || {});
}

/** Copies the reused resolveFacing record (payload included) so a verb can keep it across frames. */
export function snapshotAction(a) {
  if (!a) return null;
  return { ...a, payload: { ...(a.payload || {}) } };
}
