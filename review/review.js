/**
 * review.js — the review harness for the 64-piece kit.
 *
 * Reads the artifact straight out of ../3d-mazeball/src/ and never writes to
 * it. All feedback lives in localStorage under one key and leaves only through
 * the export button.
 *
 * The pattern is lifted from monkeyball-open-world/test.html, which the physics
 * handoff §13 recommends stealing wholesale: let a human sign off on feel while
 * automated checks cover correctness, and make it trivial to jump straight to
 * the thing you want to look at.
 */

import { PIECES, CATEGORIES, DECISIONS, buildPiece, KIT_NAME, KIT_VERSION } from '../3d-mazeball/src/pieces.js';
import { BALL_R, HALF, LEVELS, DIRS, EDGE_VEC } from '../3d-mazeball/src/kit.js';
import { runAll } from '../3d-mazeball/src/selftest.js';
import { Viewer } from './gl.js';

const STORE_KEY = `ratball-review::${KIT_VERSION}`;
const SEVERITIES = [
  ['must', 'must fix'],
  ['should', 'should improve'],
  ['question', 'question'],
];

/* ── state ────────────────────────────────────────────────────────────── */

const state = load() || {
  reviewer: '',
  verdict: null,
  overall: '',
  items: {},                       // ref → { approved, comments: [{severity, text, at}] }
  startedAt: new Date().toISOString(),
};

function load () {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

let saveTimer = null;
function save () {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* private mode */ }
  }, 180);
}

const item = ref => (state.items[ref] ||= { approved: false, comments: [] });
const commentsOf = ref => (state.items[ref]?.comments) || [];
const hasMust = ref => commentsOf(ref).some(c => c.severity === 'must');

/* ── the items under review, in source order ──────────────────────────── */

const ITEMS = [
  ...DECISIONS.map(d => ({
    ref: d.id,
    kind: 'decision',
    label: `${d.id} — ${d.title}`,
    decision: d,
  })),
  ...PIECES.map(p => ({
    ref: `#${String(p.id).padStart(2, '0')}`,
    kind: 'piece',
    label: `#${String(p.id).padStart(2, '0')} — ${p.name}`,
    piece: p,
  })),
];
const ITEM_BY_REF = new Map(ITEMS.map(i => [i.ref, i]));
const PIECE_ITEMS = ITEMS.filter(i => i.kind === 'piece');

/* ── geometry, built once ─────────────────────────────────────────────── */

const built = new Map();
for (const p of PIECES) built.set(p.id, buildPiece(p.id));
const TOTAL_TRIS = [...built.values()].reduce((a, b) => a + b.triangles, 0);
const TOTAL_COL = [...built.values()].reduce((a, b) => a + b.collisionTriangles, 0);

/* ── DOM helpers ──────────────────────────────────────────────────────── */

const $ = sel => document.querySelector(sel);
function el (tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2).toLowerCase(), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) {
    if (k == null || k === false) continue;
    n.append(k.nodeType ? k : document.createTextNode(String(k)));
  }
  return n;
}

const socketText = p => {
  const parts = ['N', 'E', 'S', 'W']
    .filter(d => p.sockets[d] !== undefined)
    .map(d => (p.sockets[d] ? `${d}_L${p.sockets[d]}` : d));
  if (p.air?.in) parts.push(`AIR_IN(${p.air.in})`);
  if (p.air?.out) parts.push(`AIR_OUT(${p.air.out})`);
  return parts.join(' · ') || '—';
};

/* ── thumbnails ───────────────────────────────────────────────────────── */

const THUMB_W = 520, THUMB_H = 390;
const offscreen = document.createElement('canvas');
offscreen.width = THUMB_W; offscreen.height = THUMB_H;
let thumbViewer = null;
let glError = null;
try { thumbViewer = new Viewer(offscreen); } catch (e) { glError = e; }

/** Render one piece into a 2-D canvas via the shared offscreen GL context. */
function paintThumb (canvas, id) {
  if (!thumbViewer) return;
  const b = built.get(id);
  const entry = thumbViewer.upload(id, b);
  const fit = Viewer.frame(b.bounds);
  thumbViewer.render(entry, {
    yaw: 0.62, pitch: 0.5, dist: fit.dist * 0.88, target: fit.target,
  }, { grid: true, collision: false });
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
}

/* ── feedback controls, shared by pieces and decisions ────────────────── */

function controls (ref, onChange) {
  const list = el('ul', { class: 'comments' });
  const sev = el('select', { 'aria-label': `Severity for ${ref}` },
    ...SEVERITIES.map(([v, t]) => el('option', { value: v }, t)));
  const text = el('textarea', {
    rows: 2, placeholder: `Comment on ${ref}…`, 'aria-label': `Comment on ${ref}`,
  });

  const approve = el('button', {
    class: 'approve', type: 'button', 'aria-pressed': String(!!item(ref).approved),
    onclick () {
      const it = item(ref);
      it.approved = !it.approved;
      save(); redraw(); onChange?.();
    },
  }, item(ref).approved ? '✓ Approved' : 'Mark approved');

  const add = el('button', {
    class: 'add', type: 'button',
    onclick () {
      const v = text.value.trim();
      if (!v) { text.focus(); return; }
      item(ref).comments.push({
        severity: sev.value, text: v, at: new Date().toISOString(),
      });
      text.value = '';
      save(); redraw(); onChange?.();
    },
  }, 'Add comment');

  text.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); add.click(); }
  });

  function redraw () {
    // Also re-sync the toggle: the same ref has controls on its card and in the
    // inspector, and approving in one must show in the other.
    approve.setAttribute('aria-pressed', String(!!item(ref).approved));
    approve.textContent = item(ref).approved ? '✓ Approved' : 'Mark approved';
    list.replaceChildren(...commentsOf(ref).map((c, i) => el('li', { 'data-sev': c.severity },
      el('button', {
        class: 'del', type: 'button', title: 'Delete comment', 'aria-label': 'Delete comment',
        onclick () { item(ref).comments.splice(i, 1); save(); redraw(); onChange?.(); },
      }, '×'),
      el('span', { class: 'sev' }, SEVERITIES.find(s => s[0] === c.severity)[1]),
      c.text,
      el('span', { class: 'when' }, new Date(c.at).toLocaleString()),
    )));
  }
  redraw();

  return {
    node: el('div', { class: 'controls' },
      el('div', { class: 'control-row' }, approve, sev, add),
      el('div', { class: 'comment-input' }, text),
      list,
    ),
    refresh: redraw,
  };
}

/* ── piece cards ──────────────────────────────────────────────────────── */

const cardRefs = new Map();

function pieceCard (entry) {
  const p = entry.piece;
  const b = built.get(p.id);
  const canvas = el('canvas', { width: THUMB_W, height: THUMB_H });

  const chips = [
    el('span', { class: 'chip' }, socketText(p)),
    el('span', { class: 'chip' }, `grip ${p.surface.friction.toFixed(2)}`),
    el('span', {
      class: p.clamped ? 'chip warn' : 'chip',
      title: p.clamped ? `documented e = ${p.docSurface.bounce} — clamped, see D04` : '',
    }, `e ${p.surface.bounce.toFixed(2)}${p.clamped ? ` (doc ${p.docSurface.bounce})` : ''}`),
    p.behaviours.length ? el('span', { class: 'chip' },
      p.behaviours.map(x => x.effect).join(', ')) : null,
    p.bodies.length ? el('span', { class: 'chip' },
      `moving: ${p.bodies.map(x => x.effect).join(', ')}`) : null,
    p.pairWith ? el('span', { class: 'chip link' }, `pairs with #${String(p.pairWith).padStart(2, '0')}`) : null,
    ...p.decisions.map(d => el('span', { class: 'chip link' }, d)),
  ].filter(Boolean);

  const notes = p.notes.length
    ? el('details', { class: 'notes' },
      el('summary', {}, `${p.notes.length} build note${p.notes.length > 1 ? 's' : ''}`),
      el('ul', {}, ...p.notes.map(n => el('li', {}, n))))
    : null;

  const card = el('article', { class: 'card', id: `card-${entry.ref.replace('#', 'p')}` },
    el('button', {
      class: 'thumb', type: 'button', title: `Inspect ${entry.label}`,
      onclick: () => openInspector(p.id),
    },
      canvas,
      el('span', { class: 'ref' }, entry.ref),
      el('span', { class: 'tris' }, `${b.triangles} tris · ${b.collisionTriangles} col`),
    ),
    el('div', { class: 'card-body' },
      el('h3', { class: 'card-title' }, p.name),
      el('p', { class: 'card-desc' }, p.desc),
      el('div', { class: 'spec' }, ...chips),
      notes,
    ),
  );

  const c = controls(entry.ref, () => { paintCardState(entry.ref); updateCounters(); });
  card.append(c.node);
  cardRefs.set(entry.ref, { card, refresh: c.refresh, canvas, id: p.id });
  return card;
}

function paintCardState (ref) {
  const r = cardRefs.get(ref);
  if (!r) return;
  r.card.classList.toggle('is-approved', !!state.items[ref]?.approved);
  r.card.classList.toggle('has-must', hasMust(ref));
  const d = decisionRefs.get(ref);
  if (d) {
    d.node.classList.toggle('is-approved', !!state.items[ref]?.approved);
    d.node.classList.toggle('has-must', hasMust(ref));
  }
}

/* ── decisions ────────────────────────────────────────────────────────── */

const decisionRefs = new Map();

function decisionCard (entry) {
  const d = entry.decision;
  const node = el('article', { class: 'decision', id: `card-${d.id}` },
    el('h3', {}, el('span', { class: 'id' }, d.id), d.title),
    el('p', {}, d.body),
    el('p', { class: 'impact' }, el('b', {}, 'If this is wrong: '), d.impact),
  );
  const c = controls(d.id, () => { paintCardState(d.id); updateCounters(); });
  node.append(c.node);
  decisionRefs.set(d.id, { node, refresh: c.refresh });
  return node;
}

/* ── inspector ────────────────────────────────────────────────────────── */

const stage = $('#stage');
let stageViewer = null;
const cam = { yaw: 0.55, pitch: 0.48, dist: 16, target: [0, 0.4, 0] };
const view = { collision: false, ball: false, grid: true, spin: false };
let currentId = null;
let raf = null;

function ensureStageViewer () {
  if (stageViewer || glError) return stageViewer;
  try { stageViewer = new Viewer(stage); } catch (e) { glError = e; }
  return stageViewer;
}

function sizeStage () {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = stage.getBoundingClientRect();
  const w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
  if (stage.width !== w || stage.height !== h) { stage.width = w; stage.height = h; }
}

/** Park the scale reference just inside the piece's own entry socket. */
function ballPosition (piece) {
  const dir = ['S', 'W', 'N', 'E'].find(d => piece.sockets[d] !== undefined) || 'S';
  const [ex, ez] = EDGE_VEC[dir];
  const lvl = piece.sockets[dir] ?? 0;
  return [ex * (HALF - 1.3), LEVELS[lvl] + BALL_R + 0.02, ez * (HALF - 1.3)];
}

function drawStage () {
  const v = ensureStageViewer();
  if (!v || currentId == null) return;
  sizeStage();
  const b = built.get(currentId);
  const entry = v.upload(currentId, b);
  v.render(entry, cam, {
    grid: view.grid,
    collision: view.collision,
    ballAt: view.ball ? ballPosition(b.piece) : null,
    ballR: BALL_R,
  });
}

function loop () {
  if (view.spin) { cam.yaw += 0.0055; drawStage(); raf = requestAnimationFrame(loop); }
  else raf = null;
}

function openInspector (id) {
  currentId = id;
  const p = PIECES.find(x => x.id === id);
  const b = built.get(id);
  const fit = Viewer.frame(b.bounds);
  cam.target = fit.target;
  cam.dist = fit.dist;
  cam.yaw = 0.55; cam.pitch = 0.48;

  $('#inspector').hidden = false;
  $('#stage-title').textContent = `#${String(p.id).padStart(2, '0')}  ${p.sprite}`;
  renderInspectorSide(p, b);
  requestAnimationFrame(() => { sizeStage(); drawStage(); });
  $('#close').focus();
}

function closeInspector () {
  $('#inspector').hidden = true;
  view.spin = false;
  syncTools();
  if (raf) { cancelAnimationFrame(raf); raf = null; }
  const r = currentId != null && cardRefs.get(`#${String(currentId).padStart(2, '0')}`);
  if (r) r.card.querySelector('.thumb').focus();
}

function stepInspector (delta) {
  const idx = PIECES.findIndex(p => p.id === currentId);
  const next = PIECES[(idx + delta + PIECES.length) % PIECES.length];
  openInspector(next.id);
}

function renderInspectorSide (p, b) {
  const ref = `#${String(p.id).padStart(2, '0')}`;
  const row = (k, v) => el('tr', {}, el('th', {}, k), el('td', {}, v));
  const mats = [...new Set(b.colliders.map(c => c.material))];

  const side = $('#inspector-side');
  side.replaceChildren(
    el('h3', {}, p.name),
    el('p', { class: 'ref-line' }, `${ref}  ·  ${p.sprite}  ·  ${CATEGORIES[p.cat - 1].name}`),
    el('p', {}, p.desc),
    el('table', { class: 'spec-table' },
      row('Sockets', socketText(p)),
      row('Surface grip (μ column)', `${p.surface.friction.toFixed(2)}`),
      row('Restitution', p.clamped
        ? `${p.surface.bounce.toFixed(2)}  ← documented ${p.docSurface.bounce.toFixed(2)}, see D04`
        : p.surface.bounce.toFixed(2)),
      row('Colliding materials', mats.join(', ')),
      row('Triangles', `${b.triangles} render · ${b.collisionTriangles} collision`),
      row('Bounds (m)',
        `x ${b.bounds.lo[0].toFixed(2)}…${b.bounds.hi[0].toFixed(2)}\n`
        + `y ${b.bounds.lo[1].toFixed(2)}…${b.bounds.hi[1].toFixed(2)}\n`
        + `z ${b.bounds.lo[2].toFixed(2)}…${b.bounds.hi[2].toFixed(2)}`),
      p.behaviours.length ? row('Behaviours',
        p.behaviours.map(x => `${x.kind}:${x.effect}`).join('\n')) : null,
      p.bodies.length ? row('Moving parts',
        p.bodies.map(x => `${x.shape}:${x.effect}`).join('\n')) : null,
      p.pairWith ? row('Pairs with', `#${String(p.pairWith).padStart(2, '0')}`) : null,
      p.decisions.length ? row('Decisions', p.decisions.join(', ')) : null,
    ),
    p.notes.length ? el('details', { class: 'notes', open: true },
      el('summary', {}, 'Build notes'),
      el('ul', {}, ...p.notes.map(n => el('li', {}, n)))) : null,
  );

  const c = controls(ref, () => {
    paintCardState(ref);
    cardRefs.get(ref)?.refresh();
    updateCounters();
  });
  side.append(c.node);
}

function syncTools () {
  for (const btn of document.querySelectorAll('.tool[data-toggle]')) {
    btn.setAttribute('aria-pressed', String(view[btn.dataset.toggle]));
  }
}

/* ── orbit ────────────────────────────────────────────────────────────── */

let drag = null;
stage.addEventListener('pointerdown', e => {
  drag = { x: e.clientX, y: e.clientY };
  stage.setPointerCapture(e.pointerId);
});
stage.addEventListener('pointermove', e => {
  if (!drag) return;
  cam.yaw -= (e.clientX - drag.x) * 0.008;
  cam.pitch = Math.max(-0.25, Math.min(1.45, cam.pitch + (e.clientY - drag.y) * 0.006));
  drag = { x: e.clientX, y: e.clientY };
  drawStage();
});
stage.addEventListener('pointerup', e => { drag = null; stage.releasePointerCapture(e.pointerId); });
stage.addEventListener('wheel', e => {
  e.preventDefault();
  cam.dist = Math.max(3, Math.min(70, cam.dist * (1 + Math.sign(e.deltaY) * 0.09)));
  drawStage();
}, { passive: false });

window.addEventListener('resize', () => { if (!$('#inspector').hidden) drawStage(); });

document.addEventListener('keydown', e => {
  if ($('#inspector').hidden) return;
  if (e.key === 'Escape') closeInspector();
  else if (e.key === 'ArrowLeft' && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) stepInspector(-1);
  else if (e.key === 'ArrowRight' && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) stepInspector(1);
});

$('#close').addEventListener('click', closeInspector);
$('#prev').addEventListener('click', () => stepInspector(-1));
$('#next').addEventListener('click', () => stepInspector(1));
$('#inspector').addEventListener('mousedown', e => { if (e.target === $('#inspector')) closeInspector(); });

for (const btn of document.querySelectorAll('.tool[data-toggle]')) {
  btn.addEventListener('click', () => {
    const k = btn.dataset.toggle;
    view[k] = !view[k];
    syncTools();
    if (k === 'spin' && view.spin && !raf) raf = requestAnimationFrame(loop);
    drawStage();
  });
}

/* ── counters ─────────────────────────────────────────────────────────── */

function updateCounters () {
  const refs = ITEMS.map(i => i.ref);
  const approved = refs.filter(r => state.items[r]?.approved).length;
  const commented = refs.filter(r => commentsOf(r).length).length;
  const musts = refs.reduce((a, r) => a + commentsOf(r).filter(c => c.severity === 'must').length, 0);
  const total = refs.reduce((a, r) => a + commentsOf(r).length, 0);
  $('#counters').replaceChildren(
    el('span', {}, el('b', {}, `${approved}/${refs.length}`), ' approved'),
    el('span', {}, el('b', {}, String(commented)), ' items with comments'),
    el('span', {}, el('b', {}, String(total)), ' comments'),
    el('span', {}, el('b', {}, String(musts)), ' must-fix'),
  );
}

/* ── export ───────────────────────────────────────────────────────────── */

function snapshot () {
  const now = new Date();
  const entries = ITEMS
    .map(i => ({
      ref: i.ref,
      kind: i.kind,
      label: i.label,
      source: i.kind === 'piece' ? `3d-mazeball/src/pieces.js · ${i.piece.sprite}` : '3d-mazeball/src/pieces.js · DECISIONS',
      approved: !!state.items[i.ref]?.approved,
      comments: commentsOf(i.ref).map(c => ({ ...c })),
    }))
    .filter(e => e.approved || e.comments.length);

  return {
    schema: 'ratball-review/1',
    artifact: {
      name: KIT_NAME,
      version: KIT_VERSION,
      path: '3d-mazeball/src/',
      pieces: PIECES.length,
      decisions: DECISIONS.length,
      renderTriangles: TOTAL_TRIS,
      collisionTriangles: TOTAL_COL,
    },
    review: {
      reviewer: state.reviewer || null,
      verdict: state.verdict,
      exportedAt: now.toISOString(),
      exportedAtLocal: now.toLocaleString(),
      startedAt: state.startedAt,
    },
    overallComments: state.overall || '',
    summary: {
      itemsTotal: ITEMS.length,
      itemsApproved: ITEMS.filter(i => state.items[i.ref]?.approved).length,
      itemsWithComments: ITEMS.filter(i => commentsOf(i.ref).length).length,
      commentsTotal: ITEMS.reduce((a, i) => a + commentsOf(i.ref).length, 0),
      mustFix: ITEMS.reduce((a, i) => a + commentsOf(i.ref).filter(c => c.severity === 'must').length, 0),
      shouldImprove: ITEMS.reduce((a, i) => a + commentsOf(i.ref).filter(c => c.severity === 'should').length, 0),
      questions: ITEMS.reduce((a, i) => a + commentsOf(i.ref).filter(c => c.severity === 'question').length, 0),
    },
    items: entries,
    untouched: ITEMS.filter(i => !state.items[i.ref]?.approved && !commentsOf(i.ref).length).map(i => i.ref),
  };
}

const VERDICT_TEXT = { approve: 'APPROVE', revise: 'REVISE', discuss: 'NEEDS DISCUSSION' };
const SEV_TEXT = Object.fromEntries(SEVERITIES);

function toMarkdown (s) {
  const L = [];
  L.push(`# Review — ${s.artifact.name}`);
  L.push('');
  L.push(`| | |`);
  L.push(`| --- | --- |`);
  L.push(`| **Artifact** | ${s.artifact.name} |`);
  L.push(`| **Version** | ${s.artifact.version} |`);
  L.push(`| **Source** | \`${s.artifact.path}\` (${s.artifact.pieces} pieces, ${s.artifact.decisions} decisions) |`);
  L.push(`| **Reviewer** | ${s.review.reviewer || '_unnamed_'} |`);
  L.push(`| **Exported** | ${s.review.exportedAtLocal} (${s.review.exportedAt}) |`);
  L.push(`| **Overall verdict** | **${s.review.verdict ? VERDICT_TEXT[s.review.verdict] : 'NOT SET'}** |`);
  L.push('');
  L.push(`${s.summary.itemsApproved}/${s.summary.itemsTotal} items approved · `
    + `${s.summary.commentsTotal} comments across ${s.summary.itemsWithComments} items · `
    + `${s.summary.mustFix} must fix, ${s.summary.shouldImprove} should improve, ${s.summary.questions} questions.`);
  L.push('');

  L.push('## Overall comments');
  L.push('');
  L.push(s.overallComments.trim() || '_none_');
  L.push('');

  const withComments = s.items.filter(i => i.comments.length);
  const bySeverity = sev => withComments.flatMap(i =>
    i.comments.filter(c => c.severity === sev).map(c => ({ i, c })));

  for (const [sev, title] of [['must', 'Must fix'], ['should', 'Should improve'], ['question', 'Questions']]) {
    const rows = bySeverity(sev);
    if (!rows.length) continue;
    L.push(`## ${title} (${rows.length})`);
    L.push('');
    for (const { i, c } of rows) {
      L.push(`- **${i.ref}** — ${i.label.replace(/^[^—]*— /, '')}`);
      L.push(`  - ${c.text.replace(/\n/g, '\n    ')}`);
      L.push(`  - _${i.source} · logged ${new Date(c.at).toLocaleString()}_`);
    }
    L.push('');
  }

  L.push('## Every comment, by item');
  L.push('');
  if (!withComments.length) L.push('_no per-item comments_');
  for (const i of withComments) {
    L.push(`### ${i.ref} — ${i.label.replace(/^[^—]*— /, '')}`);
    L.push('');
    L.push(`Source: \`${i.source}\`${i.approved ? ' · marked **approved**' : ''}`);
    L.push('');
    for (const c of i.comments) {
      L.push(`- **[${SEV_TEXT[c.severity]}]** ${c.text}`);
      L.push(`  <sub>${c.at}</sub>`);
    }
    L.push('');
  }

  const approved = s.items.filter(i => i.approved).map(i => i.ref);
  L.push(`## Approved (${approved.length})`);
  L.push('');
  L.push(approved.length ? approved.join(', ') : '_none_');
  L.push('');
  L.push(`## Not yet reviewed (${s.untouched.length})`);
  L.push('');
  L.push(s.untouched.length ? s.untouched.join(', ') : '_none — every item was touched_');
  L.push('');
  L.push('---');
  L.push('');
  L.push(`Geometry at export: ${s.artifact.renderTriangles} render triangles, `
    + `${s.artifact.collisionTriangles} collision triangles.`);
  L.push('');
  return L.join('\n');
}

function download (name, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function exportFeedback () {
  const s = snapshot();
  const md = toMarkdown(s);
  const stamp = s.review.exportedAt.replace(/[:.]/g, '-').slice(0, 19);
  const base = `ratball-review_${s.artifact.version}_${stamp}`;

  download(`${base}.md`, md, 'text/markdown;charset=utf-8');
  // Browsers throttle back-to-back downloads; give the first one a moment.
  setTimeout(() => download(`${base}.json`, JSON.stringify(s, null, 2), 'application/json;charset=utf-8'), 260);

  let copied = false;
  try {
    await navigator.clipboard.writeText(md);
    copied = true;
  } catch { /* clipboard permission denied, or no secure context — files still downloaded */ }

  const btn = $('#export');
  const was = btn.textContent;
  btn.textContent = copied ? 'Exported · Markdown copied' : 'Exported (2 files)';
  setTimeout(() => { btn.textContent = was; }, 2600);
}

/* ── build the page ───────────────────────────────────────────────────── */

function render () {
  $('#artifact-name').textContent = KIT_NAME;
  $('#artifact-version').textContent = `v${KIT_VERSION}`;
  $('#artifact-stats').textContent =
    `${PIECES.length} pieces · ${TOTAL_TRIS.toLocaleString()} render tris · ${TOTAL_COL.toLocaleString()} collision tris`;
  $('#decision-count').textContent = `(${DECISIONS.length})`;

  $('#reviewer').value = state.reviewer || '';
  $('#reviewer').addEventListener('input', e => { state.reviewer = e.target.value; save(); });

  $('#overall').value = state.overall || '';
  $('#overall').addEventListener('input', e => { state.overall = e.target.value; save(); });

  for (const btn of document.querySelectorAll('.v')) {
    btn.setAttribute('aria-checked', String(state.verdict === btn.dataset.verdict));
    btn.addEventListener('click', () => {
      state.verdict = state.verdict === btn.dataset.verdict ? null : btn.dataset.verdict;
      for (const b of document.querySelectorAll('.v')) {
        b.setAttribute('aria-checked', String(state.verdict === b.dataset.verdict));
      }
      save();
    });
  }

  $('#export').addEventListener('click', exportFeedback);

  $('#decisions').replaceChildren(...ITEMS.filter(i => i.kind === 'decision').map(decisionCard));

  const cat = $('#catalogue');
  cat.replaceChildren(...CATEGORIES.map(c => {
    const items = PIECE_ITEMS.filter(i => i.piece.cat === c.id);
    return el('section', { class: 'cat' },
      el('div', { class: 'cat-head' },
        el('span', { class: 'swatch', style: `background:${c.accent}` }),
        el('h2', {}, `${c.id}. ${c.name}`),
        el('span', { class: 'focus' }, c.focus),
        el('span', { class: 'range' },
          `#${String(c.range[0]).padStart(2, '0')}–#${String(c.range[1]).padStart(2, '0')}`),
      ),
      el('div', { class: 'grid' }, ...items.map(pieceCard)),
    );
  }));

  for (const i of ITEMS) paintCardState(i.ref);
  updateCounters();

  if (glError) {
    document.querySelectorAll('.thumb').forEach(t => {
      t.append(el('span', {
        class: 'ref',
        style: 'left:auto;right:8px;top:8px;background:rgba(180,60,50,.75)',
      }, 'no WebGL'));
    });
  } else {
    // Paint thumbnails lazily: 64 GL renders at once stalls first paint.
    const io = new IntersectionObserver(es => {
      for (const e of es) {
        if (!e.isIntersecting) continue;
        const c = e.target;
        if (!c.dataset.painted) { paintThumb(c, Number(c.dataset.id)); c.dataset.painted = '1'; }
        io.unobserve(c);
      }
    }, { rootMargin: '360px' });
    for (const [ref, r] of cardRefs) {
      r.canvas.dataset.id = String(r.id);
      io.observe(r.canvas);
    }
  }

  // The suite builds the kit several times over and takes ~0.7 s; run it after
  // the catalogue has painted rather than blocking first render on it.
  $('#test-count').textContent = '(running…)';
  setTimeout(renderTests, 60);
  syncTools();
}

function renderTests () {
  const host = $('#tests');
  let r;
  try { r = runAll(); } catch (e) {
    host.replaceChildren(el('p', { class: 'lede' }, `Self-tests could not run: ${e.message}`));
    return;
  }
  const groups = new Map();
  for (const t of r.tests) {
    if (!groups.has(t.group)) groups.set(t.group, []);
    groups.get(t.group).push(t);
  }
  const line = t => el('div', { class: `test ${t.pass ? 'pass' : 'fail'}` },
    el('span', { class: 'mark' }, t.pass ? '✓' : '✗'),
    el('span', {}, t.name),
    t.detail ? el('span', { class: 'detail' }, t.detail) : null);

  host.replaceChildren(
    ...[...groups].map(([g, ts]) => el('div', { class: 'test-group' },
      el('h3', {}, `${g} — ${ts.filter(t => t.pass).length}/${ts.length}`),
      ...ts.map(line))),
    el('div', { class: 'test-group' },
      el('h3', {}, `provocations — ${r.provocations.filter(t => t.pass).length}/${r.provocations.length} (each must go red)`),
      ...r.provocations.map(line)),
  );
  $('#test-count').textContent =
    `(${r.summary.pass}/${r.summary.total} passing, ${r.summary.provPass}/${r.summary.provTotal} provocations)`;
}

render();

// Handy in the console when discussing a specific piece, and used by the
// contact-sheet helper below.
Object.assign(window, { state, snapshot, toMarkdown, PIECES, built, openInspector, paintThumb, cardRefs });

/**
 * Paint every thumbnail and composite an 8×8 contact sheet. Useful for eyeing
 * the whole set at once, and for capturing the render output when the page
 * itself cannot be screenshotted. Returns a data URL.
 */
window.contactSheet = (cw = 232, ch = 174, quality = 0.62) => {
  const sheet = document.createElement('canvas');
  sheet.width = cw * 8; sheet.height = ch * 8;
  const g = sheet.getContext('2d');
  g.fillStyle = '#0e1013';
  g.fillRect(0, 0, sheet.width, sheet.height);
  PIECES.forEach((p, i) => {
    const r = cardRefs.get(`#${String(p.id).padStart(2, '0')}`);
    if (!r) return;
    if (!r.canvas.dataset.painted) { paintThumb(r.canvas, p.id); r.canvas.dataset.painted = '1'; }
    const x = (i % 8) * cw, y = Math.floor(i / 8) * ch;
    g.drawImage(r.canvas, x, y, cw, ch);
    g.fillStyle = 'rgba(0,0,0,.55)';
    g.fillRect(x + 4, y + 4, 34, 15);
    g.fillStyle = '#e8eaec';
    g.font = '600 11px ui-monospace, monospace';
    g.fillText(`#${String(p.id).padStart(2, '0')}`, x + 8, y + 15);
  });
  return sheet.toDataURL('image/jpeg', quality);
};
