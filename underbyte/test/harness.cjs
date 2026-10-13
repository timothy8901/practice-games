// Shared Playwright launcher for UNDERBYTE tests.
// Usage (CommonJS):  const { launch } = require('./harness.cjs');
//   const t = await launch();           // { browser, page, errors, url }
//   ... await t.page.keyboard.down('ArrowRight') ...
//   await t.close();
// `errors` collects page errors + console.error lines. Tests should assert it stays empty.
const path = require('path');
const { chromium } = require('playwright');

const INDEX = path.resolve(__dirname, '..', 'index.html');

async function launch(opts = {}) {
  const browser = await chromium.launch({ headless: opts.headless !== false });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  const logs = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + (e && e.stack ? e.stack : String(e))));
  page.on('console', (m) => {
    const line = `[${m.type()}] ${m.text()}`;
    logs.push(line);
    if (m.type() === 'error') errors.push(line);
  });
  const url = opts.url || ('file://' + INDEX);
  await page.goto(url);
  // Give scripts a moment to boot.
  await page.waitForTimeout(opts.bootMs ?? 300);
  return {
    browser, page, errors, logs, url,
    // Hold a key for n logic frames (approx; 60 Hz) then release.
    async tap(key, ms = 40) { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); },
    async hold(key, ms) { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); },
    async shot(file) { await page.screenshot({ path: file }); },
    async close() { await browser.close(); },
  };
}

module.exports = { launch, INDEX };
