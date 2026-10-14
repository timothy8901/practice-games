'use strict';
// UNDERBYTE playtest server.
//
// Keeps ONE headless Chromium page open for a whole play session so an agent can play the
// game turn by turn like a person: look at a screenshot, decide, press keys for a while, look
// again. Game logic is frozen (UB.debug.pauseLogic) while the agent is thinking and runs in
// real time while it acts, so the session plays out at normal speed. Playwright records the
// page; on quit the frozen stretches are cut out with ffmpeg, leaving one continuous gameplay
// video (mp4) of only the live segments.
//
// Started and driven by play.cjs (see playtests/README.md). Usage:
//   node playserver.cjs --session <dir> [--save <save.json>] [--pad] [--size 960x540]
// Writes <dir>/server.json {port,pid} once it is listening.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const argv = process.argv.slice(2);
const arg = (name, dflt) => { const i = argv.indexOf('--' + name); return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true) : dflt; };
const SESSION = path.resolve(arg('session', ''));
if (!arg('session')) { console.error('--session <dir> is required'); process.exit(2); }
const SAVE_IN = arg('save', null);
const PAD = !!arg('pad', false);
const [VW, VH] = String(arg('size', '960x540')).split('x').map(Number);
const INDEX = path.resolve(__dirname, '..', '..', 'index.html');
const SHOTS = path.join(SESSION, 'shots');
const RAW = path.join(SESSION, 'raw');
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(RAW, { recursive: true });

// Key aliases so agents can write what a player would say.
const KEYS = {
  left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown',
  jump: 'Space', light: 'KeyZ', heavy: 'KeyX', special: 'KeyC', dash: 'ShiftLeft',
  overclock: 'KeyV', pause: 'Escape', map: 'KeyM', confirm: 'Enter', back: 'Escape',
};
const key = (k) => KEYS[k] || k;

// Standard-mapping gamepad button names -> index.
const PAD_BTN = { a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, lt: 6, rt: 7, back: 8, start: 9, ls: 10, rs: 11, up: 12, down: 13, left: 14, right: 15 };

const log = { session: path.basename(SESSION), startedAt: new Date().toISOString(), size: [VW, VH], pad: PAD, turns: [], marks: [], debugCalls: [], errors: [], segments: [] };
let t0 = 0;            // wall clock when the page (and its video) started
let liveTotal = 0;     // seconds of live (unfrozen) play so far = timestamp in the final video
let turn = 0;
const held = new Set();
let browser, context, page;
const pendingErrors = [];

function now() { return (Date.now() - t0) / 1000; }

async function boot() {
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({ viewport: { width: VW, height: VH }, recordVideo: { dir: RAW, size: { width: VW, height: VH } } });
  // Restore a save carried over from an earlier clip of the same playtester.
  if (SAVE_IN && fs.existsSync(SAVE_IN)) {
    const saved = JSON.parse(fs.readFileSync(SAVE_IN, 'utf8'));
    await context.addInitScript((s) => {
      try { for (const k of Object.keys(s)) if (s[k] != null) localStorage.setItem(k, s[k]); } catch (e) { /* storage blocked */ }
    }, saved);
  }
  if (PAD) {
    // A virtual standard-mapping gamepad the agent controls with {"pad":{...}} steps.
    await context.addInitScript(() => {
      const btn = () => ({ pressed: false, touched: false, value: 0 });
      window.__ptPad = { id: 'Playtest Pad (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, btn) };
      navigator.getGamepads = () => [window.__ptPad, null, null, null];
    });
  }
  // Per-frame event sampler: room changes, damage, deaths, screens, bosses, pickups.
  await context.addInitScript(() => {
    window.__ptEvents = [];
    let last = null;
    function sample() {
      try {
        const d = window.UB && window.UB.debug;
        if (d && d.state) {
          const s = d.state();
          if (last) {
            const ev = (type, info) => window.__ptEvents.push(Object.assign({ f: s.frame, type: type }, info || {}));
            if (s.screen !== last.screen) ev('screen', { from: last.screen, to: s.screen });
            if (s.roomId !== last.roomId && s.roomId) ev('room', { from: last.roomId, to: s.roomId });
            if (s.hp < last.hp) ev('hurt', { hp: s.hp, maxHp: s.maxHp, room: s.roomId, hazard: s.hazardFreeze });
            if (s.hp > last.hp && last.hp > 0) ev('heal', { hp: s.hp });
            if (s.maxHp > last.maxHp) ev('maxHp', { maxHp: s.maxHp });
            if (s.deaths > last.deaths) ev('death', { room: s.roomId });
            if (s.bits !== last.bits) ev('bits', { bits: s.bits, delta: s.bits - last.bits });
            if (s.bossFight !== last.bossFight) ev('bossFight', { state: s.bossFight, boss: s.boss && s.boss.id });
            if (s.overclock && !last.overclock) ev('overclock', {});
            if (s.abilities && last.abilities) for (const a of ['echoJump', 'burstLine', 'gripProtocol']) if (s.abilities[a] && !last.abilities[a]) ev('ability', { ability: a });
            if (window.__ptEvents.length > 400) window.__ptEvents.splice(0, 200);
          }
          last = s;
        }
      } catch (e) { /* sampler must never break the game */ }
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
  page = await context.newPage();
  t0 = Date.now();
  page.on('pageerror', (e) => pendingErrors.push('pageerror: ' + (e && e.message ? e.message : String(e))));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') pendingErrors.push(`[${m.type()}] ${m.text()}`); });
  await page.goto('file://' + INDEX);
  await page.waitForFunction(() => window.UB && window.UB.debug && window.UB.debug.state, null, { timeout: 15000 });
  await page.waitForTimeout(400);
  await freeze(true);
}

async function freeze(on) { await page.evaluate((v) => window.UB.debug.pauseLogic(v), on); }

async function summary() {
  return page.evaluate(() => {
    const s = window.UB.debug.state();
    const ev = window.__ptEvents.splice(0);
    return {
      screen: s.screen, room: s.roomId, zone: s.zoneId, fighter: s.fighter,
      x: Math.round(s.x), y: Math.round(s.y), grounded: s.grounded, playerState: s.playerState,
      hp: s.hp, maxHp: s.maxHp, energy: Math.round(s.energy), energyMax: s.energyMax, meter: Math.round(s.meter), overclock: s.overclock,
      bits: s.bits, abilities: s.abilities, cores: s.cores, bossesDefeated: s.bossesDefeated, deaths: s.deaths,
      boss: s.boss, bossFight: s.bossFight, prompt: s.prompt, nearNode: s.nearNode, nearVendor: s.nearVendor,
      enemies: s.enemies, frame: s.frame, playTimeFrames: s.playTimeFrames, events: ev,
    };
  });
}

async function shot(name) {
  const file = path.join(SHOTS, `${String(turn).padStart(4, '0')}${name ? '-' + name : ''}.png`);
  await page.screenshot({ path: file });
  return file;
}

async function setPad(spec) {
  await page.evaluate((sp) => {
    const p = window.__ptPad; if (!p) return;
    p.timestamp++;
    for (const [k, v] of Object.entries(sp.buttons || {})) { const b = p.buttons[k]; if (b) { b.pressed = !!v; b.touched = !!v; b.value = v ? 1 : 0; } }
    if (Array.isArray(sp.axes)) sp.axes.forEach((a, i) => { p.axes[i] = a; });
  }, spec);
}

function padSpec(step) {
  // {"pad":{"press":["a"],"release":["a"],"axes":[x,y]}} or {"pad":{"buttons":{"0":true}}}
  const p = step.pad, buttons = Object.assign({}, p.buttons || {});
  for (const b of p.press || []) buttons[PAD_BTN[b] ?? b] = true;
  for (const b of p.release || []) buttons[PAD_BTN[b] ?? b] = false;
  return { buttons, axes: p.axes };
}

// One agent turn: unfreeze, play the steps in real time, freeze, report.
async function act(steps, opts) {
  turn++;
  const segStart = now();
  await freeze(false);
  for (const st of steps) {
    if (st.wait != null) await page.waitForTimeout(Math.max(0, Math.min(30000, st.wait)));
    else if (st.down) for (const k of [].concat(st.down)) { await page.keyboard.down(key(k)); held.add(key(k)); }
    else if (st.up) for (const k of [].concat(st.up)) { await page.keyboard.up(key(k)); held.delete(key(k)); }
    else if (st.tap) { const ks = [].concat(st.tap).map(key); for (const k of ks) await page.keyboard.down(k); await page.waitForTimeout(st.ms || 50); for (const k of ks) await page.keyboard.up(k); }
    else if (st.pad) { await setPad(padSpec(st)); if (st.ms) { await page.waitForTimeout(st.ms); } }
    else if (st.type) await page.keyboard.type(String(st.type));
  }
  if (!opts.keep) { for (const k of held) await page.keyboard.up(k); held.clear(); if (PAD) await setPad({ buttons: Object.fromEntries(Array.from({ length: 17 }, (_, i) => [i, false])), axes: [0, 0, 0, 0] }); }
  // Let one more frame land so the released keys register before freezing.
  await page.waitForTimeout(20);
  await freeze(true);
  const segEnd = now();
  log.segments.push([segStart, segEnd]);
  liveTotal += segEnd - segStart;
}

async function handle(cmd) {
  const res = { turn: 0 };
  if (cmd.act) {
    await act(cmd.act, { keep: !!cmd.keep });
  } else if (cmd.debug) {
    turn++;
    const val = await page.evaluate((code) => { try { const v = (0, eval)(code); return JSON.parse(JSON.stringify(v === undefined ? null : v)); } catch (e) { return { error: String(e) }; } }, cmd.debug);
    log.debugCalls.push({ turn, video: +liveTotal.toFixed(2), code: cmd.debug });
    await freeze(true);  // a debug call (e.g. warp) must not leave logic running
    res.debugResult = val;
  } else if (cmd.mark) {
    log.marks.push({ turn, video: +liveTotal.toFixed(2), note: String(cmd.mark) });
    res.video = +liveTotal.toFixed(2);
    return res;
  } else if (cmd.shot) {
    turn++;
  } else if (cmd.quit) {
    return null;
  }
  res.turn = turn;
  res.video = +liveTotal.toFixed(2);
  res.state = await summary();
  if (cmd.noshot !== true) res.shot = await shot(cmd.name);
  res.errors = pendingErrors.splice(0);
  if (res.errors.length) log.errors.push({ turn, video: res.video, errors: res.errors });
  log.turns.push({ turn, video: res.video, cmd: cmd.act ? { act: cmd.act } : cmd.debug ? { debug: cmd.debug } : { shot: true }, room: res.state.room, hp: res.state.hp, events: res.state.events });
  return res;
}

// Merge segments separated by tiny gaps and cut the frozen time out of the raw video.
function convert(rawFile, outFile) {
  const segs = [];
  for (const [a, b] of log.segments) {
    const s = Math.max(0, a - 0.04), e = b + 0.06;
    if (segs.length && s - segs[segs.length - 1][1] < 0.15) segs[segs.length - 1][1] = e; else segs.push([s, e]);
  }
  if (!segs.length) return false;
  const expr = segs.map(([a, b]) => `between(t,${a.toFixed(3)},${b.toFixed(3)})`).join('+');
  const filterFile = path.join(SESSION, 'select.txt');
  fs.writeFileSync(filterFile, `select='${expr}',setpts=N/FRAME_RATE/TB`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', rawFile, '-filter_script:v', filterFile, '-an', '-r', '25',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '30', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', outFile]);
  return true;
}

async function finish(cmd) {
  // Carry the save + settings over to the next clip of the same playtester.
  let saveOut = null;
  try {
    const st = await page.evaluate(() => ({ 'underbyte.save': localStorage.getItem('underbyte.save'), 'underbyte.settings': localStorage.getItem('underbyte.settings') }));
    saveOut = path.join(SESSION, 'save.json');
    fs.writeFileSync(saveOut, JSON.stringify(st, null, 1));
  } catch (e) { /* page may be gone */ }
  const video = page.video();
  await context.close();
  const raw = video ? await video.path() : null;
  const outName = (cmd && cmd.out) || (log.session + '.mp4');
  const recDir = path.resolve(__dirname, '..', 'recordings');
  fs.mkdirSync(recDir, { recursive: true });
  const out = path.join(recDir, outName);
  let converted = false, convertError = null;
  try { converted = raw ? convert(raw, out) : false; } catch (e) { convertError = String(e.message || e); }
  if (converted && raw) fs.rmSync(raw, { force: true });
  log.endedAt = new Date().toISOString();
  log.liveSeconds = +liveTotal.toFixed(2);
  log.video = converted ? path.relative(path.resolve(__dirname, '..'), out) : null;
  log.convertError = convertError;
  fs.writeFileSync(path.join(SESSION, 'session.json'), JSON.stringify(log, null, 1));
  await browser.close();
  return { video: converted ? out : null, liveSeconds: log.liveSeconds, save: saveOut, sessionLog: path.join(SESSION, 'session.json'), convertError };
}

(async () => {
  await boot();
  let busy = Promise.resolve();
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      busy = busy.then(async () => {
        let cmd; try { cmd = JSON.parse(body || '{}'); } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: 'bad json: ' + e.message })); return; }
        try {
          const out = await handle(cmd);
          if (out === null) {
            const fin = await finish(cmd);
            res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(fin));
            server.close(); fs.rmSync(path.join(SESSION, 'server.json'), { force: true });
            setTimeout(() => process.exit(0), 50);
            return;
          }
          res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(out));
        } catch (e) {
          res.writeHead(500); res.end(JSON.stringify({ error: String(e && e.stack || e) }));
        }
      });
    });
  });
  server.listen(0, '127.0.0.1', () => {
    fs.writeFileSync(path.join(SESSION, 'server.json'), JSON.stringify({ port: server.address().port, pid: process.pid }));
  });
  // Safety net: a forgotten session shuts itself down (and still saves its video) after 3 hours.
  setTimeout(async () => { try { await finish({}); } finally { process.exit(0); } }, 3 * 3600 * 1000).unref();
})().catch((e) => { console.error(e); fs.writeFileSync(path.join(SESSION, 'server-error.txt'), String(e && e.stack || e)); process.exit(1); });
