// On-device check for the Dodeca Rings APK. The GitHub Actions workflow runs it against an
// Android emulator: install the APK, launch it, then play the game through the WebView's
// DevTools socket (the APK is a debug build, so the socket is open) and take screenshots.
// It exits non-zero when a check fails, which keeps a broken APK from being published.
//
//   node ci/device-check.mjs path/to/DodecaRings.apk     (needs adb and Node 22)
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const PKG = 'io.github.timothy8901.dodecarings';
const apk = process.argv[2] || 'DodecaRings.apk';
const sh = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let failed = 0;
const check = (ok, msg) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`);
  if (!ok) failed++;
};
const screenshot = (file) => {
  writeFileSync(file, execSync('adb exec-out screencap -p', { maxBuffer: 1 << 26 }));
  console.log(`saved ${file}`);
};

console.log(sh(`adb install -r ${apk}`));
console.log(sh(`adb shell am start -W -n ${PKG}/.MainActivity`));

// The app's process, then its WebView's DevTools socket.
let pid = '';
for (let i = 0; i < 30 && !pid; i++) {
  try { pid = sh(`adb shell pidof ${PKG}`); } catch { await sleep(1000); }
}
check(!!pid, `the app is running (pid ${pid})`);
if (!pid) process.exit(1);
sh(`adb forward tcp:9222 localabstract:webview_devtools_remote_${pid}`);
let page = null;
for (let i = 0; i < 30 && !page; i++) {
  try {
    const targets = await (await fetch('http://127.0.0.1:9222/json')).json();
    page = targets.find((t) => t.type === 'page');
  } catch { /* the socket is not up yet */ }
  if (!page) await sleep(1000);
}
check(!!page, `the WebView shows ${page && page.url}`);
if (!page) process.exit(1);

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let nextId = 0;
const waiting = new Map();
const errors = [];
ws.onmessage = (event) => {
  const m = JSON.parse(event.data);
  if (m.id && waiting.has(m.id)) {
    waiting.get(m.id)(m);
    waiting.delete(m.id);
  } else if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    errors.push((d.exception && d.exception.description) || d.text);
  } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
  }
};
const send = (method, params = {}) => new Promise((resolve) => {
  const id = ++nextId;
  waiting.set(id, resolve);
  ws.send(JSON.stringify({ id, method, params }));
});
const js = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  const d = r.result.exceptionDetails;
  if (d) throw new Error((d.exception && d.exception.description) || d.text);
  return r.result.result.value;
};
await send('Runtime.enable');

// The game boots inside the app.
for (let i = 0; i < 40 && !(await js('!!window.DodecaRings')); i++) await sleep(500);
const info = await js(`({ title: document.title, platform: window.Capacitor && Capacitor.getPlatform(),
  ua: navigator.userAgent, w: innerWidth, h: innerHeight, dpr: devicePixelRatio })`);
console.log(JSON.stringify(info));
check(info.title === 'Dodeca Rings' && info.platform === 'android', 'the game loads inside the Android app');
await sleep(2500);
screenshot('android-title.png');

// Free Play, then a finger swipe along ring 3 on the dial.
await js('DodecaRings.startFree()');
await sleep(1500);
check(await js(`DodecaRings.G.mode === 'free'`), 'Free Play starts');
const pts = await js(`(() => {
  const r = document.getElementById('dialCanvas').getBoundingClientRect(), out = [];
  for (let i = 0; i <= 12; i++) { const p = DodecaRings.dialPoint(3, 0.3 + (0.7 * i) / 12); out.push({ x: r.left + p.x, y: r.top + p.y }); }
  return out;
})()`);
const touch = (type, p) => send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p.x, y: p.y, id: 1 }] : [] });
await touch('touchStart', pts[0]);
for (const p of pts.slice(1)) { await touch('touchMove', p); await sleep(16); }
await touch('touchEnd');
await sleep(900);
const hist = await js('DodecaRings.G.history.map((m) => [m.f, m.lo, m.hi, m.k, m.src])');
check(hist.length === 1 && hist[0][1] === 3 && hist[0][3] === 1 && hist[0][4] === 'dial',
  `a finger swipe along ring 3 on the dial turns it: ${JSON.stringify(hist)}`);

// Tap Scramble, then Solve, with a finger, as a player would (counting frames while the scramble plays).
const tap = async (id) => {
  const p = await js(`(() => { const r = document.getElementById('${id}').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await touch('touchStart', p);
  await sleep(80);
  await touch('touchEnd');
};
const turning = async () => {
  for (let i = 0; i < 30; i++) { if (await js('DodecaRings.busy()')) return true; await sleep(100); }
  return false;
};
const stopped = async () => {
  for (let i = 0; i < 240 && (await js('DodecaRings.busy()')); i++) await sleep(250);
};
const hud = () => js(`({ text: document.getElementById('hudSub').textContent,
  solved: DodecaRings.isSolved(DodecaRings.G.state), solveButton: !document.getElementById('btnSolve').disabled })`);
await stopped();
await js(`(() => { const c = window.__frames = { n: 0, t0: performance.now(), on: true };
  (function tick() { c.n++; if (c.on) requestAnimationFrame(tick); })(); })()`);
await tap('btnScramble');
check(await turning(), 'tapping Scramble starts a scramble');
await stopped();
const fps = await js(`(() => { const c = window.__frames; c.on = false; return c.n / ((performance.now() - c.t0) / 1000); })()`);
console.log(`animation: ${fps.toFixed(1)} frames a second on the emulator (software rendering)`);
const mixed = await hud();
console.log(JSON.stringify(mixed));
check(!mixed.solved && mixed.text === '0 moves' && mixed.solveButton,
  'the scramble mixes the puzzle, and the header and the Solve button show it');
await sleep(1200);
screenshot('android-scrambled.png');
await tap('btnSolve');
check(await turning(), 'tapping Solve starts solving');
await stopped();
const after = await hud();
console.log(JSON.stringify(after));
check(after.solved && after.text === '0 moves · solved' && !after.solveButton, 'Solve turns the puzzle back to solved');

check(errors.length === 0, `no script errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
ws.close();
console.log('--- recent log lines from the app ---');
try { console.log(sh(`adb logcat -d -t 300 Capacitor/Console:V Capacitor:V *:S`)); } catch { /* no log */ }
console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exit(failed ? 1 : 0);
