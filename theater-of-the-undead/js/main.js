// ============ Theater of the Undead — boot, render pipeline, state machine, loop ============
import * as THREE from 'three';
import { G, clamp, damp, pick } from './core.js';
import { MAP, resetMap } from './mapdata.js';
import { CHARACTERS } from './config.js';
import { DEX, pokemonChar, searchDex, spriteURL, fallbackSVG, statBars, TYPE_COLOR } from './pokedex.js';
import { input } from './input.js';
import { audio } from './audio.js';
import { FX } from './fx.js';
import { HUD } from './hud.js';
import { CamRig } from './camera.js';
import { World } from './world.js';
import { Nav } from './nav.js';
import { Weapons } from './weapons.js';
import { ZombieManager } from './zombie.js';
import { PowerUps } from './powerups.js';
import { MysteryBox } from './box.js';
import { Interact } from './interact.js';
import { Rounds } from './rounds.js';
import { Player } from './player.js';

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
// NO tonemapping, NO shadows — flat OSRS look
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
const FOGCOL = 0x10101a;
scene.background = new THREE.Color(FOGCOL);
// pulled the fog wall in a touch + darker tint for a creepier, more enclosed theater
scene.fog = new THREE.Fog(FOGCOL, 16, 58);

const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 220);

// ---- low-res render target + nearest-neighbour upscale (the pixelation) ----
let PIXEL = 3.5;
function rtSize() { return [Math.max(1, Math.floor(innerWidth / PIXEL)), Math.max(1, Math.floor(innerHeight / PIXEL))]; }
let [rw, rh] = rtSize();
const lowRT = new THREE.WebGLRenderTarget(rw, rh, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
lowRT.texture.colorSpace = THREE.SRGBColorSpace;
const blitScene = new THREE.Scene();
const blitCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const blitMat = new THREE.MeshBasicMaterial({ map: lowRT.texture });
blitMat.toneMapped = false;
blitScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blitMat));

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  [rw, rh] = rtSize(); lowRT.setSize(rw, rh);
}
addEventListener('resize', resize);

// ---- persistent systems ----
G.scene = scene; G.camera = camera; G.renderer = renderer;
G.input = input; G.audio = audio;
G.fx = new FX(scene);
G.hud = new HUD();
G.cam = new CamRig(camera);
G.weapons = new Weapons(scene);
G.zombies = new ZombieManager(scene);
G.powerups = new PowerUps(scene);
G.box = new MysteryBox(scene);
G.interact = new Interact();
G.rounds = new Rounds();
G.map = MAP;
G.world = null; G.nav = null; G.player = null;
G.debug = location.search.includes('debug');

input.init(canvas);
resize();

// build an initial world so the title screen has the map behind it
function buildWorld() {
  if (G.world) G.world.dispose();
  resetMap();
  G.world = new World(scene);
  G.nav = new Nav(MAP);
}
buildWorld();

// ---- DOM panels ----
const $ = (id) => document.getElementById(id);
const panels = {
  title: $('title'),
  charsel: $('charsel'),
  pause: $('pause'),
  gameover: $('gameover'),
};
function hidePanels() { for (const k in panels) panels[k].classList.add('hidden'); }

// ======================= roster: the four survivors, or any Pokémon =======================
// Remembered in this browser; ?roster=pokemon or ?mon=25 in the URL deep-links a pick.
const store = {
  get(k, d) { try { const v = localStorage.getItem('totu.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('totu.' + k, JSON.stringify(v)); } catch (e) { /* storage blocked: fine */ } },
};
const params = new URLSearchParams(location.search);
G.roster = (params.get('roster') === 'pokemon' || params.has('mon')) ? 'pokemon' : (store.get('roster', 'survivors') === 'pokemon' ? 'pokemon' : 'survivors');
G.charIndex = clamp(store.get('char', 0) | 0, 0, CHARACTERS.length - 1);
G.monId = clamp((parseInt(params.get('mon'), 10) || (store.get('mon', 25) | 0)) || 25, 1, DEX.length);
let pkFilter = store.get('filter', 'all') === '151' ? '151' : 'all';
let pkList = [];            // dex ids currently shown in the grid (filter + search)
let selTile = null;
let gridBuilt = false;
let navHeld = false, navT = 0;
let cryTimer = 0;

const charGrid = $('char-grid');
const csTabs = [...document.querySelectorAll('.cs-tab')];
const pokeSel = $('poke-sel'), pkGrid = $('pk-grid'), pkSearch = $('pk-search');
const pkImg = $('pk-img'), pkName = $('pk-name'), pkTypes = $('pk-types'), pkStats = $('pk-stats'), pkMove = $('pk-move');
const csHint = $('cs-hint');
const HINT = {
  survivors: '◀ ▶ / A·D to choose · ENTER / A to begin · TAB / Y for Pokémon · or click a survivor',
  pokemon: 'TYPE to search · ◀ ▶ ▲ ▼ browse · R / X random · ENTER / A to begin · TAB / Y for survivors',
};

function currentChar() { return G.roster === 'pokemon' ? pokemonChar(G.monId) : CHARACTERS[G.charIndex]; }
const typing = () => document.activeElement === pkSearch;
const hex6 = (n) => '#' + (n >>> 0).toString(16).padStart(6, '0');
const swatchSVG = (a, b) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44'><rect width='44' height='44' fill='${hex6(a)}'/><rect y='26' width='44' height='18' fill='${hex6(b)}'/></svg>`);

// -- survivor cards --
CHARACTERS.forEach((c, i) => {
  const card = document.createElement('div');
  card.className = 'char-card'; card.dataset.i = i;
  card.innerHTML = `<div class="char-portrait" style="background:${hex6(c.cloth)}"></div><div class="char-name">${c.name}</div>`;
  card.addEventListener('click', () => { G.charIndex = i; updateCharSel(); startGame(); });
  card.addEventListener('mouseenter', () => { G.charIndex = i; updateCharSel(); });
  charGrid.appendChild(card);
});
function updateCharSel() {
  [...charGrid.children].forEach((c, i) => c.classList.toggle('sel', i === G.charIndex));
  store.set('char', G.charIndex);
}

// -- Pokémon grid (built once, on first open: 1,025 lazy-loading tiles) --
function buildPokeGrid() {
  if (gridBuilt) return; gridBuilt = true;
  const frag = document.createDocumentFragment();
  for (const m of DEX) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'pk-tile'; b.dataset.id = m.id; b.title = `#${m.id} ${m.name}`;
    const img = document.createElement('img');
    img.loading = 'lazy'; img.decoding = 'async'; img.alt = m.name;
    img.onerror = () => { img.onerror = null; img.src = fallbackSVG(m); };
    img.src = spriteURL(m.id);
    b.appendChild(img);
    const n = document.createElement('span'); n.className = 'n'; n.textContent = String(m.id).padStart(3, '0'); b.appendChild(n);
    b.addEventListener('click', () => selectMon(m.id, true));
    b.addEventListener('dblclick', () => startGame());
    frag.appendChild(b);
  }
  pkGrid.appendChild(frag);
  applyPokeFilter(false);
}
function applyPokeFilter(scroll = true) {
  pkList = searchDex(pkSearch.value, pkFilter);
  const set = new Set(pkList);
  for (const t of pkGrid.children) t.classList.toggle('hide', !set.has(+t.dataset.id));
  pkGrid.classList.toggle('empty', pkList.length === 0);
  if (pkList.length && !set.has(G.monId)) selectMon(pkList[0], false);
  if (scroll) scrollToSel();
}
function selectMon(id, play) {
  G.monId = id; store.set('mon', id);
  if (selTile) selTile.classList.remove('sel');
  selTile = gridBuilt ? pkGrid.children[id - 1] : null;
  if (selTile) selTile.classList.add('sel');
  const c = pokemonChar(id), m = c.mon;
  pkImg.onerror = () => { pkImg.onerror = null; pkImg.src = fallbackSVG(m); };
  pkImg.src = c.sprite; pkImg.alt = m.name;
  pkName.textContent = `#${String(id).padStart(3, '0')}  ${c.name}`;
  pkTypes.innerHTML = m.types.map((t) => `<span class="pk-type" style="background:${TYPE_COLOR[t]}">${t.toUpperCase()}</span>`).join('');
  pkStats.innerHTML = statBars(m).map((s) => `<span>${s.label}</span><div class="pk-bar"><i style="width:${Math.round(s.v * 100)}%"></i></div><b>${s.text}</b>`).join('');
  pkMove.textContent = `KNIFE → ${c.moveName}`;
  // the cry plays once the selection rests on a Pokémon, so holding an arrow doesn't fetch one per step
  if (play) { audio.ensure(); clearTimeout(cryTimer); cryTimer = setTimeout(() => { if (G.monId === id && G.state === 'charsel') audio.playClip(c.cry, 0.35); }, 180); }
}
function scrollToSel() {
  if (!selTile || selTile.classList.contains('hide')) return;
  const top = selTile.offsetTop, bot = top + selTile.offsetHeight;
  if (top < pkGrid.scrollTop + 6) pkGrid.scrollTop = top - 6;
  else if (bot > pkGrid.scrollTop + pkGrid.clientHeight - 6) pkGrid.scrollTop = bot - pkGrid.clientHeight + 6;
}
function gridCols() {
  const cols = getComputedStyle(pkGrid).gridTemplateColumns.split(' ').length;
  return Math.max(1, cols);
}
function navMon(delta) {
  if (!pkList.length) return;
  let i = pkList.indexOf(G.monId); if (i < 0) i = 0;
  const n = pkList.length;
  i = (((i + delta) % n) + n) % n;
  selectMon(pkList[i], true); scrollToSel();
}
function randomMon() {
  const pool = pkList.length ? pkList : DEX.map((m) => m.id);
  selectMon(pick(pool), true); scrollToSel();
}
function setFilter(f) {
  pkFilter = f; store.set('filter', f);
  document.querySelectorAll('.pk-filter').forEach((b) => b.classList.toggle('sel', b.dataset.f === f));
  applyPokeFilter();
}
function setRoster(r, save = true) {
  G.roster = r; if (save) store.set('roster', r);
  csTabs.forEach((t) => t.classList.toggle('sel', t.dataset.roster === r));
  charGrid.classList.toggle('hidden', r !== 'survivors');
  pokeSel.classList.toggle('hidden', r !== 'pokemon');
  csHint.textContent = HINT[r];
  if (r === 'pokemon') {
    buildPokeGrid(); selectMon(G.monId, false); scrollToSel();
    // focus after the current keystroke has finished, so the key that opened this screen isn't typed
    setTimeout(() => { if (G.state === 'charsel' && G.roster === 'pokemon') pkSearch.focus({ preventScroll: true }); }, 0);
  } else pkSearch.blur();
}
function toggleRoster() { audio.ui(); setRoster(G.roster === 'pokemon' ? 'survivors' : 'pokemon'); }

csTabs.forEach((t) => t.addEventListener('click', () => setRoster(t.dataset.roster)));
document.querySelectorAll('.pk-filter').forEach((b) => b.addEventListener('click', () => (b.dataset.f === 'rand' ? randomMon() : setFilter(b.dataset.f))));
pkSearch.addEventListener('input', () => applyPokeFilter());
document.querySelectorAll('.pk-filter').forEach((b) => b.classList.toggle('sel', b.dataset.f === pkFilter));
addEventListener('keydown', (e) => {
  if (G.state === 'charsel' && e.code === 'Tab') e.preventDefault();      // TAB flips the roster, never the focus
  if (e.code === 'Escape' && typing()) pkSearch.blur();
});

// HUD chip + game-over line: who you are playing as
function updateChip(def) {
  const img = $('chip-img');
  if (def.kind === 'pokemon') {
    img.onerror = () => { img.onerror = null; img.src = fallbackSVG(def.mon); };
    img.src = def.sprite;
    $('chip-name').textContent = def.name;
    $('chip-sub').textContent = def.types.map((t) => t.toUpperCase()).join(' / ') + ' · ' + def.moveName;
  } else {
    img.onerror = null; img.src = swatchSVG(def.cloth, def.accent);
    $('chip-name').textContent = def.name;
    $('chip-sub').textContent = 'SURVIVOR';
  }
  $('go-as').textContent = def.name;
}

// ---- state machine ----
let state = 'title';
const titleClock = { t: 0 };
let titleArmT = 0;   // the title ignores input for a beat after a quit, so the click that quit doesn't also leave it

function setState(s) {
  state = s;
  G.state = s;
  hidePanels();
  if (s === 'title') { panels.title.classList.remove('hidden'); G.hud.hide(); audio.playMusic('title'); pkSearch.blur(); titleArmT = 0.35; }
  if (s === 'charsel') { panels.charsel.classList.remove('hidden'); updateCharSel(); setRoster(G.roster, false); G.hud.hide(); }
  if (s === 'playing') { G.hud.show(); audio.playMusic('battle'); }
  if (s === 'pause') { panels.pause.classList.remove('hidden'); }
  if (s === 'gameover') {
    panels.gameover.classList.remove('hidden'); G.hud.hide(); audio.stopMusic(); audio.roundEnd();
    $('go-round').textContent = G.rounds.round;
    $('go-points').textContent = (G.player ? G.player.points : 0).toLocaleString();
  }
}

G.setState = setState;
G.over = () => { if (state === 'playing') setState('gameover'); };

function startGame() {
  const def = currentChar();
  pkSearch.blur();
  buildWorld();
  G.box.reset();
  G.zombies.clear(); G.weapons.clear(); G.powerups.clear(); G.fx.clear(); G.interact.reset();
  G.powerOn = false; G.papLinked = false; G.instakill = false; G.doublePoints = false; G.lure = null; G.time = 0;
  if (!G.player) G.player = new Player(scene, def);
  else G.player.setCharacter(def);
  G.player.reset();
  updateChip(def);
  G.cam.snapTo(G.player);
  G.rounds.start();
  setState('playing');
  G.player.playCry();
}
G.startGame = startGame;

// title: any input -> character select
input.onAny(() => { audio.ensure(); if (state === 'title') setState('charsel'); });

// menu buttons
$('btn-restart').addEventListener('click', () => setState('charsel'));
$('btn-resume').addEventListener('click', () => setState('playing'));
$('btn-quit').addEventListener('click', () => setState('title'));

// ---- update per state ----
function updatePlaying(dt) {
  G.time += dt;
  G.cam.update(dt, input.intent, G.player);
  G.player.update(dt, input);
  G.rounds.update(dt);
  G.nav.updateFlow(G.player.pos.x, G.player.pos.z, dt);
  G.zombies.update(dt);
  G.weapons.update(dt);
  G.powerups.update(dt, G.player);
  G.box.update(dt);
  if (G.world) G.world.update(dt, G.time);
  G.interact.update(dt, input);
  // monkey-bomb lure
  if (G.lure) { G.lure.t -= dt; if (G.lure.t <= 0) { G.weapons.splashDamage(G.lure.pos, 5, 3000); G.lure = null; } }
  G.fx.update(dt);
  G.fx.applyShake(camera, dt);
  G.hud.update(dt);
  if (input.intent.pause) setState('pause');
}

function updateTitleCam(dt) {
  titleClock.t += dt;
  const cx = 0, cz = 6;
  camera.position.set(cx + Math.sin(titleClock.t * 0.1) * 26, 20, cz + Math.cos(titleClock.t * 0.1) * 26);
  camera.lookAt(cx, 0, cz);
  if (G.world) G.world.update(dt, titleClock.t);
  G.fx.update(dt);
}

// character select: keyboard / gamepad navigation
function updateCharSelect(dt) {
  const I = input.intent, t = typing();
  // TAB / Y / R-stick click flip the roster (while typing, only TAB and gamepad buttons count)
  const flip = t ? (input.hit('Tab') || (input.usingGamepad && (I.switchWeapon || I.tactical))) : (I.switchWeapon || I.tactical);
  if (flip) { toggleRoster(); return; }

  if (G.roster === 'survivors') {
    if (input.hit('ArrowRight', 'KeyD') || I.cameraRotate < -0.3) { G.charIndex = (G.charIndex + 1) % CHARACTERS.length; updateCharSel(); }
    if (input.hit('ArrowLeft', 'KeyA') || I.cameraRotate > 0.3) { G.charIndex = (G.charIndex + CHARACTERS.length - 1) % CHARACTERS.length; updateCharSel(); }
    for (let i = 0; i < 4; i++) if (input.hit('Digit' + (i + 1))) { G.charIndex = i; updateCharSel(); }
    if (I.start || I.interact) startGame();
    return;
  }

  // Pokémon roster: held arrows / WASD / d-pad / left stick browse with auto-repeat
  // a tap counts even if it was released before this frame polled (hit); holding repeats (held)
  const key = (c) => input.hit(c) || input.held(c);
  let hx = 0, hy = 0;
  if (key('ArrowRight') || (!t && key('KeyD'))) hx = 1;
  if (key('ArrowLeft') || (!t && key('KeyA'))) hx = -1;
  if (key('ArrowDown') || (!t && key('KeyS'))) hy = 1;
  if (key('ArrowUp') || (!t && key('KeyW'))) hy = -1;
  if (input.usingGamepad) {
    if (I.cameraRotate < -0.3 || I.moveVec.x > 0.5) hx = 1; else if (I.cameraRotate > 0.3 || I.moveVec.x < -0.5) hx = -1;
    if (I.zoom < -0.3 || I.moveVec.y < -0.5) hy = 1; else if (I.zoom > 0.3 || I.moveVec.y > 0.5) hy = -1;
  }
  if (hx || hy) {
    const step = () => { if (hx) navMon(hx); if (hy) navMon(hy * gridCols()); };
    if (!navHeld) { step(); navHeld = true; navT = 0.32; }
    else { navT -= dt; if (navT <= 0) { step(); navT = 0.11; } }
  } else navHeld = false;

  if ((!t && input.hit('KeyR')) || (input.usingGamepad && I.reload)) randomMon();
  // begin: ENTER always; SPACE / F / E only when not typing; gamepad A / Start always
  const begin = input.hit('Enter') || (!t && (I.start || I.interact)) || (input.usingGamepad && (I.start || I.interact));
  if (begin) startGame();
}

// ---- main loop ----
let last = performance.now();
let fpsAcc = 0, fpsN = 0, fpsT = 0, lowFps = 0;
const fpsEl = $('fps');
if (G.debug) fpsEl.classList.remove('hidden');

function frame(now) {
  requestAnimationFrame(frame);
  const raw = Math.min(0.05, (now - last) / 1000); last = now;

  input.poll();

  if (state === 'playing') updatePlaying(raw);
  else if (state === 'charsel') {
    updateTitleCam(raw);
    updateCharSelect(raw);
  } else if (state === 'pause') {
    if (input.intent.pause || input.intent.start) setState('playing');
  } else if (state === 'gameover') {
    if (input.intent.start || input.intent.interact) setState('charsel');
    G.fx.update(raw);
  } else {
    updateTitleCam(raw);
    // any key, click or pad button leaves the title — including after QUIT TO TITLE (the old
    // one-shot any-key hook left that screen a dead end)
    titleArmT -= raw;
    if (titleArmT <= 0 && (input.pressed.size > 0 || input.intent.start || input.intent.interact || input.intent.fire)) { audio.ensure(); setState('charsel'); }
  }

  input.endFrame();

  // render: scene -> low-res RT -> nearest upscale to canvas
  renderer.setRenderTarget(lowRT);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  renderer.render(blitScene, blitCam);

  // fps + adaptive degrade
  if (G.debug) { fpsAcc += 1 / Math.max(0.001, raw); fpsN++; fpsT += raw; if (fpsT > 0.5) { fpsEl.textContent = Math.round(fpsAcc / fpsN) + ' fps  px' + PIXEL.toFixed(1); fpsAcc = 0; fpsN = 0; fpsT = 0; } }
  const fps = 1 / Math.max(0.001, raw);
  if (state === 'playing' && fps < 40) { lowFps += raw; if (lowFps > 2 && PIXEL < 5) { PIXEL += 0.5; resize(); lowFps = 0; } } else lowFps = Math.max(0, lowFps - raw);
}

setState('title');
requestAnimationFrame(frame);

// expose for debugging / verification
window.G = G;
