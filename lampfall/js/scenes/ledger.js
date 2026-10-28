/** The co-op ledger: loans, room commissions, and the Commons Jar. */
import { drawText, wrapText } from '../core/font.js';
import { drawPanel } from '../ui/panel.js';
import { COLORS, PALETTE } from '../ui/theme.js';
import { openConfirm } from '../ui/confirm.js';
import { createCeremonyScene } from './fieldOverlays.js';
import { sysCtx, toast, sfx, prefsOf, skinOf, drawBackdrop, drawHeading, drawHints } from './menuKit.js';
import * as loans from '../systems/loans.js';
import { TUNING } from '../data/tuning.js';

const PAGES = ['Loan ledger', 'Room commissions', 'Commons Jar'];
const money = n => Math.max(0, Math.floor(n || 0)).toLocaleString('en-US');
export function ledgerRows(world, data, page = 0) {
  const ctx = { data };
  if (page === 0) {
    const owed = loans.balance(world, ctx), available = Math.min(owed, world.wallet.main);
    return [...new Set([Math.min(500, available), Math.min(2500, available), available])].filter(n => n > 0).map(n => ({ id: `pay:${n}`, label: `Pay ${money(n)} buttons`, amount: n }));
  }
  if (page === 1) return loans.commissionOptions(world, ctx).map(id => {
    const row = data.tryGet('commissions', id);
    return { id, label: row?.name ?? id, detail: [row?.town, row?.creature].filter(Boolean).join(' ') };
  });
  const rows = [];
  if (world.wallet.main > 0) rows.push({ id: 'deposit', label: `Add ${money(Math.min(1000, world.wallet.main))} buttons to the Jar`, amount: Math.min(1000, world.wallet.main) });
  for (const row of loans.commonsStatus(world, ctx)) rows.push({ id: row.id, label: `${row.built ? 'Done: ' : ''}${data.tryGet('commons', row.id)?.name ?? row.id}`, detail: row.built ? 'The neighbors made this together.' : `Your share: ${money(row.share)}. ${row.unlocked ? '' : 'A little further into the season.'}`, disabled: row.built || !row.unlocked });
  return rows;
}

/**
 * The Ledger's resident-share line (GDD-00 §7): how many neighbours' life threads have paid their
 * notch (or, after payoff, their 4,000 to the Jar). Pure.
 * @param {any} world
 * @param {any} data
 * @returns {string}
 */
export function residentShareLine(world, data) {
  const lead = (data?.list?.('threads') ?? []).filter((t) => (t.kind ?? 'lead') === 'lead').length || 6;
  const paid = (world?.loans?.residentShares ?? []).length;
  return `Neighbours' shares: ${paid} of ${lead} threads tied off`; // str
}

/**
 * The First Night Errands credit line (FH-11): what the clipboard has taken off loan 1 and how many
 * errands are left, or null once they are done or loan 1 is behind you. Pure.
 * @param {any} world
 * @param {any} [data]
 * @returns {string|null}
 */
export function errandLine(world, data) {
  const tu = { ...TUNING, ...(data?.tuning && typeof data.tuning === 'object' ? data.tuning : {}) };
  const each = Number.isInteger(tu.errandCredit) ? tu.errandCredit : 500;
  const count = Number.isInteger(tu.errandCount) ? tu.errandCount : 6;
  const tier = Number.isInteger(tu.errandTier) ? tu.errandTier : 1;
  const L = world?.loans;
  if (!L || L.tier !== tier || !world?.flags?.['sp.errands-started']) return null;
  const done = Math.min(count, Array.isArray(L.errands) ? L.errands.length : 0);
  if (done >= count) return null;
  return `Errand credit: ${money(done * each)} of ${money(count * each)}. Errands left: ${count - done}.`; // str
}

export function createLedgerScene(G) {
  let page = 0, index = 0, top = 0, busy = false, ms = 0;
  let rows = [];
  const ctx = () => sysCtx(G);
  const status = () => loans.status(G.world, ctx());
  const refresh = () => { rows = ledgerRows(G.world, G.data, page); index = Math.max(0, Math.min(index, rows.length - 1)); top = Math.max(0, Math.min(top, rows.length - 8)); };
  const changePage = dir => { page = (page + dir + PAGES.length) % PAGES.length; index = 0; top = 0; refresh(); sfx(G, 'cursor'); };
  function note(result, success) {
    if (result.ok) { toast(G, success); G.persist?.autosave?.(G, 'ledger'); }
    else toast(G, result.reason === 'short' || result.reason === 'insufficient' ? `Another ${money(result.short)} buttons will do it.` : `Wren: ${String(result.reason).replaceAll('-', ' ')}. Take your time.`);
    refresh();
  }
  async function activate() {
    const row = rows[index]; if (!row || row.disabled || busy) return;
    sfx(G, 'confirm');
    if (page === 0) {
      const res = G.store.tx('ledger:pay', world => loans.pay(world, row.amount, ctx()));
      if (!res.ok) { note(res, ''); return; }
      refresh(); G.persist?.autosave?.(G, 'loan-payment');
      G.scenes.push(createCeremonyScene(G, {
        ...res,
        roofChoices: res.cleared ? loans.roofChoices(res.cleared.tier, ctx()) : [],
        onRoof: colour => G.store.tx('loan:roof', world => loans.chooseRoof(world, res.cleared.tier, colour, ctx())),
      }));
      return;
    }
    if (page === 1) {
      const pending = loans.pendingPickTier(G.world, ctx());
      if (pending === null && !G.world.flags['sp.relighting']) { toast(G, 'Room choices begin with loan three. Wren will keep the plans.'); return; }
      busy = true;
      const choice = await openConfirm(G, { body: `Choose the ${row.label}? ${row.detail || 'A new room for your cottage.'}${pending === null ? ' The remaining rooms cost 20,000 buttons each.' : ''}`, options: ['Keep looking', 'Choose this room'], defaultIndex: 0 });
      busy = false;
      if (choice !== 1) return;
      const result = G.store.tx('ledger:room', world => pending !== null ? loans.chooseCommission(world, row.id, ctx()) : loans.buyLeftoverCommission(world, row.id, ctx()));
      note(result, `${row.label}: Wren has your choice on the plan.`);
      return;
    }
    if (row.id === 'deposit') note(G.store.tx('ledger:jar', world => loans.depositJar(world, row.amount, ctx())), 'Into the Commons Jar. The neighbors will put in their share.');
    else note(G.store.tx('ledger:project', world => loans.fundProject(world, row.id, ctx())), `${row.label}: made together.`);
  }
  return {
    name: 'ledger', opaque: true,
    enter(params = {}) { page = params.page === 'commissions' ? 1 : params.page === 'commons' ? 2 : 0; index = 0; top = 0; ms = 0; refresh(); },
    resume() { refresh(); G.input?.flush?.(); },
    update(dt) { ms += dt; },
    handleInput(input) {
      if (busy) return;
      if (input.pressed('cancel') || input.pressed('menu')) { G.scenes.pop(); return; }
      if (input.pressed('left') || input.pressed('l')) { changePage(-1); return; }
      if (input.pressed('right') || input.pressed('r')) { changePage(1); return; }
      if (input.repeat('up') && rows.length) index = (index + rows.length - 1) % rows.length;
      if (input.repeat('down') && rows.length) index = (index + 1) % rows.length;
      if (index < top) top = index;
      if (index >= top + 8) top = index - 7;
      const p = input.pointer;
      if (p?.justDown) {
        if (p.y >= 22 && p.y < 41) { page = Math.max(0, Math.min(2, Math.floor((p.x - 12) / 152))); index = 0; top = 0; refresh(); return; }
        if (p.x >= 250 && p.x < 464 && p.y >= 63 && p.y < 191) { const i = top + Math.floor((p.y - 63) / 16); if (i < rows.length) { if (index === i || p.type !== 'touch') { index = i; void activate(); } else index = i; } return; }
      }
      if (input.pressed('confirm')) void activate();
    },
    draw(canvas) {
      const prefs = prefsOf(G); drawBackdrop(canvas, prefs); drawHeading(canvas, 'Hearthwright & Daughter');
      PAGES.forEach((title, i) => { canvas.fillStyle = i === page ? PALETTE.waxRed : PALETTE.deepBlue; canvas.fillRect(12 + i * 152, 23, 148, 17); drawText(canvas, title, 86 + i * 152, 28, { align: 'center', color: PALETTE.paperLightest, font: 'small' }); });
      drawPanel(canvas, { x: 12, y: 46, w: 226, h: 202 }, 'ledger');
      drawPanel(canvas, { x: 246, y: 46, w: 222, h: 202 }, 'card');
      const st = status();
      drawText(canvas, `Loan ${Math.min(7, st.tier)} of 7`, 23, 57, { color: COLORS.paper.ink });
      drawText(canvas, 'No interest. No deadline.', 23, 71, { color: COLORS.paper.inkSoft, font: 'small' });
      drawText(canvas, `Owed: ${money(st.balance)}`, 23, 87, { color: PALETTE.waxRed });
      drawText(canvas, `In your apron: ${money(G.world.wallet.main)}`, 23, 103, { color: COLORS.paper.ink, font: 'small' });
      st.houses.forEach((house, i) => {
        const title = G.data.tryGet('loans', `tier-${house.tier}`)?.name ?? `Loan ${house.tier}`;
        drawText(canvas, `${house.built ? '*' : house.state === 'paid' ? '+' : '-'} ${house.tier}. ${title}`, 23, 125 + i * 13, { color: house.built ? COLORS.paper.ink : COLORS.paper.inkSoft, font: 'small', maxWidth: 202 });
      });
      drawText(canvas, `Scaffold: ${st.scaffold} / ${st.scaffoldMax}`, 23, 224, { color: COLORS.paper.inkSoft, font: 'small' });
      drawText(canvas, residentShareLine(G.world, G.data), 23, 235, { color: COLORS.paper.inkSoft, font: 'small', maxWidth: 206 });
      if (page === 2) drawText(canvas, `Jar: ${money(st.jar)}`, 258, 51, { color: COLORS.paper.inkSoft, font: 'small' });
      if (page === 1) drawText(canvas, st.needsCommission ? `Choose for loan ${st.pendingPickTier}` : st.paidOff ? 'Two rooms can still be yours.' : 'Plans for your next room', 258, 51, { color: COLORS.paper.inkSoft, font: 'small' });
      if (!rows.length) drawText(canvas, st.paidOff ? 'Paid in full. The light is yours.' : 'Your buttons can wait. Errands, and finds sold at Pell\'s or to Ludo, fill the apron.', 258, 82, { color: COLORS.paper.inkSoft, maxWidth: 194 }); // str
      const errands = page === 0 ? errandLine(G.world, G.data) : null;
      if (errands) drawText(canvas, errands, 258, 166, { color: COLORS.paper.ink, font: 'small', maxWidth: 196 });
      rows.slice(top, top + 8).forEach((row, i) => {
        const y = 63 + i * 16;
        if (top + i === index) { canvas.fillStyle = COLORS.focus.bandOnPaper; canvas.fillRect(253, y - 2, 208, 15); }
        drawText(canvas, `${top + i === index ? '>' : ' '} ${row.label}`, 258, y + 2, { color: row.disabled ? COLORS.paper.inkFaint : COLORS.paper.ink, font: 'small', maxWidth: 196 });
      });
      const selected = rows[index];
      const detail = selected?.detail || (page === 0 ? 'Payments notch the stick. A cleared loan raises the scaffold at dawn.' : 'Pick four rooms as loans three through six open. Each one changes your home.');
      wrapText(detail, 192, { font: 'small' }).slice(0, 4).forEach((line, i) => drawText(canvas, line, 258, 204 + i * 9, { color: COLORS.paper.inkSoft, font: 'small' }));
      drawHints(canvas, G.input, [['left', 'Page'], ['right', 'Page'], ['confirm', 'Choose'], ['cancel', 'Back']]);
    },
    debugText() { const st = status(); return `${PAGES[page]}\nLoan ${st.tier} owed ${st.balance}; wallet ${G.world.wallet.main}; scaffold ${st.scaffold}/7\n${rows.map((r, i) => `${i === index ? '>' : ' '} ${r.label}${r.disabled ? ' (done or locked)' : ''}`).join('\n')}`; },
  };
}
