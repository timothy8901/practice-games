// Generic headless play-test harness for the browser game.
// Usage: node playtest.mjs <url> <outdir> [script.json]
//  script.json: [{"keys":["ArrowRight","Enter"],"holdMs":120,"waitMs":500,"shot":"name"}, {"eval":"window.__game && window.__game.state()"}, ...]
import { chromium } from 'playwright';
import fs from 'node:fs';
const [,, url, outdir = 'out', scriptPath] = process.argv;
fs.mkdirSync(outdir, { recursive: true });
const browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}), args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const log = [];
page.on('console', m => log.push({ t: m.type(), text: m.text() }));
page.on('pageerror', e => log.push({ t: 'pageerror', text: String(e && e.stack || e) }));
page.on('requestfailed', r => log.push({ t: 'requestfailed', text: r.url() }));
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${outdir}/00-boot.png` });
let n = 1;
const steps = scriptPath ? JSON.parse(fs.readFileSync(scriptPath, 'utf8')) : [];
const results = [];
for (const s of steps) {
  if (s.keys) for (const k of s.keys) { await page.keyboard.down(k); await page.waitForTimeout(s.holdMs ?? 80); await page.keyboard.up(k); await page.waitForTimeout(s.gapMs ?? 60); }
  if (s.click) await page.mouse.click(s.click[0], s.click[1]);
  if (s.waitMs) await page.waitForTimeout(s.waitMs);
  if (s.eval) { try { results.push({ eval: s.eval, value: await page.evaluate(s.eval) }); } catch (e) { results.push({ eval: s.eval, error: String(e) }); } }
  if (s.shot) await page.screenshot({ path: `${outdir}/${String(n).padStart(2,'0')}-${s.shot}.png` });
  n++;
}
const errors = log.filter(l => l.t === 'error' || l.t === 'pageerror' || l.t === 'requestfailed');
fs.writeFileSync(`${outdir}/log.json`, JSON.stringify({ log, results }, null, 2));
console.log(JSON.stringify({ errors: errors.length, firstErrors: errors.slice(0, 10), results }, null, 2));
await browser.close();
process.exit(errors.length ? 1 : 0);
