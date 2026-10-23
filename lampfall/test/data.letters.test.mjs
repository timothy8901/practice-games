// GDD-08 content: the 58 letters and the 10 threads (js/data/letters/*, js/data/threads/*).
// Run: node --test test/data.letters.test.mjs
//
// Overrides DATA's letters / threads (and adds the thread beat scripts) with this chapter's tables.
// Tables owned by other chapters that these reference (items, collections, npcs, maps, species,
// story scripts) are stood in for by stub rows built from js/data/ids.manifest.js, so references
// are checked against the manifest's id lists. Asserts validateData has zero errors for letters,
// threads and the th-* scripts, checkManifest shows both tables complete, the letter system accepts
// the rows, every beat script runs to its end on every choice path, and the GDD-00 §11 facts hold.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { DATA } from '../js/data/index.js';
import * as M from '../js/data/ids.manifest.js';
import { validateData, checkManifest } from '../tools/validate-data.mjs';
import { createRegistry } from '../js/data/registry.js';
import { createRunner } from '../js/script/runner.js';
import { validateOps, walkOps } from '../js/script/ops.js';
import * as L from '../js/systems/letters.js';
import * as TH from '../js/systems/threads.js';
import { createNewWorld } from '../js/state/schema.js';

import { LETTERS, SEALS, LETTERS_BY_CHANNEL } from '../js/data/letters/index.js';
import { THREADS, THREAD_SCRIPTS, THREAD_BY_NPC } from '../js/data/threads/index.js';

// ---- stand-ins for other chapters' tables, from the manifest -------------------------------------
const MAP_SIZE = (id) => {
  if (id === 'pellwick') return [64, 48];
  if (['lowmoor', 'cairnhold', 'emberstep', 'drownwood', 'thistlewind', 'rimeholt'].includes(id)) return [48, 32];
  if (id === 'the-bar') return [64, 24];
  return [20, 14];
};
const stubMap = (id) => {
  const [w, h] = MAP_SIZE(id);
  return { id, name: id, kind: id.startsWith('int-') ? 'interior' : 'exterior', region: 'pellwick', w, h,
    ground: Array.from({ length: h }, () => '.'.repeat(w)), entities: [], triggers: [], warps: [], spawns: [], entry: { x: 1, y: 1 } };
};
const ITEM_POCKET = (id) => (M.KEEPSAKE_IDS.includes(id) ? 'keepsakes' : 'tools');
const STUBS = {
  items: [...M.ITEM_IDS, ...M.DISC_IDS, ...M.KEY_ITEM_IDS, ...M.KEEPSAKE_IDS, ...M.GOODS_IDS].map((id) => ({
    id, name: id, pocket: ITEM_POCKET(id), price: 0, sell: 0, stack: 1, use: null, oneOfAKind: M.KEEPSAKE_IDS.includes(id), text: id })),
  collections: [
    ...M.FISH_IDS.map((id) => ({ id, kind: 'fish', name: id, price: 100 })),
    ...M.BUG_IDS.map((id) => ({ id, kind: 'bug', name: id, price: 100 })),
    ...M.FIND_IDS.map((id) => ({ id, kind: 'relic', name: id, price: 300 })),
    ...M.FRUIT_IDS.map((id) => ({ id, kind: 'fruit', name: id, price: 120 })),
  ],
  npcs: M.NPC_IDS.map((id) => ({ id, name: id, species: 'stub', portrait: id, sprite: id, home: 'pellwick',
    threadId: THREAD_BY_NPC[id] ?? null, schedule: [], topics: [], lines: { generic: [{ id: 'g1', text: 'Stub.' }] } })),
  maps: M.MAP_IDS.map(stubMap),
  species: M.SPECIES_IDS.map((id) => ({ id, name: id, types: ['Plain'], familyId: M.SPECIES_FAMILY[id], stage: 1,
    base: { hp: 1, atk: 1, def: 1, spa: 1, spd: 1, spe: 1 }, ability: 'stub', learnset: [], heartmark: null, catchRate: 1, expYield: 1, growth: 'medium-fast', flags: {} })),
};
const storyStubs = Object.fromEntries(M.SCRIPT_IDS.map((id) => [id, [{ op: 'end' }]]));

const OWN = { letters: LETTERS, threads: THREADS };
const D = { ...DATA, ...STUBS, ...OWN, scripts: { ...DATA.scripts, ...storyStubs, ...THREAD_SCRIPTS } };
const REG = createRegistry(D);
const mine = (line) => line.startsWith('letters:') || line.startsWith('threads:') || line.startsWith('scripts:th-');

const words = (body) => body.replace(/\|/g, ' ').split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
const allText = () => [
  ...LETTERS.flatMap((l) => [l.body, l.subject, l.from, l.to, l.date, l.envelope ?? '']),
  ...Object.values(THREAD_SCRIPTS).flatMap((ops) => { const out = []; walkOps(ops, (op) => { for (const k of ['text', 'prompt']) if (typeof op[k] === 'string') out.push(op[k]); if (op.op === 'choice') for (const o of op.options) out.push(o.text); }); return out; }),
  ...THREADS.flatMap((t) => [t.title, t.summary, ...t.beats.flatMap((b) => [b.when, b.topic])]),
];

// ---- the validator -----------------------------------------------------------------------------
describe('validator', () => {
  it('validateData: zero errors in letters, threads and the th-* scripts', () => {
    const { errors } = validateData(D);
    assert.deepEqual(errors.filter(mine), []);
  });

  it('validateData: no warnings in letters / threads / th-* scripts except flags other chapters set', () => {
    const { warnings } = validateData(D, { manifest: M.MANIFEST });
    const own = warnings.filter(mine).filter((w) => !/flag '(sp|lit|sys)\.[^']+' is read but never set/.test(w));
    assert.deepEqual(own, []);
  });

  it('checkManifest: letters and threads complete, no extras', () => {
    const { warnings, notes } = checkManifest(D, M.MANIFEST);
    assert.deepEqual(warnings.filter((w) => w.startsWith('letters:') || w.startsWith('threads:')), []);
    assert.ok(!notes.some((n) => /'(letters|threads)'/.test(n)), 'both tables count as authored');
    assert.deepEqual(LETTERS.map((l) => l.id).sort(), [...M.LETTER_IDS].sort());
    assert.deepEqual(THREADS.map((t) => t.id), [...M.THREAD_IDS]);
  });

  it('every story flag (sp.*, lit.*) these tables read or set is a manifest flag', () => {
    const seen = new Set();
    const read = (c) => { if (!c || typeof c !== 'object') return; if (typeof c.flag === 'string') seen.add(c.flag); for (const v of Object.values(c)) if (v && typeof v === 'object') (Array.isArray(v) ? v.forEach(read) : read(v)); };
    for (const t of THREADS) { read(t.involve); for (const b of t.beats) read(b.cond); }
    for (const ops of Object.values(THREAD_SCRIPTS)) walkOps(ops, (op) => { if (op.op === 'setFlag') seen.add(op.id); if (op.op === 'if') read(op.cond); });
    for (const l of LETTERS) for (const f of l.flags) seen.add(f);
    const story = [...seen].filter((f) => /^(sp|lit)\./.test(f));
    assert.ok(story.length > 10);
    for (const f of story) assert.ok(M.FLAG_IDS.includes(f), `${f} is not in FLAG_IDS`);
    for (const f of seen) assert.match(f, /^(sp|lit|th|np|sys)\./, f);
  });

  it('th-* scripts never collide with manifest story script ids', () => {
    for (const id of Object.keys(THREAD_SCRIPTS)) {
      assert.ok(!M.SCRIPT_IDS.includes(id), id);
      assert.match(id, /^th-[a-z0-9-]+-\d$/);
      assert.deepEqual(validateOps(THREAD_SCRIPTS[id], { scriptId: id, has: REG.has, isNpcId: (x) => REG.has('npcs', x) }).errors, []);
    }
  });

  it('systems/letters accepts every row', () => {
    assert.deepEqual(L.validateLetters({ letters: LETTERS }), []);
  });
});

// ---- letters -----------------------------------------------------------------------------------
describe('letters', () => {
  it('58 rows, n 1..58: K 1-20, F 21-38, T 39-56, E 57-58, labels by channel', () => {
    assert.equal(LETTERS.length, 58);
    assert.deepEqual(LETTERS.map((l) => l.n), Array.from({ length: 58 }, (_, i) => i + 1));
    const counts = { keeper: 20, family: 18, town: 18, event: 2 };
    for (const [ch, n] of Object.entries(counts)) assert.equal(LETTERS_BY_CHANNEL[ch].length, n, ch);
    for (const l of LETTERS) {
      const prefix = L.CHANNEL_PREFIX[l.channel];
      assert.equal(L.labelOf({ letters: LETTERS }, l), `${prefix}${l.index}`);
      assert.equal(l.id, `${prefix.toLowerCase()}${l.index}`);
      assert.equal(L.channelOf(l), l.channel);
    }
  });

  it('every letter is 40-160 words, except the canon post-credits "I saw the light."', () => {
    for (const l of LETTERS) {
      if (l.id === 'e2') { assert.equal(l.body, 'I saw the light.|—I. Petrel'); continue; }
      const w = words(l.body);
      assert.ok(w >= 40 && w <= 160, `${l.id}: ${w} words`);
    }
  });

  it('authors are manifest npcs or null with a byline; seals are SEALS rows; reveal flags mirror into flags', () => {
    const seals = new Set(SEALS.map((s) => s.id));
    for (const l of LETTERS) {
      if (l.author === null) assert.ok(typeof l.byline === 'string' && l.byline, `${l.id}: byline`);
      else assert.ok(['isolde', 'mabry', 'merrow', 'ansel'].includes(l.author) && M.NPC_IDS.includes(l.author), `${l.id}: author`);
      assert.ok(seals.has(l.seal), `${l.id}: seal ${l.seal}`);
      assert.ok(Array.isArray(l.reveal) && l.reveal.length > 0, `${l.id}: reveals`);
      assert.ok(l.reveal.every((op) => ['setFlag', 'toast'].includes(op.op)));
      assert.deepEqual(l.flags, l.reveal.filter((op) => op.op === 'setFlag').map((op) => op.id));
      for (const f of l.flags) assert.match(f, /^(np|th)\.[a-z0-9-]+\.[a-z0-9-]+$/, `${l.id}: flag ${f}`);
      if (l.addressee && l.addressee !== 'player') assert.ok(M.NPC_IDS.includes(l.addressee), `${l.id}: addressee`);
      assert.equal(l.unlock, null);
    }
  });

  it('Keeper letters: Isolde to the Keeper at 06:00, K1 on day 2 ... K20 on day 21', () => {
    LETTERS_BY_CHANNEL.keeper.forEach((l, i) => {
      assert.equal(l.author, 'isolde');
      assert.deepEqual(l.deliver, { at: 'mailbox', hour: 6, day: i + 2 });
    });
  });

  it('the Keeper letters deliver one a morning through systems/letters: GDD day n brings K(n-1)', () => {
    const w = createNewWorld({ seedCode: 'GDD08-TEST' });
    w.loans.tier = 2;
    const got = [];
    for (let day = 0; day <= 21; day++) {
      w.clock.total = day * 1440 + 6 * 60;
      const r = L.deliverMorning(w, { letters: LETTERS });
      if (r.keeper !== null) got.push([day + 1, L.letterByN({ letters: LETTERS }, r.keeper).id]);
      L.collectMail(w, { letters: LETTERS });
    }
    assert.deepEqual(got, Array.from({ length: 20 }, (_, i) => [i + 2, `k${i + 1}`]));
  });

  it('family letters: one door each, the heirlooms and the four creatures of GDD-00 §11', () => {
    const fam = LETTERS_BY_CHANNEL.family;
    fam.forEach((l, i) => {
      assert.ok(M.PORCH_IDS.includes(l.door), `${l.id}: door ${l.door}`);
      assert.deepEqual(l.deliver, { at: 'counter', hour: 18, day: i + 2, carry: true });
      if (l.heirloom !== null) assert.ok(M.KEEPSAKE_IDS.includes(l.heirloom), `${l.id}: heirloom`);
    });
    const creatures = fam.filter((l) => l.creature).map((l) => [l.id, l.creature.species]);
    assert.deepEqual(creatures, [['f1', 'bilgebob'], ['f5', 'puddlepip'], ['f9', 'mothling'], ['f13', 'wirewhisk']]);
    for (const l of fam.filter((x) => x.creature)) {
      assert.ok(M.SPECIES_IDS.includes(l.creature.species));
      assert.ok(Number.isInteger(l.creature.level) && l.creature.level >= 5 && l.creature.level <= 20);
    }
    const lights = fam.filter((l) => l.lightsPorch).map((l) => [l.id, l.lightsPorch]);
    assert.deepEqual(lights, [['f1', 'porch-dorrow'], ['f5', 'porch-bryony'], ['f9', 'porch-odile'], ['f13', 'porch-thessaly']]);
    const heir = Object.fromEntries(fam.filter((l) => l.heirloom).map((l) => [l.id, l.heirloom]));
    assert.deepEqual(heir, { f1: 'dorrow-kettle', f4: 'brack-still-knot', f5: 'bryony-seed-tin', f6: 'grade-two-lantern', f9: 'odile-easel', f13: 'thessaly-almanac' });
    const ids = Object.fromEntries(fam.map((l) => [l.id, l.door]));
    assert.equal(ids.f4, 'porch-dark-1');
    assert.equal(ids.f18, 'porch-keepers-cottage');
  });

  it('carried to their doors, the family letters return every heirloom and the four creatures; F4 waits for Tamsin', () => {
    const data = { letters: LETTERS };
    const w = createNewWorld({ seedCode: 'GDD08-DOORS' });
    const lit = new Set(['porch-coop-yard', 'porch-pells', 'porch-post-office', 'porch-archive', 'porch-wardens-house', 'porch-tully', 'porch-linnet', 'porch-keepers-cottage']);
    const items = [];
    const creatures = [];
    const opts = { isPorchLit: (id) => lit.has(id) || w.flags[`sys.porch.${id}`] === true, giveItem: (_w, id) => items.push(id), addCreature: (_w, c) => creatures.push(c.species) };
    for (let day = 1; day <= 18; day++) {
      w.clock.total = day * 1440 + 18 * 60 + 5;
      const r = L.deliverEvening(w, data, opts);
      assert.equal(r.reason, null, `day ${day + 1}`);
      const c = L.carry(w, data, opts);
      assert.ok(c.ok);
      const row = L.letterByN(data, c.n);
      const d = L.deliverToDoor(w, data, c.n, row.door, opts);
      assert.ok(d.ok, row.id);
    }
    assert.deepEqual(creatures, ['bilgebob', 'puddlepip', 'mothling', 'wirewhisk']);
    assert.deepEqual(items.sort(), ['bryony-seed-tin', 'dorrow-kettle', 'grade-two-lantern', 'odile-easel', 'thessaly-almanac']);
    assert.deepEqual(w.letters.awaiting, [24], 'the Bracks\' knot waits at dark house 1');
    lit.add('porch-dark-1');
    const rel = L.releaseHeirlooms(w, data, opts);
    assert.deepEqual(rel.map((x) => x.item), ['brack-still-knot']);
  });

  it('town letters: one per find, every find covered; documents by notice, Mabry, Merrow and Ansel', () => {
    const town = LETTERS_BY_CHANNEL.town;
    assert.deepEqual(town.map((l) => l.find).sort(), [...M.FIND_IDS].sort());
    for (const l of town) {
      assert.equal(l.relicId, l.find);
      assert.equal(L.townLetterFor({ letters: LETTERS }, l.find).id, l.id);
      assert.deepEqual(l.deliver, { at: 'wall', find: l.find, postFromDay: 22 });
    }
    const by = (a) => town.filter((l) => l.author === a).map((l) => l.id);
    assert.deepEqual(by('mabry'), ['t2', 't4', 't8', 't13', 't17']);
    assert.deepEqual(by('merrow'), ['t5', 't6', 't10', 't12']);
    assert.deepEqual(by('ansel'), ['t11', 't14', 't16', 't18']);
  });

  it('event letters: the Lantern letter and "I saw the light", deliverable by event id', () => {
    const w = createNewWorld({ seedCode: 'GDD08-EVENT' });
    assert.deepEqual(L.deliverEvent(w, { letters: LETTERS }, 'lantern'), { ok: true, n: 57 });
    assert.deepEqual(L.deliverEvent(w, { letters: LETTERS }, 'saw-the-light'), { ok: true, n: 58 });
  });

  it('canon lines are present (GDD-00 §11 reveal order)', () => {
    const body = (id) => LETTERS.find((l) => l.id === id).body;
    assert.match(body('k1'), /The light is fine\. It's the river that's wrong\./);
    assert.match(body('k2'), /Young Stalk writes a good report and reads a poor drawing\./);
    assert.match(body('k3'), /a thirty-year road/);
    assert.match(body('k4'), /I can see which way she leans/);
    assert.match(body('k6'), /Oil for nine nights/);
    assert.match(body('k7'), /a bell goes with the quay if the bar takes it/);
    assert.match(body('k8'), /the wheel needed two of us/);
    assert.match(body('k10'), /A read Shift is a Shift survived\./);
    assert.match(body('k12'), /counter at Pell's the night I went, for whoever comes/);
    assert.match(body('k14'), /He wrote what he could see/);
    assert.match(body('f1'), /civic institution/);
    assert.match(body('e1'), /I taught a boy on the Isles to do this\. He'll have taught you\./);
    assert.ok(!/Fenwake/.test(LETTERS.map((l) => l.body).join(' ')), 'the harbormaster is Stalk, not Fenwake');
  });
});

// ---- threads -----------------------------------------------------------------------------------
describe('threads', () => {
  it('6 lead threads, 3 cast arcs, 1 template; beat counts and npcs from the manifest', () => {
    const kinds = Object.fromEntries(THREADS.map((t) => [t.id, t.kind]));
    assert.deepEqual(Object.values(kinds).filter((k) => k === 'lead').length, 6);
    assert.deepEqual(THREADS.filter((t) => t.kind === 'cast').map((t) => t.id), ['ember-grub', 'water-pack', 'empty-creek']);
    assert.equal(kinds['second-chapter'], 'template');
    const npcs = Object.fromEntries(THREADS.map((t) => [t.id, t.npcId]));
    assert.deepEqual(npcs, { 'mudlark-mile': 'tully', 'twelve-lights': 'odile', 'oyster-boat': 'tamsin', 'the-fence': 'bryony', 'heirlooms-going-home': 'juniper', 'the-bell': 'barnaby', 'ember-grub': 'linnet', 'water-pack': 'wick', 'empty-creek': 'ansel', 'second-chapter': 'thessaly' });
    const beats = Object.fromEntries(THREADS.map((t) => [t.id, t.beats.length]));
    assert.deepEqual(beats, { 'mudlark-mile': 5, 'twelve-lights': 5, 'oyster-boat': 5, 'the-fence': 4, 'heirlooms-going-home': 6, 'the-bell': 4, 'ember-grub': 5, 'water-pack': 4, 'empty-creek': 5, 'second-chapter': 3 });
    for (const t of THREADS) {
      assert.ok(t.kind === 'template' ? t.beats.length === 3 : t.beats.length >= 4 && t.beats.length <= 6, t.id);
      assert.ok(TH.THREAD_KINDS.includes(t.kind));
      for (const b of t.beats) {
        assert.ok(b.npcId === undefined || M.NPC_IDS.includes(b.npcId), `${t.id}:${b.id} npcId`);
        assert.ok(typeof b.when === 'string' && b.when && typeof b.topic === 'string' && b.topic, `${t.id}:${b.id} when/topic`);
        assert.ok(Array.isArray(b.choices) && b.choices.length >= 1, `${t.id}:${b.id} choices`);
        if (b.where) assert.ok(M.MAP_IDS.includes(b.where.mapId), `${t.id}:${b.id} where`);
      }
    }
  });

  it('lead threads pay the resident share on their last beat; cast and template threads do not', () => {
    for (const t of THREADS) {
      const last = t.beats[t.beats.length - 1];
      assert.equal(last.reward?.share, t.kind === 'lead', t.id);
      for (const b of t.beats.slice(0, -1)) assert.equal(b.reward, undefined, `${t.id}:${b.id}`);
    }
    const reward = (id) => THREADS.find((t) => t.id === id).beats.at(-1).reward;
    assert.equal(reward('mudlark-mile').keepsake, 'tully-sweatband');
    assert.deepEqual(reward('the-fence').creature, { species: 'sedgehare', level: 14 });
  });

  it('every beat script exists, ends by setting its own beat, and every choice option is remembered', () => {
    const used = new Set();
    for (const t of THREADS) {
      for (const b of t.beats) {
        const ops = THREAD_SCRIPTS[b.script];
        assert.ok(ops, `${t.id}:${b.id} script ${b.script}`);
        assert.equal(b.script, `th-${t.id}-${b.id}`);
        used.add(b.script);
        const beatOps = [];
        let choices = 0;
        walkOps(ops, (op) => {
          if (op.op === 'beat') beatOps.push(op);
          if (op.op === 'choice') {
            choices++;
            assert.ok(op.options.length >= 2, `${b.script}: a choice point has two sides`);
            for (const o of op.options) {
              const then = o.then ?? [];
              const flag = then.find((x) => x.op === 'setFlag' && x.id.startsWith(`th.${t.id}.`));
              const rem = then.find((x) => x.op === 'remember');
              assert.ok(flag && rem, `${b.script}: option "${o.text}" is remembered (flag + npc memory)`);
              assert.ok(b.choices.some((c) => c.key === flag.id && c.options.includes(flag.value)), `${b.script}: ${flag.id}=${flag.value} documented`);
            }
          }
        });
        assert.ok(choices >= 1, `${b.script}: has a choice point`);
        assert.deepEqual(beatOps.map((o) => [o.thread, o.to]), [[t.id, b.id]], `${b.script}: sets beat ${b.id}`);
      }
    }
    assert.deepEqual([...used].sort(), Object.keys(THREAD_SCRIPTS).sort(), 'no orphan scripts');
  });

  it('every beat script runs to its end on every choice path', () => {
    for (const [id, ops] of Object.entries(THREAD_SCRIPTS)) {
      let width = 1;
      walkOps(ops, (op) => { if (op.op === 'choice') width = Math.max(width, op.options.length); });
      for (let pick = 0; pick < width; pick++) {
        const world = createNewWorld({ seedCode: 'GDD08-RUN' });
        world.player.name = 'Sorrel';
        const calls = [];
        const rec = (name) => (...args) => { calls.push([name, ...args.slice(1)]); };
        const systems = { give: rec('give'), take: rec('take'), earn: rec('earn'), spend: rec('spend'), addCreature: rec('addCreature'), remember: rec('remember'), setBeat: rec('setBeat') };
        const r = createRunner(ops, { world, data: REG, systems, npc: THREADS.find((t) => id.startsWith(`th-${t.id}-`)).npcId, scriptId: id });
        let req = r.step();
        let guard = 0;
        while (!req.done) {
          assert.ok(++guard < 200, `${id}: runaway`);
          if (req.op === 'say') assert.ok(!/\{(player|npcNick)\}/.test(req.text), `${id}: uninterpolated ${req.text}`);
          req = r.step(req.op === 'choice' ? Math.min(pick, req.options.length - 1) : undefined);
        }
        const beat = calls.filter((c) => c[0] === 'setBeat');
        assert.equal(beat.length, 1, `${id} pick ${pick}`);
      }
    }
  });

  it('systems/threads: beats walk 1..n and complete each thread exactly once', () => {
    const data = { threads: THREADS };
    for (const t of THREADS) {
      const w = createNewWorld({ seedCode: 'GDD08-BEATS' });
      let paid = 0;
      for (let b = 1; b <= t.beats.length; b++) {
        const r = TH.setBeat(w, data, t.id, b, { loans: { residentShare: () => { paid++; return 1; } } });
        assert.ok(r.ok);
        assert.equal(r.done, b === t.beats.length);
      }
      assert.equal(paid, t.kind === 'lead' ? 1 : 0, t.id);
    }
  });

  it('spring-low beats (the Mile, the bell dig) wait for a Saturday low tide', () => {
    const beat = (tid, n) => THREADS.find((t) => t.id === tid).beats[n - 1];
    for (const b of [beat('mudlark-mile', 5), beat('the-bell', 3)]) {
      assert.deepEqual(b.advance, { dayOfWeek: [5] });
      assert.deepEqual(b.cond, { lowTide: true });
    }
    assert.deepEqual(beat('the-bell', 2).cond, { letter: { read: 7 } }, 'the bell is located by K7');
    assert.deepEqual(beat('empty-creek', 4).cond.all[0], { letter: { read: 9 } }, 'the confession follows K9');
  });
});

// ---- quality bar -------------------------------------------------------------------------------
describe('quality', () => {
  it('no placeholder text, no TODOs, no borrowed IP names', () => {
    const text = allText().join('\n');
    assert.ok(!/\b(TODO|TBD|FIXME|PLACEHOLDER|lorem)\b/i.test(text));
    assert.ok(!/\b(Pok[eé]mon|Pikachu|Nintendo|Animal Crossing|Nook|Isabelle|Gyarados|Groudon|Mudkip)\b/i.test(text));
    assert.ok(!/\bTuck\b|\bClem(entine)?\b|\bBramble\b/.test(text), 'renamed neighbors keep their new names');
  });
});
