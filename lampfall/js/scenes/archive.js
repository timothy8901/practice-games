/** Barnaby's free Memory desk and Corin's six-Starsalt Recall service. */
import { drawText } from '../core/font.js';
import { COLORS } from '../ui/theme.js';
import { createList } from '../ui/list.js';
import { openConfirm } from '../ui/confirm.js';
import * as creature from '../systems/creature.js';
import * as party from '../systems/party.js';
import * as exp from '../systems/exp.js';
import * as wallet from '../systems/wallet.js';
import * as fieldLog from '../systems/fieldLog.js';
import { TUNING } from '../data/tuning.js';
import { t } from '../data/strings.js';
import { drawBackdrop, drawHeading, drawHints, drawSkinPanel, drawCreature, prefsOf, skinOf, fitText, sfx, toast } from './menuKit.js';

/** A Recall is deliberate: only a known form, after four seals, and no held Still Knot. */
export function recallAtArchive(world, uid, formId, data, opts = {}) {
  const found = party.findCreature(world, uid);
  if (!found) return { ok: false, reason: 'No creature selected.' };
  const c = found.c;
  const cost = opts.tuning?.recallStarsalt ?? 6;
  if ((world.badges?.length ?? 0) < (opts.tuning?.recallFromBadge ?? 4)) return { ok: false, reason: 'Recall opens with the fourth seal.' };
  if (c.stillKnot) return { ok: false, reason: 'Take off its Still Knot before Recall.' };
  if (!c.shiftlog.includes(formId) || c.speciesId === formId) return { ok: false, reason: 'Choose another form from its Shiftlog.' };
  if (wallet.balance(world, 'starsalt') < cost) return { ok: false, reason: `Recall needs ${cost} Starsalt.` };
  // Validate the complete transition before payment so an invalid form can never cost currency.
  creature.shiftTo(creature.deserialize(creature.serialize(c), data, opts), formId, data, world.run.dial, opts);
  const paid = wallet.spend(world, cost, { ...opts, currency: 'starsalt', source: 'recall' });
  if (!paid.ok) return { ok: false, reason: `Recall needs ${cost} Starsalt.` };
  const result = creature.shiftTo(c, formId, data, world.run.dial, opts);
  exp.refreshPending(world, uid, data, opts);
  fieldLog.markHeld(world, formId, { data, bus: opts.bus });
  opts.bus?.emit('party:changed', { reason: 'recall', uid });
  return { ok: true, cost, result };
}

/**
 * What an empty Memory / Recall list says to do next (FH-11, LG-PF5). Pure.
 * @param {'memory'|'recall'} service
 * @returns {string}
 */
export function emptyServiceText(service) {
  return t(service === 'memory' ? 'archive.memory.empty' : 'archive.recall.empty');
}

export function createArchiveScene(G) {
  let service = 'memory';
  let stage = 'party';
  let selectedUid = null;
  let selectedMove = null;
  let busy = false;
  const sk = () => skinOf(prefsOf(G));
  const lookup = (table, id) => fieldLog.rowOf(G.data, table, id);
  const current = () => G.world.party.find((c) => c.uid === selectedUid) ?? G.world.party[creatures.index] ?? null;
  const ctx = () => ({ data: G.data, tuning: TUNING, bus: G.bus });
  const locked = () => G.world.badges.length < (TUNING.recallFromBadge ?? 4);
  const creatures = createList({ rect: { x: 20, y: 56, w: 176, h: 176 }, rowH: 27, items: [], style: sk().style,
    onSelect: (it) => { selectedUid = it.id; stage = 'options'; refreshOptions(); sfx(G, 'confirm'); },
    onCancel: () => G.scenes.pop(), onChange: () => sfx(G, 'cursor'),
    render(c, item, x, y, w) {
      const cr = item.data;
      drawText(c, fitText(cr.nickname, w - 35), x + 2, y + 3, { color: sk().text });
      drawText(c, `Lv${cr.level}`, x + w - 3, y + 3, { color: sk().soft, align: 'right' });
      const n = service === 'memory' ? creature.relearnable(cr, G.data).length : new Set(cr.shiftlog).size;
      drawText(c, `${n} ${service === 'memory' ? 'Memory moves' : 'known forms'}`, x + 2, y + 16, { color: sk().faint, font: 'small' });
    },
  });
  const options = createList({ rect: { x: 214, y: 132, w: 242, h: 95 }, rowH: 16, items: [], style: sk().style,
    onSelect: choose, onCancel: () => { stage = 'party'; selectedUid = null; sfx(G, 'cancel'); }, onChange: () => sfx(G, 'cursor') });

  function refreshOptions() {
    const c = current();
    if (!c) { options.setItems([]); return; }
    if (stage === 'forget') {
      options.setItems(c.moves.map((m, index) => ({ id: m.id, label: lookup('moves', m.id)?.name ?? m.id, enabled: m.id !== c.heartmark, reason: 'The Heartmark technique stays.', data: { replace: index } })));
    } else if (service === 'memory') {
      options.setItems(creature.relearnable(c, G.data).map((id) => ({ id, label: lookup('moves', id)?.name ?? id, value: 'free' })));
    } else {
      const why = locked() ? 'Recall opens with the fourth seal.' : c.stillKnot ? 'Take off its Still Knot before Recall.' : wallet.balance(G.world, 'starsalt') < (TUNING.recallStarsalt ?? 6) ? 'Recall needs 6 Starsalt.' : null;
      options.setItems([...new Set(c.shiftlog)].filter((id) => id !== c.speciesId).map((id) => ({ id, label: lookup('species', id)?.name ?? id, value: '6 salt', enabled: !why, reason: why })));
    }
  }

  function refresh() {
    creatures.setItems(G.world.party.map((c) => ({ id: c.uid, label: c.nickname, data: c })));
    refreshOptions();
  }

  function changeService(next) { service = next; stage = 'party'; selectedUid = null; selectedMove = null; refresh(); sfx(G, 'cursor'); }

  async function choose(item) {
    if (!item || busy) return;
    const c = current();
    if (!c) return;
    if (service === 'recall') {
      busy = true;
      const answer = await openConfirm(G, { body: `Recall ${c.nickname} to ${item.label} for 6 Starsalt? Its level and Heartmark stay.`, options: ['Keep this form', 'Recall'], defaultIndex: 0 });
      busy = false;
      if (answer !== 1) return;
      const result = G.store.tx('archive:recall', (w) => recallAtArchive(w, c.uid, item.id, G.data, ctx()));
      toast(G, result.ok ? `${c.nickname} returned to ${item.label}. Same mark, every shape.` : result.reason);
      sfx(G, result.ok ? 'confirm' : 'error');
      refresh();
      return;
    }
    if (stage === 'options' && c.moves.length >= 4) { selectedMove = item.id; stage = 'forget'; refreshOptions(); return; }
    const moveId = stage === 'forget' ? selectedMove : item.id;
    const replaceIndex = stage === 'forget' ? item.data.replace : undefined;
    if (replaceIndex !== undefined) {
      busy = true;
      const answer = await openConfirm(G, { body: `Forget ${item.label} to relearn ${lookup('moves', moveId)?.name ?? moveId}?`, options: ['Keep it', 'Relearn'], defaultIndex: 0 });
      busy = false;
      if (answer !== 1) return;
    }
    const ok = G.store.tx('archive:memory', (w) => {
      const rec = party.findCreature(w, c.uid)?.c;
      return rec && creature.relearnFromMemory(rec, moveId, G.data, { tuning: TUNING, replaceIndex });
    });
    if (ok) {
      G.bus?.emit('party:changed', { reason: 'relearn', uid: c.uid });
      toast(G, `${c.nickname} remembered ${lookup('moves', moveId)?.name ?? moveId}. No charge.`);
      sfx(G, 'confirm');
    } else sfx(G, 'error');
    stage = 'options'; selectedMove = null; refresh();
  }

  return {
    name: 'archive', opaque: true,
    enter(p = {}) { service = p.mode === 'recall' ? 'recall' : 'memory'; stage = 'party'; selectedUid = null; refresh(); },
    exit() {}, pause() {}, resume() {},
    update(dt) { creatures.update(dt); options.update(dt); },
    handleInput(input) {
      if (busy) return;
      const p = input.pointer;
      if (input.pressed('l') || input.pressed('r')) { changeService(service === 'memory' ? 'recall' : 'memory'); return; }
      if (p?.justDown && p.y >= 19 && p.y < 37) { changeService(p.x < 240 ? 'memory' : 'recall'); return; }
      if (stage === 'party') creatures.handle(input); else options.handle(input);
    },
    draw(c) {
      const skin = sk();
      drawBackdrop(c, prefsOf(G));
      drawHeading(c, 'Barnaby’s Archive', `${wallet.balance(G.world, 'starsalt')} Starsalt`);
      for (const [i, label] of ['Memory — free', 'Recall — 6 Starsalt'].entries()) {
        c.fillStyle = (service === 'memory') === (i === 0) ? skin.card : '#29366F'; c.fillRect(16 + i * 226, 20, 222, 15);
        drawText(c, label, 126 + i * 226, 24, { color: (service === 'memory') === (i === 0) ? skin.text : COLORS.paper.light, align: 'center' });
      }
      drawSkinPanel(c, { x: 10, y: 42, w: 190, h: 196 }, skin, 'ledger');
      drawSkinPanel(c, { x: 206, y: 42, w: 264, h: 196 }, skin, 'paper');
      creatures.draw(c);
      const cr = current();
      if (cr) {
        drawCreature(c, G, cr, 376, 49, { scale: 2 });
        drawText(c, fitText(cr.nickname, 155), 218, 54, { color: skin.text });
        drawText(c, stage === 'forget' ? 'Choose a move to forget' : service === 'memory' ? 'Moves waiting in its Memory' : locked() ? 'Opens with the fourth seal' : 'Forms from its own Shiftlog', 218, 72, { color: skin.soft, maxWidth: 155 });
        if (stage !== 'party') {
          options.draw(c);
          if (!options.items.length) drawText(c, emptyServiceText(service), 220, 148, { color: skin.faint, maxWidth: 230 });
        } else drawText(c, 'Choose a creature on the left.', 220, 143, { color: skin.soft, maxWidth: 230 });
      } else drawText(c, 'Your companions will find their way here.', 220, 91, { color: skin.soft, maxWidth: 230 });
      drawHints(c, G.input, [['l', 'Service'], ['confirm', 'Choose'], ['cancel', 'Back']]);
    },
    debugText: () => `archive ${service} ${stage} | ${current()?.nickname ?? 'empty'} | ${options.selected()?.id ?? 'no choices'} | ${wallet.balance(G.world, 'starsalt')} Starsalt`,
  };
}
