/** Bridge declarative story flags to the town systems that own their consequences. */
import * as loans from '../loans.js';
import * as letters from '../letters.js';
import * as wallet from '../wallet.js';
import * as flags from '../flags.js';
import { duelPayout, duelEvening, PORCH_DUEL_FLAG_PREFIX, PORCH_DUEL_DONE_PREFIX } from '../townCommon.js';
import { TUNING } from '../../data/tuning.js';
import { PORCH_DUELS } from '../../data/town.js';
import { t } from '../../data/strings.js';
const INSTALLED = new WeakMap();

/**
 * Installs the story bridges on a game context (once per G):
 *  - `sys.errand.<id>` flags credit a First Night Errand; `sys.deliver.<event>` delivers an event letter;
 *  - **resident share** (LG-RN35 / RN62; GDD-00 §7, GDD-02 §2): a lead thread finished through a path
 *    that did not inject `{loans: {residentShare}}` (`thread:done` with `share: true` and no result) is
 *    paid here, 5% of the open loan as one notch, or 4,000 to the Commons Jar after payoff.
 *    `loans.residentShare` credits each thread once, so a caller that did pay is never paid twice;
 *  - **Gallery frames** (LG-RN36; GDD-00 §9): a form first Held, or the Gallery build landing, pays
 *    any new frame (1,000 per 6 Held forms) through `loans.galleryFrames`;
 *  - **Porch Duel payout** (GDD-05 §8): the porch-* trainer rows carry `payout: 0` and a `payoutRule`
 *    the battle engine does not read, so a won duel (`battle:end {porchDuel: true, outcome: 'win'}`) is
 *    paid here: `porchDuelPerCurve` (30) × the posted curve by badges held.
 * @param {any} G
 * @returns {() => void} uninstall
 */
export function installStoryHooks(G) {
  if (INSTALLED.has(G)) return INSTALLED.get(G);
  const ctx = () => ({ data: G.data, bus: G.bus, tuning: TUNING });
  const offs = [];
  offs.push(G.bus.on('flag:set', ({ id, value, prev }) => {
    if (!value || value === prev) return;
    if (id.startsWith('sys.errand.')) {
      G.store.tx('story:errand', world => loans.errand(world, id.slice('sys.errand.'.length), ctx()));
    } else if (id.startsWith('sys.deliver.')) {
      G.store.tx('story:deliver', world => letters.deliverEvent(world, G.data, id.slice('sys.deliver.'.length), { bus: G.bus }));
    }
  }));
  offs.push(G.bus.on('thread:done', (p) => {
    if (!p || p.share !== true || typeof p.threadId !== 'string') return;
    // a caller that injected loans.residentShare (scriptHost) already paid: only the toast is left
    const res = p.result != null ? p.result : G.store.tx('story:resident-share', world => loans.residentShare(world, p.threadId, ctx()));
    if (res && res.ok) {
      const text = t(res.to === 'jar' ? 'toast.shareJar' : 'toast.shareLoan', { amount: res.credited.toLocaleString('en-US') });
      G.bus.emit('toast', { text, icon: 'star' });
    }
  }));
  const frames = () => {
    const res = G.store.tx('gallery:frames', world => loans.galleryFrames(world, ctx()));
    if (res && res.ok && res.paid > 0) G.bus.emit('toast', { text: t('toast.galleryFrame', { amount: res.paid.toLocaleString('en-US') }), icon: 'star' });
  };
  offs.push(G.bus.on('battle:end', (p) => {
    if (!p || p.porchDuel !== true || p.outcome !== 'win') return;
    // a neighbour's duel is won once an evening: the offer comes off the slate (the topic reads
    // sys.duel.<npc>) and a second win the same evening, after midnight or a reload, pays nothing
    const row = (PORCH_DUELS.neighbours ?? []).find((n) => n.trainer === p.trainerId) ?? null;
    if (row) {
      const evening = duelEvening(G.world);
      const doneId = `${PORCH_DUEL_DONE_PREFIX}${row.npc}`;
      if (flags.getFlag(G.world, doneId) === evening) return;
      G.store.tx('duel:won', (world) => {
        flags.setFlag(world, doneId, evening, { bus: G.bus });
        if (flags.getFlag(world, `${PORCH_DUEL_FLAG_PREFIX}${row.npc}`) !== null) flags.clearFlag(world, `${PORCH_DUEL_FLAG_PREFIX}${row.npc}`, { bus: G.bus });
      });
    }
    const amount = duelPayout(G.world, PORCH_DUELS, TUNING.porchDuelPerCurve);
    if (amount <= 0) return;
    G.store.tx('duel:payout', world => wallet.earn(world, amount, { data: G.data, bus: G.bus, source: 'duel' }));
    G.bus.emit('toast', { text: t('toast.duelPurse', { amount: amount.toLocaleString('en-US') }), icon: 'coin' });
  }));
  // FE-05: any sale at Ludo's eave (through his talk, the eave cell or the first-sale scene) counts
  // as the first night sale, so the NEXT chip moves on
  offs.push(G.bus.on('shop:sold', (p) => {
    if (!p || p.shopId !== 'ludo-eave' || flags.getFlag(G.world, 'seen.ludo-first-sale')) return;
    G.store.tx('story:ludo-first-sale', (world) => flags.markSeen(world, 'ludo-first-sale', { bus: G.bus }));
  }));
  offs.push(G.bus.on('fieldLog:held', (p) => { if (!p || p.first !== false) frames(); }));
  offs.push(G.bus.on('loan:built', (p) => { if (p && p.id === 'gallery') frames(); }));
  const uninstall = () => { for (const off of offs) { try { off(); } catch { /* gone */ } } INSTALLED.delete(G); };
  INSTALLED.set(G, uninstall);
  return uninstall;
}
