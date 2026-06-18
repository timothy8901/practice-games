// ============ Theater of the Undead — boot, render pipeline, state machine, loop ============
import * as THREE from 'three';
import { G, clamp, damp } from './core.js';
import { MAP, resetMap } from './mapdata.js';
import { CHARACTERS } from './config.js';
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
G.charIndex = 0;
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
const panels = {
  title: document.getElementById('title'),
  charsel: document.getElementById('charsel'),
  pause: document.getElementById('pause'),
  gameover: document.getElementById('gameover'),
};
function hidePanels() { for (const k in panels) panels[k].classList.add('hidden'); }

// build character cards
const charGrid = document.getElementById('char-grid');
CHARACTERS.forEach((c, i) => {
  const card = document.createElement('div');
  card.className = 'char-card'; card.dataset.i = i;
  card.innerHTML = `<div class="char-portrait" style="background:#${c.cloth.toString(16).padStart(6, '0')}"></div><div class="char-name">${c.name}</div>`;
  card.addEventListener('click', () => { G.charIndex = i; updateCharSel(); startGame(); });
  card.addEventListener('mouseenter', () => { G.charIndex = i; updateCharSel(); });
  charGrid.appendChild(card);
});
function updateCharSel() {
  [...charGrid.children].forEach((c, i) => c.classList.toggle('sel', i === G.charIndex));
}

// ---- state machine ----
let state = 'title';
const titleClock = { t: 0 };

function setState(s) {
  state = s;
  G.state = s;
  hidePanels();
  if (s === 'title') { panels.title.classList.remove('hidden'); G.hud.hide(); audio.playMusic('title'); }
  if (s === 'charsel') { panels.charsel.classList.remove('hidden'); updateCharSel(); G.hud.hide(); }
  if (s === 'playing') { G.hud.show(); audio.playMusic('battle'); }
  if (s === 'pause') { panels.pause.classList.remove('hidden'); }
  if (s === 'gameover') {
    panels.gameover.classList.remove('hidden'); G.hud.hide(); audio.stopMusic(); audio.roundEnd();
    document.getElementById('go-round').textContent = G.rounds.round;
    document.getElementById('go-points').textContent = (G.player ? G.player.points : 0).toLocaleString();
  }
}

G.setState = setState;
G.over = () => { if (state === 'playing') setState('gameover'); };

function startGame() {
  buildWorld();
  G.box.reset();
  G.zombies.clear(); G.weapons.clear(); G.powerups.clear(); G.fx.clear(); G.interact.reset();
  G.powerOn = false; G.papLinked = false; G.instakill = false; G.doublePoints = false; G.lure = null; G.time = 0;
  if (!G.player) G.player = new Player(scene, CHARACTERS[G.charIndex]);
  else { G.player.char = CHARACTERS[G.charIndex]; G.player.reset(); }
  G.cam.snapTo(G.player);
  G.rounds.start();
  setState('playing');
}

// title: any input -> character select
input.onAny(() => { audio.ensure(); if (state === 'title') setState('charsel'); });

// menu buttons
document.getElementById('btn-restart').addEventListener('click', () => setState('charsel'));
document.getElementById('btn-resume').addEventListener('click', () => setState('playing'));
document.getElementById('btn-quit').addEventListener('click', () => setState('title'));

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

// ---- main loop ----
let last = performance.now();
let fpsAcc = 0, fpsN = 0, fpsT = 0, lowFps = 0;
const fpsEl = document.getElementById('fps');
if (G.debug) fpsEl.classList.remove('hidden');

function frame(now) {
  requestAnimationFrame(frame);
  const raw = Math.min(0.05, (now - last) / 1000); last = now;

  input.poll();

  if (state === 'playing') updatePlaying(raw);
  else if (state === 'charsel') {
    updateTitleCam(raw);
    // keyboard / gamepad nav of character cards
    if (input.hit('ArrowRight', 'KeyD') || input.intent.cameraRotate < -0.3) { G.charIndex = (G.charIndex + 1) % CHARACTERS.length; updateCharSel(); }
    if (input.hit('ArrowLeft', 'KeyA') || input.intent.cameraRotate > 0.3) { G.charIndex = (G.charIndex + CHARACTERS.length - 1) % CHARACTERS.length; updateCharSel(); }
    for (let i = 0; i < 4; i++) if (input.hit('Digit' + (i + 1))) { G.charIndex = i; updateCharSel(); }
    if (input.intent.start || input.intent.interact) startGame();
  } else if (state === 'pause') {
    if (input.intent.pause || input.intent.start) setState('playing');
  } else if (state === 'gameover') {
    if (input.intent.start || input.intent.interact) setState('charsel');
    G.fx.update(raw);
  } else { updateTitleCam(raw); }

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
